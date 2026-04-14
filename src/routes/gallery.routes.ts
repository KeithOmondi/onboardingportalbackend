import { Router } from "express";
import {
  getGallery,
  createGalleryItem,
  deleteGalleryItem,
} from "../controllers/gallery.controller";
import {
  authorizeRoles,
  isAuthenticatedUser,
} from "../middleware/authMiddleware";
import { UserRole } from "../interfaces/user.interface";
import { upload } from "../middleware/upload";

const router = Router();

/**
 * PUBLIC ROUTES
 * Anyone can view the gallery
 */
router.get(
  "/get",
  isAuthenticatedUser,
  authorizeRoles(
    UserRole.SUPER_ADMIN,
    UserRole.ADMIN,
    UserRole.REGISTRAR,
    UserRole.JUDGE,
  ),
  getGallery,
);

/**
 * PROTECTED ROUTES
 * Only authenticated Admins can modify the gallery
 */

router.post(
  "/create",
  isAuthenticatedUser,
  authorizeRoles(UserRole.SUPER_ADMIN, UserRole.ADMIN),
  upload.single("file"), // Matches the key in your FormData (image or video)
  createGalleryItem,
);

router.delete(
  "/delete/:id",
  isAuthenticatedUser,
  authorizeRoles(UserRole.SUPER_ADMIN),
  deleteGalleryItem,
);

export default router;
