/**
 * Migration Runner
 *
 * Runs all pending migrations in order.
 * Run with: npx ts-node firebase/migrations/run-migrations.ts
 */

import * as admin from 'firebase-admin'
import * as path from 'path'
import * as fs from 'fs'

// Initialize Firebase Admin
const serviceAccountPath = path.join(__dirname, '../../workhub-c288f-firebase-adminsdk-fbsvc-be5266eec0.json')

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccountPath),
  })
}

const db = admin.firestore()

interface MigrationModule {
  default?: () => Promise<void>
}

async function getExecutedMigrations(): Promise<Set<string>> {
  const snapshot = await db.collection('_migrations').get()
  const executed = new Set<string>()
  snapshot.forEach((doc) => {
    if (doc.data().status === 'completed') {
      executed.add(doc.id)
    }
  })
  return executed
}

async function getMigrationFiles(): Promise<string[]> {
  const migrationsDir = __dirname
  const files = fs.readdirSync(migrationsDir)
  return files
    .filter((f) => f.match(/^\d{3}_.*\.ts$/) && f !== 'run-migrations.ts')
    .sort()
}

async function runMigrations() {
  console.log('========================================')
  console.log('WorkHub Migration Runner')
  console.log('========================================\n')

  try {
    const executed = await getExecutedMigrations()
    const migrationFiles = await getMigrationFiles()

    console.log(`Found ${migrationFiles.length} migration file(s)`)
    console.log(`Already executed: ${executed.size} migration(s)\n`)

    let ranCount = 0

    for (const file of migrationFiles) {
      const migrationName = file.replace('.ts', '')

      if (executed.has(migrationName)) {
        console.log(`[SKIP] ${migrationName} (already executed)`)
        continue
      }

      console.log(`\n[RUN] ${migrationName}`)
      console.log('-'.repeat(40))

      try {
        // Import and run the migration
        const migrationPath = path.join(__dirname, file)

        // Mark as pending
        await db.collection('_migrations').doc(migrationName).set({
          name: migrationName,
          startedAt: admin.firestore.FieldValue.serverTimestamp(),
          status: 'pending',
        })

        // Execute migration by requiring the file
        // The migration file will run its own logic
        require(migrationPath)

        ranCount++
        console.log(`[DONE] ${migrationName}`)
      } catch (error) {
        console.error(`[FAIL] ${migrationName}:`, error)

        await db.collection('_migrations').doc(migrationName).update({
          status: 'failed',
          error: String(error),
          failedAt: admin.firestore.FieldValue.serverTimestamp(),
        })

        throw error
      }
    }

    console.log('\n========================================')
    if (ranCount === 0) {
      console.log('No new migrations to run.')
    } else {
      console.log(`Successfully ran ${ranCount} migration(s).`)
    }
    console.log('========================================')
  } catch (error) {
    console.error('\nMigration runner failed:', error)
    process.exit(1)
  }
}

// Run migrations
runMigrations()
  .then(() => {
    console.log('\nMigration process completed.')
    process.exit(0)
  })
  .catch((error) => {
    console.error('Fatal error:', error)
    process.exit(1)
  })
