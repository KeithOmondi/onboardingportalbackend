// routes/swearingPreference.routes.ts
import { Router } from "express";
import {
  saveSwearingPreference,
  getMyPreference,
  getAllSwearingPreferences,
  getPreferenceByUserId,
} from "../controllers/swearingPreference.controller";
import {
  authorizeRoles,
  isAuthenticatedUser,
} from "../middleware/authMiddleware";
import { UserRole } from "../interfaces/user.interface";

const router = Router();

/* =====================================================
    JUDGE OWNED ROUTES
===================================================== */

// Get current judge's own preference
router.get(
  "/me",
  isAuthenticatedUser,
  authorizeRoles(UserRole.JUDGE),
  getMyPreference,
);

// Save or Update own preference
router.post("/save", isAuthenticatedUser, authorizeRoles(UserRole.JUDGE), saveSwearingPreference);

/* =====================================================
    ADMINISTRATIVE ROUTES
===================================================== */

/**
 * These routes are restricted to super_admin and admin only.
 * 'authorize' should check req.user.role.
 */
router.get(
  "/get",
  isAuthenticatedUser,
  authorizeRoles(UserRole.SUPER_ADMIN, UserRole.ADMIN),
  getAllSwearingPreferences,
);

router.get(
  "/get/:userId",
  isAuthenticatedUser,
  authorizeRoles(UserRole.SUPER_ADMIN, UserRole.ADMIN),
  getPreferenceByUserId,
);

export default router;
