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

import { useEffect, useRef, useState, type ChangeEvent, type FormEvent, type ReactNode } from 'react'
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
  Undo2,
  ShieldCheck,
  TriangleAlert,
} from 'lucide-react'

import { PageHero } from '@/components/PageHero'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { useAuth } from '@/contexts/auth-context'
import { usePageTitle } from '@/hooks/usePageTitle'
import { ApiError, scanScoresheet } from '@/lib/api'
import { GOLD_BUTTON } from '@/lib/brand'
import { downscaleImage } from '@/lib/resizeImage'
import { decodeInBackground } from '@/lib/scanner/decodeInBackground'
import { legalMovesAt } from '@/lib/scanner/chessAdapter'
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
    ['Review and analyze', 'Open the game on lichess or chess.com, or copy the PGN.'],
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
          // A fresh scan starts a fresh set of corrections.
          key={stage.scansLeft}
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

/** The game as the member has corrected it so far. */
interface Edited {
  game: DecodedGame
  /** Plies the member picked or confirmed themselves. */
  fixed: ReadonlySet<number>
}

function Results({
  scan,
  game: decoded,
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
  const [sentToChessCom, setSentToChessCom] = useState(false)
  const [current, setCurrent] = useState<Edited>({ game: decoded, fixed: new Set() })
  const [history, setHistory] = useState<Edited[]>([])
  const [editing, setEditing] = useState<DecodedMove | null>(null)
  const [updating, setUpdating] = useState(false)
  const [updateError, setUpdateError] = useState<string | null>(null)

  const game = current.game
  const needsLook = game.moves.filter(
    (m) => NEEDS_LOOK.includes(m.status) && !current.fixed.has(m.ply),
  ).length

  /**
   * Settle one move and work the rest of the game out again from there.
   * Everything before it is kept as it is; fixes the member made after it
   * are dropped, because the position they were made in may no longer
   * arise.
   */
  async function fixMove(ply: number, san: string) {
    setEditing(null)
    setUpdateError(null)
    const fixed = new Set([...current.fixed].filter((p) => p < ply))
    fixed.add(ply)

    // Confirming the move that is already there changes nothing downstream:
    // the decoder's own best line already agrees with it.
    if (game.moves[ply - 1]?.san === san) {
      setHistory((h) => [...h, current])
      setCurrent({ game, fixed })
      return
    }

    setUpdating(true)
    try {
      const forced = [...game.moves.slice(0, ply - 1).map((m) => m.san), san]
      const next = await decodeInBackground(scan, forced)
      setHistory((h) => [...h, current])
      setCurrent({ game: next, fixed })
    } catch {
      setUpdateError("Couldn't update the game. Please try that move again.")
    } finally {
      setUpdating(false)
    }
  }

  function undo() {
    const previous = history[history.length - 1]
    if (!previous) return
    setHistory((h) => h.slice(0, -1))
    setCurrent(previous)
  }
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

  // chess.com has no way to open its analysis board with a game in the link
  // (its public API is read-only), so the next best thing: copy the PGN as
  // the link opens, and tell the member to paste it. The copy is started in
  // the click handler, while this page still has focus; the link's own
  // default action then opens the new tab.
  function sendToChessCom() {
    navigator.clipboard
      .writeText(gameToPgn(game, scan.header))
      .then(() => setSentToChessCom(true))
      .catch(() => setSentToChessCom(false))
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
          <Button asChild variant="outline">
            <a href="https://www.chess.com/analysis" target="_blank" rel="noopener noreferrer" onClick={sendToChessCom}>
              <ExternalLink className="size-4" aria-hidden="true" /> Copy &amp; open chess.com
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
        {sentToChessCom && (
          <p className="mt-3 text-sm text-foreground">
            The game is copied. On chess.com's analysis board, paste it into the <span className="font-medium">PGN</span> box
            to load it.
          </p>
        )}
        <ScansLeft count={scansLeft} />
      </Panel>

      <MoveList
        game={game}
        fixed={current.fixed}
        updating={updating}
        updateError={updateError}
        canUndo={history.length > 0}
        onUndo={undo}
        onEdit={setEditing}
      />

      <MoveEditor
        move={editing}
        onPick={(san) => editing && fixMove(editing.ply, san)}
        onClose={() => setEditing(null)}
      />
    </>
  )
}

function MoveList({
  game,
  fixed,
  updating,
  updateError,
  canUndo,
  onUndo,
  onEdit,
}: {
  game: DecodedGame
  fixed: ReadonlySet<number>
  updating: boolean
  updateError: string | null
  canUndo: boolean
  onUndo: () => void
  onEdit: (move: DecodedMove) => void
}) {
  const rows: Array<{ n: number; white?: DecodedMove; black?: DecodedMove }> = []
  for (const move of game.moves) {
    const n = Math.ceil(move.ply / 2)
    if (move.ply % 2 === 1) rows.push({ n, white: move })
    else if (rows.length > 0 && rows[rows.length - 1]!.n === n) rows[rows.length - 1]!.black = move
    else rows.push({ n, black: move })
  }

  return (
    <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
      <div className="border-b px-4 py-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-lca-navy">Moves</h2>
          {canUndo && (
            <Button type="button" variant="ghost" size="sm" onClick={onUndo} disabled={updating}>
              <Undo2 className="size-3.5" aria-hidden="true" /> Undo last change
            </Button>
          )}
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          Tap a move to change it. Everything after it is worked out again from your correction.
        </p>
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-sm bg-amber-200" aria-hidden="true" /> Check this move
          </span>
          <span className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-sm border border-dashed border-lca-navy/40" aria-hidden="true" /> Read differently from the sheet
          </span>
          <span className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-sm bg-emerald-200" aria-hidden="true" /> Fixed by you
          </span>
        </div>
      </div>

      {(updating || updateError) && (
        <div
          role="status"
          aria-live="polite"
          className={cn(
            'flex items-center gap-2 border-b px-4 py-2 text-xs',
            updateError ? 'bg-red-50 text-red-900' : 'bg-muted/40 text-muted-foreground',
          )}
        >
          {updating && <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />}
          {updating ? 'Updating the rest of the game…' : updateError}
        </div>
      )}

      <table className={cn('w-full text-sm transition-opacity', updating && 'pointer-events-none opacity-60')}>
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
              <MoveCell move={row.white} fixed={!!row.white && fixed.has(row.white.ply)} onEdit={onEdit} />
              <MoveCell move={row.black} fixed={!!row.black && fixed.has(row.black.ply)} onEdit={onEdit} />
            </tr>
          ))}
        </tbody>
      </table>
      {game.truncatedAtPly !== undefined && (
        <p className="border-t bg-amber-50 px-4 py-2.5 text-xs text-amber-900">
          The rest of the sheet couldn't be matched to legal moves, so the game stops here. Fixing the last
          moves above can often get it going again.
        </p>
      )}
    </div>
  )
}

function moveLabel(move: DecodedMove): string {
  const n = Math.ceil(move.ply / 2)
  return move.ply % 2 === 1 ? `${n}. ${move.san}` : `${n}… ${move.san}`
}

function MoveCell({
  move,
  fixed,
  onEdit,
}: {
  move?: DecodedMove
  fixed: boolean
  onEdit: (move: DecodedMove) => void
}) {
  if (!move) return <td className="py-1.5 pr-2" />
  const needsLook = !fixed && NEEDS_LOOK.includes(move.status)
  const readDifferently = !fixed && move.status === 'corrected'
  const others = move.alternatives.filter((a) => a.san !== move.san).slice(0, 2)

  return (
    <td className="py-1 pr-2 align-top">
      <button
        type="button"
        onClick={() => onEdit(move)}
        aria-label={`${moveLabel(move)}${needsLook ? ', needs a look' : ''}${fixed ? ', fixed by you' : ''}. Change this move`}
        className={cn(
          'inline-block rounded px-1.5 py-0.5 text-left font-medium transition-colors hover:ring-2 hover:ring-lca-gold/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lca-gold',
          needsLook && 'bg-amber-200 text-amber-950',
          readDifferently && 'border border-dashed border-lca-navy/40',
          fixed && 'bg-emerald-200 text-emerald-950',
        )}
      >
        {move.san}
      </button>
      {(needsLook || readDifferently) && (
        <span className="mt-0.5 block text-[11px] leading-snug text-muted-foreground">
          {move.sourceRaw === null ? 'blank on the sheet' : `written “${move.sourceRaw}”`}
          {needsLook && others.length > 0 && ` · or ${others.map((a) => a.san).join(', ')}`}
        </span>
      )}
    </td>
  )
}

/** Stripped for matching what the member types: no check or capture marks,
 *  zeros for castling Os, any case. "nf3" finds Nxf3+. */
function looseSan(san: string): string {
  return san.replace(/[+#!?x:]/g, '').replace(/0/g, 'O').toLowerCase()
}

function MoveEditor({
  move,
  onPick,
  onClose,
}: {
  move: DecodedMove | null
  onPick: (san: string) => void
  onClose: () => void
}) {
  const [query, setQuery] = useState('')
  const legal = move ? legalMovesAt(move.fenBefore) : []
  const suggestions = move
    ? [...new Set([move.san, ...move.alternatives.map((a) => a.san)])].filter((san) => legal.includes(san)).slice(0, 5)
    : []
  const filtered = query
    ? legal.filter((san) => looseSan(san).startsWith(looseSan(query)))
    : legal

  function pick(san: string) {
    setQuery('')
    onPick(san)
  }

  function submitTyped(e: FormEvent) {
    e.preventDefault()
    const exact = legal.find((san) => looseSan(san) === looseSan(query))
    const only = filtered.length === 1 ? filtered[0] : undefined
    const choice = exact ?? only
    if (choice) pick(choice)
  }

  return (
    <Dialog
      open={move !== null}
      onOpenChange={(open: boolean) => {
        if (!open) {
          setQuery('')
          onClose()
        }
      }}
    >
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-md">
        {move && (
          <>
            <DialogHeader>
              <DialogTitle>
                Move {Math.ceil(move.ply / 2)}, {move.ply % 2 === 1 ? 'White' : 'Black'}
              </DialogTitle>
              <DialogDescription>
                {move.sourceRaw === null
                  ? 'This move was blank on the sheet and worked out from the position.'
                  : `Written on the sheet as “${move.sourceRaw}”.`}{' '}
                Pick the move that was played.
              </DialogDescription>
            </DialogHeader>

            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Most likely</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {suggestions.map((san) => (
                  <Button
                    key={san}
                    type="button"
                    variant={san === move.san ? 'default' : 'outline'}
                    className={cn(san === move.san && GOLD_BUTTON)}
                    onClick={() => pick(san)}
                  >
                    {san === move.san ? `Keep ${san}` : san}
                  </Button>
                ))}
              </div>
            </div>

            <form onSubmit={submitTyped}>
              <label htmlFor="move-search" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Or find it
              </label>
              <Input
                id="move-search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Type a move, e.g. Nf3"
                autoComplete="off"
                autoCapitalize="off"
                spellCheck={false}
                className="mt-2"
              />
            </form>

            <div className="flex flex-wrap gap-1.5">
              {filtered.map((san) => (
                <button
                  key={san}
                  type="button"
                  onClick={() => pick(san)}
                  className={cn(
                    'rounded-md border px-2 py-1 text-sm transition-colors hover:border-lca-gold hover:bg-lca-gold/10',
                    san === move.san && 'border-lca-navy font-semibold',
                  )}
                >
                  {san}
                </button>
              ))}
              {filtered.length === 0 && (
                <p className="text-sm text-muted-foreground">No legal move matches “{query}”.</p>
              )}
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
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
