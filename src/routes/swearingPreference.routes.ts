// routes/swearingPreference.routes.ts
import { Router } from "express";
import {
  saveSwearingPreference,
  getMyPreference,
  getAllSwearingPreferences,
  getPreferenceByUserId,
  downloadPreferencesPDF,
  exportPreferencesExcel, // New controller
  exportPreferencesWord, // New controller
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

// Save or Update own preference
router.post(
  "/save",
  isAuthenticatedUser,
  authorizeRoles(UserRole.JUDGE),
  saveSwearingPreference,
);

/* =====================================================
    ADMIN & REGISTRAR ACCESS (Management & Reporting)
===================================================== */

/**
 * @route   GET /api/v1/swearing-preferences/get
 * @desc    Get all preferences for dashboard overview
 */
router.get(
  "/get",
  isAuthenticatedUser,
  authorizeRoles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.REGISTRAR),
  getAllSwearingPreferences,
);

/**
 * @route   GET /api/v1/swearing-preferences/get/:userId
 * @desc    Get details for a specific registrant
 */
router.get(
  "/get/:userId",
  isAuthenticatedUser,
  authorizeRoles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.REGISTRAR),
  getPreferenceByUserId,
);

/**
 * @route   GET /api/v1/swearing-preferences/download-report
 * @desc    PDF Export: Formatted report for official records
 */
router.get(
  "/download-report",
  isAuthenticatedUser,
  authorizeRoles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.REGISTRAR),
  downloadPreferencesPDF,
);

/**
 * @route   GET /api/v1/swearing-preferences/export-excel
 * @desc    Excel Export: Data manipulation for logistics
 */
router.get(
  "/export-excel",
  isAuthenticatedUser,
  authorizeRoles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.REGISTRAR),
  exportPreferencesExcel,
);

/**
 * @route   GET /api/v1/swearing-preferences/export-word
 * @desc    Word Export: Editable document for drafting swearing-in schedules
 */
router.get(
  "/export-word",
  isAuthenticatedUser,
  authorizeRoles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.REGISTRAR),
  exportPreferencesWord,
);

export default router;
