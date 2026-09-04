import { useEffect, useState } from 'react'
import { MessageSquare, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import {
  adminGetTicket,
  adminGetTickets,
  adminUpdateTicket,
  adminReplyToTicket,
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

interface AdminApiSupportTicket extends ApiSupportTicket {
  name: string
  email: string
}

export function AdminSupportPage() {
  const [tab, setTab] = useState<'new' | 'answered'>('new')
  const [tickets, setTickets] = useState<AdminApiSupportTicket[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedTicket, setSelectedTicket] = useState<{
    ticket: AdminApiSupportTicket
    messages: ApiSupportMessage[]
  } | null>(null)
  const [replyBody, setReplyBody] = useState('')
  const [sending, setSending] = useState(false)

  async function loadTickets() {
    setLoading(true)
    try {
      const data = await adminGetTickets()
      setTickets(data.tickets as AdminApiSupportTicket[])
    } catch {
      // Keep whatever is already on screen; a transient failure should not
      // blank the list out from under someone mid-read.
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadTickets()
  }, [])

  async function openTicket(ticket: AdminApiSupportTicket) {
    const data = await adminGetTicket(ticket.id)
    setSelectedTicket({
      ticket: data.ticket as AdminApiSupportTicket,
      messages: data.messages,
    })
    setReplyBody('')
  }

  async function handleReply(e: React.FormEvent) {
    e.preventDefault()
    if (!selectedTicket) return
    setSending(true)
    try {
      await adminReplyToTicket(selectedTicket.ticket.id, replyBody)
      await adminUpdateTicket(selectedTicket.ticket.id, 'answered')
      const data = await adminGetTicket(selectedTicket.ticket.id)
      setSelectedTicket({
        ticket: data.ticket as AdminApiSupportTicket,
        messages: data.messages,
      })
      setReplyBody('')
      await loadTickets()
    } catch {
      // Keep whatever is already on screen; a transient failure should not
      // blank the list out from under someone mid-read.
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
  const displayTickets = tab === 'new' ? newTickets : answeredTickets

  return (
    <div className="mx-auto max-w-6xl px-6 py-12">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-lca-navy">Support Tickets</h1>
          <p className="text-muted-foreground mt-1">
            Manage member support requests
          </p>
        </div>
        <Button variant="outline" onClick={loadTickets}>
          <RefreshCw className="size-4 mr-2" />
          Refresh
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div>
          <div className="flex gap-2 mb-4">
            <button
              onClick={() => setTab('new')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                tab === 'new'
                  ? 'bg-lca-navy text-white'
                  : 'bg-muted text-muted-foreground hover:bg-muted/80'
              }`}
            >
              New
              {newTickets.length > 0 && (
                <span className="ml-2 bg-lca-gold text-lca-navy text-xs px-1.5 py-0.5 rounded-full font-bold">
                  {newTickets.length}
                </span>
              )}
            </button>
            <button
              onClick={() => setTab('answered')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                tab === 'answered'
                  ? 'bg-lca-navy text-white'
                  : 'bg-muted text-muted-foreground hover:bg-muted/80'
              }`}
            >
              Answered
            </button>
          </div>

          {loading && (
            <p className="text-muted-foreground text-sm" role="status">
              Loading tickets…
            </p>
          )}

          {!loading && displayTickets.length === 0 && (
            <div className="rounded-lg border p-6 text-center text-muted-foreground">
              <MessageSquare className="size-8 mx-auto mb-2 opacity-40" />
              <p className="text-sm">No {tab} tickets</p>
            </div>
          )}

          <div className="space-y-2">
            {displayTickets.map(ticket => (
              <button
                key={ticket.id}
                onClick={() => openTicket(ticket)}
                className={`w-full text-left rounded-lg border p-4 transition-colors ${
                  selectedTicket?.ticket.id === ticket.id
                    ? 'border-lca-navy bg-lca-navy/5'
                    : 'hover:bg-muted/50'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-medium text-lca-navy truncate">
                      {ticket.subject}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5 truncate">
                      {ticket.name} · {ticket.email}
                    </p>
                    <p className="text-sm text-muted-foreground mt-1 line-clamp-1">
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
                  {new Date(ticket.updated_at).toLocaleString()} ·{' '}
                  {ticket.message_count} message
                  {ticket.message_count !== 1 ? 's' : ''}
                </p>
              </button>
            ))}
          </div>
        </div>

        <div>
          {!selectedTicket && (
            <div className="rounded-lg border p-8 text-center text-muted-foreground h-full flex flex-col items-center justify-center">
              <MessageSquare className="size-10 mb-3 opacity-30" />
              <p>Select a ticket to view the conversation</p>
            </div>
          )}

          {selectedTicket && (
            <div className="rounded-lg border p-5">
              <div className="flex items-start justify-between gap-3 mb-4 pb-4 border-b">
                <div>
                  <h3 className="font-semibold text-lca-navy">
                    {selectedTicket.ticket.subject}
                  </h3>
                  <p className="text-sm text-muted-foreground mt-0.5">
                    {selectedTicket.ticket.name} · {selectedTicket.ticket.email}
                  </p>
                </div>
                <span
                  className={`text-xs px-2 py-1 rounded-full font-medium shrink-0 ${
                    statusColors[selectedTicket.ticket.status] ?? ''
                  }`}
                >
                  {statusLabels[selectedTicket.ticket.status] ?? selectedTicket.ticket.status}
                </span>
              </div>

              <div className="space-y-3 mb-5 max-h-80 overflow-y-auto">
                {selectedTicket.messages.map(msg => (
                  <div
                    key={msg.id}
                    className={`rounded-lg p-3 ${
                      msg.sender_type === 'admin'
                        ? 'bg-lca-navy/5 border border-lca-navy/10'
                        : 'bg-muted'
                    }`}
                  >
                    <p className="text-xs font-medium text-muted-foreground mb-1">
                      {msg.sender_type === 'admin'
                        ? 'LCA Support'
                        : selectedTicket.ticket.name}{' '}
                      · {new Date(msg.created_at).toLocaleString()}
                    </p>
                    <p className="text-sm whitespace-pre-wrap">{msg.body}</p>
                  </div>
                ))}
              </div>

              <form onSubmit={handleReply} className="space-y-3">
                <Label htmlFor="adminReply">Reply to member</Label>
                <Textarea
                  id="adminReply"
                  rows={4}
                  value={replyBody}
                  onChange={e => setReplyBody(e.target.value)}
                  placeholder="Type your reply… This will be emailed to the member."
                  required
                />
                <Button
                  type="submit"
                  className="w-full bg-lca-navy hover:bg-lca-navy/90"
                  disabled={sending}
                >
                  {sending ? 'Sending…' : 'Send reply & mark answered'}
                </Button>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}