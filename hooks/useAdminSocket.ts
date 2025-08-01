import { useEffect, useState, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { Comment, DisplaySettings } from '../types';

const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:8000';
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export const useAdminSocket = (instanceId?: string, authHeader?: string) => {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [connected, setConnected] = useState(false);
  const [allComments, setAllComments] = useState<Comment[]>([]);
  const [settings, setSettings] = useState<DisplaySettings | null>(null);
  const fallbackTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const newSocket = io(SOCKET_URL, {
      transports: ['websocket', 'polling'],
    });

    newSocket.on('connect', () => {
      console.log('Admin socket connected to server');
      setConnected(true);
    });

    newSocket.on('disconnect', () => {
      console.log('Admin socket disconnected from server');
      setConnected(false);
    });

    newSocket.on('new_comment', (comment: Comment) => {
      setAllComments(prev => [...prev, comment]);
    });

    newSocket.on('initial_admin_comments', (data: { comments: Comment[] }) => {
      setAllComments(data.comments);
      // フォールバックタイマーをクリア
      if (fallbackTimeoutRef.current) {
        clearTimeout(fallbackTimeoutRef.current);
        fallbackTimeoutRef.current = null;
      }
    });

    newSocket.on('settings_updated', (newSettings: DisplaySettings) => {
      setSettings(newSettings);
    });

    newSocket.on('comment_hidden', (data: { comment_id: string }) => {
      setAllComments(prev => 
        prev.map(comment => 
          comment.id === data.comment_id 
            ? { ...comment, hidden: true } 
            : comment
        )
      );
    });

    newSocket.on('comment_shown', (data: { comment_id: string }) => {
      setAllComments(prev => 
        prev.map(comment => 
          comment.id === data.comment_id 
            ? { ...comment, hidden: false } 
            : comment
        )
      );
    });

    newSocket.on('comment_deleted', (data: { comment_id: string }) => {
      setAllComments(prev => prev.filter(comment => comment.id !== data.comment_id));
    });

    newSocket.on('instance_deleted', () => {
      console.log('Instance was deleted');
      setAllComments([]);
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
      setAllComments([]);
      socket.emit('join_admin_instance', { instance_id: instanceId });
      
      // フォールバック: Socket.IOが失敗した場合のAPIからの直接取得
      const loadCommentsFromAPI = async () => {
        try {
          const headers: HeadersInit = {};
          if (authHeader) {
            headers['Authorization'] = authHeader;
          }
          
          const response = await fetch(`${API_URL}/admin/comments/${instanceId}/`, {
            headers
          });
          if (response.ok) {
            const comments = await response.json();
            setAllComments(comments);
          }
        } catch (error) {
          console.error('Failed to load admin comments from API:', error);
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
  }, [socket, instanceId, authHeader]);

  const joinAdminInstance = (instanceId: string) => {
    if (socket) {
      socket.emit('join_admin_instance', { instance_id: instanceId });
    }
  };

  return {
    socket,
    connected,
    allComments,
    settings,
    joinAdminInstance,
    setAllComments,
    setSettings,
  };
};
