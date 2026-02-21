export interface BrandIconMatch {
  slug: string
  name: string
  color: string
  isDark: boolean
}

/** Returns true if the hex color is too dark to be visible on light backgrounds */
function isColorDark(hex: string): boolean {
  const c = hex.replace('#', '')
  const r = parseInt(c.substring(0, 2), 16)
  const g = parseInt(c.substring(2, 4), 16)
  const b = parseInt(c.substring(4, 6), 16)
  // Relative luminance threshold — anything below 0.15 is too dark
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255
  return luminance < 0.15
}

// Ordered specific-first so "google cloud" matches before "google"
const BRAND_MAP: { keyword: string; slug: string; name: string; color: string }[] = [
  // Cloud providers
  { keyword: 'google cloud', slug: 'googlecloud', name: 'Google Cloud', color: '#4285F4' },
  { keyword: 'gcp', slug: 'googlecloud', name: 'Google Cloud', color: '#4285F4' },
  { keyword: 'aws', slug: 'amazonaws', name: 'AWS', color: '#232F3E' },
  { keyword: 'amazon web services', slug: 'amazonaws', name: 'AWS', color: '#232F3E' },
  { keyword: 'azure', slug: 'microsoftazure', name: 'Azure', color: '#0078D4' },
  { keyword: 'digitalocean', slug: 'digitalocean', name: 'DigitalOcean', color: '#0080FF' },
  { keyword: 'vercel', slug: 'vercel', name: 'Vercel', color: '#1A1A1A' },
  { keyword: 'netlify', slug: 'netlify', name: 'Netlify', color: '#00C7B7' },
  { keyword: 'cloudflare', slug: 'cloudflare', name: 'Cloudflare', color: '#F38020' },
  { keyword: 'heroku', slug: 'heroku', name: 'Heroku', color: '#430098' },
  { keyword: 'railway', slug: 'railway', name: 'Railway', color: '#0B0D0E' },
  { keyword: 'render', slug: 'render', name: 'Render', color: '#46E3B7' },
  { keyword: 'fly.io', slug: 'flydotio', name: 'Fly.io', color: '#7B3BE2' },

  // Git / version control
  { keyword: 'github', slug: 'github', name: 'GitHub', color: '#24292E' },
  { keyword: 'gitlab', slug: 'gitlab', name: 'GitLab', color: '#FC6D26' },
  { keyword: 'bitbucket', slug: 'bitbucket', name: 'Bitbucket', color: '#0052CC' },

  // Databases
  { keyword: 'mongodb', slug: 'mongodb', name: 'MongoDB', color: '#47A248' },
  { keyword: 'mongo', slug: 'mongodb', name: 'MongoDB', color: '#47A248' },
  { keyword: 'postgresql', slug: 'postgresql', name: 'PostgreSQL', color: '#4169E1' },
  { keyword: 'postgres', slug: 'postgresql', name: 'PostgreSQL', color: '#4169E1' },
  { keyword: 'mysql', slug: 'mysql', name: 'MySQL', color: '#4479A1' },
  { keyword: 'redis', slug: 'redis', name: 'Redis', color: '#DC382D' },
  { keyword: 'supabase', slug: 'supabase', name: 'Supabase', color: '#3FCF8E' },
  { keyword: 'planetscale', slug: 'planetscale', name: 'PlanetScale', color: '#1A1A2E' },
  { keyword: 'firebase', slug: 'firebase', name: 'Firebase', color: '#DD2C00' },

  // Payments
  { keyword: 'stripe', slug: 'stripe', name: 'Stripe', color: '#635BFF' },
  { keyword: 'paypal', slug: 'paypal', name: 'PayPal', color: '#003087' },

  // Auth
  { keyword: 'auth0', slug: 'auth0', name: 'Auth0', color: '#EB5424' },
  { keyword: 'clerk', slug: 'clerk', name: 'Clerk', color: '#6C47FF' },

  // Communication
  { keyword: 'slack', slug: 'slack', name: 'Slack', color: '#4A154B' },
  { keyword: 'discord', slug: 'discord', name: 'Discord', color: '#5865F2' },
  { keyword: 'twilio', slug: 'twilio', name: 'Twilio', color: '#F22F46' },
  { keyword: 'sendgrid', slug: 'sendgrid', name: 'SendGrid', color: '#1A82E2' },
  { keyword: 'mailgun', slug: 'mailgun', name: 'Mailgun', color: '#F06B66' },

  // Monitoring / DevOps
  { keyword: 'sentry', slug: 'sentry', name: 'Sentry', color: '#362D59' },
  { keyword: 'datadog', slug: 'datadog', name: 'Datadog', color: '#632CA6' },
  { keyword: 'newrelic', slug: 'newrelic', name: 'New Relic', color: '#1CE783' },

  // AI
  { keyword: 'openai', slug: 'openai', name: 'OpenAI', color: '#412991' },
  { keyword: 'anthropic', slug: 'anthropic', name: 'Anthropic', color: '#191919' },
  { keyword: 'claude', slug: 'anthropic', name: 'Anthropic', color: '#191919' },

  // Big tech (after more specific entries)
  { keyword: 'apple', slug: 'apple', name: 'Apple', color: '#1D1D1F' },
  { keyword: 'google', slug: 'google', name: 'Google', color: '#4285F4' },
  { keyword: 'microsoft', slug: 'microsoft', name: 'Microsoft', color: '#5E5E5E' },
  { keyword: 'facebook', slug: 'facebook', name: 'Facebook', color: '#0866FF' },
  { keyword: 'meta', slug: 'meta', name: 'Meta', color: '#0866FF' },
  { keyword: 'twitter', slug: 'x', name: 'X', color: '#14171A' },
  { keyword: 'instagram', slug: 'instagram', name: 'Instagram', color: '#E4405F' },
  { keyword: 'linkedin', slug: 'linkedin', name: 'LinkedIn', color: '#0A66C2' },
  { keyword: 'youtube', slug: 'youtube', name: 'YouTube', color: '#FF0000' },

  // Tools & services
  { keyword: 'docker', slug: 'docker', name: 'Docker', color: '#2496ED' },
  { keyword: 'kubernetes', slug: 'kubernetes', name: 'Kubernetes', color: '#326CE5' },
  { keyword: 'shopify', slug: 'shopify', name: 'Shopify', color: '#7AB55C' },
  { keyword: 'notion', slug: 'notion', name: 'Notion', color: '#1A1A1A' },
  { keyword: 'figma', slug: 'figma', name: 'Figma', color: '#F24E1E' },
  { keyword: 'jira', slug: 'jira', name: 'Jira', color: '#0052CC' },
  { keyword: 'npm', slug: 'npm', name: 'npm', color: '#CB3837' },
  { keyword: 'algolia', slug: 'algolia', name: 'Algolia', color: '#003DFF' },
  { keyword: 'cloudinary', slug: 'cloudinary', name: 'Cloudinary', color: '#3448C5' },
  { keyword: 'twitch', slug: 'twitch', name: 'Twitch', color: '#9146FF' },
  { keyword: 'spotify', slug: 'spotify', name: 'Spotify', color: '#1DB954' },
  { keyword: 'dropbox', slug: 'dropbox', name: 'Dropbox', color: '#0061FF' },
  { keyword: 'hubspot', slug: 'hubspot', name: 'HubSpot', color: '#FF7A59' },
  { keyword: 'intercom', slug: 'intercom', name: 'Intercom', color: '#6AFDEF' },
  { keyword: 'zendesk', slug: 'zendesk', name: 'Zendesk', color: '#03363D' },

  // CMS / Platforms
  { keyword: 'wordpress', slug: 'wordpress', name: 'WordPress', color: '#21759B' },
  { keyword: 'woocommerce', slug: 'woocommerce', name: 'WooCommerce', color: '#96588A' },
  { keyword: 'webflow', slug: 'webflow', name: 'Webflow', color: '#4353FF' },
  { keyword: 'contentful', slug: 'contentful', name: 'Contentful', color: '#2478CC' },
  { keyword: 'sanity', slug: 'sanity', name: 'Sanity', color: '#F03E2F' },
  { keyword: 'strapi', slug: 'strapi', name: 'Strapi', color: '#4945FF' },

  // CI/CD & Infrastructure
  { keyword: 'circleci', slug: 'circleci', name: 'CircleCI', color: '#343434' },
  { keyword: 'jenkins', slug: 'jenkins', name: 'Jenkins', color: '#D24939' },
  { keyword: 'terraform', slug: 'terraform', name: 'Terraform', color: '#844FBA' },
  { keyword: 'grafana', slug: 'grafana', name: 'Grafana', color: '#F46800' },
  { keyword: 'elastic', slug: 'elastic', name: 'Elastic', color: '#005571' },
  { keyword: 'elasticsearch', slug: 'elastic', name: 'Elastic', color: '#005571' },
  { keyword: 'nginx', slug: 'nginx', name: 'NGINX', color: '#009639' },
  { keyword: 'ansible', slug: 'ansible', name: 'Ansible', color: '#EE0000' },

  // Auth & Identity
  { keyword: 'okta', slug: 'okta', name: 'Okta', color: '#007DC1' },

  // Analytics & Data
  { keyword: 'segment', slug: 'segment', name: 'Segment', color: '#52BD95' },
  { keyword: 'mixpanel', slug: 'mixpanel', name: 'Mixpanel', color: '#7856FF' },
  { keyword: 'amplitude', slug: 'amplitude', name: 'Amplitude', color: '#1324E3' },

  // Collaboration & Productivity
  { keyword: 'zoom', slug: 'zoom', name: 'Zoom', color: '#0B5CFF' },
  { keyword: 'trello', slug: 'trello', name: 'Trello', color: '#0052CC' },
  { keyword: 'asana', slug: 'asana', name: 'Asana', color: '#F06A6A' },
  { keyword: 'airtable', slug: 'airtable', name: 'Airtable', color: '#18BFFF' },
  { keyword: 'confluence', slug: 'confluence', name: 'Confluence', color: '#172B4D' },
  { keyword: 'linear', slug: 'linear', name: 'Linear', color: '#5E6AD2' },
  { keyword: 'clickup', slug: 'clickup', name: 'ClickUp', color: '#7B68EE' },
  { keyword: 'monday', slug: 'mondaydotcom', name: 'Monday.com', color: '#FF3D57' },

  // Dev tools & APIs
  { keyword: 'postman', slug: 'postman', name: 'Postman', color: '#FF6C37' },
  { keyword: 'swagger', slug: 'swagger', name: 'Swagger', color: '#85EA2D' },
  { keyword: 'prisma', slug: 'prisma', name: 'Prisma', color: '#2D3748' },
  { keyword: 'graphql', slug: 'graphql', name: 'GraphQL', color: '#E10098' },
  { keyword: 'vercel postgres', slug: 'vercel', name: 'Vercel', color: '#1A1A1A' },
  { keyword: 'upstash', slug: 'upstash', name: 'Upstash', color: '#00E9A3' },
  { keyword: 'neon', slug: 'neon', name: 'Neon', color: '#00E599' },
  { keyword: 'turso', slug: 'turso', name: 'Turso', color: '#4FF8D2' },

  // Cloud storage & CDN
  { keyword: 'backblaze', slug: 'backblaze', name: 'Backblaze', color: '#E21E29' },
  { keyword: 'wasabi', slug: 'wasabi', name: 'Wasabi', color: '#56B946' },
  { keyword: 'bunny', slug: 'bunny', name: 'Bunny', color: '#F6A31b' },
  { keyword: 'fastly', slug: 'fastly', name: 'Fastly', color: '#FF282D' },

  // E-commerce & Payments
  { keyword: 'square', slug: 'square', name: 'Square', color: '#1A1A1A' },
  { keyword: 'braintree', slug: 'braintree', name: 'Braintree', color: '#1A1A1A' },
  { keyword: 'razorpay', slug: 'razorpay', name: 'Razorpay', color: '#0C2451' },
  { keyword: 'paddle', slug: 'paddle', name: 'Paddle', color: '#FDDE09' },
  { keyword: 'lemon squeezy', slug: 'lemonsqueezy', name: 'Lemon Squeezy', color: '#FFC233' },

  // Messaging & Notifications
  { keyword: 'telegram', slug: 'telegram', name: 'Telegram', color: '#26A5E4' },
  { keyword: 'whatsapp', slug: 'whatsapp', name: 'WhatsApp', color: '#25D366' },
  { keyword: 'pusher', slug: 'pusher', name: 'Pusher', color: '#300D4F' },
  { keyword: 'mailchimp', slug: 'mailchimp', name: 'Mailchimp', color: '#FFE01B' },
  { keyword: 'resend', slug: 'resend', name: 'Resend', color: '#1A1A1A' },

  // AI & ML
  { keyword: 'hugging face', slug: 'huggingface', name: 'Hugging Face', color: '#FFD21E' },
  { keyword: 'huggingface', slug: 'huggingface', name: 'Hugging Face', color: '#FFD21E' },
  { keyword: 'replicate', slug: 'replicate', name: 'Replicate', color: '#1A1A1A' },
  { keyword: 'cohere', slug: 'cohere', name: 'Cohere', color: '#39594D' },
  { keyword: 'gemini', slug: 'googlegemini', name: 'Google Gemini', color: '#8E75B2' },
  { keyword: 'mistral', slug: 'mistral', name: 'Mistral', color: '#FF7000' },

  // Misc popular services
  { keyword: 'godaddy', slug: 'godaddy', name: 'GoDaddy', color: '#1BDBDB' },
  { keyword: 'namecheap', slug: 'namecheap', name: 'Namecheap', color: '#DE3723' },
  { keyword: 'reddit', slug: 'reddit', name: 'Reddit', color: '#FF4500' },
  { keyword: 'tiktok', slug: 'tiktok', name: 'TikTok', color: '#1A1A1A' },
  { keyword: 'snapchat', slug: 'snapchat', name: 'Snapchat', color: '#FFFC00' },
  { keyword: 'pinterest', slug: 'pinterest', name: 'Pinterest', color: '#BD081C' },
]

export function detectBrand(label: string): BrandIconMatch | null {
  const lower = label.toLowerCase()
  for (const entry of BRAND_MAP) {
    if (lower.includes(entry.keyword)) {
      return { slug: entry.slug, name: entry.name, color: entry.color, isDark: isColorDark(entry.color) }
    }
  }
  return null
}

export function getBrandIconUrl(slug: string, color: string): string {
  // Remove # from hex color for the URL — use brand color in both light & dark mode
  const hexColor = color.replace('#', '')
  return `https://cdn.simpleicons.org/${slug}/${hexColor}`
}
