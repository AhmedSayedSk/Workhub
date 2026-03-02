'use client'

import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Link from '@tiptap/extension-link'
import { Markdown } from 'tiptap-markdown'
import { useEffect } from 'react'

interface MarkdownContentProps {
  content: string
  className?: string
}

/**
 * Lightweight read-only markdown renderer using Tiptap.
 * Reuses the existing ProseMirror CSS for headings, lists, code blocks, etc.
 */
export function MarkdownContent({ content, className }: MarkdownContentProps) {
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
      }),
      Link.configure({
        openOnClick: true,
        HTMLAttributes: { class: 'rich-editor-link', target: '_blank', rel: 'noopener' },
      }),
      Markdown.configure({
        html: false,
        transformPastedText: false,
        transformCopiedText: false,
      }),
    ],
    content,
    editable: false,
  })

  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if (editor && content !== (editor.storage as any).markdown.getMarkdown()) {
      editor.commands.setContent(content)
    }
  }, [editor, content])

  if (!editor) return null

  return (
    <div className={className || 'prose-viewer'}>
      <EditorContent editor={editor} />
    </div>
  )
}
