// Admin dashboard — owner-only view of all bookings + slot blocking
// Routes:
//   GET  /admin                    → HTML dashboard
//   GET  /admin/api                → JSON bookings
//   POST /admin/login              → set session cookie
//   GET  /admin/logout             → clear session cookie
//   GET  /admin/slots              → slot manager page
//   POST /admin/slots/block        → block a slot
//   POST /admin/slots/unblock      → unblock a slot

import { Router } from 'express';
import { bookings } from '../bookingStore.js';
import { getSlots, blockSlot, unblockSlot, DEFAULT_SLOTS, SLOT_PRICES, updateCategoryPrice } from '../slotStore.js';
import { COOKIE_NAME, activeSessions, parseCookies, requireAuth, generateSessionToken } from '../auth.js';

const router = Router();

// Crash on startup if the admin password is not configured
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
if (!ADMIN_PASSWORD) {
  throw new Error('[Admin] ADMIN_PASSWORD environment variable must be set. Refusing to start.');
}

function esc(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ── Login ────────────────────────────────────────────────────
router.get('/login', (req, res) => res.send(loginPage()));

router.post('/login', (req, res) => {
  const { password } = req.body ?? {};
  if (password === ADMIN_PASSWORD) {
    const token = generateSessionToken();
    activeSessions.add(token);
    const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
    res.setHeader('Set-Cookie', `${COOKIE_NAME}=${token}; HttpOnly; SameSite=Strict; Max-Age=${8 * 3600}; Path=/${secure}`);
    return res.redirect('/admin');
  }
  res.send(loginPage('Incorrect password. Try again.'));
});

// ── Logout ───────────────────────────────────────────────────
router.get('/logout', (req, res) => {
  const cookies = parseCookies(req.headers.cookie ?? '');
  activeSessions.delete(cookies[COOKIE_NAME]);
  res.setHeader('Set-Cookie', `${COOKIE_NAME}=; Max-Age=0; Path=/`);
  res.redirect('/admin/login');
});

// ── JSON API ─────────────────────────────────────────────────
router.get('/api', requireAuth, async (req, res) => {
  const { date, status } = req.query;
  const values = await bookings.values();
  let all = [...values].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  if (date)   all = all.filter((b) => b.date === date);
  if (status) all = all.filter((b) => b.status === status);
  res.json({ total: all.length, bookings: all });
});

// ── Slot Manager ─────────────────────────────────────────────
router.get('/slots', requireAuth, async (req, res) => {
  const date = req.query.date || new Date().toISOString().slice(0, 10);
  const slots = await getSlots(date);
  res.send(slotManagerPage(date, slots));
});

router.post('/slots/block', requireAuth, async (req, res) => {
  const { date, slotId } = req.body;
  if (!date || !slotId) return res.status(400).json({ error: 'date and slotId required' });
  const ok = await blockSlot(date, slotId);
  if (!ok) return res.status(409).json({ error: 'Slot is already booked and cannot be blocked.' });
  res.redirect(`/admin/slots?date=${encodeURIComponent(date)}`);
});

router.post('/slots/unblock', requireAuth, async (req, res) => {
  const { date, slotId } = req.body;
  if (!date || !slotId) return res.status(400).json({ error: 'date and slotId required' });
  await unblockSlot(date, slotId);
  res.redirect(`/admin/slots?date=${encodeURIComponent(date)}`);
});

router.post('/pricing', requireAuth, async (req, res) => {
  const { category, price, date } = req.body;
  if (!category || !price) return res.status(400).json({ error: 'category and price required' });
  await updateCategoryPrice(category, price);
  res.redirect(`/admin/slots?date=${encodeURIComponent(date || new Date().toISOString().slice(0, 10))}`);
});

// ── HTML Dashboard ───────────────────────────────────────────
router.get('/', requireAuth, async (req, res) => {
  const { date, status } = req.query;
  const values = await bookings.values();
  let all = [...values].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  const totalBookings = all.length;
  const confirmed     = all.filter((b) => b.status === 'confirmed').length;
  const pending       = all.filter((b) => b.status === 'pending').length;
  const totalRevenue  = all
    .filter((b) => b.status === 'confirmed')
    .reduce((sum, b) => sum + (b.amountPaid ?? b.amount ?? 0), 0);

  if (date)   all = all.filter((b) => b.date === date);
  if (status) all = all.filter((b) => b.status === status);

  const rows = all.map((b) => {
    const slots       = (b.slotIds ?? (b.slotId ? [b.slotId] : [])).join(', ');
    const paid        = b.amountPaid ?? b.amount ?? 0;
    const balance     = b.balanceDue ?? 0;
    const isConfirmed = b.status === 'confirmed';
    const statusBadge = `<span class="badge badge--${isConfirmed ? 'confirmed' : b.status === 'failed' ? 'failed' : 'pending'}">
      ${isConfirmed ? '✅ Confirmed' : b.status === 'failed' ? '❌ Failed' : '⏳ Pending'}
    </span>`;
    const waLink = b.ownerWaLink
      ? `<a href="${b.ownerWaLink}" target="_blank" class="wa-link">📱 WhatsApp</a>`
      : '—';

    return `<tr>
      <td class="mono">${esc(b.bookingId ?? '—')}</td>
      <td><strong>${esc(b.customerName)}</strong></td>
      <td class="mono">${esc(b.customerPhone)}</td>
      <td>${esc(b.date ?? '—')}</td>
      <td class="mono small">${esc(slots)}</td>
      <td>₹${paid}</td>
      <td>${balance > 0 ? `₹${balance}` : '—'}</td>
      <td class="mono small">${esc(b.utrNumber ?? '—')}</td>
      <td>${statusBadge}</td>
      <td class="small">${new Date(b.createdAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}</td>
      <td>${waLink}</td>
    </tr>`;
  }).join('');

  res.send(dashboardPage({ rows, totalBookings, confirmed, pending, totalRevenue, date, status, filtered: all.length }));
});

// ── Page builders ────────────────────────────────────────────

function loginPage(error = '') {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>Admin Login — Lake Valley Box Stadium</title>
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:system-ui,sans-serif;background:linear-gradient(135deg,#0a1f0a,#0f2d15);min-height:100vh;display:flex;align-items:center;justify-content:center;padding:1rem}
    .card{background:#fff;border-radius:16px;padding:2.5rem 2rem;width:100%;max-width:380px;box-shadow:0 20px 60px rgba(0,0,0,.3);text-align:center}
    .logo{font-size:2.5rem;margin-bottom:.5rem}
    h1{font-size:1.2rem;font-weight:800;color:#0f172a;margin-bottom:.25rem}
    p{font-size:.85rem;color:#64748b;margin-bottom:1.75rem}
    input{width:100%;padding:.75rem 1rem;border:1.5px solid #e2e8f0;border-radius:8px;font-size:1rem;font-family:inherit;margin-bottom:1rem;outline:none}
    input:focus{border-color:#16a34a;box-shadow:0 0 0 3px rgba(22,163,74,.12)}
    button{width:100%;padding:.85rem;background:#16a34a;color:#fff;border:none;border-radius:8px;font-size:.95rem;font-weight:800;cursor:pointer;font-family:inherit}
    button:hover{background:#15803d}
    .error{background:#fef2f2;border:1px solid #fecaca;color:#dc2626;border-radius:8px;padding:.6rem 1rem;font-size:.85rem;font-weight:600;margin-bottom:1rem}
  </style>
</head>
<body>
  <div class="card">
    <div class="logo">🏏</div>
    <h1>Owner Dashboard</h1>
    <p>Lake Valley Box Stadium</p>
    ${error ? `<div class="error">${esc(error)}</div>` : ''}
    <form method="POST" action="/admin/login">
      <input type="password" name="password" placeholder="Enter admin password" autofocus required />
      <button type="submit">Sign In →</button>
    </form>
  </div>
</body>
</html>`;
}

function dashboardPage({ rows, totalBookings, confirmed, pending, totalRevenue, date, status, filtered }) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>Owner Dashboard — Lake Valley Box Stadium</title>
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:system-ui,sans-serif;background:#f1f5f9;color:#0f172a;min-height:100vh}
    .header{background:linear-gradient(135deg,#0a1f0a,#0f2d15);color:#fff;padding:1.25rem 2rem;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:.75rem}
    .header__title{font-size:1.1rem;font-weight:800}
    .header__sub{font-size:.78rem;color:rgba(255,255,255,.6);margin-top:.1rem}
    .header__actions{display:flex;gap:.75rem;align-items:center}
    .btn{padding:.45rem 1rem;border-radius:6px;font-size:.8rem;font-weight:700;cursor:pointer;text-decoration:none;border:none;font-family:inherit}
    .btn-green{background:#28d070;color:#0d1f0d}.btn-green:hover{background:#1faf58}
    .btn-ghost{background:rgba(255,255,255,.12);color:#fff}.btn-ghost:hover{background:rgba(255,255,255,.2)}
    .btn-blue{background:#3b82f6;color:#fff}.btn-blue:hover{background:#2563eb}
    .stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:1rem;padding:1.5rem 2rem;max-width:1400px;margin:0 auto}
    .stat-card{background:#fff;border-radius:12px;padding:1.25rem 1.5rem;box-shadow:0 2px 8px rgba(0,0,0,.06)}
    .stat-card__label{font-size:.7rem;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:#64748b;margin-bottom:.4rem}
    .stat-card__value{font-size:2rem;font-weight:900;color:#0f172a;line-height:1}
    .green{color:#16a34a}.amber{color:#d97706}
    .filters{padding:0 2rem 1rem;max-width:1400px;margin:0 auto;display:flex;gap:.75rem;flex-wrap:wrap;align-items:flex-end}
    .filters label{font-size:.75rem;font-weight:700;color:#64748b;display:block;margin-bottom:.3rem}
    .filters input,.filters select{padding:.5rem .75rem;border:1.5px solid #e2e8f0;border-radius:8px;font-size:.88rem;font-family:inherit;background:#fff;outline:none}
    .btn-filter{padding:.5rem 1.25rem;background:#16a34a;color:#fff;border:none;border-radius:8px;font-size:.88rem;font-weight:700;cursor:pointer;font-family:inherit;align-self:flex-end}
    .btn-filter:hover{background:#15803d}
    .btn-clear{padding:.5rem 1rem;background:#f1f5f9;color:#64748b;border:1.5px solid #e2e8f0;border-radius:8px;font-size:.88rem;font-weight:600;cursor:pointer;font-family:inherit;text-decoration:none;align-self:flex-end}
    .table-wrap{padding:0 2rem 3rem;max-width:1400px;margin:0 auto;overflow-x:auto}
    .result-count{font-size:.82rem;color:#64748b;font-weight:600;margin-bottom:.75rem}
    table{width:100%;border-collapse:collapse;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,.06);font-size:.88rem}
    thead{background:#f8fafc}
    th{padding:.75rem 1rem;text-align:left;font-size:.68rem;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:#64748b;white-space:nowrap;border-bottom:1px solid #e2e8f0}
    td{padding:.875rem 1rem;border-bottom:1px solid #f1f5f9;vertical-align:middle}
    tr:last-child td{border-bottom:none}
    tr:hover td{background:#f8fafc}
    .mono{font-family:'Courier New',monospace;font-size:.82rem}
    .small{font-size:.8rem}
    .badge{display:inline-block;padding:.2rem .7rem;border-radius:999px;font-size:.72rem;font-weight:700;white-space:nowrap}
    .badge--confirmed{background:#dcfce7;color:#166534}
    .badge--pending{background:#fef9c3;color:#854d0e}
    .badge--failed{background:#fee2e2;color:#991b1b}
    .wa-link{color:#16a34a;font-weight:700;text-decoration:none}
    .wa-link:hover{text-decoration:underline}
    .empty{padding:3rem;text-align:center;color:#94a3b8;font-size:.95rem}
    @media(max-width:768px){.header,.stats,.filters,.table-wrap{padding-left:1rem;padding-right:1rem}.stat-card__value{font-size:1.5rem}}
  </style>
</head>
<body>
  <div class="header">
    <div>
      <div class="header__title">🏏 Lake Valley Box Stadium</div>
      <div class="header__sub">Owner Dashboard · All times in IST</div>
    </div>
    <div class="header__actions">
      <a href="/admin/slots" class="btn btn-blue">🔒 Manage Slots</a>
      <button class="btn btn-green" onclick="location.reload()">↻ Refresh</button>
      <a href="/admin/logout" class="btn btn-ghost">Sign Out</a>
    </div>
  </div>

  <div class="stats">
    <div class="stat-card"><div class="stat-card__label">Total Bookings</div><div class="stat-card__value">${totalBookings}</div></div>
    <div class="stat-card"><div class="stat-card__label">Confirmed</div><div class="stat-card__value green">${confirmed}</div></div>
    <div class="stat-card"><div class="stat-card__label">Pending Payment</div><div class="stat-card__value amber">${pending}</div></div>
    <div class="stat-card"><div class="stat-card__label">Revenue Collected</div><div class="stat-card__value green">₹${totalRevenue.toLocaleString('en-IN')}</div></div>
  </div>

  <form class="filters" method="GET" action="/admin">
    <div><label for="f-date">Filter by Date</label><input type="date" id="f-date" name="date" value="${esc(date ?? '')}" /></div>
    <div>
      <label for="f-status">Filter by Status</label>
      <select id="f-status" name="status">
        <option value="">All statuses</option>
        <option value="confirmed" ${status === 'confirmed' ? 'selected' : ''}>✅ Confirmed</option>
        <option value="pending"   ${status === 'pending'   ? 'selected' : ''}>⏳ Pending</option>
        <option value="failed"    ${status === 'failed'    ? 'selected' : ''}>❌ Failed</option>
      </select>
    </div>
    <button type="submit" class="btn-filter">Apply</button>
    <a href="/admin" class="btn-clear">Clear</a>
  </form>

  <div class="table-wrap">
    <p class="result-count">Showing ${filtered} booking${filtered !== 1 ? 's' : ''}${date ? ` for ${date}` : ''}${status ? ` · ${status}` : ''}</p>
    <table>
      <thead><tr>
        <th>Booking ID</th><th>Customer Name</th><th>Phone</th><th>Date</th>
        <th>Slots</th><th>Paid</th><th>Balance</th><th>UTR</th><th>Status</th><th>Booked At</th><th>Notify</th>
      </tr></thead>
      <tbody>${rows || '<tr><td colspan="11" class="empty">No bookings found</td></tr>'}</tbody>
    </table>
  </div>
</body>
</html>`;
}

function slotManagerPage(date, slots) {
  const CATEGORIES = ['Morning', 'Evening', 'Night'];
  const grouped = {};
  CATEGORIES.forEach((c) => { grouped[c] = []; });
  slots.forEach((s) => { if (grouped[s.category]) grouped[s.category].push(s); });

  const categoryHtml = CATEGORIES.map((cat) => {
    const slotCards = grouped[cat].map((s) => {
      const isBlocked  = s.status === 'blocked';
      const isBooked   = s.status === 'booked';
      const isLocked   = s.status === 'locked';
      const isAvail    = s.status === 'available';

      let statusBadge = '';
      if (isBlocked) statusBadge = `<span style="background:#fee2e2;color:#991b1b;padding:.15rem .5rem;border-radius:999px;font-size:.68rem;font-weight:700">🔒 Blocked</span>`;
      else if (isBooked) statusBadge = `<span style="background:#dcfce7;color:#166534;padding:.15rem .5rem;border-radius:999px;font-size:.68rem;font-weight:700">✅ Booked</span>`;
      else if (isLocked) statusBadge = `<span style="background:#fef9c3;color:#854d0e;padding:.15rem .5rem;border-radius:999px;font-size:.68rem;font-weight:700">⏳ Locked</span>`;
      else statusBadge = `<span style="background:#f0fdf4;color:#166534;padding:.15rem .5rem;border-radius:999px;font-size:.68rem;font-weight:700">✓ Available</span>`;

      const actionBtn = isBlocked
        ? `<form method="POST" action="/admin/slots/unblock" style="display:inline">
             <input type="hidden" name="date" value="${esc(date)}" />
             <input type="hidden" name="slotId" value="${esc(s.id)}" />
             <button type="submit" class="slot-btn slot-btn--unblock">Unblock</button>
           </form>`
        : isAvail || isLocked
          ? `<form method="POST" action="/admin/slots/block" style="display:inline">
               <input type="hidden" name="date" value="${esc(date)}" />
               <input type="hidden" name="slotId" value="${esc(s.id)}" />
               <button type="submit" class="slot-btn slot-btn--block">Block</button>
             </form>`
          : `<span style="color:#94a3b8;font-size:.78rem">—</span>`;

      return `<div class="slot-card ${isBlocked ? 'slot-card--blocked' : isBooked ? 'slot-card--booked' : ''}">
        <div class="slot-card__time">${esc(s.label)}</div>
        <div class="slot-card__price">₹${s.price}</div>
        <div class="slot-card__status">${statusBadge}</div>
        <div class="slot-card__action">${actionBtn}</div>
      </div>`;
    }).join('');

    return `<div class="cat-section">
      <h3 class="cat-title">
        ${cat} 
        <span class="cat-price">₹${SLOT_PRICES[cat]}/slot</span>
        <form method="POST" action="/admin/pricing" style="display:inline-flex; align-items:center; gap:0.5rem; margin-left: auto;">
          <input type="hidden" name="category" value="${cat}" />
          <input type="hidden" name="date" value="${esc(date)}" />
          <input type="number" name="price" value="${SLOT_PRICES[cat]}" min="0" step="50" style="width: 70px; padding: 0.15rem 0.3rem; font-size:0.75rem; border: 1px solid #e2e8f0; border-radius:4px; outline:none;" />
          <button type="submit" class="slot-btn slot-btn--unblock" style="padding:0.15rem 0.5rem; font-size:0.7rem;">Update</button>
        </form>
      </h3>
      <div class="slot-grid">${slotCards}</div>
    </div>`;
  }).join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>Slot Manager — Lake Valley Box Stadium</title>
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:system-ui,sans-serif;background:#f1f5f9;color:#0f172a;min-height:100vh}
    .header{background:linear-gradient(135deg,#0a1f0a,#0f2d15);color:#fff;padding:1.25rem 2rem;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:.75rem}
    .header__title{font-size:1.1rem;font-weight:800}
    .header__sub{font-size:.78rem;color:rgba(255,255,255,.6);margin-top:.1rem}
    .header__actions{display:flex;gap:.75rem;align-items:center}
    .btn{padding:.45rem 1rem;border-radius:6px;font-size:.8rem;font-weight:700;cursor:pointer;text-decoration:none;border:none;font-family:inherit}
    .btn-green{background:#28d070;color:#0d1f0d}.btn-green:hover{background:#1faf58}
    .btn-ghost{background:rgba(255,255,255,.12);color:#fff}.btn-ghost:hover{background:rgba(255,255,255,.2)}
    .content{max-width:1200px;margin:0 auto;padding:1.5rem 2rem}
    .date-form{display:flex;gap:.75rem;align-items:flex-end;margin-bottom:2rem;flex-wrap:wrap}
    .date-form label{font-size:.75rem;font-weight:700;color:#64748b;display:block;margin-bottom:.3rem}
    .date-form input{padding:.5rem .75rem;border:1.5px solid #e2e8f0;border-radius:8px;font-size:.95rem;font-family:inherit;background:#fff;outline:none}
    .date-form input:focus{border-color:#16a34a}
    .date-form button{padding:.5rem 1.25rem;background:#16a34a;color:#fff;border:none;border-radius:8px;font-size:.88rem;font-weight:700;cursor:pointer;font-family:inherit}
    .date-form button:hover{background:#15803d}
    .cat-section{margin-bottom:2.5rem}
    .cat-title{font-size:.82rem;font-weight:800;letter-spacing:.12em;text-transform:uppercase;color:#64748b;margin-bottom:1rem;display:flex;align-items:center;gap:.75rem}
    .cat-price{font-size:.72rem;background:#f1f5f9;border:1px solid #e2e8f0;border-radius:999px;padding:.15rem .6rem;color:#0f172a;font-weight:700;letter-spacing:0;text-transform:none}
    .slot-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:.75rem}
    .slot-card{background:#fff;border:1.5px solid #e2e8f0;border-radius:10px;padding:.875rem 1rem;display:flex;flex-direction:column;gap:.4rem;box-shadow:0 1px 4px rgba(0,0,0,.05)}
    .slot-card--blocked{background:#fef2f2;border-color:#fecaca}
    .slot-card--booked{background:#f0fdf4;border-color:#bbf7d0}
    .slot-card__time{font-size:.82rem;font-weight:700;color:#0f172a}
    .slot-card__price{font-size:.75rem;color:#64748b;font-weight:600}
    .slot-card__status{margin:.1rem 0}
    .slot-btn{padding:.3rem .85rem;border:none;border-radius:6px;font-size:.75rem;font-weight:700;cursor:pointer;font-family:inherit;transition:background .15s}
    .slot-btn--block{background:#fee2e2;color:#991b1b}.slot-btn--block:hover{background:#fecaca}
    .slot-btn--unblock{background:#dcfce7;color:#166534}.slot-btn--unblock:hover{background:#bbf7d0}
    .legend{display:flex;gap:1rem;flex-wrap:wrap;margin-bottom:1.5rem;font-size:.78rem;font-weight:600;color:#64748b}
    .legend span{display:flex;align-items:center;gap:.35rem}
    @media(max-width:640px){.content{padding:1rem}.slot-grid{grid-template-columns:repeat(auto-fill,minmax(150px,1fr))}}
  </style>
</head>
<body>
  <div class="header">
    <div>
      <div class="header__title">🔒 Slot Manager</div>
      <div class="header__sub">Block or unblock slots for ${esc(date)}</div>
    </div>
    <div class="header__actions">
      <a href="/admin" class="btn btn-green">← Bookings</a>
      <a href="/admin/logout" class="btn btn-ghost">Sign Out</a>
    </div>
  </div>

  <div class="content">
    <form class="date-form" method="GET" action="/admin/slots">
      <div>
        <label for="slot-date">Select Date</label>
        <input type="date" id="slot-date" name="date" value="${esc(date)}" />
      </div>
      <button type="submit">View Slots</button>
    </form>

    <div class="legend">
      <span>🟢 Available</span>
      <span>✅ Booked (customer)</span>
      <span>⏳ Locked (payment pending)</span>
      <span>🔴 Blocked (by you)</span>
    </div>

    ${categoryHtml}
  </div>
</body>
</html>`;
}

export default router;
