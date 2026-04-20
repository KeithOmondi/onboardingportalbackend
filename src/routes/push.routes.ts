// push.routes.ts

import express from "express";
import { isAuthenticatedUser } from "../middleware/authMiddleware";
import { removePushSubscription, savePushSubscription } from "../controllers/push.controller";

const router = express.Router();

router.use(isAuthenticatedUser);

router.post("/subscribe", savePushSubscription);
router.delete("/subscribe", removePushSubscription);

export default router;