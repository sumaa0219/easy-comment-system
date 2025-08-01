import { useEffect, useState, useRef } from 'react';
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

  useEffect(() => {
    const newSocket = io(SOCKET_URL, {
      transports: ['websocket', 'polling'],
    });

    newSocket.on('connect', () => {
      console.log('Connected to server');
      setConnected(true);
    });

    newSocket.on('disconnect', () => {
      console.log('Disconnected from server');
      setConnected(false);
    });

    newSocket.on('new_comment', (comment: Comment) => {
      setComments(prev => [...prev, comment]);
    });

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
      newSocket.close();
    };
  }, []);

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
