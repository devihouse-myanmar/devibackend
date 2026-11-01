import crypto from "crypto";
import sharp from "sharp";
import jsQR from "jsqr";
import { PutObjectCommand, HeadObjectCommand } from "@aws-sdk/client-s3";
import { r2Client, R2_BUCKET_NAME } from "../configs/cloudflareR2.config.js";
import CustomError from "../utils/customError.js";

const MAX_FILE_SIZE = 1 * 1024 * 1024; // 1 MB limit (S5)

/**
 * Validates file magic bytes to ensure file is genuinely PNG or JPEG (S5).
 * Prevents disguised files (e.g., PDF renamed to .png).
 */
export const checkMagicBytes = (buffer) => {
  if (!buffer || buffer.length < 8) {
    return false;
  }

  // PNG signature: 89 50 4E 47 0D 0A 1A 0A
  const isPng =
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a;

  // JPEG signature: FF D8 FF
  const isJpeg =
    buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;

  return isPng || isJpeg;
};

/**
 * QR Image Processing Service (S4, S5)
 * 1. Checks magic bytes (PNG/JPEG only, max 1MB)
 * 2. Re-encodes with sharp to strip all metadata/EXIF/payloads
 * 3. Computes SHA-256 hash of the sanitized image
 * 4. Decodes QR with jsQR (rejects if unreadable)
 * 5. Uploads to R2 at payment-qr/<sha256>.png (never overwrites existing key)
 *
 * @param {Buffer} buffer - Raw file buffer from multer
 * @returns {Promise<{ url: string, key: string, sha256: string, decodedText: string }>}
 */
export const processAndUploadQrImage = async (buffer) => {
  if (!buffer || !(buffer instanceof Buffer)) {
    throw new CustomError(400, "No image file provided");
  }

  // 1. Size check (max 1 MB)
  if (buffer.length > MAX_FILE_SIZE) {
    throw new CustomError(
      400,
      `Image size exceeds 1 MB limit (${(buffer.length / (1024 * 1024)).toFixed(2)} MB)`
    );
  }

  // 2. Magic bytes validation (PNG / JPEG only)
  if (!checkMagicBytes(buffer)) {
    throw new CustomError(
      400,
      "Invalid image format. Only authentic PNG and JPEG images are allowed (file signature check failed)"
    );
  }

  // 3. Re-encode with sharp (strips EXIF, metadata, hidden comments/payloads)
  let cleanPngBuffer;
  try {
    cleanPngBuffer = await sharp(buffer)
      .png({ compressionLevel: 9, adaptiveFiltering: true })
      .toBuffer();
  } catch (sharpErr) {
    throw new CustomError(
      400,
      `Failed to process image with sharp: ${sharpErr.message}`
    );
  }

  // 4. SHA-256 checksum of sanitized re-encoded bytes (S5, S6)
  const sha256 = crypto
    .createHash("sha256")
    .update(cleanPngBuffer)
    .digest("hex");

  // 5. Decode QR code with jsQR (S4)
  let decodedText = null;
  try {
    const { data, info } = await sharp(cleanPngBuffer)
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });

    const qrResult = jsQR(
      new Uint8ClampedArray(data),
      info.width,
      info.height
    );

    if (!qrResult || !qrResult.data) {
      throw new CustomError(
        400,
        "No readable QR code found in the image. Please upload a clear and complete QR code."
      );
    }
    decodedText = qrResult.data.trim();
  } catch (decodeErr) {
    if (decodeErr instanceof CustomError) throw decodeErr;
    throw new CustomError(
      400,
      `QR code decoding failed: ${decodeErr.message}`
    );
  }

  // 6. Upload to R2 under payment-qr/<sha256>.png (immutable key, never overwrite)
  const key = `payment-qr/${sha256}.png`;
  const publicUrl = `${process.env.R2_PUBLIC_URL}/${key}`;

  // Check if object already exists in R2
  let keyExists = false;
  try {
    const headCommand = new HeadObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: key,
    });
    await r2Client.send(headCommand);
    keyExists = true;
  } catch (headErr) {
    // 404/NotFound is expected when key does not exist
    keyExists = false;
  }

  if (!keyExists) {
    try {
      const putCommand = new PutObjectCommand({
        Bucket: R2_BUCKET_NAME,
        Key: key,
        Body: cleanPngBuffer,
        ContentType: "image/png",
        CacheControl: "public, max-age=31536000, immutable",
      });
      await r2Client.send(putCommand);
    } catch (uploadErr) {
      throw new CustomError(
        500,
        `Failed to store sanitized QR image in Cloudflare R2: ${uploadErr.message}`
      );
    }
  }

  return {
    url: publicUrl,
    key,
    sha256,
    decodedText,
  };
};
