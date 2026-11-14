// src/areas/clubs/components/EditorBasics.tsx
//
// The five basics of the one club editor, in the order and with the labels
// the editor's board draws them (Club-Final-Bare-2, frame B): one sentence
// about the club, how the club meets in words, where (EditorPlaces.tsx), the
// contact name shown on the page, and the email for messages. Each field is
// a visible label tied to its control, and an error is words under the
// field, tied to it. No explaining sentence sits beside a control: those
// are behind Help (EditorHelp.tsx). While a save runs every box is read
// only (`waiting`), and the form's status says so in words; the two ticks,
// the colour's swatch and, from WS09 step 9, the region's list, which cannot
// be read only, are marked shut instead (aria-disabled, a press stopped),
// never disabled, so they keep the focus.
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
//
// About, the first basic, is also the club's own words at length (Club-G-2's
// "The club in your own words"): one column holds both, so the one box takes
// up to 2,000 characters and shows its count under it; what the count means,
// and that a search result shows the start of About and then how the club
// meets, which fit together only while how the club meets is short, is in
// Help.
//
// After the basics comes the rest of the listing, in the site's order
// (EditorRest): the name and the city with the page's address; the cost and
// who is welcome, with the two ticks; the links; and the logo and the
// colour, with today's controls. What only an LCA admin may change, the
// name, the region and the page's address, is a box only for an LCA admin
// (and, shut, for an observer); anyone else sees it as words that say LCA
// admins keep it, never as a box the save would refuse.
import { useEffect, useRef, useState, type ChangeEvent, type ReactNode } from 'react'
import { Link } from 'react-router-dom'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { FEATURES } from '@/lib/features'
import { REGIONS } from '@/lib/regions'
import { EDITOR_LIMITS, type EditorField as FieldName, type EditorValues } from '@/areas/clubs/editor'
import { clubPagesOn } from '@/areas/clubs/switches'

/** A box of one line: 44px tall at every width, and its border in the error's colour beside the error's words. */
const LINE = 'min-h-11 aria-invalid:border-destructive'

/** A box of several lines, drawn as the site's one-line box is, with the same focus ring. */
const LINES =
  'flex min-h-24 w-full rounded-md border border-input bg-background px-3 py-2 text-base ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive md:text-sm'

/** A number as the page writes it, with a comma in the thousands. */
const counted = (n: number) => n.toLocaleString('en-US')

/** Today's words for a field, beside the listing's own, when the two differ. */
export interface Differs {
  today: string
  listing: string
}

/** One field of the editor: its label, its box, the line about today's page when the words differ, and its error. */
export function EditorField({
  field, label, value, error, multiline, type, autoComplete, differs, readOnly, after, onChange,
}: {
  field: FieldName
  label: ReactNode
  value: string
  error?: string
  multiline?: boolean
  type?: 'text' | 'email' | 'url'
  autoComplete?: string
  differs?: Differs | null
  /** Read only while a save runs, so nothing typed then is lost. */
  readOnly?: boolean
  /** A line drawn right under the box, such as About's count. */
  after?: ReactNode
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
      {after}
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
          after={<p className="text-sm tabular-nums text-ink">{`${counted(values.aboutText.length)} of ${counted(EDITOR_LIMITS.aboutText)} characters`}</p>}
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

/** A select of the editor: as tall and as ringed as its boxes, and shut by its aria-disabled mark as by disabled. */
const SELECT =
  'min-h-11 w-full rounded-md border border-input bg-background px-3 text-base ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 aria-disabled:cursor-not-allowed aria-disabled:opacity-50 md:text-sm'

/** A tick: the box with its words in one row 44px tall, the whole row its target. */
const TICK_ROW = 'flex min-h-11 cursor-pointer items-center gap-3 text-sm text-ink'
const TICK = 'size-5 shrink-0 rounded outline-none focus-visible:ring-3 focus-visible:ring-focus disabled:cursor-not-allowed disabled:opacity-50 aria-disabled:cursor-not-allowed aria-disabled:opacity-50'

/** A part of the rest of the listing, under a line, with its name. */
const PART = 'm-0 min-w-0 space-y-4 border-0 border-t border-hairline p-0 pt-6'
const PART_NAME = 'mb-3 text-sm font-medium leading-snug'

/**
 * The logo's file box: 44px tall, its button drawn as the editor's others, a
 * visible ring on focus. It looks shut by its aria-disabled mark as well as
 * by disabled, since a save or an upload marks it shut without disabling it.
 */
const FILE =
  'block min-h-11 w-full rounded-md text-sm text-ink file:mr-3 file:min-h-11 file:cursor-pointer file:rounded-md file:border file:border-input file:bg-background file:px-3 file:text-sm file:font-medium file:text-ink focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-focus disabled:cursor-not-allowed disabled:opacity-50 aria-disabled:cursor-not-allowed aria-disabled:opacity-50'

/**
 * The colour's swatch: 44px tall, a visible ring on focus, and shut by its
 * aria-disabled mark as by disabled, as the logo's box is. While a save runs
 * it is marked shut rather than disabled, as the ticks are, so it keeps the
 * focus: a click, and so Enter or Space, opens no picker then, and a colour
 * that still reaches it is not taken.
 */
const SWATCH =
  'min-h-11 w-20 cursor-pointer rounded-md border border-input bg-background p-1 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-focus disabled:cursor-not-allowed disabled:opacity-50 aria-disabled:cursor-not-allowed aria-disabled:opacity-50'

/** What a person who is not an LCA admin sees in place of a box only an LCA admin may change. */
function KeptWords({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="space-y-0.5 text-sm text-ink">
      <dt className="font-medium">{label}</dt>
      <dd className="break-words">{value}</dd>
      <dd>Kept by LCA admins</dd>
    </div>
  )
}

export function EditorRest({
  values, errors, waiting, showAdminFields, address, logo, logoShut, onChange, onLogo,
}: {
  values: EditorValues
  errors: Partial<Record<FieldName, string>>
  /** A save is under way: every box is read only until it ends. */
  waiting: boolean
  /** Draws the club's name, its region and its page address as boxes: for an LCA admin, and for an observer, shut. */
  showAdminFields: boolean
  /** The page's address on this site, the part from /clubs/ on. */
  address: string
  /** The club's logo, drawn only from its own stored path on this site, or null. */
  logo: string | null
  /** The logo's box is shut while a save or an upload runs: marked so, never disabled, so it keeps the focus. */
  logoShut: boolean
  onChange: <K extends keyof EditorValues>(field: K, value: EditorValues[K]) => void
  /** A logo chosen: uploaded at once, as today's page does. */
  onLogo: (file: File) => void
}) {
  // The third link is drawn once it holds one, or once the person asks for it.
  const [moreLink, setMoreLink] = useState(values.otherUrl !== '')
  const opened = useRef(false)
  // The mark is cleared only once acted on, so a late first run cannot wipe a press.
  useEffect(() => {
    if (opened.current && moreLink) {
      document.getElementById('editor-otherUrl')?.focus()
      opened.current = false
    }
  }, [moreLink])
  const showOther = moreLink || values.otherUrl !== ''

  // A tick cannot be read only, so while a save runs it is marked shut, as the
  // logo's box is, rather than disabled: a press held for a logo's upload can
  // start the save while a tick holds the focus, and a disabled tick would
  // drop that focus to the page. A click then is cancelled, which also stops
  // Space, since Space reaches a tick as a click, so the browser puts the tick
  // back as it was. It is cancelled on its way in and goes no further, so
  // React never treats it as a change and never sets the tick again on top of
  // the browser's own undoing; the editor takes no change while a save runs
  // in any case. Enter on a tick does not send the form, as on the pin's box.
  // In an observer's shut fieldset a tick is disabled as before.
  const tick = (field: 'weekendPlay' | 'scholasticFriendly', label: string) => (
    <label htmlFor={`editor-${field}`} className={TICK_ROW}>
      <input
        id={`editor-${field}`} type="checkbox" className={TICK} checked={values[field]} aria-disabled={waiting || undefined}
        onKeyDown={(e) => { if (e.key === 'Enter') e.preventDefault() }}
        onClickCapture={(e) => {
          if (!waiting) return
          e.preventDefault()
          e.stopPropagation()
        }}
        onChange={(e) => onChange(field, e.target.checked)}
      />
      {label}
    </label>
  )

  return (
    <div className="space-y-6">
      <fieldset className={PART}>
        <legend className={PART_NAME}>Name and address</legend>
        {showAdminFields ? (
          <EditorField field="name" label="Club name" value={values.name} error={errors.name} readOnly={waiting} onChange={(v) => onChange('name', v)} />
        ) : (
          <dl><KeptWords label="Club name" value={values.name} /></dl>
        )}
        <EditorField field="city" label="City" autoComplete="address-level2" value={values.city} error={errors.city} readOnly={waiting} onChange={(v) => onChange('city', v)} />
        {showAdminFields ? (
          <div className="space-y-1.5">
            <Label htmlFor="editor-region" className="leading-snug">Region</Label>
            {/*
              Marked shut rather than disabled while a save runs, as the ticks
              are: a press held for a logo's upload can start the save while
              the list holds the focus, and a disabled list would drop it to
              the page. A list opens on the mouse's press and changes its
              choice by key without opening, so while a save runs the press
              and every key but Tab are cancelled, and a choice that still
              arrives is not taken; the editor puts the list back to the
              region it holds. It has no state of its own to undo, so it needs
              no stop on the way in, as a tick does. In an observer's shut
              fieldset it is disabled as before.
            */}
            <select
              id="editor-region" className={SELECT} value={values.region} aria-disabled={waiting || undefined}
              onMouseDown={(e) => { if (waiting) e.preventDefault() }}
              onKeyDown={(e) => { if (waiting && e.key !== 'Tab') e.preventDefault() }}
              onChange={(e) => { if (!waiting) onChange('region', e.target.value) }}
            >
              <option value="">No region</option>
              {REGIONS.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
        ) : (
          <dl><KeptWords label="Region" value={values.region || 'No region'} /></dl>
        )}
        <div className="space-y-1 rounded-md border border-hairline px-3 py-2 text-sm text-ink">
          <p className="font-medium">Your page's address</p>
          <Link to={address} className="inline-flex min-h-11 items-center break-all font-medium underline underline-offset-2 outline-none focus-visible:ring-3 focus-visible:ring-focus">
            {window.location.host}{address}
          </Link>
          {!showAdminFields && <p>Kept by LCA admins</p>}
        </div>
        {showAdminFields && (
          <EditorField field="slug" label="Page address" value={values.slug} error={errors.slug} readOnly={waiting} onChange={(v) => onChange('slug', v)} />
        )}
      </fieldset>

      <fieldset className={PART}>
        <legend className={PART_NAME}>Cost and who is welcome</legend>
        <EditorField field="costText" label="Cost" value={values.costText} error={errors.costText} readOnly={waiting} onChange={(v) => onChange('costText', v)} />
        <EditorField
          field="welcomeText" label="Who is welcome" multiline
          value={values.welcomeText} error={errors.welcomeText} readOnly={waiting} onChange={(v) => onChange('welcomeText', v)}
        />
        <div className="space-y-1">
          {tick('weekendPlay', 'The club plays on weekends')}
          {tick('scholasticFriendly', 'Scholastic friendly')}
        </div>
      </fieldset>

      <fieldset className={PART}>
        <legend className={PART_NAME}>Links</legend>
        <EditorField
          field="facebookUrl" label="Facebook page" type="url" autoComplete="url"
          value={values.facebookUrl} error={errors.facebookUrl} readOnly={waiting} onChange={(v) => onChange('facebookUrl', v)}
        />
        <EditorField
          field="websiteUrl" label="Website" type="url" autoComplete="url"
          value={values.websiteUrl} error={errors.websiteUrl} readOnly={waiting} onChange={(v) => onChange('websiteUrl', v)}
        />
        {showOther ? (
          <EditorField
            field="otherUrl" label="Another link" type="url" autoComplete="url"
            value={values.otherUrl} error={errors.otherUrl} readOnly={waiting} onChange={(v) => onChange('otherUrl', v)}
          />
        ) : (
          <Button type="button" variant="outline" className="min-h-11" onClick={() => { opened.current = true; setMoreLink(true) }}>
            Add another link
          </Button>
        )}
      </fieldset>

      <fieldset className={PART}>
        <legend className={PART_NAME}>Logo and club colour</legend>
        <div className="space-y-1.5">
          <Label htmlFor="editor-logo" className="leading-snug">Logo</Label>
          {logo
            ? <img src={logo} alt="Your club's logo" className="h-24 w-auto max-w-full rounded-md border border-hairline bg-card object-contain p-2" />
            : <p className="text-sm text-ink">No logo yet</p>}
          {/*
            Marked shut rather than disabled while a save or an upload runs: the
            box holds the focus when a file is chosen from it, and a disabled box
            would drop that focus to the page. A press then opens no picker, and
            the editor takes no file while either runs.
          */}
          <input
            id="editor-logo" type="file" accept="image/*" className={FILE} aria-disabled={logoShut || undefined}
            onClick={(e) => { if (logoShut) e.preventDefault() }}
            onChange={(e: ChangeEvent<HTMLInputElement>) => {
              const file = e.target.files?.[0]
              // Lets the same file be chosen again later.
              e.target.value = ''
              if (file) onLogo(file)
            }}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="editor-color" className="leading-snug">Club colour</Label>
          <input
            id="editor-color" type="color" className={SWATCH} value={values.color} aria-disabled={waiting || undefined}
            onClick={(e) => { if (waiting) e.preventDefault() }}
            onChange={(e) => onChange('color', e.target.value)}
          />
        </div>
      </fieldset>
    </div>
  )
}
