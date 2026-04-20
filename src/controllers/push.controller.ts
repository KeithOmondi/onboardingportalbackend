// push.controller.ts

import { Request, Response } from "express";
import pool from "../config/db";
import catchAsync from "../utils/catchAsync";
import webpush from "web-push";

// Configure web-push with your VAPID keys (set these in your .env)
// Generate once with: npx web-push generate-vapid-keys
const VAPID_READY =
  Boolean(process.env.VAPID_PUBLIC_KEY) &&
  Boolean(process.env.VAPID_PRIVATE_KEY);

if (VAPID_READY) {
  webpush.setVapidDetails(
    `mailto:${process.env.VAPID_EMAIL ?? "admin@orhc.go.ke"}`,
    process.env.VAPID_PUBLIC_KEY!,
    process.env.VAPID_PRIVATE_KEY!
  );
} else {
  console.warn(
    "[Push] VAPID keys not set — web push notifications are disabled. " +
    "Run `npx web-push generate-vapid-keys` and add the keys to your .env."
  );
}

// ── Store subscription ────────────────────────────────────────────────────

// @desc   Save a browser push subscription for the current user
// @route  POST /api/v1/push/subscribe
export const savePushSubscription = catchAsync(
  async (req: Request, res: Response) => {
    const userId = (req as any).user.id;
    const { subscription } = req.body;

    if (!subscription?.endpoint) {
      res.status(400).json({ status: "fail", message: "Invalid subscription object" });
      return;
    }

    // Upsert: one row per user+endpoint combination
    await pool.query(
      `INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth, created_at)
       VALUES ($1, $2, $3, $4, NOW())
       ON CONFLICT (user_id, endpoint)
       DO UPDATE SET p256dh = EXCLUDED.p256dh, auth = EXCLUDED.auth`,
      [
        userId,
        subscription.endpoint,
        subscription.keys.p256dh,
        subscription.keys.auth,
      ]
    );

    res.status(201).json({ status: "success" });
  }
);

// ── Remove subscription (optional — call on logout) ───────────────────────

// @desc   Remove push subscription for the current user
// @route  DELETE /api/v1/push/subscribe
export const removePushSubscription = catchAsync(
  async (req: Request, res: Response) => {
    const userId = (req as any).user.id;
    const { endpoint } = req.body;

    await pool.query(
      `DELETE FROM push_subscriptions WHERE user_id = $1 AND endpoint = $2`,
      [userId, endpoint]
    );

    res.status(200).json({ status: "success" });
  }
);

// ── Utility: send a push notification to a specific user ─────────────────

export const sendPushToUser = async (
  userId: string,
  payload: { title: string; body: string; url?: string }
): Promise<void> => {
  if (!VAPID_READY) return;
  const { rows } = await pool.query(
    `SELECT endpoint, p256dh, auth FROM push_subscriptions WHERE user_id = $1`,
    [userId]
  );

  const results = await Promise.allSettled(
    rows.map((row) =>
      webpush.sendNotification(
        {
          endpoint: row.endpoint,
          keys: { p256dh: row.p256dh, auth: row.auth },
        },
        JSON.stringify(payload)
      )
    )
  );

  // Clean up expired/invalid subscriptions (410 Gone or 404)
  const expiredEndpoints: string[] = [];
  results.forEach((result, i) => {
    if (
      result.status === "rejected" &&
      (result.reason?.statusCode === 410 || result.reason?.statusCode === 404)
    ) {
      expiredEndpoints.push(rows[i].endpoint);
    }
  });

  if (expiredEndpoints.length > 0) {
    await pool.query(
      `DELETE FROM push_subscriptions WHERE endpoint = ANY($1::text[])`,
      [expiredEndpoints]
    );
  }
};

// ── Utility: send a push to ALL admins/super_admins ──────────────────────

export const sendPushToAdmins = async (
  payload: { title: string; body: string; url?: string }
): Promise<void> => {
  if (!VAPID_READY) return;
  const { rows } = await pool.query(
    `SELECT ps.endpoint, ps.p256dh, ps.auth
     FROM push_subscriptions ps
     JOIN users u ON u.id = ps.user_id
     WHERE u.role IN ('admin', 'super_admin')`
  );

  const results = await Promise.allSettled(
    rows.map((row) =>
      webpush.sendNotification(
        {
          endpoint: row.endpoint,
          keys: { p256dh: row.p256dh, auth: row.auth },
        },
        JSON.stringify(payload)
      )
    )
  );

  // Clean up stale subscriptions
  const expiredEndpoints: string[] = [];
  results.forEach((result, i) => {
    if (
      result.status === "rejected" &&
      (result.reason?.statusCode === 410 || result.reason?.statusCode === 404)
    ) {
      expiredEndpoints.push(rows[i].endpoint);
    }
  });

  if (expiredEndpoints.length > 0) {
    await pool.query(
      `DELETE FROM push_subscriptions WHERE endpoint = ANY($1::text[])`,
      [expiredEndpoints]
    );
  }
};