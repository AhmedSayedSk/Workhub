/**
 * Clear All Sample Data Script
 *
 * This will DELETE ALL DATA in the database except migration records.
 * Run with: npx ts-node --project tsconfig.migration.json firebase/migrations/clear-sample-data.ts
 */

import * as admin from 'firebase-admin'
import * as path from 'path'
import * as readline from 'readline'

// Initialize Firebase Admin
const serviceAccountPath = path.join(__dirname, '../../firebase-service-account.json')

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccountPath),
  })
}

const db = admin.firestore()

// All collections with user/sample data (excluding _migrations)
const DATA_COLLECTIONS = [
  'organizations',
  'systems',
  'projects',
  'milestones',
  'monthlyPayments',
  'features',
  'tasks',
  'subtasks',
  'timeEntries',
  'aiSuggestions',
]

async function deleteCollection(collectionPath: string): Promise<number> {
  const collectionRef = db.collection(collectionPath)
  const query = collectionRef.limit(500)

  let deleted = 0

  return new Promise((resolve, reject) => {
    deleteQueryBatch(query, resolve, reject, (count) => {
      deleted += count
    })
  }).then(() => deleted)
}

async function deleteQueryBatch(
  query: admin.firestore.Query,
  resolve: (value: void) => void,
  reject: (reason?: unknown) => void,
  onDelete: (count: number) => void
) {
  const snapshot = await query.get()

  if (snapshot.size === 0) {
    resolve()
    return
  }

  const batch = db.batch()
  snapshot.docs.forEach((doc) => {
    batch.delete(doc.ref)
  })

  await batch.commit()
  onDelete(snapshot.size)

  // Recurse to delete more
  process.nextTick(() => {
    deleteQueryBatch(query, resolve, reject, onDelete)
  })
}

async function confirmClear(): Promise<boolean> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  })

  return new Promise((resolve) => {
    console.log('\n⚠️  WARNING: This will DELETE ALL SAMPLE DATA in the database!')
    console.log('Collections to be cleared:')
    DATA_COLLECTIONS.forEach((c) => console.log(`  - ${c}`))
    console.log('\nMigration records will be preserved.')
    console.log('')

    rl.question('Type "CLEAR" to confirm: ', (answer) => {
      rl.close()
      resolve(answer === 'CLEAR')
    })
  })
}

async function clearSampleData() {
  console.log('========================================')
  console.log('Clear Sample Data Tool')
  console.log('========================================')

  const confirmed = await confirmClear()

  if (!confirmed) {
    console.log('\nOperation cancelled.')
    process.exit(0)
  }

  console.log('\nClearing collections...\n')

  let totalDeleted = 0

  for (const collection of DATA_COLLECTIONS) {
    process.stdout.write(`Clearing ${collection}...`)
    const count = await deleteCollection(collection)
    console.log(` ${count} documents deleted`)
    totalDeleted += count
  }

  console.log('\n========================================')
  console.log(`Sample data cleared! ${totalDeleted} documents removed.`)
  console.log('========================================')
  console.log('\nYour database is now empty and ready for fresh data.')
}

// Run clear
clearSampleData()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Clear failed:', error)
    process.exit(1)
  })
