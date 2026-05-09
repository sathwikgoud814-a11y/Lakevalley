// Route: GET/POST /api/reviews
// Firebase Firestore backend for reviews
// Feature: stadium-box-booking-platform

import { Router } from 'express';
import crypto from 'crypto';
import { requireApiAuth } from '../auth.js';
import { db } from '../firebase.js';

const COLLECTION = 'reviews';

/**
 * Returns true if the text looks like random/junk characters.
 */
function isJunk(text) {
  if (!text || text.trim().length < 5) return true;
  const t = text.trim();
  if (!/[a-zA-Z\u0900-\u097F]{3,}/.test(t)) return true;
  const nonLetterCount = (t.match(/[^a-zA-Z\u0900-\u097F\s.,!?'"]/g) ?? []).length;
  if (nonLetterCount / t.length > 0.4) return true;
  return false;
}

async function loadAll() {
  const snapshot = await db.collection(COLLECTION).get();
  return snapshot.docs.map(doc => doc.data());
}

const router = Router();

// GET /api/reviews — public: only >=4 stars, no junk, max 3, newest first
router.get('/', async (req, res) => {
  try {
    const snapshot = await db.collection(COLLECTION)
      .where('rating', '>=', 4)
      .orderBy('rating', 'desc') // Best effort
      .get();
    
    const visible = snapshot.docs
      .map(doc => doc.data())
      .filter((r) => !isJunk(r.text) && !isJunk(r.name))
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(0, 3);
    
    res.json(visible);
  } catch (err) {
    console.error('[Reviews] Error fetching visible reviews:', err);
    res.json([]);
  }
});

// GET /api/reviews/all — admin only: all reviews
router.get('/all', requireApiAuth, async (req, res) => {
  try {
    const all = await loadAll();
    res.json(all.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)));
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch reviews' });
  }
});

// POST /api/reviews
router.post('/', async (req, res) => {
  const { name, rating, text } = req.body;

  if (!name?.trim() || !text?.trim()) {
    return res.status(400).json({ error: 'Name and review text are required.' });
  }
  const r = Number(rating);
  if (!Number.isInteger(r) || r < 1 || r > 5) {
    return res.status(400).json({ error: 'Rating must be 1–5.' });
  }
  if (isJunk(text)) {
    return res.status(400).json({ error: 'Review text appears invalid. Please write a genuine review.' });
  }
  if (isJunk(name)) {
    return res.status(400).json({ error: 'Name appears invalid. Please enter your real name.' });
  }

  const contentHash = crypto
    .createHash('sha256')
    .update(`${name.trim().toLowerCase()}::${text.trim().toLowerCase()}`)
    .digest('hex');

  // Check for duplicate in last 24h
  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const dupSnapshot = await db.collection(COLLECTION)
    .where('contentHash', '==', contentHash)
    .where('createdAt', '>', yesterday)
    .limit(1)
    .get();

  if (!dupSnapshot.empty) {
    return res.status(429).json({ error: 'Duplicate review detected. Please wait 24 hours before re-submitting.' });
  }

  const reviewId = crypto.randomUUID();
  const review = {
    id:          reviewId,
    name:        name.trim().slice(0, 60),
    rating:      r,
    text:        text.trim().slice(0, 500),
    contentHash,
    createdAt:   new Date().toISOString(),
  };

  await db.collection(COLLECTION).doc(reviewId).set(review);
  res.status(201).json(review);
});

export default router;
