// src/areas/clubs/components/EditorBasics.tsx
//
// The five basics of the one club editor, in the order and with the labels
// the editor's board draws them (Club-Final-Bare-2, frame B): one sentence
// about the club, how the club meets in words, where (EditorPlaces.tsx), the
// contact name shown on the page, and the email for messages. Each field is
// a visible label tied to its control, and an error is words under the
// field, tied to it. No explaining sentence sits beside a control: those
// are behind Help (EditorHelp.tsx). While a save runs every box is read
// only (`waiting`), and the form's status says so in words.
//
// The email's label follows clubEmailHidden. With it on, the only state
// clubKeepers may be on in (test/unit/club-pages-switch.test.ts), it says
// the address is never shown; were it ever off, it says today's club page
// shows it, since that page prints the address until the switch is on.
//
// The contact name's label follows the new club pages the same way: today's
// club page never shows that name, so the board's "Contact name shown on the
// page" is drawn only once those pages are on (clubPagesOn), and until then
// the label says the name shows once they open.
import type { ReactNode } from 'react'

import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { FEATURES } from '@/lib/features'
import type { EditorField as FieldName, EditorValues } from '@/areas/clubs/editor'
import { clubPagesOn } from '@/areas/clubs/switches'

/** A box of one line: 44px tall at every width, and its border in the error's colour beside the error's words. */
const LINE = 'min-h-11 aria-invalid:border-destructive'

/** A box of several lines, drawn as the site's one-line box is, with the same focus ring. */
const LINES =
  'flex min-h-24 w-full rounded-md border border-input bg-background px-3 py-2 text-base ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive md:text-sm'

/** Today's words for a field, beside the listing's own, when the two differ. */
export interface Differs {
  today: string
  listing: string
}

/** One field of the editor: its label, its box, the line about today's page when the words differ, and its error. */
export function EditorField({
  field, label, value, error, multiline, type, autoComplete, differs, readOnly, onChange,
}: {
  field: FieldName
  label: ReactNode
  value: string
  error?: string
  multiline?: boolean
  type?: 'text' | 'email'
  autoComplete?: string
  differs?: Differs | null
  /** Read only while a save runs, so nothing typed then is lost. */
  readOnly?: boolean
  onChange: (value: string) => void
}) {
  const id = `editor-${field}`
  const errorId = `${id}-error`
  const differsId = `${id}-differs`
  const described = [differs ? differsId : null, error ? errorId : null].filter(Boolean).join(' ') || undefined
  const shared = {
    id,
    value,
    'aria-invalid': error ? true : undefined,
    'aria-describedby': described,
    autoComplete: autoComplete ?? 'off',
    readOnly: readOnly || undefined,
  }
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="leading-snug">{label}</Label>
      {multiline ? (
        <textarea {...shared} className={LINES} onChange={(e) => onChange(e.target.value)} />
      ) : (
        <Input {...shared} type={type ?? 'text'} className={LINE} onChange={(e) => onChange(e.target.value)} />
      )}
      {differs && (
        <div id={differsId} className="rounded-md border border-hairline px-3 py-2 text-sm text-ink">
          <p className="font-medium">Today's page shows different words here</p>
          <dl className="mt-1 space-y-1">
            <div>
              <dt className="font-medium">Today's page</dt>
              <dd className="break-words">{differs.today}</dd>
            </div>
            <div>
              <dt className="font-medium">This listing</dt>
              <dd className="break-words">{differs.listing}</dd>
            </div>
          </dl>
        </div>
      )}
      {error && <p id={errorId} className="text-sm text-destructive">{error}</p>}
    </div>
  )
}

export function EditorBasics({
  values, errors, differs, waiting, where, onChange,
}: {
  values: EditorValues
  errors: Partial<Record<FieldName, string>>
  differs: { aboutText: Differs | null; howWeMeetText: Differs | null }
  /** A save is under way: every box is read only until it ends. */
  waiting: boolean
  /** The third basic, the club's place, drawn by EditorPlaces. */
  where: ReactNode
  onChange: (field: keyof EditorValues, value: string) => void
}) {
  const emailHidden = FEATURES.clubEmailHidden
  const pagesOn = clubPagesOn()
  return (
    <ol className="list-decimal space-y-6 pl-6 marker:font-semibold marker:text-muted-foreground">
      <li>
        <EditorField
          field="aboutText" label="One sentence about the club" multiline
          value={values.aboutText} error={errors.aboutText} differs={differs.aboutText} readOnly={waiting}
          onChange={(v) => onChange('aboutText', v)}
        />
      </li>
      <li>
        <EditorField
          field="howWeMeetText" label="How the club meets, in words" multiline
          value={values.howWeMeetText} error={errors.howWeMeetText} differs={differs.howWeMeetText} readOnly={waiting}
          onChange={(v) => onChange('howWeMeetText', v)}
        />
      </li>
      <li>{where}</li>
      <li>
        <EditorField
          field="contactNamePublic"
          label={pagesOn ? 'Contact name shown on the page' : 'Contact name, shown once the new club pages open'}
          value={values.contactNamePublic} error={errors.contactNamePublic} readOnly={waiting}
          onChange={(v) => onChange('contactNamePublic', v)}
        />
      </li>
      <li>
        <EditorField
          field="contactEmail" type="email" autoComplete="email"
          label={emailHidden ? 'Email for messages, never shown' : 'Email for messages, shown on your club\'s page today'}
          value={values.contactEmail} error={errors.contactEmail} readOnly={waiting}
          onChange={(v) => onChange('contactEmail', v)}
        />
      </li>
    </ol>
  )
}
