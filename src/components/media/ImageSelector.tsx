'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useAuth } from '@/hooks/useAuth'
import { mediaFiles } from '@/lib/firestore'
import { uploadFile, generateStoragePath, getFileCategory, validateFileSize, MAX_FILE_SIZE } from '@/lib/storage'
import { MediaFile } from '@/types'
import { cn, formatFileSize, generateId } from '@/lib/utils'
import {
  Search,
  Upload,
  Loader2,
  Image as ImageIcon,
  Check,
  X,
} from 'lucide-react'
import { CachedImage } from './CachedImage'
import { useToast } from '@/hooks/useToast'

interface ImageSelectorProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSelect: (url: string) => void
  currentValue?: string | null
}

export function ImageSelector({
  open,
  onOpenChange,
  onSelect,
  currentValue,
}: ImageSelectorProps) {
  const { user } = useAuth()
  const { toast } = useToast()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [images, setImages] = useState<MediaFile[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedUrl, setSelectedUrl] = useState<string | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)

  const fetchImages = useCallback(async () => {
    if (!user?.uid) return

    try {
      setLoading(true)
      const allFiles = await mediaFiles.getAll(user.uid)
      // Filter to only images
      const imageFiles = allFiles.filter((f) => f.category === 'image')
      setImages(imageFiles)
    } catch (error) {
      console.error('Failed to load images:', error)
    } finally {
      setLoading(false)
    }
  }, [user?.uid])

  useEffect(() => {
    if (open) {
      setSelectedUrl(currentValue || null)
      fetchImages()
    }
  }, [open, currentValue, fetchImages])

  const filteredImages = images.filter((img) =>
    img.displayName.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast({
        title: 'Error',
        description: 'Please select an image file',
        variant: 'destructive',
      })
      return
    }

    // Validate file size
    if (!validateFileSize(file)) {
      toast({
        title: 'Error',
        description: `File size must be less than ${formatFileSize(MAX_FILE_SIZE)}`,
        variant: 'destructive',
      })
      return
    }

    if (!user?.uid) return

    setIsUploading(true)
    setUploadProgress(0)

    try {
      const fileId = generateId()
      const storagePath = generateStoragePath(user.uid, fileId, file.name)

      const result = await uploadFile(file, storagePath, {
        onProgress: (progress) => setUploadProgress(progress),
      })

      // Create media file record with optimized size
      await mediaFiles.create({
        name: file.name,
        displayName: file.name,
        mimeType: file.type,
        category: getFileCategory(file.type),
        size: result.size, // Use optimized size
        url: result.url,
        storagePath,
        thumbnailUrl: null,
        folderId: null,
        linkedProjects: [],
        linkedTasks: [],
        uploadedBy: user.uid,
        metadata: {},
      })

      toast({
        description: 'Image uploaded successfully',
        variant: 'success',
      })

      // Refresh the list and select the new image
      await fetchImages()
      setSelectedUrl(result.url)
    } catch (error) {
      console.error('Upload error:', error)
      toast({
        title: 'Error',
        description: 'Failed to upload image',
        variant: 'destructive',
      })
    } finally {
      setIsUploading(false)
      setUploadProgress(0)
    }
  }

  const handleConfirm = () => {
    if (selectedUrl) {
      onSelect(selectedUrl)
      onOpenChange(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Select Image</DialogTitle>
          <DialogDescription>
            Choose an image from your media library or upload a new one
          </DialogDescription>
        </DialogHeader>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleFileSelect}
        />

        <div className="flex items-center gap-2 mb-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search images..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
            />
          </div>
          <Button
            variant="outline"
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
          >
            {isUploading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                {Math.round(uploadProgress)}%
              </>
            ) : (
              <>
                <Upload className="h-4 w-4 mr-2" />
                Upload
              </>
            )}
          </Button>
        </div>

        <ScrollArea className="flex-1 min-h-0 -mx-6 px-6">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : filteredImages.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <ImageIcon className="h-12 w-12 mb-4 opacity-50" />
              <p className="font-medium">No images found</p>
              <p className="text-sm">Upload an image to get started</p>
            </div>
          ) : (
            <div className="grid grid-cols-5 sm:grid-cols-6 gap-3 pb-4">
              {filteredImages.map((image) => (
                <div
                  key={image.id}
                  onClick={() => setSelectedUrl(image.url)}
                  className={cn(
                    'relative aspect-square rounded-lg overflow-hidden cursor-pointer border-2 transition-all hover:opacity-90 bg-[image:repeating-conic-gradient(#80808015_0%_25%,transparent_0%_50%)] bg-[length:12px_12px]',
                    selectedUrl === image.url
                      ? 'border-primary ring-2 ring-primary ring-offset-2'
                      : 'border-transparent hover:border-muted-foreground/25'
                  )}
                >
                  <CachedImage
                    src={image.thumbnailUrl || image.url}
                    alt={image.displayName}
                    className="w-full h-full object-contain"
                  />
                  {selectedUrl === image.url && (
                    <div className="absolute inset-0 bg-primary/20 flex items-center justify-center">
                      <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center">
                        <Check className="h-4 w-4 text-primary-foreground" />
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </ScrollArea>

        <DialogFooter className="mt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleConfirm} disabled={!selectedUrl}>
            Select Image
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
