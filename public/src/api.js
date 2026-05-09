// API client module
// Feature: stadium-box-booking-platform
// Requirements: 10.1

const BASE_URL = '';

/**
 * Thin fetch wrapper that throws a structured error for non-2xx responses.
 * @param {string} url
 * @param {RequestInit} [options]
 * @returns {Promise<any>}
 */
async function request(url, options = {}) {
  const response = await fetch(BASE_URL + url, {
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options,
  });

  if (!response.ok) {
    let message = response.statusText;
    try {
      const body = await response.json();
      if (body.error) message = body.error;
      else if (body.message) message = body.message;
    } catch {
      // ignore JSON parse errors; use statusText
    }
    const err = new Error(message);
    err.status = response.status;
    err.message = message;
    throw err;
  }

  return response.json();
}

/**
 * Fetch available slots for a given date.
 * GET /api/slots?date=YYYY-MM-DD
 * Response: { date, slots: [{ id, label, category, status }] }
 *
 * @param {string} date - ISO date string "YYYY-MM-DD"
 * @returns {Promise<{ date: string, slots: Array<{ id: string, label: string, category: string, status: string }> }>}
 */
export function getSlots(date) {
  return request(`/api/slots?date=${encodeURIComponent(date)}&_t=${Date.now()}`);
}

/**
 * Initiate a booking and lock the slot.
 * POST /api/bookings/initiate
 * Request:  { slotId, date, customerName, customerPhone }
 * Response: { orderId, amount, currency, lockExpiresAt }
 *
 * @param {{ slotId: string, date: string, customerName: string, customerPhone: string }} payload
 * @returns {Promise<{ orderId: string, amount: number, currency: string, lockExpiresAt: string }>}
 */
export function initiateBooking(payload) {
  return request('/api/bookings/initiate', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

/**
 * Verify a Razorpay payment and confirm the booking.
 * POST /api/payments/verify
 * Request:  { razorpay_order_id, razorpay_payment_id, razorpay_signature }
 * Response: { bookingId, slotId, date, customerName, amountPaid, balanceDue }
 *
 * @param {{ razorpay_order_id: string, razorpay_payment_id: string, razorpay_signature: string }} payload
 * @returns {Promise<{ bookingId: string, slotId: string, date: string, customerName: string, amountPaid: number, balanceDue: number }>}
 */
export function verifyPayment(payload) {
  return request('/api/payments/verify', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

/**
 * Retrieve a confirmed booking by ID.
 * GET /api/bookings/:id
 *
 * @param {string} id - Booking ID (e.g. "TSB-20250115-0001")
 * @returns {Promise<object>}
 */
export function getBooking(id) {
  return request(`/api/bookings/${encodeURIComponent(id)}`);
}
