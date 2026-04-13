import { Request, Response, NextFunction } from "express";
import pool from "../config/db";
import catchAsync from "../utils/catchAsync";
import ErrorHandler from "../utils/ErrorHandler";
import type {
  ICreateNoticeRequest,
} from "../interfaces/notices.interface";
import { uploadToCloudinary } from "../config/cloudinary";

// ── JUDGE ROUTES ─────────────────────────────────────────────────────────────

export const getAllNotices = catchAsync(async (req: any, res: Response) => {
  const userId = req.user.id;

  const { rows } = await pool.query(
    `SELECT
        n.id,
        n.title,
        n.body,            -- Now optional in your logic
        n.category,
        n.attachment_url,  -- Added to support notices that are just files
        n.expires_at,
        n.created_at,
        u.full_name AS author,
        CASE WHEN nr.user_id IS NOT NULL THEN true ELSE false END AS is_read
      FROM notices n
      JOIN users u ON u.id = n.author_id
      LEFT JOIN notice_reads nr
        ON nr.notice_id = n.id AND nr.user_id = $1
      WHERE n.is_active = true
        AND (n.expires_at IS NULL OR n.expires_at > NOW())
      ORDER BY
        CASE n.category
          WHEN 'URGENT'   THEN 1
          WHEN 'DEADLINE' THEN 2
          WHEN 'WELCOME'  THEN 3
          ELSE                 4
        END,
        n.created_at DESC`,
    [userId],
  );

  // Calculate unread count from the results
  const unreadCount = rows.filter((r) => !r.is_read).length;

  res.status(200).json({
    status: "success",
    unreadCount,
    results: rows.length,
    data: rows,
  });
});

export const markNoticeAsRead = catchAsync(
  async (req: any, res: Response, next: NextFunction) => {
    const userId = req.user.id;
    const { id } = req.params;

    const notice = await pool.query(
      "SELECT id FROM notices WHERE id = $1 AND is_active = true",
      [id],
    );

    if (notice.rowCount === 0) {
      return next(new ErrorHandler("Notice not found", 404));
    }

    await pool.query(
      `INSERT INTO notice_reads (notice_id, user_id)
     VALUES ($1, $2)
     ON CONFLICT (notice_id, user_id) DO NOTHING`,
      [id, userId],
    );

    res.status(200).json({
      status: "success",
      message: "Notice marked as read",
    });
  },
);

export const markAllNoticesAsRead = catchAsync(
  async (req: any, res: Response) => {
    const userId = req.user.id;

    await pool.query(
      `INSERT INTO notice_reads (notice_id, user_id)
     SELECT n.id, $1
     FROM notices n
     WHERE n.is_active = true
       AND (n.expires_at IS NULL OR n.expires_at > NOW())
       AND NOT EXISTS (
         SELECT 1 FROM notice_reads nr
         WHERE nr.notice_id = n.id AND nr.user_id = $1
       )
     ON CONFLICT DO NOTHING`,
      [userId],
    );

    res.status(200).json({
      status: "success",
      message: "All notices marked as read",
    });
  },
);

// ── ADMIN ROUTES ─────────────────────────────────────────────────────────────

export const createNotice = catchAsync(
  async (req: any, res: Response, next: NextFunction) => {
    const { title, body, category, expires_at }: ICreateNoticeRequest = req.body;
    const authorId = req.user.id;

    // Title remains mandatory, but body is now optional
    if (!title) {
      return next(new ErrorHandler("A title is required", 400));
    }

    // 1. Handle File Upload
    let attachment_url = null;
    if (req.file) {
      const uploadResult = await uploadToCloudinary(req.file, "notices");
      attachment_url = uploadResult.secure_url;
    }

    // 2. Insert into Database
    const { rows } = await pool.query(
      `INSERT INTO notices (title, body, category, author_id, expires_at, attachment_url)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, title, body, category, attachment_url, created_at`,
      [
        title, 
        body || "", // Default to empty string if no body is provided
        category || "INFO", 
        authorId, 
        expires_at || null, 
        attachment_url
      ],
    );

    res.status(201).json({
      status: "success",
      data: rows[0],
    });
  },
);

export const updateNotice = catchAsync(
  async (req: any, res: Response, next: NextFunction) => {
    const { id } = req.params;
    const { title, body, category, expires_at, is_active } = req.body;

    let attachment_url = req.body.attachment_url; // Keep existing if not changing

    // If a new file is uploaded, update the URL
    if (req.file) {
      const uploadResult = await uploadToCloudinary(req.file, "notices");
      attachment_url = uploadResult.secure_url;
    }

    const { rows, rowCount } = await pool.query(
      `UPDATE notices
       SET
         title          = COALESCE($1, title),
         body           = COALESCE($2, body),
         category       = COALESCE($3, category),
         expires_at     = COALESCE($4, expires_at),
         is_active      = COALESCE($5, is_active),
         attachment_url = COALESCE($6, attachment_url),
         updated_at     = NOW()
       WHERE id = $7
       RETURNING id, title, attachment_url, updated_at`,
      [title, body, category, expires_at, is_active, attachment_url, id],
    );

    if (rowCount === 0) return next(new ErrorHandler("Notice not found", 404));

    res.status(200).json({ status: "success", data: rows[0] });
  },
);

export const deleteNotice = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const { id } = req.params;

    const { rowCount } = await pool.query("DELETE FROM notices WHERE id = $1", [
      id,
    ]);

    if (rowCount === 0) {
      return next(new ErrorHandler("Notice not found", 404));
    }

    res.status(204).json({ status: "success", data: null });
  },
);

export const adminGetAllNotices = catchAsync(
  async (req: Request, res: Response) => {
    const { rows } = await pool.query(
      `SELECT
       n.id,
       n.title,
       n.category,
       n.is_active,
       n.expires_at,
       n.created_at,
       u.full_name AS author,
       COUNT(nr.id)::int AS read_count
     FROM notices n
     JOIN users u ON u.id = n.author_id
     LEFT JOIN notice_reads nr ON nr.notice_id = n.id
     GROUP BY n.id, u.full_name
     ORDER BY n.created_at DESC`,
    );

    res.status(200).json({
      status: "success",
      results: rows.length,
      data: rows,
    });
  },
);
