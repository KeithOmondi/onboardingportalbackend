import { Request, Response, NextFunction } from "express";
import pool from "../config/db";
import catchAsync from "../utils/catchAsync";
import ErrorHandler from "../utils/ErrorHandler";
import { uploadToCloudinary } from "../config/cloudinary";

export enum MediaType {
  IMAGE = "IMAGE",
  VIDEO = "VIDEO",
  DOCUMENT = "DOCUMENT",
}

/**
 * @desc    Upload multiple Gallery Items
 * @route   POST /api/v1/gallery
 * @note    Expects multer.array('files') in the route
 */
export const createGalleryItems = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const { title, description } = req.body;
    const files = req.files as Express.Multer.File[];

    if (!files || files.length === 0) {
      return next(new ErrorHandler("Please upload at least one file", 400));
    }

    // 1. Process all uploads in parallel
    const uploadPromises = files.map(async (file) => {
      const isVideo = file.mimetype.startsWith("video");
      const detectedType = isVideo ? MediaType.VIDEO : MediaType.IMAGE;

      const uploadRes = await uploadToCloudinary(
        file,
        "judiciary_gallery",
        isVideo ? "video" : "image",
      );

      return {
        title: title || "Untitled",
        description: description || null,
        file_url: uploadRes.secure_url,
        file_type: detectedType,
        mime_type: file.mimetype,
      };
    });

    const uploadedData = await Promise.all(uploadPromises);

    // 2. Batch save to database
    // We construct a single query with multiple value sets for efficiency
    const values: any[] = [];
    const queryPlaceholders = uploadedData
      .map((item, index) => {
        const offset = index * 5;
        values.push(
          item.title,
          item.description,
          item.file_url,
          item.file_type,
          item.mime_type,
        );
        return `($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4}, $${offset + 5})`;
      })
      .join(", ");

    const query = `
    INSERT INTO gallery (title, description, file_url, file_type, mime_type) 
    VALUES ${queryPlaceholders} 
    RETURNING *`;

    const result = await pool.query(query, values);

    res.status(201).json({
      status: "success",
      count: result.rowCount,
      data: result.rows,
    });
  },
);

/**
 * @desc    Delete Gallery Item
 */
export const deleteGalleryItem = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const { id } = req.params;
    const result = await pool.query("DELETE FROM gallery WHERE id = $1", [id]);

    if (result.rowCount === 0) {
      return next(new ErrorHandler("Item not found", 404));
    }

    res.status(204).json({ status: "success", data: null });
  },
);

/**
 * @desc    Get all gallery items
 */
export const getGallery = catchAsync(async (req: Request, res: Response) => {
  const result = await pool.query(
    "SELECT * FROM gallery ORDER BY created_at DESC",
  );
  res.status(200).json({
    status: "success",
    results: result.rowCount,
    data: result.rows,
  });
});
