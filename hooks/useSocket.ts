import { useEffect, useState, useRef, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { Comment, DisplaySettings } from '../types';

const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:8000';
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export const useSocket = (instanceId?: string) => {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [connected, setConnected] = useState(false);
  const [comments, setComments] = useState<Comment[]>([]);
  const [settings, setSettings] = useState<DisplaySettings | null>(null);
  const fallbackTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const pendingCommentsRef = useRef<Map<string, NodeJS.Timeout>>(new Map());

  const handleNewComment = useCallback((comment: Comment) => {
    const lagSeconds = settings?.lag_seconds || 0;
    
    if (lagSeconds > 0) {
      // 遅延表示
      const timeoutId = setTimeout(() => {
        setComments(prev => [...prev, comment]);
        pendingCommentsRef.current.delete(comment.id);
      }, lagSeconds * 1000);
      
      pendingCommentsRef.current.set(comment.id, timeoutId);
    } else {
      // 即座に表示
      setComments(prev => [...prev, comment]);
    }
  }, [settings?.lag_seconds]);

  useEffect(() => {
    const newSocket = io(SOCKET_URL, {
      transports: ['websocket', 'polling'],
    });

    const pendingComments = pendingCommentsRef.current;

    newSocket.on('connect', () => {
      console.log('Connected to server');
      setConnected(true);
    });

    newSocket.on('disconnect', () => {
      console.log('Disconnected from server');
      setConnected(false);
    });

    newSocket.on('new_comment', handleNewComment);

    newSocket.on('initial_comments', (data: { comments: Comment[] }) => {
      setComments(data.comments);
      // フォールバックタイマーをクリア
      if (fallbackTimeoutRef.current) {
        clearTimeout(fallbackTimeoutRef.current);
        fallbackTimeoutRef.current = null;
      }
    });

    newSocket.on('settings_updated', (newSettings: DisplaySettings) => {
      setSettings(newSettings);
    });

    newSocket.on('comment_deleted', (data: { comment_id: string }) => {
      setComments(prev => prev.filter(comment => comment.id !== data.comment_id));
      // 削除されたコメントの遅延タイマーもクリア
      if (pendingComments.has(data.comment_id)) {
        clearTimeout(pendingComments.get(data.comment_id)!);
        pendingComments.delete(data.comment_id);
      }
    });

    newSocket.on('comment_hidden', (data: { comment_id: string }) => {
      setComments(prev => prev.filter(comment => comment.id !== data.comment_id));
      // 非表示されたコメントの遅延タイマーもクリア
      if (pendingComments.has(data.comment_id)) {
        clearTimeout(pendingComments.get(data.comment_id)!);
        pendingComments.delete(data.comment_id);
      }
    });

    newSocket.on('comment_shown', (data: { comment_id: string, comment: Comment }) => {
      if (data.comment) {
        setComments(prev => {
          // 既に存在しないかチェックしてから追加
          if (!prev.find(c => c.id === data.comment_id)) {
            return [...prev, data.comment];
          }
          return prev;
        });
      }
    });

    newSocket.on('instance_deleted', () => {
      console.log('Instance was deleted');
      setComments([]);
      setSettings(null);
    });

    newSocket.on('webhook_received', (data: Record<string, unknown>) => {
      console.log('Webhook received:', data);
    });

    setSocket(newSocket);

    return () => {
      // pending comments のタイマーをすべてクリア
      pendingComments.forEach(timeoutId => {
        clearTimeout(timeoutId);
      });
      pendingComments.clear();
      
      newSocket.close();
    };
  }, [handleNewComment]);

  useEffect(() => {
    if (socket && instanceId) {
      // コメントをリセットしてから新しいインスタンスに参加
      setComments([]);
      socket.emit('join_instance', { instance_id: instanceId });
      
      // フォールバック: Socket.IOが失敗した場合のAPIからの直接取得
      const loadCommentsFromAPI = async () => {
        try {
          const response = await fetch(`${API_URL}/comments/${instanceId}/`);
          if (response.ok) {
            const comments = await response.json();
            setComments(comments);
          }
        } catch (error) {
          console.error('Failed to load comments from API:', error);
        }
      };
      
      // Socket.IOでの初期コメント受信を一定時間待機
      fallbackTimeoutRef.current = setTimeout(() => {
        loadCommentsFromAPI();
      }, 2000); // 2秒後にフォールバック実行
      
      return () => {
        if (fallbackTimeoutRef.current) {
          clearTimeout(fallbackTimeoutRef.current);
        }
      };
    }
  }, [socket, instanceId]);

  const joinInstance = (instanceId: string) => {
    if (socket) {
      socket.emit('join_instance', { instance_id: instanceId });
    }
  };

  return {
    socket,
    connected,
    comments,
    settings,
    joinInstance,
    setComments,
    setSettings,
  };
};
