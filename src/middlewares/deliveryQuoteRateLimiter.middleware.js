import rateLimit from "express-rate-limit";

// Rate limiter for delivery quote calculation at checkout
const deliveryQuoteRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 120, // 120 requests per 15 minutes
  handler: (req, res) => {
    return res.status(429).json({
      code: 429,
      status: "failed",
      message: "Too many delivery quote requests, please try again later.",
    });
  },
  standardHeaders: true,
  legacyHeaders: false,
});

export default deliveryQuoteRateLimiter;
