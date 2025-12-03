const rateLimit = require('express-rate-limit');
const { RateLimiterRedis } = require('rate-limiter-flexible');
const redisClient = require('../config/redis');

// API General Limit
exports.apiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 100,
  message: 'Too many requests from this IP, please try again later.'
});

// Login Limit
exports.loginLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 5,
  message: 'Too many login attempts, please try again later.'
});

// Stream Creation Limit
exports.streamLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 2,
  message: 'You can only create 2 streams per minute.'
});

// Socket.IO Rate Limiter (Chat)
// Socket.IO Rate Limiter (Chat)
// exports.chatRateLimiter = new RateLimiterRedis({
//   storeClient: redisClient,
//   keyPrefix: 'chat_limit',
//   points: 5, // Increased to 5 messages
//   duration: 1, // per second
// });
