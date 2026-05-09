// Migration script: Local JSON -> Firebase Firestore
import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { bookings } from '../bookingStore.js';
import { confirmSlot, blockSlot } from '../slotStore.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR  = join(__dirname, '../data');

async function migrate() {
  console.log('--- Starting Data Migration to Firebase ---');

  // 1. Migrate Bookings
  const bookingsFile = join(DATA_DIR, 'bookings.json');
  if (existsSync(bookingsFile)) {
    console.log('Migrating bookings...');
    try {
      const data = JSON.parse(readFileSync(bookingsFile, 'utf8'));
      for (const b of data) {
        console.log(`  -> Migrating booking: ${b.bookingId}`);
        await bookings.set(b.bookingId, b);
      }
      console.log(`✅ Migrated ${data.length} bookings.`);
    } catch (err) {
      console.error('❌ Failed to migrate bookings:', err.message);
    }
  } else {
    console.log('No local bookings.json found to migrate.');
  }

  // 2. Migrate Slots (statuses)
  const slotsFile = join(DATA_DIR, 'slots.json');
  if (existsSync(slotsFile)) {
    console.log('Migrating slot statuses...');
    try {
      const data = JSON.parse(readFileSync(slotsFile, 'utf8'));
      for (const [key, status] of data) {
        // key format: "slot:YYYY-MM-DD:slot-N"
        const parts = key.split(':');
        if (parts.length === 3) {
          const date = parts[1];
          const slotId = parts[2];
          console.log(`  -> Migrating slot: ${key} (${status})`);
          if (status.startsWith('booked:')) {
            const bookingId = status.split(':')[1];
            await confirmSlot(date, slotId, bookingId);
          } else if (status === 'blocked') {
            await blockSlot(date, slotId);
          }
        }
      }
      console.log(`✅ Migrated ${data.length} slot states.`);
    } catch (err) {
      console.error('❌ Failed to migrate slots:', err.message);
    }
  } else {
    console.log('No local slots.json found to migrate.');
  }

  // 3. Migrate Reviews
  const reviewsFile = join(DATA_DIR, 'reviews.json');
  if (existsSync(reviewsFile)) {
    console.log('Migrating reviews...');
    // We can't use the reviews route easily here since it's a router, 
    // but we can import db directly
    const { db } = await import('../firebase.js');
    try {
      const data = JSON.parse(readFileSync(reviewsFile, 'utf8'));
      for (const r of data) {
        console.log(`  -> Migrating review: ${r.id}`);
        await db.collection('reviews').doc(r.id).set(r);
      }
      console.log(`✅ Migrated ${data.length} reviews.`);
    } catch (err) {
      console.error('❌ Failed to migrate reviews:', err.message);
    }
  }

  console.log('\n🚀 ALL DATA MIGRATED TO FIREBASE!');
  process.exit(0);
}

migrate();
