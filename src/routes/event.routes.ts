import { Router } from "express";
import {
  createEvent,
  deleteEvent,
  getEvents,
  updateEvent,
} from "../controllers/eventController";
import {
  authorizeRoles,
  isAuthenticatedUser,
} from "../middleware/authMiddleware";
import { UserRole } from "../interfaces/user.interface";

const router = Router();

// Judges can view all events
router.get(
  "/get",
  isAuthenticatedUser,
  getEvents
);

// Only Super Admin or authorized personnel can create events
router.post(
  "/create",
  isAuthenticatedUser,
  authorizeRoles(UserRole.SUPER_ADMIN, UserRole.ADMIN),
  createEvent,
);

router.post(
  "/delete",
  isAuthenticatedUser,
  authorizeRoles(UserRole.SUPER_ADMIN),
  deleteEvent,
);

router.post(
  "/update",
  isAuthenticatedUser,
  authorizeRoles(UserRole.SUPER_ADMIN, UserRole.ADMIN),
  updateEvent,
);

export default router;
