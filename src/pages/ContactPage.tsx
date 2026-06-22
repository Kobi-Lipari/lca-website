import { useState } from 'react'
import { Mail, MapPin, Phone } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { submitContact } from '@/lib/api'

export function ContactPage() {
  const [form, setForm] = useState({
    name: '', email: '', subject: '', body: '',
  })
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
    <div className="mx-auto max-w-6xl px-6 py-12">
      <h1 className="text-3xl font-bold text-[#1a2744] mb-2">Contact Us</h1>
      <p className="text-muted-foreground mb-10">
        Get in touch with the Louisiana Chess Association.
      </p>

      <div className="grid gap-10 md:grid-cols-2">
        <div>
          <h2 className="text-xl font-semibold text-[#1a2744] mb-6">
            Send a message
          </h2>

          {status === 'success' ? (
            <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-6 text-center">
              <p className="text-emerald-800 font-medium text-lg">
                Message sent!
              </p>
              <p className="text-emerald-700 text-sm mt-1">
                We'll get back to you as soon as possible.
                A confirmation has been sent to your email.
              </p>
              <Button
                className="mt-4"
                variant="outline"
                onClick={() => setStatus('idle')}
              >
                Send another message
              </Button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="rounded-md bg-destructive/10 px-4 py-3 text-sm text-destructive">
                  {error}
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
                <Label htmlFor="body">Message</Label>
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
                className="w-full bg-[#1a2744] hover:bg-[#1a2744]/90"
                disabled={status === 'sending'}
              >
                {status === 'sending' ? 'Sending…' : 'Send message'}
              </Button>
            </form>
          )}
        </div>
        <div className="space-y-6">
            <h2 className="text-xl font-semibold text-[#1a2744]">
              Contact information
            </h2>
            <div className="space-y-4 text-sm text-muted-foreground">
              <div className="flex items-start gap-3">
                <Mail className="size-5 text-[#c8a94a] shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-foreground">Email</p>
                  <a href="mailto:contact@louisianachess.org" className="hover:text-[#1a2744]">contact@louisianachess.org</a>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <MapPin className="size-5 text-[#c8a94a] shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-foreground">State</p>
                  <p>Louisiana, United States</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Phone className="size-5 text-[#c8a94a] shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-foreground">Support</p>
                  <p>For technical support, use our <a href="/support" className="text-[#1a2744] hover:underline">support ticket system</a></p>
                </div>
              </div>
            </div>
          
        </div>
      </div>
    </div>
  )
}