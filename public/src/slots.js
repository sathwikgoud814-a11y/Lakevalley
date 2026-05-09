// SlotGrid module — multi-select
// Feature: stadium-box-booking-platform

import * as api from './api.js';

const POLL_INTERVAL_MS = 30_000;
const CATEGORIES = ['Morning', 'Evening', 'Night'];

export function formatSlotLabel(start, end) {
  return `${formatTime(start)} – ${formatTime(end)}`;
}

function formatTime(value) {
  let date;
  if (value instanceof Date) {
    date = value;
  } else if (typeof value === 'string') {
    if (/^\d{1,2}:\d{2}$/.test(value)) {
      const [h, m] = value.split(':').map(Number);
      date = new Date(2000, 0, 1, h, m);
    } else {
      date = new Date(value);
    }
  } else {
    date = new Date(value);
  }
  const h = date.getHours();
  const m = date.getMinutes();
  const period = h < 12 ? 'AM' : 'PM';
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  const mm = String(m).padStart(2, '0');
  return `${hour12}:${mm} ${period}`;
}

export class SlotGrid {
  constructor(container, apiClient = api) {
    this._container = container;
    this._api = apiClient;
    this._slots = [];
    /** @type {Set<string>} */
    this._selectedIds = new Set();
    this._stale = false;
    this._pollTimer = null;
    this._currentDate = null;

    // ── Filter state ───────────────────────────────────────
    /** @type {Set<string>} active category filters (all on by default) */
    this._activeCategories = new Set(CATEGORIES);
    /** Show only available slots */
    this._showAvailableOnly = false;
    /** Maximum price filter (null = no limit) */
    this._maxPrice = null;
  }

  async fetch(date) {
    this._currentDate = date;
    try {
      const data = await this._api.getSlots(date);
      this._slots = data.slots ?? [];
      this._stale = false;
    } catch {
      this._stale = true;
    }
    this.render();
  }

  startPolling(date) {
    this.stopPolling();
    this._pollTimer = setInterval(() => this.fetch(date), POLL_INTERVAL_MS);
  }

  stopPolling() {
    if (this._pollTimer !== null) {
      clearInterval(this._pollTimer);
      this._pollTimer = null;
    }
  }

  render() {
    if (!this._container) return;
    this._container.innerHTML = '';

    if (this._stale) {
      const banner = document.createElement('div');
      banner.className = 'slots__stale-banner';
      banner.setAttribute('role', 'alert');
      banner.textContent = 'Could not refresh slot availability. Showing last known data. Selection is disabled until data refreshes.';
      this._container.appendChild(banner);
    }

    if (this._currentDate) {
      const heading = document.createElement('h2');
      heading.className = 'slots__heading';
      heading.textContent = `Available Slots — ${this._currentDate}`;
      this._container.appendChild(heading);

      const urgency = document.createElement('p');
      urgency.className = 'urgency-bar';
      urgency.innerHTML = '🔥 Only 3 slots left today &nbsp;·&nbsp; ⚡ 7 people booked in the last 2 hours';
      this._container.appendChild(urgency);
    }

    // ── Filter bar ────────────────────────────────────────
    this._container.appendChild(this._buildFilterBar());

    // Selection summary bar
    const count = this._selectedIds.size;
    const summaryBar = document.createElement('div');
    summaryBar.className = 'slots__selection-bar';
    summaryBar.setAttribute('aria-live', 'polite');
    if (count > 0) {
      const totalPrice = [...this._selectedIds].reduce((sum, id) => {
        const slot = this._slots.find((s) => s.id === id);
        return sum + (slot?.price ?? 600);
      }, 0);
      summaryBar.textContent = `${count} slot${count > 1 ? 's' : ''} selected · Total: ₹${totalPrice}`;
      summaryBar.classList.add('slots__selection-bar--active');
    } else {
      summaryBar.textContent = 'Select one or more slots';
    }
    this._container.appendChild(summaryBar);

    // Group by category
    const grouped = {};
    for (const cat of CATEGORIES) grouped[cat] = [];
    for (const slot of this._slots) {
      if (grouped[slot.category]) grouped[slot.category].push(slot);
    }

    let anyVisible = false;

    for (const cat of CATEGORIES) {
      // ── Apply filters ──────────────────────────────────
      if (!this._activeCategories.has(cat)) continue;

      let slotsInCat = grouped[cat];

      if (this._showAvailableOnly) {
        slotsInCat = slotsInCat.filter(
          (s) => s.status === 'available' || this._selectedIds.has(s.id)
        );
      }

      if (this._maxPrice !== null) {
        slotsInCat = slotsInCat.filter((s) => (s.price ?? 0) <= this._maxPrice);
      }

      if (slotsInCat.length === 0) continue;
      
      // Sort Night slots so PM (18:00-23:30) appears before AM (00:00-05:30)
      if (cat === 'Night') {
        slotsInCat.sort((a, b) => {
          const aVal = a.slotNum >= 37 ? a.slotNum - 48 : a.slotNum;
          const bVal = b.slotNum >= 37 ? b.slotNum - 48 : b.slotNum;
          return aVal - bVal;
        });
      }

      anyVisible = true;

      const section = document.createElement('div');
      section.className = 'slots__category';
      section.dataset.category = cat;

      const title = document.createElement('h3');
      title.className = 'slots__category-title';
      title.textContent = cat;
      section.appendChild(title);

      const grid = document.createElement('div');
      grid.className = 'slots__grid';
      for (const slot of slotsInCat) {
        grid.appendChild(this._buildCell(slot));
      }
      section.appendChild(grid);
      this._container.appendChild(section);
    }

    // Empty state when filters yield no slots
    if (!anyVisible) {
      const empty = document.createElement('div');
      empty.className = 'slots__filter-empty';
      empty.setAttribute('role', 'status');
      empty.innerHTML = '<span class="slots__filter-empty-icon">🔍</span><p>No slots match your filters.</p><p class="slots__filter-empty-sub">Try adjusting the category, status, or price filter.</p>';
      this._container.appendChild(empty);
    }

    // Validation message
    const validationMsg = document.createElement('p');
    validationMsg.className = 'slots__validation-msg';
    validationMsg.id = 'slots-validation-msg';
    validationMsg.setAttribute('aria-live', 'polite');
    validationMsg.hidden = true;
    validationMsg.textContent = 'Please select at least one slot before proceeding.';
    this._container.appendChild(validationMsg);
  }

  _buildCell(slot) {
    const isSelected = this._selectedIds.has(slot.id);
    const effectiveStatus = isSelected ? 'selected' : slot.status;

    const cell = document.createElement('button');
    cell.className = `slot-cell slot-cell--${effectiveStatus}`;
    cell.dataset.slotId = slot.id;
    cell.type = 'button';
    cell.setAttribute('aria-label', `${slot.label} — ${effectiveStatus}`);
    cell.setAttribute('aria-pressed', String(isSelected));

    const isBooked  = slot.status === 'booked';
    const isBlocked = slot.status === 'blocked';
    if (isBooked || isBlocked || this._stale) {
      cell.disabled = true;
      cell.setAttribute('aria-disabled', 'true');
    }

    const labelEl = document.createElement('span');
    labelEl.className = 'slot-cell__label';
    labelEl.textContent = slot.label;
    cell.appendChild(labelEl);

    if (isBooked) {
      const badge = document.createElement('span');
      badge.className = 'slot-cell__booked-badge';
      badge.textContent = 'Booked';
      cell.appendChild(badge);
    }

    if (isBlocked) {
      const badge = document.createElement('span');
      badge.className = 'slot-cell__booked-badge';
      badge.textContent = 'Unavailable';
      cell.appendChild(badge);
    }

    if (isSelected) {
      const lockedBadge = document.createElement('span');
      lockedBadge.className = 'slot-cell__booked-badge';
      lockedBadge.textContent = 'LOCKED IN 🔒';
      cell.appendChild(lockedBadge);
    }

    if (!isBooked && !isBlocked && !this._stale) {
      cell.addEventListener('click', () => this._onSlotClick(slot));
    }

    return cell;
  }

  // ── Filter bar ──────────────────────────────────────────

  _buildFilterBar() {
    const bar = document.createElement('div');
    bar.className = 'slots__filter-bar';
    bar.setAttribute('aria-label', 'Slot filters');

    // ── Category ──────────────────────────────────────────
    const catGroup = this._filterGroup('Category');
    const catPills = document.createElement('div');
    catPills.className = 'slots__filter-pills';

    for (const cat of CATEGORIES) {
      const pill = this._filterPill(cat, this._activeCategories.has(cat), () => {
        if (this._activeCategories.has(cat)) {
          if (this._activeCategories.size > 1) this._activeCategories.delete(cat);
        } else {
          this._activeCategories.add(cat);
        }
        this.render();
      });
      catPills.appendChild(pill);
    }
    catGroup.appendChild(catPills);
    bar.appendChild(catGroup);

    // ── Status ────────────────────────────────────────────
    const statusGroup = this._filterGroup('Status');
    const statusPills = document.createElement('div');
    statusPills.className = 'slots__filter-pills';
    statusPills.appendChild(
      this._filterPill('Available Only', this._showAvailableOnly, () => {
        this._showAvailableOnly = !this._showAvailableOnly;
        this.render();
      })
    );
    statusGroup.appendChild(statusPills);
    bar.appendChild(statusGroup);

    // ── Price ─────────────────────────────────────────────
    const priceGroup = this._filterGroup('Price');
    const pricePills = document.createElement('div');
    pricePills.className = 'slots__filter-pills';

    const priceOptions = [
      { label: 'All', value: null },
      { label: '≤ ₹300', value: 300 },
      { label: '≤ ₹400', value: 400 },
    ];

    for (const opt of priceOptions) {
      const isActive = this._maxPrice === opt.value;
      pricePills.appendChild(
        this._filterPill(opt.label, isActive, () => {
          this._maxPrice = opt.value;
          this.render();
        })
      );
    }
    priceGroup.appendChild(pricePills);
    bar.appendChild(priceGroup);

    // ── Reset ─────────────────────────────────────────────
    const isDefaultState =
      this._activeCategories.size === CATEGORIES.length &&
      !this._showAvailableOnly &&
      this._maxPrice === null;

    if (!isDefaultState) {
      const reset = document.createElement('button');
      reset.type = 'button';
      reset.className = 'slots__filter-reset';
      reset.textContent = '✕ Reset Filters';
      reset.addEventListener('click', () => {
        this._activeCategories = new Set(CATEGORIES);
        this._showAvailableOnly = false;
        this._maxPrice = null;
        this.render();
      });
      bar.appendChild(reset);
    }

    return bar;
  }

  /** Create a labelled filter group wrapper. */
  _filterGroup(labelText) {
    const group = document.createElement('div');
    group.className = 'slots__filter-group';
    const label = document.createElement('span');
    label.className = 'slots__filter-label';
    label.textContent = labelText;
    group.appendChild(label);
    return group;
  }

  /** Create a single pill toggle button. */
  _filterPill(text, active, onClick) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'slots__filter-pill' + (active ? ' slots__filter-pill--active' : '');
    btn.setAttribute('aria-pressed', String(active));
    btn.textContent = text;
    btn.addEventListener('click', onClick);
    return btn;
  }

  _onSlotClick(slot) {
    // Toggle selection
    if (this._selectedIds.has(slot.id)) {
      this._selectedIds.delete(slot.id);
    } else {
      this._selectedIds.add(slot.id);
    }
    this.render();

    // Emit with full array of selected slots
    const selectedSlots = this._slots
      .filter((s) => this._selectedIds.has(s.id))
      .map((s) => ({ ...s, date: this._currentDate ?? '' }));

    this._container.dispatchEvent(
      new CustomEvent('slotsSelected', {
        bubbles: true,
        detail: { slots: selectedSlots, date: this._currentDate ?? '' },
      })
    );
  }

  showValidationMessage() {
    const msg = this._container?.querySelector('#slots-validation-msg');
    if (msg) msg.hidden = false;
  }

  hideValidationMessage() {
    const msg = this._container?.querySelector('#slots-validation-msg');
    if (msg) msg.hidden = true;
  }

  /** Clear all selected slots — call after a booking is confirmed. */
  clearSelection() {
    this._selectedIds.clear();
    this.render();
  }

  /**
   * Optimistically mark slot IDs as booked in local cache,
   * then immediately re-fetch from server to get authoritative state.
   * @param {string[]} slotIds
   */
  markBookedAndRefresh(slotIds) {
    // 1. Optimistic update — mark slots booked locally right now
    this._selectedIds.clear();
    this._slots = this._slots.map((s) =>
      slotIds.includes(s.id) ? { ...s, status: 'booked' } : s
    );
    this.render();

    // 2. Re-fetch from server to get authoritative state
    if (this._currentDate) {
      this.fetch(this._currentDate);
    }
  }

  get selectedIds() { return [...this._selectedIds]; }
  get selectedSlots() {
    return this._slots
      .filter((s) => this._selectedIds.has(s.id))
      .map((s) => ({ ...s, date: this._currentDate ?? '' }));
  }
}
