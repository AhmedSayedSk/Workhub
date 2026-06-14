import type { ProjectStage } from '@/types'
import { Layers, ListChecks, Megaphone, Rocket, GitBranch, Server, Palette, Navigation, LucideIcon } from 'lucide-react'

export interface StageMeta {
  key: ProjectStage
  label: string
  icon: LucideIcon
  /** Tailwind classes for the pill background + text in active state. */
  pillClass: string
  /** One-liner from the brief shown in empty states. */
  description: string
  /** Empty-state CTA text. */
  emptyCta: string
}

export const STAGE_META: Record<ProjectStage, StageMeta> = {
  next: {
    key: 'next',
    label: 'Next',
    icon: Navigation,
    pillClass: 'bg-teal-100 text-teal-800 border-teal-200',
    description: 'The compass. AI reads everything about this project and tells you the single highest-leverage thing to do next.',
    emptyCta: 'What should I do next?',
  },
  shape: {
    key: 'shape',
    label: 'Shape',
    icon: Layers,
    pillClass: 'bg-indigo-100 text-indigo-800 border-indigo-200',
    description: 'Make sense of it. Refine, connect, define scope, lock direction.',
    emptyCta: 'Write the vision',
  },
  build: {
    // Display label is "Tasks"; the stored stage key stays 'build' (no migration).
    key: 'build',
    label: 'Tasks',
    icon: ListChecks,
    pillClass: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    description: 'The work board. Features, tasks, and day-to-day execution for this project.',
    emptyCta: 'Add a task',
  },
  design: {
    key: 'design',
    label: 'Design',
    icon: Palette,
    pillClass: 'bg-pink-100 text-pink-800 border-pink-200',
    description: 'See it before you build it. Prototypes, screen checklists, design system, and moodboards.',
    emptyCta: 'Add a prototype',
  },
  deploy: {
    key: 'deploy',
    label: 'Deploy',
    icon: Server,
    pillClass: 'bg-orange-100 text-orange-800 border-orange-200',
    description: 'Run it in production. Servers, domains, security hardening, and the infrastructure stack.',
    emptyCta: 'Add a server',
  },
  market: {
    key: 'market',
    label: 'Market',
    icon: Megaphone,
    pillClass: 'bg-purple-100 text-purple-800 border-purple-200',
    description: 'Get it in front of people. Positioning, channels, campaigns, pricing, launch assets.',
    emptyCta: 'Set the positioning',
  },
  launch: {
    key: 'launch',
    label: 'Launch',
    icon: Rocket,
    pillClass: 'bg-rose-100 text-rose-800 border-rose-200',
    description: 'Ship and grow. Release, monitoring, onboarding, early post-launch fixes.',
    emptyCta: 'Plan the release',
  },
  repos: {
    key: 'repos',
    label: 'Repos',
    icon: GitBranch,
    pillClass: 'bg-cyan-100 text-cyan-800 border-cyan-200',
    description: 'Link the project to a sikagit project and visualize its repos and their connections on a canvas.',
    emptyCta: 'Link a sikagit project',
  },
}

// 'next' is always first: the AI compass for the whole project.
// 'repos' sits beside 'build' — both are code-level views.
export const STAGE_ORDER: ProjectStage[] = ['next', 'shape', 'design', 'build', 'repos', 'deploy', 'market', 'launch']
