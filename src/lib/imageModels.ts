import { ImageGenModel } from '@/types'

// The public image models, for client code that has to render or pick one.
//
// The server keeps its own copy of this mapping in `@/lib/imageGen` and
// re-normalizes whatever arrives, so this file can never cause a bad model to
// be sent — it exists because `@/lib/imageGen` is server-only (it reads the
// service credential) and must not be pulled into a client bundle.

export const IMAGE_GEN_MODELS: { value: ImageGenModel; label: string; description: string }[] = [
  { value: 'flash', label: 'Flash', description: 'Fast standard generation' },
  { value: 'studio', label: 'Studio', description: 'Premium, high-detail generation' },
  { value: 'vivid', label: 'Vivid', description: 'Premium photorealistic generation' },
]

// Model ids stored before the migration. They still sit in user settings and on
// historical rows, so they are translated on the way out and never rendered.
const LEGACY_MODELS: Record<string, ImageGenModel> = {
  'nano-banana': 'flash',
  'nano-banana-2': 'studio',
  'nano-banana-pro': 'studio',
  'imagen-4': 'vivid',
}

export const DEFAULT_IMAGE_GEN_MODEL: ImageGenModel = 'studio'

export function normalizeModel(value: unknown): ImageGenModel {
  if (typeof value !== 'string') return DEFAULT_IMAGE_GEN_MODEL
  const v = value.trim().toLowerCase()
  const known = IMAGE_GEN_MODELS.find((m) => m.value === v)
  if (known) return known.value
  return LEGACY_MODELS[v] || DEFAULT_IMAGE_GEN_MODEL
}

/** Display name for any stored model id, legacy ones included. */
export function modelLabel(value: unknown): string {
  const normalized = normalizeModel(value)
  return IMAGE_GEN_MODELS.find((m) => m.value === normalized)?.label || normalized
}
