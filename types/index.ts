export interface Comment {
  id: string;
  instance_id: string;
  author: string;
  content: string;
  timestamp: string;
  approved: boolean;
  hidden?: boolean;
}

export interface Instance {
  id: string;
  name: string;
  webhook_url?: string;
  admin_password?: string;
  created_at: string;
  active: boolean;
}

export interface DisplaySettings {
  background_color: string;
  text_color: string;
  font_size: number;
  max_comments: number;
  auto_scroll: boolean;
  show_timestamp: boolean;
  moderation_enabled: boolean;
  comment_width: number;
  background_opacity: number;
  text_opacity: number;
  comment_background_color: string;
  lag_seconds: number;
}

export interface CommentCreate {
  instance_id: string;
  author: string;
  content: string;
}

export interface InstanceCreate {
  name: string;
  webhook_url?: string;
  admin_password?: string;
}
