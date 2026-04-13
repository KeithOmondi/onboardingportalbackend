// Base interface for database tracking
interface Timestamps {
  id: string; // UUID
  created_at: string;
  updated_at: string;
}

/** * JUDICIAL OFFICIALS 
 * Represents the "Leadership & Officials" section 
 */
export interface JudicialOfficial extends Timestamps {
  name: string;
  designation: string;
  image_url: string; // Cloudinary Signed URL
  mandate_body: string;
  sort_order: number; // For the ArrowUp/Down functionality
}

/** * COURT MANDATE 
 * Represents the "Our Mandate" sidebar 
 */
export interface CourtMandate extends Timestamps {
  title: string;
  detail: string;
  is_primary: boolean; // True for Article 165
  pillar_order: number;
}

/** * COURT FAQ 
 * Represents the Knowledge Base section 
 */
export interface CourtFAQ extends Timestamps {
  question: string;
  answer: string;
  is_published: boolean;
}