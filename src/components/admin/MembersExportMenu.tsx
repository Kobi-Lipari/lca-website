// src/components/admin/MembersExportMenu.tsx
//
// Admin → Members: "Export" opens a small panel to pick what to export
// (just emails, or the full member list) and whom (everyone, current LCA
// members, or lapsed), then download a CSV or copy the addresses for an
// email's BCC line. Each export is recorded in the admin activity log.
import { useEffect, useRef, useState } from 'react'
import { Check, Copy, Download } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { adminExportEmailList, adminExportMembers, type MemberExportOptions } from '@/lib/api'
import { cn } from '@/lib/utils'

const WHO: Array<[MemberExportOptions['who'], string]> = [
  ['all', 'Everyone with an account'],
  ['current', 'Current LCA members'],
  ['lapsed', 'Not current (expired or never joined)'],
]

export function MembersExportMenu() {
  const [open, setOpen] = useState(false)
  const [opts, setOpts] = useState<MemberExportOptions>({ type: 'emails', who: 'all', children: false })
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null)
  const box = useRef<HTMLDivElement>(null)

  // Close on outside click or Escape.
  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => { if (box.current && !box.current.contains(e.target as Node)) setOpen(false) }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey) }
  }, [open])

  async function download() {
    setBusy(true)
    setNote(null)
    try {
      const { blob, filename, count } = await adminExportMembers(opts)
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      a.click()
      URL.revokeObjectURL(url)
      setNote({ ok: true, text: `Downloaded ${count} ${opts.type === 'emails' ? 'addresses' : 'members'}.` })
    } catch (err) {
      setNote({ ok: false, text: err instanceof Error ? err.message : 'Export failed' })
    } finally {
      setBusy(false)
    }
  }

  async function copy() {
    setBusy(true)
    setNote(null)
    try {
      const emails = await adminExportEmailList(opts)
      await navigator.clipboard.writeText(emails.join(', '))
      setNote({ ok: true, text: `Copied ${emails.length} addresses. Paste them into BCC so recipients don't see each other.` })
    } catch (err) {
      setNote({ ok: false, text: err instanceof Error ? err.message : 'Could not copy' })
    } finally {
      setBusy(false)
    }
  }

  const option = (active: boolean) => cn(
    'flex cursor-pointer items-start gap-2 rounded-md border px-3 py-2 text-sm',
    active ? 'border-lca-navy bg-lca-navy/[0.04]' : 'hover:border-lca-navy/30',
  )

  return (
    <div className="relative" ref={box}>
      <Button type="button" variant="outline" size="sm" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        <Download className="mr-1.5 size-3.5" /> Export
      </Button>
      {open && (
        <>
          {/* Phones: a sheet pinned inside the screen, over a dimmed page.
              Wider screens: a dropdown under the button. */}
          <div className="fixed inset-0 z-30 bg-black/30 sm:hidden" aria-hidden onClick={() => setOpen(false)} />
          <div role="dialog" aria-label="Export members"
          className="fixed inset-x-4 top-20 z-40 max-h-[calc(100dvh-6rem)] space-y-4 overflow-y-auto rounded-xl border bg-card p-4 shadow-lg sm:absolute sm:inset-x-auto sm:right-0 sm:top-auto sm:mt-2 sm:w-[22rem] sm:max-h-none sm:overflow-visible">
          <div className="space-y-1.5">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">What</p>
            <label className={option(opts.type === 'emails')}>
              <input type="radio" name="exp-type" className="mt-0.5" checked={opts.type === 'emails'} onChange={() => setOpts((o) => ({ ...o, type: 'emails' }))} />
              <span><span className="font-medium">Email list</span><span className="block text-xs text-muted-foreground">Name and email. Each address once (families share one).</span></span>
            </label>
            <label className={option(opts.type === 'full')}>
              <input type="radio" name="exp-type" className="mt-0.5" checked={opts.type === 'full'} onChange={() => setOpts((o) => ({ ...o, type: 'full' }))} />
              <span><span className="font-medium">Full member list</span><span className="block text-xs text-muted-foreground">Email, role, club, LCA and US Chess membership and dates.</span></span>
            </label>
          </div>

          <div className="space-y-1">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Who</p>
            <select className="w-full rounded-md border bg-background px-2.5 py-1.5 text-sm" value={opts.who}
              onChange={(e) => setOpts((o) => ({ ...o, who: e.target.value as MemberExportOptions['who'] }))}>
              {WHO.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
            {opts.type === 'full' && (
              <label className="mt-1.5 flex items-center gap-2 text-sm">
                <input type="checkbox" checked={!!opts.children} onChange={(e) => setOpts((o) => ({ ...o, children: e.target.checked }))} />
                Include children on family accounts
              </label>
            )}
          </div>

          <div className="flex flex-wrap gap-2">
            <Button type="button" size="sm" disabled={busy} onClick={download}>
              <Download className="mr-1.5 size-3.5" /> Download CSV
            </Button>
            {opts.type === 'emails' && (
              <Button type="button" size="sm" variant="outline" disabled={busy} onClick={copy}>
                {note?.ok && note.text.startsWith('Copied') ? <Check className="mr-1.5 size-3.5" /> : <Copy className="mr-1.5 size-3.5" />}
                Copy addresses
              </Button>
            )}
          </div>
          {note && <p className={cn('text-xs', note.ok ? 'text-emerald-700' : 'text-destructive')}>{note.text}</p>}
          <p className="text-[11px] text-muted-foreground">
            Opens in Excel or Google Sheets. Each export is recorded in Admin activity. Member contact details are for LCA
            business only; please don't share the file outside the board.
          </p>
          </div>
        </>
      )}
    </div>
  )
}
