// test/unit/fixtures/rich-text-editor-today.tsx
//
// Today's message editor, src/areas/governance/components/RichTextEditor.tsx
// as it stood at commit d2c5ec0, the merge of checkpoint M, kept word for word
// but for this comment, its export's name, RichTextEditorToday, and the one
// dash in its comment, written as a comma, so this file holds no dash
// character. test/unit/rich-text-editor-phone.test.tsx draws it beside the
// live editor, which every use but the newsletter tab draws with no choice of
// its own, and holds the two the same.
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Link from '@tiptap/extension-link'
import { Bold, Italic, List, ListOrdered, Heading2, LinkIcon } from 'lucide-react'
import { Toggle } from '@/components/ui/toggle'
import { useEffect } from 'react'

/**
 * A bare domain/path typed with no scheme (e.g. "link.org") is a RELATIVE
 * URL to a browser, clicked from /admin/email, "link.org" resolves to
 * ".../admin/link.org", not "https://link.org". Assume https for anything
 * that doesn't already declare a scheme (http, https, mailto, tel, etc.),
 * so links behave the way whoever typed them obviously intended.
 */
function normalizeUrl(raw: string): string {
  const trimmed = raw.trim()
  if (!trimmed) return trimmed
  if (/^[a-z][a-z0-9+.-]*:/i.test(trimmed)) return trimmed
  return `https://${trimmed}`
}

export function RichTextEditorToday({
  content,
  onChange,
}: {
  content: string
  onChange: (html: string) => void
}) {
  const editor = useEditor({
    extensions: [StarterKit, Link.configure({ openOnClick: false })],
    content,
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
    editorProps: {
      attributes: {
        class: 'prose prose-sm max-w-none min-h-[200px] focus:outline-none px-3 py-2 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_li]:my-0.5',
      },
    },
  })

  // Allow parent to push in newly-parsed content (e.g. after a file upload)
  useEffect(() => {
    if (editor && content !== editor.getHTML()) {
      editor.commands.setContent(content || '')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [content])

  if (!editor) return null

  return (
    <div className="rounded-md border bg-background">
      <div className="flex flex-wrap gap-1 border-b p-1.5">
        <Toggle size="sm" pressed={editor.isActive('bold')} onPressedChange={() => editor.chain().focus().toggleBold().run()}>
          <Bold className="size-3.5" />
        </Toggle>
        <Toggle size="sm" pressed={editor.isActive('italic')} onPressedChange={() => editor.chain().focus().toggleItalic().run()}>
          <Italic className="size-3.5" />
        </Toggle>
        <Toggle size="sm" pressed={editor.isActive('heading', { level: 2 })} onPressedChange={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}>
          <Heading2 className="size-3.5" />
        </Toggle>
        <Toggle size="sm" pressed={editor.isActive('bulletList')} onPressedChange={() => editor.chain().focus().toggleBulletList().run()}>
          <List className="size-3.5" />
        </Toggle>
        <Toggle size="sm" pressed={editor.isActive('orderedList')} onPressedChange={() => editor.chain().focus().toggleOrderedList().run()}>
          <ListOrdered className="size-3.5" />
        </Toggle>
        <Toggle
          size="sm"
          pressed={editor.isActive('link')}
          onPressedChange={() => {
            const url = window.prompt('Link URL')
            if (url) editor.chain().focus().setLink({ href: normalizeUrl(url) }).run()
          }}
        >
          <LinkIcon className="size-3.5" />
        </Toggle>
      </div>
      <EditorContent editor={editor} />
    </div>
  )
}
