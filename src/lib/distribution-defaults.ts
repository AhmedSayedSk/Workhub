import type { DistributionCategoryDefault, ProjectDistribution, DistributionCategory } from '@/types'

export const FALLBACK_DEFAULT_DISTRIBUTION_CATEGORIES: DistributionCategoryDefault[] = [
  { id: 'general_admin', name: 'الإدارة العامة والتواصل مع العميل والمتابعة', weight: 3 },
  { id: 'sales_requirements', name: 'تقديم عرض السعر وتحليل المتطلبات وجذب العميل', weight: 7 },
  { id: 'design_uiux', name: 'التصميم وتجربة المستخدم UI/UX', weight: 16 },
  { id: 'programming', name: 'البرمجة والتنفيذ', weight: 42 },
  { id: 'qa_testing', name: 'إختبار الجودة والتشغيل', weight: 8 },
  { id: 'deployment', name: 'الرفع على السيرفر وإدخال البيانات', weight: 8 },
  { id: 'maintenance_support', name: 'الصيانة والدعم وإصلاح الإخطاء', weight: 16 },
]

export function buildInitialDistribution(
  defaults: DistributionCategoryDefault[] | undefined,
): ProjectDistribution {
  const source = defaults && defaults.length > 0 ? defaults : FALLBACK_DEFAULT_DISTRIBUTION_CATEGORIES
  const categories: DistributionCategory[] = source.map((c) => ({
    id: c.id,
    name: c.name,
    weight: c.weight,
    isCustom: false,
  }))
  return { enabled: true, categories, partners: [] }
}

export function sumWeights(categories: DistributionCategory[]): number {
  return categories.reduce((acc, c) => acc + (Number.isFinite(c.weight) ? c.weight : 0), 0)
}

export function sumAllocationsForCategory(
  partners: { allocations: Record<string, number> }[],
  categoryId: string,
): number {
  return partners.reduce((acc, p) => acc + (Number(p.allocations[categoryId]) || 0), 0)
}

// Computes each partner's effective ownership %:
// share% = Σ over categories of (categoryWeight/100) × (partnerAllocationInCategory)
export function computePartnerShares(
  categories: DistributionCategory[],
  partners: { memberId: string; allocations: Record<string, number> }[],
): Record<string, number> {
  const result: Record<string, number> = {}
  for (const p of partners) {
    let share = 0
    for (const c of categories) {
      const w = Number(c.weight) || 0
      const a = Number(p.allocations[c.id]) || 0
      share += (w / 100) * a
    }
    result[p.memberId] = share
  }
  return result
}
