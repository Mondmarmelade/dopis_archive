export interface EmailAddress {
  name?: string;
  address: string;
}

export interface EmailSummary {
  id: string;
  uid: number;
  subject: string;
  from: EmailAddress;
  to?: EmailAddress[];
  date: string;
  flags: string[];
  isUnread: boolean;
  isFlagged: boolean;
  snippet?: string;
  size?: number;
}

export interface EmailDetail extends EmailSummary {
  html?: string;
  text?: string;
  replyTo?: EmailAddress[];
  cc?: EmailAddress[];
  bcc?: EmailAddress[];
  messageId?: string;
  inReplyTo?: string;
  references?: string[];
  attachments?: EmailAttachment[];
}

export interface EmailAttachment {
  filename: string;
  contentType: string;
  size: number;
  id?: string;
}

export interface FolderInfo {
  path: string;
  name: string;
  specialUse?: string;
  unseen?: number;
  total?: number;
}

export interface LoginPayload {
  email: string;
  password?: string;
  host: string;
  port?: number;
  secure?: boolean;
}

export interface LoginResponse {
  success: boolean;
  token?: string;
  user?: {
    email: string;
    host: string;
  };
  error?: string;
}

export interface ApiResponse<T = any> {
  success?: boolean;
  data?: T;
  error?: string;
}

export interface AISummaryResponse {
  summary: string;
  actionItems?: string[];
  urgency?: "low" | "medium" | "high";
}
