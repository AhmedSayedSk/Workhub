import admin from 'firebase-admin';
import { createRequire } from 'module';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let _db: FirebaseFirestore.Firestore | null = null;

export function getDb(): FirebaseFirestore.Firestore {
  if (_db) return _db;

  const serviceAccountPath = path.resolve(__dirname, '../..', 'firebase-service-account.json');

  const require = createRequire(import.meta.url);
  const serviceAccount = require(serviceAccountPath);

  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount as admin.ServiceAccount),
    });
  }

  _db = admin.firestore();
  return _db;
}
