// Route: GET /api/slots
// Feature: stadium-box-booking-platform
// Requirements: 2.1, 10.3

import { Router } from 'express';
import { getSlots } from '../slotStore.js';

const router = Router();

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

// GET /api/slots?date=YYYY-MM-DD
router.get('/', async (req, res) => {
  const { date } = req.query;

  if (!date || !DATE_REGEX.test(date)) {
    return res.status(400).json({ error: 'Missing or malformed date. Expected format: YYYY-MM-DD' });
  }

  const slots = await getSlots(date);
  return res.json({ date, slots });
});

export default router;
