import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { Mail, MapPin, MessageSquare, Phone } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import { usePageTitle } from '@/hooks/usePageTitle'

const goldButtonClass =
  'bg-[#c8a94a] font-semibold text-[#1a2744] hover:bg-[#c8a94a]/90'

const formspreeId = import.meta.env.VITE_FORMSPREE_FORM_ID

export function ContactPage() {
  usePageTitle('Contact')
  const [submitted, setSubmitted] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSubmitting(true)
    setError(null)

    try {
      const response = await fetch(`https://formspree.io/f/${formspreeId}`, {
        method: 'POST',
        body: new FormData(event.currentTarget),
        headers: { Accept: 'application/json' },
      })

      if (!response.ok) {
        throw new Error('Failed to send message')
      }

      setSubmitted(true)
      event.currentTarget.reset()
    } catch {
      setError('Could not send your message. Please try again or email us directly.')
    } finally {
      setSubmitting(false)
    }
  }

  if (!formspreeId) {
    return (
      <div className="mx-auto max-w-6xl px-6 py-12">
        <p className="text-destructive">
          Contact form is not configured. Create a form at{' '}
          <a
            href="https://formspree.io"
            className="underline"
            target="_blank"
            rel="noopener noreferrer"
          >
            formspree.io
          </a>{' '}
          and set <code className="text-sm">VITE_FORMSPREE_FORM_ID</code> in
          your environment variables.
        </p>
      </div>
    )
  }

  return (
    <div>
      <section className="border-b-4 border-[#c8a94a] bg-[#1a2744] text-white">
        <div className="mx-auto max-w-6xl px-6 py-12">
          <div className="flex items-center gap-3">
            <MessageSquare className="size-8 text-[#c8a94a] sm:size-10" />
            <div>
              <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
                Contact Us
              </h1>
              <p className="mt-2 max-w-2xl text-white/80">
                Questions about membership, tournaments, or club affiliation?
                Reach out to the Louisiana Chess Association board.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-12">
        <div className="grid gap-8 lg:grid-cols-2">
          <div>
            <h2 className="text-2xl font-bold text-[#1a2744]">Get in Touch</h2>
            <p className="mt-2 text-muted-foreground">
              We typically respond within 2–3 business days. For urgent
              tournament questions during an active event, contact the tournament
              director listed on the event page.
            </p>

            <ul className="mt-8 space-y-6">
              <li className="flex items-start gap-3">
                <Mail className="mt-0.5 size-5 shrink-0 text-[#c8a94a]" />
                <div>
                  <p className="font-medium text-[#1a2744]">Email</p>
                  <a
                    href="mailto:info@louisianachess.org"
                    className="text-sm text-muted-foreground hover:text-[#c8a94a]"
                  >
                    info@louisianachess.org
                  </a>
                </div>
              </li>
              <li className="flex items-start gap-3">
                <Phone className="mt-0.5 size-5 shrink-0 text-[#c8a94a]" />
                <div>
                  <p className="font-medium text-[#1a2744]">Phone</p>
                  <p className="text-sm text-muted-foreground">(504) 555-0142</p>
                </div>
              </li>
              <li className="flex items-start gap-3">
                <MapPin className="mt-0.5 size-5 shrink-0 text-[#c8a94a]" />
                <div>
                  <p className="font-medium text-[#1a2744]">Mailing Address</p>
                  <p className="text-sm text-muted-foreground">
                    Louisiana Chess Association
                    <br />
                    P.O. Box 1234
                    <br />
                    Baton Rouge, LA 70801
                  </p>
                </div>
              </li>
            </ul>

            <p className="mt-8 text-sm text-muted-foreground">
              Learn more about the organization on our{' '}
              <Link to="/about" className="font-medium text-[#c8a94a] hover:underline">
                About page
              </Link>
              .
            </p>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-xl text-[#1a2744]">
                Send a Message
              </CardTitle>
              <CardDescription>
                Fill out the form below and we&apos;ll get back to you. No
                account required.
              </CardDescription>
            </CardHeader>

            {submitted ? (
              <CardContent>
                <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
                  Thank you! Your message has been sent. We&apos;ll respond within
                  2–3 business days.
                </p>
              </CardContent>
            ) : (
              <form onSubmit={handleSubmit}>
                <CardContent className="space-y-4">
                  {error && (
                    <p className="text-sm text-destructive">{error}</p>
                  )}
                  <div className="space-y-2">
                    <Label htmlFor="name">Name</Label>
                    <Input
                      id="name"
                      name="name"
                      type="text"
                      placeholder="Your name"
                      autoComplete="name"
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      name="email"
                      type="email"
                      placeholder="you@example.com"
                      autoComplete="email"
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="subject">Subject</Label>
                    <Input
                      id="subject"
                      name="subject"
                      type="text"
                      placeholder="Membership, tournaments, clubs..."
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="message">Message</Label>
                    <textarea
                      id="message"
                      name="message"
                      rows={5}
                      placeholder="How can we help?"
                      required
                      className={cn(
                        'flex w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-2 text-base shadow-xs transition-colors outline-none placeholder:text-muted-foreground md:text-sm dark:bg-input/30',
                        'focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50',
                      )}
                    />
                  </div>
                </CardContent>

                <CardFooter>
                  <Button
                    type="submit"
                    className={cn('w-full', goldButtonClass)}
                    disabled={submitting}
                  >
                    {submitting ? 'Sending…' : 'Send Message'}
                  </Button>
                </CardFooter>
              </form>
            )}
          </Card>
        </div>
      </section>
    </div>
  )
}

