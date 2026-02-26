# WorkHub Firebase Migrations

This folder contains database migrations for the WorkHub Firestore database.

## Data Architecture

```
Organization (Sikasio)
  └── Systems (Groups)
        └── Projects (Apps/Works)
              ├── Milestones (for milestone-based payments)
              ├── MonthlyPayments (for monthly salary projects)
              └── Features
                    └── Tasks
                          └── Subtasks (with time tracking)
                                └── TimeEntries
```

## Collections

| Collection | Description |
|------------|-------------|
| `organizations` | Top-level organization (e.g., Sikasio) |
| `systems` | Project groups/categories |
| `projects` | Individual projects with payment tracking |
| `milestones` | Payment milestones for milestone-based projects |
| `monthlyPayments` | Monthly payment records |
| `features` | Feature groupings within projects |
| `tasks` | Individual tasks within features |
| `subtasks` | Subtasks with time tracking capability |
| `timeEntries` | Time tracking records |
| `aiSuggestions` | AI-generated suggestions log |
| `_migrations` | Migration tracking (internal) |

## Running Migrations

```bash
# Run all pending migrations
npm run migrate

# Run specific migration
npm run migrate:001
npm run migrate:002
npm run migrate:003
```

## Creating New Migrations

1. Create a new file with format: `XXX_description.ts`
2. Follow the template from existing migrations
3. The migration runner will execute them in order

## Migration Status

Migrations are tracked in the `_migrations` collection with:
- `name`: Migration identifier
- `executedAt`: Timestamp of execution
- `status`: 'pending' | 'completed' | 'failed'
