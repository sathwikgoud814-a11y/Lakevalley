// Reviews — client module
// Handles: review modal, star picker, dynamic review grid

// ── Helpers ──────────────────────────────────────────────────
function esc(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function starsHtml(rating) {
  return Array.from({ length: 5 }, (_, i) =>
    `<span style="color:${i < rating ? '#F59E0B' : '#CBD5E1'}">★</span>`
  ).join('');
}

function initials(name) {
  return (name ?? '?').trim().charAt(0).toUpperCase();
}

// ── Mock reviews shown when no real ones pass the filter ─────
const MOCK_REVIEWS = [
  {
    name: 'Rahul M.',
    rating: 5,
    text: 'Booked for a late-night match with friends — lighting was perfect and booking took less than a minute. The FIFA-standard turf is definitely easier on the knees!',
  },
  {
    name: 'Sai K.',
    rating: 5,
    text: 'Best box cricket venue in Hyderabad. No manual calls or waiting—the WhatsApp confirmation is instant. Great facilities and very clean dugout.',
  },
  {
    name: 'Arjun P.',
    rating: 5,
    text: 'Ideal for our corporate weekend group. Professional lighting means no shadows during play. Equipment provided was top-notch quality!',
  },
];

// ── Reviews ───────────────────────────────────────────────────
export function initReviews() {
  const grid      = document.getElementById('reviews-grid');
  const writeBtn  = document.getElementById('write-review-btn');
  const modal     = document.getElementById('review-modal');
  const closeBtn  = document.getElementById('review-modal-close');
  const nameInput = document.getElementById('review-name');
  const textInput = document.getElementById('review-text');
  const submitBtn = document.getElementById('review-submit-btn');
  const errorEl   = document.getElementById('review-error');
  const successEl = document.getElementById('review-success');
  const starsEl   = document.getElementById('review-stars');

  if (!grid || !modal) return;

  let selectedRating = 0;

  // ── Load and render reviews ──────────────────────────────
  async function loadReviews() {
    try {
      const res  = await fetch('/api/reviews');
      const data = await res.json();
      // If no real reviews pass the filter, show mocks
      renderReviews(Array.isArray(data) && data.length > 0 ? data : MOCK_REVIEWS);
    } catch {
      renderReviews(MOCK_REVIEWS);
    }
  }

  function renderReviews(reviews) {
    if (!reviews.length) {
      grid.innerHTML = `<p class="reviews__empty">No reviews yet — be the first to share your experience!</p>`;
      return;
    }
    grid.innerHTML = reviews.map((r) => `
      <div class="review-card">
        <div class="review-card__header">
          <div class="review-card__avatar">${esc(initials(r.name))}</div>
          <div>
            <p class="review-card__name">${esc(r.name)}</p>
            <p class="review-card__stars">${starsHtml(r.rating)}</p>
          </div>
        </div>
        <p class="review-card__text">"${esc(r.text)}"</p>
      </div>
    `).join('');
  }

  loadReviews();

  // ── Modal open/close ─────────────────────────────────────
  function openModal() {
    modal.hidden = false;
    nameInput.value = '';
    textInput.value = '';
    selectedRating = 0;
    updateStars(0);
    errorEl.hidden = true;
    successEl.hidden = true;
    submitBtn.disabled = false;
    submitBtn.hidden = false;
    submitBtn.textContent = 'Post Review';
    nameInput.focus();
  }

  function closeModal() {
    modal.hidden = true;
  }

  writeBtn?.addEventListener('click', openModal);
  closeBtn?.addEventListener('click', closeModal);
  modal?.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });

  // ── Star picker ──────────────────────────────────────────
  function updateStars(value) {
    starsEl?.querySelectorAll('.review-star').forEach((btn) => {
      const v = Number(btn.dataset.value);
      btn.classList.toggle('active', v <= value);
    });
  }

  starsEl?.addEventListener('click', (e) => {
    const btn = e.target.closest('.review-star');
    if (!btn) return;
    selectedRating = Number(btn.dataset.value);
    updateStars(selectedRating);
  });

  starsEl?.addEventListener('mouseover', (e) => {
    const btn = e.target.closest('.review-star');
    if (btn) updateStars(Number(btn.dataset.value));
  });

  starsEl?.addEventListener('mouseleave', () => updateStars(selectedRating));

  // ── Submit ───────────────────────────────────────────────
  submitBtn?.addEventListener('click', async () => {
    const name = nameInput.value.trim();
    const text = textInput.value.trim();

    errorEl.hidden = true;

    if (!name)          { showError('Please enter your name.'); return; }
    if (!selectedRating){ showError('Please select a star rating.'); return; }
    if (!text)          { showError('Please write your review.'); return; }

    submitBtn.disabled = true;
    submitBtn.textContent = 'Posting…';

    try {
      const res = await fetch('/api/reviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, rating: selectedRating, text }),
      });
      const data = await res.json();
      if (!res.ok) { showError(data.error ?? 'Failed to post review.'); return; }

      successEl.hidden = false;
      submitBtn.hidden = true;

      setTimeout(() => {
        loadReviews();
        closeModal();
      }, 1800);
    } catch {
      showError('Network error. Please try again.');
    } finally {
      submitBtn.disabled = false;
      if (submitBtn.textContent === 'Posting…') submitBtn.textContent = 'Post Review';
    }
  });

  function showError(msg) {
    errorEl.textContent = msg;
    errorEl.hidden = false;
    submitBtn.disabled = false;
    submitBtn.textContent = 'Post Review';
  }
}
