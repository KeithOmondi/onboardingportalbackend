import express from "express";
import {
  forgotPassword,
  login,
  logout,
  refreshAccessToken,
  resetPassword,
  updatePassword,
  verifyEmail,
} from "../controllers/auth.controller";
import { isAuthenticatedUser } from "../middleware/authMiddleware";

const router = express.Router();

// --- Public Routes ---

/**
 * @desc Login and verify credentials
 */
router.post("/login", login);

/**
 * @desc Verify email via token sent to mail
 */
router.get("/verify/:token", verifyEmail);

/**
 * @desc Request a password reset link
 */
router.post("/forgot-password", forgotPassword);

/**
 * @desc Reset password using the token from email
 */
router.patch("/reset-password/:token", resetPassword);

/**
 * @desc Get a new access token using the Refresh Token cookie
 */
router.get("/refresh", refreshAccessToken);

/**
 * @desc Clear the Refresh Token cookie
 */
router.get("/logout", isAuthenticatedUser, logout);

// --- Protected Routes ---

/**
 * @desc Forced password update (for seeded users)
 * Note: We don't use 'isAuthenticated' here because the user
 * doesn't have a valid session yet. They only have their userId.
 */
router.patch("/update-password", updatePassword);

/**
 * @desc Example of a protected route
 * Only logged-in users can fetch their own profile
 */
// router.get("/me", isAuthenticated, getMe);

/**
 * @desc Example of a Role-Protected route
 * Only Admins can access this
 */
// router.get("/admin/stats", isAuthenticated, authorizeRoles("admin"), getStats);

export default router;
