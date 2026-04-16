import { Request, Response, NextFunction } from "express";
import pool from "../config/db";
import catchAsync from "../utils/catchAsync";
import ErrorHandler from "../utils/ErrorHandler";
import { IDocument, IDocumentQuery } from "../interfaces/documents.interface";
import { uploadToCloudinary } from "../config/cloudinary";
import axios from "axios";

type DBValue = string | number | boolean | Date | null;

/**
 * @desc Upload file to Cloudinary and save metadata to Registry
 */
export const createDocument = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const { title, description, document_type } = req.body;
    const file = req.file;

    if (!file) {
      return next(new ErrorHandler("No file provided for upload", 400));
    }
    if (!title) {
      return next(new ErrorHandler("Please provide a title for the document", 400));
    }

    console.log(`[Backend] Uploading document: ${title} to Cloudinary...`);
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
    console.log(`[Backend] Document record created with ID: ${result.rows[0].id}`);

    res.status(201).json({
      status: "success",
      data: result.rows[0] as IDocument,
    });
  }
);

/**
 * @desc Fetch all documents with optional filters
 */
export const getDocuments = catchAsync(
  async (req: Request<{}, {}, {}, IDocumentQuery>, res: Response, next: NextFunction) => {
    const { document_type, search } = req.query;
    console.log(`[Backend] Fetching documents. Search: ${search || 'None'}, Type: ${document_type || 'All'}`);

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
    console.log(`[Backend] Attempting to delete document ID: ${id}`);

    const result = await pool.query(
      "DELETE FROM documents WHERE id = $1 RETURNING id",
      [id]
    );

    if (result.rowCount === 0) {
      return next(new ErrorHandler("Document not found", 404));
    }

    res.status(204).send();
  }
);

/**
 * @desc Proxy document stream to bypass iframe restrictions
 */
export const proxyDocument = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const { id } = req.params;
    console.log(`[Proxy] Request received for Document ID: ${id}`);

    // 1. Get document metadata from DB
    const result = await pool.query(
      "SELECT file_url, mime_type, title FROM documents WHERE id = $1",
      [id]
    );

    if (result.rowCount === 0) {
      console.warn(`[Proxy] Document ID ${id} not found in database.`);
      return next(new ErrorHandler("Document not found", 404));
    }

    const { file_url, mime_type, title } = result.rows[0];
    console.log(`[Proxy] Fetching stream from Cloudinary for: ${title}`);

    // 2. Fetch the file from Cloudinary as a stream
    const response = await axios({
      method: "get",
      url: file_url,
      responseType: "stream",
      timeout: 15000,
    });

    // 3. Set enhanced headers for the browser PDF viewer
    // Use 'application/pdf' as a fallback if mime_type is missing or generic
    res.setHeader("Content-Type", mime_type || "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename="${title.replace(/ /g, "_")}.pdf"`);
    res.setHeader("X-Content-Type-Options", "nosniff");

    // CRITICAL: Help the browser understand the stream size
    if (response.headers["content-length"]) {
      res.setHeader("Content-Length", response.headers["content-length"]);
    }

    // 4. Pipe the stream
    console.log(`[Proxy] Piping stream to client for ID: ${id}`);
    
    // Use the stream.pipeline utility or handle errors on the pipe
    response.data.pipe(res);

    response.data.on("error", (err: Error) => {
      console.error("[Proxy] Stream Error:", err.message);
      if (!res.headersSent) {
        res.status(500).json({ status: "error", message: "Failed to stream document" });
      }
      res.end();
    });

    // Log when the pipe is finished
    response.data.on("end", () => {
      console.log(`[Proxy] Stream successfully delivered for ID: ${id}`);
    });
  }
);