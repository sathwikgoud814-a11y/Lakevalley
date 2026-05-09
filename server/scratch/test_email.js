import { sendOwnerEmailNotification } from '../email.js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../../.env') });

const mockBooking = {
  bookingId: 'TSB-TEST-1234',
  customerName: 'Test User',
  customerPhone: '+919999999999',
  date: '2024-05-10',
  slotIds: ['slot-1', 'slot-2'],
  amountPaid: 1200,
  utrNumber: 'UTR123456789',
  balanceDue: 0
};

console.log('--- Testing Email Notification ---');

if (!process.env.EMAIL_HOST) {
  console.log('Note: EMAIL_HOST not set in .env. Testing logic with placeholder values...');
  
  // Set temporary placeholders for testing logic
  process.env.EMAIL_HOST = 'smtp.example.com';
  process.env.EMAIL_USER = 'test@example.com';
  process.env.EMAIL_PASS = 'password';
  process.env.OWNER_EMAIL = 'owner@example.com';
}

sendOwnerEmailNotification(mockBooking)
  .then(() => {
    console.log('✅ Test function execution finished.');
    console.log('If you provided valid credentials in .env, check the owner email inbox.');
  })
  .catch((err) => {
    console.error('❌ Test failed:', err.message);
  });
