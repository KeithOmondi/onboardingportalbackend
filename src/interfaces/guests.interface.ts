// src/interfaces/guests.interface.ts

// Matches the DB ENUMs exactly
export type GuestType = "ADULT" | "MINOR";
export type Gender = "MALE" | "FEMALE" | "OTHER";
export type RegistrationStatus = "DRAFT" | "SUBMITTED";

// src/interfaces/guests.interface.ts

export interface IGuest {
  id?: number;
  registration_id?: number;
  name: string;
  type: GuestType;
  gender: Gender;
  id_number: string | null;
  birth_cert_number: string | null;
  phone: string | null;
  email: string | null;
  // --- New Fields ---
  emergency_update?: string | null;     // The textbox content
  emergency_update_at?: string | null;  // The timestamp
  // ------------------
  created_at?: string;
}

export interface IRegistrationResponse {
  id: number;
  user_id: string;
  status: RegistrationStatus;
  updated_at: string;
  guests: IGuest[];
}