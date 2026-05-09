import admin from 'firebase-admin';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const serviceAccountPath = join(__dirname, '../lakevalleybox-firebase-adminsdk-fbsvc-0710e958a9.json');

let app;
try {
  const serviceAccount = JSON.parse(readFileSync(serviceAccountPath, 'utf8'));
  app = admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
  console.log('[Firebase] Admin SDK initialized successfully.');
} catch (err) {
  console.error('[Firebase] Failed to initialize Admin SDK:', err.message);
  // Fallback if the file is missing or invalid in some environments
}

export const db = admin.firestore();
export default app;
