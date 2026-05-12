// BookingFlow — modal with 3-step progress bar
// Feature: stadium-box-booking-platform

const STEP_LABELS = ['Details', 'Payment', 'Success'];

/** Full price for a slot based on its category */
function slotTotalPrice(slot) {
  if (slot?.category === 'Night') return 400;
  return 300; // Day
}

/** Total amount to pay upfront for all selected slots */
function totalAmount(slots) {
  return slots.reduce((sum, s) => sum + (s.price ?? slotTotalPrice(s)), 0);
}

export class BookingFlow {
  constructor(container) {
    this._container = container;
    this._activeStep = 1;
    this._completedSteps = new Set();
    this._slots = [];
    this._customerName = '';
    this._customerPhone = '';
    this._modal = null;
    this._modalStep = 0; // 0=closed, 1=details, 2=payment, 3=success

    this._renderInlineStepper();
    this._listenForSlotsSelected();
  }

  // ── Public API ────────────────────────────────────────────

  advanceTo(step) {
    if (step < 1 || step > 3) return;
    for (let i = 1; i < step; i++) this._completedSteps.add(i);
    this._activeStep = step;
    this._renderInlineStepper();
    if (step === 3 && this._modal) this._setModalStep(3);
  }

  setSlotsDetails(slots) {
    this._slots = slots;
    this._renderInlineStepper();
  }

  /** Open the payment modal — callable externally (e.g. from sticky CTA). */
  openModal() {
    // Ensure stepper is at step 2 before opening
    if (this._slots.length > 0 && this._activeStep < 2) {
      this.advanceTo(2);
    }
    this._openModal();
  }

  // ── Inline stepper (always visible in #booking section) ──

  _listenForSlotsSelected() {
    document.addEventListener('slotsSelected', (e) => {
      const { slots } = e.detail ?? {};
      this.setSlotsDetails(slots ?? []);
      if ((slots ?? []).length > 0) this.advanceTo(2);
    });
  }

  _renderInlineStepper() {
    if (!this._container) return;
    this._container.innerHTML = '';

    const card = document.createElement('div');
    card.className = 'booking-flow';

    const stepper = document.createElement('ol');
    stepper.className = 'booking-flow__stepper';
    stepper.setAttribute('aria-label', 'Booking steps');

    const stepDefs = [
      'Pick your time',
      'Pay full amount upfront',
      'Get WhatsApp confirmation',
    ];

    stepDefs.forEach((label, idx) => {
      const stepNum = idx + 1;
      const isActive = stepNum === this._activeStep;
      const isCompleted = this._completedSteps.has(stepNum);

      const li = document.createElement('li');
      li.className = 'booking-step';
      if (isActive) li.classList.add('booking-step--active');
      if (isCompleted) li.classList.add('booking-step--completed');
      li.setAttribute('aria-current', isActive ? 'step' : 'false');

      const indicator = document.createElement('span');
      indicator.className = 'booking-step__indicator';
      indicator.setAttribute('aria-hidden', 'true');
      indicator.textContent = isCompleted ? '✓' : String(stepNum);
      li.appendChild(indicator);

      const labelEl = document.createElement('span');
      labelEl.className = 'booking-step__label';
      labelEl.textContent = label;
      li.appendChild(labelEl);

      stepper.appendChild(li);
    });

    card.appendChild(stepper);

    // Step 2: show summary + "Open Payment Modal" button
    if (this._activeStep === 2 && this._slots.length > 0) {
      card.appendChild(this._buildSummaryPanel());
    }

    const validationMsg = document.createElement('p');
    validationMsg.className = 'booking-flow__validation-msg';
    validationMsg.id = 'booking-validation-msg';
    validationMsg.setAttribute('aria-live', 'polite');
    validationMsg.hidden = true;
    validationMsg.textContent = 'Please select at least one slot before proceeding.';
    card.appendChild(validationMsg);

    this._container.appendChild(card);
  }

  _buildSummaryPanel() {
    const panel = document.createElement('div');
    panel.className = 'booking-flow__step2-panel';

    const summary = document.createElement('div');
    summary.className = 'booking-flow__summary';

    this._addRow(summary, 'Date', this._slots[0]?.date ?? '', 'date');

    const slotsRow = document.createElement('div');
    slotsRow.className = 'booking-flow__summary-row';
    const sl = document.createElement('span');
    sl.className = 'booking-flow__summary-label';
    sl.textContent = `Slot${this._slots.length > 1 ? 's' : ''}:`;
    const ul = document.createElement('ul');
    ul.className = 'booking-flow__slots-list';
    this._slots.forEach((s) => {
      const li = document.createElement('li');
      li.textContent = s.label;
      ul.appendChild(li);
    });
    slotsRow.appendChild(sl);
    slotsRow.appendChild(ul);
    summary.appendChild(slotsRow);

    const amount = totalAmount(this._slots);
    this._addRow(summary, 'Total', `₹${amount}`, 'total');
    panel.appendChild(summary);

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'booking-flow__proceed-btn';
    btn.innerHTML = `Proceed to Payment · ₹${amount} <span style="display:block; font-size: 0.75rem; font-weight: 400; opacity: 0.8; margin-top: 2px;">Takes less than 60 seconds</span>`;
    btn.addEventListener('click', () => this._openModal());
    panel.appendChild(btn);

    const trustNote = document.createElement('p');
    trustNote.className = 'booking-flow__trust-note';
    trustNote.style.cssText = 'font-size: 0.75rem; color: var(--text-3); text-align: center; margin-top: 1rem;';
    trustNote.innerHTML = '🛡️ 100% Secure UPI Payment · ⚡ Instant WhatsApp Confirmation';
    panel.appendChild(trustNote);

    return panel;
  }

  _addRow(parent, label, value, key) {
    const row = document.createElement('div');
    row.className = 'booking-flow__summary-row';
    row.dataset.field = key;
    const l = document.createElement('span');
    l.className = 'booking-flow__summary-label';
    l.textContent = `${label}:`;
    const v = document.createElement('span');
    v.className = 'booking-flow__summary-value';
    v.textContent = value;
    row.appendChild(l);
    row.appendChild(v);
    parent.appendChild(row);
  }

  // ── Modal ─────────────────────────────────────────────────

  _openModal() {
    if (this._modal) return;
    this._modalStep = 1;

    const backdrop = document.createElement('div');
    backdrop.className = 'modal-backdrop';
    backdrop.setAttribute('role', 'dialog');
    backdrop.setAttribute('aria-modal', 'true');
    backdrop.setAttribute('aria-label', 'Complete your booking');

    // Close on backdrop click
    backdrop.addEventListener('click', (e) => {
      if (e.target === backdrop) this._closeModal();
    });

    const modal = document.createElement('div');
    modal.className = 'modal';
    backdrop.appendChild(modal);
    document.body.appendChild(backdrop);
    this._modal = backdrop;
    this._pendingOrderId = null;
    this._pendingAmount = totalAmount(this._slots);

    // Signal main.js to hide the sticky CTA bar
    document.dispatchEvent(new CustomEvent('bookingModalOpen'));

    this._renderModal(modal);
  }

  _closeModal() {
    this._modal?.remove();
    this._modal = null;
    this._modalStep = 0;
    // Signal main.js to restore the sticky CTA bar
    document.dispatchEvent(new CustomEvent('bookingModalClose'));
  }

  _setModalStep(step) {
    this._modalStep = step;
    const modal = this._modal?.querySelector('.modal');
    if (modal) this._renderModal(modal);
  }

  _renderModal(modal) {
    modal.innerHTML = '';

    // Header
    const header = document.createElement('div');
    header.className = 'modal__header';
    const title = document.createElement('h2');
    title.className = 'modal__title';
    title.textContent = 'Complete Your Booking';
    const closeBtn = document.createElement('button');
    closeBtn.className = 'modal__close';
    closeBtn.setAttribute('aria-label', 'Close');
    closeBtn.textContent = '×';
    closeBtn.addEventListener('click', () => this._closeModal());
    header.appendChild(title);
    header.appendChild(closeBtn);
    modal.appendChild(header);

    // Progress steps
    const progress = document.createElement('div');
    progress.className = 'modal__progress';
    const stepsEl = document.createElement('div');
    stepsEl.className = 'modal__steps';

    STEP_LABELS.forEach((label, idx) => {
      const stepNum = idx + 1;
      const isDone = stepNum < this._modalStep;
      const isActive = stepNum === this._modalStep;

      const stepEl = document.createElement('div');
      stepEl.className = 'modal__step';
      if (isDone) stepEl.classList.add('modal__step--done');
      if (isActive) stepEl.classList.add('modal__step--active');

      const dot = document.createElement('div');
      dot.className = 'modal__step-dot';
      dot.textContent = isDone ? '✓' : String(stepNum);

      const lbl = document.createElement('span');
      lbl.className = 'modal__step-label';
      lbl.textContent = label;

      stepEl.appendChild(dot);
      stepEl.appendChild(lbl);
      stepsEl.appendChild(stepEl);
    });

    progress.appendChild(stepsEl);
    modal.appendChild(progress);

    // Body
    const body = document.createElement('div');
    body.className = 'modal__body';

    if (this._modalStep === 1) {
      body.appendChild(this._buildModalStep1());
    } else if (this._modalStep === 2) {
      body.appendChild(this._buildModalStep2(this._pendingOrderId, this._pendingAmount));
    } else if (this._modalStep === 3) {
      body.appendChild(this._buildModalStep3());
    }

    modal.appendChild(body);
  }

  _buildModalStep1() {
    const frag = document.createDocumentFragment();

    // Booking summary
    const summary = document.createElement('div');
    summary.className = 'modal__summary';

    const dateRow = document.createElement('div');
    dateRow.className = 'modal__summary-row';
    dateRow.innerHTML = `<span class="modal__summary-label">Date</span><span class="modal__summary-value">${this._slots[0]?.date ?? ''}</span>`;
    summary.appendChild(dateRow);

    this._slots.forEach((s) => {
      const r = document.createElement('div');
      r.className = 'modal__summary-row';
      r.innerHTML = `<span class="modal__summary-label">${s.label}</span><span class="modal__summary-value">${s.category}</span>`;
      summary.appendChild(r);
    });

    const amount = totalAmount(this._slots);
    const amtRow = document.createElement('div');
    amtRow.className = 'modal__summary-row';
    amtRow.innerHTML = `<span class="modal__summary-label">Total (full payment)</span><span class="modal__summary-value">₹${amount}</span>`;
    summary.appendChild(amtRow);
    frag.appendChild(summary);

    // Name input
    const nameGroup = document.createElement('div');
    nameGroup.className = 'modal__form-group';
    nameGroup.innerHTML = `<label class="modal__label" for="modal-name">Your Name</label>`;
    const nameInput = document.createElement('input');
    nameInput.type = 'text';
    nameInput.className = 'modal__input';
    nameInput.id = 'modal-name';
    nameInput.placeholder = 'e.g. Rahul Sharma';
    nameInput.autocomplete = 'name';
    nameInput.value = this._customerName;
    nameGroup.appendChild(nameInput);
    frag.appendChild(nameGroup);

    // Phone input
    const phoneGroup = document.createElement('div');
    phoneGroup.className = 'modal__form-group';
    phoneGroup.innerHTML = `<label class="modal__label" for="modal-phone">WhatsApp Number</label>`;
    const phoneInput = document.createElement('input');
    phoneInput.type = 'tel';
    phoneInput.className = 'modal__input';
    phoneInput.id = 'modal-phone';
    phoneInput.placeholder = '10-digit mobile number';
    phoneInput.autocomplete = 'tel';
    phoneInput.value = this._customerPhone;
    phoneGroup.appendChild(phoneInput);
    frag.appendChild(phoneGroup);

    // Next button — dispatch event, let main.js initiate booking then advance modal
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'modal__btn';
    btn.textContent = 'Continue to Payment →';
    btn.addEventListener('click', () => {
      const name = nameInput.value.trim();
      const phone = phoneInput.value.trim();
      if (!name || !phone) {
        this._showModalError('Please enter your name and phone number.');
        return;
      }
      this._customerName = name;
      this._customerPhone = phone;

      btn.disabled = true;
      btn.textContent = 'Processing…';

      // main.js will call initiateBooking, set _pendingOrderId, then call _setModalStep(2)
      document.dispatchEvent(new CustomEvent('proceedToPayment', {
        detail: {
          slots: this._slots,
          customerName: name,
          customerPhone: phone,
          amount: totalAmount(this._slots),
        },
      }));
    });
    frag.appendChild(btn);

    const errEl = document.createElement('p');
    errEl.className = 'modal__error';
    errEl.id = 'modal-error';
    errEl.hidden = true;
    frag.appendChild(errEl);

    return frag;
  }

  _buildModalStep2(orderId, amount) {
    const panel = document.createElement('div');
    panel.className = 'upi-panel';

    const upiId   = '7981149863@ptaxis';
    const upiName = 'Lake Valley Box Stadium';
    const note    = `Slot Booking`;
    const params  = new URLSearchParams({ pa: upiId, pn: upiName, am: String(amount), cu: 'INR', tn: note });
    const upiLink = `upi://pay?${params.toString()}`;
    const qrUrl   = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(upiLink)}`;

    // Amount
    const amtEl = document.createElement('p');
    amtEl.className = 'upi-panel__amount';
    amtEl.innerHTML = `Pay <strong>₹${amount}</strong> to confirm your slot`;
    panel.appendChild(amtEl);

    // QR — use owner's actual QR image
    const qrWrap = document.createElement('div');
    qrWrap.className = 'upi-panel__qr-wrap';
    const qrImg = document.createElement('img');
    qrImg.src = '/qr-code.jpeg';
    qrImg.alt = `Scan to pay ₹${amount} via UPI`;
    qrImg.width = 200; qrImg.height = 200;
    qrImg.className = 'upi-panel__qr';
    qrWrap.appendChild(qrImg);
    panel.appendChild(qrWrap);

    // UPI ID
    const upiIdEl = document.createElement('p');
    upiIdEl.className = 'upi-panel__upi-id';
    upiIdEl.textContent = upiId;
    panel.appendChild(upiIdEl);

    // Deep link button
    const deepBtn = document.createElement('a');
    deepBtn.href = upiLink;
    deepBtn.className = 'upi-panel__deeplink-btn';
    deepBtn.textContent = '📱 Pay via GPay / PhonePe / Paytm';
    panel.appendChild(deepBtn);

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
    errEl.id = 'modal-error';
    errEl.hidden = true;
    panel.appendChild(errEl);

    confirmBtn.addEventListener('click', () => {
      const utr = utrInput.value.trim();
      if (!utr) {
        errEl.textContent = 'Please enter your UPI transaction ID.';
        errEl.hidden = false;
        return;
      }
      errEl.hidden = true;
      confirmBtn.disabled = true;
      confirmBtn.textContent = 'Verifying…';
      document.dispatchEvent(new CustomEvent('upiConfirm', { detail: { orderId, utr } }));
    });

    // Add Trust Badge
    const trustBadge = document.createElement('div');
    trustBadge.className = 'payment-badge';
    trustBadge.innerHTML = `
      <div class="payment-badge__secure">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
        SECURE UPI PAYMENT
      </div>
      <p class="payment-badge__copy">Your payment is processed securely. You will receive an instant confirmation on WhatsApp once verified.</p>
    `;
    panel.appendChild(trustBadge);

    return panel;
  }

  _buildModalStep3() {
    const frag = document.createDocumentFragment();
    // Confirmation panel is rendered by ConfirmationView into #booking
    // Modal just shows a success state
    const success = document.createElement('div');
    success.className = 'modal__success';

    const icon = document.createElement('div');
    icon.className = 'modal__success-icon';
    icon.textContent = '✓';
    success.appendChild(icon);

    const title = document.createElement('h3');
    title.className = 'modal__success-title';
    title.textContent = "You're all set! 🏏";
    success.appendChild(title);

    const tagline = document.createElement('p');
    tagline.className = 'modal__success-tagline';
    tagline.textContent = 'See you on the field!';
    success.appendChild(tagline);

    const notice = document.createElement('p');
    notice.className = 'modal__success-notice';
    notice.textContent = 'Check WhatsApp for your confirmation details.';
    success.appendChild(notice);

    const closeBtn = document.createElement('button');
    closeBtn.type = 'button';
    closeBtn.className = 'modal__btn';
    closeBtn.style.marginTop = '1.5rem';
    closeBtn.textContent = 'Done';
    closeBtn.addEventListener('click', () => this._closeModal());
    success.appendChild(closeBtn);

    frag.appendChild(success);
    return frag;
  }

  showModalError(msg) {
    const errEl = this._modal?.querySelector('#modal-error');
    if (errEl) { errEl.textContent = msg; errEl.hidden = false; }
  }

  _showModalError(msg) { this.showModalError(msg); }

  showPaymentError(msg) {
    this._showModalError(msg);
    this._setModalStep(1);
  }
}
