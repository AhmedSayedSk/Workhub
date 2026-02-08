# Contributing to WorkHub

Thank you for your interest in contributing to WorkHub! This guide will help you get started.

## How to Contribute

### Reporting Bugs

Before opening an issue, please check if a similar one already exists. When filing a bug report, include:

- A clear and descriptive title
- Steps to reproduce the issue
- Expected behavior vs. actual behavior
- Browser and OS information
- Screenshots if applicable

### Suggesting Features

Feature requests are welcome! Please open an issue with:

- A clear description of the feature
- The problem it solves or the use case it enables
- Any mockups or examples if possible

### Pull Requests

1. **Fork the repository** and create your branch from `master`
2. **Follow the setup guide** in [README.md](README.md#getting-started) to get your local environment running
3. **Make your changes** in a focused, well-scoped branch
4. **Test your changes** locally before submitting
5. **Submit a pull request** with a clear description of what you changed and why

## Development Setup

```bash
# Fork and clone
git clone https://github.com/YOUR_USERNAME/workhub.git
cd workhub

# Install dependencies
npm install

# Copy environment variables
cp .env.local.example .env.local
# Fill in your Firebase and (optional) Gemini API keys

# Start development server
npm run dev
```

See the [Getting Started](README.md#getting-started) section in the README for full Firebase setup instructions.

## Code Guidelines

### General

- Write clear, self-documenting code
- Keep changes focused — one feature or fix per PR
- Follow existing patterns in the codebase

### TypeScript

- Use strict typing — avoid `any` where possible
- Add types to `src/types/index.ts` for shared interfaces
- Follow the existing naming conventions (camelCase for variables, PascalCase for components/types)

### Components

- Place new UI primitives in `src/components/ui/`
- Place feature-specific components in their respective directories (e.g., `src/components/tasks/`)
- Use Radix UI + Tailwind CSS for new components (matching existing shadcn/ui pattern)
- Keep components focused — split large components into smaller ones

### Hooks

- Place custom hooks in `src/hooks/`
- Follow the optimistic update pattern used in existing hooks (update UI first, then sync with Firestore, rollback on error)
- Use toast notifications for user feedback

### Styling

- Use Tailwind CSS utility classes
- Support dark mode — use `dark:` variants
- Follow the existing color patterns and spacing conventions

### Database

- Add new Firestore fields as **optional** (`?`) to avoid migration issues
- Use `Timestamp` from Firebase for all date/time fields
- If adding new collections, update `src/lib/firestore.ts` and `src/types/index.ts`
- Add necessary composite indexes to `firebase/firestore.indexes.json`

## Commit Messages

Use clear, descriptive commit messages:

- `Add kanban board drag-and-drop reordering`
- `Fix timer not persisting across page navigation`
- `Update task card to show comment count`

Avoid vague messages like "fix bug" or "update code".

## Need Help?

If you're unsure about anything, feel free to open an issue with your question. We're happy to help you get started!
