import { Request, Response, NextFunction } from "express";
import pool from "../config/db";
import catchAsync from "../utils/catchAsync";

// ─── ADMIN ENDPOINTS ─────────────────────────────────────────────────────────

// @desc  Get all users the admin can message
// @route GET /api/v1/chat/recipients
export const getRecipients = catchAsync(
  async (req: Request, res: Response) => {
    const result = await pool.query(
      `SELECT id, full_name, email, role, avatar_url
       FROM users
       WHERE role IN ('judge', 'registrar', 'staff')
         AND is_verified = true
       ORDER BY role, full_name ASC`
    );

    res.status(200).json({
      status: "success",
      recipients: result.rows,
    });
  }
);

// @desc  Get full conversation thread between admin and a specific user
// @route GET /api/v1/chat/history/:userId
export const getConversationHistory = catchAsync(
  async (req: Request, res: Response) => {
    const { userId } = req.params;
    const adminId = (req as any).user.id;

    const result = await pool.query(
      `SELECT * FROM chat_messages
       WHERE (sender_id = $1 AND recipient_id = $2)   -- admin → user
          OR (sender_id = $2 AND recipient_id = $1)   -- user → admin
          OR (sender_id = $2 AND recipient_type = 'single' AND recipient_id IS NULL)
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

// @desc  Get all broadcast and group messages (admin inbox overview)
// @route GET /api/v1/chat/broadcasts
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

// ─── JUDGE / STAFF ENDPOINTS ──────────────────────────────────────────────────

// @desc  Get all messages relevant to the logged-in judge/staff:
//        their own sent messages + admin replies to them + broadcasts + group msgs
// @route GET /api/v1/chat/judge/history
export const getJudgeHistory = catchAsync(
  async (req: Request, res: Response) => {
    const user = (req as any).user;

    const result = await pool.query(
      `SELECT * FROM chat_messages
       WHERE sender_id = $1                                        -- judge's own sent messages
          OR recipient_id = $1                                     -- admin replied directly to judge
          OR recipient_type = 'broadcast'                         -- sent to everyone
          OR (recipient_type = 'group' AND $2 = ANY(target_roles))-- sent to judge's role group
       ORDER BY created_at ASC
       LIMIT 100`,
      [user.id, user.role]
    );

    res.status(200).json({
      status: "success",
      messages: result.rows,
    });
  }
);

// @desc  Get only messages the judge sent to admin (outbox view)
// @route GET /api/v1/chat/judge/sent
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

// @desc  Get only messages sent TO the judge (inbox view):
//        direct admin replies + broadcasts + group messages for their role
// @route GET /api/v1/chat/judge/inbox
export const getJudgeInbox = catchAsync(
  async (req: Request, res: Response) => {
    const user = (req as any).user;

    const result = await pool.query(
      `SELECT * FROM chat_messages
       WHERE recipient_id = $1                                      -- direct reply to this judge
          OR recipient_type = 'broadcast'                          -- sent to everyone
          OR (recipient_type = 'group' AND $2 = ANY(target_roles)) -- sent to their role
       ORDER BY created_at DESC
       LIMIT 50`,
      [user.id, user.role]
    );

    res.status(200).json({
      status: "success",
      messages: result.rows,
    });
  }
);

// ─── SHARED ───────────────────────────────────────────────────────────────────

// @desc  Get admin inbox — all inbound messages from any judge/staff
// @route GET /api/v1/chat/inbox
export const getInbox = catchAsync(
  async (req: Request, res: Response) => {
    const user = (req as any).user;

    const result = await pool.query(
      `SELECT * FROM chat_messages
       WHERE recipient_id = $1
          OR recipient_type = 'broadcast'
          OR (recipient_type = 'group' AND $2 = ANY(target_roles))
       ORDER BY created_at DESC
       LIMIT 50`,
      [user.id, user.role]
    );

    res.status(200).json({
      status: "success",
      messages: result.rows,
    });
  }
);