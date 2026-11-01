import rateLimit from "express-rate-limit";

export const paymentAccountRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // 100 requests per 15 minutes
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    return res.status(429).json({
      success: false,
      message: "Too many payment account operations from this IP, please try again after 15 minutes.",
    });
  },
});

export default paymentAccountRateLimiter;
