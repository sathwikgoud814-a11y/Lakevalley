// Route: POST /api/payments/verify
// Feature: stadium-box-booking-platform
// Requirements: 4.6, 4.7, 4.8

import { Router } from 'express';
import crypto from 'crypto';
import { confirmSlot } from '../slotStore.js';
import { bookings } from '../bookingStore.js';

const router = Router();
const TEST_MODE = process.env.RAZORPAY_KEY_ID?.startsWith('rzp_test_placeholder');

// Per-date sequential counter for Booking_ID generation (TSB-YYYYMMDD-NNNN)
const bookingCounters = new Map();

/**
 * Generate a unique Booking_ID in the format TSB-YYYYMMDD-NNNN.
 * Counter is per-date and zero-padded to 4 digits.
 * @param {string} date  YYYY-MM-DD
 * @returns {string}
 */
function generateBookingId(date) {
  const datePart = date.replace(/-/g, ''); // YYYYMMDD
  const current = bookingCounters.get(datePart) ?? 0;
  const next = current + 1;
  bookingCounters.set(datePart, next);
  return `TSB-${datePart}-${String(next).padStart(4, '0')}`;
}

// Lazy-load WhatsApp sender — non-blocking, best-effort
let sendConfirmation = null;
import('../whatsapp.js')
  .then((mod) => { sendConfirmation = mod.sendConfirmation ?? mod.default; })
  .catch(() => { /* whatsapp.js not available — confirmations skipped */ });

// Lazy-load Email sender
let sendEmail = null;
import('../email.js')
  .then((mod) => { sendEmail = mod.sendOwnerEmailNotification ?? mod.default; })
  .catch(() => { /* email.js not available — notifications skipped */ });

// POST /api/payments/verify
router.post('/verify', async (req, res) => {
  const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

  if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
    return res.status(400).json({ error: 'Missing required fields: razorpay_order_id, razorpay_payment_id, razorpay_signature' });
  }

  // Validate HMAC-SHA256 signature (skipped in test/placeholder mode or manual UPI)
  if (!TEST_MODE && razorpay_signature !== 'upi_manual') {
    const expectedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET ?? '')
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest('hex');

    if (expectedSignature !== razorpay_signature) {
      return res.status(400).json({ error: 'Invalid payment signature' });
    }
  }

  // Look up the pending booking by razorpay_order_id
  const booking = await bookings.findByField('razorpayOrderId', razorpay_order_id);

  if (!booking) {
    return res.status(404).json({ error: 'Booking not found for this order' });
  }

  // Generate confirmed Booking_ID (TSB-YYYYMMDD-NNNN)
  const bookingId = generateBookingId(booking.date);

  // Confirm all slots in slot store
  const slotIds = booking.slotIds ?? (booking.slotId ? [booking.slotId] : []);
  for (const slotId of slotIds) {
    await confirmSlot(booking.date, slotId, bookingId);
  }

  // Full upfront payment — amount paid = total price, no balance due
  const amountPaid = booking.amount;
  const balanceDue = 0;

  // Update booking record in-place
  booking.bookingId = bookingId;
  booking.status = 'confirmed';
  booking.utrNumber = razorpay_payment_id; // store UTR for manual verification
  booking.razorpayPaymentId = razorpay_payment_id;
  booking.amountPaid = amountPaid;
  booking.balanceDue = balanceDue;

  // Re-key the booking under its confirmed ID, remove the temp key
  const tempKey = booking.razorpayOrderId;
  await bookings.delete(tempKey);
  await bookings.set(bookingId, booking);

  // Log UTR for owner verification
  console.log(`[Booking] ${bookingId} | UTR: ${razorpay_payment_id} | Customer: ${booking.customerName} | ${booking.customerPhone} | ₹${amountPaid}`);

  // Trigger WhatsApp confirmation — async, non-blocking
  if (typeof sendConfirmation === 'function') {
    sendConfirmation(booking).catch((err) => {
      console.error('[WhatsApp] Failed to send confirmation for', bookingId, err);
    });
  }

  // Mandatory Email notification — await completion
  if (typeof sendEmail === 'function') {
    try {
      await sendEmail(booking);
    } catch (err) {
      console.error('[Email] CRITICAL: Failed to send mandatory notification for', bookingId, err);
      // Note: We still return success since payment was verified, but log the critical failure
    }
  }

  return res.status(200).json({
    bookingId,
    slotIds,
    date: booking.date,
    customerName: booking.customerName,
    utrNumber: razorpay_payment_id,
    amountPaid,
    balanceDue,
    ownerWaLink:    booking.ownerWaLink,
    customerWaLink: booking.customerWaLink,
  });
});

export { generateBookingId, bookingCounters };
export default router;
