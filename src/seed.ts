// src/config/seed.ts
import bcrypt from 'bcrypt';
import { UserRole } from './interfaces/user.interface';
import pool from './config/db';

// Define what a Seed User looks like (omitting DB-generated fields)
interface ISeedUser {
  name: string;
  email: string;
  password: string;
  role: UserRole;
  isVerified: boolean;
  needsPasswordReset: boolean;
}

const seedUsers: ISeedUser[] = [
  {
    name: "Hon. Clara Otieno Omondi",
    email: "claraotieno23@gmail.com",
    password: "Registrar@2026",
    role: UserRole.ADMIN,
    isVerified: true,
    needsPasswordReset: true,
  },
  {
    name: "Hon. Dickson Odhiambo Onyango",
    email: "dickson.onyango@court.go.ke",
    password: "Registrar@2026",
    role: UserRole.JUDGE,
    isVerified: true,
    needsPasswordReset: true,
  },
  {
    name: "Hon. Alex Kimanzi Ithuku",
    email: "ithukualex2014@gmail.com",
    password: "Registrar@2026",
    role: UserRole.JUDGE,
    isVerified: true,
    needsPasswordReset: true,
  },
  {
    name: "Hon. Martha Wanzila Mutuku",
    email: "martha.mutuku@court.go.ke",
    password: "Registrar@2026",
    role: UserRole.JUDGE,
    isVerified: true,
    needsPasswordReset: true,
  },
  {
    name: "Hon. Roseline Akinyi Oganyo",
    email: "roselyne.oganyo@court.go.ke",
    password: "Registrar@2026",
    role: UserRole.JUDGE,
    isVerified: true,
    needsPasswordReset: true,
  },
  {
    name: "Hon. David Wanjohi Mburu",
    email: "dwmburu@gmail.com",
    password: "Registrar@2026",
    role: UserRole.JUDGE,
    isVerified: true,
    needsPasswordReset: true,
  },
  {
    name: "Hon. Francis Nyungu Kyambia",
    email: "fnyungu@gmail.com",
    password: "Registrar@2026",
    role: UserRole.JUDGE,
    isVerified: true,
    needsPasswordReset: true,
  },
  {
    name: "Hon. Richard Kipkemoi Koech",
    email: "richard.koech@court.go.ke",
    password: "Registrar@2026",
    role: UserRole.JUDGE,
    isVerified: true,
    needsPasswordReset: true,
  },
  {
    name: "Dominic Kipkemoi Rono",
    email: "drkipkemoi2025@gmail.com",
    password: "Registrar@2026",
    role: UserRole.JUDGE,
    isVerified: true,
    needsPasswordReset: true,
  },
  {
    name: "Dr. Nabil Mokaya Orina",
    email: "orinamokaya@gmail.com",
    password: "Registrar@2026",
    role: UserRole.JUDGE,
    isVerified: true,
    needsPasswordReset: true,
  },
  {
    name: "Emmanuel Omondi Bitta",
    email: "bittaemmanuel@gmail.com",
    password: "Registrar@2026",
    role: UserRole.JUDGE,
    isVerified: true,
    needsPasswordReset: true,
  },
  {
    name: "Hon. Kennedy Lenkamai Kandet",
    email: "kennedy.kandet@court.go.ke",
    password: "Registrar@2026",
    role: UserRole.JUDGE,
    isVerified: true,
    needsPasswordReset: true,
  },
  {
    name: "Benard Wafula Murunga",
    email: "bertil75@gmail.com",
    password: "Registrar@2026",
    role: UserRole.JUDGE,
    isVerified: true,
    needsPasswordReset: true,
  },
  {
    name: "Hon. Joyce Mkambe Gandani",
    email: "jgandani@court.go.ke",
    password: "Registrar@2026",
    role: UserRole.JUDGE,
    isVerified: true,
    needsPasswordReset: true,
  },
  {
    name: "Judith Chelangat Mutai",
    email: "jelamutai@gmail.com",
    password: "Registrar@2026",
    role: UserRole.JUDGE,
    isVerified: true,
    needsPasswordReset: true,
  },
  {
    name: "Abdi Mohamud Hassan",
    email: "advocateabdik@gmail.com",
    password: "Registrar@2026",
    role: UserRole.JUDGE,
    isVerified: true,
    needsPasswordReset: true,
  },
  {
    name: "Catherine Akaigwa Kassim",
    email: "cathkassim@gmail.com",
    password: "Registrar@2026",
    role: UserRole.JUDGE,
    isVerified: true,
    needsPasswordReset: true,
  },
  {
    name: "Hon. Letizia Muthoni Wachira Rwiga",
    email: "letiziawachira76@gmail.com",
    password: "Registrar@2026",
    role: UserRole.JUDGE,
    isVerified: true,
    needsPasswordReset: true,
  },
  {
    name: "Hon. Paul Kipkemoi Mutai",
    email: "paulkipkemoi@yahoo.com",
    password: "Registrar@2026",
    role: UserRole.JUDGE,
    isVerified: true,
    needsPasswordReset: true,
  },
  {
    name: "Winnie Narasha Molonko",
    email: "winniemolonko@yahoo.com",
    password: "Registrar@2026",
    role: UserRole.JUDGE,
    isVerified: true,
    needsPasswordReset: true,
  },
  {
    name: "Joseph Kipkoech Biomdo",
    email: "biomdoj@yahoo.com",
    password: "Registrar@2026",
    role: UserRole.JUDGE,
    isVerified: true,
    needsPasswordReset: true,
  },
  {
    name: "Hon. Joseph Maloba Were",
    email: "jmwere2015@gmail.com",
    password: "Registrar@2026",
    role: UserRole.JUDGE,
    isVerified: true,
    needsPasswordReset: true,
  },
  {
    name: "Anne Mary Auma Okutoyi",
    email: "marieauma@gmail.com",
    password: "Registrar@2026",
    role: UserRole.JUDGE,
    isVerified: true,
    needsPasswordReset: true,
  },
  {
    name: "Patricia Naeku Leparashao",
    email: "naekupat@gmail.com",
    password: "Registrar@2026",
    role: UserRole.JUDGE,
    isVerified: true,
    needsPasswordReset: true,
  },
  {
    name: "Omondi Keith",
    email: "denniskeith62@gmail.com",
    password: "Registrar@2026",
    role: UserRole.JUDGE,
    isVerified: true,
    needsPasswordReset: true,
  },
  {
    name: "Ken Mutua",
    email: "kenmutua017@gmail.com",
    password: "Welcome@2026",
    role: UserRole.JUDGE,
    isVerified: true,
    needsPasswordReset: true,
  },

  {
    name: "Judge Mbogholi Msagha",
    email: "mbogholi@gmail.com",
    password: "Welcome@2026",
    role: UserRole.JUDGE,
    isVerified: true,
    needsPasswordReset: true,
  },
  {
    name: "Hon. Jeff",
    email: "jeffreysagirai@gmail.com",
    password: "Welcome@2026",
    role: UserRole.ADMIN,
    isVerified: true,
    needsPasswordReset: true,
  },
  {
    name: "Joslyne Ndubi",
    email: "joslynekathure@gmail.com",
    password: "Welcome@2026",
    role: UserRole.ADMIN,
    isVerified: true,
    needsPasswordReset: true,
  },
  {
    name: "Hon. Winfridah B Mokaya",
    email: "fmokaya23@gmail.com",
    password: "Welcome@2026",
    role: UserRole.REGISTRAR,
    isVerified: true,
    needsPasswordReset: true,
  },
  {
    name: "Grace Omodho",
    email: "omodhograce@gmail.com",
    password: "Welcome@2026",
    role: UserRole.REGISTRAR,
    isVerified: true,
    needsPasswordReset: true,
  },
];




export const seedDatabase = async (): Promise<void> => {
  try {
    for (const user of seedUsers) {
      const userExist = await pool.query('SELECT id FROM users WHERE email = $1', [user.email]);
      
      if (userExist.rowCount === 0) {
        const hashedPassword = await bcrypt.hash(user.password, 10);

        await pool.query(
          `INSERT INTO users (full_name, email, password, role, is_verified, needs_password_reset) 
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [
            user.name, 
            user.email, 
            hashedPassword, 
            user.role, 
            user.isVerified, 
            user.needsPasswordReset
          ]
        );
        console.log(`✅ Seeded user: ${user.email}`);
      } else {
        console.log(`ℹ️ User ${user.email} already exists, skipping.`);
      }
    }
    console.log('🚀 Seeding completed successfully.');
  } catch (error) {
    console.error('❌ Seeding failed:', error);
    throw error;
  }
};

// --- ADD THIS BLOCK TO RUN DIRECTLY ---
if (require.main === module) {
  seedDatabase()
    .then(() => {
      console.log('Finalizing...');
      process.exit(0); // Exit safely
    })
    .catch((err) => {
      console.error('Fatal Seed Error:', err);
      process.exit(1); // Exit with error
    });
}