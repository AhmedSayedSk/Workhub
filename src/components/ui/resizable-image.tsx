'use client'

import { Node, mergeAttributes } from '@tiptap/core'
import { ReactNodeViewRenderer, NodeViewWrapper, type ReactNodeViewProps } from '@tiptap/react'
import { useState, useCallback, useRef, useEffect } from 'react'

// Extend TipTap's command types so `setImage` is recognized on ChainedCommands
declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    resizableImage: {
      setImage: (options: { src: string; alt?: string; title?: string; width?: number }) => ReturnType
    }
  }
}

// ─── React NodeView Component ───
function ResizableImageView(props: ReactNodeViewProps) {
  const { node, updateAttributes, selected, editor } = props
  const src = node.attrs.src as string
  const alt = (node.attrs.alt as string) || ''
  const title = (node.attrs.title as string) || ''
  const width = node.attrs.width as number | null

  const isEditable = editor.isEditable
  const [isResizing, setIsResizing] = useState(false)
  const imgRef = useRef<HTMLImageElement>(null)
  const startXRef = useRef(0)
  const startWidthRef = useRef(0)

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (!isEditable) return
      e.preventDefault()
      e.stopPropagation()
      setIsResizing(true)
      startXRef.current = e.clientX
      startWidthRef.current = imgRef.current?.offsetWidth || 0
    },
    [isEditable]
  )

  useEffect(() => {
    if (!isResizing) return

    const handleMouseMove = (e: MouseEvent) => {
      const diff = e.clientX - startXRef.current
      const newWidth = Math.max(50, startWidthRef.current + diff)
      if (imgRef.current) {
        imgRef.current.style.width = `${newWidth}px`
      }
    }

    const handleMouseUp = () => {
      setIsResizing(false)
      if (imgRef.current) {
        updateAttributes({ width: imgRef.current.offsetWidth })
      }
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isResizing, updateAttributes])

  return (
    <NodeViewWrapper className="resizable-image-wrapper" data-drag-handle>
      <div
        className={`resizable-image-container ${selected && isEditable ? 'selected' : ''} ${isResizing ? 'resizing' : ''}`}
        style={{ width: width ? `${width}px` : undefined, display: 'inline-block', maxWidth: '100%' }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          ref={imgRef}
          src={src}
          alt={alt}
          title={title || undefined}
          style={{ width: width ? `${width}px` : undefined }}
          draggable={false}
        />
        {isEditable && selected && (
          <div
            className="resize-handle"
            onMouseDown={handleMouseDown}
          />
        )}
      </div>
    </NodeViewWrapper>
  )
}

// ─── TipTap Extension ───
export const ResizableImage = Node.create({
  name: 'image',

  group: 'block',

  atom: true,

  draggable: true,

  addAttributes() {
    return {
      src: { default: null },
      alt: { default: null },
      title: { default: null },
      width: {
        default: null,
        parseHTML: (element: HTMLElement) => {
          // Check direct width attribute
          const w = element.getAttribute('width')
          if (w) return parseInt(w, 10) || null
          // Check inline style
          const style = element.getAttribute('style')
          const match = style?.match(/width:\s*(\d+)px/)
          if (match) return parseInt(match[1], 10)
          return null
        },
        renderHTML: (attributes: Record<string, unknown>) => {
          if (!attributes.width) return {}
          return { width: attributes.width }
        },
      },
    }
  },

  parseHTML() {
    return [{ tag: 'img[src]' }]
  },

  renderHTML({ HTMLAttributes }) {
    return ['img', mergeAttributes(HTMLAttributes)]
  },

  addStorage() {
    return {
      markdown: {
        // Custom serializer: output <img> HTML when width is set, standard markdown otherwise
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        serialize(state: any, node: any) {
          if (node.attrs.width) {
            const src = node.attrs.src || ''
            const alt = node.attrs.alt || ''
            const title = node.attrs.title || ''
            const width = node.attrs.width
            const parts = [`src="${src}"`]
            if (alt) parts.push(`alt="${alt}"`)
            if (title) parts.push(`title="${title}"`)
            parts.push(`width="${width}"`)
            state.write(`<img ${parts.join(' ')}>`)
            state.closeBlock(node)
          } else {
            state.write(
              '![' +
                state.esc(node.attrs.alt || '') +
                '](' +
                (node.attrs.src || '').replace(/[()]/g, '\\$&') +
                (node.attrs.title
                  ? ' "' + node.attrs.title.replace(/"/g, '\\"') + '"'
                  : '') +
                ')'
            )
            state.closeBlock(node)
          }
        },
        // parse: handled by markdown-it (inherited from defaults)
      },
    }
  },

  addNodeView() {
    return ReactNodeViewRenderer(ResizableImageView)
  },

  addCommands() {
    return {
      setImage:
        (options: { src: string; alt?: string; title?: string; width?: number }) =>
        ({ commands }) => {
          return commands.insertContent({
            type: this.name,
            attrs: options,
          })
        },
    }
  },
})
