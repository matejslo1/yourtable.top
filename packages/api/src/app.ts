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
import floorPlanRoutes from './routes/floorPlans.js';
import tableStatusRoutes from './routes/tableStatus.js';
import configRoutes from './routes/config.js';
import publicBookingRoutes from './routes/publicBooking.js';
import publicAvailabilityRoutes from './routes/publicAvailability.js';
import reservationRoutes from './routes/reservations.js';
import guestRoutes from './routes/guests.js';
import waitlistRoutes from './routes/waitlist.js';
import paymentRoutes from './routes/payments.js';

const app = express();

// ============================================
// Global Middleware
// ============================================

app.use(helmet());

app.use(cors({
  origin: process.env.CORS_ORIGINS?.split(',') || ['http://localhost:5173', 'http://localhost:5174'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'stripe-signature'],
}));

app.use(express.json({ limit: '10mb' }));

if (process.env.NODE_ENV !== 'test') {
  app.use(morgan('short'));
}

// Rate limiting
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 1000,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'TooManyRequests', message: 'Too many requests', statusCode: 429 },
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
});

const holdLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'TooManyRequests', message: 'Too many booking attempts. Please wait a moment.', statusCode: 429 },
});

app.use('/api/', globalLimiter);
app.use('/api/v1/auth/', authLimiter);
app.use('/api/v1/public/', holdLimiter);

// ============================================
// Health Check
// ============================================

app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || '1.0.0',
    phase: 5,
  });
});

// ============================================
// API Routes (v1) - Authenticated
// ============================================

app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/tenant', tenantRoutes);
app.use('/api/v1/users', userRoutes);
app.use('/api/v1/floor-plans', floorPlanRoutes);
app.use('/api/v1/tables', tableStatusRoutes);
app.use('/api/v1/config', configRoutes);
app.use('/api/v1/reservations', reservationRoutes);
app.use('/api/v1/guests', guestRoutes);
app.use('/api/v1/waitlist', waitlistRoutes);
app.use('/api/v1/payments', paymentRoutes);

// ============================================
// API Routes (v1) - Public (Booking Widget)
// ============================================

app.use('/api/v1/public', publicBookingRoutes);
app.use('/api/v1/public', publicAvailabilityRoutes);

// ============================================
// 404 + Error Handler
// ============================================

app.use((_req, res) => {
  res.status(404).json({
    error: 'NotFoundError',
    message: 'The requested endpoint does not exist',
    statusCode: 404,
  });
});

app.use(errorHandler);

export default app;
