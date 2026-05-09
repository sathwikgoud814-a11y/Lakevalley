import admin from 'firebase-admin';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
let app;
try {
  let serviceAccount;
  
  if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    console.log('[Firebase] Initializing from environment variable.');
  } else {
    const serviceAccountPath = join(__dirname, '../lakevalleybox-firebase-adminsdk-fbsvc-0710e958a9.json');
    serviceAccount = JSON.parse(readFileSync(serviceAccountPath, 'utf8'));
    console.log('[Firebase] Initializing from local JSON file.');
  }

  app = admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
  console.log('[Firebase] Admin SDK initialized successfully.');
} catch (err) {
  console.error('[Firebase] Failed to initialize Admin SDK:', err.message);
}

export const db = admin.apps.length ? admin.firestore() : null;
export default app;
