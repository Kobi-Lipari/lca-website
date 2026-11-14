// src/areas/clubs/components/ClubEditor.tsx
//
// The one club editor every keeper uses (an LCA admin, the club's rep and
// the representative for the club's region), drawn on the admin club page's
// Details tab while clubKeepers is on, in place of today's form. This step
// draws the five basics first, as the editor's board draws them
// (Club-Final-Bare-2, frame B), and one Save and publish; the rest of the
// listing joins it in the steps after. An LCA admin also keeps the three
// fields only an admin may change: the club's name, its region and its page
// address.
//
// Save and publish makes one call for one press: saveClubListing, PATCH
// /api/admin/clubs/:id, with the listing's fields and place 1 and any other
// place the club lists, which the server writes in one batch, so a press
// saves all of it or none of it, and the region's representatives get one
// notice. The body also clears today's description, meeting schedule,
// location or pin when the person emptied About, emptied the meeting's
// words, emptied the club's only place or removed the pin, since the save's
// copy into today's fields never clears one; and where place 1 is emptied
// and a second place moves up, today's pin goes with the place it belonged
// to. While the save runs every box is read only and the status says so in
// words, so nothing typed during it can be lost. Once it has saved the whole
// form, place and pin included, is filled again from what the answer says
// was stored, so the next press sends back exactly that. A failure is said in
// words beside the form, keeps everything the person typed, and never shows
// "Saved". A second press while a save is under way does nothing.
//
// A club with no place saved yet starts Where from today's location; where
// that is longer than a place name may be and the person leaves Where as it
// is, the press sends no places at all, so today's location stays as it is
// and the rest of the listing still saves. Before anything is sent the form
// checks each field against the save's own rules (src/areas/clubs/editor.ts)
// and says in words under the field what is wrong, with the focus on the
// first. The page makes no call of its own: it is in src/areas/clubs/api.ts,
// which src/lib/api.ts re-exports.
//
// For an observer, who may read but not save, the fields and Save sit in a
// shut fieldset; Help's button and Close help stay outside it, so Help
// opens and closes for them as for everyone.
import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'

import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { ScrollPanel } from '@/components/ScrollPanel'
import { FEATURES } from '@/lib/features'
import { REGIONS } from '@/lib/regions'
// Through '@/lib/api', as the admin club page reads the clubs calls, so the
// build keeps the sign-in library in the main script, where it was.
import { saveClubListing, type ApiClubListing, type ApiClubPlace } from '@/lib/api'
import { ViewOnlyFieldset } from '@/lib/viewOnly'
import {
  EDITOR_LIMITS, editorProblems, helpShownBefore, placeLine, rememberHelpShown,
  type EditorField as FieldName, type EditorValues,
} from '@/areas/clubs/editor'
import type { LatLng } from '@/areas/clubs/mapLocation'
import { clubPagesOn } from '@/areas/clubs/switches'
import { EditorBasics, EditorField, type Differs } from '@/areas/clubs/components/EditorBasics'
import { EditorHelp, EditorHelpButton } from '@/areas/clubs/components/EditorHelp'
import { EditorPlaces } from '@/areas/clubs/components/EditorPlaces'
import type { UpdateClubRequest } from '@domain/contracts'

/** What the form starts from: the listing's own words, else the words today's page shows. */
function startValues(club: ApiClubListing, places: ApiClubPlace[]): EditorValues {
  const first = places[0]
  return {
    aboutText: club.about_text ?? club.description ?? '',
    howWeMeetText: club.how_we_meet_text ?? club.meeting_schedule ?? '',
    placeName: first ? first.name : (club.location ?? ''),
    placeStreet: first?.street ?? '',
    placeNote: first?.note ?? '',
    contactNamePublic: club.contact_name_public ?? '',
    contactEmail: club.contact_email ?? '',
    name: club.name,
    region: club.region ?? '',
    slug: club.slug ?? '',
  }
}

/** A point from a latitude and a longitude, when both are there. */
function pointOf(row: { latitude?: number | null; longitude?: number | null } | undefined): LatLng | null {
  return row && typeof row.latitude === 'number' && typeof row.longitude === 'number' ? { lat: row.latitude, lng: row.longitude } : null
}

/** Today's words beside the listing's, when a field the save mirrors was changed in the older form since. */
function differsOf(listing: string | null | undefined, today: string | null | undefined): Differs | null {
  if (listing == null || listing === (today ?? '')) return null
  return { today: today ? today : 'Nothing shown', listing }
}

/** A refusal's words, ending as a sentence does. */
function wordsOf(err: unknown): string {
  const text = err instanceof Error && err.message.trim() ? err.message.trim() : 'The server did not answer'
  return /[.!?]$/.test(text) ? text : `${text}.`
}

type Outcome = { saved: true; address: string } | { saved: false; text: string }

/** What the status says while a save runs, when every box waits. */
const SAVING_WORDS = 'Saving. The form is read only until the save is done.'

/** A select of the editor: as tall and as ringed as its boxes. */
const SELECT =
  'min-h-11 w-full rounded-md border border-input bg-background px-3 text-base ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm'

export function ClubEditor({
  club, places, isAdmin, showAdminFields, viewOnly, onSaved,
}: {
  club: ApiClubListing
  places: ApiClubPlace[]
  /** An LCA admin, who sends the name, the region and the page address. */
  isAdmin: boolean
  /** Draws those three fields: for an LCA admin, and for an observer, who sees them as the rest, unchangeable. */
  showAdminFields: boolean
  viewOnly: boolean
  onSaved: (club: ApiClubListing, places: ApiClubPlace[]) => void
}) {
  const [values, setValues] = useState(() => startValues(club, places))
  const [point, setPoint] = useState<LatLng | null>(() => pointOf(places[0]) ?? pointOf(club))
  const [pointTouched, setPointTouched] = useState(false)
  const [errors, setErrors] = useState<Partial<Record<FieldName, string>>>({})
  const [outcome, setOutcome] = useState<Outcome | null>(null)
  const [busy, setBusy] = useState(false)
  const saving = useRef(false)
  // The pin picker keeps its own point once drawn, so it is drawn afresh after each save, from the point the answer gives.
  const [saves, setSaves] = useState(0)

  const [helpOpen, setHelpOpen] = useState(() => !helpShownBefore())
  const helpButton = useRef<HTMLButtonElement>(null)
  const helpPanel = useRef<HTMLElement>(null)
  const focusNext = useRef<'panel' | 'button' | null>(helpOpen ? 'panel' : null)
  useEffect(() => {
    if (helpOpen) rememberHelpShown()
  }, [helpOpen])
  useEffect(() => {
    if (focusNext.current === 'panel' && helpOpen) helpPanel.current?.focus()
    else if (focusNext.current === 'button' && !helpOpen) helpButton.current?.focus()
    focusNext.current = null
  }, [helpOpen])
  function toggleHelp() {
    focusNext.current = helpOpen ? 'button' : 'panel'
    setHelpOpen(!helpOpen)
  }
  function closeHelp() {
    focusNext.current = 'button'
    setHelpOpen(false)
  }

  function change(field: keyof EditorValues, value: string) {
    // The boxes are read only while a save runs; this holds it for any way a change might still arrive.
    if (saving.current) return
    setValues((v) => ({ ...v, [field]: value }))
    setErrors((e) => {
      if (!(field in e)) return e
      const rest = { ...e }
      delete rest[field as FieldName]
      return rest
    })
    setOutcome((o) => (o?.saved ? null : o))
  }

  function changePoint(next: LatLng | null) {
    if (saving.current) return
    setPoint(next)
    setPointTouched(true)
    setOutcome((o) => (o?.saved ? null : o))
  }

  /** Whether any part of place 1 is filled: a word in its boxes, or a pin the person set. */
  const placeFilled = values.placeName.trim() !== '' || values.placeStreet.trim() !== '' || values.placeNote.trim() !== '' || (pointTouched && point !== null)

  /**
   * A club with no place saved yet whose location today is longer than a
   * place name may be, with Where left as it started: that location is kept
   * as it is and no place is sent, rather than every save being refused.
   */
  const keepTodaysWhere = places.length === 0 && (club.location ?? '').length > EDITOR_LIMITS.placeName
    && values.placeName === (club.location ?? '') && values.placeStreet === '' && values.placeNote === '' && !pointTouched

  /** Place 1 as the form holds it, when any part of it is filled, and every other place the club lists, unchanged. */
  function placesToSend(): NonNullable<UpdateClubRequest['places']> {
    const first = placeFilled
      ? [{ name: values.placeName.trim(), street: values.placeStreet.trim() || null, note: values.placeNote.trim() || null, point }]
      : []
    const kept = places.slice(1).map((p) => ({ name: p.name, street: p.street, note: p.note, point: pointOf(p) }))
    return [...first, ...kept]
  }

  async function save(e: FormEvent) {
    e.preventDefault()
    if (saving.current || viewOnly) return
    const found = editorProblems(values, { admin: isAdmin, hadSlug: Boolean(club.slug), hasPoint: pointTouched && point !== null })
      .filter(([field]) => !(keepTodaysWhere && field === 'placeName'))
    if (found.length > 0) {
      setErrors(Object.fromEntries(found))
      setOutcome({ saved: false, text: found.length === 1 ? 'Nothing was saved: one field needs a change.' : `Nothing was saved: ${found.length} fields need a change.` })
      document.getElementById(`editor-${found[0][0]}`)?.focus()
      return
    }
    setErrors({})
    saving.current = true
    setBusy(true)
    setOutcome(null)

    const body: UpdateClubRequest = {
      aboutText: values.aboutText,
      howWeMeetText: values.howWeMeetText,
      contactNamePublic: values.contactNamePublic,
      contactEmail: values.contactEmail.trim() || null,
    }
    // The save copies About and the meeting's words into today's fields only
    // when they hold words, so a box emptied here clears today's field too;
    // otherwise today's page would keep the old words and the next visit
    // would start from them again.
    if (values.aboutText.trim() === '') body.description = null
    if (values.howWeMeetText.trim() === '') body.meetingSchedule = null
    // The save moves today's pin only to a point place 1 has, so a pin
    // removed here is cleared from today's map in the same body.
    if (pointTouched && point === null) body.mapLocation = null
    if (!keepTodaysWhere) {
      const toSend = placesToSend()
      body.places = toSend
      // The save writes today's location only from a place 1, so when no
      // place is left to send, today's location is cleared as well.
      if (toSend.length === 0 && club.location) body.location = null
      // Place 1 emptied with a second place moving up: today's pin belonged
      // to the place that went, so it goes too unless the one moving up has
      // a point of its own, which the save then copies.
      if (!placeFilled && toSend[0] && !toSend[0].point && pointOf(club)) body.mapLocation = null
    }
    if (isAdmin) {
      body.name = values.name
      body.region = values.region || null
      const slug = values.slug.trim()
      if (slug !== '' && slug !== club.slug) body.slug = slug
    }

    try {
      const answer = await saveClubListing(club.id, body)
      const savedPlaces = answer.places ?? places
      onSaved(answer.club, savedPlaces)
      // The form shows what was stored, so the next press sends back exactly
      // that: a second place that moved up into place 1 is shown, with its
      // own pin or none.
      setValues(startValues(answer.club, savedPlaces))
      setPoint(pointOf(savedPlaces[0]) ?? pointOf(answer.club))
      setPointTouched(false)
      setSaves((n) => n + 1)
      const page = clubPagesOn() && answer.club.slug ? answer.club.slug : answer.club.id
      setOutcome({ saved: true, address: `/clubs/${page}` })
    } catch (err) {
      setOutcome({ saved: false, text: `Nothing was saved: ${wordsOf(err)} Everything you typed is still here.` })
    } finally {
      saving.current = false
      setBusy(false)
    }
  }

  const differs = {
    aboutText: differsOf(club.about_text, club.description),
    howWeMeetText: differsOf(club.how_we_meet_text, club.meeting_schedule),
  }
  const placeDiffers = places[0] ? differsOf(placeLine(places[0]), club.location) : null

  return (
    <form onSubmit={save} noValidate className="mx-auto max-w-2xl space-y-4">
      <ScrollPanel
        label="Club listing"
        header={(
          <div className="flex min-h-11 items-center justify-between gap-3 px-4 py-2">
            <h2 className="text-base font-semibold text-ink">The basics</h2>
            <EditorHelpButton ref={helpButton} open={helpOpen} onToggle={toggleHelp} />
          </div>
        )}
      >
        <div className="space-y-6 p-4">
          <EditorHelp
            ref={helpPanel} open={helpOpen} emailHidden={FEATURES.clubEmailHidden} pagesOn={clubPagesOn()} showAdmin={showAdminFields} onClose={closeHelp}
          />
          <ViewOnlyFieldset viewOnly={viewOnly}>
            <div className="space-y-6">
              <EditorBasics
                values={values}
                errors={errors}
                differs={differs}
                waiting={busy}
                onChange={change}
                where={(
                  <EditorPlaces
                    clubName={club.name}
                    values={values}
                    errors={errors}
                    differs={placeDiffers}
                    point={point}
                    pickerKey={saves}
                    disabled={viewOnly || busy}
                    waiting={busy}
                    onChange={change}
                    onPoint={changePoint}
                  />
                )}
              />
              {showAdminFields && (
                <fieldset className="m-0 min-w-0 space-y-4 border-0 border-t border-hairline p-0 pt-6">
                  <legend className="mb-3 text-sm font-medium leading-snug">Kept by LCA admins</legend>
                  <EditorField field="name" label="Club name" value={values.name} error={errors.name} readOnly={busy} onChange={(v) => change('name', v)} />
                  <div className="space-y-1.5">
                    <Label htmlFor="editor-region" className="leading-snug">Region</Label>
                    <select id="editor-region" className={SELECT} value={values.region} disabled={busy} onChange={(e) => change('region', e.target.value)}>
                      <option value="">No region</option>
                      {REGIONS.map((r) => <option key={r} value={r}>{r}</option>)}
                    </select>
                  </div>
                  <EditorField field="slug" label="Page address" value={values.slug} error={errors.slug} readOnly={busy} onChange={(v) => change('slug', v)} />
                </fieldset>
              )}
            </div>
          </ViewOnlyFieldset>
        </div>
      </ScrollPanel>

      <div className="space-y-2">
        <ViewOnlyFieldset viewOnly={viewOnly}>
          <Button
            type="submit"
            className="min-h-11 bg-lca-gold font-semibold text-brand-navy hover:bg-lca-gold/90"
            aria-disabled={busy || undefined}
          >
            {busy ? 'Saving…' : 'Save and publish'}
          </Button>
        </ViewOnlyFieldset>
        <div role="status" className="text-sm text-ink">
          {busy && <p>{SAVING_WORDS}</p>}
          {outcome?.saved && (
            <p>
              Saved · live at{' '}
              <Link to={outcome.address} className="inline-flex min-h-11 items-center break-all font-medium underline underline-offset-2 outline-none focus-visible:ring-3 focus-visible:ring-focus">
                {window.location.host}{outcome.address}
              </Link>
            </p>
          )}
        </div>
        <div role="alert" className="text-sm text-destructive">
          {outcome && !outcome.saved && <p>{outcome.text}</p>}
        </div>
      </div>
    </form>
  )
}
