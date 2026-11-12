// src/pages/AdminEmailPage.tsx
import { useEffect, useId, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Mail, Send, Users, CheckCircle2, XCircle, Clock,
  Eye, EyeOff, FlaskConical, X, UserPlus, Search, CircleHelp, ChevronDown,
} from 'lucide-react'
import { PageHero } from '@/components/PageHero'
import { RichTextEditor } from '@/areas/governance/components/RichTextEditor'
import { MultiSelectDropdown } from '@/components/MultiSelectDropdown'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import { usePageTitle } from '@/hooks/usePageTitle'
import { useAuth } from '@/contexts/auth-context'
import { FEATURES } from '@/lib/features'
import { formatDate, formatTime } from '@/lib/format'
import { ADMIN_SCROLL, LCA, GOLD_BUTTON as GOLD } from '@/lib/brand'
import { LIST_FOOTER_WORDS, PREFERENCES_LABEL, type ListFooterWords } from '@domain/mail/footer'
import { NEWSLETTER_LIST_ID } from '@domain/mail/lists'
import {
  getClubs,
  getCampaigns,
  createCampaign,
  previewCampaignCount,
  sendTestCampaignEmail,
  adminGetMembers,
  getNewsletter,
  sendNewsletter,
  sendNewsletterTest,
  stopNewsletter,
  type ApiClubListItem,
  type ApiCampaign,
  type ApiCampaignRecipient,
  type ApiAdminMember,
  type ApiNewsletter,
} from '@/lib/api'

const ROLE_OPTIONS = [
  { value: 'member', label: 'Members' },
  { value: 'club_rep', label: 'Club reps' },
  { value: 'tournament_director', label: 'Tournament directors' },
  { value: 'lca_admin', label: 'Admins' },
]
const STATUS_OPTIONS = [
  { value: 'active', label: 'Active' },
  { value: 'none', label: 'No membership' },
  { value: 'expired', label: 'Expired' },
]

// ── The LCA newsletter list (WS16 step 5), drawn only with mailLists on ──
// With the switch off this page is today's, element for element. With it on
// the page opens on the newsletter tab, beside Specific people, and never
// draws Groups of members, which waits for a list of its own (WS16 step 11).
// The words that only explain sit behind Help (K's decisions 40 and 43),
// which opens by itself the first time a person opens the tab in a browser;
// the words that say how things stand stay on the page. The newsletter's
// count, its From line and its refusals are the server's, shown as given.

/** Which recipients the page is writing to. */
type Mode = 'groups' | 'people' | 'newsletter'

const TODAY_TABS: ReadonlyArray<readonly [Mode, string]> = [['groups', 'Groups of members'], ['people', 'Specific people']]
const NEWSLETTER_TABS: ReadonlyArray<readonly [Mode, string]> = [['newsletter', 'The LCA newsletter list'], ['people', 'Specific people']]
/** The media manager's one tab (WS16 step 6): Specific people is not theirs, and Groups of members waits for WS16 step 11. */
const MEDIA_MANAGER_TABS: ReadonlyArray<readonly [Mode, string]> = [['newsletter', 'The LCA newsletter list']]

const NEWSLETTER_SUBTITLE = 'Send the LCA newsletter, or a note to specific people.'
const MEDIA_MANAGER_SUBTITLE = 'Send the LCA newsletter.'
/** In place of the send buttons for the media manager signed in without a second factor, linked to where it is set up. */
const SECOND_FACTOR_LINE = 'Set up two-factor sign-in to send group email.'
/** K's guardrails for an issue (decision 23) and the simple way of writing one (decision 24), behind Help. */
const GUARDRAILS = "Name the newsletter in the subject, put member news first, and paste links by hand, a tournament's King Registration link included. A renewal reminder is a separate email."
const BOTH_LINKS = 'Each email carries an unsubscribe link and an email preferences link.'
/** What Specific people is for while the newsletter is on (Q45), behind Help. */
const SPECIFIC_PEOPLE_LINE = "For a note about a person's own membership, entry or request. News goes to the LCA newsletter list, which honors each person's choices."
/** Beside the send button, drawn off, while Resend still sends: the newsletter goes out through Amazon SES alone (Q41). */
const WAITS_FOR_SES_LINE = 'The newsletter goes out through Amazon SES, which this site does not send through yet. You can write it and send yourself a test now.'

/** The one key this page keeps in the browser, with mailLists on: that the newsletter tab's Help has opened by itself once. */
const HELP_SHOWN_KEY = 'lca-newsletter-help'

/** Whether Help has opened by itself in this browser before; a browser that refuses storage reads as yes, so Help starts closed. */
function helpShownBefore(): boolean {
  try {
    return window.localStorage.getItem(HELP_SHOWN_KEY) !== null
  } catch {
    return true
  }
}

function rememberHelpShown(): void {
  try {
    window.localStorage.setItem(HELP_SHOWN_KEY, 'shown')
  } catch {
    // A browser that refuses storage opens Help from its button alone.
  }
}

/** A button that opens and closes the part it names, with a visible ring and room for a finger. */
const OPENER = 'inline-flex min-h-6 min-w-6 items-center gap-1 rounded-md px-1.5 text-xs font-medium text-ink outline-none hover:underline focus-visible:ring-3 focus-visible:ring-focus'

// Relative: the preview is served from the same origin as the logo, so this
// is correct wherever the site is deployed — including the dev server, where
// an absolute production URL was the one asset that had to reach the
// internet to render.
const LOGO_URL = '/lca-logo.jpg'

// The footer shows what RECIPIENTS will see, which is the server's SITE_URL,
// not whatever host an admin happens to be previewing from. Falls back to the
// same default functions/utils/site.ts uses.
const SITE_URL_DISPLAY = (
  import.meta.env.VITE_SITE_URL ?? 'https://www.louisianachess.org'
).replace(/^https?:\/\//, '')

/** Visual mirror of functions/utils/admin/campaigns.ts → wrapBrandedEmail().
 *  Preview only — the actual email HTML is generated server-side. If you
 *  change the backend template's colors/spacing, update this one too. */
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function BrandedEmailPreview({ subject, bodyHtml, listFooter }: { subject: string; bodyHtml: string; listFooter?: ListFooterWords }) {
  return (
    <div className="overflow-hidden rounded-xl border shadow-sm" style={{ background: LCA.cream }}>
      <div style={{ maxWidth: 480, margin: '0 auto', background: '#fff', borderRadius: 12, overflow: 'hidden', border: '1px solid #e0ddd5' }}>
        {/* Header */}
        <div style={{ background: LCA.navy, padding: '24px 28px', textAlign: 'center' }}>
          <img src={LOGO_URL} alt="Louisiana Chess Association" width={120} style={{ display: 'block', margin: '0 auto', borderRadius: 8 }} />
        </div>
        {/* Gold bar */}
        <div style={{ background: LCA.gold, height: 4, fontSize: 0, lineHeight: 0 }}>&nbsp;</div>
        {/* Body */}
        <div style={{ padding: '24px 28px 20px' }}>
          <h1 style={{ margin: '0 0 12px', fontSize: 18, color: LCA.navy, fontFamily: 'Georgia, serif' }}>
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
        <div style={{ background: LCA.cream, borderTop: '1px solid #e0ddd5', padding: '16px 28px', textAlign: 'center' }}>
          <p style={{ margin: '0 0 4px', fontSize: 12, color: '#3a3f4b' }}>Questions? Just reply to this email and it will reach us.</p>
          {/* A list's footer, from the words the email's own footer is built from (domain/mail/footer.ts); no postal address. */}
          {listFooter && (
            <>
              <p style={{ margin: '0 0 6px', fontSize: 13, color: '#3a3f4b' }}>{listFooter.reason}</p>
              <p style={{ margin: '0 0 10px', fontSize: 12, color: '#3a3f4b' }}>
                <span style={{ color: LCA.navy, textDecoration: 'underline' }}>{listFooter.unsubscribeLabel}</span>
                {' · '}
                <span style={{ color: LCA.navy, textDecoration: 'underline' }}>{PREFERENCES_LABEL}</span>
              </p>
            </>
          )}
          <p style={{ margin: 0, fontSize: 11, color: '#999' }}>
            Louisiana Chess Association · <span style={{ color: LCA.navy }}>{SITE_URL_DISPLAY}</span>
          </p>
        </div>
      </div>
    </div>
  )
}

const STATUS_META: Record<string, { label: string; icon: typeof Clock; className: string }> = {
  sending: { label: 'Sending…', icon: Clock, className: 'bg-lca-gold/15 text-gold-ink-badge' },
  completed: { label: 'Completed', icon: CheckCircle2, className: 'bg-ok-100 text-ok' },
  failed: { label: 'Failed', icon: XCircle, className: 'bg-bad-100 text-bad-700' },
}

/**
 * When a send was made, in a row of the history or of the newsletter's recent sends. With mailLists on, as the site
 * writes a stored time: the day with its weekday and year and the time on the 12-hour clock, in Louisiana, read as
 * the UTC that datetime('now') wrote ("Tue, Nov 3, 2026 · 9:00 AM"). With it off, today's words.
 */
function sentAt(createdAt: string): string {
  if (!FEATURES.mailLists) return new Date(createdAt).toLocaleString()
  return `${formatDate(createdAt, { stored: 'utc', year: true })} · ${formatTime(createdAt, { stored: 'utc' })}`
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
          <p className="truncate font-medium text-ink">{c.subject}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {sentAt(c.created_at)} · {c.total_recipients} recipients
          </p>
        </div>
        <span className={cn('flex flex-shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium', meta.className)}>
          <Icon className="size-3" /> {meta.label}
        </span>
      </div>
      <div className="mt-3">
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
          <div className="h-full rounded-full bg-lca-gold transition-all" style={{ width: `${pct}%` }} />
        </div>
        <p className="mt-1 text-[11px] text-muted-foreground">
          {c.sent_count} sent
          {c.failed_count > 0 && <span className="text-bad"> · {c.failed_count} failed</span>}
          {' '}· {pct}%
        </p>
      </div>
    </div>
  )
}

/** A newsletter send as the history's rows draw a campaign, so the newsletter tab's recent sends are in the history's style. */
function asCampaign(send: ApiNewsletter['summary']['recent'][number]): ApiCampaign {
  return {
    id: send.id,
    subject: send.subject,
    total_recipients: send.totalRecipients,
    sent_count: send.sentCount,
    failed_count: send.failedCount,
    status: send.status,
    created_at: send.createdAt,
    completed_at: send.completedAt,
  }
}

/**
 * The box an LCA admin ticks to send the newsletter's test through Amazon SES while Resend still sends, so the stored
 * key can be proved from the site before the cutover; drawn for no one else. The server reads it from WS16 step 7 on.
 */
function SesTestChoice({ checked, onChange }: { checked: boolean; onChange: (on: boolean) => void }) {
  const { role } = useAuth()
  if (role !== 'lca_admin') return null
  return (
    <label className="mt-2 flex min-h-6 items-center gap-2 text-xs text-ink">
      <input type="checkbox" className="size-4 accent-ink" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      Send the test through Amazon SES
    </label>
  )
}

/**
 * `embedded` renders it as a section of the admin panel: no page hero or
 * outer page padding, and the panel sets the tab title. `mediaManager`, which
 * the admin panel gives with mailLists on for the media manager alone (WS16
 * step 6), draws their form of the page: the newsletter's tab alone, with no
 * Specific people and no Send history column; no call but the newsletter's
 * own, so nothing of today's history, members or clubs is asked for; and,
 * while the session carries no second factor, one line linked to where it is
 * set up in place of the send buttons, the newsletter's calls being refused
 * until then.
 */
export function AdminEmailPage({ embedded = false, mediaManager }: { embedded?: boolean; mediaManager?: { secondFactor: boolean } } = {}) {
  usePageTitle(embedded ? 'Admin · Group email' : 'Group Email')
  const forMediaManager = FEATURES.mailLists && mediaManager !== undefined
  const canSend = !forMediaManager || mediaManager?.secondFactor === true

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
  // 'groups' = pick by role/club/status (empty = everyone), then trim.
  // 'people' = start from nobody and add names or typed-in addresses.
  // 'newsletter' = the LCA newsletter list, with mailLists on, where the page opens; 'groups' is never set then.
  const [mode, setMode] = useState<Mode>(FEATURES.mailLists ? 'newsletter' : 'groups')
  // Addresses with no account behind them.
  const [extraEmails, setExtraEmails] = useState<string[]>([])
  const [addSearch, setAddSearch] = useState('')

  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showPreview, setShowPreview] = useState(false)

  const [testEmail, setTestEmail] = useState('')
  const [testSending, setTestSending] = useState(false)
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null)

  // The newsletter tab, with mailLists on: the server's answer, the test through Amazon SES, the stop's words, and the
  // two parts that open, Help (open by itself the first time in this browser) and Who gets it (closed when the tab opens).
  const [newsletter, setNewsletter] = useState<ApiNewsletter | null>(null)
  const [newsletterFailed, setNewsletterFailed] = useState(false)
  const [sesTest, setSesTest] = useState(false)
  const [stopping, setStopping] = useState(false)
  const [stopped, setStopped] = useState<string | null>(null)
  const [helpOpen, setHelpOpen] = useState(() => FEATURES.mailLists && !helpShownBefore())
  const [whoOpen, setWhoOpen] = useState(false)
  const helpId = useId()
  const whoId = useId()

  function currentFilter() {
    return { roles, clubIds, membershipStatuses: statuses }
  }

  async function loadHistory() {
    try {
      setCampaigns(await getCampaigns())
    } catch { /* keep prior list on transient failure */ }
  }

  /** The newsletter's count, sender and recent sends read again; a failure keeps what the tab shows. */
  async function loadNewsletter() {
    try {
      setNewsletter(await getNewsletter())
    } catch { /* keep what the tab shows on a transient failure, as the history does */ }
  }

  useEffect(() => {
    // The media manager's page asks for none of Group email's own lists: no clubs, no members and no history.
    if (forMediaManager) return
    let cancelled = false
    getClubs().then((c) => { if (!cancelled) setClubs(c) }).catch(() => {})
    adminGetMembers().then((m) => { if (!cancelled) setMemberPool(m) }).catch(() => {})
    getCampaigns()
      .then((c) => { if (!cancelled) setCampaigns(c) })
      .catch(() => { /* keep prior list on transient failure */ })
      .finally(() => { if (!cancelled) setLoadingHistory(false) })
    return () => { cancelled = true }
  }, [forMediaManager])

  // With mailLists on the page opens on the newsletter tab: its answer is read, and Help, open by itself, is remembered
  // as shown. With the switch off nothing here runs, so no key is read or written. The media manager without a second
  // factor is refused the newsletter's calls, so the page asks it nothing, as it opens or on a click of its tab.
  useEffect(() => {
    if (!FEATURES.mailLists) return
    let cancelled = false
    rememberHelpShown()
    if (!canSend) return
    getNewsletter()
      .then((n) => { if (!cancelled) setNewsletter(n) })
      .catch((err: unknown) => {
        if (cancelled) return
        setNewsletterFailed(true)
        if (err instanceof Error) setError(err.message)
      })
    return () => { cancelled = true }
  }, [canSend])

  // Poll while any campaign is still sending, and with mailLists on while a newsletter is; the media manager's page
  // reads the newsletter alone.
  const newsletterSending = newsletter?.summary.recent.some((s) => s.status === 'sending') ?? false
  useEffect(() => {
    if (!campaigns.some((c) => c.status === 'sending') && !newsletterSending) return
    const timer = setInterval(() => {
      if (!forMediaManager) void loadHistory()
      if (FEATURES.mailLists) void loadNewsletter()
    }, 3000)
    return () => clearInterval(timer)
  }, [campaigns, newsletterSending, forMediaManager])

  // Final send list = whatever the filter resolved to, minus anyone X'd
  // off, plus anyone hand-picked from the individual-member search.
  const finalList = useMemo(() => {
    const kept = mode === 'people' ? [] : resolvedRecipients.filter((r) => !excludedIds.has(r.id))
    const members = [...kept, ...manuallyAdded]
    const onList = new Set(members.map((r) => r.email.toLowerCase()))
    const typed = extraEmails
      .filter((e) => !onList.has(e))
      .map((e) => ({ id: `ext:${e}`, email: e, full_name: e }))
    return [...members, ...typed]
  }, [mode, resolvedRecipients, excludedIds, manuallyAdded, extraEmails])

  async function handlePreview() {
    if (mode === 'people') {
      setResolvedRecipients([])
      setExcludedIds(new Set())
      setConfirming(true)
      return
    }
    setPreviewing(true)
    setError(null)
    try {
      const { recipients } = await previewCampaignCount(currentFilter())
      setResolvedRecipients(recipients)
      setExcludedIds(new Set())
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
  function removeExtra(email: string) {
    setExtraEmails((prev) => prev.filter((e) => e !== email))
  }
  function addExtra(raw: string) {
    // Accepts one address or several pasted at once (commas, spaces, lines).
    const found = raw.split(/[\s,;]+/).map((e) => e.trim().toLowerCase()).filter((e) => EMAIL_RE.test(e))
    if (found.length === 0) return
    // Someone typed a member's address: add the member instead.
    const byEmail = new Map(memberPool.map((m) => [m.email.toLowerCase(), m]))
    const members = found.map((e) => byEmail.get(e)).filter((m): m is ApiAdminMember => !!m)
    if (members.length) {
      setManuallyAdded((prev) => [
        ...prev,
        ...members.filter((m) => !prev.some((p) => p.id === m.id)).map((m) => ({ id: m.id, email: m.email, full_name: m.full_name })),
      ])
    }
    const outsiders = found.filter((e) => !byEmail.has(e))
    setExtraEmails((prev) => [...new Set([...prev, ...outsiders])])
    setAddSearch('')
  }
  /** Empties the list in one click, so a few people can be added back. */
  function removeAll() {
    setExcludedIds(new Set(resolvedRecipients.map((r) => r.id)))
    setManuallyAdded([])
    setExtraEmails([])
  }
  function removeFromList(r: ApiCampaignRecipient) {
    if (r.id.startsWith('ext:')) removeExtra(r.email)
    else if (manuallyAdded.some((m) => m.id === r.id)) removeManual(r.id)
    else excludeFromResolved(r.id)
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
        excludeMemberIds: mode === 'people' ? [] : [...excludedIds],
        includeMemberIds: manuallyAdded.map((m) => m.id),
        onlySelected: mode === 'people',
        extraEmails,
      })
      setSubject('')
      setBody('')
      setConfirming(false)
      setResolvedRecipients([])
      setExcludedIds(new Set())
      setManuallyAdded([])
      setExtraEmails([])
      await loadHistory()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start campaign')
    } finally {
      setSending(false)
    }
  }

  /** The newsletter's send, after its one confirm step; a refusal's words, as the server gives them, go in the error line. */
  async function handleSendNewsletter() {
    if (!window.confirm(`Send to the LCA newsletter list (${newsletter?.summary.willGet ?? 0} addresses)?`)) return
    setSending(true)
    setError(null)
    setStopped(null)
    try {
      await sendNewsletter({ subject: subject.trim(), bodyHtml: body })
      setSubject('')
      setBody('')
      await Promise.all([loadNewsletter(), forMediaManager ? null : loadHistory()])
    } catch (err) {
      if (err instanceof Error) setError(err.message)
    } finally {
      setSending(false)
    }
  }

  /** The stop, after its own question: its words go in the newsletter's status region, and a refusal's in the error line. */
  async function handleStop() {
    if (!window.confirm("Stop the newsletter? Addresses not yet reached won't get it.")) return
    setStopping(true)
    setError(null)
    try {
      const { stopped: count } = await stopNewsletter()
      setStopped(`Stopped. ${count} addresses were not sent it.`)
      await Promise.all([loadNewsletter(), forMediaManager ? null : loadHistory()])
    } catch (err) {
      if (err instanceof Error) setError(err.message)
    } finally {
      setStopping(false)
    }
  }

  async function handleSendTest() {
    setTestSending(true)
    setTestResult(null)
    try {
      if (mode === 'newsletter') {
        // The newsletter's own test, with the real footer and links for this address, through Amazon SES when asked.
        const service = sesTest && newsletter?.sendsThrough === 'resend' ? { service: 'ses' as const } : {}
        await sendNewsletterTest({ to: testEmail.trim(), subject: subject.trim(), bodyHtml: body, ...service })
      } else {
        await sendTestCampaignEmail({ email: testEmail.trim(), subject: subject.trim(), bodyHtml: body })
      }
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
  const typedAddresses = addSearch.split(/[\s,;]+/).filter((e) => EMAIL_RE.test(e.trim()))
  const addMatches = addQuery.length >= 2
    ? memberPool
        .filter((m) => !finalIds.has(m.id))
        .filter((m) => m.full_name.toLowerCase().includes(addQuery) || m.email.toLowerCase().includes(addQuery))
        .slice(0, 6)
    : []

  // With mailLists on the subtitle says what the page offers now; today's promises a group by role, club or status.
  const tabs = forMediaManager ? MEDIA_MANAGER_TABS : FEATURES.mailLists ? NEWSLETTER_TABS : TODAY_TABS
  const subtitle = forMediaManager ? MEDIA_MANAGER_SUBTITLE : NEWSLETTER_SUBTITLE
  const waitsForSes = newsletter?.sendsThrough === 'resend'

  // The newsletter's own recent sends, with the status region and the stop: in the history column for everyone who may
  // send it, and under its tab on the media manager's page, which draws no Send history column.
  const newsletterSends = (
    <div className="space-y-3">
      <div role="status" className="space-y-1 text-sm text-ink">
        {newsletterSending && newsletter?.summary.waits && <p>{newsletter.summary.waits}</p>}
        {stopped && <p>{stopped}</p>}
      </div>
      {newsletterSending && (
        <Button type="button" variant="outline" disabled={stopping} onClick={handleStop}>
          Stop sending
        </Button>
      )}
      {newsletter === null ? (
        !newsletterFailed && <p className="text-sm text-muted-foreground">Loading…</p>
      ) : newsletter.summary.recent.length === 0 ? (
        <div className="rounded-xl border border-dashed px-6 py-10 text-center">
          <p className="text-sm text-muted-foreground">No campaigns sent yet.</p>
        </div>
      ) : (
        newsletter.summary.recent.map((send) => <CampaignRow key={send.id} c={asCampaign(send)} />)
      )}
    </div>
  )

  return (
    <div>
      {FEATURES.mailLists && embedded ? (
        <div className="mb-5">
          <h2 className="text-xl font-bold text-ink">Group email</h2>
          <p className="mt-0.5 text-sm text-muted-foreground">{subtitle}</p>
        </div>
      ) : FEATURES.mailLists ? (
        <PageHero title="Group email" subtitle={subtitle} />
      ) : embedded ? (
        <div className="mb-5">
          <h2 className="text-xl font-bold text-ink">Group email</h2>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Send an email to members — everyone, or a targeted group by role, club, or membership status.
          </p>
        </div>
      ) : (
        <PageHero
          title="Group email"
          subtitle="Send an email to members — everyone, or a targeted group by role, club, or membership status."
        />
      )}

      <section className={embedded ? '' : 'mx-auto max-w-6xl px-6 py-10'}>
        <div className={cn('grid gap-10', !forMediaManager && (embedded ? 'xl:grid-cols-[1.3fr_1fr]' : 'lg:grid-cols-[1.3fr_1fr]'))}>

          {/* ── Compose ── */}
          <div>
            <div className="mb-4 flex items-center gap-2">
              <Mail className="size-5 text-gold-ink" />
              <h2 className="text-xl font-bold text-ink">Compose</h2>
            </div>

            <div className="space-y-4 rounded-xl border bg-card p-5 shadow-sm">
              <div>
                {FEATURES.mailLists ? (
                  <div className="flex items-center justify-between gap-2">
                    <Label className="text-xs">Recipients</Label>
                    <button type="button" aria-expanded={helpOpen} aria-controls={helpId} onClick={() => setHelpOpen((open) => !open)} className={OPENER}>
                      <CircleHelp className="size-3.5" aria-hidden="true" /> Help
                    </button>
                  </div>
                ) : (
                  <Label className="text-xs">Recipients</Label>
                )}
                <div role="tablist" className="mb-2 mt-1.5 inline-flex rounded-lg border p-0.5 text-xs font-medium">
                  {tabs.map(([value, label]) => (
                    <button key={value} type="button" role="tab" aria-selected={mode === value}
                      onClick={() => {
                        setMode(value)
                        setConfirming(false)
                        // Choosing the newsletter tab reads its answer again, with Who gets it closed, for anyone who may send it.
                        if (value === 'newsletter') {
                          setWhoOpen(false)
                          if (canSend) void loadNewsletter()
                        }
                      }}
                      className={cn('rounded-md px-3 py-1 transition-colors',
                        mode === value ? 'bg-brand-navy text-white' : 'text-muted-foreground hover:text-foreground')}>
                      {label}
                    </button>
                  ))}
                </div>
                {FEATURES.mailLists && (
                  <section id={helpId} hidden={!helpOpen} aria-labelledby={`${helpId}-heading`} className="mb-2 rounded-lg border bg-muted/40 p-3 text-xs text-ink">
                    <h3 id={`${helpId}-heading`} className="mb-1 font-semibold">Help</h3>
                    {mode === 'newsletter' ? (
                      <>
                        <p>{GUARDRAILS}</p>
                        <p className="mt-1">{BOTH_LINKS}</p>
                      </>
                    ) : (
                      <p>{SPECIFIC_PEOPLE_LINE}</p>
                    )}
                  </section>
                )}
                {mode === 'people' ? (
                  <p className="text-[11px] text-muted-foreground">
                    Start from nobody: search members by name, or type any email address, including people without an account.
                  </p>
                ) : mode === 'newsletter' ? (
                  <div className="space-y-1 text-xs text-ink">
                    {newsletter && (
                      <>
                        <p>{newsletter.summary.willGet} addresses will get it.</p>
                        <button type="button" aria-expanded={whoOpen} aria-controls={whoId} onClick={() => setWhoOpen((open) => !open)} className={cn(OPENER, '-ml-1.5')}>
                          Who gets it <ChevronDown className={cn('size-3.5 transition-transform', whoOpen && 'rotate-180')} aria-hidden="true" />
                        </button>
                        <p id={whoId} hidden={!whoOpen} className="rounded-lg border p-2 text-muted-foreground">
                          Every address on an account with an active membership, once. Left out: {newsletter.summary.turnedOff + newsletter.summary.stoppedAll} who turned the newsletter off and {newsletter.summary.doNotSend} that no longer receive mail.
                        </p>
                        <p>It goes from {newsletter.from}.</p>
                      </>
                    )}
                  </div>
                ) : (
                <>
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
                </>
                )}
              </div>

              <div>
                <Label className="text-xs">Subject</Label>
                <Input className="mt-1" value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="e.g. Fall tournament registration is open" />
              </div>

              <div>
                <div className="flex items-center justify-between">
                  <Label className="text-xs">Message</Label>
                  <button type="button" onClick={() => setShowPreview((p) => !p)} className="flex items-center gap-1 text-[11px] font-medium text-ink hover:underline">
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
                    <BrandedEmailPreview subject={subject} bodyHtml={body} listFooter={mode === 'newsletter' ? LIST_FOOTER_WORDS[NEWSLETTER_LIST_ID] : undefined} />
                  </div>
                )}
              </div>

              {/* ── Test send ── */}
              {canSend && (
              <div className="rounded-lg border border-dashed p-3">
                <p className="mb-2 flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground">
                  <FlaskConical className="size-3.5 text-gold-ink" />
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
                {mode === 'newsletter' && waitsForSes && <SesTestChoice checked={sesTest} onChange={setSesTest} />}
                {FEATURES.mailLists ? (
                  <p role="status" className={cn('text-xs', testResult && 'mt-2', testResult?.ok ? 'text-ok-700' : 'text-destructive')}>{testResult?.message}</p>
                ) : testResult && (
                  <p className={cn('mt-2 text-xs', testResult.ok ? 'text-ok-700' : 'text-destructive')}>{testResult.message}</p>
                )}
                <p className="mt-1.5 text-[10px] text-muted-foreground">
                  Test emails are marked [TEST] in the subject and don't count toward — or appear in — send history.
                </p>
              </div>
              )}

              {FEATURES.mailLists ? (
                <p role="status" className="text-sm text-destructive">{error}</p>
              ) : error && <p className="text-sm text-destructive">{error}</p>}

              {!canSend ? (
                // The media manager signed in without a second factor: in place of the send buttons, one line to where it
                // is set up, since the newsletter's every call is refused until then.
                <p className="text-sm text-ink">
                  <Link to="/account/security" className="rounded-sm font-medium underline underline-offset-2 outline-none hover:no-underline focus-visible:ring-3 focus-visible:ring-focus">
                    {SECOND_FACTOR_LINE}
                  </Link>
                </p>
              ) : mode === 'newsletter' ? (
                <div className="space-y-1.5">
                  {/* Off while Resend still sends, with the reason beside it; the one confirm step asks with the count. */}
                  <Button
                    type="button"
                    className={cn('w-full', GOLD)}
                    disabled={sending || waitsForSes || newsletter === null || !canPreview}
                    onClick={handleSendNewsletter}
                  >
                    <Send className="mr-1.5 size-3.5" /> {sending ? 'Sending…' : 'Send to the LCA newsletter list'}
                  </Button>
                  {waitsForSes ? (
                    <p className="text-[11px] text-muted-foreground">{WAITS_FOR_SES_LINE}</p>
                  ) : !canPreview && (
                    <p className="text-[11px] text-muted-foreground">
                      Add {!subject.trim() && !body.trim() ? 'a subject and a message' : !subject.trim() ? 'a subject' : 'a message'} before sending.
                    </p>
                  )}
                </div>
              ) : !confirming ? (
                <div className="space-y-1.5">
                  <Button
                    type="button"
                    className={cn('w-full', GOLD)}
                    disabled={previewing}
                    onClick={handlePreview}
                  >
                    {previewing ? 'Resolving recipients…' : mode === 'people' ? 'Choose people' : 'Review recipients'}
                  </Button>
                  <p className="text-[10px] text-muted-foreground">
                    {mode === 'people'
                      ? 'Pick who gets it on the next step. Nothing is sent until you confirm.'
                      : 'Shows exactly who the filters match, so you can remove anyone before sending. Nothing is sent from this step.'}
                  </p>
                </div>
              ) : (
                <div className="rounded-lg border border-lca-gold/50 bg-lca-gold/8 p-4">
                  <p className="flex items-center gap-2 text-sm font-medium text-ink">
                    <Users className="size-4 text-gold-ink" />
                    This will email <span className="font-bold">{finalList.length}</span> {finalList.length === 1 ? 'person' : 'people'}.
                  </p>
                  {mode === 'groups' && (
                    <div className="mt-1.5 flex flex-wrap gap-3 text-[11px]">
                      {finalList.length > 0 && (
                        <button type="button" onClick={removeAll} className="font-medium text-ink hover:underline">
                          Remove all
                        </button>
                      )}
                      {excludedIds.size > 0 && (
                        <button type="button" onClick={() => setExcludedIds(new Set())} className="font-medium text-ink hover:underline">
                          Restore {excludedIds.size} removed
                        </button>
                      )}
                    </div>
                  )}

                  {/* ── Reviewable list ── */}
                  <div className="mt-3 max-h-64 overflow-y-auto rounded-lg border bg-card">
                    {finalList.length === 0 ? (
                      <p className="px-3 py-4 text-center text-xs text-muted-foreground">
                        {mode === 'people'
                          ? 'Nobody yet — search for a member or type an email address below.'
                          : 'Nobody left to send to — add someone below or adjust the filters.'}
                      </p>
                    ) : (
                      finalList.map((r) => {
                        const isTyped = r.id.startsWith('ext:')
                        const isManual = isTyped || (mode === 'groups' && manuallyAdded.some((m) => m.id === r.id))
                        return (
                          <div key={r.id} className="flex items-center justify-between gap-2 border-b border-border px-3 py-2 last:border-0">
                            <div className="min-w-0">
                              <p className="truncate text-xs font-medium text-foreground">
                                {r.full_name}
                                {isManual && (
                                  <span className="ml-1.5 rounded-full bg-lca-gold/15 px-1.5 py-0.5 text-[9px] font-medium text-gold-ink-badge">
                                    {isTyped ? 'No account' : 'Added'}
                                  </span>
                                )}
                              </p>
                              {!isTyped && <p className="truncate text-[11px] text-muted-foreground">{r.email}</p>}
                            </div>
                            <button
                              type="button"
                              onClick={() => removeFromList(r)}
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
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && typedAddresses.length > 0) { e.preventDefault(); addExtra(addSearch) }
                        }}
                        onPaste={(e) => {
                          const text = e.clipboardData.getData('text')
                          if (/[\s,;]/.test(text.trim()) && EMAIL_RE.test(text.split(/[\s,;]+/)[0] ?? '')) {
                            e.preventDefault()
                            addExtra(text)
                          }
                        }}
                        placeholder="Add a member by name, or type / paste email addresses…"
                      />
                    </div>
                    {typedAddresses.length > 0 && (
                      <button type="button" onClick={() => addExtra(addSearch)}
                        className="mt-1.5 flex w-full items-center justify-between gap-2 rounded-lg border px-3 py-2 text-left hover:bg-muted/50">
                        <span className="min-w-0 truncate text-xs">
                          Add <span className="font-medium">{typedAddresses.join(', ')}</span>
                          {typedAddresses.every((e) => !memberPool.some((m) => m.email.toLowerCase() === e.trim().toLowerCase())) && (
                            <span className="text-muted-foreground"> (no account)</span>
                          )}
                        </span>
                        <UserPlus className="size-3.5 flex-shrink-0 text-gold-ink" />
                      </button>
                    )}
                    {addQuery.length >= 2 && typedAddresses.length === 0 && (
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
                              <UserPlus className="size-3.5 flex-shrink-0 text-gold-ink" />
                            </button>
                          ))}
                        </div>
                      ) : (
                        <p className="mt-1.5 text-[11px] text-muted-foreground">No members match "{addSearch.trim()}".</p>
                      )
                    )}
                  </div>

                  <div className="mt-4 flex gap-2">
                    <Button
                      type="button"
                      className={GOLD}
                      onClick={handleSend}
                      disabled={sending || finalList.length === 0 || !canPreview}
                    >
                      <Send className="mr-1.5 size-3.5" /> {sending ? 'Sending…' : 'Confirm & send'}
                    </Button>
                    <Button type="button" variant="outline" onClick={() => setConfirming(false)} disabled={sending}>
                      Back to edit
                    </Button>
                  </div>
                  {!canPreview && (
                    <p className="mt-2 text-[11px] text-muted-foreground">
                      Add {!subject.trim() && !body.trim() ? 'a subject and a message' : !subject.trim() ? 'a subject' : 'a message'} before sending.
                    </p>
                  )}
                </div>
              )}
            </div>
            {/* The media manager's page has no history column: the newsletter's recent sends and its stop sit under its tab. */}
            {forMediaManager && canSend && <div className="mt-6">{newsletterSends}</div>}
          </div>

          {/* ── History ── */}
          {!forMediaManager && (
          <div>
            <h2 className="mb-4 text-xl font-bold text-ink">Send history</h2>
            {mode === 'newsletter' ? (
              // The newsletter's own recent sends while its tab is open, in the history's rows, for everyone who may send
              // it; the status region says how the sending one stands, why it waits and what the stop did.
              newsletterSends
            ) : loadingHistory ? (
              <p className="text-sm text-muted-foreground">Loading…</p>
            ) : campaigns.length === 0 ? (
              <div className="rounded-xl border border-dashed px-6 py-10 text-center">
                <p className="text-sm text-muted-foreground">No campaigns sent yet.</p>
              </div>
            ) : (
              <div className={`${ADMIN_SCROLL} space-y-3 pr-1`}>
                {campaigns.map((c) => <CampaignRow key={c.id} c={c} />)}
              </div>
            )}
          </div>
          )}
        </div>
      </section>
    </div>
  )
}