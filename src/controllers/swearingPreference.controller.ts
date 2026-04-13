// controllers/swearingPreference.controller.ts
import { Request, Response } from "express";
import db from "../config/db"; // Your Postgres pool connection
import { SwearingPreferencePayload } from "../interfaces/swearingPreference.interface";

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