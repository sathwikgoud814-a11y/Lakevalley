// PaymentHandler — UPI QR + deep link (no Razorpay SDK needed)
// Feature: stadium-box-booking-platform

import { verifyPayment } from './api.js';

const UPI_ID   = '7981149863@ptaxis';
const UPI_NAME = 'Lake Valley Box Stadium';

/**
 * Build a UPI deep link for the given amount.
 * @param {number} amount  rupees (not paise)
 * @param {string} note    transaction note
 */
function buildUpiLink(amount, note) {
  const params = new URLSearchParams({
    pa: UPI_ID,
    pn: UPI_NAME,
    am: String(amount),
    cu: 'INR',
    tn: note,
  });
  return `upi://pay?${params.toString()}`;
}

/**
 * Build a QR code image URL using the free qrserver.com API.
 * @param {string} data  content to encode
 * @param {number} size  pixel size
 */
function buildQrUrl(data, size = 220) {
  return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(data)}`;
}

export class PaymentHandler {
  /**
   * Show the UPI payment UI inside the modal body.
   * Resolves when the user submits a UTR and the booking is confirmed.
   *
   * @param {string} orderId       - from /api/bookings/initiate
   * @param {string} customerName
   * @param {string} customerPhone
   * @param {number} amount        - rupees
   */
  async open(orderId, customerName, customerPhone, amount = 250) {
    // Inject the UPI payment panel into the modal body (step 2)
    const modalBody = document.querySelector('.modal__body');
    if (!modalBody) return;

    modalBody.innerHTML = '';

    const upiLink = buildUpiLink(amount, `Slot Booking - ${customerName}`);
    const qrUrl   = buildQrUrl(upiLink);

    // ── QR panel ──────────────────────────────────────────
    const panel = document.createElement('div');
    panel.className = 'upi-panel';

    // Amount
    const amtEl = document.createElement('p');
    amtEl.className = 'upi-panel__amount';
    amtEl.innerHTML = `Pay <strong>₹${amount}</strong> advance`;
    panel.appendChild(amtEl);

    // QR image
    const qrWrap = document.createElement('div');
    qrWrap.className = 'upi-panel__qr-wrap';
    const qrImg = document.createElement('img');
    qrImg.src = qrUrl;
    qrImg.alt = `UPI QR code — scan to pay ₹${amount} to ${UPI_ID}`;
    qrImg.width = 200;
    qrImg.height = 200;
    qrImg.className = 'upi-panel__qr';
    qrWrap.appendChild(qrImg);
    panel.appendChild(qrWrap);

    // UPI ID text
    const upiIdEl = document.createElement('p');
    upiIdEl.className = 'upi-panel__upi-id';
    upiIdEl.textContent = UPI_ID;
    panel.appendChild(upiIdEl);

    // "Open in UPI app" button (deep link — works on mobile)
    const deepLinkBtn = document.createElement('a');
    deepLinkBtn.href = upiLink;
    deepLinkBtn.className = 'upi-panel__deeplink-btn';
    deepLinkBtn.textContent = '📱 Pay via GPay / PhonePe / Paytm';
    panel.appendChild(deepLinkBtn);

    // Divider
    const divider = document.createElement('p');
    divider.className = 'upi-panel__divider';
    divider.textContent = 'After paying, enter your transaction ID below';
    panel.appendChild(divider);

    // UTR input
    const utrGroup = document.createElement('div');
    utrGroup.className = 'modal__form-group';
    const utrLabel = document.createElement('label');
    utrLabel.className = 'modal__label';
    utrLabel.setAttribute('for', 'utr-input');
    utrLabel.textContent = 'UPI Transaction ID (UTR)';
    const utrInput = document.createElement('input');
    utrInput.type = 'text';
    utrInput.className = 'modal__input';
    utrInput.id = 'utr-input';
    utrInput.placeholder = 'e.g. 123456789012';
    utrInput.autocomplete = 'off';
    utrGroup.appendChild(utrLabel);
    utrGroup.appendChild(utrInput);
    panel.appendChild(utrGroup);

    // Confirm button
    const confirmBtn = document.createElement('button');
    confirmBtn.type = 'button';
    confirmBtn.className = 'modal__btn';
    confirmBtn.textContent = 'Confirm Booking';
    panel.appendChild(confirmBtn);

    // Error
    const errEl = document.createElement('p');
    errEl.className = 'modal__error';
    errEl.id = 'upi-error';
    errEl.hidden = true;
    panel.appendChild(errEl);

    modalBody.appendChild(panel);

    // ── Confirm handler ───────────────────────────────────
    confirmBtn.addEventListener('click', async () => {
      const utr = utrInput.value.trim();
      if (!utr) {
        errEl.textContent = 'Please enter your UPI transaction ID.';
        errEl.hidden = false;
        return;
      }

      confirmBtn.disabled = true;
      confirmBtn.textContent = 'Verifying…';
      errEl.hidden = true;

      try {
        const booking = await verifyPayment({
          razorpay_order_id:  orderId,
          razorpay_payment_id: utr,
          razorpay_signature: 'upi_manual',
        });
        document.dispatchEvent(new CustomEvent('paymentVerified', { detail: booking }));
      } catch (err) {
        errEl.textContent = err.message || 'Verification failed. Please try again.';
        errEl.hidden = false;
        confirmBtn.disabled = false;
        confirmBtn.textContent = 'Confirm Booking';
        document.dispatchEvent(new CustomEvent('paymentFailed', { detail: { error: err.message } }));
      }
    });
  }
}
