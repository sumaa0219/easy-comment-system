import axios from 'axios';
import { Comment, Instance, DisplaySettings, CommentCreate, InstanceCreate } from '../types';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000, // 10秒のタイムアウト
  headers: {
    'Content-Type': 'application/json',
  },
});

export const commentApi = {
  // インスタンス関連
  createInstance: async (data: InstanceCreate): Promise<Instance> => {
    const response = await api.post('/instances/', data);
    return response.data;
  },

  getInstances: async (): Promise<Instance[]> => {
    const response = await api.get('/instances/');
    return response.data;
  },

  getInstance: async (instanceId: string): Promise<Instance> => {
    const response = await api.get(`/instances/${instanceId}/`);
    return response.data;
  },

  // 管理画面用（Basic認証付き）
  getAdminInstance: async (instanceId: string): Promise<Instance> => {
    const response = await api.get(`/admin/instance/${instanceId}/`);
    return response.data;
  },

  deleteInstance: async (instanceId: string): Promise<void> => {
    await api.delete(`/instances/${instanceId}/`);
  },

  // コメント関連
  createComment: async (data: CommentCreate): Promise<Comment> => {
    const response = await api.post('/comments/', data);
    return response.data;
  },

  getComments: async (instanceId: string): Promise<Comment[]> => {
    const response = await api.get(`/comments/${instanceId}/`);
    return response.data;
  },

  // 管理画面用コメント取得（Basic認証付き）
  getAdminComments: async (instanceId: string): Promise<Comment[]> => {
    const response = await api.get(`/admin/comments/${instanceId}/`);
    return response.data;
  },

  deleteComment: async (instanceId: string, commentId: string): Promise<void> => {
    await api.delete(`/comments/${instanceId}/${commentId}/`);
  },

  hideComment: async (instanceId: string, commentId: string): Promise<void> => {
    await api.put(`/comments/${instanceId}/${commentId}/hide`);
  },

  showComment: async (instanceId: string, commentId: string): Promise<void> => {
    await api.put(`/comments/${instanceId}/${commentId}/show`);
  },

  // 設定関連
  getSettings: async (instanceId: string): Promise<DisplaySettings> => {
    const response = await api.get(`/settings/${instanceId}/`);
    return response.data;
  },

  // 管理画面用設定（Basic認証付き）
  getAdminSettings: async (instanceId: string): Promise<DisplaySettings> => {
    const response = await api.get(`/admin/settings/${instanceId}/`);
    return response.data;
  },

  updateSettings: async (instanceId: string, settings: DisplaySettings): Promise<DisplaySettings> => {
    const response = await api.put(`/settings/${instanceId}/`, settings);
    return response.data;
  },

  // Webhook
  sendWebhook: async (instanceId: string, data: Record<string, unknown>): Promise<void> => {
    await api.post(`/webhook/${instanceId}/`, data);
  },

  // Export
  exportCommentsJson: (instanceId: string): string => {
    return `${API_BASE_URL}/export/${instanceId}/json`;
  },

  exportCommentsCsv: (instanceId: string): string => {
    return `${API_BASE_URL}/export/${instanceId}/csv`;
  },
};
