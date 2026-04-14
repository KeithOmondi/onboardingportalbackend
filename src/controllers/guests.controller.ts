import { Request, Response, NextFunction } from "express";
import pool from "../config/db";
import catchAsync from "../utils/catchAsync";
import ErrorHandler from "../utils/ErrorHandler";
import { IGuest } from "../interfaces/guests.interface";

/**
 * CRITICAL FIX: 
 * We only need 'pdfmake' for the server-side printer.
 * REMOVE: pdfmake/build/pdfmake and pdfmake/build/vfs_fonts 
 * as they are for client-side/browser use only.
 */
const PdfPrinter = require("pdfmake");

/* =====================================================
    HELPERS & STYLING
===================================================== */

const JUDICIARY_GREEN = "#1a3a32";
const JUDICIARY_GOLD = "#c2a336";

const pdfStyles = {
  mainHeader: { fontSize: 16, bold: true, color: JUDICIARY_GREEN },
  subHeader: { fontSize: 10, bold: true, color: JUDICIARY_GOLD, letterSpacing: 1 },
  metaLabel: { fontSize: 8, bold: true, color: "#94a3b8", characterSpacing: 1 },
  metaValue: { fontSize: 11, bold: true, color: "#1e293b" },
  tableHeader: { fontSize: 9, bold: true, color: "#ffffff" },
  tableCell: { fontSize: 9, color: "#334155" },
  emptyState: { fontSize: 10, italics: true, color: "#94a3b8" },
  footerNote: { fontSize: 7, italics: true, color: "#94a3b8" },
};

const buildTableBody = (guests: any[]) => {
  const header = [
    { text: "#", style: "tableHeader" },
    { text: "Full Name", style: "tableHeader" },
    { text: "Type", style: "tableHeader" },
    { text: "ID / BC No.", style: "tableHeader" },
    { text: "Phone", style: "tableHeader" },
  ];

  const rows = guests.map((g, index) => [
    { text: String(index + 1), style: "tableCell", alignment: "center" },
    { text: g.name ?? "—", style: "tableCell" },
    { text: g.type?.toUpperCase() ?? "—", style: "tableCell", alignment: "center" },
    { text: g.id_number || g.birth_cert_number || "N/A", style: "tableCell" },
    { text: g.phone || "N/A", style: "tableCell" },
  ]);

  return [header, ...rows];
};

/* =====================================================
    USER / JUDGE HANDLERS
===================================================== */

export const saveGuestList = catchAsync(async (req: any, res: Response, next: NextFunction) => {
  const { guests }: { guests: IGuest[] } = req.body;
  const userId = req.user.id;

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

export const submitGuestList = catchAsync(async (req: any, res: Response, next: NextFunction) => {
  const userId = req.user.id;
  const result = await pool.query(
    "UPDATE registrations SET status = 'SUBMITTED', updated_at = NOW() WHERE user_id = $1 RETURNING id",
    [userId]
  );
  if (result.rowCount === 0) return next(new ErrorHandler("No draft found to submit", 404));
  res.status(200).json({ status: "success", message: "Registry finalized successfully" });
});

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

export const deleteGuestList = catchAsync(async (req: any, res: Response, next: NextFunction) => {
  const userId = req.user.id;
  const check = await pool.query("SELECT status FROM registrations WHERE user_id = $1", [userId]);
  if (check.rowCount === 0) return next(new ErrorHandler("Record not found", 404));
  if (check.rows[0].status === "SUBMITTED") return next(new ErrorHandler("Cannot delete a submitted registry", 400));
  await pool.query("DELETE FROM registrations WHERE user_id = $1", [userId]);
  res.status(204).json({ status: "success", data: null });
});

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
    if (registrationResult.rowCount === 0) return next(new ErrorHandler("Registry not found", 404));

    const guestsResult = await pool.query(
      `SELECT * FROM guests WHERE registration_id = $1 ORDER BY created_at ASC`,
      [id]
    );
    const registration = registrationResult.rows[0];
    res.status(200).json({
      status: "success",
      data: { ...registration, guests: guestsResult.rows },
    });
  }
);

/* =====================================================
    PDF CONTROLLER
===================================================== */

export const downloadJudgeGuestPDF = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const { userId } = req.params;

    const dataQuery = `
      SELECT 
        u.full_name AS judge_name,
        r.status,
        r.updated_at,
        COALESCE(
          json_agg(g.* ORDER BY g.name ASC) FILTER (WHERE g.id IS NOT NULL),
          '[]'
        ) AS guests
      FROM users u
      JOIN registrations r ON u.id::text = r.user_id
      LEFT JOIN guests g ON r.id = g.registration_id
      WHERE u.id::text = $1
      GROUP BY u.id, r.id;
    `;

    const result = await pool.query(dataQuery, [userId]);
    if (result.rowCount === 0) return next(new ErrorHandler("No registration record found", 404));

    const record = result.rows[0];
    const guests = record.guests || [];
    const generatedAt = new Date().toLocaleString("en-KE", { timeZone: "Africa/Nairobi" });

    const docDefinition: any = {
      pageMargins: [40, 60, 40, 60],
      content: [
        { text: "THE JUDICIARY OF KENYA", style: "mainHeader", alignment: "center" },
        { text: "OFFICIAL GUEST REGISTRATION REPORT", style: "subHeader", alignment: "center", margin: [0, 4, 0, 0] },
        {
          canvas: [{ type: "line", x1: 0, y1: 8, x2: 515, y2: 8, lineWidth: 1.5, lineColor: JUDICIARY_GREEN }],
          margin: [0, 10, 0, 20],
        },
        {
          columns: [
            { stack: [{ text: "OFFICER / JUDGE", style: "metaLabel" }, { text: record.judge_name, style: "metaValue" }] },
            { stack: [{ text: "TOTAL GUESTS", style: "metaLabel" }, { text: String(guests.length), style: "metaValue" }], alignment: "right" },
          ],
        },
        { text: " ", margin: [0, 10] },
        guests.length === 0
          ? { text: "No guests registered.", style: "emptyState", alignment: "center" }
          : {
              table: {
                headerRows: 1,
                widths: [20, "*", 50, 80, 80],
                body: buildTableBody(guests),
              },
              layout: {
                hLineWidth: (i: number, node: any) => (i === 0 || i === node.table.body.length ? 1 : 0.5),
                vLineWidth: () => 0,
                hLineColor: (i: number) => (i === 0 ? JUDICIARY_GREEN : "#e2e8f0"),
                fillColor: (i: number) => (i === 0 ? JUDICIARY_GREEN : i % 2 === 0 ? "#f8fafc" : null),
                paddingTop: () => 6,
                paddingBottom: () => 6,
              },
            },
        {
          text: `Generated on ${generatedAt} · Judiciary Onboarding Portal`,
          style: "footerNote",
          alignment: "center",
          margin: [0, 30, 0, 0],
        },
      ],
      styles: pdfStyles,
      defaultStyle: { font: "Helvetica" }, 
    };

    try {
      const printer = new PdfPrinter({
        Helvetica: {
          normal: "Helvetica",
          bold: "Helvetica-Bold",
          italics: "Helvetica-Oblique",
          bolditalics: "Helvetica-BoldOblique",
        },
      });

      const pdfDoc = printer.createPdfKitDocument(docDefinition);
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `attachment; filename=GuestList_${userId}.pdf`);
      
      pdfDoc.pipe(res);
      pdfDoc.end();
    } catch (err) {
      return next(new ErrorHandler("PDF Generation Failed", 500));
    }
  }
);