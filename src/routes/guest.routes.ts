import { Router } from "express";
import {
  saveGuestList,
  submitGuestList,
  addGuests,
  getMyGuestList,
  deleteGuestList,
  getAllGuestLists,
  downloadAllGuestsPDF,
  downloadJudgeGuestPDF,
  getGuestListById,
} from "../controllers/guests.controller";
import { authorizeRoles, isAuthenticatedUser } from "../middleware/authMiddleware";
import { UserRole } from "../interfaces/user.interface";

const router = Router();

/* =====================================================
    USER / JUDGE ROUTES (Authenticated)
   ===================================================== */

// Save as Draft (creates or updates the current draft)
router.post("/save", isAuthenticatedUser, saveGuestList);

// Finalize registry (switches status from DRAFT to SUBMITTED)
router.post("/submit", isAuthenticatedUser, submitGuestList);

// Append more guests to an existing list
router.patch("/add", isAuthenticatedUser, addGuests);

// Fetch the logged-in user's specific registry
router.get("/me", isAuthenticatedUser, getMyGuestList);

// Delete registry (Logic handles checking if it's still a DRAFT)
router.delete("/delete", isAuthenticatedUser, deleteGuestList);


/* =====================================================
    ADMIN ROUTES (Authenticated + Role Restricted)
   ===================================================== */

// View all guest registrations across the system
router.get(
  "/admin/all", 
  isAuthenticatedUser, 
  authorizeRoles(UserRole.SUPER_ADMIN, UserRole.ADMIN), 
  getAllGuestLists
);

// Download master PDF of all guests
router.get(
  "/all/report", 
  isAuthenticatedUser, 
  authorizeRoles(UserRole.SUPER_ADMIN, UserRole.ADMIN), 
  downloadAllGuestsPDF
);

// Download PDF for a specific user's registration
router.get(
  "/report/:userId", 
  isAuthenticatedUser, 
  authorizeRoles(UserRole.SUPER_ADMIN, UserRole.ADMIN), 
  downloadJudgeGuestPDF
);

router.get(
  "/admin/:id",
  isAuthenticatedUser,
  authorizeRoles(UserRole.SUPER_ADMIN, UserRole.ADMIN),
  getGuestListById
);

export default router;