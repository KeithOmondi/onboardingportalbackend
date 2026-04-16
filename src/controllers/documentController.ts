import { Request, Response, NextFunction } from "express";
import pool from "../config/db";
import catchAsync from "../utils/catchAsync";
import ErrorHandler from "../utils/ErrorHandler";
import { IDocument, IDocumentQuery } from "../interfaces/documents.interface";
import { uploadToCloudinary } from "../config/cloudinary";
import axios from "axios";

// Helper type for DB values
type DBValue = string | number | boolean | Date | null | string[];

/**
 * @desc Internal helpers for Auth & Teams (Mocked or imported from your auth middleware)
 */
const getAuthUser = (req: Request) => req.user; 
const getUserTeamIds = async (userId: string): Promise<string[]> => {
  // Replace with actual team fetching logic
  const result = await pool.query("SELECT team_id FROM team_members WHERE user_id = $1", [userId]);
  return result.rows.map(row => row.team_id);
};

/**
 * @desc Upload file to Cloudinary and save metadata to Registry
 */
export const createDocument = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const { title, description, document_type } = req.body;
    const file = req.file;

    if (!file) return next(new ErrorHandler("No file provided for upload", 400));
    if (!title) return next(new ErrorHandler("Please provide a title", 400));

    console.log(`[Backend] Uploading: ${title} to Cloudinary...`);
    const folder = `judicial_system/${document_type || "general"}`;
    const cloudinaryResponse = await uploadToCloudinary(file, folder);

    const query = `
      INSERT INTO documents 
      (title, description, file_url, document_type, file_size, mime_type, owner_id)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *`;

    const values: DBValue[] = [
      title,
      description || null,
      cloudinaryResponse.secure_url,
      document_type || "GENERAL",
      file.size,
      file.mimetype,
      req.user?.id || null,
    ];

    const result = await pool.query(query, values);
    res.status(201).json({ status: "success", data: result.rows[0] });
  }
);

/**
 * @desc Fetch all documents with optional filters
 */
export const getDocuments = catchAsync(
  async (req: Request<{}, {}, {}, IDocumentQuery>, res: Response) => {
    const { document_type, search } = req.query;
    let query = `SELECT * FROM documents WHERE 1=1`;
    const values: DBValue[] = [];

    if (document_type) {
      values.push(document_type);
      query += ` AND document_type = $${values.length}`;
    }

    if (search) {
      values.push(`%${search}%`);
      query += ` AND (title ILIKE $${values.length} OR description ILIKE $${values.length})`;
    }

    query += ` ORDER BY created_at DESC`;
    const result = await pool.query(query, values);

    res.status(200).json({
      status: "success",
      results: result.rowCount,
      data: result.rows as IDocument[],
    });
  }
);

/**
 * @desc Remove document from Registry
 */
export const deleteDocument = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const { id } = req.params;
    const result = await pool.query("DELETE FROM documents WHERE id = $1 RETURNING id", [id]);

    if (result.rowCount === 0) return next(new ErrorHandler("Document not found", 404));
    res.status(204).send();
  }
);

/**
 * @desc Stream a Cloudinary file through the server with ownership verification
 * @route GET /api/v1/documents/stream/:id
 */
export const streamFile = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const user = getAuthUser(req);
  const rawId = req.params.id;
  const idString = Array.isArray(rawId) ? rawId[0] : rawId;

  console.log(`[Stream Debug] Request for Doc: ${idString} by User: ${user?.id}`);

  if (!user) return next(new ErrorHandler("Not authorized", 401));

  const docId = parseInt(idString, 10);
  if (isNaN(docId)) return next(new ErrorHandler("Invalid document ID", 400));

  // 1. Fetch from the documents table
  const { rows } = await pool.query(
    `SELECT file_url, mime_type, title, owner_id 
     FROM documents 
     WHERE id = $1`, 
    [docId]
  );

  if (rows.length === 0) {
    return next(new ErrorHandler("Document not found", 404));
  }

  const { file_url, mime_type, title, owner_id } = rows[0];

  // 2. SECURITY CHECK
  const userRole = user.role?.toString().toUpperCase();
  const isOwner = owner_id === user.id;
  
  // Fixed the missing || and cleaned up the check
  const isPrivilegedUser = 
    userRole === 'ADMIN' || 
    userRole === 'REGISTRAR' ||
    userRole === 'SUPER_ADMIN' || // Added missing OR here
    userRole === 'JUDGE';

  if (!isOwner && !isPrivilegedUser) {
     console.warn(`[Stream Debug] Unauthorized access attempt by ${user.id}`);
     return next(new ErrorHandler("You do not have permission to view this record", 403));
  }

  // 3. FETCH FROM CLOUDINARY
  try {
    const response = await axios({
      method: "GET",
      url: file_url,
      responseType: "stream",
      timeout: 30000
    });

    // Set headers for the browser
    res.setHeader("Content-Type", mime_type || "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename="${encodeURIComponent(title)}.pdf"`);
    res.setHeader("X-Content-Type-Options", "nosniff");

    // Pipe the Cloudinary stream directly to the Express response
    response.data.pipe(res);

    response.data.on("error", (err: Error) => {
      console.error("[Stream Debug] Pipe error:", err.message);
      if (!res.headersSent) res.status(500).end();
    });

  } catch (error: any) {
    console.error("[Stream Debug] Connection Error:", error.message);
    return next(new ErrorHandler("Could not connect to file storage", 500));
  }
});