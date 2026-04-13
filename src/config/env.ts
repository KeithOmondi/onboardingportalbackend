// src/config/env.ts
import dotenv from "dotenv";
import path from "path";
import { Secret } from "jsonwebtoken";

dotenv.config({ path: path.resolve(__dirname, "../../.env") });

interface Config {
  PORT: number;
  DATABASE_URL: string;
  NODE_ENV: "development" | "production" | "test";
  ACCESS_TOKEN_SECRET: Secret;
  REFRESH_TOKEN_SECRET: Secret;
  ACCESS_TOKEN_EXPIRE: string;
  REFRESH_TOKEN_EXPIRE: string;
  COOKIE_EXPIRE: number;
  SMTP_HOST: string;
  SMTP_PORT: number;
  SMTP_MAIL: string;
  SMTP_PASSWORD: string;
  FRONTEND_URL: string;
  // --- Cloudinary Config ---
  CLOUDINARY_CLOUD_NAME: string;
  CLOUDINARY_API_KEY: string;
  CLOUDINARY_API_SECRET: string;
}

const getEnv = (): Config => {
  return {
    PORT: process.env.PORT ? Number(process.env.PORT) : 5000,
    DATABASE_URL: process.env.DATABASE_URL || "",
    NODE_ENV: (process.env.NODE_ENV as Config["NODE_ENV"]) || "development",
    
    ACCESS_TOKEN_SECRET: (process.env.ACCESS_TOKEN_SECRET as Secret) || "",
    REFRESH_TOKEN_SECRET: (process.env.REFRESH_TOKEN_SECRET as Secret) || "",
    
    ACCESS_TOKEN_EXPIRE: process.env.ACCESS_TOKEN_EXPIRE || "15m",
    REFRESH_TOKEN_EXPIRE: process.env.REFRESH_TOKEN_EXPIRE || "7d",
    
    COOKIE_EXPIRE: Number(process.env.COOKIE_EXPIRE) || 7,
    
    SMTP_HOST: process.env.SMTP_HOST || "",
    SMTP_PORT: Number(process.env.SMTP_PORT) || 587,
    SMTP_MAIL: process.env.SMTP_MAIL || "",
    SMTP_PASSWORD: process.env.SMTP_PASSWORD || "",
    
    FRONTEND_URL: process.env.FRONTEND_URL || "http://localhost:3000",

    // --- Cloudinary Mapping ---
    CLOUDINARY_CLOUD_NAME: process.env.CLOUDINARY_CLOUD_NAME || "",
    CLOUDINARY_API_KEY: process.env.CLOUDINARY_API_KEY || "",
    CLOUDINARY_API_SECRET: process.env.CLOUDINARY_API_SECRET || "",
  };
};

const config = getEnv();

// --- Validation Logic ---
const requiredKeys: (keyof Config)[] = [
  "DATABASE_URL",
  "ACCESS_TOKEN_SECRET",
  "REFRESH_TOKEN_SECRET",
  "CLOUDINARY_CLOUD_NAME",
  "CLOUDINARY_API_KEY",
  "CLOUDINARY_API_SECRET",
];

requiredKeys.forEach((key) => {
  if (!config[key]) {
    throw new Error(`[Config Error]: Missing required environment variable: ${key}`);
  }
});

export default config;