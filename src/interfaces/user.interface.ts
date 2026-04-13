// src/interfaces/user.interface.ts

export enum UserRole {
  SUPER_ADMIN = 'super_admin',
  ADMIN = 'admin',
  JUDGE = 'judge',
  REGISTRAR = 'registrar',
  STAFF = 'staff',
}

export interface IUser {
  id: string;
  full_name: string;
  email: string;
  password?: string; 
  role: UserRole;
  avatar_url?: string;
  is_verified: boolean;
  needs_password_reset: boolean; // Forced reset for seeded users
  refresh_token_hash?: string;
  created_at: Date;
  updated_at: Date;
  verification_token?: string;
  verification_token_expire?: Date;
  reset_password_token?: string;
  reset_password_expire?: Date;
}