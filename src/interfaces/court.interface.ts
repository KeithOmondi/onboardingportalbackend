/**
 * Represents a Judicial Official (Leader) within the High Court system.
 */
export interface IJudicialOfficial {
  id: string; // UUID
  name: string;
  designation: string;
  image_url: string | null; // Cloudinary URL
  mandate_body: string | null;
  sort_order: number;
  created_at?: Date;
  updated_at?: Date;
}

/**
 * Represents a Knowledge Base entry / Frequently Asked Question.
 */
export interface ICourtFaq {
  id: string; // UUID
  question: string;
  answer: string;
  is_published: boolean;
  created_at?: Date;
}

/**
 * Represents a Mandate Pillar (e.g., Article 165 or Supervisory Role).
 */
export interface ICourtMandate {
  id: string; // UUID
  title: string;
  detail: string;
  is_primary: boolean;
  pillar_order: number;
  created_at?: Date;
}

/**
 * Unified response interface for the Management Dashboard.
 * Useful for the 'fetchInitialData' controller.
 */
export interface ICourtManagementData {
  officials: IJudicialOfficial[];
  faqs: ICourtFaq[];
  mandates: ICourtMandate[];
}