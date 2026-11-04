import { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import { getAnnouncements, type ApiAnnouncement } from '@/lib/api'
import { cn } from '@/lib/utils'

const DISMISS_KEY = 'lca-announcements-dismissed'

/**
 * Every tone here has been checked against its own text colour:
 * gold 6.51:1, navy 14.81:1, urgent 8.15:1, info 8.74:1. All clear AA.
 * A new tone needs its pairing checked before it goes in.
 */
const TONES: Record<string, string> = {
  gold: 'bg-lca-gold text-brand-navy',
  navy: 'bg-brand-navy text-white',
  urgent: 'bg-[#9b1c1c] text-white',
  info: 'bg-[#1e4d7b] text-white',
}

/**
 * The tones on a dark ground that is not a navy band. They carry
 * data-ground="dark", so under the new look the focus ring on their link and
 * dismiss button turns gold. The navy tone is a bg-brand-navy box, which the
 * ring rule already covers. The gold tone, and a tone the banner does not
 * know, which it draws gold, carry data-ring-ground="gold" instead: under
 * the new look their ring is navy in the light look and in dark mode alike,
 * never the dark mode's gold ring on the gold (src/index.css).
 */
const DARK_GROUND_TONES = new Set(['urgent', 'info'])

/** The classes a tone draws; a tone the banner does not know is drawn gold. */
const toneOf = (tone: string) => TONES[tone] ?? TONES.gold

const SIZES: Record<string, string> = {
  default: 'px-4 py-2 text-sm',
  compact: 'px-4 py-1 text-xs',
}

/** Ids dismissed this session, so one banner closing never hides another. */
function readDismissed(): string[] {
  try {
    const raw = sessionStorage.getItem(DISMISS_KEY)
    return raw ? (JSON.parse(raw) as string[]) : []
  } catch {
    // Private windows and blocked storage both land here. Showing a banner
    // again is a far smaller problem than the component failing to render.
    return []
  }
}

export function AnnouncementBanner() {
  const [announcements, setAnnouncements] = useState<ApiAnnouncement[]>([])
  const [dismissed, setDismissed] = useState<string[]>(readDismissed)

  useEffect(() => {
    getAnnouncements()
      .then(({ announcements }) => setAnnouncements(announcements))
      .catch(() => setAnnouncements([]))
  }, [])

  function handleDismiss(id: string) {
    const next = [...dismissed, id]
    setDismissed(next)
    try {
      sessionStorage.setItem(DISMISS_KEY, JSON.stringify(next))
    } catch { /* see readDismissed */ }
  }

  const visible = announcements.filter((a) => !dismissed.includes(a.id))
  if (visible.length === 0) return null

  return (
    <div>
      {visible.map((a) => (
        <div
          key={a.id}
          className={cn(
            'flex items-center justify-center gap-3 text-center',
            toneOf(a.tone),
            SIZES[a.size] ?? SIZES.default,
          )}
          data-ground={DARK_GROUND_TONES.has(a.tone) ? 'dark' : undefined}
          data-ring-ground={toneOf(a.tone) === TONES.gold ? 'gold' : undefined}
        >
          <span>
            {a.message}
            {a.linkUrl && a.linkLabel && (
              <>
                {' '}
                <a
                  href={a.linkUrl}
                  target={a.linkUrl.startsWith('/') ? undefined : '_blank'}
                  rel={a.linkUrl.startsWith('/') ? undefined : 'noopener noreferrer'}
                  className="font-semibold underline underline-offset-2"
                >
                  {a.linkLabel}
                </a>
              </>
            )}
          </span>
          <button
            type="button"
            onClick={() => handleDismiss(a.id)}
            aria-label={`Dismiss: ${a.linkLabel || a.message}`}
            className="flex-shrink-0 opacity-70 transition-opacity hover:opacity-100"
          >
            <X className="size-4" />
          </button>
        </div>
      ))}
    </div>
  )
}
