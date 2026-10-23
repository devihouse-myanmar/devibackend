import rateLimit from "express-rate-limit";

// Strict limit for public order tracking to slow down order number / phone guessing
const trackOrderRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  handler: (req, res) => {
    return res.status(429).json({
      code: 429,
      status: "failed",
      message: "Too many order tracking requests, please try again later.",
    });
  },
  standardHeaders: true,
  legacyHeaders: false,
});

export default trackOrderRateLimiter;
