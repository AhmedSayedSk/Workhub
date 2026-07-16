import admin from 'firebase-admin'
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON)),
    storageBucket: process.env.STORAGE_BUCKET,
  })
}
export const db = admin.firestore()
export const bucket = admin.storage().bucket()
export { admin }
