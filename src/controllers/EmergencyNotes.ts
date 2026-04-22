import { Request, Response, NextFunction } from "express";
import pool from "../config/db";
import catchAsync from "../utils/catchAsync";
import ErrorHandler from "../utils/ErrorHandler";
import { IEmergencyNote } from "../interfaces/emergency.interface";

/**
 * @desc  Upsert the single shared emergency note (Admin only)
 * @route PATCH /api/emergency/update
 */
export const createEmergencyNote = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const { note } = req.body;

    if (!note || !note.trim()) {
      return next(new ErrorHandler("Note content is required.", 400));
    }

    const result = await pool.query<IEmergencyNote>(
      `INSERT INTO emergency_notes (note, is_singleton, updated_at)
       VALUES ($1, TRUE, NOW())
       ON CONFLICT (is_singleton) -- This matches the UNIQUE constraint we created
       DO UPDATE SET
          note       = EXCLUDED.note,
          updated_at = NOW()
       RETURNING id, note, updated_at`,
      [note]
    );

    res.status(200).json({ // Changed 201 to 200 as it's often an update
      status: "success",
      data: result.rows[0],
    });
  }
);

/**
 * @desc  Get the single shared emergency note (Judges / Admins)
 * @route GET /api/emergency/get
 */
export const getEmergencyNote = catchAsync(
  async (req: Request, res: Response) => {
    const result = await pool.query<IEmergencyNote>(
      `SELECT * FROM emergency_notes LIMIT 1`
    );

    if (result.rowCount === 0) {
      return res.status(200).json({ status: "success", data: null });
    }

    res.status(200).json({
      status: "success",
      data: result.rows[0],
    });
  }
);