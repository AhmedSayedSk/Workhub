/**
 * Migration 002: Sample Data
 *
 * This migration creates sample data for testing.
 * Run with: npx ts-node firebase/migrations/002_sample_data.ts
 */

import * as admin from 'firebase-admin'
import * as path from 'path'

// Initialize Firebase Admin
const serviceAccountPath = path.join(__dirname, '../../firebase-service-account.json')

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccountPath),
  })
}

const db = admin.firestore()

async function runMigration() {
  console.log('Starting Migration 002: Sample Data...')

  try {
    // Check if migration already ran
    const migrationDoc = await db.collection('_migrations').doc('002_sample_data').get()
    if (migrationDoc.exists) {
      console.log('Migration 002 already executed, skipping...')
      return
    }

    // Create sample systems
    const systems = [
      {
        id: 'mobile-apps',
        organizationId: 'default',
        name: 'Mobile Apps',
        description: 'Mobile application projects',
        color: '#22C55E',
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      {
        id: 'web-projects',
        organizationId: 'default',
        name: 'Web Projects',
        description: 'Web development projects',
        color: '#A855F7',
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      {
        id: 'backend-services',
        organizationId: 'default',
        name: 'Backend Services',
        description: 'API and backend projects',
        color: '#F97316',
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      },
    ]

    for (const system of systems) {
      const { id, ...data } = system
      await db.collection('systems').doc(id).set(data)
      console.log(`Created system: ${data.name}`)
    }

    // Create sample projects
    const projects = [
      {
        id: 'project-1',
        systemId: 'mobile-apps',
        name: 'E-Commerce App',
        description: 'Mobile shopping application with cart and checkout',
        status: 'active',
        paymentModel: 'milestone',
        totalAmount: 50000,
        paidAmount: 15000,
        currency: 'EGP',
        startDate: admin.firestore.Timestamp.fromDate(new Date('2024-01-15')),
        deadline: admin.firestore.Timestamp.fromDate(new Date('2024-06-30')),
        notes: 'Priority project for Q2',
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      {
        id: 'project-2',
        systemId: 'web-projects',
        name: 'Admin Dashboard',
        description: 'Internal admin panel for content management',
        status: 'active',
        paymentModel: 'monthly',
        totalAmount: 8000,
        paidAmount: 24000,
        currency: 'EGP',
        startDate: admin.firestore.Timestamp.fromDate(new Date('2024-02-01')),
        deadline: null,
        notes: 'Ongoing maintenance contract',
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      {
        id: 'project-3',
        systemId: 'backend-services',
        name: 'Payment Gateway Integration',
        description: 'Integrate payment processing API',
        status: 'completed',
        paymentModel: 'fixed',
        totalAmount: 12000,
        paidAmount: 12000,
        currency: 'EGP',
        startDate: admin.firestore.Timestamp.fromDate(new Date('2024-01-01')),
        deadline: admin.firestore.Timestamp.fromDate(new Date('2024-02-15')),
        notes: '',
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      },
    ]

    for (const project of projects) {
      const { id, ...data } = project
      await db.collection('projects').doc(id).set(data)
      console.log(`Created project: ${data.name}`)
    }

    // Create sample milestones for project-1
    const milestones = [
      {
        projectId: 'project-1',
        name: 'UI/UX Design',
        amount: 10000,
        status: 'paid',
        dueDate: admin.firestore.Timestamp.fromDate(new Date('2024-02-01')),
        completedAt: admin.firestore.Timestamp.fromDate(new Date('2024-01-28')),
        paidAt: admin.firestore.Timestamp.fromDate(new Date('2024-02-05')),
      },
      {
        projectId: 'project-1',
        name: 'Core Features Development',
        amount: 20000,
        status: 'completed',
        dueDate: admin.firestore.Timestamp.fromDate(new Date('2024-04-01')),
        completedAt: admin.firestore.Timestamp.fromDate(new Date('2024-03-28')),
        paidAt: null,
      },
      {
        projectId: 'project-1',
        name: 'Testing & Deployment',
        amount: 15000,
        status: 'pending',
        dueDate: admin.firestore.Timestamp.fromDate(new Date('2024-06-01')),
        completedAt: null,
        paidAt: null,
      },
      {
        projectId: 'project-1',
        name: 'Post-launch Support',
        amount: 5000,
        status: 'pending',
        dueDate: admin.firestore.Timestamp.fromDate(new Date('2024-06-30')),
        completedAt: null,
        paidAt: null,
      },
    ]

    for (const milestone of milestones) {
      await db.collection('milestones').add({
        ...milestone,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      })
      console.log(`Created milestone: ${milestone.name}`)
    }

    // Create sample features
    const features = [
      {
        projectId: 'project-1',
        name: 'User Authentication',
        description: 'Login, registration, password reset',
        status: 'completed',
        priority: 'high',
        estimatedHours: 16,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      {
        projectId: 'project-1',
        name: 'Product Catalog',
        description: 'Product listing, search, filters',
        status: 'in_progress',
        priority: 'high',
        estimatedHours: 24,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      {
        projectId: 'project-1',
        name: 'Shopping Cart',
        description: 'Add to cart, update quantities, remove items',
        status: 'pending',
        priority: 'medium',
        estimatedHours: 12,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      },
    ]

    for (const feature of features) {
      await db.collection('features').add(feature)
      console.log(`Created feature: ${feature.name}`)
    }

    // Record migration
    await db.collection('_migrations').doc('002_sample_data').set({
      name: '002_sample_data',
      executedAt: admin.firestore.FieldValue.serverTimestamp(),
      status: 'completed',
    })

    console.log('Migration 002 completed successfully!')
  } catch (error) {
    console.error('Migration 002 failed:', error)
    throw error
  }
}

// Run the migration
runMigration()
  .then(() => process.exit(0))
  .catch(() => process.exit(1))
