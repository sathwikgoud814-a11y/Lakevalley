// Express server entry point
// Feature: stadium-box-booking-platform

import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

import slotsRouter from './routes/slots.js';
import bookingsRouter from './routes/bookings.js';
import paymentsRouter from './routes/payments.js';
import adminRouter from './routes/admin.js';
import reviewsRouter from './routes/reviews.js';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';

const __dirname = dirname(fileURLToPath(import.meta.url));

const {
  WHATSAPP_API_TOKEN,
  OWNER_PHONE,
  UPI_ID,
  UPI_NAME,
  PORT = 3000,
} = process.env;

if (!WHATSAPP_API_TOKEN) {
  console.warn('Warning: WHATSAPP_API_TOKEN is not set — WhatsApp confirmations will be skipped.');
}

const app = express();

app.use(helmet({ contentSecurityPolicy: false })); // Apply security headers, tune CSP later if needed
app.use(cors({ origin: process.env.ALLOWED_ORIGIN || 'http://localhost:3000' }));
app.use(express.json());
app.use(express.urlencoded({ extended: false })); // parse login form POST

// Serve frontend static files
app.use(express.static(join(__dirname, '../public')));
app.use('/src', express.static(join(__dirname, '../public/src'))); // Restored to prevent app breakage

app.get('/api/config', (req, res) => {
  res.json({
    upiId: UPI_ID || '7981149863@ptaxis',
    upiName: UPI_NAME || 'Lake Valley Box Stadium'
  });
});

const bookingLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 10 });
app.post('/api/bookings/initiate', bookingLimiter);
app.use('/api/bookings', bookingsRouter);

const reviewLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 5 });
app.post('/api/reviews', reviewLimiter);
app.use('/api/reviews', reviewsRouter);

app.use('/api/slots', slotsRouter);
app.use('/api/payments', paymentsRouter);

const loginLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 5, message: 'Too many login attempts' });
app.use('/admin/login', loginLimiter);
app.use('/admin', adminRouter);

if (!process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`THE STADIUM BOX server running on port ${PORT}`);
  });
}

export default app;
