// controllers/swearingPreference.controller.ts
import { Request, Response } from "express";
import db from "../config/db";
import { SwearingPreferencePayload } from "../interfaces/swearingPreference.interface";
import puppeteer from "puppeteer-core";
import chromium from "@sparticuz/chromium";
import { generatePreferencesHtml } from "../utils/pdfTemplates";

/**
 * @desc    Save or Update Judge Swearing Preference
 * @route   POST /api/v1/swearing-preferences
 * @access  Private (Judge Only)
 */
export const saveSwearingPreference = async (req: Request, res: Response) => {
  const { ceremonyChoice, religiousText }: SwearingPreferencePayload = req.body;
  const userId = req.user?.id;

  if (!userId) {
    return res.status(401).json({ message: "Unauthorized access" });
  }

  try {
    const sanitizedText = ceremonyChoice === "oath" ? religiousText : null;

    const query = `
      INSERT INTO swearing_preferences (user_id, ceremony_choice, religious_text)
      VALUES ($1, $2, $3)
      ON CONFLICT (user_id) 
      DO UPDATE SET 
        ceremony_choice = EXCLUDED.ceremony_choice,
        religious_text = EXCLUDED.religious_text,
        updated_at = CURRENT_TIMESTAMP
      RETURNING *;
    `;

    const values = [userId, ceremonyChoice, sanitizedText];
    const { rows } = await db.query(query, values);

    return res.status(200).json({
      success: true,
      message: "Preferences synchronized successfully",
      data: rows[0],
    });

  } catch (error: any) {
    console.error("[SWEARING_PREF_ERROR]:", error.message);
    return res.status(500).json({
      success: false,
      message: "An error occurred while updating your preferences",
    });
  }
};

/**
 * @desc    Get Current Judge Swearing Preference
 * @route   GET /api/v1/swearing-preferences/me
 * @access  Private (Judge Only)
 */
export const getMyPreference = async (req: Request, res: Response) => {
  const userId = req.user?.id;

  try {
    const query = `SELECT * FROM swearing_preferences WHERE user_id = $1 LIMIT 1;`;
    const { rows } = await db.query(query, [userId]);

    return res.status(200).json({
      success: true,
      data: rows[0] || null,
    });

  } catch (error: any) {
    return res.status(500).json({
      success: false,
      message: "Failed to retrieve preferences",
    });
  }
};

/**
 * @desc    Get All Swearing Preferences (Admin Dashboard)
 * @route   GET /api/v1/swearing-preferences
 * @access  Private (Super Admin, Admin Only)
 */
export const getAllSwearingPreferences = async (req: Request, res: Response) => {
  const userRole = req.user?.role;

  if (userRole !== "super_admin" && userRole !== "admin") {
    return res.status(403).json({
      success: false,
      message: "Access denied. Administrative privileges required.",
    });
  }

  try {
    const query = `
      SELECT 
        sp.*, 
        u.full_name
      FROM swearing_preferences sp
      INNER JOIN users u ON sp.user_id = u.id
      ORDER BY sp.updated_at DESC;
    `;

    const { rows } = await db.query(query);

    return res.status(200).json({
      success: true,
      count: rows.length,
      data: rows,
    });
  } catch (error: any) {
    console.error("[ADMIN_FETCH_ERROR] Full error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to retrieve preferences for administrative review.",
    });
  }
};

/**
 * @desc    Get Specific Judge Preference by User ID
 * @route   GET /api/v1/swearing-preferences/:userId
 * @access  Private (Super Admin, Admin Only)
 */
export const getPreferenceByUserId = async (req: Request, res: Response) => {
  const { userId } = req.params;
  const userRole = req.user?.role;

  if (userRole !== "super_admin" && userRole !== "admin") {
    return res.status(403).json({ success: false, message: "Unauthorized" });
  }

  try {
    const query = `
      SELECT sp.*, u.full_name 
      FROM swearing_preferences sp
      JOIN users u ON sp.user_id = u.id
      WHERE sp.user_id = $1;
    `;

    const { rows } = await db.query(query, [userId]);

    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "No preference record found for this user.",
      });
    }

    return res.status(200).json({
      success: true,
      data: rows[0],
    });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      message: "Error fetching individual judge preference.",
    });
  }
};

/**
 * @desc    Download All Swearing Preferences as PDF
 * @route   GET /api/v1/swearing-preferences/export
 * @access  Private (Super Admin, Admin Only)
 */
export const downloadPreferencesPDF = async (req: Request, res: Response) => {
  const userRole = req.user?.role;
  if (userRole !== "super_admin" && userRole !== "admin") {
    return res.status(403).json({ success: false, message: "Unauthorized access" });
  }

  let browser;
  try {
    const { rows } = await db.query(`
      SELECT sp.*, u.full_name 
      FROM swearing_preferences sp
      JOIN users u ON sp.user_id = u.id
      ORDER BY u.full_name ASC
    `);

    const htmlContent = generatePreferencesHtml(rows);

    browser = await puppeteer.launch({
      args: chromium.args,
      defaultViewport: { width: 1280, height: 720 },
      executablePath: await chromium.executablePath(),
      headless: true,
    });

    const page = await browser.newPage();
    await page.setContent(htmlContent, { waitUntil: "networkidle0" });

    const pdfBuffer = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: { top: "20px", bottom: "20px", left: "20px", right: "20px" },
    });

    await browser.close();

    const filename = `ORHC_AUTH_PREFERENCE_${new Date().toISOString().split("T")[0]}.pdf`;
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename=${filename}`);

    return res.send(pdfBuffer);

  } catch (error) {
    if (browser) await browser.close();
    console.error("PDF_GENERATION_ERROR:", error);
    return res.status(500).json({
      success: false,
      message: "An error occurred while generating the PDF report",
    });
  }
};