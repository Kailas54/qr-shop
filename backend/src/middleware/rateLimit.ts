import rateLimit from 'express-rate-limit';

const rateLimitBody = (message: string) => ({
  error: {
    code: 'RATE_LIMITED',
    message,
  },
});

/** Baseline cap for every route except the health probe. */
export const globalLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 300,
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => req.path === '/health',
  message: rateLimitBody('Too many requests. Try again shortly.'),
});

/** PIN joins: 5 attempts per 10 minutes per IP and QR table token. */
export const pinJoinLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: 5,
  skipSuccessfulRequests: true,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    const qrToken = typeof req.body?.qrToken === 'string' ? req.body.qrToken : 'unknown';
    return `${req.ip}:${qrToken}`;
  },
  message: rateLimitBody('Too many PIN attempts. Try again later.'),
});

/** Admin login: 10 attempts per 15 minutes per IP. */
export const adminLoginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: rateLimitBody('Too many login attempts. Try again later.'),
});

/** Order placement: 3 orders per 10 minutes per guest table session. */
export const orderLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: 3,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    const sessionId = req.guestSession?.sessionId;
    return sessionId ? `session:${sessionId}` : `ip:${req.ip}`;
  },
  skip: (req) => req.skipOrderRateLimit === true,
  message: rateLimitBody('Too many orders from this table. Please wait before ordering again.'),
});
