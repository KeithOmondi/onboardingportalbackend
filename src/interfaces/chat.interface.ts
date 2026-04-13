// src/interfaces/chat.interface.ts
export type RecipientType = 'single' | 'group' | 'broadcast';

export interface ChatMessage {
  id: string;
  sender_id: string;
  sender_name: string;
  sender_role: string;
  recipient_id?: string; // Optional for broadcasts
  recipient_type: RecipientType;
  target_roles?: string[]; // Used for 'group' type
  message: string;
  created_at: Date;
}

export interface SendMessageDTO {
  sender_id: string;
  sender_name: string;
  sender_role: string;
  recipient_id?: string;
  recipient_type: RecipientType;
  target_roles?: string[];
  message: string;
}

// Add this to your chat.interface.ts or locally in the slice
export interface ChatConversation {
  partner_id: string;
  last_direction: 'sent' | 'received';
  message: string;
  created_at: string;
}