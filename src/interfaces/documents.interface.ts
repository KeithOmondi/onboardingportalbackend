export interface IDocument {
  id: number;
  title: string;
  description: string | null;
  file_url: string;
  document_type: string; // Flexible string instead of Enums
  file_size: number | null;
  mime_type: string | null;
  owner_id: string | null; // UUID
  created_at: string;
  updated_at: string;
}

export interface ICreateDocumentPayload {
  title: string;
  description?: string;
  file_url: string;
  document_type?: string;
  file_size?: number;
  mime_type?: string;
}

export interface IDocumentQuery {
  document_type?: string;
  search?: string;
}