/**
 * Migration 001: Initial Setup
 *
 * This migration creates the default organization and system for WorkHub.
 * Run with: npx ts-node firebase/migrations/001_initial_setup.ts
 */

import * as admin from 'firebase-admin'
import * as path from 'path'

// Initialize Firebase Admin
const serviceAccountPath = path.join(__dirname, '../../workhub-c288f-firebase-adminsdk-fbsvc-be5266eec0.json')

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccountPath),
  })
}

const db = admin.firestore()

async function runMigration() {
  console.log('Starting Migration 001: Initial Setup...')

  try {
    // Create default organization
    const orgRef = db.collection('organizations').doc('default')
    const orgDoc = await orgRef.get()

    if (!orgDoc.exists) {
      await orgRef.set({
        name: 'Upsmart',
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      })
      console.log('Created default organization: Upsmart')
    } else {
      console.log('Default organization already exists')
    }

    // Create default system
    const systemRef = db.collection('systems').doc('default')
    const systemDoc = await systemRef.get()

    if (!systemDoc.exists) {
      await systemRef.set({
        organizationId: 'default',
        name: 'General',
        description: 'Default system for general projects',
        color: '#3B82F6',
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      })
      console.log('Created default system: General')
    } else {
      console.log('Default system already exists')
    }

    // Record migration
    await db.collection('_migrations').doc('001_initial_setup').set({
      name: '001_initial_setup',
      executedAt: admin.firestore.FieldValue.serverTimestamp(),
      status: 'completed',
    })

    console.log('Migration 001 completed successfully!')
  } catch (error) {
    console.error('Migration 001 failed:', error)
    throw error
  }
}

// Run the migration
runMigration()
  .then(() => process.exit(0))
  .catch(() => process.exit(1))
