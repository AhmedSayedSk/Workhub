/**
 * Reset Database Script
 *
 * WARNING: This will DELETE ALL DATA in the database!
 * Only use this for development/testing purposes.
 *
 * Run with: npx ts-node --project tsconfig.migration.json firebase/migrations/reset-database.ts
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

const COLLECTIONS = [
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
  '_migrations',
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

async function confirmReset(): Promise<boolean> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  })

  return new Promise((resolve) => {
    console.log('\n⚠️  WARNING: This will DELETE ALL DATA in the database!')
    console.log('Collections to be deleted:')
    COLLECTIONS.forEach((c) => console.log(`  - ${c}`))
    console.log('')

    rl.question('Type "DELETE" to confirm: ', (answer) => {
      rl.close()
      resolve(answer === 'DELETE')
    })
  })
}

async function resetDatabase() {
  console.log('========================================')
  console.log('Database Reset Tool')
  console.log('========================================')

  const confirmed = await confirmReset()

  if (!confirmed) {
    console.log('\nReset cancelled.')
    process.exit(0)
  }

  console.log('\nDeleting collections...\n')

  for (const collection of COLLECTIONS) {
    process.stdout.write(`Deleting ${collection}...`)
    const count = await deleteCollection(collection)
    console.log(` ${count} documents deleted`)
  }

  console.log('\n========================================')
  console.log('Database reset complete!')
  console.log('========================================')
  console.log('\nRun migrations to restore data:')
  console.log('  npm run migrate:003')
}

// Run reset
resetDatabase()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Reset failed:', error)
    process.exit(1)
  })
