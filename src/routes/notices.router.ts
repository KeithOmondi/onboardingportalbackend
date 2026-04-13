// routes/notices.routes.ts
import { Router } from "express";
import {
  getAllNotices,
  markNoticeAsRead,
  markAllNoticesAsRead,
  createNotice,
  updateNotice,
  deleteNotice,
  adminGetAllNotices,
} from "../controllers/notices.controller";
import {
  isAuthenticatedUser,
  authorizeRoles,
} from "../middleware/authMiddleware";
import { UserRole } from "../interfaces/user.interface";
import { upload } from "../middleware/upload";

const router = Router();

// All routes require authentication
router.use(isAuthenticatedUser);

// ── Judge / Staff / Registrar routes ─────────────────────────────────────────
/**
 * Registrar shares these with Judges. They can view notices and 
 * manage their own "read" status.
 */
router.get(
  "/get", 
  authorizeRoles(UserRole.JUDGE, UserRole.REGISTRAR), 
  getAllNotices
);

router.patch(
  "/read-all", 
  authorizeRoles(UserRole.JUDGE, UserRole.REGISTRAR), 
  markAllNoticesAsRead
);

router.patch(
  "/mark/:id/read", 
  authorizeRoles(UserRole.JUDGE, UserRole.REGISTRAR), 
  markNoticeAsRead
);

// ── Admin routes ──────────────────────────────────────────────────────────────
/**
 * Restricted to Super Admin and Admin only. 
 * Registrar is EXCLUDED here to keep it read-only for them.
 */
router.get(
  "/admin",
  authorizeRoles(UserRole.SUPER_ADMIN, UserRole.ADMIN),
  adminGetAllNotices,
);

router.post(
  "/create",
  upload.single("file"),
  authorizeRoles(UserRole.SUPER_ADMIN, UserRole.ADMIN),
  createNotice,
);

router.patch(
  "/update/:id",
  upload.single("file"),
  authorizeRoles(UserRole.SUPER_ADMIN, UserRole.ADMIN),
  updateNotice,
);

router.delete(
  "/delete/:id",
  authorizeRoles(UserRole.SUPER_ADMIN, UserRole.ADMIN),
  deleteNotice,
);

export default router;