import rateLimit from "express-rate-limit";

export const rateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: {
    error: "Too many requests from this IP, please try again later.",
    resetTime: new Date(Date.now() + 15 * 60 * 1000),
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    // Skip rate limiting for health checks
    return req.path === "/health";
  },
});

// Search-specific rate limiter (more restrictive)
export const searchRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 20, // 20 search requests per minute
  message: {
    error: "Too many search requests, please slow down.",
    resetTime: new Date(Date.now() + 60 * 1000),
  },
});
