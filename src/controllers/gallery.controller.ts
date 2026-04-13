import { Request, Response, NextFunction } from "express";
import pool from "../config/db";
import catchAsync from "../utils/catchAsync";
import ErrorHandler from "../utils/ErrorHandler";
import { IGalleryAlbum, MediaType } from "../interfaces/gallery.interface";
import { uploadToCloudinary } from "../config/cloudinary";

/**
 * @desc    Get all albums with granular media counts
 * @route   GET /api/v1/gallery/albums
 */
export const getAlbums = catchAsync(async (req: Request, res: Response) => {
  const { category } = req.query;

  // Granular counts for different media types
  let query = `
    SELECT 
      a.id, a.title, a.category, a.description, 
      a.event_date, a.location, a.thumbnail_url, a.created_at,
      json_build_object(
        'images', COUNT(m.id) FILTER (WHERE m.file_type = 'IMAGE'),
        'videos', COUNT(m.id) FILTER (WHERE m.file_type = 'VIDEO'),
        'docs', COUNT(m.id) FILTER (WHERE m.file_type = 'DOCUMENT')
      ) as "media_counts"
    FROM gallery_albums a
    LEFT JOIN gallery_media m ON a.id = m.album_id
  `;

  const queryParams: any[] = [];
  if (category && category !== "All") {
    query += ` WHERE a.category = $1`;
    queryParams.push(category);
  }

  query += ` GROUP BY a.id ORDER BY a.event_date DESC`;
  
  const result = await pool.query(query, queryParams);
  res.status(200).json({
    status: "success",
    results: result.rowCount,
    data: result.rows,
  });
});

/**
 * @desc    Get a single album and all its media items
 * @route   GET /api/v1/gallery/albums/:id
 */
export const getAlbumDetails = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const { id } = req.params;

  const albumResult = await pool.query("SELECT * FROM gallery_albums WHERE id = $1", [id]);
  if (albumResult.rowCount === 0) return next(new ErrorHandler("Album not found", 404));

  const mediaResult = await pool.query(
    "SELECT id, file_url, file_type, mime_type, caption, uploaded_at FROM gallery_media WHERE album_id = $1 ORDER BY uploaded_at ASC",
    [id]
  );

  res.status(200).json({
    status: "success",
    data: { ...albumResult.rows[0], media: mediaResult.rows },
  });
});

/**
 * @desc    Create a new album (Title and Category are flexible)
 */
export const createAlbum = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const { title, category, description, event_date, location } = req.body;
  let thumbnail_url = req.body.thumbnail_url;

  if (req.file) {
    const uploadRes = await uploadToCloudinary(req.file, "judiciary/gallery/thumbnails");
    thumbnail_url = uploadRes.secure_url;
  }

  if (!thumbnail_url) return next(new ErrorHandler("Thumbnail is required", 400));

  const result = await pool.query(
    `INSERT INTO gallery_albums 
     (title, category, description, event_date, location, thumbnail_url) 
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
    [title, category, description || null, event_date, location, thumbnail_url]
  );

  res.status(201).json({ status: "success", data: result.rows[0] });
});

/**
 * @desc    Bulk Upload media with auto-detection of type
 */
export const addMediaToAlbum = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const { id } = req.params;
  const files = req.files as Express.Multer.File[];

  if (!files || files.length === 0) return next(new ErrorHandler("No files uploaded", 400));

  const album = await pool.query("SELECT id FROM gallery_albums WHERE id = $1", [id]);
  if (album.rowCount === 0) return next(new ErrorHandler("Album not found", 404));

  const uploadPromises = files.map((file) => uploadToCloudinary(file, `judiciary/gallery/album_${id}`));
  const uploadResults = await Promise.all(uploadPromises);

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    for (const result of uploadResults) {
      // Map Cloudinary resource_type to our MediaType Enum
      let detectedType = MediaType.DOCUMENT;
      if (result.resource_type === 'image') detectedType = MediaType.IMAGE;
      if (result.resource_type === 'video') detectedType = MediaType.VIDEO;

      await client.query(
        `INSERT INTO gallery_media (album_id, file_url, file_type, mime_type, caption) 
         VALUES ($1, $2, $3, $4, $5)`,
        [
          id, 
          result.secure_url, 
          detectedType, 
          `${result.resource_type}/${result.format}`, // e.g., video/mp4
          req.body.caption || null
        ]
      );
    }

    await client.query("COMMIT");
    res.status(200).json({
      status: "success",
      message: `Processed ${uploadResults.length} files.`,
    });
  } catch (error: any) {
    await client.query("ROLLBACK");
    return next(new ErrorHandler(error.message, 500));
  } finally {
    client.release();
  }
});

/**
 * @desc    Delete album and all associated media records
 * @route   DELETE /api/v1/gallery/albums/:id
 */
export const deleteAlbum = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const { id } = req.params;

  const client = await pool.connect();
  
  try {
    await client.query("BEGIN");

    // 1. Delete associated media first (Foreign Key constraint safety)
    await client.query("DELETE FROM gallery_media WHERE album_id = $1", [id]);

    // 2. Delete the album
    const result = await client.query("DELETE FROM gallery_albums WHERE id = $1", [id]);

    if (result.rowCount === 0) {
      await client.query("ROLLBACK");
      return next(new ErrorHandler("Album not found", 404));
    }

    await client.query("COMMIT");

    res.status(204).json({
      status: "success",
      data: null,
    });
  } catch (error: any) {
    await client.query("ROLLBACK");
    return next(new ErrorHandler(error.message, 500));
  } finally {
    client.release();
  }
});