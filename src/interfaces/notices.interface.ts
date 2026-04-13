export type NoticeCategory = "URGENT" | "DEADLINE" | "INFO" | "WELCOME";

// What the judge sees
export interface INotice {
  id: number;
  title: string;
  body: string;
  category: NoticeCategory;
  author: string;
  expires_at: string | null;
  created_at: string;
  is_read: boolean;
}

// What the admin sees (includes read_count)
export interface IAdminNotice {
  id: number;
  title: string;
  category: NoticeCategory;
  is_active: boolean;
  expires_at: string | null;
  created_at: string;
  author: string;
  read_count: number;
}

// Payload for creating a notice
export interface ICreateNoticeRequest {
  title: string;
  body: string;
  category: NoticeCategory;
  expires_at?: string | null;
}

// Payload for updating a notice
export interface IUpdateNoticeRequest {
  id: number;
  title?: string;
  body?: string;
  category?: NoticeCategory;
  expires_at?: string | null;
  is_active?: boolean;
}