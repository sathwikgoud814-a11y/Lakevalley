// Shared admin authentication — session store + middleware
// Feature: stadium-box-booking-platform

import crypto from 'crypto';

export const COOKIE_NAME = 'admin_session';

/** In-memory set of valid session tokens (cleared on server restart) */
export const activeSessions = new Set();

/**
 * Parse a Cookie header string into a key→value object.
 * Safe against cookie values that contain '=' (base64 tokens, etc.)
 */
export function parseCookies(str) {
  const result = {};
  if (!str) return result;
  for (const part of str.split(';')) {
    const idx = part.indexOf('=');
    if (idx < 0) continue;
    try {
      const key = decodeURIComponent(part.slice(0, idx).trim());
      const val = decodeURIComponent(part.slice(idx + 1).trim());
      result[key] = val;
    } catch { /* skip malformed cookie segment */ }
  }
  return result;
}

/** Generate a cryptographically secure 64-char hex session token. */
export function generateSessionToken() {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Middleware for HTML admin routes — redirects to /admin/login on failure.
 */
export function requireAuth(req, res, next) {
  const cookies = parseCookies(req.headers.cookie ?? '');
  if (cookies[COOKIE_NAME] && activeSessions.has(cookies[COOKIE_NAME])) return next();
  res.redirect('/admin/login');
}

/**
 * Middleware for JSON API routes — returns 401 JSON on failure.
 */
export function requireApiAuth(req, res, next) {
  const cookies = parseCookies(req.headers.cookie ?? '');
  if (cookies[COOKIE_NAME] && activeSessions.has(cookies[COOKIE_NAME])) return next();
  return res.status(401).json({ error: 'Unauthorized' });
}
