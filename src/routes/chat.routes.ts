import express from "express";
import {
  getRecipients,
  getConversationHistory,
  getBroadcasts,
  getJudgeHistory,
  getBroadcastHistory,
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

router.use(isAuthenticatedUser);

// ── Admin-only ─────────────────────────────────────────────────────────────
router.get(
  "/recipients",
  authorizeRoles(UserRole.ADMIN, UserRole.SUPER_ADMIN),
  getRecipients
);
router.get(
  "/history/:userId",
  authorizeRoles(UserRole.ADMIN, UserRole.SUPER_ADMIN),
  getConversationHistory
);
router.get(
  "/broadcasts",
  authorizeRoles(UserRole.ADMIN, UserRole.SUPER_ADMIN),
  getBroadcasts
);

// ── Broadcast history — ALL authenticated roles ────────────────────────────
// FIXED: single registration that includes every role that needs this endpoint
router.get(
  "/broadcast/history",
  authorizeRoles(
    UserRole.JUDGE,
    UserRole.REGISTRAR,
    UserRole.STAFF,
    UserRole.ADMIN,
    UserRole.SUPER_ADMIN
  ),
  getBroadcastHistory
);

// ── Judge / registrar / staff ──────────────────────────────────────────────
router.get(
  "/judge/history",
  authorizeRoles(UserRole.JUDGE, UserRole.REGISTRAR, UserRole.STAFF),
  getJudgeHistory
);
router.get(
  "/judge/sent",
  authorizeRoles(UserRole.JUDGE, UserRole.REGISTRAR, UserRole.STAFF),
  getJudgeSent
);
router.get(
  "/judge/inbox",
  authorizeRoles(UserRole.JUDGE, UserRole.REGISTRAR, UserRole.STAFF),
  getJudgeInbox
);

// ── Shared ─────────────────────────────────────────────────────────────────
router.get("/inbox", getInbox);

export default router;