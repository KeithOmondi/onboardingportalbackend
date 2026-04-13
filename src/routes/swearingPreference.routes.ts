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
  authorizeRoles(UserRole.JUDGE, UserRole.REGISTRAR),
  getMyPreference,
);

// Save or Update own preference - REGISTRAR is NOT included here (Write Access Denied)
router.post(
  "/save", 
  isAuthenticatedUser, 
  authorizeRoles(UserRole.JUDGE), 
  saveSwearingPreference
);

/* =====================================================
    READ-ONLY ACCESS (ADMIN & REGISTRAR)
===================================================== */

/**
 * These routes allow the Registrar to view preferences
 * along with the Admin and Super Admin.
 */
router.get(
  "/get",
  isAuthenticatedUser,
  authorizeRoles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.REGISTRAR),
  getAllSwearingPreferences,
);

router.get(
  "/get/:userId",
  isAuthenticatedUser,
  authorizeRoles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.REGISTRAR),
  getPreferenceByUserId,
);

export default router;