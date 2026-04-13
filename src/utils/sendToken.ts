import { Response } from "express";
import jwt, { Secret } from "jsonwebtoken";
import config from "../config/env";

interface User {
  id: string | number;
  role: string;
  full_name?: string;  // ← add this
  email?: string;      // ← add this
  is_verified?: boolean;
  needs_password_reset?: boolean;
}

export const sendToken = (user: User, statusCode: number, res: Response) => {
  const accessToken = jwt.sign(
    { id: user.id, role: user.role },
    config.ACCESS_TOKEN_SECRET as Secret,
    { expiresIn: config.ACCESS_TOKEN_EXPIRE as any },
  );

  const refreshToken = jwt.sign(
    { id: user.id },
    config.REFRESH_TOKEN_SECRET as Secret,
    { expiresIn: config.REFRESH_TOKEN_EXPIRE as any },
  );

  const cookieOptions = {
    expires: new Date(
      Date.now() + Number(config.COOKIE_EXPIRE) * 24 * 60 * 60 * 1000,
    ),
    httpOnly: true,
    sameSite: config.NODE_ENV === "production" ? ("none" as const) : ("lax" as const),
    secure: config.NODE_ENV === "production",
    path: "/",
  };

  res
    .status(statusCode)
    .cookie("refreshToken", refreshToken, cookieOptions)
    .json({
      status: "success",
      accessToken,
      user: {
        id: user.id,
        role: user.role,
        full_name: user.full_name,         // ← add these
        email: user.email,
        is_verified: user.is_verified,
        needs_password_reset: user.needs_password_reset,
      },
    });
};