// Bootstrap module — wiring and scroll helpers
// Feature: stadium-box-booking-platform
// Requirements: 1.6, 3.4, 3.5, 4.7, 8.3, 9.6

import { SlotGrid } from './slots.js';
import { BookingFlow } from './booking.js';
import { ConfirmationView } from './confirmation.js';
import { initReviews } from './reviews.js';
import { initCricketGame } from './cricketGame.js';

export function scrollToSlots() {
  document.getElementById('slots')?.scrollIntoView({ behavior: 'smooth' });
}

/** Show or hide the offline banner. */
function setOfflineBanner(offline) {
  let banner = document.getElementById('offline-banner');
  if (offline) {
    if (!banner) {
      banner = document.createElement('div');
      banner.id = 'offline-banner';
      banner.className = 'offline-banner';
      banner.setAttribute('role', 'alert');
      banner.textContent = 'You appear to be offline. Please check your connection.';
      document.body.prepend(banner);
    }
  } else {
    banner?.remove();
  }
}

function bootstrap() {
  // ── Offline detection ──────────────────────────────────────
  if (navigator.onLine === false) setOfflineBanner(true);
  window.addEventListener('offline', () => setOfflineBanner(true));
  window.addEventListener('online', () => setOfflineBanner(false));

  // ── CTA scroll wiring ──────────────────────────────────────
  document.getElementById('hero-cta')?.addEventListener('click', (e) => {
    e.preventDefault();
    scrollToSlots();
  });

  // Sticky CTA: scroll to slots if none selected, open payment modal if slots are selected
  const ctaBarBtn = document.getElementById('cta-bar-btn');
  if (ctaBarBtn) ctaBarBtn.textContent = '🏏 LOCK YOUR SLOT'; // ensure default on load

  ctaBarBtn?.addEventListener('click', () => {
    if (slotGrid.selectedIds.length > 0) {
      bookingFlow.openModal();
    } else {
      scrollToSlots();
    }
  });

  // ── Instantiate modules ────────────────────────────────────
  const slotsSection = document.getElementById('slots');
  const bookingSection = document.getElementById('booking');

  const slotGrid = new SlotGrid(slotsSection);
  const bookingFlow = new BookingFlow(bookingSection);
  const confirmationView = new ConfirmationView(bookingFlow);

  // Fetch today's slots and start polling
  const today = new Date().toISOString().slice(0, 10);
  slotGrid.fetch(today);
  slotGrid.startPolling(today);

  // ── slotsSelected → advance booking stepper ──────────────
  // BookingFlow listens for slotsSelected internally.
  document.addEventListener('slotsSelected', () => {
    // intentionally no auto-scroll
  });

  // ── Hide sticky CTA bar once booking modal opens ──────────
  document.addEventListener('bookingModalOpen', () => {
    document.getElementById('cta-bar')?.classList.add('booking-active');
  });
  document.addEventListener('bookingModalClose', () => {
    document.getElementById('cta-bar')?.classList.remove('booking-active');
  });
  // ── proceedToPayment → initiate booking, show UPI panel ──
  document.addEventListener('proceedToPayment', async (e) => {
    const { slots, customerName, customerPhone, amount } = e.detail;
    const date = slots[0]?.date ?? new Date().toISOString().slice(0, 10);

    try {
      const { initiateBooking } = await import('./api.js');
      const { orderId } = await initiateBooking({
        slotIds: slots.map((s) => s.id),
        date,
        customerName,
        customerPhone,
        amount,
      });
      // Now we have the orderId — store it and advance modal to payment step
      bookingFlow._pendingOrderId = orderId;
      bookingFlow._pendingAmount  = amount;
      bookingFlow._setModalStep(2);
    } catch (err) {
      // Re-enable the button and show error in modal
      const btn = bookingFlow._modal?.querySelector('.modal__btn');
      if (btn) { btn.disabled = false; btn.textContent = 'Continue to Payment →'; }
      bookingFlow._showModalError(err.message || 'Unable to initiate booking. Please try again.');
    }
  });

  // ── upiConfirm → verify payment ───────────────────────────
  document.addEventListener('upiConfirm', async (e) => {
    const { orderId, utr } = e.detail;
    try {
      const { verifyPayment } = await import('./api.js');
      const booking = await verifyPayment({
        razorpay_order_id:   orderId,
        razorpay_payment_id: utr,
        razorpay_signature:  'upi_manual',
      });
      document.dispatchEvent(new CustomEvent('paymentVerified', { detail: booking }));
    } catch (err) {
      document.dispatchEvent(new CustomEvent('paymentFailed', { detail: { error: err.message } }));
    }
  });

  // ── paymentVerified → show confirmation ───────────────────
  document.addEventListener('paymentVerified', (e) => {
    confirmationView.render(e.detail);
    // Mark confirmed slots as booked immediately + re-fetch server state
    const confirmedSlotIds = e.detail?.slotIds ?? [];
    slotGrid.markBookedAndRefresh(confirmedSlotIds);
    // Reset CTA bar text
    const btn = document.getElementById('cta-bar-btn');
    if (btn) btn.textContent = '🏏 LOCK YOUR SLOT';
    document.getElementById('cta-bar')?.classList.add('booking-active');
  });

  // ── paymentFailed → back to Step 2 with error ─────────────
  document.addEventListener('paymentFailed', (e) => {
    bookingFlow.advanceTo(2);
    const msg = e.detail?.error || 'Payment failed. Please try again.';
    bookingFlow.showPaymentError(msg);
    _showPaymentError(bookingSection, msg);
  });
}

/**
 * Display a payment error message inside the booking section.
 * @param {HTMLElement} container
 * @param {string} message
 */
function _showPaymentError(container, message) {
  if (!container) return;
  let errEl = container.querySelector('.payment-error-msg');
  if (!errEl) {
    errEl = document.createElement('p');
    errEl.className = 'payment-error-msg';
    errEl.setAttribute('role', 'alert');
    container.appendChild(errEl);
  }
  errEl.textContent = message;
  errEl.hidden = false;
}

// ── Slot micro-interactions ────────────────────────────────
function initSlotInteractions() {
  // Delegate click on slot grid — add pulse class then remove
  document.addEventListener('click', (e) => {
    const cell = e.target.closest('.slot-cell:not(:disabled)');
    if (!cell) return;
    cell.classList.remove('slot-cell--pulse');
    // Force reflow to restart animation
    void cell.offsetWidth;
    cell.classList.add('slot-cell--pulse');
    cell.addEventListener('animationend', () => {
      cell.classList.remove('slot-cell--pulse');
    }, { once: true });
  });

  // Update CTA bar text when slots are selected
  document.addEventListener('slotsSelected', (e) => {
    const slots = e.detail?.slots ?? [];
    const count = slots.length;
    const total = slots.reduce((sum, s) => sum + (s.price ?? 600), 0);
    const btn = document.getElementById('cta-bar-btn');
    if (!btn) return;
    btn.textContent = count > 0
      ? `✅ Confirm Your Game · ₹${total}`
      : '🏏 LOCK YOUR SLOT';
  });
}

// ── Theme toggle ───────────────────────────────────────────
function initThemeToggle() {
  const btn = document.getElementById('theme-toggle');
  if (!btn) return;

  // Restore saved preference
  const saved = localStorage.getItem('theme');
  if (saved === 'light') document.documentElement.classList.add('light');

  btn.addEventListener('click', () => {
    const isLight = document.documentElement.classList.toggle('light');
    localStorage.setItem('theme', isLight ? 'light' : 'dark');
    btn.setAttribute('aria-label', isLight ? 'Switch to dark mode' : 'Switch to light mode');
  });
}

/** Simulate scarcity/urgency data */
function initDynamicUrgency() {
  const recentEl = document.getElementById('recent-bookings-count');
  const leftEl   = document.getElementById('slots-left-count');
  if (!recentEl || !leftEl) return;

  // Base numbers
  let recent = 12 + Math.floor(Math.random() * 8);
  let left   = 3 + Math.floor(Math.random() * 4);

  recentEl.textContent = `${recent} players`;
  leftEl.textContent   = `${left} slots`;

  // Subtle updates every 30s
  setInterval(() => {
    if (Math.random() > 0.7) {
      recent++;
      recentEl.textContent = `${recent} players`;
      recentEl.parentElement.classList.add('pulse-text');
      setTimeout(() => recentEl.parentElement.classList.remove('pulse-text'), 2000);
    }
  }, 30000);
}

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      bootstrap();
      initCricketGame();
      initSlotInteractions();
      initReviews();
      initReveal();
      initThemeToggle();
      initDynamicUrgency();
    });
  } else {
    bootstrap();
    initCricketGame();
    initSlotInteractions();
    initReviews();
    initReveal();
    initThemeToggle();
    initDynamicUrgency();
  }
}

// ── Scroll reveal ──────────────────────────────────────────
function initReveal() {
  const els = document.querySelectorAll('[data-reveal]');
  if (!els.length) return;
  const io = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry, i) => {
        if (entry.isIntersecting) {
          // Stagger siblings in the same parent
          const siblings = [...entry.target.parentElement.querySelectorAll('[data-reveal]')];
          const idx = siblings.indexOf(entry.target);
          entry.target.style.transitionDelay = `${idx * 0.08}s`;
          entry.target.classList.add('is-visible');
          io.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.12 }
  );
  els.forEach((el) => io.observe(el));
}
