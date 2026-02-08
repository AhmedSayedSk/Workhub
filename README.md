# WorkHub

A full-stack project management platform built for freelancers and small teams. Manage projects, tasks, time tracking, finances, media assets, and more — with AI-powered assistance.

Built with **Next.js 15**, **Firebase**, and **Google Gemini AI**.

---

## Table of Contents

- [Features](#features)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Getting Started](#getting-started)
  - [Prerequisites](#prerequisites)
  - [Installation](#installation)
  - [Environment Variables](#environment-variables)
  - [Firebase Setup](#firebase-setup)
  - [Running the App](#running-the-app)
- [Available Scripts](#available-scripts)
- [Architecture](#architecture)
  - [Data Model](#data-model)
  - [Authentication](#authentication)
  - [State Management](#state-management)
  - [API Routes](#api-routes)
- [Firebase Configuration](#firebase-configuration)
  - [Firestore Rules](#firestore-rules)
  - [Storage Rules](#storage-rules)
  - [Indexes](#indexes)
  - [Migrations](#migrations)
- [AI Integration](#ai-integration)
- [License](#license)

---

## Features

### Project Management
- **Multi-tier hierarchy**: Organizations > Systems > Projects > Features > Tasks > Subtasks
- **Kanban board** with drag-and-drop task reordering across columns (To Do, In Progress, Review, Done)
- **Task types**: Task, Bug, Feature, Improvement, Documentation, Research — each color-coded
- **Priority levels**: Low, Medium, High, Critical — with visual border indicators
- **Task states**: Archive tasks to declutter, or mark as "Waiting" for blocked/external-dependency tasks
- **Subtasks** with individual time tracking and status management
- **Comments** on both tasks and subtasks

### Time Tracking
- **Live timer widget** with start, pause, resume, and stop controls
- **Manual time entry** creation for retroactive logging
- **Per-subtask tracking** linked to projects and tasks
- **Daily and weekly summaries** on the dashboard
- **Persistent timer state** across page navigation (Zustand with localStorage)

### Financial Management
- **Payment models**: Milestone-based, Monthly, Fixed-price, and Internal projects
- **Milestone tracking** with pending/completed/paid statuses
- **Monthly payment management** with payment history
- **Income visualization** with interactive charts
- **Dashboard stats**: Total owed, total received, days until next payment deadline

### Media Library
- **File management** with folder hierarchy and breadcrumb navigation
- **Drag-and-drop upload** with progress tracking
- **Image optimization**: Automatic compression via Canvas API (configurable quality/dimensions)
- **File categories**: Images, Videos, Audio, Documents, Archives
- **Link files** to projects and tasks for organized attachments
- **50MB max file size** with Firebase Storage

### Project Vault
- **Secure storage** for project-specific sensitive data
- **Entry types**: Text notes, Passwords, and Files
- **Per-project isolation** with easy access from project detail view

### AI Assistant
- **Powered by Google Gemini** (4 model options)
- **Task breakdown**: Generate subtask suggestions from feature descriptions
- **Time estimation**: AI-powered effort estimates for tasks
- **Productivity insights**: Analyze project health and work patterns
- **General Q&A**: Ask anything in the assistant chat interface
- **Web search**: Integrated DuckDuckGo search and URL content fetching

### Dashboard
- **At-a-glance overview**: Active projects, pending tasks, time tracked, finances
- **Priority-sorted task list** filtered to actionable items (waiting/archived tasks hidden)
- **Income chart toggle** for quick financial review

### Additional
- **Dark mode** support (class-based toggle)
- **Responsive design** for desktop and mobile
- **Confetti celebration** when tasks are moved to Done
- **Optimistic UI updates** for instant feedback on all operations
- **Toast notifications** for success/error feedback

---

## Tech Stack

| Category | Technology |
|---|---|
| **Framework** | [Next.js 15](https://nextjs.org/) (App Router) |
| **Language** | [TypeScript 5.7](https://www.typescriptlang.org/) (strict mode) |
| **UI** | [React 19](https://react.dev/) |
| **Styling** | [Tailwind CSS 3.4](https://tailwindcss.com/) |
| **Components** | [Radix UI](https://www.radix-ui.com/) + [shadcn/ui](https://ui.shadcn.com/) pattern |
| **Icons** | [Lucide React](https://lucide.dev/) |
| **Charts** | [Recharts 2](https://recharts.org/) |
| **Database** | [Firebase Firestore](https://firebase.google.com/products/firestore) |
| **Auth** | [Firebase Authentication](https://firebase.google.com/products/auth) |
| **Storage** | [Firebase Storage](https://firebase.google.com/products/storage) |
| **State** | [Zustand 5](https://zustand-demo.pmnd.rs/) (timer persistence) |
| **AI** | [Google Generative AI](https://ai.google.dev/) (Gemini) |
| **Dates** | [date-fns 4](https://date-fns.org/) |

---

## Project Structure

```
workhub/
├── firebase/
│   ├── firestore.rules          # Firestore security rules
│   ├── firestore.indexes.json   # Composite index definitions
│   ├── storage.rules            # Storage security rules
│   └── migrations/              # Database migration scripts
│       ├── run-migrations.ts
│       ├── reset-database.ts
│       └── clear-sample-data.ts
├── public/                      # Static assets
├── src/
│   ├── app/
│   │   ├── (auth)/login/        # Login page
│   │   ├── (dashboard)/         # Protected routes
│   │   │   ├── page.tsx         # Dashboard home
│   │   │   ├── assistant/       # AI assistant
│   │   │   ├── finances/        # Financial management
│   │   │   ├── media/           # Media library
│   │   │   ├── projects/        # Projects + detail view
│   │   │   ├── settings/        # App settings
│   │   │   ├── systems/         # System management
│   │   │   └── time/            # Time tracking
│   │   └── api/
│   │       ├── ai/              # Gemini AI endpoint
│   │       └── web/             # Search & URL fetch
│   ├── components/
│   │   ├── ai/                  # AI suggestion components
│   │   ├── charts/              # Income & analytics charts
│   │   ├── features/            # Feature list management
│   │   ├── finances/            # Milestone & payment UI
│   │   ├── layout/              # Navbar, Sidebar, ThemeProvider
│   │   ├── media/               # Media library UI (8 components)
│   │   ├── projects/            # Project tabs & image picker
│   │   ├── systems/             # System CRUD dialogs
│   │   ├── tasks/               # Kanban board, cards, detail modal
│   │   ├── time/                # Timer widget
│   │   └── ui/                  # 30+ shared UI components
│   ├── hooks/                   # Custom React hooks (13 hooks)
│   ├── lib/
│   │   ├── firebase.ts          # Firebase initialization
│   │   ├── firestore.ts         # Firestore data access layer
│   │   ├── gemini.ts            # Gemini AI client
│   │   ├── storage.ts           # File upload + image optimization
│   │   └── utils.ts             # Formatting & utility functions
│   ├── store/
│   │   └── timerStore.ts        # Zustand timer state
│   └── types/
│       └── index.ts             # All TypeScript interfaces & types
├── firebase.json                # Firebase project config
├── tailwind.config.ts
├── tsconfig.json
└── package.json
```

---

## Getting Started

### Prerequisites

- **Node.js** 18 or later
- **npm** (comes with Node.js)
- A **Firebase project** with Firestore, Authentication, and Storage enabled
- A **Google AI Studio** API key (for Gemini features — optional)

### Installation

```bash
# Clone the repository
git clone https://github.com/your-org/workhub.git
cd workhub

# Install dependencies
npm install
```

### Environment Variables

Copy the example file and fill in your values:

```bash
cp .env.local.example .env.local
```

```env
# Firebase Configuration
NEXT_PUBLIC_FIREBASE_API_KEY=your_api_key_here
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id

# Gemini AI (optional — AI features will be disabled without this)
GEMINI_API_KEY=your_gemini_api_key_here

# Web Search: Uses DuckDuckGo (free, no API key required)
```

**Where to get these values:**
- **Firebase**: [Firebase Console](https://console.firebase.google.com/) > Project Settings > General > Your Apps
- **Gemini**: [Google AI Studio](https://aistudio.google.com/apikey)

### Firebase Setup

1. Create a Firebase project at [console.firebase.google.com](https://console.firebase.google.com/)
2. Enable **Firestore Database** (start in production mode)
3. Enable **Authentication** > Sign-in method > **Email/Password**
4. Enable **Storage**
5. Deploy security rules and indexes:

```bash
# Deploy Firestore rules and indexes
npm run firebase:deploy:rules
npm run firebase:deploy:indexes

# (Optional) Run migrations for initial schema setup
npm run migrate
```

### Running the App

```bash
# Development server (port 3090)
npm run dev

# Production build
npm run build
npm start
```

Open [http://localhost:3090](http://localhost:3090) in your browser.

---

## Available Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start development server on port 3090 |
| `npm run build` | Create optimized production build |
| `npm start` | Start production server |
| `npm run lint` | Run ESLint checks |
| `npm run migrate` | Run Firestore database migrations |
| `npm run migrate:reset` | Reset the database (destructive) |
| `npm run db:clear` | Clear sample/seed data |
| `npm run firebase:deploy` | Deploy all Firebase configs (rules, indexes, hosting) |
| `npm run firebase:deploy:rules` | Deploy Firestore security rules only |
| `npm run firebase:deploy:indexes` | Deploy Firestore indexes only |

---

## Architecture

### Data Model

The application uses a hierarchical data model across 15 Firestore collections:

```
Organization
  └── System (color-coded project groups)
        └── Project (client, payment model, finances)
              ├── Feature (high-level work items)
              │     └── Task (kanban items with status, type, priority)
              │           ├── Subtask (granular work units)
              │           ├── TaskComment (discussion threads)
              │           └── TimeEntry (tracked work sessions)
              ├── Milestone (payment milestones)
              ├── MonthlyPayment (recurring payments)
              └── VaultEntry (sensitive project data)

MediaFolder / MediaFile  (global media library, linkable to projects/tasks)
AppSettings              (singleton for AI model configuration)
AISuggestion             (stored AI-generated suggestions)
```

**Key design decisions:**
- **Optional boolean flags** (`archived`, `waiting`) are orthogonal to task status — tasks keep their kanban column position
- **Optimistic updates** on all CRUD operations for instant UI feedback with rollback on error
- **Soft-delete via archive** — tasks can be archived and restored, or permanently deleted
- **All timestamps** use Firestore `Timestamp` for consistency

### Authentication

- Firebase Email/Password authentication
- Global `useAuth()` context hook wraps the entire app
- Protected routes at the layout level — unauthenticated users are redirected to `/login`
- All Firestore operations require authentication via security rules

### State Management

| Scope | Solution |
|---|---|
| Server data | Custom hooks with `useState` + optimistic updates |
| Timer state | Zustand store with `localStorage` persistence |
| Auth state | React Context (`useAuth`) |
| UI state | Local component `useState` |

### API Routes

| Endpoint | Method | Description |
|---|---|---|
| `/api/ai` | `POST` | AI operations: task breakdown, time estimates, insights, Q&A |
| `/api/ai` | `GET` | Fetch current AI settings (model, enabled status) |
| `/api/web/search` | `POST` | DuckDuckGo web search (no API key needed) |
| `/api/web/fetch` | `POST` | Fetch and extract content from URLs |

---

## Firebase Configuration

### Firestore Rules

All collections use authentication-based access control:

```javascript
match /tasks/{taskId} {
  allow read, write: if request.auth != null;
}
```

Rules are defined in `firebase/firestore.rules`.

### Storage Rules

Files stored under `media/{userId}/` are restricted to their owner:

```javascript
match /media/{userId}/{allPaths=**} {
  allow read: if request.auth != null && request.auth.uid == userId;
  allow write: if request.auth != null && request.auth.uid == userId
               && request.resource.size < 50 * 1024 * 1024;
}
```

### Indexes

21 composite indexes are defined in `firebase/firestore.indexes.json` to support efficient queries across collections. These are deployed with:

```bash
npm run firebase:deploy:indexes
```

### Migrations

Database migrations are located in `firebase/migrations/` and executed via `ts-node`:

```bash
npm run migrate           # Run pending migrations
npm run migrate:reset     # Reset entire database (destructive!)
npm run db:clear          # Remove sample data only
```

---

## AI Integration

WorkHub integrates with **Google Gemini** for intelligent assistance:

| Feature | Description |
|---|---|
| **Task Breakdown** | Generate subtask suggestions from a feature description |
| **Time Estimation** | AI-powered effort estimates based on task details |
| **Insights** | Productivity and project health analysis |
| **Chat Assistant** | General-purpose Q&A with optional web search |

**Available models** (configurable in Settings):

- Gemini 3 Pro — Most capable, 1M token context
- Gemini 3 Flash — Recommended balance of speed and quality
- Gemini 2.5 Pro — Advanced reasoning
- Gemini 2.5 Flash — Fastest performance

AI features are optional and gracefully disabled when no `GEMINI_API_KEY` is configured.

---

## License

This project is proprietary. All rights reserved.
