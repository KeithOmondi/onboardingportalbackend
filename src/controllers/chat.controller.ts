// chat.controller.ts — full rewrite, only the broken functions changed

import { Request, Response } from "express";
import pool from "../config/db";
import catchAsync from "../utils/catchAsync";

// ─── ADMIN ENDPOINTS ──────────────────────────────────────────────────────────

// @desc   Get all users the admin can message + their last message timestamp + unread count
// @route  GET /api/v1/chat/recipients
export const getRecipients = catchAsync(async (req: Request, res: Response) => {
  const adminId = (req as any).user.id;

  const result = await pool.query(
    `SELECT
       u.id,
       u.full_name,
       u.email,
       u.role,
       u.avatar_url,
       -- Latest activity timestamp for this conversation (either direction)
       MAX(cm.created_at) AS "lastMessageAt",
       -- Count messages sent BY this user TO admin that have not been read yet
       COUNT(
         CASE
           WHEN cm.sender_id = u.id
            AND cm.recipient_id IS NULL
            AND cm.recipient_type = 'single'
            AND cm.is_read = false
           THEN 1
         END
       )::int AS "unreadCount"
     FROM users u
     LEFT JOIN chat_messages cm
       ON cm.recipient_type = 'single'
      AND (
            -- Admin sent TO this user
            (cm.sender_id = $1 AND cm.recipient_id = u.id)
            OR
            -- This user sent TO admin (recipient_id is NULL for user→admin messages)
            (cm.sender_id = u.id AND cm.recipient_id IS NULL)
          )
     WHERE u.role::text IN ('judge', 'registrar', 'staff')
       AND u.is_verified = true
     GROUP BY u.id, u.full_name, u.email, u.role, u.avatar_url
     ORDER BY "lastMessageAt" DESC NULLS LAST, u.full_name ASC`,
    [adminId]
  );

  res.status(200).json({
    status: "success",
    recipients: result.rows,
  });
});

// @desc   Mark all messages from a specific user as read
// @route  POST /api/v1/chat/read/:userId
export const markAsRead = catchAsync(async (req: Request, res: Response) => {
  const { userId } = req.params;

  await pool.query(
    `UPDATE chat_messages
     SET is_read = true
     WHERE sender_id = $1
       AND recipient_id IS NULL
       AND recipient_type = 'single'
       AND is_read = false`,
    [userId]
  );

  res.status(200).json({ status: "success" });
});

// @desc   Get full conversation thread between admin and a specific user
// @route  GET /api/v1/chat/history/:userId
export const getConversationHistory = catchAsync(
  async (req: Request, res: Response) => {
    const { userId } = req.params;  // the non-admin user's id
    const adminId = (req as any).user.id;

    const result = await pool.query(
      `SELECT * FROM chat_messages
       WHERE recipient_type = 'single'
         AND (
           -- Admin → User: admin is sender, user is explicit recipient
           (sender_id = $1 AND recipient_id = $2)
           OR
           -- User → Admin: user is sender, recipient_id is NULL (inbox convention)
           (sender_id = $2 AND recipient_id IS NULL)
         )
       ORDER BY created_at ASC
       LIMIT 200`,
      [adminId, userId]
    );

    res.status(200).json({
      status: "success",
      messages: result.rows,
    });
  }
);

// @desc   Get all broadcast and group messages for admin view
// @route  GET /api/v1/chat/broadcasts
export const getBroadcasts = catchAsync(async (req: Request, res: Response) => {
  const result = await pool.query(
    `SELECT * FROM chat_messages
     WHERE recipient_type IN ('broadcast', 'group')
     ORDER BY created_at DESC
     LIMIT 50`
  );

  res.status(200).json({
    status: "success",
    broadcasts: result.rows,
  });
});

// ─── JUDGE / STAFF / SHARED ENDPOINTS ────────────────────────────────────────

// @desc   Get direct messages for this user (both sent and received from admin)
// @route  GET /api/v1/chat/judge/history
export const getJudgeHistory = catchAsync(async (req: Request, res: Response) => {
  const user = (req as any).user;

  const result = await pool.query(
    `SELECT * FROM chat_messages
     WHERE recipient_type = 'single'
       AND (
         -- Messages this user sent to admin (recipient_id IS NULL = admin inbox)
         sender_id = $1
         OR
         -- Messages admin sent directly to this user
         recipient_id = $1
       )
     ORDER BY created_at ASC`,
    [user.id]
  );

  res.status(200).json({
    status: "success",
    messages: result.rows,
  });
});

// @desc   Get broadcast & group messages visible to this user's role
// @route  GET /api/v1/chat/broadcast/history
export const getBroadcastHistory = catchAsync(
  async (req: Request, res: Response) => {
    const user = (req as any).user;
    const userRole = user.role.toLowerCase();

    const result = await pool.query(
      `SELECT * FROM chat_messages
       WHERE recipient_type = 'broadcast'
          OR (
               recipient_type = 'group'
               AND (
                 $1 = 'super_admin'
                 OR EXISTS (
                   SELECT 1 FROM unnest(target_roles) AS r WHERE LOWER(r) = $1
                 )
               )
             )
       ORDER BY created_at ASC`,
      [userRole]
    );

    res.status(200).json({
      status: "success",
      messages: result.rows,
    });
  }
);

// @desc   Get only messages this user sent to admin
// @route  GET /api/v1/chat/judge/sent
export const getJudgeSent = catchAsync(async (req: Request, res: Response) => {
  const user = (req as any).user;

  const result = await pool.query(
    `SELECT * FROM chat_messages
     WHERE sender_id = $1
       AND recipient_type = 'single'
     ORDER BY created_at ASC
     LIMIT 100`,
    [user.id]
  );

  res.status(200).json({
    status: "success",
    messages: result.rows,
  });
});

// @desc   Get inbound messages for this user (admin replies + broadcasts)
// @route  GET /api/v1/chat/judge/inbox
export const getJudgeInbox = catchAsync(async (req: Request, res: Response) => {
  const user = (req as any).user;
  const userRole = user.role.toLowerCase();

  const result = await pool.query(
    `SELECT * FROM chat_messages
     WHERE (recipient_id = $1 AND recipient_type = 'single')
        OR recipient_type = 'broadcast'
        OR (
             recipient_type = 'group'
             AND EXISTS (
               SELECT 1 FROM unnest(target_roles) AS r WHERE LOWER(r) = $2
             )
           )
     ORDER BY created_at DESC
     LIMIT 50`,
    [user.id, userRole]
  );

  res.status(200).json({
    status: "success",
    messages: result.rows,
  });
});

// @desc   Admin inbox: latest message per unique conversation
// @route  GET /api/v1/chat/inbox
export const getInbox = catchAsync(async (req: Request, res: Response) => {
  const adminId = (req as any).user.id;

  const result = await pool.query(
    `SELECT DISTINCT ON (conversation_partner)
       id, sender_id, sender_name, sender_role,
       recipient_id, recipient_type, message, created_at,
       CASE
         WHEN sender_id = $1 THEN recipient_id
         ELSE sender_id
       END AS conversation_partner
     FROM chat_messages
     WHERE recipient_type = 'single'
       AND (
         sender_id = $1
         OR recipient_id = $1
         -- Also surface messages sent TO the admin inbox (recipient_id IS NULL)
         OR (recipient_id IS NULL AND sender_id != $1)
       )
     ORDER BY conversation_partner, created_at DESC`,
    [adminId]
  );

  res.status(200).json({
    status: "success",
    messages: result.rows,
  });
});