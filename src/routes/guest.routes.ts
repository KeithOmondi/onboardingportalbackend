import { Router } from "express";
import {
  saveGuestList,
  submitGuestList,
  addGuests,
  getMyGuestList,
  deleteGuestList,
  getAllGuestLists,
  downloadJudgeGuestPDF,
  getGuestListById,
  exportAllGuestLists, // 1. Import the new controller
} from "../controllers/guests.controller";
import { authorizeRoles, isAuthenticatedUser } from "../middleware/authMiddleware";
import { UserRole } from "../interfaces/user.interface";

const router = Router();

/* =====================================================
    USER / JUDGE ROUTES (Authenticated)
   ===================================================== */

router.post("/save", isAuthenticatedUser, saveGuestList);
router.post("/submit", isAuthenticatedUser, submitGuestList);
router.patch("/add", isAuthenticatedUser, addGuests);
router.get("/me", isAuthenticatedUser, getMyGuestList);
router.delete("/delete", isAuthenticatedUser, deleteGuestList);


/* =====================================================
    ADMIN ROUTES (Super Admin & Admin only)
   ===================================================== */

/**
 * @route   GET /api/v1/guests/admin/all
 * @desc    Get overview of all guest registrations
 */
router.get(
  "/admin/all", 
  isAuthenticatedUser, 
  authorizeRoles(UserRole.SUPER_ADMIN, UserRole.ADMIN), 
  getAllGuestLists
);

/**
 * @route   GET /api/v1/guests/admin/export-all
 * @desc    Bulk Export: Generate one consolidated PDF for all submitted registries
 * @access  Super Admin only (or Admin depending on your policy)
 */
router.get(
  "/admin/export-all",
  isAuthenticatedUser,
  authorizeRoles(UserRole.SUPER_ADMIN, UserRole.ADMIN),
  exportAllGuestLists
);

/**
 * @route   GET /api/v1/guests/admin/:id
 * @desc    Get details of a specific registration (by Registry UUID)
 * @note    PLACED AFTER export-all to avoid route parameter collision
 */
router.get(
  "/admin/:id",
  isAuthenticatedUser,
  authorizeRoles(UserRole.SUPER_ADMIN, UserRole.ADMIN),
  getGuestListById
);

/**
 * @route   GET /api/v1/guests/report/:userId
 * @desc    Generate and download PDF Report for a specific Judge
 */
router.get(
  "/report/:userId", 
  isAuthenticatedUser, 
  authorizeRoles(UserRole.SUPER_ADMIN, UserRole.ADMIN), 
  downloadJudgeGuestPDF
);

export default router;