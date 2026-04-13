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

export const uploadToCloudinary = (
  file: Express.Multer.File,
  folder: string,
): Promise<UploadApiResponse> => {
  return new Promise((resolve, reject) => {
    const isVideo = file.mimetype.startsWith("video");

    const options: UploadApiOptions = {
      folder: folder,
      resource_type: "auto", // Automatically detects image vs video
    };

    if (isVideo) {
      // VIDEO OPTIMIZATIONS
      options.transformation = [
        { streaming_profile: "hd", format: "m3u8" }, // Prepare for HLS streaming
        { quality: "auto" }
      ];
      options.eager = [
        { width: 720, height: 480, crop: "pad", video_codec: "h264" },
        { format: "jpg", resource_type: "video", frames: 1 } // Generate a thumbnail
      ];
      options.eager_async = true; // Process heavy video transcoding in background
    } else {
      // IMAGE OPTIMIZATIONS
      options.transformation = [
        { width: 1200, crop: "limit", quality: "auto", fetch_format: "auto" },
      ];
    }

    const uploadStream = cloudinary.uploader.upload_stream(
      options,
      (error, result) => {
        if (error) return reject(error);
        if (!result) return reject(new Error("Upload failed"));
        resolve(result);
      },
    );

    // Handle stream errors to prevent server crashes
    const stream = Readable.from(file.buffer);
    stream.on("error", (err) => reject(err));
    stream.pipe(uploadStream);
  });
};

export default cloudinary;