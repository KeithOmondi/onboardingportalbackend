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

// ── Judge / Staff routes ──────────────────────────────────────────────────────
router.get("/get", getAllNotices);
router.patch("/read-all", markAllNoticesAsRead); // must be before /:id
router.patch("/mark/:id/read", markNoticeAsRead);

// ── Admin routes ──────────────────────────────────────────────────────────────
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
