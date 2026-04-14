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
    name: "Hon. Clara Otieno Omondi",
    email: "claraotieno23@gmail.com",
    password: DEFAULT_PASSWORD,
    role: UserRole.ADMIN,
    isVerified: true,
    needsPasswordReset: true,
  },
  {
    name: "Hon. Dickson Odhiambo Onyango",
    email: "dickson.onyango@court.go.ke",
    password: DEFAULT_PASSWORD,
    role: UserRole.JUDGE,
    isVerified: true,
    needsPasswordReset: true,
  },
  {
    name: "Hon. Alex Kimanzi Ithuku",
    email: "ithukualex2014@gmail.com",
    password: DEFAULT_PASSWORD,
    role: UserRole.JUDGE,
    isVerified: true,
    needsPasswordReset: true,
  },
  {
    name: "Hon. Martha Wanzila Mutuku",
    email: "martha.mutuku@court.go.ke",
    password: DEFAULT_PASSWORD,
    role: UserRole.JUDGE,
    isVerified: true,
    needsPasswordReset: true,
  },
  {
    name: "Hon. Roseline Akinyi Oganyo",
    email: "roselyne.oganyo@court.go.ke",
    password: DEFAULT_PASSWORD,
    role: UserRole.JUDGE,
    isVerified: true,
    needsPasswordReset: true,
  },
  {
    name: "Hon. David Wanjohi Mburu",
    email: "dwmburu@gmail.com",
    password: DEFAULT_PASSWORD,
    role: UserRole.JUDGE,
    isVerified: true,
    needsPasswordReset: true,
  },
  {
    name: "Hon. Francis Nyungu Kyambia",
    email: "fnyungu@gmail.com",
    password: DEFAULT_PASSWORD,
    role: UserRole.JUDGE,
    isVerified: true,
    needsPasswordReset: true,
  },
  {
    name: "Hon. Richard Kipkemoi Koech",
    email: "richard.koech@court.go.ke",
    password: DEFAULT_PASSWORD,
    role: UserRole.JUDGE,
    isVerified: true,
    needsPasswordReset: true,
  },
  {
    name: "Dominic Kipkemoi Rono",
    email: "drkipkemoi2025@gmail.com",
    password: DEFAULT_PASSWORD,
    role: UserRole.JUDGE,
    isVerified: true,
    needsPasswordReset: true,
  },
  {
    name: "Dr. Nabil Mokaya Orina",
    email: "orinamokaya@gmail.com",
    password: DEFAULT_PASSWORD,
    role: UserRole.JUDGE,
    isVerified: true,
    needsPasswordReset: true,
  },
  {
    name: "Emmanuel Omondi Bitta",
    email: "bittaemmanuel@gmail.com",
    password: DEFAULT_PASSWORD,
    role: UserRole.JUDGE,
    isVerified: true,
    needsPasswordReset: true,
  },
  {
    name: "Hon. Kennedy Lenkamai Kandet",
    email: "kennedy.kandet@court.go.ke",
    password: DEFAULT_PASSWORD,
    role: UserRole.JUDGE,
    isVerified: true,
    needsPasswordReset: true,
  },
  {
    name: "Benard Wafula Murunga",
    email: "bertil75@gmail.com",
    password: DEFAULT_PASSWORD,
    role: UserRole.JUDGE,
    isVerified: true,
    needsPasswordReset: true,
  },
  {
    name: "Hon. Joyce Mkambe Gandani",
    email: "jgandani@court.go.ke",
    password: DEFAULT_PASSWORD,
    role: UserRole.JUDGE,
    isVerified: true,
    needsPasswordReset: true,
  },
  {
    name: "Judith Chelangat Mutai",
    email: "jelamutai@gmail.com",
    password: DEFAULT_PASSWORD,
    role: UserRole.JUDGE,
    isVerified: true,
    needsPasswordReset: true,
  },
  {
    name: "Abdi Mohamud Hassan",
    email: "advocateabdik@gmail.com",
    password: DEFAULT_PASSWORD,
    role: UserRole.JUDGE,
    isVerified: true,
    needsPasswordReset: true,
  },
  {
    name: "Catherine Akaigwa Kassim",
    email: "cathkassim@gmail.com",
    password: DEFAULT_PASSWORD,
    role: UserRole.JUDGE,
    isVerified: true,
    needsPasswordReset: true,
  },
  {
    name: "Hon. Letizia Muthoni Wachira Rwiga",
    email: "letiziawachira76@gmail.com",
    password: DEFAULT_PASSWORD,
    role: UserRole.JUDGE,
    isVerified: true,
    needsPasswordReset: true,
  },
  {
    name: "Hon. Paul Kipkemoi Mutai",
    email: "paulkipkemoi@yahoo.com",
    password: DEFAULT_PASSWORD,
    role: UserRole.JUDGE,
    isVerified: true,
    needsPasswordReset: true,
  },
  {
    name: "Winnie Narasha Molonko",
    email: "winniemolonko@yahoo.com",
    password: DEFAULT_PASSWORD,
    role: UserRole.JUDGE,
    isVerified: true,
    needsPasswordReset: true,
  },
  {
    name: "Joseph Kipkoech Biomdo",
    email: "biomdoj@yahoo.com",
    password: DEFAULT_PASSWORD,
    role: UserRole.JUDGE,
    isVerified: true,
    needsPasswordReset: true,
  },
  {
    name: "Hon. Joseph Maloba Were",
    email: "jmwere2015@gmail.com",
    password: DEFAULT_PASSWORD,
    role: UserRole.JUDGE,
    isVerified: true,
    needsPasswordReset: true,
  },
  {
    name: "Anne Mary Auma Okutoyi",
    email: "marieauma@gmail.com",
    password: DEFAULT_PASSWORD,
    role: UserRole.JUDGE,
    isVerified: true,
    needsPasswordReset: true,
  },
  {
    name: "Patricia Naeku Leparashao",
    email: "naekupat@gmail.com",
    password: DEFAULT_PASSWORD,
    role: UserRole.JUDGE,
    isVerified: true,
    needsPasswordReset: true,
  },
  {
    name: "Omondi Keith",
    email: "denniskeith62@gmail.com",
    password: DEFAULT_PASSWORD,
    role: UserRole.JUDGE,
    isVerified: true,
    needsPasswordReset: true,
  },
  {
    name: "Ken Mutua",
    email: "kenmutua017@gmail.com",
    password: DEFAULT_PASSWORD,
    role: UserRole.JUDGE,
    isVerified: true,
    needsPasswordReset: true,
  },
  {
    name: "Judge Mbogholi Msagha",
    email: "mbogholi@gmail.com",
    password: DEFAULT_PASSWORD,
    role: UserRole.JUDGE,
    isVerified: true,
    needsPasswordReset: true,
  },
  {
    name: "Hon. Jeff",
    email: "jeffreysagirai@gmail.com",
    password: DEFAULT_PASSWORD,
    role: UserRole.ADMIN,
    isVerified: true,
    needsPasswordReset: true,
  },
  {
    name: "Joslyne Ndubi",
    email: "joslynekathure@gmail.com",
    password: DEFAULT_PASSWORD,
    role: UserRole.ADMIN,
    isVerified: true,
    needsPasswordReset: true,
  },
  {
    name: "Hon. Winfridah B Mokaya",
    email: "fmokaya23@gmail.com",
    password: DEFAULT_PASSWORD,
    role: UserRole.REGISTRAR,
    isVerified: true,
    needsPasswordReset: true,
  },
  {
    name: "Grace Omodho",
    email: "omodhograce@gmail.com",
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