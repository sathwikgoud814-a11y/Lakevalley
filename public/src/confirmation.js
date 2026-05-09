// ConfirmationView module
// Feature: stadium-box-booking-platform
// Requirements: 4.8, 5.5

export class ConfirmationView {
  /**
   * @param {import('./booking.js').BookingFlow} bookingFlow
   */
  constructor(bookingFlow) {
    this._bookingFlow = bookingFlow;
  }

  /**
   * Render the post-payment success screen.
   * Advances the stepper to Step 3 and displays booking details.
   *
   * @param {{ bookingId: string, slotId: string, date: string, customerName: string, amountPaid: number, balanceDue: number }} booking
   */
  render(booking) {
    // Advance stepper to Step 3
    this._bookingFlow.advanceTo(3);

    // Find or create the confirmation panel inside #booking
    const bookingSection = document.querySelector('#booking');
    if (!bookingSection) return;

    // Remove any existing confirmation panel
    const existing = bookingSection.querySelector('.confirmation-panel');
    if (existing) existing.remove();

    const panel = document.createElement('div');
    panel.className = 'confirmation-panel';

    // Success icon
    const icon = document.createElement('div');
    icon.className = 'confirmation-panel__icon';
    icon.setAttribute('aria-hidden', 'true');
    icon.textContent = '✓';
    panel.appendChild(icon);

    // Friendly tagline
    const tagline = document.createElement('p');
    tagline.className = 'confirmation-panel__tagline';
    tagline.textContent = "You're all set. See you on the field! 🏏";
    panel.appendChild(tagline);

    // Booking ID
    const bookingIdEl = document.createElement('p');
    bookingIdEl.className = 'confirmation-panel__booking-id';
    bookingIdEl.textContent = `Booking ID: ${booking.bookingId}`;
    panel.appendChild(bookingIdEl);

    // WhatsApp notice
    const notice = document.createElement('p');
    notice.className = 'confirmation-panel__whatsapp-notice';
    notice.textContent = '📱 Check WhatsApp for confirmation';
    panel.appendChild(notice);

    // UTR reference
    if (booking.utrNumber) {
      const utr = document.createElement('p');
      utr.className = 'confirmation-panel__utr';
      utr.innerHTML = `UTR Reference: <strong>${booking.utrNumber}</strong>`;
      panel.appendChild(utr);
    }

    // Tap to notify owner via WhatsApp
    if (booking.ownerWaLink) {
      const waBtn = document.createElement('a');
      waBtn.href = booking.ownerWaLink;
      waBtn.target = '_blank';
      waBtn.rel = 'noopener';
      waBtn.className = 'confirmation-panel__wa-btn';
      waBtn.textContent = '📲 Tap to notify owner on WhatsApp';
      panel.appendChild(waBtn);
    }

    // Verification note
    const verifyNote = document.createElement('p');
    verifyNote.className = 'confirmation-panel__verify-note';
    verifyNote.textContent = '⏳ Your booking will be confirmed once payment is verified by our team (usually within 15 minutes).';
    panel.appendChild(verifyNote);

    // UTR reference
    if (booking.utrNumber) {
      const utr = document.createElement('p');
      utr.className = 'confirmation-panel__balance';
      utr.textContent = `UTR Ref: ${booking.utrNumber}`;
      panel.appendChild(utr);
    }

    // Balance due
    const balance = document.createElement('p');
    balance.className = 'confirmation-panel__balance';
    balance.textContent = `Balance due at venue: ₹${booking.balanceDue}`;
    panel.appendChild(balance);

    // Append after the booking-flow card
    const flowCard = bookingSection.querySelector('.booking-flow');
    if (flowCard) {
      flowCard.style.display = 'none'; // hide the inline stepper to immediately show success
      flowCard.after(panel);
    } else {
      bookingSection.appendChild(panel);
    }
  }
}
