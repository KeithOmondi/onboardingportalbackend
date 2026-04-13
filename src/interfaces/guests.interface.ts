// src/interfaces/guests.interface.ts

// Matches the DB ENUMs exactly
export type GuestType = "ADULT" | "MINOR";
export type Gender = "MALE" | "FEMALE" | "OTHER";
export type RegistrationStatus = "DRAFT" | "SUBMITTED";

export interface IGuest {
  id?: number;                // Primary Key (Optional for incoming data)
  registration_id?: number;   // Foreign Key
  name: string;
  type: GuestType;
  gender: Gender;
  id_number: string | null;   
  birth_cert_number: string | null;
  phone: string | null;
  email: string | null;
  created_at?: string;
}

export interface IRegistrationResponse {
  id: number;
  user_id: string;
  status: RegistrationStatus;
  updated_at: string;
  guests: IGuest[];
}