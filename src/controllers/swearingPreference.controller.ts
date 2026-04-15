// controllers/swearingPreference.controller.ts
import { Request, Response } from "express";
import db from "../config/db"; // Your Postgres pool connection
import { SwearingPreferencePayload } from "../interfaces/swearingPreference.interface";
import puppeteer from "puppeteer";
import { generatePreferencesHtml } from "../utils/pdfTemplates";

/**
 * @desc    Save or Update Judge Swearing Preference
 * @route   POST /api/v1/swearing-preferences
 * @access  Private (Judge Only)
 */
export const saveSwearingPreference = async (req: Request, res: Response) => {
  const { ceremonyChoice, religiousText }: SwearingPreferencePayload = req.body;
  const userId = req.user?.id; // Extracted from JWT middleware

  if (!userId) {
    return res.status(401).json({ message: "Unauthorized access" });
  }

  try {
    // 1. Data Sanitization: If affirmation, religious text must be null
    const sanitizedText = ceremonyChoice === "oath" ? religiousText : null;

    // 2. Database Upsert (Insert or Update on Conflict)
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

    // 3. Success Response
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
      message: "Access denied. Administrative privileges required." 
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
    console.error("[ADMIN_FETCH_ERROR] Full error:", error); // ← change this line
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
        message: "No preference record found for this user." 
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


export const downloadPreferencesPDF = async (req: Request, res: Response) => {
  // 1. Authorization Check
  const userRole = req.user?.role;
  if (userRole !== "super_admin" && userRole !== "admin") {
    return res.status(403).json({ success: false, message: "Unauthorized access" });
  }

  let browser;
  try {
    // 2. Fetch Data
    const { rows } = await db.query(`
      SELECT sp.*, u.full_name 
      FROM swearing_preferences sp
      JOIN users u ON sp.user_id = u.id
      ORDER BY u.full_name ASC
    `);

    // 3. Generate HTML from Template
    const htmlContent = generatePreferencesHtml(rows);

    // 4. Launch Puppeteer
    // Optimization: Use --no-sandbox for Linux/Docker environments
    browser = await puppeteer.launch({ 
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'] 
    });
    
    const page = await browser.newPage();
    
    // Set content and wait for it to be ready
    await page.setContent(htmlContent, { waitUntil: 'networkidle0' });

    // 5. Generate PDF Buffer
    const pdfBuffer = await page.pdf({ 
      format: 'A4', 
      printBackground: true,
      margin: { top: '20px', bottom: '20px', left: '20px', right: '20px' }
    });

    // 6. Clean up browser immediately
    await browser.close();

    // 7. Send File
    const filename = `Registry_Audit_${new Date().toISOString().split('T')[0]}.pdf`;
    
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=${filename}`);
    
    return res.send(pdfBuffer);

  } catch (error) {
    if (browser) await browser.close();
    console.error("PDF_GENERATION_ERROR:", error);
    return res.status(500).json({ 
      success: false, 
      message: "An error occurred while generating the PDF report" 
    });
  }
};

