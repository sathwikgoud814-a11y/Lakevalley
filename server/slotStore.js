// Firebase-backed slot store
// Feature: stadium-box-booking-platform

import { db } from './firebase.js';

/**
 * 48 half-hour slots covering the full 24-hour day.
 */

function fmtHalf(totalMins) {
  const h   = Math.floor(totalMins / 60) % 24;
  const m   = totalMins % 60;
  const period = h < 12 ? 'AM' : 'PM';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  const mm  = String(m).padStart(2, '0');
  return `${h12}:${mm} ${period}`;
}

export let SLOT_PRICES = {
  Day:   300,
  Night: 400,
};

async function syncPrices() {
  try {
    const doc = await db.collection('settings').doc('pricing').get();
    if (doc.exists) {
      Object.assign(SLOT_PRICES, doc.data());
    }
  } catch (err) {
    console.error('[SlotStore] Failed to sync prices from Firestore:', err.message);
  }
}

function category(startMins) {
  // 6:00 AM (360 mins) to 6:30 PM (1110 mins) is Day
  if (startMins >= 360 && startMins < 1110) return 'Day';
  return 'Night';
}

export const DEFAULT_SLOTS = Array.from({ length: 48 }, (_, i) => {
  const startMins = i * 30;
  const endMins   = startMins + 30;
  const cat       = category(startMins);

  return {
    id:      `slot-${i + 1}`,
    slotNum: i + 1,
    label:   `${fmtHalf(startMins)} – ${fmtHalf(endMins)}`,
    category: cat,
    price:   SLOT_PRICES[cat],
  };
});


const COLLECTION = 'slots';

// ── In-memory cache for performance (optional, but let's go direct for now) ──

async function getSlotData(date) {
  const doc = await db.collection(COLLECTION).doc(date).get();
  return doc.exists ? doc.data().statuses : {};
}

async function setSlotStatus(date, slotId, status) {
  await db.collection(COLLECTION).doc(date).set({
    statuses: {
      [slotId]: status
    }
  }, { merge: true });
}

export async function lockSlot(date, slotId, bookingId, ttlSeconds) {
  const statuses = await getSlotData(date);
  const current = statuses[slotId] ?? 'available';

  if (current.startsWith('locked:')) {
    const expiresAt = Number(current.split(':')[2]);
    if (Date.now() >= expiresAt) {
      // Expired, we can take it
    } else {
      return false;
    }
  } else if (current !== 'available') {
    return false;
  }

  await setSlotStatus(date, slotId, `locked:${bookingId}:${Date.now() + ttlSeconds * 1000}`);
  return true;
}

export async function releaseSlot(date, slotId) {
  const statuses = await getSlotData(date);
  if ((statuses[slotId] ?? '').startsWith('locked:')) {
    await setSlotStatus(date, slotId, 'available');
  }
}

export async function confirmSlot(date, slotId, bookingId) {
  await setSlotStatus(date, slotId, `booked:${bookingId}`);
}

export async function blockSlot(date, slotId) {
  const statuses = await getSlotData(date);
  const current = statuses[slotId] ?? 'available';
  if (current.startsWith('booked:')) return false;
  await setSlotStatus(date, slotId, 'blocked');
  return true;
}

export async function unblockSlot(date, slotId) {
  const statuses = await getSlotData(date);
  if (statuses[slotId] === 'blocked') {
    await setSlotStatus(date, slotId, 'available');
    return true;
  }
  return false;
}

export async function getSlots(date) {
  await syncPrices();
  const statuses = await getSlotData(date);

  return DEFAULT_SLOTS.map((slot) => {
    const currentPrice = SLOT_PRICES[slot.category] ?? slot.price;
    const raw = statuses[slot.id] ?? 'available';

    if (raw === 'available') return { ...slot, price: currentPrice, status: 'available' };
    if (raw === 'blocked') return { ...slot, price: currentPrice, status: 'blocked' };

    if (raw.startsWith('locked:')) {
      const expiresAt = Number(raw.split(':')[2]);
      if (Date.now() >= expiresAt) {
        return { ...slot, price: currentPrice, status: 'available' };
      }
      return { ...slot, price: currentPrice, status: 'locked', lockExpiresAt: new Date(expiresAt).toISOString() };
    }

    if (raw.startsWith('booked:')) return { ...slot, price: currentPrice, status: 'booked' };

    return { ...slot, price: currentPrice, status: 'available' };
  });
}

export async function releaseExpiredLocks() {
  // This is harder in Firestore without a full scan, but we can do it on demand in getSlots/lockSlot
}

export async function updateCategoryPrice(category, newPrice) {
  if (SLOT_PRICES.hasOwnProperty(category)) {
    SLOT_PRICES[category] = Number(newPrice);
    try {
      await db.collection('settings').doc('pricing').set(SLOT_PRICES, { merge: true });
      return true;
    } catch (err) {
      console.error('[SlotStore] Failed to save prices to Firestore:', err.message);
      return false;
    }
  }
  return false;
}
