import { useState } from 'react'
import { Mail, MapPin, MessageSquare } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { submitContact } from '@/lib/api'
import { usePageTitle } from '@/hooks/usePageTitle'

export function ContactPage() {
  usePageTitle('Contact')
  const [form, setForm] = useState({ name: '', email: '', subject: '', body: '' })
  const [status, setStatus] = useState<'idle' | 'sending' | 'success' | 'error'>('idle')
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setStatus('sending')
    setError(null)
    try {
      await submitContact(form)
      setStatus('success')
      setForm({ name: '', email: '', subject: '', body: '' })
    } catch {
      setStatus('error')
      setError('Failed to send message. Please try again.')
    }
  }

  return (
    <div>
      <section className="border-b-[3px] border-[#c8a94a] bg-[#1a2744]">
        <div className="mx-auto max-w-6xl px-6 py-10">
          <div className="mb-2 inline-block rounded-full border border-[#c8a94a]/50 bg-[#c8a94a]/15 px-2.5 py-0.5 text-[10px] text-[#f0d07a]">Louisiana Chess Association</div>
          <h1 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">Contact us</h1>
          <p className="mt-2 text-sm text-white/60">Get in touch with the Louisiana Chess Association board.</p>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-10">
        <div className="grid gap-10 lg:grid-cols-2">
          <div>
            <h2 className="mb-6 text-xl font-bold text-[#1a2744]">Send a message</h2>
            {status === 'success' ? (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-6 text-center">
                <p className="font-semibold text-emerald-800">Message sent!</p>
                <p className="mt-1 text-sm text-emerald-700">We'll get back to you as soon as possible. A confirmation has been sent to your email.</p>
                <Button className="mt-4" variant="outline" onClick={() => setStatus('idle')}>Send another message</Button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                {error && <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">{error}</div>}
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
                  <a href="mailto:contact@louisianachess.org" className="text-muted-foreground hover:text-[#c8a94a]">contact@louisianachess.org</a>
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
                  <p className="text-muted-foreground">For site issues, use our <a href="/support" className="text-[#c8a94a] hover:underline">support ticket system</a>.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}