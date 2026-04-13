import express from "express";
import {
  getRecipients,
  getConversationHistory,
  getBroadcasts,
  getJudgeHistory,
  getJudgeSent,
  getJudgeInbox,
  getInbox,
} from "../controllers/chat.controller";
import {
  authorizeRoles,
  isAuthenticatedUser,
} from "../middleware/authMiddleware";
import { UserRole } from "../interfaces/user.interface";

const router = express.Router();

router.use(isAuthenticatedUser); // all chat routes require auth

// Admin-only
router.get(
  "/recipients",
  authorizeRoles(UserRole.ADMIN, UserRole.SUPER_ADMIN),
  getRecipients,
);
router.get(
  "/history/:userId",
  authorizeRoles(UserRole.SUPER_ADMIN, UserRole.ADMIN),
  getConversationHistory,
);
router.get(
  "/broadcasts",
  authorizeRoles(UserRole.ADMIN, UserRole.SUPER_ADMIN),
  getBroadcasts,
);

// Judge/staff
router.get(
  "/judge/history",
  authorizeRoles(UserRole.REGISTRAR, UserRole.JUDGE, UserRole.STAFF),
  getJudgeHistory,
);
router.get(
  "/judge/sent",
  authorizeRoles(UserRole.REGISTRAR, UserRole.JUDGE, UserRole.STAFF),
  getJudgeSent,
);
router.get(
  "/judge/inbox",
  authorizeRoles(UserRole.REGISTRAR, UserRole.JUDGE, UserRole.STAFF),
  getJudgeInbox,
);

// Shared
router.get("/inbox", getInbox);

export default router;
