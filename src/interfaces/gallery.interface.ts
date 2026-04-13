/**
 * Enum for strict media classification
 */
export enum MediaType {
  IMAGE = "IMAGE",
  VIDEO = "VIDEO",
  DOCUMENT = "DOCUMENT"
}

/**
 * Base structure for a Gallery Album.
 * Category is now a flexible string to allow for any event type.
 */
export interface IGalleryAlbum {
  id: number;
  title: string;
  category: string; // Removed the fixed union type for more flexibility
  description?: string; // Optional
  event_date: string;
  location: string;
  thumbnail_url: string;
  media_counts: {
    images: number;
    videos: number;
    docs: number;
  };
  created_at: string;
  updated_at: string;
}

/**
 * Interface for specific media items.
 */
export interface IGalleryMedia {
  id: number;
  album_id: number;
  file_url: string;
  file_type: MediaType; // IMAGE | VIDEO | DOCUMENT
  mime_type: string;    // e.g., 'video/mp4', 'image/jpeg'
  caption?: string;     // Optional
  uploaded_at: string;
}

/**
 * Payload for creating an album
 */
export interface ICreateAlbumRequest {
  title: string;
  category: string;
  event_date: string;
  location: string;
  description?: string;
  thumbnail?: File; // For the cover image
}