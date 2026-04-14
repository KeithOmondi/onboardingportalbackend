/// <reference types="multer" />
import { v2 as cloudinary, UploadApiResponse, UploadApiOptions } from "cloudinary";
import { Readable } from "stream";
import config from "./env";

cloudinary.config({
  cloud_name: config.CLOUDINARY_CLOUD_NAME,
  api_key: config.CLOUDINARY_API_KEY,
  api_secret: config.CLOUDINARY_API_SECRET,
  secure: true,
});

/**
 * Uploads a buffer-based file (from Multer) to Cloudinary.
 * Handles both Images and Videos with specific optimizations.
 */
export const uploadToCloudinary = (
  file: Express.Multer.File,
  folder: string,
  forcedType?: "image" | "video" | "auto" // Optional override if needed
): Promise<UploadApiResponse> => {
  return new Promise((resolve, reject) => {
    const isVideo = file.mimetype.startsWith("video");

    const options: UploadApiOptions = {
      folder: folder,
      resource_type: forcedType || "auto", // Uses auto-detection by default
    };

    if (isVideo) {
      // ── VIDEO OPTIMIZATIONS ──
      options.transformation = [
        { streaming_profile: "hd", format: "m3u8" }, // Adaptive bitrate streaming
        { quality: "auto" }
      ];
      options.eager = [
        { width: 720, height: 480, crop: "pad", video_codec: "h264" },
        { format: "jpg", resource_type: "video", frames: 1 } // Frame for video preview
      ];
      options.eager_async = true; // Background processing so request doesn't timeout
    } else {
      // ── IMAGE OPTIMIZATIONS ──
      options.transformation = [
        { width: 1600, crop: "limit", quality: "auto", fetch_format: "auto" },
      ];
    }

    const uploadStream = cloudinary.uploader.upload_stream(
      options,
      (error, result) => {
        if (error) return reject(error);
        if (!result) return reject(new Error("Cloudinary upload failed - no result returned"));
        resolve(result);
      },
    );

    // Stream the buffer to Cloudinary
    const stream = Readable.from(file.buffer);
    
    stream.on("error", (err) => {
      console.error("Stream Error:", err);
      reject(err);
    });

    stream.pipe(uploadStream);
  });
};

export default cloudinary;