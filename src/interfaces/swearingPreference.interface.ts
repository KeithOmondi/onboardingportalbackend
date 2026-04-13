// interfaces/swearingPreference.interface.ts

export type CeremonyChoice = 'oath' | 'affirmation';

export interface ISwearingPreference {
  id?: string;
  userId: string;
  ceremonyChoice: CeremonyChoice;
  religiousText?: string | null; // Nullable if affirmation is chosen
  createdAt?: Date;
  updatedAt?: Date;
}

export interface SwearingPreferencePayload {
  ceremonyChoice: CeremonyChoice;
  religiousText: string;
}