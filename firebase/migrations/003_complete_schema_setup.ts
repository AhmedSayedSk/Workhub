/**
 * Migration 003: Complete Schema Setup
 *
 * This migration ensures the complete database schema is set up with all
 * necessary collections, sample data, and relationships.
 *
 * Collections created/updated:
 * - organizations
 * - systems
 * - projects
 * - milestones
 * - monthlyPayments
 * - features
 * - tasks
 * - subtasks
 * - timeEntries
 * - aiSuggestions
 *
 * Run with: npx ts-node --project tsconfig.migration.json firebase/migrations/003_complete_schema_setup.ts
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

// Helper to create document if not exists
async function createIfNotExists(
  collection: string,
  docId: string,
  data: Record<string, unknown>,
  description: string
): Promise<boolean> {
  const ref = db.collection(collection).doc(docId)
  const doc = await ref.get()

  if (!doc.exists) {
    await ref.set({
      ...data,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    })
    console.log(`  [CREATE] ${description}`)
    return true
  } else {
    console.log(`  [SKIP] ${description} (already exists)`)
    return false
  }
}

// Helper to add document with auto ID
async function addDocument(
  collection: string,
  data: Record<string, unknown>,
  description: string
): Promise<string> {
  const ref = await db.collection(collection).add({
    ...data,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  })
  console.log(`  [CREATE] ${description} (${ref.id})`)
  return ref.id
}

async function runMigration() {
  console.log('========================================')
  console.log('Migration 003: Complete Schema Setup')
  console.log('========================================\n')

  try {
    // Check if migration already ran
    const migrationDoc = await db.collection('_migrations').doc('003_complete_schema_setup').get()
    if (migrationDoc.exists && migrationDoc.data()?.status === 'completed') {
      console.log('Migration 003 already executed, skipping...')
      return
    }

    // Mark migration as started
    await db.collection('_migrations').doc('003_complete_schema_setup').set({
      name: '003_complete_schema_setup',
      startedAt: admin.firestore.FieldValue.serverTimestamp(),
      status: 'running',
    })

    // ================================================
    // 1. ORGANIZATIONS
    // ================================================
    console.log('\n1. Setting up Organizations...')
    await createIfNotExists('organizations', 'sikasio', {
      name: 'Sikasio',
      description: 'Main organization for all projects',
    }, 'Organization: Sikasio')

    // ================================================
    // 2. SYSTEMS
    // ================================================
    console.log('\n2. Setting up Systems...')

    const systemsData = [
      {
        id: 'mobile-apps',
        organizationId: 'sikasio',
        name: 'Mobile Apps',
        description: 'iOS and Android mobile applications',
        color: '#22C55E',
      },
      {
        id: 'web-apps',
        organizationId: 'sikasio',
        name: 'Web Applications',
        description: 'Web-based applications and dashboards',
        color: '#3B82F6',
      },
      {
        id: 'backend-services',
        organizationId: 'sikasio',
        name: 'Backend Services',
        description: 'APIs, microservices, and backend systems',
        color: '#A855F7',
      },
      {
        id: 'design-projects',
        organizationId: 'sikasio',
        name: 'Design Projects',
        description: 'UI/UX design and branding projects',
        color: '#EC4899',
      },
      {
        id: 'consulting',
        organizationId: 'sikasio',
        name: 'Consulting',
        description: 'Technical consulting and advisory',
        color: '#F97316',
      },
    ]

    for (const system of systemsData) {
      const { id, ...data } = system
      await createIfNotExists('systems', id, data, `System: ${data.name}`)
    }

    // ================================================
    // 3. PROJECTS
    // ================================================
    console.log('\n3. Setting up Projects...')

    // Project 1: E-Commerce Mobile App (Milestone-based)
    await createIfNotExists('projects', 'ecommerce-app', {
      systemId: 'mobile-apps',
      name: 'E-Commerce Mobile App',
      description: 'Full-featured shopping app with cart, checkout, and payment integration',
      status: 'active',
      paymentModel: 'milestone',
      totalAmount: 75000,
      paidAmount: 25000,
      currency: 'EGP',
      startDate: admin.firestore.Timestamp.fromDate(new Date('2024-01-15')),
      deadline: admin.firestore.Timestamp.fromDate(new Date('2024-07-30')),
      notes: 'Priority project - client is ABC Retail',
    }, 'Project: E-Commerce Mobile App')

    // Project 2: Admin Dashboard (Monthly)
    await createIfNotExists('projects', 'admin-dashboard', {
      systemId: 'web-apps',
      name: 'Admin Dashboard',
      description: 'Internal admin panel for content and user management',
      status: 'active',
      paymentModel: 'monthly',
      totalAmount: 8000,
      paidAmount: 32000,
      currency: 'EGP',
      startDate: admin.firestore.Timestamp.fromDate(new Date('2024-02-01')),
      deadline: null,
      notes: 'Ongoing maintenance contract - monthly retainer',
    }, 'Project: Admin Dashboard')

    // Project 3: Payment API (Fixed)
    await createIfNotExists('projects', 'payment-api', {
      systemId: 'backend-services',
      name: 'Payment Gateway API',
      description: 'RESTful API for payment processing integration',
      status: 'completed',
      paymentModel: 'fixed',
      totalAmount: 15000,
      paidAmount: 15000,
      currency: 'EGP',
      startDate: admin.firestore.Timestamp.fromDate(new Date('2024-01-01')),
      deadline: admin.firestore.Timestamp.fromDate(new Date('2024-02-28')),
      notes: 'Completed and delivered',
    }, 'Project: Payment Gateway API')

    // Project 4: Brand Redesign (Milestone-based)
    await createIfNotExists('projects', 'brand-redesign', {
      systemId: 'design-projects',
      name: 'XYZ Company Rebrand',
      description: 'Complete brand identity redesign including logo, colors, and guidelines',
      status: 'active',
      paymentModel: 'milestone',
      totalAmount: 25000,
      paidAmount: 10000,
      currency: 'EGP',
      startDate: admin.firestore.Timestamp.fromDate(new Date('2024-03-01')),
      deadline: admin.firestore.Timestamp.fromDate(new Date('2024-05-15')),
      notes: 'Client: XYZ Company',
    }, 'Project: XYZ Company Rebrand')

    // Project 5: Tech Consulting (Monthly)
    await createIfNotExists('projects', 'tech-consulting', {
      systemId: 'consulting',
      name: 'Startup Tech Advisory',
      description: 'Technical consulting for startup architecture and team building',
      status: 'active',
      paymentModel: 'monthly',
      totalAmount: 5000,
      paidAmount: 15000,
      currency: 'EGP',
      startDate: admin.firestore.Timestamp.fromDate(new Date('2024-01-01')),
      deadline: null,
      notes: '10 hours/month advisory',
    }, 'Project: Startup Tech Advisory')

    // ================================================
    // 4. MILESTONES (for milestone-based projects)
    // ================================================
    console.log('\n4. Setting up Milestones...')

    // E-Commerce App Milestones
    const ecommerceMilestones = [
      {
        projectId: 'ecommerce-app',
        name: 'UI/UX Design & Prototypes',
        amount: 15000,
        status: 'paid',
        dueDate: admin.firestore.Timestamp.fromDate(new Date('2024-02-15')),
        completedAt: admin.firestore.Timestamp.fromDate(new Date('2024-02-10')),
        paidAt: admin.firestore.Timestamp.fromDate(new Date('2024-02-20')),
      },
      {
        projectId: 'ecommerce-app',
        name: 'Core App Development',
        amount: 25000,
        status: 'completed',
        dueDate: admin.firestore.Timestamp.fromDate(new Date('2024-04-15')),
        completedAt: admin.firestore.Timestamp.fromDate(new Date('2024-04-12')),
        paidAt: null,
      },
      {
        projectId: 'ecommerce-app',
        name: 'Payment Integration',
        amount: 15000,
        status: 'pending',
        dueDate: admin.firestore.Timestamp.fromDate(new Date('2024-05-30')),
        completedAt: null,
        paidAt: null,
      },
      {
        projectId: 'ecommerce-app',
        name: 'Testing & App Store Submission',
        amount: 10000,
        status: 'pending',
        dueDate: admin.firestore.Timestamp.fromDate(new Date('2024-06-30')),
        completedAt: null,
        paidAt: null,
      },
      {
        projectId: 'ecommerce-app',
        name: 'Post-Launch Support (1 month)',
        amount: 10000,
        status: 'pending',
        dueDate: admin.firestore.Timestamp.fromDate(new Date('2024-07-30')),
        completedAt: null,
        paidAt: null,
      },
    ]

    for (const milestone of ecommerceMilestones) {
      await addDocument('milestones', milestone, `Milestone: ${milestone.name}`)
    }

    // Brand Redesign Milestones
    const brandMilestones = [
      {
        projectId: 'brand-redesign',
        name: 'Research & Discovery',
        amount: 5000,
        status: 'paid',
        dueDate: admin.firestore.Timestamp.fromDate(new Date('2024-03-15')),
        completedAt: admin.firestore.Timestamp.fromDate(new Date('2024-03-12')),
        paidAt: admin.firestore.Timestamp.fromDate(new Date('2024-03-18')),
      },
      {
        projectId: 'brand-redesign',
        name: 'Logo Design Concepts',
        amount: 8000,
        status: 'completed',
        dueDate: admin.firestore.Timestamp.fromDate(new Date('2024-04-01')),
        completedAt: admin.firestore.Timestamp.fromDate(new Date('2024-03-28')),
        paidAt: null,
      },
      {
        projectId: 'brand-redesign',
        name: 'Brand Guidelines Document',
        amount: 7000,
        status: 'pending',
        dueDate: admin.firestore.Timestamp.fromDate(new Date('2024-04-20')),
        completedAt: null,
        paidAt: null,
      },
      {
        projectId: 'brand-redesign',
        name: 'Asset Delivery',
        amount: 5000,
        status: 'pending',
        dueDate: admin.firestore.Timestamp.fromDate(new Date('2024-05-15')),
        completedAt: null,
        paidAt: null,
      },
    ]

    for (const milestone of brandMilestones) {
      await addDocument('milestones', milestone, `Milestone: ${milestone.name}`)
    }

    // ================================================
    // 5. MONTHLY PAYMENTS
    // ================================================
    console.log('\n5. Setting up Monthly Payments...')

    // Admin Dashboard monthly payments
    const adminPayments = [
      { month: '2024-02', status: 'paid', paidAt: admin.firestore.Timestamp.fromDate(new Date('2024-03-05')) },
      { month: '2024-03', status: 'paid', paidAt: admin.firestore.Timestamp.fromDate(new Date('2024-04-03')) },
      { month: '2024-04', status: 'paid', paidAt: admin.firestore.Timestamp.fromDate(new Date('2024-05-02')) },
      { month: '2024-05', status: 'paid', paidAt: admin.firestore.Timestamp.fromDate(new Date('2024-06-04')) },
      { month: '2024-06', status: 'pending', paidAt: null },
    ]

    for (const payment of adminPayments) {
      await addDocument('monthlyPayments', {
        projectId: 'admin-dashboard',
        amount: 8000,
        ...payment,
      }, `Monthly Payment: Admin Dashboard ${payment.month}`)
    }

    // Tech Consulting monthly payments
    const consultingPayments = [
      { month: '2024-01', status: 'paid', paidAt: admin.firestore.Timestamp.fromDate(new Date('2024-02-01')) },
      { month: '2024-02', status: 'paid', paidAt: admin.firestore.Timestamp.fromDate(new Date('2024-03-01')) },
      { month: '2024-03', status: 'paid', paidAt: admin.firestore.Timestamp.fromDate(new Date('2024-04-01')) },
      { month: '2024-04', status: 'pending', paidAt: null },
    ]

    for (const payment of consultingPayments) {
      await addDocument('monthlyPayments', {
        projectId: 'tech-consulting',
        amount: 5000,
        ...payment,
      }, `Monthly Payment: Tech Consulting ${payment.month}`)
    }

    // ================================================
    // 6. FEATURES
    // ================================================
    console.log('\n6. Setting up Features...')

    const features = [
      // E-Commerce App Features
      {
        id: 'feature-auth',
        projectId: 'ecommerce-app',
        name: 'User Authentication',
        description: 'Login, registration, social auth, password recovery',
        status: 'completed',
        priority: 'high',
        estimatedHours: 20,
      },
      {
        id: 'feature-catalog',
        projectId: 'ecommerce-app',
        name: 'Product Catalog',
        description: 'Product listing, categories, search, filters',
        status: 'completed',
        priority: 'high',
        estimatedHours: 30,
      },
      {
        id: 'feature-cart',
        projectId: 'ecommerce-app',
        name: 'Shopping Cart',
        description: 'Add to cart, update quantities, remove items, cart persistence',
        status: 'in_progress',
        priority: 'high',
        estimatedHours: 15,
      },
      {
        id: 'feature-checkout',
        projectId: 'ecommerce-app',
        name: 'Checkout & Payment',
        description: 'Checkout flow, payment processing, order confirmation',
        status: 'pending',
        priority: 'high',
        estimatedHours: 25,
      },
      {
        id: 'feature-orders',
        projectId: 'ecommerce-app',
        name: 'Order Management',
        description: 'Order history, tracking, returns',
        status: 'pending',
        priority: 'medium',
        estimatedHours: 18,
      },
      // Admin Dashboard Features
      {
        id: 'feature-users',
        projectId: 'admin-dashboard',
        name: 'User Management',
        description: 'CRUD operations for users, roles, permissions',
        status: 'completed',
        priority: 'high',
        estimatedHours: 16,
      },
      {
        id: 'feature-content',
        projectId: 'admin-dashboard',
        name: 'Content Management',
        description: 'CMS for managing site content, pages, media',
        status: 'in_progress',
        priority: 'high',
        estimatedHours: 24,
      },
      {
        id: 'feature-analytics',
        projectId: 'admin-dashboard',
        name: 'Analytics Dashboard',
        description: 'Charts, reports, KPI tracking',
        status: 'pending',
        priority: 'medium',
        estimatedHours: 20,
      },
    ]

    for (const feature of features) {
      const { id, ...data } = feature
      await createIfNotExists('features', id, data, `Feature: ${data.name}`)
    }

    // ================================================
    // 7. TASKS
    // ================================================
    console.log('\n7. Setting up Tasks...')

    const tasks = [
      // Shopping Cart Tasks
      {
        id: 'task-cart-ui',
        featureId: 'feature-cart',
        projectId: 'ecommerce-app',
        name: 'Design cart UI components',
        description: 'Create reusable cart components with proper styling',
        status: 'done',
        priority: 'high',
        estimatedHours: 4,
        actualHours: 3.5,
      },
      {
        id: 'task-cart-state',
        featureId: 'feature-cart',
        projectId: 'ecommerce-app',
        name: 'Implement cart state management',
        description: 'Set up Redux/Context for cart state',
        status: 'done',
        priority: 'high',
        estimatedHours: 3,
        actualHours: 4,
      },
      {
        id: 'task-cart-api',
        featureId: 'feature-cart',
        projectId: 'ecommerce-app',
        name: 'Cart API integration',
        description: 'Connect cart to backend API',
        status: 'in_progress',
        priority: 'high',
        estimatedHours: 5,
        actualHours: 2,
      },
      {
        id: 'task-cart-persist',
        featureId: 'feature-cart',
        projectId: 'ecommerce-app',
        name: 'Cart persistence',
        description: 'Save cart to local storage and sync with server',
        status: 'todo',
        priority: 'medium',
        estimatedHours: 3,
        actualHours: 0,
      },
      // Content Management Tasks
      {
        id: 'task-cms-editor',
        featureId: 'feature-content',
        projectId: 'admin-dashboard',
        name: 'Rich text editor integration',
        description: 'Integrate WYSIWYG editor for content creation',
        status: 'in_progress',
        priority: 'high',
        estimatedHours: 6,
        actualHours: 3,
      },
      {
        id: 'task-cms-media',
        featureId: 'feature-content',
        projectId: 'admin-dashboard',
        name: 'Media library',
        description: 'Build media upload and management system',
        status: 'todo',
        priority: 'medium',
        estimatedHours: 8,
        actualHours: 0,
      },
    ]

    for (const task of tasks) {
      const { id, ...data } = task
      await createIfNotExists('tasks', id, data, `Task: ${data.name}`)
    }

    // ================================================
    // 8. SUBTASKS
    // ================================================
    console.log('\n8. Setting up Subtasks...')

    const subtasks = [
      // Cart API Integration Subtasks
      {
        taskId: 'task-cart-api',
        name: 'Create cart service class',
        status: 'done',
        estimatedMinutes: 45,
      },
      {
        taskId: 'task-cart-api',
        name: 'Implement add to cart endpoint',
        status: 'done',
        estimatedMinutes: 60,
      },
      {
        taskId: 'task-cart-api',
        name: 'Implement remove from cart endpoint',
        status: 'in_progress',
        estimatedMinutes: 45,
      },
      {
        taskId: 'task-cart-api',
        name: 'Implement update quantity endpoint',
        status: 'todo',
        estimatedMinutes: 45,
      },
      {
        taskId: 'task-cart-api',
        name: 'Add error handling and loading states',
        status: 'todo',
        estimatedMinutes: 30,
      },
      // CMS Editor Subtasks
      {
        taskId: 'task-cms-editor',
        name: 'Research and select editor library',
        status: 'done',
        estimatedMinutes: 60,
      },
      {
        taskId: 'task-cms-editor',
        name: 'Basic editor setup and configuration',
        status: 'done',
        estimatedMinutes: 90,
      },
      {
        taskId: 'task-cms-editor',
        name: 'Add image embedding support',
        status: 'in_progress',
        estimatedMinutes: 60,
      },
      {
        taskId: 'task-cms-editor',
        name: 'Add code block support',
        status: 'todo',
        estimatedMinutes: 45,
      },
    ]

    for (const subtask of subtasks) {
      await addDocument('subtasks', subtask, `Subtask: ${subtask.name}`)
    }

    // ================================================
    // 9. TIME ENTRIES (Sample data)
    // ================================================
    console.log('\n9. Setting up Time Entries...')

    const now = new Date()
    const timeEntries = [
      {
        subtaskId: 'auto',
        taskId: 'task-cart-ui',
        projectId: 'ecommerce-app',
        startTime: admin.firestore.Timestamp.fromDate(new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000)),
        endTime: admin.firestore.Timestamp.fromDate(new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000 + 3.5 * 60 * 60 * 1000)),
        duration: 210, // 3.5 hours in minutes
        notes: 'Completed cart UI components',
        isManual: false,
      },
      {
        subtaskId: 'auto',
        taskId: 'task-cart-state',
        projectId: 'ecommerce-app',
        startTime: admin.firestore.Timestamp.fromDate(new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000)),
        endTime: admin.firestore.Timestamp.fromDate(new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000 + 4 * 60 * 60 * 1000)),
        duration: 240, // 4 hours
        notes: 'Set up Redux store for cart',
        isManual: false,
      },
      {
        subtaskId: 'auto',
        taskId: 'task-cart-api',
        projectId: 'ecommerce-app',
        startTime: admin.firestore.Timestamp.fromDate(new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000)),
        endTime: admin.firestore.Timestamp.fromDate(new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000 + 2 * 60 * 60 * 1000)),
        duration: 120, // 2 hours
        notes: 'Started API integration',
        isManual: false,
      },
      {
        subtaskId: 'auto',
        taskId: 'task-cms-editor',
        projectId: 'admin-dashboard',
        startTime: admin.firestore.Timestamp.fromDate(new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000 + 3 * 60 * 60 * 1000)),
        endTime: admin.firestore.Timestamp.fromDate(new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000 + 6 * 60 * 60 * 1000)),
        duration: 180, // 3 hours
        notes: 'Working on rich text editor',
        isManual: false,
      },
    ]

    for (const entry of timeEntries) {
      await addDocument('timeEntries', entry, `Time Entry: ${entry.notes}`)
    }

    // ================================================
    // 10. AI SUGGESTIONS (Sample data)
    // ================================================
    console.log('\n10. Setting up AI Suggestions...')

    const aiSuggestions = [
      {
        context: 'task_breakdown',
        entityType: 'feature',
        entityId: 'feature-checkout',
        suggestion: JSON.stringify([
          'Create checkout page layout',
          'Implement shipping address form',
          'Add payment method selection',
          'Integrate payment gateway SDK',
          'Build order summary component',
          'Add order confirmation page',
          'Implement email notifications',
        ]),
        accepted: false,
      },
      {
        context: 'time_estimate',
        entityType: 'task',
        entityId: 'task-cart-persist',
        suggestion: '3.5',
        accepted: true,
      },
    ]

    for (const suggestion of aiSuggestions) {
      await addDocument('aiSuggestions', suggestion, `AI Suggestion: ${suggestion.context}`)
    }

    // ================================================
    // COMPLETE MIGRATION
    // ================================================
    await db.collection('_migrations').doc('003_complete_schema_setup').update({
      status: 'completed',
      completedAt: admin.firestore.FieldValue.serverTimestamp(),
    })

    console.log('\n========================================')
    console.log('Migration 003 completed successfully!')
    console.log('========================================')
    console.log('\nDatabase now contains:')
    console.log('  - 1 Organization')
    console.log('  - 5 Systems')
    console.log('  - 5 Projects (2 milestone, 2 monthly, 1 fixed)')
    console.log('  - 9 Milestones')
    console.log('  - 9 Monthly Payments')
    console.log('  - 8 Features')
    console.log('  - 6 Tasks')
    console.log('  - 9 Subtasks')
    console.log('  - 4 Time Entries')
    console.log('  - 2 AI Suggestions')

  } catch (error) {
    console.error('\nMigration 003 failed:', error)

    await db.collection('_migrations').doc('003_complete_schema_setup').update({
      status: 'failed',
      error: String(error),
      failedAt: admin.firestore.FieldValue.serverTimestamp(),
    })

    throw error
  }
}

// Run the migration
runMigration()
  .then(() => process.exit(0))
  .catch(() => process.exit(1))
