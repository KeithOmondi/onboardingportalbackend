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


/**
 * @desc    Update the emergency note (Admin only)
 * @route   PUT /api/emergency/update
 * * Note: Your createEmergencyNote already uses ON CONFLICT. 
 * This explicit update ensures the record exists before updating,
 * or acts as a cleaner semantic alternative to upsert.
 */
export const updateEmergencyNote = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const { note } = req.body;

    if (!note || !note.trim()) {
      return next(new ErrorHandler("Note content is required.", 400));
    }

    const result = await pool.query<IEmergencyNote>(
      `UPDATE emergency_notes 
       SET note = $1, updated_at = NOW() 
       WHERE is_singleton = TRUE 
       RETURNING id, note, updated_at`,
      [note]
    );

    if (result.rowCount === 0) {
      return next(new ErrorHandler("No note found to update.", 404));
    }

    res.status(200).json({
      status: "success",
      data: result.rows[0],
    });
  }
);

/**
 * @desc    Delete/Clear the emergency note (Admin only)
 * @route   DELETE /api/emergency/delete
 */
export const deleteEmergencyNote = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const result = await pool.query(
      `DELETE FROM emergency_notes WHERE is_singleton = TRUE`
    );

    if (result.rowCount === 0) {
      return next(new ErrorHandler("No note found to delete.", 404));
    }

    res.status(204).json({
      status: "success",
      data: null,
    });
  }
);