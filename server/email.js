import nodemailer from 'nodemailer';
import { DEFAULT_SLOTS } from './slotStore.js';

/**
 * Send an email notification to the owner when a booking is confirmed.
 * @param {Object} booking - The confirmed booking object.
 */
export async function sendOwnerEmailNotification(booking) {
  const {
    EMAIL_HOST,
    EMAIL_PORT,
    EMAIL_USER,
    EMAIL_PASS,
    OWNER_EMAIL
  } = process.env;

  // Only proceed if email configuration is present
  if (!EMAIL_HOST || !EMAIL_USER || !EMAIL_PASS || !OWNER_EMAIL) {
    console.error('[Email] CRITICAL: Mandatory notification skipped due to missing configuration in .env');
    return;
  }

  const transporter = nodemailer.createTransport({
    host: EMAIL_HOST,
    port: parseInt(EMAIL_PORT || '587'),
    secure: parseInt(EMAIL_PORT || '587') === 465, // true for 465, false for others
    auth: {
      user: EMAIL_USER,
      pass: EMAIL_PASS,
    },
  });

  const slotLabels = (booking.slotIds ?? [booking.slotId])
    .map(id => {
      const slot = DEFAULT_SLOTS.find(s => s.id === id);
      return slot ? slot.label : id;
    })
    .join(', ');
  
  const mailOptions = {
    from: `"TSB Booking" <${EMAIL_USER}>`,
    to: OWNER_EMAIL,
    subject: `🏏 New Booking Confirmed: ${booking.bookingId}`,
    text: `
New Booking Alert - The Stadium Box

Booking Details:
----------------
Booking ID:     ${booking.bookingId}
Customer Name:  ${booking.customerName}
Phone Number:   ${booking.customerPhone}
Booking Date:   ${booking.date}
Slots:          ${slotLabels}
Advance Paid:   ₹${booking.amountPaid}
UTR / Txn ID:   ${booking.utrNumber ?? 'N/A'}
Balance Due:    ₹${booking.balanceDue}

Please verify the payment in your bank account.
    `,
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px;">
        <h2 style="color: #1a73e8; margin-bottom: 20px;">🏏 New Booking Alert</h2>
        <p>A new booking has been confirmed at <strong>The Stadium Box</strong>.</p>
        
        <div style="background-color: #f8f9fa; padding: 15px; border-radius: 4px; margin: 20px 0;">
          <h3 style="margin-top: 0; font-size: 16px; border-bottom: 1px solid #ddd; padding-bottom: 5px;">Booking Details</h3>
          <table style="width: 100%; border-collapse: collapse;">
            <tr><td style="padding: 5px 0;"><strong>Booking ID:</strong></td><td>${booking.bookingId}</td></tr>
            <tr><td style="padding: 5px 0;"><strong>Customer:</strong></td><td>${booking.customerName} (${booking.customerPhone})</td></tr>
            <tr><td style="padding: 5px 0;"><strong>Date:</strong></td><td>${booking.date}</td></tr>
            <tr><td style="padding: 5px 0;"><strong>Slots (Timings):</strong></td><td>${slotLabels}</td></tr>
            <tr><td style="padding: 5px 0;"><strong>Paid:</strong></td><td>₹${booking.amountPaid}</td></tr>
            <tr><td style="padding: 5px 0;"><strong>UTR:</strong></td><td>${booking.utrNumber ?? 'N/A'}</td></tr>
            <tr><td style="padding: 5px 0;"><strong>Balance:</strong></td><td>₹${booking.balanceDue}</td></tr>
          </table>
        </div>
        
        <p style="color: #666; font-size: 14px;">Please verify the payment in your dashboard or bank account.</p>
      </div>
    `,
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log(`[Email] Notification sent to owner: ${info.messageId}`);
    return info;
  } catch (error) {
    console.error('[Email] Failed to send notification to owner:', error);
    throw error;
  }
}

export default sendOwnerEmailNotification;
