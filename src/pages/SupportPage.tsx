// src/pages/SupportPage.tsx
import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { MessageSquare, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { useAuth } from '@/contexts/AuthContext'
import {
  createSupportTicket,
  getMyTickets,
  getTicket,
  replyToTicket,
  type ApiSupportTicket,
  type ApiSupportMessage,
} from '@/lib/api'

const statusColors: Record<string, string> = {
  open: 'bg-blue-100 text-blue-800',
  new: 'bg-blue-100 text-blue-800',
  answered: 'bg-emerald-100 text-emerald-800',
  in_progress: 'bg-yellow-100 text-yellow-800',
  resolved: 'bg-gray-100 text-gray-600',
}

const statusLabels: Record<string, string> = {
  open: 'New',
  new: 'New',
  answered: 'Answered',
  in_progress: 'In Progress',
  resolved: 'Resolved',
}

export function SupportPage() {
  const { user, member } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()
  const [view, setView] = useState<'list' | 'new' | 'ticket'>('list')
  const [tickets, setTickets] = useState<ApiSupportTicket[]>([])
  const [selectedTicket, setSelectedTicket] = useState<{
    ticket: ApiSupportTicket
    messages: ApiSupportMessage[]
  } | null>(null)
  const [loading, setLoading] = useState(false)
  const [ticketError, setTicketError] = useState<string | null>(null)
  const [replyBody, setReplyBody] = useState('')
  const [sending, setSending] = useState(false)
  const [submitStatus, setSubmitStatus] = useState<'idle' | 'sending' | 'success'>('idle')
  const [submittedTicketId, setSubmittedTicketId] = useState<string | null>(null)

  const [form, setForm] = useState({
    name: member?.full_name ?? user?.user_metadata?.full_name ?? '',
    email: user?.email ?? '',
    subject: '',
    body: '',
  })

  // Update form when user loads
  useEffect(() => {
    if (user) {
      setForm(f => ({
        ...f,
        name: f.name || member?.full_name || user.user_metadata?.full_name || '',
        email: user.email ?? '',
      }))
    }
  }, [user, member])

  useEffect(() => {
    if (user) {
      setLoading(true)
      getMyTickets()
        .then(d => setTickets(d.tickets))
        .catch(() => {})
        .finally(() => setLoading(false))
    }
  }, [user])

  // Deep links: /support?ticket=<id> opens a ticket directly (used by the
  // dashboard's ticket list); /support?new=1 opens the new-ticket form.
  useEffect(() => {
    const ticketId = searchParams.get('ticket')
    if (ticketId && user) {
      openTicketById(ticketId)
      return
    }
    if (searchParams.get('new')) {
      setView('new')
      setSubmitStatus('idle')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, user])

  async function handleCreateTicket(e: React.FormEvent) {
    e.preventDefault()
    setSending(true)
    try {
      const result = await createSupportTicket(form)
      setSubmitStatus('success')
      setSubmittedTicketId(result.ticketId)
      if (user) {
        const data = await getMyTickets()
        setTickets(data.tickets)
      }
    } catch {
      // Keep the current list rather than blanking it on a transient failure.
    } finally {
      setSending(false)
    }
  }

  async function openTicketById(ticketId: string) {
    setTicketError(null)
    try {
      const data = await getTicket(ticketId)
      setSelectedTicket(data)
      setView('ticket')
    } catch (err) {
      // Never fail silently: surface why the ticket didn't open.
      setTicketError(
        err instanceof Error ? err.message : 'Could not open this ticket.',
      )
      setView('list')
    }
  }

  async function openTicket(ticket: ApiSupportTicket) {
    await openTicketById(ticket.id)
  }

  function backToList() {
    setView('list')
    setTicketError(null)
    if (searchParams.get('ticket') || searchParams.get('new')) {
      setSearchParams({}, { replace: true })
    }
  }

  async function handleReply(e: React.FormEvent) {
    e.preventDefault()
    if (!selectedTicket) return
    setSending(true)
    setTicketError(null)
    try {
      await replyToTicket(selectedTicket.ticket.id, replyBody)
      const data = await getTicket(selectedTicket.ticket.id)
      setSelectedTicket(data)
      setReplyBody('')
    } catch (err) {
      setTicketError(
        err instanceof Error ? err.message : 'Failed to send reply.',
      )
    } finally {
      setSending(false)
    }
  }

  const newTickets = tickets.filter(t =>
    t.status === 'open' || t.status === 'new'
  )
  const answeredTickets = tickets.filter(t =>
    t.status === 'answered' || t.status === 'in_progress' || t.status === 'resolved'
  )

  return (
    <div className="mx-auto max-w-4xl px-6 py-12">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-lca-navy">Support</h1>
          <p className="text-muted-foreground mt-1">
            Get help from the LCA team
          </p>
        </div>
        {view === 'list' && (
          <Button
            className="bg-lca-gold text-lca-navy hover:bg-lca-gold/90 font-semibold"
            onClick={() => { setView('new'); setSubmitStatus('idle') }}
          >
            <Plus className="size-4 mr-2" />
            New ticket
          </Button>
        )}
        {view !== 'list' && (
          <Button variant="outline" onClick={backToList}>
            ← Back
          </Button>
        )}
      </div>

      {ticketError && view === 'list' && (
        <p className="mb-6 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {ticketError}
        </p>
      )}

      {view === 'list' && (
        <div className="space-y-8">
          {!user && (
            <div className="rounded-lg border p-6 text-center text-muted-foreground">
              <MessageSquare className="size-8 mx-auto mb-3 text-lca-gold" />
              <p className="font-medium text-foreground mb-1">
                Sign in to view your tickets
              </p>
              <p className="text-sm mb-4">
                Sign in to track your support tickets. You can also create a
                ticket as a guest but you won't be able to track it later.
              </p>
              <div className="flex gap-3 justify-center">
                <Button asChild variant="outline">
                  <Link to="/login">Sign in</Link>
                </Button>
                <Button
                  className="bg-lca-gold text-lca-navy font-semibold"
                  onClick={() => setView('new')}
                >
                  Continue as guest
                </Button>
              </div>
            </div>
          )}

          {user && loading && (
            <p className="text-muted-foreground" role="status">Loading tickets…</p>
          )}

          {user && !loading && tickets.length === 0 && (
            <div className="rounded-lg border p-6 text-center text-muted-foreground">
              <p>No support tickets yet.</p>
              <p className="text-sm mt-1">
                Click <strong>New ticket</strong> to get help from the LCA team.
              </p>
            </div>
          )}

          {user && !loading && newTickets.length > 0 && (
            <div>
              <h2 className="text-lg font-semibold text-lca-navy mb-3">
                New tickets
              </h2>
              <div className="space-y-3">
                {newTickets.map(ticket => (
                  <TicketRow
                    key={ticket.id}
                    ticket={ticket}
                    onClick={() => openTicket(ticket)}
                  />
                ))}
              </div>
            </div>
          )}

          {user && !loading && answeredTickets.length > 0 && (
            <div>
              <h2 className="text-lg font-semibold text-lca-navy mb-3">
                Answered tickets
              </h2>
              <div className="space-y-3">
                {answeredTickets.map(ticket => (
                  <TicketRow
                    key={ticket.id}
                    ticket={ticket}
                    onClick={() => openTicket(ticket)}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {view === 'new' && (
        <div className="max-w-lg">
          {submitStatus === 'success' ? (
            <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-6 text-center">
              <p className="text-emerald-800 font-medium text-lg">
                Ticket created!
              </p>
              <p className="text-emerald-700 text-sm mt-1">
                We'll respond as soon as possible.
                {submittedTicketId && (
                  <span className="block mt-1 text-xs">
                    Ticket ID: {submittedTicketId}
                  </span>
                )}
              </p>
              {!user && (
                <p className="text-sm text-emerald-700 mt-2">
                  <Link to="/login" className="underline font-medium">
                    Sign in
                  </Link>{' '}
                  to track this ticket and receive replies on the site.
                  A confirmation has been sent to your email.
                </p>
              )}
              {user && (
                <Button
                  className="mt-4"
                  variant="outline"
                  onClick={backToList}
                >
                  View my tickets
                </Button>
              )}
            </div>
          ) : (
            <form onSubmit={handleCreateTicket} className="space-y-4">
              {!user && (
                <div className="rounded-lg bg-blue-50 border border-blue-200 p-4 text-sm text-blue-800">
                  <Link to="/login" className="font-medium underline">
                    Sign in
                  </Link>{' '}
                  to track this ticket and get replies on the site.
                  Otherwise we'll only be able to reply by email.
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="name">Name</Label>
                <Input
                  id="name"
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={form.email}
                  onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                  required
                />
                {user && form.email !== user.email && (
                  <p className="text-xs text-yellow-700 bg-yellow-50 border border-yellow-200 rounded px-3 py-2">
                    This is different from your account email ({user.email}).
                    Replies will be sent to {form.email}.
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="subject">Subject</Label>
                <Input
                  id="subject"
                  value={form.subject}
                  onChange={e => setForm(f => ({ ...f, subject: e.target.value }))}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="body">Describe your issue</Label>
                <Textarea
                  id="body"
                  rows={6}
                  value={form.body}
                  onChange={e => setForm(f => ({ ...f, body: e.target.value }))}
                  required
                />
              </div>
              <Button
                type="submit"
                className="w-full bg-lca-navy hover:bg-lca-navy/90"
                disabled={sending}
              >
                {sending ? 'Creating ticket…' : 'Create ticket'}
              </Button>
            </form>
          )}
        </div>
      )}

      {view === 'ticket' && selectedTicket && (
        <div>
          <div className="flex items-center gap-3 mb-6">
            <h2 className="text-xl font-semibold text-lca-navy">
              {selectedTicket.ticket.subject}
            </h2>
            <span
              className={`text-xs px-2 py-1 rounded-full font-medium ${statusColors[selectedTicket.ticket.status] ?? ''}`}
            >
              {statusLabels[selectedTicket.ticket.status] ?? selectedTicket.ticket.status}
            </span>
          </div>

          <div className="space-y-4 mb-8">
            {selectedTicket.messages.map(msg => (
              <div
                key={msg.id}
                className={`rounded-lg p-4 ${
                  msg.sender_type === 'admin'
                    ? 'bg-lca-navy/5 border border-lca-navy/10'
                    : 'bg-muted'
                }`}
              >
                <p className="text-xs font-medium text-muted-foreground mb-2">
                  {msg.sender_type === 'admin' ? 'LCA Support' : 'You'} ·{' '}
                  {new Date(msg.created_at).toLocaleString()}
                </p>
                <p className="text-sm whitespace-pre-wrap">{msg.body}</p>
              </div>
            ))}
          </div>

          <form onSubmit={handleReply} className="space-y-3">
            {ticketError && (
              <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {ticketError}
              </p>
            )}
            <Label htmlFor="reply">Add a reply</Label>
            <Textarea
              id="reply"
              rows={4}
              value={replyBody}
              onChange={e => setReplyBody(e.target.value)}
              placeholder="Type your reply…"
              required
            />
            <Button
              type="submit"
              className="bg-lca-navy hover:bg-lca-navy/90"
              disabled={sending}
            >
              {sending ? 'Sending…' : 'Send reply'}
            </Button>
          </form>
        </div>
      )}
    </div>
  )
}

function TicketRow({
  ticket,
  onClick,
}: {
  ticket: ApiSupportTicket
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className="w-full text-left rounded-lg border p-4 hover:bg-muted/50 transition-colors"
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="font-medium text-lca-navy">{ticket.subject}</p>
          <p className="text-sm text-muted-foreground mt-0.5 line-clamp-1">
            {ticket.last_message}
          </p>
        </div>
        <span
          className={`text-xs px-2 py-1 rounded-full font-medium shrink-0 ${
            statusColors[ticket.status] ?? ''
          }`}
        >
          {statusLabels[ticket.status] ?? ticket.status}
        </span>
      </div>
      <p className="text-xs text-muted-foreground mt-2">
        {new Date(ticket.updated_at).toLocaleDateString()} ·{' '}
        {ticket.message_count} message{ticket.message_count !== 1 ? 's' : ''}
      </p>
    </button>
  )
}
