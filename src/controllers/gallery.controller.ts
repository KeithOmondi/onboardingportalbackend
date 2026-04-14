import { Request, Response, NextFunction } from "express";
import pool from "../config/db";
import catchAsync from "../utils/catchAsync";
import ErrorHandler from "../utils/ErrorHandler";
import { uploadToCloudinary } from "../config/cloudinary";

/**
 * Enum for strict media classification
 */
export enum MediaType {
  IMAGE = "IMAGE",
  VIDEO = "VIDEO",
  DOCUMENT = "DOCUMENT" // Included for future-proofing
}

/**
 * Interface for the Gallery Item
 */
export interface IGalleryItem {
  id: number;
  title: string;
  description?: string;
  file_url: string;
  file_type: MediaType;
  mime_type: string;
  created_at: string;
}

/**
 * @desc    Get all gallery items
 * @route   GET /api/v1/gallery
 */
export const getGallery = catchAsync(async (req: Request, res: Response) => {
  const result = await pool.query(
    "SELECT * FROM gallery ORDER BY created_at DESC"
  );

  res.status(200).json({
    status: "success",
    results: result.rowCount,
    data: result.rows,
  });
});

/**
 * @desc    Create Gallery Item (Image or Video)
 * @route   POST /api/v1/gallery
 */
export const createGalleryItem = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const { title, description } = req.body;

  if (!req.file) {
    return next(new ErrorHandler("Please upload a file", 400));
  }

  // 1. Auto-detect type from mimetype
  const isVideo = req.file.mimetype.startsWith("video");
  const detectedType = isVideo ? MediaType.VIDEO : MediaType.IMAGE;

  // 2. Upload to Cloudinary with correct resource type
  const uploadRes = await uploadToCloudinary(
    req.file, 
    "judiciary_gallery", 
    isVideo ? "video" : "image"
  );

  // 3. Save to database
  const result = await pool.query(
    `INSERT INTO gallery (title, description, file_url, file_type, mime_type) 
     VALUES ($1, $2, $3, $4, $5) RETURNING *`,
    [
      title || "Untitled",
      description || null,
      uploadRes.secure_url,
      detectedType,
      req.file.mimetype
    ]
  );

  res.status(201).json({
    status: "success",
    data: result.rows[0],
  });
});

/**
 * @desc    Delete Gallery Item
 * @route   DELETE /api/v1/gallery/:id
 */
export const deleteGalleryItem = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const { id } = req.params;

  const result = await pool.query("DELETE FROM gallery WHERE id = $1", [id]);

  if (result.rowCount === 0) {
    return next(new ErrorHandler("Item not found", 404));
  }

  res.status(204).json({
    status: "success",
    data: null,
  });
});