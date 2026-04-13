import { Request, Response } from "express";
import pool from "../config/db"; // Your pg Pool connection
import { IJudicialOfficial } from "../interfaces/court.interface";
import { uploadToCloudinary } from "../config/cloudinary";

/**
 * @section JUDICIAL OFFICIALS
 */

export const createOfficial = async (req: Request, res: Response) => {
  try {
    const { name, designation, mandate_body } = req.body;
    let image_url = null;

    // 1. Handle Cloudinary Upload if file exists
    if (req.file) {
      const uploadResult = await uploadToCloudinary(req.file, "judicial_officials");
      image_url = uploadResult.secure_url;
    }

    // 2. Insert into PostgreSQL
    const query = `
      INSERT INTO judicial_officials (name, designation, image_url, mandate_body, sort_order)
      VALUES ($1, $2, $3, $4, (SELECT COALESCE(MAX(sort_order), 0) + 1 FROM judicial_officials))
      RETURNING *;
    `;
    
    const result = await pool.query(query, [name, designation, image_url, mandate_body]);
    const newOfficial: IJudicialOfficial = result.rows[0];

    return res.status(201).json({
      success: true,
      message: "Official profile published successfully",
      data: newOfficial,
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const getOfficials = async (_req: Request, res: Response) => {
  try {
    const result = await pool.query("SELECT * FROM judicial_officials ORDER BY sort_order ASC");
    return res.status(200).json(result.rows);
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * @section COURT FAQS
 */

export const createFaq = async (req: Request, res: Response) => {
  try {
    const { question, answer } = req.body;
    const query = `INSERT INTO court_faqs (question, answer) VALUES ($1, $2) RETURNING *`;
    const result = await pool.query(query, [question, answer]);
    
    return res.status(201).json(result.rows[0]);
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * @section COURT MANDATES (The Sidebar)
 */

export const createMandate = async (req: Request, res: Response) => {
  try {
    const { title, detail, is_primary } = req.body;
    
    // Auto-calculate pillar_order
    const query = `
      INSERT INTO court_mandates (title, detail, is_primary, pillar_order)
      VALUES ($1, $2, $3, (SELECT COALESCE(MAX(pillar_order), 0) + 1 FROM court_mandates))
      RETURNING *
    `;
    
    const result = await pool.query(query, [title, detail, is_primary || false]);
    return res.status(201).json(result.rows[0]);
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * @section FETCH ALL (Initial Load)
 */
export const getCourtManagementData = async (_req: Request, res: Response) => {
  try {
    const officials = await pool.query("SELECT * FROM judicial_officials ORDER BY sort_order ASC");
    const faqs = await pool.query("SELECT * FROM court_faqs ORDER BY created_at DESC");
    const mandates = await pool.query("SELECT * FROM court_mandates ORDER BY is_primary DESC, pillar_order ASC");

    return res.status(200).json({
      officials: officials.rows,
      faqs: faqs.rows,
      mandates: mandates.rows
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};