import express from "express";
import * as documentController from "../controllers/documentController";
import { upload } from "../middleware/upload";
import { UserRole } from "../interfaces/user.interface";
import {
  authorizeRoles,
  isAuthenticatedUser,
} from "../middleware/authMiddleware";

const router = express.Router();

/**
 * All judicial document operations require a valid session
 * and specific administrative or judicial roles.
 */
router.use(isAuthenticatedUser);
router.use(
  authorizeRoles(
    UserRole.SUPER_ADMIN,
    UserRole.ADMIN,
    UserRole.REGISTRAR,
    UserRole.JUDGE,
  ),
);

/**
 * @route   GET /api/v1/documents
 * @desc    Fetch documents with search/filter
 */
/**
 * @route   POST /api/v1/documents
 * @desc    Upload to Cloudinary + Registry Save
 */
router
  .route("/")
  .get(documentController.getDocuments)
  .post(upload.single("file"), documentController.createDocument);

/**
 * @route   GET /api/v1/documents/view/:id
 * @desc    Proxy document stream from Cloudinary to bypass iframe/auth restrictions
 * @access  Private (Admin/Registrar/Judge)
 */
router.get("/view/:id", documentController.proxyDocument);

/**
 * @route   DELETE /api/v1/documents/:id
 * @desc    Remove record from the Registry
 */
router
  .route("/:id")
  .delete(documentController.deleteDocument);

export default router;