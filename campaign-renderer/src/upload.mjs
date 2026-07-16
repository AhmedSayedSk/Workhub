import { bucket } from './firebase.mjs'

// Uploads a local file to Firebase Storage, makes it public, and returns
// its public HTTPS URL.
export async function upload(localPath, destPath, contentType) {
  await bucket.upload(localPath, { destination: destPath, metadata: { contentType } })
  const file = bucket.file(destPath)
  await file.makePublic()
  return `https://storage.googleapis.com/${bucket.name}/${destPath}`
}
