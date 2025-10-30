import admin from 'firebase-admin';
import path from 'path';
import { fileURLToPath } from 'url';
import { readFileSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const serviceAccountPath = path.join(__dirname, '../skinsync-2aa8e-2b2fff3c35ea.json');
const serviceAccount = JSON.parse(readFileSync(serviceAccountPath, 'utf8'));

// initialize Firebase only once
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
  console.log('Firebase initialized!');
} else {
  console.log('Firebase already initialized!');
}

export default admin;
