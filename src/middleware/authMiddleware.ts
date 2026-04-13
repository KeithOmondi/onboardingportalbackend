// src/middleware/authMiddleware.ts
import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import pool from "../config/db";
import config from "../config/env";
import catchAsync from "../utils/catchAsync";
import ErrorHandler from "../utils/ErrorHandler";
import { UserRole } from "../interfaces/user.interface";

// Extend Express Request to include user data
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        role: UserRole;
      };
    }
  }
}

// Check if user is authenticated
export const isAuthenticatedUser = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    let token: string | undefined;

    // 1. Get token from Authorization header (Bearer <token>)
    if (
      req.headers.authorization &&
      req.headers.authorization.startsWith("Bearer")
    ) {
      token = req.headers.authorization.split(" ")[1];
    }

    if (!token) {
      return next(new ErrorHandler("Please login to access this resource", 401));
    }

    // 2. Verify Token
    try {
      const decoded = jwt.verify(token, config.ACCESS_TOKEN_SECRET) as {
        id: string;
        role: UserRole;
      };

      // 3. Check if user still exists in DB
      const userResult = await pool.query(
        "SELECT id, role FROM users WHERE id = $1",
        [decoded.id]
      );
      
      const user = userResult.rows[0];

      if (!user) {
        return next(new ErrorHandler("User belonging to this token no longer exists", 404));
      }

      // 4. Grant access to protected route
      req.user = {
        id: user.id,
        role: user.role as UserRole,
      };

      next();
    } catch (error) {
      return next(new ErrorHandler("Invalid or expired token", 401));
    }
  }
);

// Handle Role-Based Access Control (RBAC)
export const authorizeRoles = (...roles: UserRole[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return next(
        new ErrorHandler(
          `Role (${req.user?.role}) is not allowed to access this resource`,
          403
        )
      );
    }
    next();
  };
};