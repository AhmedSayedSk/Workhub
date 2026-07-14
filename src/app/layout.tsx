import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { AuthProvider } from '@/hooks/useAuth'
import { TooltipProvider } from '@/components/ui/tooltip'
import { Toaster } from '@/components/ui/toaster'
import { ThemeProvider } from '@/components/layout/ThemeProvider'

const inter = Inter({ subsets: ['latin'] })

const SITE_DESCRIPTION =
  'WorkHub is an all-in-one, self-hosted platform for project management, time tracking, invoicing, marketing, and server ops — Kanban boards, a live timer, per-project finances, a calendar, a media library, a Content Studio (AI image generation + social publishing to Facebook, Instagram & LinkedIn), a server-monitoring dashboard, team & audit tooling, AI assistance, and an MCP server for AI agents.'

export const metadata: Metadata = {
  metadataBase: new URL('https://workhub.sikasio.com'),
  applicationName: 'WorkHub',
  title: {
    default: 'WorkHub — Project Management, Time Tracking, Invoicing & Marketing',
    template: '%s · WorkHub',
  },
  description: SITE_DESCRIPTION,
  keywords: [
    'project management',
    'time tracking',
    'kanban board',
    'invoicing',
    'freelancer tools',
    'agency software',
    'self-hosted',
    'social media scheduler',
    'AI image generation',
    'content studio',
    'server monitoring',
    'MCP server',
    'Model Context Protocol',
    'team collaboration',
    'WorkHub',
    'Sikasio',
  ],
  authors: [{ name: 'Sikasio', url: 'https://sikasio.com' }],
  creator: 'Sikasio',
  publisher: 'Sikasio',
  icons: {
    icon: '/logo.png',
    apple: '/logo.png',
  },
  openGraph: {
    type: 'website',
    siteName: 'WorkHub',
    title: 'WorkHub — Project Management, Time Tracking, Invoicing & Marketing',
    description: SITE_DESCRIPTION,
    url: 'https://workhub.sikasio.com',
    images: [{ url: '/logo-with-title.png', alt: 'WorkHub — From Chaos to Clarity' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'WorkHub — Project Management, Time Tracking, Invoicing & Marketing',
    description: SITE_DESCRIPTION,
    images: ['/logo-with-title.png'],
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className}>
        <ThemeProvider>
          <AuthProvider>
            <TooltipProvider>
              {children}
              <Toaster />
            </TooltipProvider>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
