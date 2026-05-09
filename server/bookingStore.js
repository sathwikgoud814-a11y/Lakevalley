// Firebase-backed booking store
// Survives server restarts and provides cloud persistence.

import { db } from './firebase.js';

const COLLECTION = 'bookings';

class FirebaseBookingStore {
  /**
   * Get a booking by its ID.
   * Note: This is now ASYNC.
   */
  async get(bookingId) {
    try {
      const doc = await db.collection(COLLECTION).doc(bookingId).get();
      return doc.exists ? doc.data() : null;
    } catch (err) {
      console.error(`[BookingStore] Error getting booking ${bookingId}:`, err);
      return null;
    }
  }

  /**
   * Find a booking by any field (e.g., razorpayOrderId).
   */
  async findByField(field, value) {
    try {
      const snapshot = await db.collection(COLLECTION).where(field, '==', value).limit(1).get();
      if (snapshot.empty) return null;
      return snapshot.docs[0].data();
    } catch (err) {
      console.error(`[BookingStore] Error finding booking by ${field}:`, err);
      return null;
    }
  }

  /**
   * Get all bookings.
   */
  async values() {
    try {
      const snapshot = await db.collection(COLLECTION).get();
      return snapshot.docs.map(doc => doc.data());
    } catch (err) {
      console.error('[BookingStore] Error getting all bookings:', err);
      return [];
    }
  }

  /**
   * Set/Update a booking.
   */
  async set(bookingId, data) {
    try {
      await db.collection(COLLECTION).doc(bookingId).set(data, { merge: true });
      return this;
    } catch (err) {
      console.error(`[BookingStore] Error setting booking ${bookingId}:`, err);
      throw err;
    }
  }

  /**
   * Delete a booking.
   */
  async delete(bookingId) {
    try {
      await db.collection(COLLECTION).doc(bookingId).delete();
      return true;
    } catch (err) {
      console.error(`[BookingStore] Error deleting booking ${bookingId}:`, err);
      return false;
    }
  }
}

export const bookings = new FirebaseBookingStore();
