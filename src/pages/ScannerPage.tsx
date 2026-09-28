// src/pages/ScannerPage.tsx
//
// Scoresheet scanner: photo of a handwritten scoresheet in, playable game
// out. Public page; scanning needs an account because each scan is a paid
// vision-model call (see functions/api/scan). The flow:
//
//   pick a photo → shrink it in the browser → POST /api/scan (verbatim
//   transcription) → decode in a Web Worker (chess legality) → results
//
// Nothing is stored: the photo lives in this tab's memory until the member
// leaves or scans another.

import { useEffect, useRef, useState, type ChangeEvent, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import {
  Camera,
  Check,
  Copy,
  ExternalLink,
  ImagePlus,
  Loader2,
  LogIn,
  RotateCcw,
  ShieldCheck,
  TriangleAlert,
} from 'lucide-react'

import { PageHero } from '@/components/PageHero'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/contexts/auth-context'
import { usePageTitle } from '@/hooks/usePageTitle'
import { ApiError, scanScoresheet } from '@/lib/api'
import { GOLD_BUTTON } from '@/lib/brand'
import { downscaleImage } from '@/lib/resizeImage'
import { decodeInBackground } from '@/lib/scanner/decodeInBackground'
import { gameToPgn, lichessAnalysisUrl } from '@/lib/scanner/export'
import type { DecodedGame, DecodedMove, RawScan } from '@/lib/scanner/types'
import { cn } from '@/lib/utils'

// ── Page ─────────────────────────────────────────────────────────────

export function ScannerPage() {
  usePageTitle('Scoresheet scanner')
  const { user, loading } = useAuth()

  return (
    <div>
      <PageHero
        title="Scoresheet scanner"
        subtitle="Photograph a handwritten scoresheet and get the game back as moves you can replay, check, and analyze on lichess."
      />
      <section className="mx-auto max-w-6xl px-6 py-10">
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_300px]">
          <div className="min-w-0">
            {loading ? (
              <div role="status" className="flex items-center gap-2 py-16 text-muted-foreground">
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                <span className="text-sm">Loading…</span>
              </div>
            ) : user ? (
              <ScannerTool />
            ) : (
              <SignInPrompt />
            )}
          </div>
          <HowItWorks />
        </div>
      </section>
    </div>
  )
}

function SignInPrompt() {
  return (
    <div className="rounded-xl border bg-card p-6 shadow-sm sm:p-8">
      <div className="flex size-11 items-center justify-center rounded-lg bg-lca-gold/10">
        <LogIn className="size-5 text-lca-gold" aria-hidden="true" />
      </div>
      <h2 className="mt-4 text-xl font-semibold text-lca-navy">Log in to scan a scoresheet</h2>
      <p className="mt-2 max-w-prose text-sm leading-relaxed text-muted-foreground">
        The scanner is free with an LCA account. Log in, take a photo of your scoresheet, and
        you'll have the game on a board in under a minute.
      </p>
      <div className="mt-6 flex flex-wrap gap-3">
        <Button asChild className={GOLD_BUTTON}>
          <Link to="/login" state={{ from: '/scanner' }}>
            Log in to scan
          </Link>
        </Button>
        <Button asChild variant="outline">
          <Link to="/register">Create an account</Link>
        </Button>
      </div>
    </div>
  )
}

function HowItWorks() {
  const steps = [
    ['Photograph the sheet', 'Flat, well lit, with the whole move grid in the frame.'],
    ['We read the handwriting', 'Exactly as written, mistakes included.'],
    ['Chess rules check every move', 'Unclear moves are worked out from the position and flagged for you.'],
    ['Review and analyze', 'Open the game on lichess or copy the PGN.'],
  ]
  return (
    <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
      <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
        <div className="bg-lca-navy px-4 py-3">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-white/60">How it works</p>
        </div>
        <ol className="space-y-3 p-4">
          {steps.map(([title, body], i) => (
            <li key={title} className="flex gap-3">
              <span className="flex size-6 flex-shrink-0 items-center justify-center rounded-full bg-lca-gold/15 text-xs font-semibold text-lca-navy">
                {i + 1}
              </span>
              <div>
                <p className="text-sm font-medium text-foreground">{title}</p>
                <p className="text-xs leading-relaxed text-muted-foreground">{body}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>
      <p className="flex gap-2 px-1 text-xs leading-relaxed text-muted-foreground">
        <ShieldCheck className="mt-0.5 size-3.5 flex-shrink-0 text-lca-gold" aria-hidden="true" />
        Photos are read once and never stored. Up to 20 scans per day.
      </p>
    </aside>
  )
}

// ── The tool ─────────────────────────────────────────────────────────

type Stage =
  | { kind: 'pick' }
  | { kind: 'preview'; file: File }
  | { kind: 'working'; step: 'reading' | 'decoding' }
  | { kind: 'done'; scan: RawScan; game: DecodedGame; scansLeft: number }
  | { kind: 'unreadable'; notes: string[]; scansLeft: number }
  | { kind: 'error'; message: string; canRetry: boolean }

function ScannerTool() {
  const [stage, setStage] = useState<Stage>({ kind: 'pick' })
  const [file, setFile] = useState<File | null>(null)
  const previewUrl = useObjectUrl(file)

  function choose(chosen: File) {
    setFile(chosen)
    setStage({ kind: 'preview', file: chosen })
  }

  function startOver() {
    setFile(null)
    setStage({ kind: 'pick' })
  }

  async function scan(photo: File) {
    setStage({ kind: 'working', step: 'reading' })

    let upload: Blob
    try {
      upload = await downscaleImage(photo)
    } catch {
      setStage({
        kind: 'error',
        message: "That file couldn't be opened as a photo. Try a JPEG or PNG.",
        canRetry: false,
      })
      return
    }

    let result: { scan: RawScan; scansLeftToday: number }
    try {
      result = await scanScoresheet(upload)
    } catch (err) {
      setStage(scanError(err))
      return
    }

    const { scan: raw, scansLeftToday } = result
    if (raw.header.legibility === 'unreadable' || raw.rows.length === 0) {
      setStage({ kind: 'unreadable', notes: raw.sheetNotes ?? [], scansLeft: scansLeftToday })
      return
    }

    setStage({ kind: 'working', step: 'decoding' })
    try {
      const game = await decodeInBackground(raw)
      setStage({ kind: 'done', scan: raw, game, scansLeft: scansLeftToday })
    } catch {
      setStage({
        kind: 'error',
        message: 'The moves were read, but checking them failed. Please try again.',
        canRetry: true,
      })
    }
  }

  return (
    <div className="space-y-6">
      {stage.kind === 'pick' && <PhotoPicker onChoose={choose} />}

      {stage.kind === 'preview' && previewUrl && (
        <Panel>
          <PhotoPreview url={previewUrl} />
          <div className="mt-5 flex flex-wrap gap-3">
            <Button type="button" className={GOLD_BUTTON} onClick={() => scan(stage.file)}>
              Scan this sheet
            </Button>
            <Button type="button" variant="outline" onClick={startOver}>
              Choose a different photo
            </Button>
          </div>
        </Panel>
      )}

      {stage.kind === 'working' && (
        <Panel>
          {previewUrl && <PhotoPreview url={previewUrl} dimmed />}
          <div role="status" aria-live="polite" className="mt-5 flex items-center gap-3">
            <Loader2 className="size-5 animate-spin text-lca-gold" aria-hidden="true" />
            <div>
              <p className="text-sm font-medium text-foreground">
                {stage.step === 'reading' ? 'Reading the handwriting…' : 'Checking the moves…'}
              </p>
              <p className="text-xs text-muted-foreground">
                {stage.step === 'reading'
                  ? 'This usually takes 10–30 seconds.'
                  : 'Matching every move against the rules of chess.'}
              </p>
            </div>
          </div>
        </Panel>
      )}

      {stage.kind === 'unreadable' && (
        <Panel>
          <Notice tone="warn" title="We couldn't read this sheet">
            {stage.notes.length > 0 ? stage.notes.join(' ') : 'The photo may be too dark, blurry, or cropped.'}{' '}
            Try again in better light with the whole grid in the frame.
          </Notice>
          <ScansLeft count={stage.scansLeft} />
          <Button type="button" variant="outline" className="mt-4" onClick={startOver}>
            <RotateCcw className="size-4" aria-hidden="true" /> Try another photo
          </Button>
        </Panel>
      )}

      {stage.kind === 'error' && (
        <Panel>
          <Notice tone="error" title="Something went wrong">
            {stage.message}
          </Notice>
          <div className="mt-4 flex flex-wrap gap-3">
            {stage.canRetry && file && (
              <Button type="button" className={GOLD_BUTTON} onClick={() => scan(file)}>
                Try again
              </Button>
            )}
            <Button type="button" variant="outline" onClick={startOver}>
              Start over
            </Button>
          </div>
        </Panel>
      )}

      {stage.kind === 'done' && (
        <Results
          scan={stage.scan}
          game={stage.game}
          scansLeft={stage.scansLeft}
          previewUrl={previewUrl}
          onScanAnother={startOver}
        />
      )}
    </div>
  )
}

function scanError(err: unknown): Stage {
  if (err instanceof ApiError) {
    if (err.status === 401) {
      return { kind: 'error', message: 'Your session has expired. Log in again to scan.', canRetry: false }
    }
    // The endpoint's own messages are written for members (daily limit,
    // busy, too large), so they are shown as they come.
    const canRetry = err.status === 502 || err.status === 503
    return { kind: 'error', message: err.message, canRetry }
  }
  return {
    kind: 'error',
    message: "Couldn't reach the scanner. Check your connection and try again.",
    canRetry: true,
  }
}

/** An object URL for the chosen photo, released when it changes or the page closes. */
function useObjectUrl(file: File | null): string | null {
  const [url, setUrl] = useState<string | null>(null)
  useEffect(() => {
    if (!file) {
      setUrl(null)
      return
    }
    const next = URL.createObjectURL(file)
    setUrl(next)
    return () => URL.revokeObjectURL(next)
  }, [file])
  return url
}

// ── Picking a photo ──────────────────────────────────────────────────

function PhotoPicker({ onChoose }: { onChoose: (file: File) => void }) {
  const cameraRef = useRef<HTMLInputElement>(null)
  const libraryRef = useRef<HTMLInputElement>(null)

  function handle(e: ChangeEvent<HTMLInputElement>) {
    const chosen = e.target.files?.[0]
    e.target.value = '' // so choosing the same file again still fires
    if (chosen) onChoose(chosen)
  }

  return (
    <div className="rounded-xl border-2 border-dashed border-lca-navy/15 bg-card p-6 text-center sm:p-10">
      <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-lca-gold/10">
        <Camera className="size-6 text-lca-gold" aria-hidden="true" />
      </div>
      <h2 className="mt-4 text-lg font-semibold text-lca-navy">Add a photo of your scoresheet</h2>
      <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
        One sheet per photo, taken from straight above, with every row visible.
      </p>
      <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
        {/* capture opens the camera directly on phones; desktops ignore it
            and show the file picker, which is why both buttons exist. */}
        <Button type="button" className={GOLD_BUTTON} onClick={() => cameraRef.current?.click()}>
          <Camera className="size-4" aria-hidden="true" /> Take a photo
        </Button>
        <Button type="button" variant="outline" onClick={() => libraryRef.current?.click()}>
          <ImagePlus className="size-4" aria-hidden="true" /> Choose a photo
        </Button>
      </div>
      <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="sr-only" tabIndex={-1} aria-hidden="true" onChange={handle} />
      <input ref={libraryRef} type="file" accept="image/*" className="sr-only" tabIndex={-1} aria-hidden="true" onChange={handle} />
    </div>
  )
}

function PhotoPreview({ url, dimmed }: { url: string; dimmed?: boolean }) {
  return (
    <img
      src={url}
      alt="Your scoresheet"
      className={cn(
        'mx-auto max-h-[420px] w-auto rounded-lg border object-contain transition-opacity',
        dimmed && 'opacity-60',
      )}
    />
  )
}

// ── Results ──────────────────────────────────────────────────────────

const NEEDS_LOOK: DecodedMove['status'][] = ['flagged', 'guessed']

function Results({
  scan,
  game,
  scansLeft,
  previewUrl,
  onScanAnother,
}: {
  scan: RawScan
  game: DecodedGame
  scansLeft: number
  previewUrl: string | null
  onScanAnother: () => void
}) {
  const [copied, setCopied] = useState(false)
  const needsLook = game.moves.filter((m) => NEEDS_LOOK.includes(m.status)).length
  const white = scan.header.whiteName ?? 'White'
  const black = scan.header.blackName ?? 'Black'

  async function copyPgn() {
    try {
      await navigator.clipboard.writeText(gameToPgn(game, scan.header))
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Clipboard can be blocked (permissions, http). Nothing sensible to
      // fall back to here; the lichess link carries the same moves.
    }
  }

  if (game.moves.length === 0) {
    return (
      <Panel>
        <Notice tone="warn" title="No moves could be worked out">
          {game.warnings.join(' ') || 'The handwriting was read, but no legal game fit it.'}
        </Notice>
        <ScansLeft count={scansLeft} />
        <Button type="button" variant="outline" className="mt-4" onClick={onScanAnother}>
          <RotateCcw className="size-4" aria-hidden="true" /> Scan another sheet
        </Button>
      </Panel>
    )
  }

  return (
    <>
      <Panel>
        <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
          {previewUrl && (
            <img src={previewUrl} alt="Your scoresheet" className="h-28 w-auto self-start rounded-md border object-cover" />
          )}
          <div className="min-w-0 flex-1">
            <p className="text-lg font-semibold text-lca-navy">
              {white} <span className="font-normal text-muted-foreground">vs</span> {black}
            </p>
            <p className="mt-0.5 text-sm text-muted-foreground">
              {[scan.header.event, scan.header.round && `Round ${scan.header.round}`].filter(Boolean).join(' · ')}
            </p>
            <p className="mt-2 text-sm text-foreground">
              {Math.ceil(game.moves.length / 2)} moves · Result {game.result === '*' ? 'not recorded' : game.result}
              {needsLook > 0 ? (
                <span className="text-amber-700"> · {needsLook} {needsLook === 1 ? 'move needs' : 'moves need'} a look</span>
              ) : (
                <span className="text-emerald-700"> · every move checked</span>
              )}
            </p>
          </div>
        </div>

        {game.warnings.length > 0 && (
          <Notice tone="warn" title="Heads up" className="mt-5">
            {game.warnings.join(' ')}
          </Notice>
        )}

        <div className="mt-5 flex flex-wrap gap-3">
          <Button asChild className={GOLD_BUTTON}>
            <a href={lichessAnalysisUrl(game)} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="size-4" aria-hidden="true" /> Open in lichess
            </a>
          </Button>
          <Button type="button" variant="outline" onClick={copyPgn}>
            {copied ? <Check className="size-4" aria-hidden="true" /> : <Copy className="size-4" aria-hidden="true" />}
            {copied ? 'Copied' : 'Copy PGN'}
          </Button>
          <Button type="button" variant="outline" onClick={onScanAnother}>
            <RotateCcw className="size-4" aria-hidden="true" /> Scan another
          </Button>
        </div>
        <ScansLeft count={scansLeft} />
      </Panel>

      <MoveList game={game} />

      {scan.sheetNotes && scan.sheetNotes.length > 0 && (
        <p className="text-xs leading-relaxed text-muted-foreground">
          <span className="font-medium text-foreground">Noticed on the sheet:</span> {scan.sheetNotes.join(' · ')}
        </p>
      )}
    </>
  )
}

function MoveList({ game }: { game: DecodedGame }) {
  const rows: Array<{ n: number; white?: DecodedMove; black?: DecodedMove }> = []
  for (const move of game.moves) {
    const n = Math.ceil(move.ply / 2)
    if (move.ply % 2 === 1) rows.push({ n, white: move })
    else if (rows.length > 0 && rows[rows.length - 1]!.n === n) rows[rows.length - 1]!.black = move
    else rows.push({ n, black: move })
  }

  return (
    <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-3">
        <h2 className="text-sm font-semibold text-lca-navy">Moves</h2>
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-sm bg-amber-200" aria-hidden="true" /> Check this move
          </span>
          <span className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-sm border border-dashed border-lca-navy/40" aria-hidden="true" /> Read differently from the sheet
          </span>
        </div>
      </div>
      <table className="w-full text-sm">
        <thead className="sr-only">
          <tr>
            <th scope="col">Move</th>
            <th scope="col">White</th>
            <th scope="col">Black</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.n} className="border-b last:border-0 even:bg-muted/30">
              <th scope="row" className="w-12 py-1.5 pl-4 text-left align-top font-normal tabular-nums text-muted-foreground">
                {row.n}.
              </th>
              <MoveCell move={row.white} />
              <MoveCell move={row.black} />
            </tr>
          ))}
        </tbody>
      </table>
      {game.truncatedAtPly !== undefined && (
        <p className="border-t bg-amber-50 px-4 py-2.5 text-xs text-amber-900">
          The rest of the sheet couldn't be matched to legal moves, so the game stops here.
        </p>
      )}
    </div>
  )
}

function MoveCell({ move }: { move?: DecodedMove }) {
  if (!move) return <td className="py-1.5 pr-2" />
  const needsLook = NEEDS_LOOK.includes(move.status)
  const readDifferently = move.status === 'corrected'
  const others = move.alternatives.filter((a) => a.san !== move.san).slice(0, 2)

  return (
    <td className="py-1.5 pr-2 align-top">
      <span
        className={cn(
          'inline-block rounded px-1.5 py-0.5 font-medium',
          needsLook && 'bg-amber-200 text-amber-950',
          readDifferently && 'border border-dashed border-lca-navy/40',
        )}
      >
        {move.san}
      </span>
      {(needsLook || readDifferently) && (
        <span className="mt-0.5 block text-[11px] leading-snug text-muted-foreground">
          {move.sourceRaw === null ? 'blank on the sheet' : `written “${move.sourceRaw}”`}
          {needsLook && others.length > 0 && ` · or ${others.map((a) => a.san).join(', ')}`}
        </span>
      )}
    </td>
  )
}

// ── Small pieces ─────────────────────────────────────────────────────

function Panel({ children }: { children: ReactNode }) {
  return <div className="rounded-xl border bg-card p-5 shadow-sm sm:p-6">{children}</div>
}

function Notice({
  tone,
  title,
  children,
  className,
}: {
  tone: 'warn' | 'error'
  title: string
  children: ReactNode
  className?: string
}) {
  return (
    <div
      role={tone === 'error' ? 'alert' : undefined}
      className={cn(
        'flex gap-3 rounded-lg border p-4',
        tone === 'warn' ? 'border-amber-200 bg-amber-50 text-amber-950' : 'border-red-200 bg-red-50 text-red-900',
        className,
      )}
    >
      <TriangleAlert className="mt-0.5 size-4 flex-shrink-0" aria-hidden="true" />
      <div>
        <p className="text-sm font-semibold">{title}</p>
        <p className="mt-1 text-sm leading-relaxed">{children}</p>
      </div>
    </div>
  )
}

function ScansLeft({ count }: { count: number }) {
  return (
    <p className="mt-4 text-xs text-muted-foreground">
      {count === 0 ? 'That was your last scan for today.' : `${count} ${count === 1 ? 'scan' : 'scans'} left today.`}
    </p>
  )
}
