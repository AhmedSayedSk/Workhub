'use client'

import { PenSquare, BarChart3, Megaphone } from 'lucide-react'
import type { Project } from '@/types'
import { Card } from '@/components/ui/card'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { AdsTab } from './AdsTab'
import { ComposeTab } from './ComposeTab'
import { InsightsTab } from './InsightsTab'

export function SocialPanel({ project, canEdit }: { project: Project; canEdit: boolean }) {
  return (
    <Card className="p-5">
      <div className="mb-4">
        <h3 className="text-base font-semibold leading-none tracking-tight">
          Sikasio · Connected
        </h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Publish, schedule, and measure Facebook, Instagram &amp; LinkedIn
        </p>
      </div>

      <Tabs defaultValue="compose">
        <TabsList>
          <TabsTrigger value="compose" className="gap-1.5">
            <PenSquare className="h-4 w-4" /> Compose
          </TabsTrigger>
          <TabsTrigger value="insights" className="gap-1.5">
            <BarChart3 className="h-4 w-4" /> Insights
          </TabsTrigger>
          <TabsTrigger value="ads" className="gap-1.5">
            <Megaphone className="h-4 w-4" /> Ads
          </TabsTrigger>
        </TabsList>

        <TabsContent value="compose">
          <ComposeTab project={project} canEdit={canEdit} />
        </TabsContent>

        <TabsContent value="insights">
          <InsightsTab project={project} />
        </TabsContent>

        <TabsContent value="ads">
          <AdsTab />
        </TabsContent>
      </Tabs>
    </Card>
  )
}
