/**
 * Migration Runner
 *
 * Runs all pending migrations in order.
 * Run with: npm run migrate
 */

import * as admin from 'firebase-admin'
import * as path from 'path'
import * as fs from 'fs'
import { execSync } from 'child_process'

// Initialize Firebase Admin
const serviceAccountPath = path.join(__dirname, '../../workhub-c288f-firebase-adminsdk-fbsvc-be5266eec0.json')

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccountPath),
  })
}

const db = admin.firestore()

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

function getMigrationFiles(): string[] {
  const migrationsDir = __dirname
  const files = fs.readdirSync(migrationsDir)
  return files
    .filter((f) => f.match(/^\d{3}_.*\.ts$/) && !f.includes('run-migrations') && !f.includes('reset-database'))
    .sort()
}

async function runMigrations() {
  console.log('========================================')
  console.log('WorkHub Migration Runner')
  console.log('========================================\n')

  try {
    const executed = await getExecutedMigrations()
    const migrationFiles = getMigrationFiles()

    console.log(`Found ${migrationFiles.length} migration file(s)`)
    console.log(`Already executed: ${executed.size} migration(s)\n`)

    const pendingMigrations = migrationFiles.filter((file) => {
      const migrationName = file.replace('.ts', '')
      return !executed.has(migrationName)
    })

    if (pendingMigrations.length === 0) {
      console.log('No pending migrations to run.')
      console.log('\n========================================')
      return
    }

    console.log(`Pending migrations: ${pendingMigrations.length}`)
    pendingMigrations.forEach((m) => console.log(`  - ${m}`))
    console.log('')

    for (const file of pendingMigrations) {
      const migrationName = file.replace('.ts', '')
      const migrationPath = path.join(__dirname, file)

      console.log(`\n[RUNNING] ${migrationName}`)
      console.log('─'.repeat(50))

      try {
        // Run the migration as a separate process
        const tsconfigPath = path.join(__dirname, '../../tsconfig.migration.json')
        execSync(`npx ts-node --project "${tsconfigPath}" "${migrationPath}"`, {
          stdio: 'inherit',
          cwd: path.join(__dirname, '../..'),
        })

        console.log(`[SUCCESS] ${migrationName}`)
      } catch (error) {
        console.error(`[FAILED] ${migrationName}`)
        throw error
      }
    }

    console.log('\n========================================')
    console.log(`Successfully ran ${pendingMigrations.length} migration(s)`)
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
