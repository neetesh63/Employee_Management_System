const rateLimit = require('express-rate-limit');

const isTest = process.env.NODE_ENV === 'test';
const passThrough = (_req, _res, next) => next();

/** Strict limiter for login endpoint */
exports.loginLimiter = isTest
  ? passThrough
  : rateLimit({
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 10, // 10 attempts per window
      message: {
        error: 'Too many login attempts. Please try again after 15 minutes.',
      },
      standardHeaders: true,
      legacyHeaders: false,
      skipSuccessfulRequests: true, // successful logins don't count toward limit
    });

/** General API limiter */
exports.apiLimiter = isTest
  ? passThrough
  : rateLimit({
      windowMs: 60 * 1000, // 1 minute
      max: 200,
      message: { error: 'Too many requests. Please slow down.' },
      standardHeaders: true,
      legacyHeaders: false,
    });

