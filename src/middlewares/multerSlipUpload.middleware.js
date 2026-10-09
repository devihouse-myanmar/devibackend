import multer from "multer";
import CustomError from "../utils/customError.js";
import { validateSlipImage } from "../configs/cloudflareR2.config.js";

const storage = multer.memoryStorage();

const uploadPaymentScreenshot = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter(req, file, cb) {
    try {
      validateSlipImage(file);
      cb(null, true);
    } catch (err) {
      cb(new CustomError(400, err.message), false);
    }
  },
});

export default uploadPaymentScreenshot;
