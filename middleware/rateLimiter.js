const rateLimit = require("express-rate-limit");

// Example: 100 requests per 15 minutes per IP
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 min
  max: 100, // limit each IP
  standardHeaders: true, // return rate limit info in headers
  legacyHeaders: false,  // disable old headers
  message: {
    error: "too_many_requests",
    details: "You have exceeded the request limit. Please try again later."
  }
});

module.exports = limiter;
