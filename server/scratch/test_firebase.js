import { bookings } from '../bookingStore.js';
import { getSlots } from '../slotStore.js';

async function testFirebase() {
  console.log('--- Testing Firebase Integration ---');
  
  try {
    // Test slots
    console.log('Fetching slots for 2024-05-10...');
    const slots = await getSlots('2024-05-10');
    console.log(`✅ Successfully fetched ${slots.length} slots.`);

    // Test bookings
    const testId = 'FIREBASE-TEST-' + Date.now();
    console.log(`Setting test booking ${testId}...`);
    await bookings.set(testId, {
      bookingId: testId,
      customerName: 'Firebase Tester',
      createdAt: new Date().toISOString()
    });
    
    console.log('Fetching test booking...');
    const b = await bookings.get(testId);
    if (b && b.customerName === 'Firebase Tester') {
      console.log('✅ Booking successfully saved and retrieved from Firestore.');
    } else {
      throw new Error('Retrieved booking data mismatch');
    }

    // Cleanup
    console.log('Cleaning up test booking...');
    await bookings.delete(testId);
    console.log('✅ Cleanup complete.');
    
    console.log('\n🚀 FIREBASE INTEGRATION IS WORKING!');
  } catch (err) {
    console.error('\n❌ FIREBASE TEST FAILED:', err);
    process.exit(1);
  }
}

testFirebase();
