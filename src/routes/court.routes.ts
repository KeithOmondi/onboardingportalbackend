import { Router } from "express";
import multer from "multer";
import * as courtController from "../controllers/court.controller";
import {
  authorizeRoles,
  isAuthenticatedUser,
} from "../middleware/authMiddleware";
import { UserRole } from "../interfaces/user.interface";

const router = Router();

const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
});

/**
 * @route   GET /api/court/init
 * @desc    Fetch all officials, FAQs, and mandates for the dashboard
 */
router.get(
  "/get",
  isAuthenticatedUser, // Always check if user is logged in first
  authorizeRoles(
    UserRole.SUPER_ADMIN,
    UserRole.ADMIN,
    UserRole.JUDGE,
    UserRole.REGISTRAR,
    UserRole.STAFF,
  ),
  courtController.getCourtManagementData,
);

/**
 * @section JUDICIAL OFFICIALS
 */
router.get(
  "/officials",
  isAuthenticatedUser, // Always check if user is logged in first
  authorizeRoles(
    UserRole.SUPER_ADMIN,
    UserRole.ADMIN,
    UserRole.JUDGE,
    UserRole.REGISTRAR,
    UserRole.STAFF,
  ),
  courtController.getOfficials,
);

router.post(
  "/officials",
  isAuthenticatedUser,
  authorizeRoles(UserRole.SUPER_ADMIN, UserRole.ADMIN),
  upload.single("portrait"),
  courtController.createOfficial,
);

/**
 * @section COURT FAQS
 */
router.post(
  "/faqs",
  isAuthenticatedUser,
  authorizeRoles(UserRole.SUPER_ADMIN, UserRole.ADMIN),
  courtController.createFaq,
);

/**
 * @section COURT MANDATES
 */
router.post(
  "/mandates",
  isAuthenticatedUser,
  authorizeRoles(UserRole.SUPER_ADMIN, UserRole.ADMIN),
  courtController.createMandate,
);

export default router;
