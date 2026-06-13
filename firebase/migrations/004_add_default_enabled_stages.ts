/**
 * Migration 004: Add default enabledStages to existing projects
 *
 * For every project document (including archived and sub-projects) where
 * `enabledStages` is missing, set it to ['build'] so the existing Tasks/Features
 * experience stays visible under the new Build tab.
 *
 * Idempotent: documents already containing `enabledStages` are skipped.
 *
 * Run with:
 *   npx ts-node --project tsconfig.migration.json firebase/migrations/004_add_default_enabled_stages.ts
 */

import * as admin from 'firebase-admin'
import * as path from 'path'

const serviceAccountPath = path.join(__dirname, '../../firebase-service-account.json')

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccountPath),
  })
}

const db = admin.firestore()

async function run() {
  const snap = await db.collection('projects').get()
  let updated = 0
  let skipped = 0

  const batchSize = 400
  let batch = db.batch()
  let opsInBatch = 0

  for (const doc of snap.docs) {
    const data = doc.data() as { enabledStages?: string[] }
    if (Array.isArray(data.enabledStages) && data.enabledStages.length > 0) {
      skipped += 1
      continue
    }
    batch.update(doc.ref, { enabledStages: ['build'] })
    updated += 1
    opsInBatch += 1
    if (opsInBatch >= batchSize) {
      await batch.commit()
      batch = db.batch()
      opsInBatch = 0
    }
  }
  if (opsInBatch > 0) await batch.commit()

  console.log(`Migration 004 complete. updated=${updated} skipped=${skipped} total=${snap.size}`)
}

run()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Migration 004 failed:', err)
    process.exit(1)
  })
