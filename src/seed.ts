// src/config/seed.ts
import bcrypt from 'bcrypt';
import { UserRole } from './interfaces/user.interface';
import pool from './config/db';

interface ISeedUser {
  name: string;
  email: string;
  password: string;
  role: UserRole;
  isVerified: boolean;
  needsPasswordReset: boolean;
}

const DEFAULT_PASSWORD = "Welcome@2026";

const seedUsers: ISeedUser[] = [
  
  {
    name: "Hon. Robinson Ondieki Kebabe",
    email: "robinondieki@gmail.com",
    password: DEFAULT_PASSWORD,
    role: UserRole.REGISTRAR,
    isVerified: true,
    needsPasswordReset: true,
  },
];

export const seedDatabase = async (): Promise<void> => {
  try {
    console.log('🔄 Starting Registry User sync...');
    
    for (const user of seedUsers) {
      const hashedPassword = await bcrypt.hash(user.password, 10);

      /**
       * UPSERT Logic:
       * If email exists, update the password and details.
       * If email doesn't exist, insert new record.
       */
      await pool.query(
        `INSERT INTO users (full_name, email, password, role, is_verified, needs_password_reset) 
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (email) 
         DO UPDATE SET 
            full_name = EXCLUDED.full_name,
            password = EXCLUDED.password,
            role = EXCLUDED.role,
            needs_password_reset = EXCLUDED.needs_password_reset`,
        [
          user.name, 
          user.email, 
          hashedPassword, 
          user.role, 
          user.isVerified, 
          user.needsPasswordReset
        ]
      );
      
      console.log(`✅ Synced: ${user.email}`);
    }
    
    console.log('🚀 Registry seeding & updates completed successfully.');
  } catch (error) {
    console.error('❌ Sync failed:', error);
    throw error;
  }
};

if (require.main === module) {
  seedDatabase()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('Fatal Seed Error:', err);
      process.exit(1);
    });
}