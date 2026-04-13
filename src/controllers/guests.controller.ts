import { Request, Response, NextFunction } from "express";
import pool from "../config/db";
import catchAsync from "../utils/catchAsync";
import ErrorHandler from "../utils/ErrorHandler";
import { IGuest } from "../interfaces/guests.interface";

/* =====================================================
    USER / JUDGE HANDLERS
===================================================== */

/**
 * @desc Save Guest List as DRAFT
 */
export const saveGuestList = catchAsync(async (req: any, res: Response, next: NextFunction) => {
  const { guests }: { guests: IGuest[] } = req.body;
  const userId = req.user.id; // From protect middleware

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const regRes = await client.query(
      `INSERT INTO registrations (user_id, status, updated_at) 
       VALUES ($1, 'DRAFT', NOW()) 
       ON CONFLICT (user_id) DO UPDATE SET updated_at = NOW() 
       RETURNING id, status`,
      [userId]
    );

    const registrationId = regRes.rows[0].id;

    // Replace guests (Sync logic)
    await client.query("DELETE FROM guests WHERE registration_id = $1", [registrationId]);
    
    for (const g of guests) {
      await client.query(
        `INSERT INTO guests (registration_id, name, type, gender, id_number, birth_cert_number, phone, email) 
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [registrationId, g.name, g.type, g.gender, g.id_number, g.birth_cert_number, g.phone, g.email]
      );
    }

    await client.query("COMMIT");
    res.status(200).json({ status: "success", message: "Draft saved successfully" });
  } catch (error: any) {
    await client.query("ROLLBACK");
    return next(new ErrorHandler(error.message, 500));
  } finally {
    client.release();
  }
});

/**
 * @desc Finalize and SUBMIT Guest List
 */
export const submitGuestList = catchAsync(async (req: any, res: Response, next: NextFunction) => {
  const userId = req.user.id;

  const result = await pool.query(
    "UPDATE registrations SET status = 'SUBMITTED', updated_at = NOW() WHERE user_id = $1 RETURNING id",
    [userId]
  );

  if (result.rowCount === 0) return next(new ErrorHandler("No draft found to submit", 404));

  res.status(200).json({ status: "success", message: "Registry finalized successfully" });
});

/**
 * @desc Get currently logged in user's guest list
 */
export const getMyGuestList = catchAsync(async (req: any, res: Response) => {
  const userId = req.user.id;

  const query = `
    SELECT r.status, r.updated_at,
    COALESCE(json_agg(g.* ORDER BY g.created_at ASC) FILTER (WHERE g.id IS NOT NULL), '[]') as guests
    FROM registrations r
    LEFT JOIN guests g ON r.id = g.registration_id
    WHERE r.user_id = $1
    GROUP BY r.id;
  `;

  const result = await pool.query(query, [userId]);
  const data = result.rows[0] || { status: "DRAFT", guests: [] };

  res.status(200).json({ status: "success", data });
});

/**
 * @desc Delete guest list (Strictly only if it is a DRAFT)
 */
export const deleteGuestList = catchAsync(async (req: any, res: Response, next: NextFunction) => {
  const userId = req.user.id;

  const check = await pool.query("SELECT status FROM registrations WHERE user_id = $1", [userId]);
  if (check.rowCount === 0) return next(new ErrorHandler("Record not found", 404));
  if (check.rows[0].status === "SUBMITTED") {
    return next(new ErrorHandler("Cannot delete a submitted registry", 400));
  }

  await pool.query("DELETE FROM registrations WHERE user_id = $1", [userId]);
  res.status(204).json({ status: "success", data: null });
});

/**
 * @desc Add guests (Patch)
 */
export const addGuests = catchAsync(async (req: any, res: Response, next: NextFunction) => {
  const { guests }: { guests: IGuest[] } = req.body;
  const userId = req.user.id;

  const reg = await pool.query("SELECT id FROM registrations WHERE user_id = $1", [userId]);
  if (reg.rowCount === 0) return next(new ErrorHandler("Registration not found", 404));

  const registrationId = reg.rows[0].id;

  for (const g of guests) {
    await pool.query(
      `INSERT INTO guests (registration_id, name, type, gender, id_number, birth_cert_number, phone, email) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [registrationId, g.name, g.type, g.gender, g.id_number, g.birth_cert_number, g.phone, g.email]
    );
  }

  res.status(200).json({ status: "success", message: "Guests added" });
});

/* =====================================================
    ADMIN HANDLERS
===================================================== */

/**
 * @desc Admin view all registrations
 */
export const getAllGuestLists = catchAsync(async (req: Request, res: Response) => {
  const query = `
    SELECT r.id, r.user_id, u.full_name as judge_name, r.status, r.updated_at,
    COUNT(g.id) as guest_count
    FROM registrations r
    JOIN users u ON r.user_id = u.id::text
    LEFT JOIN guests g ON r.id = g.registration_id
    GROUP BY r.id, u.full_name
    ORDER BY r.updated_at DESC;
  `;
  const result = await pool.query(query);

  res.status(200).json({ status: "success", results: result.rowCount, data: result.rows });
});

/**
 * @desc Placeholders for PDF Reports
 */
export const downloadAllGuestsPDF = catchAsync(async (req: Request, res: Response) => {
    // Logic for PDF generation using libraries like PDFKit or Puppeteer
    res.status(200).json({ status: "success", message: "PDF generation started" });
});

export const downloadJudgeGuestPDF = catchAsync(async (req: Request, res: Response) => {
    const { userId } = req.params;
    res.status(200).json({ status: "success", message: `Generating report for user ${userId}` });
});

export const getGuestListById = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const { id } = req.params;

    const registrationResult = await pool.query(
      `SELECT r.id, r.user_id, r.status, r.updated_at, u.full_name AS judge_name
       FROM registrations r
       JOIN users u ON r.user_id = u.id::text
       WHERE r.id = $1`,
      [id]
    );

    if (registrationResult.rowCount === 0) {
      return next(new ErrorHandler("Registry not found", 404));
    }

    const guestsResult = await pool.query(
      `SELECT * FROM guests WHERE registration_id = $1 ORDER BY created_at ASC`,
      [id]
    );

    const registration = registrationResult.rows[0];

    res.status(200).json({
      status: "success",
      data: {
        id: registration.id,
        user_id: registration.user_id,
        status: registration.status,
        updated_at: registration.updated_at,
        guests: guestsResult.rows,
      },
    });
  }
);