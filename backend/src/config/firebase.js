import { initializeApp, cert } from 'firebase-admin/app';
import { getMessaging } from 'firebase-admin/messaging';

let isInitialized = false;

/**
 * Firebase Admin credentials are read ONLY from environment variables (.env).
 * No credential file is used, so no secret lives in the source tree.
 *
 * Required .env keys (copy from the Firebase service account JSON):
 *   FIREBASE_PROJECT_ID     -> "project_id"
 *   FIREBASE_CLIENT_EMAIL   -> "client_email"
 *   FIREBASE_PRIVATE_KEY    -> "private_key"  (one line, newlines written as \n, wrapped in double quotes)
 */
function readServiceAccountFromEnv() {
  const projectId = (process.env.FIREBASE_PROJECT_ID || '').trim();
  const clientEmail = (process.env.FIREBASE_CLIENT_EMAIL || '').trim();
  // Support keys stored with literal "\n" (common in .env files and hosting dashboards)
  const privateKey = (process.env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n').trim();

  const missing = [];
  if (!projectId) missing.push('FIREBASE_PROJECT_ID');
  if (!clientEmail) missing.push('FIREBASE_CLIENT_EMAIL');
  if (!privateKey) missing.push('FIREBASE_PRIVATE_KEY');
  if (missing.length > 0) {
    throw new Error(`Missing Firebase Admin env variable(s): ${missing.join(', ')}`);
  }

  return { projectId, clientEmail, privateKey };
}

export function ensureFirebaseAdmin() {
  if (isInitialized) return { messaging: getMessaging };

  try {
    const serviceAccount = readServiceAccountFromEnv();

    initializeApp({
      credential: cert(serviceAccount),
      databaseURL: process.env.FIREBASE_DATABASE_URL || undefined,
    });

    isInitialized = true;
    console.log('Firebase Admin initialized successfully.');
    return { messaging: getMessaging };
  } catch (error) {
    console.error('Failed to initialize Firebase Admin:', error.message || error);
    return null;
  }
}

export function getFirebaseAdmin() {
  return isInitialized ? { messaging: getMessaging } : ensureFirebaseAdmin();
}
