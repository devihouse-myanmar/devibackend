import multer from "multer";
import CustomError from "../utils/customError.js";

// Memory storage for QR image processing (max 1 MB per S5)
const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
  const allowedTypes = ["image/jpeg", "image/png", "image/jpg"];
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(
      new CustomError(
        400,
        "Invalid file type. Only PNG and JPEG images are allowed."
      ),
      false
    );
  }
};

const upload = multer({
  storage,
  limits: {
    fileSize: 1 * 1024 * 1024, // 1 MB strict limit
    files: 1,
  },
  fileFilter,
});

export const multerQrUpload = (fieldName = "qrImage") => {
  return (req, res, next) => {
    upload.single(fieldName)(req, res, (err) => {
      if (err instanceof multer.MulterError) {
        if (err.code === "LIMIT_FILE_SIZE") {
          return next(
            new CustomError(
              400,
              "QR image size exceeds 1 MB limit. Please upload a smaller image."
            )
          );
        }
        return next(new CustomError(400, `Upload error: ${err.message}`));
      } else if (err) {
        return next(err);
      }
      next();
    });
  };
};
