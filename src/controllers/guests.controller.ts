import { Request, Response, NextFunction } from "express";
import pool from "../config/db";
import catchAsync from "../utils/catchAsync";
import ErrorHandler from "../utils/ErrorHandler";
import { IGuest } from "../interfaces/guests.interface";
import { generateGuestListHtml } from "../utils/guestListTemplate";
import puppeteer from "puppeteer-core";
import chromium from "@sparticuz/chromium";
import * as ExcelJS from "exceljs";
import { Document, Packer, Paragraph, Table, TableRow, TableCell, WidthType, HeadingLevel, AlignmentType } from "docx";

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
   ON CONFLICT (user_id) DO UPDATE SET status = 'DRAFT', updated_at = NOW()
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

/* =====================================================
    USER / JUDGE HANDLERS
===================================================== */

/**
 * Wipes the entire registry (Guests and Registration record)
 * Updated to allow deletion even if status is 'SUBMITTED'
 */
export const deleteGuestList = catchAsync(async (req: any, res: Response, next: NextFunction) => {
  const userId = req.user.id;
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // 1. Get the registration ID
    const regCheck = await client.query(
      "SELECT id FROM registrations WHERE user_id = $1", 
      [userId]
    );

    if (regCheck.rowCount === 0) {
      return next(new ErrorHandler("No registry found to delete", 404));
    }

    const registrationId = regCheck.rows[0].id;

    // 2. Delete the children first (Guests) to satisfy FK constraints
    await client.query("DELETE FROM guests WHERE registration_id = $1", [registrationId]);

    // 3. Delete the parent (Registration)
    await client.query("DELETE FROM registrations WHERE id = $1", [registrationId]);

    await client.query("COMMIT");
    
    res.status(200).json({ 
      status: "success", 
      message: "Registry and all associated guests have been deleted successfully." 
    });
  } catch (error: any) {
    await client.query("ROLLBACK");
    return next(new ErrorHandler(error.message, 500));
  } finally {
    client.release();
  }
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

export const downloadJudgeGuestPDF = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const { userId } = req.params;

    const dataQuery = `
      SELECT 
        u.full_name AS judge_name,
        COALESCE(
          json_agg(g.* ORDER BY g.name ASC) FILTER (WHERE g.id IS NOT NULL),
          '[]'
        ) AS guests
      FROM users u
      LEFT JOIN registrations r ON u.id::text = r.user_id
      LEFT JOIN guests g ON r.id = g.registration_id
      WHERE u.id::text = $1
      GROUP BY u.id;
    `;

    const result = await pool.query(dataQuery, [userId]);
    if (result.rowCount === 0) return next(new ErrorHandler("Officer record not found", 404));

    const { judge_name, guests } = result.rows[0];

    let browser;
    try {
      browser = await puppeteer.launch({
  args: chromium.args,
  defaultViewport: { width: 1280, height: 720 },
  executablePath: await chromium.executablePath(),
  headless: true,
});

      const page = await browser.newPage();
      const htmlContent = generateGuestListHtml(judge_name, guests);

      await page.setContent(htmlContent, { waitUntil: "networkidle0" });

      const pdfBuffer = await page.pdf({
        format: "A4",
        printBackground: true,
        margin: { top: "20px", bottom: "20px", left: "20px", right: "20px" },
      });

      await browser.close();

      const safeName = judge_name.replace(/\s+/g, "_");
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename=GuestList_${safeName}.pdf`
      );

      return res.send(pdfBuffer);
    } catch (error) {
      if (browser) await browser.close();
      console.error("PDF Export Error:", error);
      return next(new ErrorHandler("Failed to generate Guest List PDF", 500));
    }
  }
);

export const exportAllGuestLists = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const query = `
      SELECT 
        u.full_name AS judge_name,
        r.status,
        COALESCE(json_agg(g.* ORDER BY g.name ASC) FILTER (WHERE g.id IS NOT NULL), '[]') AS guests
      FROM registrations r
      JOIN users u ON r.user_id = u.id::text
      LEFT JOIN guests g ON r.id = g.registration_id
      WHERE r.status = 'SUBMITTED'
      GROUP BY r.id, u.full_name
      ORDER BY u.full_name ASC;
    `;

    const result = await pool.query(query);

    if (result.rowCount === 0) {
      return next(new ErrorHandler("No submitted registries found to export", 404));
    }

    let browser;
    try {
      browser = await puppeteer.launch({
  args: chromium.args,
  defaultViewport: { width: 1280, height: 720 },
  executablePath: await chromium.executablePath(),
  headless: true,
});

      const page = await browser.newPage();

      let combinedHtml = `
        <html>
        <head>
          <style>
            @page { margin: 25mm; }
            body { 
              font-family: 'Times New Roman', Times, serif; 
              padding: 0; 
              color: #1a1a1a;
              line-height: 1.4;
            }
            .page-break { page-break-after: always; }
            
            .header { text-align: center; border-bottom: 3px double #1a3a32; margin-bottom: 30px; padding-bottom: 10px; }
            .republic { font-weight: bold; font-size: 20px; letter-spacing: 2px; text-transform: uppercase; margin: 0; }
            .office { font-size: 16px; font-weight: bold; margin: 5px 0; color: #355E3B; }
            .report-title { font-size: 14px; text-decoration: underline; margin-top: 10px; font-weight: bold; }
            
            .meta-data { font-size: 11px; margin-bottom: 20px; color: #444; }
            
            .registrant-section { margin-top: 25px; }
            .judge-name { 
              background-color: #f1f5f9; 
              padding: 8px; 
              font-size: 14px; 
              border-left: 4px solid #c2a336; 
              color: #1a3a32;
              font-weight: bold;
              text-transform: uppercase;
            }
            
            table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 11px; }
            th { 
              background-color: #1a3a32; 
              color: #ffffff; 
              text-transform: uppercase; 
              padding: 8px; 
              border: 1px solid #1a3a32;
              letter-spacing: 0.5px;
            }
            td { padding: 8px; border: 1px solid #cbd5e1; }
            tr:nth-child(even) { background-color: #f8fafc; }
            
            .integrity-note { 
              margin-top: 40px; 
              font-size: 10px; 
              color: #64748b; 
              text-align: center; 
              border-top: 1px solid #e2e8f0; 
              padding-top: 10px; 
            }
          </style>
        </head>
        <body>
          <div class="header">
            <p class="republic">Republic of Kenya</p>
            <p class="office">OFFICE OF THE REGISTRAR HIGH COURT</p>
            <p class="report-title">COMPLIANCE AUDIT: CONSOLIDATED GUEST LIST</p>
          </div>
          
          <div class="meta-data">
            <strong>GEN_DATE:</strong> ${new Date().toLocaleString('en-GB')}<br/>
          </div>
      `;

      result.rows.forEach((row: any, index: number) => {
        combinedHtml += `
          <div class="registrant-section">
            <div class="judge-name">Registrant: ${row.judge_name}</div>
            <table>
              <thead>
                <tr>
                  <th width="5%">#</th>
                  <th width="35%">Guest Full Name</th>
                  <th width="15%">Category</th>
                  <th width="25%">ID / Birth Certificate</th>
                  <th width="20%">Phone Contact</th>
                </tr>
              </thead>
              <tbody>
                ${row.guests.map((g: any, i: number) => `
                  <tr>
                    <td>${i + 1}</td>
                    <td><strong>${g.name}</strong></td>
                    <td>${g.type}</td>
                    <td>${g.id_number || g.birth_cert_number || '---'}</td>
                    <td>${g.phone || 'N/A'}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
          
          ${index < result.rows.length - 1 ? '<div class="page-break"></div>' : ''}
        `;
      });

      combinedHtml += `
          <div class="integrity-note">
            <p><strong>NOTE ON INTEGRITY</strong></p>
            <p>This report is an official extract from the High Court Judges Onboarding Portal. 
            Any alteration to this document is a criminal offense under the Computer Misuse and Cybercrimes Act.</p>
            <p><strong>ELECTRONICALLY SIGNED BY THE REGISTRAR</strong></p>
          </div>
        </body>
        </html>
      `;

      await page.setContent(combinedHtml, { waitUntil: "networkidle0" });

      const pdfBuffer = await page.pdf({
        format: "A4",
        printBackground: true,
        displayHeaderFooter: true,
        footerTemplate: `
          <div style="font-size: 9px; text-align: center; width: 100%; font-family: 'Times New Roman';">
            Page <span class="pageNumber"></span> of <span class="totalPages"></span> - Office of the Registrar High Court
          </div>`,
        margin: { top: '25mm', bottom: '20mm', left: '20mm', right: '20mm' }
      });

      await browser.close();

      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `attachment; filename=Consolidated_Registry_${new Date().toISOString().split('T')[0]}.pdf`);
      return res.send(pdfBuffer);

    } catch (error) {
      if (browser) await browser.close();
      console.error("PDF Export Error:", error);
      return next(new ErrorHandler("Failed to generate Consolidated PDF", 500));
    }
  }
);



export const exportAllGuestListsExcel = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const query = `
      SELECT u.full_name AS judge_name, g.*
      FROM registrations r
      JOIN users u ON r.user_id = u.id::text
      JOIN guests g ON r.id = g.registration_id
      WHERE r.status = 'SUBMITTED'
      ORDER BY u.full_name ASC, g.name ASC;
    `;

    const result = await pool.query(query);
    if (result.rowCount === 0) return next(new ErrorHandler("No data to export", 404));

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Consolidated Guest List");

    // Define Columns
    worksheet.columns = [
      { header: "Registrant (Judge)", key: "judge_name", width: 25 },
      { header: "Guest Name", key: "name", width: 25 },
      { header: "Category", key: "type", width: 15 },
      { header: "Gender", key: "gender", width: 10 },
      { header: "ID / Birth Cert", key: "identity", width: 20 },
      { header: "Phone", key: "phone", width: 15 },
      { header: "Email", key: "email", width: 25 },
    ];

    // Style Header
    worksheet.getRow(1).font = { bold: true };
    worksheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF1A3A32' }
    };
    worksheet.getRow(1).font = { color: { argb: 'FFFFFFFF' }, bold: true };

    // Add Rows
    result.rows.forEach((row) => {
      worksheet.addRow({
        judge_name: row.judge_name,
        name: row.name,
        type: row.type,
        gender: row.gender,
        identity: row.id_number || row.birth_cert_number || "N/A",
        phone: row.phone,
        email: row.email,
      });
    });

    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", "attachment; filename=GuestList_Export.xlsx");

    await workbook.xlsx.write(res);
    res.end();
  }
);



export const exportAllGuestListsWord = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const query = `
      SELECT r.id, u.full_name AS judge_name, 
      COALESCE(json_agg(g.* ORDER BY g.name ASC) FILTER (WHERE g.id IS NOT NULL), '[]') AS guests
      FROM registrations r
      JOIN users u ON r.user_id = u.id::text
      LEFT JOIN guests g ON r.id = g.registration_id
      WHERE r.status = 'SUBMITTED'
      GROUP BY r.id, u.full_name
    `;

    const result = await pool.query(query);

    const doc = new Document({
      sections: [{
        properties: {},
        children: [
          new Paragraph({ text: "REPUBLIC OF KENYA", heading: HeadingLevel.HEADING_1, alignment: AlignmentType.CENTER }),
          new Paragraph({ text: "OFFICE OF THE REGISTRAR HIGH COURT", alignment: AlignmentType.CENTER }),
          new Paragraph({ text: "CONSOLIDATED GUEST LIST REPORT", alignment: AlignmentType.CENTER, spacing: { after: 400 } }),
          
          ...result.rows.flatMap((row) => [
            new Paragraph({ text: `Registrant: ${row.judge_name}`, heading: HeadingLevel.HEADING_3, spacing: { before: 200 } }),
            new Table({
              width: { size: 100, type: WidthType.PERCENTAGE },
              rows: [
                new TableRow({
                  children: [
                    new TableCell({ children: [new Paragraph("Name")] }),
                    new TableCell({ children: [new Paragraph("Category")] }),
                    new TableCell({ children: [new Paragraph("ID / Phone")] }),
                  ],
                }),
                ...row.guests.map((g: any) => new TableRow({
                  children: [
                    new TableCell({ children: [new Paragraph(g.name)] }),
                    new TableCell({ children: [new Paragraph(g.type)] }),
                    new TableCell({ children: [new Paragraph(`${g.id_number || g.birth_cert_number || 'N/A'}`)] }),
                  ],
                })),
              ],
            }),
          ]),
        ],
      }],
    });

    const buffer = await Packer.toBuffer(doc);
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
    res.setHeader("Content-Disposition", "attachment; filename=GuestList_Export.docx");
    res.send(buffer);
  }
);

export const updateGuest = catchAsync(async (req: any, res: Response, next: NextFunction) => {
  const { id } = req.params;
  const userId = req.user.id;
  const { name, type, gender, id_number, birth_cert_number, phone, email } = req.body;

  // Verify ownership only — no status lock
  const ownershipCheck = await pool.query(
    `SELECT r.status 
     FROM guests g
     JOIN registrations r ON g.registration_id = r.id
     WHERE g.id = $1 AND r.user_id = $2`,
    [id, userId]
  );

  if (ownershipCheck.rowCount === 0) {
    return next(new ErrorHandler("Guest record not found or unauthorized", 404));
  }

  const updatedGuest = await pool.query(
    `UPDATE guests 
     SET name = $1, type = $2, gender = $3, id_number = $4, 
         birth_cert_number = $5, phone = $6, email = $7, updated_at = NOW()
     WHERE id = $8
     RETURNING *`,
    [name, type, gender, id_number, birth_cert_number, phone, email, id]
  );

  res.status(200).json({
    status: "success",
    message: "Guest updated successfully",
    data: updatedGuest.rows[0],
  });
});

/**
 * Deletes a single guest
 * Ensure the user owns the guest record
 */
export const deleteGuest = catchAsync(async (req: any, res: Response, next: NextFunction) => {
  const { id } = req.params;
  const userId = req.user.id;

  // Check ownership
  const ownershipCheck = await pool.query(
    `SELECT g.id 
     FROM guests g
     JOIN registrations r ON g.registration_id = r.id
     WHERE g.id = $1 AND r.user_id = $2`,
    [id, userId]
  );

  if (ownershipCheck.rowCount === 0) {
    return next(new ErrorHandler("Guest record not found or unauthorized", 404));
  }

  await pool.query("DELETE FROM guests WHERE id = $1", [id]);

  // Using 200 instead of 204 if you want to send a JSON success message back to Redux/Frontend
  res.status(200).json({ 
    status: "success", 
    message: "Guest removed from registry" 
  });
});



