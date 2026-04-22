import { Router } from "express";
import { isAuthenticatedUser, authorizeRoles } from "../middleware/authMiddleware";
import { UserRole } from "../interfaces/user.interface";
import { 
  createEmergencyNote, 
  getEmergencyNote, 
  updateEmergencyNote, // Added
  deleteEmergencyNote  // Added
} from "../controllers/EmergencyNotes";

const router = Router();

router.use(isAuthenticatedUser);

// ── Judge routes ──────────────────────────────────────────────────────────────
/**
 * Judges fetch the shared emergency note on their dashboard.
 */
router.get(
  "/get",
  authorizeRoles(UserRole.JUDGE, UserRole.SUPER_ADMIN, UserRole.ADMIN),
  getEmergencyNote
);

// ── Admin routes ──────────────────────────────────────────────────────────────
/**
 * Admins can view, update, and clear the shared emergency note.
 */
router.get(
  "/admin",
  authorizeRoles(UserRole.SUPER_ADMIN, UserRole.ADMIN),
  getEmergencyNote
);

// Use PATCH for the Upsert (Create or Update)
router.patch(
  "/update",
  authorizeRoles(UserRole.SUPER_ADMIN, UserRole.ADMIN),
  createEmergencyNote
);

// Explicit PUT for standard updates (if preferred over upsert)
router.put(
  "/update",
  authorizeRoles(UserRole.SUPER_ADMIN, UserRole.ADMIN),
  updateEmergencyNote
);

// DELETE to clear the emergency note
router.delete(
  "/delete",
  authorizeRoles(UserRole.SUPER_ADMIN, UserRole.ADMIN),
  deleteEmergencyNote
);

export default router;