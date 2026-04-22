import { Router } from "express";
import { isAuthenticatedUser, authorizeRoles } from "../middleware/authMiddleware";
import { UserRole } from "../interfaces/user.interface";
import { createEmergencyNote, getEmergencyNote } from "../controllers/EmergencyNotes";

const router = Router();

router.use(isAuthenticatedUser);

// ── Judge routes ──────────────────────────────────────────────────────────────
/**
 * Judges fetch the shared emergency note on their dashboard.
 */
router.get(
  "/get",
  authorizeRoles(UserRole.JUDGE),
  getEmergencyNote
);

// ── Admin routes ──────────────────────────────────────────────────────────────
/**
 * Admins can view and update the shared emergency note.
 */
router.get(
  "/admin",
  authorizeRoles(UserRole.SUPER_ADMIN, UserRole.ADMIN),
  getEmergencyNote
);

router.patch(
  "/update",
  authorizeRoles(UserRole.SUPER_ADMIN, UserRole.ADMIN),
  createEmergencyNote
);

export default router;