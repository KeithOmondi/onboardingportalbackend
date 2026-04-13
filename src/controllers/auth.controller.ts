import { Request, Response, NextFunction } from "express";
import bcrypt from "bcrypt";
import crypto from "crypto";
import pool from "../config/db";
import ErrorHandler from "../utils/ErrorHandler";
import { sendToken } from "../utils/sendToken";
import catchAsync from "../utils/catchAsync";
import { sendMail } from "../utils/sendMail";
import config from "../config/env";
import jwt from "jsonwebtoken";

// @desc    Login User
// @route   POST /api/v1/auth/login
export const login = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const { email, password } = req.body;

    if (!email || !password) {
      return next(new ErrorHandler("Please provide email and password", 400));
    }

    // 1. Find user in PostgreSQL
    const userResult = await pool.query(
      "SELECT * FROM users WHERE email = $1",
      [email],
    );
    const user = userResult.rows[0];

    // 2. Verify credentials
    if (!user || !(await bcrypt.compare(password, user.password))) {
      return next(new ErrorHandler("Invalid credentials", 401));
    }

    // 3. Ensure email is verified (Relevant for Judicial Officers)
    if (!user.is_verified) {
      return next(new ErrorHandler("Please verify your email to login", 403));
    }

    // 4. Handle Forced Password Reset (Seeded users)
    if (user.needs_password_reset) {
      return res.status(200).json({
        status: "success",
        mustResetPassword: true,
        message: "Credential verified. Please reset your password to continue.",
        userId: user.id,
      });
    }

    // 5. Success: Issue JWT access and refresh tokens
    sendToken(user, 200, res);
  },
);

// @desc    Verify Email via Token
// @route   GET /api/v1/auth/verify/:token
export const verifyEmail = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const { token } = req.params;

    const hashedToken = crypto
      .createHash("sha256")
      .update(token as string)
      .digest("hex");

    const result = await pool.query(
      `UPDATE users 
       SET is_verified = true, 
           verification_token = NULL, 
           verification_token_expire = NULL 
       WHERE verification_token = $1 
       AND verification_token_expire > NOW() 
       RETURNING id, full_name, email, role`,
      [hashedToken],
    );

    if (result.rowCount === 0) {
      return next(new ErrorHandler("Token is invalid or has expired", 400));
    }

    res.status(200).json({
      status: "success",
      message: "Email verified successfully. You can now login.",
    });
  },
);

// @desc    Forced Password Update
// @route   PATCH /api/v1/auth/update-password
export const updatePassword = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const { userId, newPassword } = req.body;

    if (!newPassword || newPassword.length < 8) {
      return next(new ErrorHandler("Password must be at least 8 characters", 400));
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Update DB and flip the reset flag
    const result = await pool.query(
      `UPDATE users 
       SET password = $1, needs_password_reset = false 
       WHERE id = $2 
       RETURNING id, full_name, email, role`,
      [hashedPassword, userId],
    );

    if (result.rowCount === 0) {
      return next(new ErrorHandler("User not found", 404));
    }

    const user = result.rows[0];

    // --- Added Log ---
    console.log(`[AUTH] Password updated for user: ${user.email} (ID: ${user.id}). 'needs_password_reset' flag cleared.`);

    // Log user in automatically after successful reset
    sendToken(user, 200, res);
  },
);

// @desc    Forgot Password - Send Email
// @route   POST /api/v1/auth/forgot-password
// @desc    Forgot Password - Send Email
export const forgotPassword = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const { email } = req.body;

  const userResult = await pool.query("SELECT id, email FROM users WHERE email = $1", [email]);
  const user = userResult.rows[0];

  if (!user) {
    return next(new ErrorHandler("There is no user with that email", 404));
  }

  const resetToken = crypto.randomBytes(20).toString("hex");
  const hashedToken = crypto.createHash("sha256").update(resetToken).digest("hex");
  const expireTime = new Date(Date.now() + 15 * 60 * 1000);

  await pool.query(
    "UPDATE users SET reset_password_token = $1, reset_password_expire = $2 WHERE id = $3",
    [hashedToken, expireTime, user.id]
  );

  // Use FRONTEND_URL from config
  const resetUrl = `${config.FRONTEND_URL}/reset-password/${resetToken}`;

  const message = `You requested a password reset. Please click the link below to reset your password:\n\n${resetUrl}\n\nIf you did not request this, please ignore this email.`;

  try {
    await sendMail({
      email: user.email,
      subject: "Judiciary System - Password Recovery",
      message,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto;">
          <h2 style="color: #2c3e50;">Password Reset Request</h2>
          <p>You requested to reset your password for the onboarding portal.</p>
          <a href="${resetUrl}" style="display: inline-block; padding: 10px 20px; background-color: #3498db; color: white; text-decoration: none; border-radius: 5px;">Reset Password</a>
          <p>This link will expire in 15 minutes.</p>
        </div>
      `,
    });

    res.status(200).json({ status: "success", message: "Recovery email sent." });
  } catch (err) {
    await pool.query(
      "UPDATE users SET reset_password_token = NULL, reset_password_expire = NULL WHERE id = $1",
      [user.id]
    );
    return next(new ErrorHandler("Email could not be sent", 500));
  }
});

// @desc    Reset Password - Verify token and update
// @route   PATCH /api/v1/auth/reset-password/:token
export const resetPassword = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const { token } = req.params;
  const { password } = req.body;

  const hashedToken = crypto.createHash("sha256").update(token as string).digest("hex");

  // Find user with valid token and not expired
  const userResult = await pool.query(
    `SELECT id FROM users WHERE reset_password_token = $1 AND reset_password_expire > NOW()`,
    [hashedToken]
  );
  const user = userResult.rows[0];

  if (!user) {
    return next(new ErrorHandler("Token is invalid or has expired", 400));
  }

  // Hash new password and clear tokens
  const newHashedPassword = await bcrypt.hash(password, 10);
  
  const updatedUserResult = await pool.query(
    `UPDATE users 
     SET password = $1, reset_password_token = NULL, reset_password_expire = NULL, needs_password_reset = false
     WHERE id = $2 RETURNING id, full_name, email, role`,
    [newHashedPassword, user.id]
  );

  sendToken(updatedUserResult.rows[0], 200, res);
});

// src/controllers/auth.controller.ts
// Only this function changes – replace the existing refreshAccessToken

export const refreshAccessToken = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const refreshToken = req.cookies.refreshToken;

    if (!refreshToken) {
      return next(new ErrorHandler("Refresh token not found", 401));
    }

    let decoded: any;
    try {
      decoded = jwt.verify(refreshToken, config.REFRESH_TOKEN_SECRET);
    } catch {
      return next(new ErrorHandler("Invalid or expired refresh token", 403));
    }

    const userResult = await pool.query(
      "SELECT id, full_name, email, role, is_verified, needs_password_reset FROM users WHERE id = $1",
      [decoded.id],
    );
    const user = userResult.rows[0];

    if (!user) {
      return next(new ErrorHandler("User no longer exists", 404));
    }

    const accessToken = jwt.sign(
      { id: user.id, role: user.role },
      config.ACCESS_TOKEN_SECRET,
      { expiresIn: config.ACCESS_TOKEN_EXPIRE as any },
    );

    res.status(200).json({
      status: "success",
      accessToken,
      user: {       // <- THIS is what was missing before
        id: user.id,
        full_name: user.full_name,
        email: user.email,
        role: user.role,
        is_verified: user.is_verified,
        needs_password_reset: user.needs_password_reset,
      },
    });
  },
);


// @desc    Logout User
// @route   GET /api/v1/auth/logout
export const logout = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    res.cookie("refreshToken", null, {
      expires: new Date(Date.now()),
      httpOnly: true,
      // secure: config.NODE_ENV === "production", // Match sendToken config
    });

    res.status(200).json({
      status: "success",
      message: "Logged out successfully",
    });
  }
);