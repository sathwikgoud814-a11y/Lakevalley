// server/whatsapp.js — WhatsApp notification via wa.me link + optional Business API
// Feature: stadium-box-booking-platform

const OWNER_PHONE = (process.env.OWNER_PHONE ?? '').replace(/\D/g, '');

/**
 * Build a pre-filled WhatsApp message URL for the owner.
 * Opens wa.me with booking details pre-typed — no API needed.
 */
function buildOwnerWaLink(booking) {
  const slots = (booking.slotIds ?? [booking.slotId]).join(', ');
  const msg = [
    `🏏 *New Booking Alert*`,
    `Booking ID: ${booking.bookingId}`,
    `Customer: ${booking.customerName} (${booking.customerPhone})`,
    `Date: ${booking.date}`,
    `Slots: ${slots}`,
    `Advance Paid: ₹${booking.amountPaid}`,
    `UTR / Txn ID: ${booking.utrNumber ?? 'N/A'}`,
    `Balance Due: ₹${booking.balanceDue}`,
  ].join('\n');

  return `https://wa.me/${OWNER_PHONE}?text=${encodeURIComponent(msg)}`;
}

/**
 * Build a pre-filled WhatsApp message URL for the customer.
 */
function buildCustomerWaLink(booking) {
  const phone = booking.customerPhone.replace(/\D/g, '');
  const msg = [
    `✅ *Booking Confirmed — Lake Valley Box Stadium*`,
    `Booking ID: ${booking.bookingId}`,
    `Date: ${booking.date}`,
    `Advance Paid: ₹${booking.amountPaid}`,
    `Balance Due at Venue: ₹${booking.balanceDue}`,
    `See you on the field! 🏏`,
  ].join('\n');

  return `https://wa.me/${phone}?text=${encodeURIComponent(msg)}`;
}

/**
 * Log booking to console and return wa.me links.
 * Call this after a booking is confirmed.
 */
function sendConfirmation(booking) {
  const ownerLink  = buildOwnerWaLink(booking);
  const customerLink = buildCustomerWaLink(booking);

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`📋 BOOKING CONFIRMED: ${booking.bookingId}`);
  console.log(`👤 ${booking.customerName} | ${booking.customerPhone}`);
  console.log(`📅 ${booking.date} | Slots: ${(booking.slotIds ?? []).join(', ')}`);
  console.log(`💰 Paid: ₹${booking.amountPaid} | UTR: ${booking.utrNumber ?? 'N/A'}`);
  console.log(`📱 Notify owner: ${ownerLink}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  // Store links on booking object so the API response can include them
  booking.ownerWaLink    = ownerLink;
  booking.customerWaLink = customerLink;

  return Promise.resolve({ ownerLink, customerLink });
}

export { sendConfirmation, buildOwnerWaLink, buildCustomerWaLink };
