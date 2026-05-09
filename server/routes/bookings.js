// Route: POST /api/bookings/initiate, GET /api/bookings/:id
// Feature: stadium-box-booking-platform — UPI manual payment flow

import { Router } from 'express';
import { lockSlot, releaseSlot, DEFAULT_SLOTS, SLOT_PRICES } from '../slotStore.js';
import { bookings } from '../bookingStore.js';
import { requireApiAuth } from '../auth.js';

const router = Router();

const E164_REGEX = /^\+[1-9]\d{6,14}$/;

/** Full slot price (paid upfront) */
function slotPrice(slotId) {
  const slot = DEFAULT_SLOTS.find((s) => s.id === slotId);
  if (!slot) return 600;
  return SLOT_PRICES[slot.category] ?? slot.price;
}

// POST /api/bookings/initiate
router.post('/initiate', async (req, res) => {
  const { slotIds, date, customerName, customerPhone } = req.body;

  // Accept slotIds[] (multi) or legacy slotId (single)
  const ids = slotIds ?? (req.body.slotId ? [req.body.slotId] : null);

  if (!ids?.length || !date || !customerName || !customerPhone) {
    return res.status(400).json({ error: 'Missing required fields: slotIds, date, customerName, customerPhone' });
  }

  if (ids.length > 8) {
    return res.status(400).json({ error: 'Maximum 8 slots per booking.' });
  }

  if (!E164_REGEX.test(customerPhone)) {
    // Auto-fix: prepend +91 for 10-digit Indian numbers
    const fixed = customerPhone.replace(/\D/g, '');
    if (fixed.length === 10) {
      req.body.customerPhone = `+91${fixed}`;
    } else if (fixed.length === 12 && fixed.startsWith('91')) {
      req.body.customerPhone = `+${fixed}`;
    } else {
      return res.status(400).json({ error: 'customerPhone must be in E.164 format (e.g. +919876543210)' });
    }
  }

  const tempBookingId = crypto.randomUUID();

  // Lock all slots atomically — roll back on any failure
  const locked = [];
  for (const slotId of ids) {
    const ok = await lockSlot(date, slotId, tempBookingId, 600);
    if (!ok) {
      for (const lockedId of locked) await releaseSlot(date, lockedId);
      return res.status(409).json({ error: `Slot ${slotId} is no longer available` });
    }
    locked.push(slotId);
  }

  // Full upfront payment — sum of all slot prices
  const slotPrices = Object.fromEntries(ids.map((id) => [id, slotPrice(id)]));
  const amount     = ids.reduce((sum, id) => sum + slotPrices[id], 0);
  const lockExpiresAt = new Date(Date.now() + 600_000).toISOString();

  await bookings.set(tempBookingId, {
    bookingId:      tempBookingId,
    slotIds:        ids,
    slotPrices,
    date,
    customerName,
    customerPhone,
    razorpayOrderId: tempBookingId,
    amount,
    status:    'pending',
    createdAt: new Date().toISOString(),
  });

  return res.status(200).json({
    orderId: tempBookingId,
    amount,
    currency: 'INR',
    lockExpiresAt,
  });
});

// GET /api/bookings/:id
router.get('/:id', requireApiAuth, async (req, res) => {
  const booking = await bookings.get(req.params.id);
  if (!booking) return res.status(404).json({ error: 'Not found' });
  return res.json(booking);
});

export { bookings };
export default router;
