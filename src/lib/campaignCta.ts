// Smart call-to-action presets for campaign creation. The chosen directive is
// stored on the campaign brief (brief.cta) and steers BOTH the post captions'
// closing CTAs and the video's final CTA scene. '' / undefined = Auto (AI picks
// the best action from the product context).
export interface CampaignCtaPreset {
  id: string
  label: string // shown in the picker
  labelAr: string
  directive: string // fed to the AI prompts (always English; output localizes)
}

export const CAMPAIGN_CTAS: CampaignCtaPreset[] = [
  { id: 'visit_website', label: 'Visit website', labelAr: 'زيارة الموقع', directive: 'Visit the website' },
  { id: 'download_app', label: 'Download mobile app', labelAr: 'تحميل التطبيق', directive: 'Download the mobile app' },
  { id: 'signup', label: 'Sign up / Create account', labelAr: 'إنشاء حساب', directive: 'Sign up for an account' },
  { id: 'demo', label: 'Book a demo', labelAr: 'حجز عرض تجريبي', directive: 'Book a demo' },
  { id: 'shop', label: 'Shop now', labelAr: 'التسوق الآن', directive: 'Shop now / buy the product' },
  { id: 'contact', label: 'Contact us', labelAr: 'التواصل معنا', directive: 'Contact us' },
  { id: 'follow', label: 'Follow the page', labelAr: 'متابعة الصفحة', directive: 'Follow the page for more' },
]
