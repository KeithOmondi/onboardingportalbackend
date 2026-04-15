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
  exportAllGuestLists,      // PDF
  exportAllGuestListsExcel, // Excel
  exportAllGuestListsWord,  // Word
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
 * @desc    Bulk Export: Generate one consolidated PDF
 */
router.get(
  "/admin/export-all",
  isAuthenticatedUser,
  authorizeRoles(UserRole.SUPER_ADMIN, UserRole.ADMIN),
  exportAllGuestLists
);

/**
 * @route   GET /api/v1/guests/admin/export-excel
 * @desc    Bulk Export: Generate a consolidated Excel sheet
 */
router.get(
  "/admin/export-excel",
  isAuthenticatedUser,
  authorizeRoles(UserRole.SUPER_ADMIN, UserRole.ADMIN),
  exportAllGuestListsExcel
);

/**
 * @route   GET /api/v1/guests/admin/export-word
 * @desc    Bulk Export: Generate a consolidated Word document
 */
router.get(
  "/admin/export-word",
  isAuthenticatedUser,
  authorizeRoles(UserRole.SUPER_ADMIN, UserRole.ADMIN),
  exportAllGuestListsWord
);

/**
 * @route   GET /api/v1/guests/admin/:id
 * @desc    Get details of a specific registration
 * @note    IMPORTANT: Must stay below all specific /admin/... routes
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