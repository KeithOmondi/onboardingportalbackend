import { Request, Response, NextFunction } from "express";
import pool from "../config/db";
import catchAsync from "../utils/catchAsync";

// ─── ADMIN ENDPOINTS ─────────────────────────────────────────────────────────

// @desc   Get all users the admin can message
// @route  GET /api/v1/chat/recipients
export const getRecipients = catchAsync(
  async (req: Request, res: Response) => {
    const result = await pool.query(
      `SELECT id, full_name, email, role, avatar_url
       FROM users
       WHERE role::text IN ('judge', 'registrar', 'staff')
         AND is_verified = true
       ORDER BY role, full_name ASC`
    );

    res.status(200).json({
      status: "success",
      recipients: result.rows,
    });
  }
);

// @desc   Get full conversation thread between admin and a specific user
// @route  GET /api/v1/chat/history/:userId
export const getConversationHistory = catchAsync(
  async (req: Request, res: Response) => {
    const { userId } = req.params;
    const adminId = (req as any).user.id;

    const result = await pool.query(
      `SELECT * FROM chat_messages
       WHERE ((sender_id = $1 AND recipient_id = $2)    -- admin → user
          OR (sender_id = $2 AND recipient_id = $1))   -- user → admin
          AND recipient_type = 'single'
       ORDER BY created_at ASC
       LIMIT 100`,
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
export const getBroadcasts = catchAsync(
  async (req: Request, res: Response) => {
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
  }
);

// ─── JUDGE / STAFF / SHARED ENDPOINTS ─────────────────────────────────────────

// @desc   Get ONLY Direct messages (Judge <-> Admin)
// @route  GET /api/v1/chat/judge/history
export const getJudgeHistory = catchAsync(
  async (req: Request, res: Response) => {
    const user = (req as any).user;

    // DEBUG LOGS
    console.log("--- DEBUG START ---");
    console.log("User ID from Token:", user?.id);
    console.log("User Role from Token:", user?.role);

    const result = await pool.query(
      `SELECT * FROM chat_messages
       WHERE (sender_id = $1 OR recipient_id = $1)
         AND recipient_type = 'single'
       ORDER BY created_at ASC`,
      [user.id]
    );

    console.log("Rows Found in DB:", result.rowCount);
    console.log("--- DEBUG END ---");

    res.status(200).json({
      status: "success",
      messages: result.rows,
    });
  }
);

// @desc   Get ONLY Broadcast & Group messages (For "Official Relay" tab)
// @route  GET /api/v1/chat/broadcast/history
export const getBroadcastHistory = catchAsync(
  async (req: Request, res: Response) => {
    const user = (req as any).user;
    const userRole = user.role.toLowerCase();

    // LOWER(r) ensures case-insensitive matching with the target_roles array
    const result = await pool.query(
      `SELECT * FROM chat_messages
       WHERE recipient_type = 'broadcast'
          OR (recipient_type = 'group' AND EXISTS (
                SELECT 1 FROM unnest(target_roles) AS r WHERE LOWER(r) = $1
             ))
       ORDER BY created_at ASC`,
      [userRole]
    );

    res.status(200).json({
      status: "success",
      messages: result.rows,
    });
  }
);

// ─── OUTBOX / INBOX VIEWS ────────────────────────────────────────────────────

// @desc   Get only messages the judge sent to admin (outbox view)
// @route  GET /api/v1/chat/judge/sent
export const getJudgeSent = catchAsync(
  async (req: Request, res: Response) => {
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
  }
);

// @desc   Get ONLY inbound messages (Replies + Broadcasts + Groups)
// @route  GET /api/v1/chat/judge/inbox
export const getJudgeInbox = catchAsync(
  async (req: Request, res: Response) => {
    const user = (req as any).user;
    const userRole = user.role.toLowerCase();

    const result = await pool.query(
      `SELECT * FROM chat_messages
       WHERE (recipient_id = $1 AND recipient_type = 'single') 
          OR recipient_type = 'broadcast'
          OR (recipient_type = 'group' AND EXISTS (
                SELECT 1 FROM unnest(target_roles) AS r WHERE LOWER(r) = $2
             ))
       ORDER BY created_at DESC
       LIMIT 50`,
      [user.id, userRole]
    );

    res.status(200).json({
      status: "success",
      messages: result.rows,
    });
  }
);

// @desc   Admin Inbox: Gets the latest message from every unique conversation
// @route  GET /api/v1/chat/inbox
export const getInbox = catchAsync(
  async (req: Request, res: Response) => {
    const userId = (req as any).user.id;

    // DISTINCT ON requires ORDER BY conversation_partner
    const result = await pool.query(
      `SELECT DISTINCT ON (conversation_partner)
        id, sender_id, sender_name, sender_role, recipient_id, 
        recipient_type, message, created_at,
        CASE 
          WHEN sender_id = $1 THEN recipient_id 
          ELSE sender_id 
        END AS conversation_partner
       FROM chat_messages
       WHERE (sender_id = $1 OR recipient_id = $1)
         AND recipient_type = 'single'
       ORDER BY conversation_partner, created_at DESC`,
      [userId]
    );

    res.status(200).json({
      status: "success",
      messages: result.rows,
    });
  }
);