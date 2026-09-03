// src/pages/AdminEmailPage.tsx
import { useEffect, useMemo, useState } from 'react'
import {
  Mail, Send, Users, CheckCircle2, XCircle, Clock,
  Eye, EyeOff, FlaskConical, X, UserPlus, Search,
} from 'lucide-react'
import { PageHero } from '@/components/PageHero'
import { RichTextEditor } from '@/components/governance/RichTextEditor'
import { MultiSelectDropdown } from '@/components/MultiSelectDropdown'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import { usePageTitle } from '@/hooks/usePageTitle'
import { GOLD_BUTTON as GOLD } from '@/lib/brand'
import {
  getClubs,
  getCampaigns,
  createCampaign,
  previewCampaignCount,
  sendTestCampaignEmail,
  adminGetMembers,
  type ApiClubListItem,
  type ApiCampaign,
  type ApiCampaignRecipient,
  type ApiAdminMember,
} from '@/lib/api'

const ROLE_OPTIONS = [
  { value: 'member', label: 'Members' },
  { value: 'club_rep', label: 'Club reps' },
  { value: 'tournament_director', label: 'Tournament directors' },
  { value: 'lca_admin', label: 'Admins' },
]
const STATUS_OPTIONS = [
  { value: 'active', label: 'Active' },
  { value: 'pending', label: 'Pending' },
  { value: 'expired', label: 'Expired' },
]

// Relative: the preview is served from the same origin as the logo, so this
// is correct wherever the site is deployed — including the dev server, where
// an absolute production URL was the one asset that had to reach the
// internet to render.
const LOGO_URL = '/lca-logo.jpg'

// The footer shows what RECIPIENTS will see, which is the server's SITE_URL,
// not whatever host an admin happens to be previewing from. Falls back to the
// same default functions/utils/site.ts uses.
const SITE_URL_DISPLAY = (
  import.meta.env.VITE_SITE_URL ?? 'https://louisianachess.org'
).replace(/^https?:\/\//, '')

/** Visual mirror of functions/utils/campaigns.ts → wrapBrandedEmail().
 *  Preview only — the actual email HTML is generated server-side. If you
 *  change the backend template's colors/spacing, update this one too. */
function BrandedEmailPreview({ subject, bodyHtml }: { subject: string; bodyHtml: string }) {
  return (
    <div className="overflow-hidden rounded-xl border shadow-sm" style={{ background: '#f4f4f0' }}>
      <div style={{ maxWidth: 480, margin: '0 auto', background: '#fff', borderRadius: 12, overflow: 'hidden', border: '1px solid #e0ddd5' }}>
        {/* Header */}
        <div style={{ background: '#1a2744', padding: '24px 28px', textAlign: 'center' }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={LOGO_URL} alt="Louisiana Chess Association" width={120} style={{ display: 'block', margin: '0 auto', borderRadius: 8 }} />
        </div>
        {/* Gold bar */}
        <div style={{ background: '#c8a94a', height: 4, fontSize: 0, lineHeight: 0 }}>&nbsp;</div>
        {/* Body */}
        <div style={{ padding: '24px 28px 20px' }}>
          <h1 style={{ margin: '0 0 12px', fontSize: 18, color: '#1a2744', fontFamily: 'Georgia, serif' }}>
            {subject || 'Your subject line will appear here'}
          </h1>
          <div
            className="prose prose-sm max-w-none"
            style={{ color: '#444', fontSize: 13, lineHeight: 1.6, minHeight: 60 }}
            dangerouslySetInnerHTML={{
              __html: bodyHtml || '<p style="color:#aaa;font-style:italic">Your message will appear here as you type.</p>',
            }}
          />
        </div>
        {/* Footer */}
        <div style={{ background: '#f4f4f0', borderTop: '1px solid #e0ddd5', padding: '16px 28px', textAlign: 'center' }}>
          <p style={{ margin: '0 0 3px', fontSize: 11, color: '#999' }}>Louisiana Chess Association</p>
          <p style={{ margin: 0, fontSize: 11 }}>
            <span style={{ color: '#1a2744' }}>{SITE_URL_DISPLAY}</span> · <span style={{ color: '#1a2744' }}>support@louisianachess.org</span>
          </p>
        </div>
      </div>
    </div>
  )
}

const STATUS_META: Record<string, { label: string; icon: typeof Clock; className: string }> = {
  sending: { label: 'Sending…', icon: Clock, className: 'bg-[#c8a94a]/15 text-[#7a5c00]' },
  completed: { label: 'Completed', icon: CheckCircle2, className: 'bg-emerald-100 text-emerald-800' },
  failed: { label: 'Failed', icon: XCircle, className: 'bg-red-100 text-red-700' },
}

function CampaignRow({ c }: { c: ApiCampaign }) {
  const meta = STATUS_META[c.status] ?? STATUS_META.sending
  const Icon = meta.icon
  const pct = c.total_recipients > 0
    ? Math.round(((c.sent_count + c.failed_count) / c.total_recipients) * 100)
    : 0

  return (
    <div className="rounded-xl border bg-card p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-medium text-[#1a2744]">{c.subject}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {new Date(c.created_at).toLocaleString()} · {c.total_recipients} recipients
          </p>
        </div>
        <span className={cn('flex flex-shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium', meta.className)}>
          <Icon className="size-3" /> {meta.label}
        </span>
      </div>
      <div className="mt-3">
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
          <div className="h-full rounded-full bg-[#c8a94a] transition-all" style={{ width: `${pct}%` }} />
        </div>
        <p className="mt-1 text-[11px] text-muted-foreground">
          {c.sent_count} sent
          {c.failed_count > 0 && <span className="text-red-600"> · {c.failed_count} failed</span>}
          {' '}· {pct}%
        </p>
      </div>
    </div>
  )
}

export function AdminEmailPage() {
  usePageTitle('Group Email')

  const [clubs, setClubs] = useState<ApiClubListItem[]>([])
  const [campaigns, setCampaigns] = useState<ApiCampaign[]>([])
  const [loadingHistory, setLoadingHistory] = useState(true)
  const [memberPool, setMemberPool] = useState<ApiAdminMember[]>([])

  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [roles, setRoles] = useState<string[]>([])
  const [clubIds, setClubIds] = useState<string[]>([])
  const [statuses, setStatuses] = useState<string[]>([])

  const [confirming, setConfirming] = useState(false)
  const [previewing, setPreviewing] = useState(false)
  const [resolvedRecipients, setResolvedRecipients] = useState<ApiCampaignRecipient[]>([])
  const [excludedIds, setExcludedIds] = useState<Set<string>>(new Set())
  const [manuallyAdded, setManuallyAdded] = useState<ApiCampaignRecipient[]>([])
  const [addSearch, setAddSearch] = useState('')

  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showPreview, setShowPreview] = useState(false)

  const [testEmail, setTestEmail] = useState('')
  const [testSending, setTestSending] = useState(false)
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null)

  function currentFilter() {
    return { roles, clubIds, membershipStatuses: statuses }
  }

  async function loadHistory() {
    try {
      setCampaigns(await getCampaigns())
    } catch { /* keep prior list on transient failure */ }
  }

  useEffect(() => {
    getClubs().then(setClubs).catch(() => {})
    adminGetMembers().then(setMemberPool).catch(() => {})
    loadHistory().finally(() => setLoadingHistory(false))
  }, [])

  // Poll while any campaign is still sending.
  useEffect(() => {
    if (!campaigns.some((c) => c.status === 'sending')) return
    const timer = setInterval(loadHistory, 3000)
    return () => clearInterval(timer)
  }, [campaigns])

  // Final send list = whatever the filter resolved to, minus anyone X'd
  // off, plus anyone hand-picked from the individual-member search.
  const finalList = useMemo(() => {
    const kept = resolvedRecipients.filter((r) => !excludedIds.has(r.id))
    return [...kept, ...manuallyAdded]
  }, [resolvedRecipients, excludedIds, manuallyAdded])

  async function handlePreview() {
    setPreviewing(true)
    setError(null)
    try {
      const { recipients } = await previewCampaignCount(currentFilter())
      setResolvedRecipients(recipients)
      setExcludedIds(new Set())
      setManuallyAdded([])
      setAddSearch('')
      setConfirming(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not resolve recipients')
    } finally {
      setPreviewing(false)
    }
  }

  function excludeFromResolved(id: string) {
    setExcludedIds((prev) => new Set(prev).add(id))
  }
  function removeManual(id: string) {
    setManuallyAdded((prev) => prev.filter((p) => p.id !== id))
  }
  function addManual(m: ApiAdminMember) {
    setManuallyAdded((prev) => [...prev, { id: m.id, email: m.email, full_name: m.full_name }])
    setAddSearch('')
  }

  async function handleSend() {
    setSending(true)
    setError(null)
    try {
      await createCampaign({
        subject: subject.trim(),
        bodyHtml: body,
        filter: currentFilter(),
        excludeMemberIds: [...excludedIds],
        includeMemberIds: manuallyAdded.map((m) => m.id),
      })
      setSubject('')
      setBody('')
      setConfirming(false)
      setResolvedRecipients([])
      setExcludedIds(new Set())
      setManuallyAdded([])
      await loadHistory()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start campaign')
    } finally {
      setSending(false)
    }
  }

  async function handleSendTest() {
    setTestSending(true)
    setTestResult(null)
    try {
      await sendTestCampaignEmail({ email: testEmail.trim(), subject: subject.trim(), bodyHtml: body })
      setTestResult({ ok: true, message: `Test email sent to ${testEmail.trim()}.` })
    } catch (err) {
      setTestResult({ ok: false, message: err instanceof Error ? err.message : 'Failed to send test email' })
    } finally {
      setTestSending(false)
    }
  }

  const canPreview = subject.trim().length > 0 && body.trim().length > 0
  const canTest = canPreview && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(testEmail.trim())

  const addQuery = addSearch.trim().toLowerCase()
  const finalIds = useMemo(() => new Set(finalList.map((r) => r.id)), [finalList])
  const addMatches = addQuery.length >= 2
    ? memberPool
        .filter((m) => !finalIds.has(m.id))
        .filter((m) => m.full_name.toLowerCase().includes(addQuery) || m.email.toLowerCase().includes(addQuery))
        .slice(0, 6)
    : []

  return (
    <div>
      <PageHero
        title="Group email"
        subtitle="Send an email to members — everyone, or a targeted group by role, club, or membership status."
      />

      <section className="mx-auto max-w-6xl px-6 py-10">
        <div className="grid gap-10 lg:grid-cols-[1.3fr_1fr]">

          {/* ── Compose ── */}
          <div>
            <div className="mb-4 flex items-center gap-2">
              <Mail className="size-5 text-[#c8a94a]" />
              <h2 className="text-xl font-bold text-[#1a2744]">Compose</h2>
            </div>

            <div className="space-y-4 rounded-xl border bg-card p-5 shadow-sm">
              <div>
                <Label className="text-xs">Recipients</Label>
                <p className="mb-2 mt-0.5 text-[11px] text-muted-foreground">
                  Leave all three at their defaults to reach everyone.
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  <MultiSelectDropdown defaultLabel="All roles" options={ROLE_OPTIONS} selected={roles} onChange={setRoles} />
                  <MultiSelectDropdown
                    defaultLabel="All clubs"
                    options={clubs.map((c) => ({ value: c.id, label: c.name }))}
                    selected={clubIds}
                    onChange={setClubIds}
                  />
                  <MultiSelectDropdown defaultLabel="Any status" options={STATUS_OPTIONS} selected={statuses} onChange={setStatuses} />
                </div>
              </div>

              <div>
                <Label className="text-xs">Subject</Label>
                <Input className="mt-1" value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="e.g. Fall tournament registration is open" />
              </div>

              <div>
                <div className="flex items-center justify-between">
                  <Label className="text-xs">Message</Label>
                  <button type="button" onClick={() => setShowPreview((p) => !p)} className="flex items-center gap-1 text-[11px] font-medium text-[#1a2744] hover:underline">
                    {showPreview ? <EyeOff className="size-3" /> : <Eye className="size-3" />}
                    {showPreview ? 'Hide preview' : 'Preview email'}
                  </button>
                </div>
                <div className="mt-1">
                  <RichTextEditor content={body} onChange={setBody} />
                </div>
                {showPreview && (
                  <div className="mt-3">
                    <p className="mb-1.5 text-[11px] text-muted-foreground">This is how it will look in the recipient's inbox:</p>
                    <BrandedEmailPreview subject={subject} bodyHtml={body} />
                  </div>
                )}
              </div>

              {/* ── Test send ── */}
              <div className="rounded-lg border border-dashed p-3">
                <p className="mb-2 flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground">
                  <FlaskConical className="size-3.5 text-[#c8a94a]" />
                  Send yourself a test before the real thing
                </p>
                <div className="flex gap-2">
                  <Input
                    className="h-8 text-sm"
                    value={testEmail}
                    onChange={(e) => { setTestEmail(e.target.value); setTestResult(null) }}
                    placeholder="you@example.com"
                  />
                  <Button type="button" variant="outline" size="sm" className="flex-shrink-0" disabled={!canTest || testSending} onClick={handleSendTest}>
                    {testSending ? 'Sending…' : 'Send test'}
                  </Button>
                </div>
                {testResult && (
                  <p className={cn('mt-2 text-xs', testResult.ok ? 'text-emerald-700' : 'text-destructive')}>{testResult.message}</p>
                )}
                <p className="mt-1.5 text-[10px] text-muted-foreground">
                  Test emails are marked [TEST] in the subject and don't count toward — or appear in — send history.
                </p>
              </div>

              {error && <p className="text-sm text-destructive">{error}</p>}

              {!confirming ? (
                <Button type="button" className={cn('w-full', GOLD)} disabled={!canPreview || previewing} onClick={handlePreview}>
                  {previewing ? 'Resolving recipients…' : 'Review before sending'}
                </Button>
              ) : (
                <div className="rounded-lg border border-[#c8a94a]/50 bg-[#c8a94a]/8 p-4">
                  <p className="flex items-center gap-2 text-sm font-medium text-[#1a2744]">
                    <Users className="size-4 text-[#c8a94a]" />
                    This will email <span className="font-bold">{finalList.length}</span> {finalList.length === 1 ? 'person' : 'people'}.
                  </p>

                  {/* ── Reviewable list ── */}
                  <div className="mt-3 max-h-64 overflow-y-auto rounded-lg border bg-card">
                    {finalList.length === 0 ? (
                      <p className="px-3 py-4 text-center text-xs text-muted-foreground">
                        Nobody left to send to — add someone below or adjust the filters.
                      </p>
                    ) : (
                      finalList.map((r) => {
                        const isManual = manuallyAdded.some((m) => m.id === r.id)
                        return (
                          <div key={r.id} className="flex items-center justify-between gap-2 border-b border-border px-3 py-2 last:border-0">
                            <div className="min-w-0">
                              <p className="truncate text-xs font-medium text-foreground">
                                {r.full_name}
                                {isManual && <span className="ml-1.5 rounded-full bg-[#c8a94a]/15 px-1.5 py-0.5 text-[9px] font-medium text-[#7a5c00]">Added</span>}
                              </p>
                              <p className="truncate text-[11px] text-muted-foreground">{r.email}</p>
                            </div>
                            <button
                              type="button"
                              onClick={() => (isManual ? removeManual(r.id) : excludeFromResolved(r.id))}
                              className="flex-shrink-0 text-muted-foreground hover:text-destructive"
                              aria-label={`Remove ${r.full_name}`}
                            >
                              <X className="size-3.5" />
                            </button>
                          </div>
                        )
                      })
                    )}
                  </div>

                  {/* ── Add specific people ── */}
                  <div className="relative mt-3">
                    <div className="relative">
                      <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        className="h-8 pl-8 text-xs"
                        value={addSearch}
                        onChange={(e) => setAddSearch(e.target.value)}
                        placeholder="Add someone specific by name or email…"
                      />
                    </div>
                    {addQuery.length >= 2 && (
                      addMatches.length > 0 ? (
                        <div className="mt-1.5 overflow-hidden rounded-lg border">
                          {addMatches.map((m) => (
                            <button
                              key={m.id}
                              type="button"
                              onClick={() => addManual(m)}
                              className="flex w-full items-center justify-between gap-2 border-b border-border px-3 py-2 text-left last:border-0 hover:bg-muted/50"
                            >
                              <div className="min-w-0">
                                <p className="truncate text-xs font-medium">{m.full_name}</p>
                                <p className="truncate text-[11px] text-muted-foreground">{m.email}</p>
                              </div>
                              <UserPlus className="size-3.5 flex-shrink-0 text-[#c8a94a]" />
                            </button>
                          ))}
                        </div>
                      ) : (
                        <p className="mt-1.5 text-[11px] text-muted-foreground">No members match "{addSearch.trim()}".</p>
                      )
                    )}
                  </div>

                  <div className="mt-4 flex gap-2">
                    <Button type="button" className={GOLD} onClick={handleSend} disabled={sending || finalList.length === 0}>
                      <Send className="mr-1.5 size-3.5" /> {sending ? 'Sending…' : 'Confirm & send'}
                    </Button>
                    <Button type="button" variant="outline" onClick={() => setConfirming(false)} disabled={sending}>
                      Back to edit
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* ── History ── */}
          <div>
            <h2 className="mb-4 text-xl font-bold text-[#1a2744]">Send history</h2>
            {loadingHistory ? (
              <p className="text-sm text-muted-foreground">Loading…</p>
            ) : campaigns.length === 0 ? (
              <div className="rounded-xl border border-dashed px-6 py-10 text-center">
                <p className="text-sm text-muted-foreground">No campaigns sent yet.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {campaigns.map((c) => <CampaignRow key={c.id} c={c} />)}
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  )
}