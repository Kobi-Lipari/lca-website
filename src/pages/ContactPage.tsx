// src/pages/ContactPage.tsx

import { useEffect, useState } from 'react'
import { Mail, MapPin, MessageSquare } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { getBoardSeats, submitContact, type ApiBoardSeat } from '@/lib/api'
import { usePageTitle } from '@/hooks/usePageTitle'

const LCA_EMAIL = 'LouisianaChess@gmail.com'

/** Read ?to= without coupling this page to a router version. */
function initialSeatRef(): string {
  if (typeof window === 'undefined') return ''
  return new URLSearchParams(window.location.search).get('to') ?? ''
}

export function ContactPage() {
  usePageTitle('Contact')
  const [form, setForm] = useState({
    name: '',
    email: '',
    subject: '',
    body: '',
    seatRef: initialSeatRef(),
  })
  const [seats, setSeats] = useState<ApiBoardSeat[]>([])
  const [status, setStatus] = useState<'idle' | 'sending' | 'success' | 'error'>('idle')
  const [error, setError] = useState<string | null>(null)
  const [ticketId, setTicketId] = useState<string | null>(null)

  useEffect(() => {
    // A failed seat load isn't fatal — the form still sends as a general
    // inquiry, which is what an unrecognised ?to= does on the server anyway.
    getBoardSeats()
      .then(setSeats)
      .catch(() => setSeats([]))
  }, [])

  const selectedSeat = seats.find((s) => s.slug === form.seatRef)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setStatus('sending')
    setError(null)
    try {
      const result = await submitContact(form)
      setTicketId(result.ticketId)
      setStatus('success')
      setForm({ name: '', email: '', subject: '', body: '', seatRef: '' })
    } catch {
      setStatus('error')
      setError('That message didn\u2019t send. Check your connection and try again.')
    }
  }

  return (
    <div>
      <section className="border-b-[3px] border-[#c8a94a] bg-[#1a2744]">
        <div className="mx-auto max-w-6xl px-6 py-10">
          <div className="mb-2 inline-block rounded-full border border-[#c8a94a]/50 bg-[#c8a94a]/15 px-2.5 py-0.5 text-[10px] text-[#f0d07a]">Louisiana Chess Association</div>
          <h1 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">Contact us</h1>
          <p className="mt-2 text-sm text-white/60">
            {selectedSeat
              ? `Your message will go to the ${selectedSeat.role}.`
              : 'Reach the board, or ask a general question.'}
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-10">
        <div className="grid gap-10 lg:grid-cols-2">
          <div>
            <h2 className="mb-6 text-xl font-bold text-[#1a2744]">Send a message</h2>
            {status === 'success' ? (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-6 text-center">
                <p className="font-semibold text-emerald-800">Message sent</p>
                <p className="mt-1 text-sm text-emerald-700">
                  We opened ticket <span className="font-mono">{ticketId}</span> and emailed you a copy. You can follow it in the{' '}
                  <a href="/support" className="underline">support area</a>.
                </p>
                <Button className="mt-4" variant="outline" onClick={() => setStatus('idle')}>Send another message</Button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                {error && <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">{error}</div>}

                <div className="space-y-1.5">
                  <Label htmlFor="seatRef">Send to</Label>
                  <select
                    id="seatRef"
                    value={form.seatRef}
                    onChange={(e) => setForm((f) => ({ ...f, seatRef: e.target.value }))}
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  >
                    <option value="">General inquiry</option>
                    {seats.map((seat) => (
                      <option key={seat.id} value={seat.slug}>
                        {seat.role}
                        {seat.holder_count > 0 ? ` — ${seat.holder_name}` : ' (seat open)'} 
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-muted-foreground">
                    Board messages reach the person holding that role, and stay on file for whoever holds it next.
                  </p>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5"><Label htmlFor="name">Name</Label><Input id="name" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} required /></div>
                  <div className="space-y-1.5"><Label htmlFor="email">Email</Label><Input id="email" type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} required /></div>
                </div>
                <div className="space-y-1.5"><Label htmlFor="subject">Subject</Label><Input id="subject" value={form.subject} onChange={(e) => setForm((f) => ({ ...f, subject: e.target.value }))} required /></div>
                <div className="space-y-1.5"><Label htmlFor="body">Message</Label><Textarea id="body" rows={6} value={form.body} onChange={(e) => setForm((f) => ({ ...f, body: e.target.value }))} required /></div>
                <Button type="submit" className="w-full bg-[#c8a94a] font-semibold text-[#1a2744] hover:bg-[#c8a94a]/90" disabled={status === 'sending'}>
                  {status === 'sending' ? 'Sending…' : 'Send message'}
                </Button>
              </form>
            )}
          </div>

          <div className="space-y-6">
            <h2 className="text-xl font-bold text-[#1a2744]">Contact information</h2>
            <div className="space-y-5 text-sm">
              <div className="flex items-start gap-3">
                <Mail className="mt-0.5 size-5 flex-shrink-0 text-[#c8a94a]" />
                <div>
                  <p className="font-medium text-foreground">Email</p>
                  <a href={`mailto:${LCA_EMAIL}`} className="text-muted-foreground hover:underline">{LCA_EMAIL}</a>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <MapPin className="mt-0.5 size-5 flex-shrink-0 text-[#c8a94a]" />
                <div>
                  <p className="font-medium text-foreground">State</p>
                  <p className="text-muted-foreground">Louisiana, United States</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <MessageSquare className="mt-0.5 size-5 flex-shrink-0 text-[#c8a94a]" />
                <div>
                  <p className="font-medium text-foreground">Technical support</p>
                  <p className="text-muted-foreground">Site problems go to the same place — use the form above, or the <a href="/support" className="text-[#1a2744] hover:underline">support ticket system</a>.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}