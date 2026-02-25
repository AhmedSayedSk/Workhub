import {
  ref,
  uploadBytesResumable,
  getDownloadURL,
  deleteObject,
  UploadTaskSnapshot,
} from 'firebase/storage'
import { storage } from './firebase'
import { FileCategory } from '@/types'

// MIME type to category mapping
const mimeTypeCategories: Record<string, FileCategory> = {
  // Images
  'image/jpeg': 'image',
  'image/png': 'image',
  'image/gif': 'image',
  'image/webp': 'image',
  'image/svg+xml': 'image',
  'image/bmp': 'image',
  'image/tiff': 'image',
  'image/x-icon': 'image',
  // Videos
  'video/mp4': 'video',
  'video/webm': 'video',
  'video/ogg': 'video',
  'video/quicktime': 'video',
  'video/x-msvideo': 'video',
  'video/x-ms-wmv': 'video',
  'video/mpeg': 'video',
  // Audio
  'audio/mpeg': 'audio',
  'audio/mp3': 'audio',
  'audio/wav': 'audio',
  'audio/ogg': 'audio',
  'audio/webm': 'audio',
  'audio/aac': 'audio',
  'audio/flac': 'audio',
  // Documents
  'application/pdf': 'document',
  'application/msword': 'document',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'document',
  'application/vnd.ms-excel': 'document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'document',
  'application/vnd.ms-powerpoint': 'document',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'document',
  'text/plain': 'document',
  'text/markdown': 'document',
  'text/csv': 'document',
  'text/html': 'document',
  'text/css': 'document',
  'text/javascript': 'document',
  'application/json': 'document',
  'application/xml': 'document',
  // Archives
  'application/zip': 'archive',
  'application/x-zip-compressed': 'archive',
  'application/x-rar-compressed': 'archive',
  'application/x-7z-compressed': 'archive',
  'application/gzip': 'archive',
  'application/x-tar': 'archive',
}

export function getFileCategory(mimeType: string): FileCategory {
  return mimeTypeCategories[mimeType] || 'other'
}

export function getFileExtension(fileName: string): string {
  const lastDot = fileName.lastIndexOf('.')
  if (lastDot === -1) return ''
  return fileName.slice(lastDot + 1).toLowerCase()
}

// Extension-based MIME type fallback for when browsers return empty or generic types
const extensionMimeMap: Record<string, string> = {
  md: 'text/markdown',
  markdown: 'text/markdown',
  txt: 'text/plain',
  csv: 'text/csv',
  json: 'application/json',
  xml: 'application/xml',
  html: 'text/html',
  htm: 'text/html',
  css: 'text/css',
  js: 'text/javascript',
  ts: 'text/plain',
  tsx: 'text/plain',
  jsx: 'text/plain',
  yaml: 'text/plain',
  yml: 'text/plain',
  log: 'text/plain',
  env: 'text/plain',
  sh: 'text/plain',
}

export function detectMimeType(fileName: string, browserMimeType: string): string {
  if (browserMimeType && browserMimeType !== 'application/octet-stream') {
    return browserMimeType
  }
  const ext = getFileExtension(fileName)
  return extensionMimeMap[ext] || browserMimeType || 'application/octet-stream'
}

export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B'

  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  const k = 1024
  const i = Math.floor(Math.log(bytes) / Math.log(k))

  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${units[i]}`
}

export function isPreviewable(mimeType: string): boolean {
  const category = getFileCategory(mimeType)

  // Images are always previewable
  if (category === 'image') return true

  // Videos are previewable
  if (category === 'video') return true

  // Audio is previewable
  if (category === 'audio') return true

  // PDFs are previewable
  if (mimeType === 'application/pdf') return true

  // Text and markdown are previewable
  if (mimeType === 'text/plain' || mimeType === 'text/markdown') return true

  return false
}

export function generateStoragePath(userId: string, fileId: string, fileName: string): string {
  const ext = getFileExtension(fileName)
  return `media/${userId}/${fileId}/original${ext ? `.${ext}` : ''}`
}

interface UploadOptions {
  onProgress?: (progress: number) => void
  onComplete?: (url: string) => void
  onError?: (error: Error) => void
  skipOptimization?: boolean
}

// Image optimization settings
export interface ImageOptimizationSettings {
  maxWidth: number
  maxHeight: number
  quality: number // 0-1, where 0.9 = 90%
  outputFormat: 'jpeg' | 'webp' | 'png' | 'original'
}

const DEFAULT_OPTIMIZATION: ImageOptimizationSettings = {
  maxWidth: 1920,
  maxHeight: 1920,
  quality: 0.85, // 85% quality - good balance of size and quality
  outputFormat: 'original',
}

// Check if file is an optimizable image
function isOptimizableImage(mimeType: string): boolean {
  const optimizableTypes = [
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/bmp',
  ]
  return optimizableTypes.includes(mimeType)
}

// Load image from file
function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = URL.createObjectURL(file)
  })
}

// Calculate new dimensions while maintaining aspect ratio
function calculateDimensions(
  originalWidth: number,
  originalHeight: number,
  maxWidth: number,
  maxHeight: number
): { width: number; height: number } {
  let width = originalWidth
  let height = originalHeight

  // Only resize if larger than max dimensions
  if (width > maxWidth || height > maxHeight) {
    const aspectRatio = width / height

    if (width > height) {
      width = Math.min(width, maxWidth)
      height = Math.round(width / aspectRatio)
    } else {
      height = Math.min(height, maxHeight)
      width = Math.round(height * aspectRatio)
    }

    // Double check we don't exceed either dimension
    if (width > maxWidth) {
      width = maxWidth
      height = Math.round(width / aspectRatio)
    }
    if (height > maxHeight) {
      height = maxHeight
      width = Math.round(height * aspectRatio)
    }
  }

  return { width, height }
}

// Optimize image using Canvas API
export async function optimizeImage(
  file: File,
  settings: Partial<ImageOptimizationSettings> = {}
): Promise<{ blob: Blob; width: number; height: number }> {
  const opts = { ...DEFAULT_OPTIMIZATION, ...settings }

  // Load the image
  const img = await loadImage(file)
  const originalWidth = img.naturalWidth
  const originalHeight = img.naturalHeight

  // Calculate new dimensions
  const { width, height } = calculateDimensions(
    originalWidth,
    originalHeight,
    opts.maxWidth,
    opts.maxHeight
  )

  // Create canvas
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')

  if (!ctx) {
    throw new Error('Failed to get canvas context')
  }

  // Enable high-quality image rendering
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'

  // Draw the image
  ctx.drawImage(img, 0, 0, width, height)

  // Clean up object URL
  URL.revokeObjectURL(img.src)

  // Determine output format
  let mimeType: string
  switch (opts.outputFormat) {
    case 'webp':
      mimeType = 'image/webp'
      break
    case 'png':
      mimeType = 'image/png'
      break
    case 'original':
      // Preserve transparency while enabling compression:
      // - PNG → WebP (PNG ignores quality param; WebP supports transparency + lossy compression)
      // - BMP → WebP (BMP has no canvas export support)
      // - WebP stays WebP, JPEG stays JPEG
      if (file.type === 'image/png' || file.type === 'image/bmp') {
        mimeType = 'image/webp'
      } else if (['image/jpeg', 'image/webp'].includes(file.type)) {
        mimeType = file.type
      } else {
        mimeType = 'image/webp'
      }
      break
    case 'jpeg':
    default:
      mimeType = 'image/jpeg'
      break
  }

  // Convert to blob
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) {
          resolve({ blob, width, height })
        } else {
          reject(new Error('Failed to create blob from canvas'))
        }
      },
      mimeType,
      opts.quality
    )
  })
}

// Get optimized file for upload
async function getOptimizedFile(
  file: File,
  settings?: Partial<ImageOptimizationSettings>
): Promise<{ file: File | Blob; optimized: boolean; originalSize: number; newSize: number }> {
  const originalSize = file.size

  // Skip optimization for non-optimizable images (GIF, SVG, etc.)
  if (!isOptimizableImage(file.type)) {
    return { file, optimized: false, originalSize, newSize: originalSize }
  }

  try {
    const { blob } = await optimizeImage(file, settings)

    // Always use optimized version (quality compression applied)
    // Only fall back to original if optimized is somehow larger
    if (blob.size < originalSize) {
      const reduction = Math.round((1 - blob.size / originalSize) * 100)
      console.log(
        `Image optimized: ${formatFileSize(originalSize)} → ${formatFileSize(blob.size)} (${reduction}% reduction)`
      )
      return { file: blob, optimized: true, originalSize, newSize: blob.size }
    } else {
      // Even if sizes are similar, prefer the compressed version for consistency
      // unless it's significantly larger (more than 10% bigger)
      if (blob.size <= originalSize * 1.1) {
        console.log(
          `Image compressed: ${formatFileSize(originalSize)} → ${formatFileSize(blob.size)} (quality normalized)`
        )
        return { file: blob, optimized: true, originalSize, newSize: blob.size }
      }
      console.log('Optimized image is larger, using original')
      return { file, optimized: false, originalSize, newSize: originalSize }
    }
  } catch (error) {
    console.warn('Image optimization failed, using original:', error)
    return { file, optimized: false, originalSize, newSize: originalSize }
  }
}

export interface UploadResult {
  url: string
  size: number
  optimized: boolean
}

export async function uploadFile(
  file: File,
  storagePath: string,
  options?: UploadOptions
): Promise<UploadResult> {
  // Optimize image if applicable
  let fileToUpload: File | Blob = file
  let optimized = false
  const originalSize = file.size

  if (!options?.skipOptimization && isOptimizableImage(file.type)) {
    console.log(`[Upload] Optimizing image: ${file.name} (${formatFileSize(originalSize)})`)
    try {
      const result = await getOptimizedFile(file)
      fileToUpload = result.file
      optimized = result.optimized
      console.log(`[Upload] Optimization complete: ${formatFileSize(originalSize)} → ${formatFileSize(result.newSize)}`)
    } catch (error) {
      console.warn('[Upload] Optimization failed, uploading original:', error)
    }
  }

  const uploadedSize = fileToUpload.size

  return new Promise((resolve, reject) => {
    const storageRef = ref(storage, storagePath)
    const uploadTask = uploadBytesResumable(storageRef, fileToUpload)

    uploadTask.on(
      'state_changed',
      (snapshot: UploadTaskSnapshot) => {
        const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100
        options?.onProgress?.(progress)
      },
      (error) => {
        options?.onError?.(error)
        reject(error)
      },
      async () => {
        try {
          const downloadURL = await getDownloadURL(uploadTask.snapshot.ref)
          options?.onComplete?.(downloadURL)
          resolve({ url: downloadURL, size: uploadedSize, optimized })
        } catch (error) {
          options?.onError?.(error as Error)
          reject(error)
        }
      }
    )
  })
}

// Upload file with custom optimization settings
export async function uploadFileWithOptimization(
  file: File,
  storagePath: string,
  optimizationSettings: Partial<ImageOptimizationSettings>,
  options?: Omit<UploadOptions, 'skipOptimization'>
): Promise<{ url: string; optimized: boolean; originalSize: number; newSize: number }> {
  let fileToUpload: File | Blob = file
  let optimized = false
  const originalSize = file.size
  let newSize = originalSize

  if (isOptimizableImage(file.type)) {
    try {
      const result = await getOptimizedFile(file, optimizationSettings)
      fileToUpload = result.file
      optimized = result.optimized
      newSize = result.newSize
    } catch (error) {
      console.warn('Optimization failed, uploading original:', error)
    }
  }

  const url = await new Promise<string>((resolve, reject) => {
    const storageRef = ref(storage, storagePath)
    const uploadTask = uploadBytesResumable(storageRef, fileToUpload)

    uploadTask.on(
      'state_changed',
      (snapshot: UploadTaskSnapshot) => {
        const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100
        options?.onProgress?.(progress)
      },
      (error) => {
        options?.onError?.(error)
        reject(error)
      },
      async () => {
        try {
          const downloadURL = await getDownloadURL(uploadTask.snapshot.ref)
          options?.onComplete?.(downloadURL)
          resolve(downloadURL)
        } catch (error) {
          options?.onError?.(error as Error)
          reject(error)
        }
      }
    )
  })

  return { url, optimized, originalSize, newSize }
}

export async function uploadBlob(
  blob: Blob,
  storagePath: string,
  onProgress?: (progress: number) => void
): Promise<string> {
  const storageRef = ref(storage, storagePath)
  const uploadTask = uploadBytesResumable(storageRef, blob)

  return new Promise((resolve, reject) => {
    uploadTask.on(
      'state_changed',
      (snapshot: UploadTaskSnapshot) => {
        const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100
        onProgress?.(progress)
      },
      reject,
      async () => {
        try {
          const url = await getDownloadURL(uploadTask.snapshot.ref)
          resolve(url)
        } catch (error) {
          reject(error)
        }
      }
    )
  })
}

export async function deleteFile(storagePath: string): Promise<void> {
  const storageRef = ref(storage, storagePath)
  await deleteObject(storageRef)
}

export async function getFileUrl(storagePath: string): Promise<string> {
  const storageRef = ref(storage, storagePath)
  return getDownloadURL(storageRef)
}

// Maximum file size in bytes (50MB)
export const MAX_FILE_SIZE = 50 * 1024 * 1024

// Export default optimization settings for reference
export const DEFAULT_IMAGE_OPTIMIZATION = DEFAULT_OPTIMIZATION

// Preset optimization profiles
export const OPTIMIZATION_PRESETS = {
  // High quality for important images (icons, logos)
  highQuality: {
    maxWidth: 2048,
    maxHeight: 2048,
    quality: 0.9,
    outputFormat: 'original' as const,
  },
  // Standard quality for general images (default)
  standard: {
    maxWidth: 1920,
    maxHeight: 1920,
    quality: 0.85,
    outputFormat: 'original' as const,
  },
  // Lower quality for faster loading
  compressed: {
    maxWidth: 1280,
    maxHeight: 1280,
    quality: 0.75,
    outputFormat: 'original' as const,
  },
  // Thumbnail quality for previews
  thumbnail: {
    maxWidth: 512,
    maxHeight: 512,
    quality: 0.8,
    outputFormat: 'original' as const,
  },
  // WebP format for modern browsers (better compression)
  webp: {
    maxWidth: 1920,
    maxHeight: 1920,
    quality: 0.85,
    outputFormat: 'webp' as const,
  },
}

export function validateFileSize(file: File): boolean {
  return file.size <= MAX_FILE_SIZE
}

export function getAcceptedFileTypes(): string {
  return '*/*'
}
