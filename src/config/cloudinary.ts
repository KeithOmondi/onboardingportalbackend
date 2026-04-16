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
 * Handles Images, Videos, and PDFs with specific optimizations.
 */
export const uploadToCloudinary = (
  file: Express.Multer.File,
  folder: string,
  forcedType?: "image" | "video" | "raw" | "auto"
): Promise<UploadApiResponse> => {
  return new Promise((resolve, reject) => {
    const isVideo = file.mimetype.startsWith("video");
    const isPdf = file.mimetype === "application/pdf";

    // 1. Determine the correct resource_type
    // PDFs are best handled as 'raw' or 'auto' to preserve document integrity
    let resourceType: "image" | "video" | "raw" | "auto" = "auto";
    if (isPdf) resourceType = "raw";
    if (isVideo) resourceType = "video";

    const options: UploadApiOptions = {
      folder: folder,
      resource_type: forcedType || resourceType,
    };

    // 2. Apply type-specific logic
    if (isVideo) {
      options.transformation = [
        { streaming_profile: "hd", format: "m3u8" },
        { quality: "auto" }
      ];
      options.eager = [
        { width: 720, height: 480, crop: "pad", video_codec: "h264" },
        { format: "jpg", resource_type: "video", frames: 1 }
      ];
      options.eager_async = true;
    } else if (isPdf) {
      // ── PDF SPECIFIC ──
      // We avoid transformations to ensure the PDF stays a valid PDF file
      options.flags = "attachment"; 
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
        if (!result) return reject(new Error("Cloudinary upload failed"));
        resolve(result);
      },
    );

    const stream = Readable.from(file.buffer);
    
    stream.on("error", (err) => {
      console.error("Stream Error:", err);
      reject(err);
    });

    stream.pipe(uploadStream);
  });
};

export default cloudinary;