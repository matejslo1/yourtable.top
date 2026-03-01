import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import { errorHandler } from './middleware/errorHandler.js';

// Routes
import authRoutes from './routes/auth.js';
import tenantRoutes from './routes/tenant.js';
import userRoutes from './routes/users.js';

const app = express();

// ============================================
// Global Middleware
// ============================================

// Security headers
app.use(helmet());

// CORS
app.use(cors({
  origin: process.env.CORS_ORIGINS?.split(',') || ['http://localhost:5173'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// Body parsing
app.use(express.json({ limit: '10mb' }));

// Logging
if (process.env.NODE_ENV !== 'test') {
  app.use(morgan('short'));
}

// Rate limiting
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // generous for development
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'TooManyRequests', message: 'Too many requests, please try again later', statusCode: 429 },
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'TooManyRequests', message: 'Too many auth attempts, please try again later', statusCode: 429 },
});

app.use('/api/', globalLimiter);
app.use('/api/v1/auth/', authLimiter);

// ============================================
// Health Check
// ============================================

app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || '1.0.0',
  });
});

// ============================================
// API Routes (v1)
// ============================================

app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/tenant', tenantRoutes);
app.use('/api/v1/users', userRoutes);

// TODO Phase 2: Floor plans, tables, seating
// app.use('/api/v1/floor-plans', floorPlanRoutes);
// app.use('/api/v1/tables', tableRoutes);

// TODO Phase 3: Reservations, guests
// app.use('/api/v1/reservations', reservationRoutes);
// app.use('/api/v1/guests', guestRoutes);

// TODO Phase 4: Public booking widget API
// app.use('/api/v1/public/:tenantSlug', resolveTenant, publicRoutes);

// TODO Phase 5: Payments, notifications, config
// app.use('/api/v1/payments', paymentRoutes);
// app.use('/api/v1/notifications', notificationRoutes);
// app.use('/api/v1/config', configRoutes);

// ============================================
// 404 Handler
// ============================================

app.use((_req, res) => {
  res.status(404).json({
    error: 'NotFoundError',
    message: 'The requested endpoint does not exist',
    statusCode: 404,
  });
});

// ============================================
// Error Handler (must be last)
// ============================================

app.use(errorHandler);

export default app;
