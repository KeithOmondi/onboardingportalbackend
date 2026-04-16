import { Router } from "express";
import {
  getGallery,
  createGalleryItems, // Correctly matches the plural export above
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
 * @desc    Get all gallery items
 * @access  Authenticated (Super Admin, Admin, Registrar, Judge)
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
 * @desc    Create multiple Gallery Items (Batch Upload)
 * @access  Protected (Super Admin, Admin)
 */
router.post(
  "/create",
  isAuthenticatedUser,
  authorizeRoles(UserRole.SUPER_ADMIN, UserRole.ADMIN),
  // Matches the 'file' key and allows up to 10 images/videos
  upload.array("file", 10), 
  createGalleryItems,
);

/**
 * @desc    Delete a specific Gallery Item
 * @access  Protected (Super Admin only)
 */
router.delete(
  "/delete/:id",
  isAuthenticatedUser,
  authorizeRoles(UserRole.SUPER_ADMIN),
  deleteGalleryItem,
);

export default router;