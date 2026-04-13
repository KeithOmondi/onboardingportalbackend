import { Router } from "express";
import * as galleryController from "../controllers/gallery.controller";
import { authorizeRoles, isAuthenticatedUser } from "../middleware/authMiddleware";
import { UserRole } from "../interfaces/user.interface";
import { upload } from "../middleware/upload";

const router = Router();

/* =====================================================
    PUBLIC / PROTECTED USER ROUTES
   ===================================================== */

/**
 * @route   GET /api/v1/gallery/albums
 * @desc    Get all albums (Optional: ?category=Ceremonies)
 */
router.get(
  "/albums", 
  isAuthenticatedUser, 
  authorizeRoles(UserRole.JUDGE, UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.REGISTRAR), 
  galleryController.getAlbums
);

/**
 * @route   GET /api/v1/gallery/albums/:id
 * @desc    Get specific album details and all media inside it
 */
router.get(
  "/albums/:id", 
  isAuthenticatedUser, 
  authorizeRoles(UserRole.JUDGE, UserRole.SUPER_ADMIN, UserRole.ADMIN), 
  galleryController.getAlbumDetails
);


/* =====================================================
    ADMIN ONLY ROUTES (Management)
   ===================================================== */

/**
 * @route   POST /api/v1/gallery/albums
 * @desc    Create a new album metadata + Upload thumbnail
 */
router.post(
  "/albums", 
  isAuthenticatedUser, 
  authorizeRoles(UserRole.SUPER_ADMIN), 
  upload.single("thumbnail"), // Handles the single cover image
  galleryController.createAlbum
);

/**
 * @route   POST /api/v1/gallery/albums/:id/media
 * @desc    Bulk add media files to an existing album
 */
router.post(
  "/albums/:id/media", 
  isAuthenticatedUser, 
  authorizeRoles(UserRole.SUPER_ADMIN), 
  upload.array("files", 20), // Handles multiple media files (max 20 at once)
  galleryController.addMediaToAlbum
);

/**
 * @route   DELETE /api/v1/gallery/albums/:id
 * @desc    Delete album and cascaded media
 */
router.delete(
  "/albums/:id", 
  isAuthenticatedUser, 
  authorizeRoles(UserRole.SUPER_ADMIN), 
  galleryController.deleteAlbum
);

export default router;