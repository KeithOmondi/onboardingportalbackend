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
  DOCUMENT = "DOCUMENT"
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
 * @route   GET /api/v1/gallery/get
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
 * @desc    Create multiple Gallery Items (Batch Upload)
 * @route   POST /api/v1/gallery/create
 */
export const createGalleryItems = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const { title, description } = req.body;
  
  // Access multiple files provided by multer.array()
  const files = req.files as Express.Multer.File[];

  if (!files || files.length === 0) {
    return next(new ErrorHandler("Please upload at least one file", 400));
  }

  // 1. Map through files and upload to Cloudinary concurrently
  const uploadPromises = files.map(async (file) => {
    const isVideo = file.mimetype.startsWith("video");
    const detectedType = isVideo ? MediaType.VIDEO : MediaType.IMAGE;

    const uploadRes = await uploadToCloudinary(
      file, 
      "judiciary_gallery", 
      isVideo ? "video" : "image"
    );

    return {
      title: title || "Untitled",
      description: description || null,
      file_url: uploadRes.secure_url,
      file_type: detectedType,
      mime_type: file.mimetype
    };
  });

  const uploadedItems = await Promise.all(uploadPromises);

  // 2. Prepare for batch insertion into PostgreSQL
  const values: any[] = [];
  const placeholders = uploadedItems.map((item, index) => {
    const offset = index * 5;
    values.push(item.title, item.description, item.file_url, item.file_type, item.mime_type);
    return `($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4}, $${offset + 5})`;
  }).join(", ");

  const query = `
    INSERT INTO gallery (title, description, file_url, file_type, mime_type) 
    VALUES ${placeholders} RETURNING *`;

  const result = await pool.query(query, values);

  res.status(201).json({
    status: "success",
    count: result.rowCount,
    data: result.rows,
  });
});

/**
 * @desc    Delete Gallery Item
 * @route   DELETE /api/v1/gallery/delete/:id
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