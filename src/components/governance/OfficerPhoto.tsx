// src/components/governance/OfficerPhoto.tsx
//
// An officer's photo on a board card, or their initials until there is one.
// Admins get a small "photo" control to add, change or remove it.
import { useRef, useState } from 'react'
import { Camera } from 'lucide-react'

import { adminRemoveOfficerPhoto, adminUploadOfficerPhoto } from '@/lib/api'
import { cropToSquare } from '@/lib/resizeImage'
import { cn } from '@/lib/utils'

const initials = (name: string) =>
  name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? '').join('') || '?'

export function OfficerPhoto({ name, photoUrl, size = 56, className }: {
  name: string
  photoUrl?: string | null
  size?: number
  className?: string
}) {
  const style = { width: size, height: size }
  if (photoUrl) {
    return (
      <img src={photoUrl} alt={name} width={size} height={size} loading="lazy" style={style}
        className={cn('flex-shrink-0 rounded-full object-cover ring-2 ring-lca-gold/40', className)} />
    )
  }
  return (
    <span aria-hidden style={style}
      className={cn('flex flex-shrink-0 items-center justify-center rounded-full bg-lca-navy/10 text-sm font-semibold text-lca-navy', className)}>
      {initials(name)}
    </span>
  )
}

/** Admin control: pick a photo (cropped square in the browser), or remove it. */
export function OfficerPhotoControl({ target, hasPhoto, onChanged }: {
  target: { member?: string; seat?: string }
  hasPhoto: boolean
  onChanged: (photoUrl: string | null) => void
}) {
  const input = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function pick(file: File | undefined) {
    if (!file) return
    setBusy(true)
    setError(null)
    try {
      const { photoUrl } = await adminUploadOfficerPhoto(target, await cropToSquare(file))
      onChanged(photoUrl)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setBusy(false)
      if (input.current) input.current.value = ''
    }
  }

  async function remove() {
    setBusy(true)
    setError(null)
    try {
      await adminRemoveOfficerPhoto(target)
      onChanged(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not remove')
    } finally {
      setBusy(false)
    }
  }

  return (
    <span className="inline-flex flex-wrap items-center gap-2 text-[11px]">
      <input ref={input} type="file" accept="image/*" className="hidden" onChange={(e) => pick(e.target.files?.[0])} />
      <button type="button" disabled={busy} onClick={() => input.current?.click()}
        className="inline-flex items-center gap-1 text-lca-navy underline-offset-2 hover:underline disabled:opacity-50">
        <Camera className="size-3" /> {busy ? 'Saving…' : hasPhoto ? 'Change photo' : 'Add photo'}
      </button>
      {hasPhoto && !busy && (
        <button type="button" onClick={remove} className="text-muted-foreground hover:text-destructive">Remove</button>
      )}
      {error && <span className="text-destructive">{error}</span>}
    </span>
  )
}
