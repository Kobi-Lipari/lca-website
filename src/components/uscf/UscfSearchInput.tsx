// src/components/uscf/UscfSearchInput.tsx
import { useState, useEffect, useRef } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Loader2, AlertCircle, Search, CheckCircle } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface UscfPlayerResult {
  uscfId: string
  fullName: string
  firstName: string
  lastName: string
  rating: number | null
  ratingType: string | null
  isProvisional: boolean
  expirationDate: string | null
  state: string | null
  status: string | null
}

/** Shapes returned by /api/uscf/lookup and /api/uscf/search. */
interface LookupResponse {
  upstreamUnavailable?: boolean
  player: UscfPlayerResult | null
}
interface SearchResponse {
  upstreamUnavailable?: boolean
  players?: UscfPlayerResult[]
}

interface Props {
  onSelect: (player: UscfPlayerResult | null) => void
  /** Fired when US Chess itself is unreachable, so the parent can degrade. */
  onUpstreamUnavailable?: () => void
  onIdInput?: (hasInput: boolean) => void
  initialUscfId?: string
  className?: string
}

type SearchMode = 'id' | 'name'
type Status = 'idle' | 'loading' | 'found' | 'not_found' | 'upstream_down' | 'selected'

function PlayerCard({
  player,
  onSelect,
  selected,
}: {
  player: UscfPlayerResult
  onSelect: (p: UscfPlayerResult) => void
  selected?: boolean
}) {
  const isExpired =
    player.expirationDate
      ? new Date(player.expirationDate) < new Date()
      : false

  return (
    <button
      type="button"
      onClick={() => onSelect(player)}
      className={cn(
        'w-full text-left px-4 py-3 border rounded-lg transition-colors',
        selected
          ? 'border-lca-navy bg-lca-navy/5'
          : 'border-border hover:border-lca-navy/40 hover:bg-muted/40',
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium text-sm">{player.fullName}</span>
            {selected && (
              <CheckCircle className="h-3.5 w-3.5 text-green-600 shrink-0" />
            )}
          </div>
          <div className="flex items-center gap-3 mt-1 flex-wrap">
            <span className="text-xs text-muted-foreground font-mono">
              #{player.uscfId}
            </span>
            {player.state && (
              <span className="text-xs text-muted-foreground">
                {player.state}
              </span>
            )}
            {player.expirationDate && (
              <span
                className={cn(
                  'text-xs',
                  isExpired ? 'text-destructive' : 'text-muted-foreground',
                )}
              >
                Exp: {player.expirationDate}
              </span>
            )}
          </div>
        </div>
        <div className="shrink-0 text-right">
          {player.rating ? (
            <div>
              <span className="text-sm font-medium">{player.rating}</span>
              {player.isProvisional && (
                <span className="text-xs text-muted-foreground ml-1">P</span>
              )}
              {player.ratingType && (
                <div className="text-xs text-muted-foreground">
                  {player.ratingType}
                </div>
              )}
            </div>
          ) : (
            <span className="text-xs text-muted-foreground">Unrated</span>
          )}
          {player.status && (
            <Badge
              variant="secondary"
              className={cn(
                'text-xs mt-1',
                player.status === 'Active'
                  ? 'bg-green-100 text-green-800'
                  : 'bg-red-100 text-red-800',
              )}
            >
              {player.status}
            </Badge>
          )}
        </div>
      </div>
    </button>
  )
}

export default function UscfSearchInput({
  onSelect,
  onUpstreamUnavailable,
  onIdInput,
  initialUscfId,
  className,
}: Props) {
  const [mode, setMode] = useState<SearchMode>('id')
  const [idInput, setIdInput] = useState(initialUscfId ?? '')
  const [lastNameInput, setLastNameInput] = useState('')
  const [firstNameInput, setFirstNameInput] = useState('')
  const [status, setStatus] = useState<Status>('idle')
  const [results, setResults] = useState<UscfPlayerResult[]>([])
  const [selectedPlayer, setSelectedPlayer] = useState<UscfPlayerResult | null>(null)
  const [errorMsg, setErrorMsg] = useState('')
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const reset = () => {
    setStatus('idle')
    setResults([])
    setErrorMsg('')
  }

  // ID lookup — debounced
  useEffect(() => {
    if (mode !== 'id') return
    const id = idInput.trim()
    if (!id || !/^\d{4,}$/.test(id)) { reset(); return }

    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(async () => {
      setStatus('loading')
      setResults([])
      try {
        const res = await fetch(`/api/uscf/lookup?id=${encodeURIComponent(id)}`)
        const data = (await res.json()) as LookupResponse
        if (data.upstreamUnavailable) {
          setStatus('upstream_down')
          onUpstreamUnavailable?.()
          return
        }
        if (data.player) {
          setResults([data.player])
          setStatus('found')
        } else {
          setStatus('not_found')
        }
      } catch {
        setStatus('upstream_down')
        onUpstreamUnavailable?.()
      }
    }, 600)

    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [idInput, mode])

  const handleNameSearch = async () => {
    const last = lastNameInput.trim()
    if (last.length < 2) {
      setErrorMsg('Enter at least 2 characters for last name')
      return
    }
    setStatus('loading')
    setResults([])
    setErrorMsg('')
    try {
      const params = new URLSearchParams({ lastName: last })
      if (firstNameInput.trim()) params.set('firstName', firstNameInput.trim())
      const res = await fetch(`/api/uscf/search?${params}`)
      const data = (await res.json()) as SearchResponse
      if (data.upstreamUnavailable) {
        setStatus('upstream_down')
        onUpstreamUnavailable?.()
        return
      }
      const players = data.players ?? []
      if (players.length > 0) {
        setResults(players)
        setStatus('found')
      } else {
        setStatus('not_found')
      }
    } catch {
      setStatus('upstream_down')
      onUpstreamUnavailable?.()
    }
  }

  const handleSelect = (player: UscfPlayerResult) => {
    setSelectedPlayer(player)
    setStatus('selected')
    onSelect(player)
  }

  const handleClear = () => {
    setSelectedPlayer(null)
    setIdInput('')
    onSelect(null)
    onIdInput?.(false)
    reset()
  }

  const handleNotifySupport = async () => {
    try {
      await fetch('/api/support', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subject: 'USCF lookup unavailable',
          body: 'The USCF lookup service appears to be down. I was unable to look up my USCF ID during registration.',
          name: 'Member',
          email: 'unknown@unknown.com',
        }),
      })
    } catch {}
    alert(
      'The LCA support team has been notified. You can continue without a USCF ID for now.',
    )
  }

  return (
    <div className={cn('space-y-3', className)}>
      <div className="flex items-center justify-between">
        <Label>
          USCF ID{' '}
          <span className="text-muted-foreground text-xs font-normal">
            (optional)
          </span>
        </Label>
        <div className="flex gap-1 text-xs">
          <button
            type="button"
            onClick={() => { setMode('id'); reset() }}
            className={cn(
              'px-2 py-1 rounded transition-colors',
              mode === 'id'
                ? 'bg-lca-navy text-white'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            By ID
          </button>
          <button
            type="button"
            onClick={() => { setMode('name'); reset() }}
            className={cn(
              'px-2 py-1 rounded transition-colors',
              mode === 'name'
                ? 'bg-lca-navy text-white'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            By name
          </button>
        </div>
      </div>

      {/* ID mode */}
      {mode === 'id' && (
        <div className="relative">
          <Input
            placeholder="Enter your 8-digit USCF ID…"
            value={idInput}
            onChange={(e) => {
              setIdInput(e.target.value)
              setSelectedPlayer(null)
              onIdInput?.(e.target.value.trim().length > 0)
            }}
            className={cn(
              status === 'selected' && 'border-green-500',
              status === 'not_found' && 'border-destructive',
            )}
          />
          {status === 'loading' && (
            <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
          )}
        </div>
      )}

      {/* Name mode */}
      {mode === 'name' && (
        <div className="space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <Input
              placeholder="Last name *"
              value={lastNameInput}
              onChange={(e) => { setLastNameInput(e.target.value); reset() }}
            />
            <Input
              placeholder="First name (optional)"
              value={firstNameInput}
              onChange={(e) => { setFirstNameInput(e.target.value); reset() }}
            />
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="w-full"
            onClick={handleNameSearch}
            disabled={status === 'loading' || lastNameInput.trim().length < 2}
          >
            {status === 'loading' ? (
              <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Searching…</>
            ) : (
              <><Search className="h-4 w-4 mr-2" />Search USCF</>
            )}
          </Button>
          {errorMsg && (
            <p className="text-xs text-destructive">{errorMsg}</p>
          )}
        </div>
      )}

      {/* Scraper down */}
      {status === 'upstream_down' && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 space-y-2">
          <div className="flex items-center gap-2 text-destructive text-sm">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>The USCF lookup service is currently unavailable.</span>
          </div>
          <Button
            size="sm"
            variant="outline"
            className="w-full text-xs"
            onClick={handleNotifySupport}
          >
            Notify LCA Support
          </Button>
          <p className="text-xs text-muted-foreground">
            You can continue without a USCF ID and add it later from your
            profile.
          </p>
        </div>
      )}

      {/* Not found */}
      {status === 'not_found' && (
        <p className="text-xs text-destructive flex items-center gap-1">
          <AlertCircle className="h-3.5 w-3.5" />
          No matching USCF records found. Double-check your ID or try searching
          by name.
        </p>
      )}

      {/* Results list */}
      {status === 'found' && results.length > 0 && (
        <div className="space-y-2">
          {results.length > 1 && (
            <p className="text-xs text-muted-foreground">
              {results.length} matches — select yours:
            </p>
          )}
          {results.map((p) => (
            <PlayerCard
              key={p.uscfId}
              player={p}
              onSelect={handleSelect}
              selected={selectedPlayer?.uscfId === p.uscfId}
            />
          ))}
        </div>
      )}

      {/* Selected confirmation */}
      {status === 'selected' && selectedPlayer && (
        <div className="rounded-lg border border-green-200 bg-green-50 p-3">
          <div className="flex items-center gap-2 text-green-800 text-sm font-medium">
            <CheckCircle className="h-4 w-4" />
            {selectedPlayer.fullName}{' '}
            <span className="font-mono text-xs">#{selectedPlayer.uscfId}</span>
            {selectedPlayer.rating && (
              <span className="font-normal text-green-700">
                · {selectedPlayer.rating}
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={handleClear}
            className="text-xs text-green-700 underline mt-1"
          >
            Change
          </button>
        </div>
      )}
    </div>
  )
}