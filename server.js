require('dotenv').config();
const express = require('express');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const helmet = require('helmet');
const morgan = require('morgan');
const path = require('path');
const connectDB = require('./src/config/db');

const app = express();
const PORT = process.env.PORT || 3000;

async function bootstrap() {
  // ─── Database ────────────────────────────────────────────────
  const { uri } = await connectDB();

  // ─── Security Headers ────────────────────────────────────────
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: [
            "'self'",
            'https://unpkg.com',
            'https://cdn.jsdelivr.net',
            "'unsafe-inline'", // required for Lucide icons init
          ],
          styleSrc: ["'self'", 'https://fonts.googleapis.com', "'unsafe-inline'"],
          fontSrc: ["'self'", 'https://fonts.gstatic.com', 'data:'],
          imgSrc: ["'self'", 'data:', 'https:'],
          connectSrc: ["'self'"],
        },
      },
    })
  );

  // ─── Request Logging ─────────────────────────────────────────
  if (process.env.NODE_ENV !== 'test') {
    app.use(morgan('dev'));
  }

  // ─── Body Parsing ────────────────────────────────────────────
  app.use(express.json({ limit: '2mb' }));
  app.use(express.urlencoded({ extended: true, limit: '2mb' }));

  // ─── Sessions (stored in MongoDB) ────────────────────────────
  app.use(
    session({
      secret: process.env.SESSION_SECRET || 'dev-secret-change-in-production',
      resave: false,
      saveUninitialized: false,
      store: MongoStore.create({
        mongoUrl: uri,
        ttl: 8 * 60 * 60, // 8 hours
        touchAfter: 24 * 3600, // lazy update session once per day
      }),
      cookie: {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 8 * 60 * 60 * 1000, // 8 hours in ms
      },
      name: 'pd_session',
    })
  );

  // ─── Rate Limiters ───────────────────────────────────────────
  const { loginLimiter, apiLimiter } = require('./src/middleware/rateLimiter');
  app.use('/api/auth/login', loginLimiter);
  app.use('/api', apiLimiter);

  // ─── API Routes ──────────────────────────────────────────────
  app.use('/api/auth', require('./src/routes/auth'));
  app.use('/api/employees', require('./src/routes/employees'));
  app.use('/api/departments', require('./src/routes/departments'));
  app.use('/api/dashboard', require('./src/routes/dashboard'));
  app.use('/api/leaves', require('./src/routes/leaves'));
  app.use('/api/audit-logs', require('./src/routes/auditLogs'));
  app.use('/api/attendance', require('./src/routes/attendance'));

  // ─── Health Check ────────────────────────────────────────────
  app.get('/api/health', (_req, res) =>
    res.json({ status: 'ok', app: 'PeopleDesk Pro', version: '2.0.0' })
  );

  // ─── Static Files ────────────────────────────────────────────
  app.use(express.static(path.join(__dirname, 'public')));

  // ─── SPA Fallback ────────────────────────────────────────────
  app.get('*', (_req, res) =>
    res.sendFile(path.join(__dirname, 'public', 'index.html'))
  );

  // ─── Global Error Handler ────────────────────────────────────
  app.use((err, _req, res, _next) => {
    console.error('Unhandled error:', err);
    res.status(err.status || 500).json({
      error:
        process.env.NODE_ENV === 'production'
          ? 'An internal error occurred.'
          : err.message,
    });
  });

  // ─── Start Server ────────────────────────────────────────────
  const server = app.listen(PORT, () => {
    console.log(`\n🚀  PeopleDesk Pro   → http://localhost:${PORT}`);
    console.log(`📊  Health check     → http://localhost:${PORT}/api/health`);
    console.log(`🔑  Admin Login      → admin@peopledesk.com / Admin@123!\n`);
  });

  return server;
}

if (require.main === module) {
  bootstrap().catch((err) => {
    console.error('Fatal bootstrap error:', err);
    process.exit(1);
  });
}

module.exports = { app, bootstrap };
