// src/areas/clubs/components/ClubEditor.tsx
//
// The one club editor every keeper uses (an LCA admin, the club's rep and
// the representative for the club's region), drawn on the admin club page's
// Details tab while clubKeepers is on, in place of today's form. It draws
// the five basics first, as the editor's board draws them
// (Club-Final-Bare-2, frame B), then the rest of the listing in the site's
// order, as Club-G-2's frame B draws it (EditorRest in EditorBasics.tsx): the
// name and the city with the page's address, the cost and who is welcome
// with the two ticks, the links, and the logo and the colour; a second place
// joins the first under Where. The cover and the photos come in a later
// step. One Save and publish ends the form. An LCA admin also keeps the three
// fields only an admin may change: the club's name, its region and its page
// address; anyone else sees them as words.
//
// Beside the form stands the preview column, which updates as the person
// types: how the page shows up in a search and when it is shared, its card
// in LCA's club directory, and the page's checklist. It is sticky beside the
// form at wide widths, and on a phone it folds under one Preview button
// after the form, which says whether it is open.
//
// Save and publish makes one call for one press: saveClubListing, PATCH
// /api/admin/clubs/:id, with the listing's fields and both places as the
// form holds them, which the server writes in one batch, so a press
// saves all of it or none of it, and the region's representatives get one
// notice. The body also clears today's description, meeting schedule,
// location or pin when the person emptied About, emptied the meeting's
// words, emptied the club's only place or removed the pin, since the save's
// copy into today's fields never clears one; and where place 1 is emptied
// and a second place moves up, today's pin goes with the place it belonged
// to. While the save runs every box is read only, the pins' boxes too, and
// the controls that cannot be read only (the region's list, the ticks, the
// swatch, the logo, the pins' buttons, Remove place 2 and Add another place)
// are marked shut without being disabled, so none of them drops the focus;
// and the status says so in words, so nothing typed during it can be lost. Once it has saved the whole
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
// The fields the rest of the listing adds (the city, the cost, who is
// welcome, the two ticks, the three links and the colour) are sent only when
// they differ from what was stored, so a press that changes none of them
// sends the body it sent before, and a value stored before its limit was
// kept is never sent back to be refused. The logo is today's control over
// today's endpoint: a chosen image is made to fit 320 pixels and uploaded at
// once, as today's page does, and Save and publish waits while it uploads,
// so the save never writes the old logo back over the new one. A press then
// is a real press, held and made once the upload ends, so the button does not
// call itself unavailable while it waits; it does so only while a save runs.
//
// For an observer, who may read but not save, the fields and Save sit in a
// shut fieldset; Help's button and Close help stay outside it, so Help
// opens and closes for them as for everyone.
import { useEffect, useEffectEvent, useRef, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'

import { ChevronDown } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { ScrollPanel } from '@/components/ScrollPanel'
import { FEATURES } from '@/lib/features'
import { LCA } from '@/lib/brand'
// Through '@/lib/api', as the admin club page reads the clubs calls, so the
// build keeps the sign-in library in the main script, where it was.
import { adminUploadClubLogo, saveClubListing, type ApiClubListing, type ApiClubPlace } from '@/lib/api'
import { resizeImageToFit } from '@/lib/resizeImage'
import { cn } from '@/lib/utils'
import { ViewOnlyFieldset } from '@/lib/viewOnly'
import {
  EDITOR_LIMITS, LINK_FIELDS, editorProblems, helpShownBefore, placeLine, rememberHelpShown,
  type EditorField as FieldName, type EditorValues,
} from '@/areas/clubs/editor'
import type { LatLng } from '@/areas/clubs/mapLocation'
import { ownColour, ownLogo, pageChecklist } from '@/areas/clubs/previews'
import { clubPagesOn } from '@/areas/clubs/switches'
import { CardPreview } from '@/areas/clubs/components/CardPreview'
import { EditorBasics, EditorRest, type Differs } from '@/areas/clubs/components/EditorBasics'
import { EditorHelp, EditorHelpButton } from '@/areas/clubs/components/EditorHelp'
import { EditorPlaces } from '@/areas/clubs/components/EditorPlaces'
import { PageChecklist } from '@/areas/clubs/components/PageChecklist'
import { SearchPreview } from '@/areas/clubs/components/SearchPreview'
import { SharePreview } from '@/areas/clubs/components/SharePreview'
import type { UpdateClubRequest } from '@domain/contracts'

/** What the form starts from: the listing's own words, else the words today's page shows. */
function startValues(club: ApiClubListing, places: ApiClubPlace[]): EditorValues {
  const [first, second] = places
  return {
    aboutText: club.about_text ?? club.description ?? '',
    howWeMeetText: club.how_we_meet_text ?? club.meeting_schedule ?? '',
    placeName: first ? first.name : (club.location ?? ''),
    placeStreet: first?.street ?? '',
    placeNote: first?.note ?? '',
    place2Name: second?.name ?? '',
    place2Street: second?.street ?? '',
    place2Note: second?.note ?? '',
    contactNamePublic: club.contact_name_public ?? '',
    contactEmail: club.contact_email ?? '',
    name: club.name,
    region: club.region ?? '',
    slug: club.slug ?? '',
    city: club.city ?? '',
    costText: club.cost_text ?? '',
    welcomeText: club.welcome_text ?? '',
    weekendPlay: club.weekend_play === 1,
    scholasticFriendly: club.scholastic_friendly === 1,
    facebookUrl: club.facebook_url ?? '',
    websiteUrl: club.website_url ?? '',
    otherUrl: club.other_url ?? '',
    // The swatch needs a colour to show: the club's own, else the navy that stands in for none.
    color: ownColour(club.color) ?? LCA.navy,
  }
}

/** The texts of the rest of the listing, by the body's key, sent only when changed. */
const REST_TEXTS = ['costText', 'welcomeText'] as const
/** The two ticks, by the body's key. */
const TICKS = ['weekendPlay', 'scholasticFriendly'] as const

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

/** A logo upload's outcome, said in the form's own status or alert. */
type LogoOutcome = { saved: true } | { saved: false; text: string }

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
  const [second, setSecond] = useState(() => places.length > 1)
  const [point2, setPoint2] = useState<LatLng | null>(() => pointOf(places[1]))
  const [errors, setErrors] = useState<Partial<Record<FieldName, string>>>({})
  const [outcome, setOutcome] = useState<Outcome | null>(null)
  const [busy, setBusy] = useState(false)
  const saving = useRef(false)
  const [uploading, setUploading] = useState(false)
  const uploadingNow = useRef(false)
  // A press of Save and publish while a logo uploads is held, and the save is made once the upload ends.
  const [held, setHeld] = useState(false)
  const heldNow = useRef(false)
  const [logoOutcome, setLogoOutcome] = useState<LogoOutcome | null>(null)
  const [previewOpen, setPreviewOpen] = useState(false)
  // The pin picker keeps its own point once drawn, so it is drawn afresh after each save, from the point the answer gives.
  const [saves, setSaves] = useState(0)

  const [helpOpen, setHelpOpen] = useState(() => !helpShownBefore())
  const helpButton = useRef<HTMLButtonElement>(null)
  const helpPanel = useRef<HTMLElement>(null)
  const focusNext = useRef<'panel' | 'button' | null>(helpOpen ? 'panel' : null)
  useEffect(() => {
    if (helpOpen) rememberHelpShown()
  }, [helpOpen])
  // The mark is cleared only once acted on: the first draw's run can come after the first press, and must not wipe it.
  useEffect(() => {
    if (focusNext.current === 'panel' && helpOpen) {
      helpPanel.current?.focus()
      focusNext.current = null
    } else if (focusNext.current === 'button' && !helpOpen) {
      helpButton.current?.focus()
      focusNext.current = null
    }
  }, [helpOpen])
  function toggleHelp() {
    focusNext.current = helpOpen ? 'button' : 'panel'
    setHelpOpen(!helpOpen)
  }
  function closeHelp() {
    focusNext.current = 'button'
    setHelpOpen(false)
  }

  /** What was stored, as the form would start from it: each field the rest of the listing adds is sent only when it differs. */
  const start = startValues(club, places)

  function change<K extends keyof EditorValues>(field: K, value: EditorValues[K]) {
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

  function changePoint2(next: LatLng | null) {
    if (saving.current) return
    setPoint2(next)
    setOutcome((o) => (o?.saved ? null : o))
  }

  /** Draws the second place, or empties it and folds it away, so the next save drops it. */
  function showSecond(open: boolean) {
    if (saving.current) return
    setSecond(open)
    if (!open) {
      setValues((v) => ({ ...v, place2Name: '', place2Street: '', place2Note: '' }))
      setPoint2(null)
      setErrors((e) => {
        const rest = { ...e }
        delete rest.place2Name
        delete rest.place2Street
        delete rest.place2Note
        return rest
      })
    }
    setOutcome((o) => (o?.saved ? null : o))
  }

  /** Whether any part of place 1 is filled: a word in its boxes, or a pin the person set. */
  const placeFilled = values.placeName.trim() !== '' || values.placeStreet.trim() !== '' || values.placeNote.trim() !== '' || (pointTouched && point !== null)
  /** Whether any part of place 2 is filled: a word in its boxes, or its pin. */
  const place2Filled = second && (values.place2Name.trim() !== '' || values.place2Street.trim() !== '' || values.place2Note.trim() !== '' || point2 !== null)

  /**
   * A club with no place saved yet whose location today is longer than a
   * place name may be, with Where left as it started: that location is kept
   * as it is and no place is sent, rather than every save being refused.
   */
  const keepTodaysWhere = places.length === 0 && (club.location ?? '').length > EDITOR_LIMITS.placeName
    && values.placeName === (club.location ?? '') && values.placeStreet === '' && values.placeNote === '' && !pointTouched && !place2Filled

  /** Place 1 and place 2 as the form holds them, each when any part of it is filled. */
  function placesToSend(): NonNullable<UpdateClubRequest['places']> {
    const first = placeFilled
      ? [{ name: values.placeName.trim(), street: values.placeStreet.trim() || null, note: values.placeNote.trim() || null, point }]
      : []
    const kept = place2Filled
      ? [{ name: values.place2Name.trim(), street: values.place2Street.trim() || null, note: values.place2Note.trim() || null, point: point2 }]
      : []
    return [...first, ...kept]
  }

  async function changeLogo(file: File) {
    if (saving.current || uploadingNow.current || viewOnly) return
    if (!file.type.startsWith('image/')) {
      setLogoOutcome({ saved: false, text: 'The logo was not saved: choose an image file.' })
      return
    }
    uploadingNow.current = true
    setUploading(true)
    setLogoOutcome(null)
    try {
      // Made to fit 320 pixels each way and uploaded at once, as today's page does.
      const blob = await resizeImageToFit(file, 320, 320)
      const { imageUrl } = await adminUploadClubLogo(club.id, blob)
      onSaved({ ...club, image_url: imageUrl }, places)
      setLogoOutcome({ saved: true })
    } catch (err) {
      setLogoOutcome({ saved: false, text: `The logo was not saved: ${wordsOf(err)}` })
    } finally {
      uploadingNow.current = false
      setUploading(false)
      setHeld(false)
    }
  }

  async function save(e: FormEvent) {
    e.preventDefault()
    if (saving.current || viewOnly) return
    // A save that read the club while a logo uploads would write the old logo
    // back, so the press is held and the save is made once the upload ends.
    if (uploadingNow.current) {
      heldNow.current = true
      setHeld(true)
      return
    }
    // A press in the moment between the upload's end and the held save's
    // turn is that same save: it is made here, once, and the held turn finds
    // nothing left to do.
    const afterLogo = heldNow.current
    heldNow.current = false
    await publish(afterLogo)
  }

  /** Checks the form and sends it in the one call; a save held for the logo keeps the logo's own words in view. */
  async function publish(afterLogo: boolean) {
    // One press is one call: whichever way publish is reached, a save already under way is never sent twice.
    if (saving.current) return
    const found = editorProblems(values, {
      admin: isAdmin, hadSlug: Boolean(club.slug), hasPoint: pointTouched && point !== null, hasPoint2: second && point2 !== null,
      cityChanged: values.city !== start.city,
    }).filter(([field]) => !(keepTodaysWhere && field === 'placeName'))
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
    if (!afterLogo) setLogoOutcome(null)

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
    // The rest of the listing, each field only when it differs from what was stored.
    if (values.city !== start.city) body.city = values.city
    for (const key of REST_TEXTS) if (values[key] !== start[key]) body[key] = values[key]
    for (const key of TICKS) if (values[key] !== start[key]) body[key] = values[key]
    for (const key of LINK_FIELDS) {
      const link = values[key].trim()
      if (link !== start[key]) body[key] = link || null
    }
    if (values.color.toLowerCase() !== start.color.toLowerCase()) body.color = values.color.toLowerCase()

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
      setSecond(savedPlaces.length > 1)
      setPoint2(pointOf(savedPlaces[1]))
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

  // Runs after the upload has ended and the page has drawn again, so the held
  // save reads the club with its new logo and every word typed meanwhile.
  const saveHeldPress = useEffectEvent(() => {
    if (uploading || !heldNow.current) return
    heldNow.current = false
    void publish(true)
  })
  useEffect(() => {
    saveHeldPress()
  }, [uploading])

  const differs = {
    aboutText: differsOf(club.about_text, club.description),
    howWeMeetText: differsOf(club.how_we_meet_text, club.meeting_schedule),
  }
  const placeDiffers = places[0] ? differsOf(placeLine(places[0]), club.location) : null
  // The address that works today: the slug's once the new club pages are on, else the club's id.
  const todaysAddress = `/clubs/${clubPagesOn() && club.slug ? club.slug : club.id}`
  const logo = ownLogo(club.image_url)
  // The colour the page has: a changed swatch, else the stored one, which may be none or the default gold.
  const colour = values.color.toLowerCase() !== start.color.toLowerCase() ? values.color : club.color

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-8 lg:flex-row lg:items-start">
      <form onSubmit={save} noValidate className="w-full min-w-0 max-w-2xl space-y-4 lg:flex-1">
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
                      point2={point2}
                      pickerKey={saves}
                      disabled={viewOnly}
                      waiting={busy}
                      second={second}
                      onChange={change}
                      onPoint={changePoint}
                      onPoint2={changePoint2}
                      onSecond={showSecond}
                    />
                  )}
                />
                <EditorRest
                  values={values}
                  errors={errors}
                  waiting={busy}
                  showAdminFields={showAdminFields}
                  address={todaysAddress}
                  logo={logo}
                  logoShut={busy || uploading}
                  onChange={change}
                  onLogo={changeLogo}
                />
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
            {uploading && (
              <p>
                {held
                  ? 'Uploading the logo. Your changes save as soon as it is done.'
                  : 'Uploading the logo. Save and publish waits until it is done.'}
              </p>
            )}
            {logoOutcome?.saved && <p>Logo saved.</p>}
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
            {logoOutcome && !logoOutcome.saved && <p>{logoOutcome.text}</p>}
          </div>
        </div>
      </form>

      <aside aria-label="Preview" className="w-full min-w-0 max-w-2xl space-y-4 lg:sticky lg:top-4 lg:w-80 lg:shrink-0">
        <h2 className="text-base font-semibold text-ink">
          <button
            type="button"
            aria-expanded={previewOpen}
            aria-controls="club-editor-previews"
            onClick={() => setPreviewOpen((open) => !open)}
            className="inline-flex min-h-11 w-full items-center justify-between gap-2 rounded-md border border-hairline px-3 text-ink outline-none focus-visible:ring-3 focus-visible:ring-focus lg:hidden"
          >
            Preview
            <ChevronDown className={cn('size-4 transition-transform', previewOpen && 'rotate-180')} aria-hidden="true" />
          </button>
          <span className="hidden lg:inline">Preview</span>
        </h2>
        <div id="club-editor-previews" data-slot="editor-previews" className={cn('space-y-6', !previewOpen && 'hidden lg:block')}>
          <SearchPreview
            name={values.name} city={values.city} about={values.aboutText} statement={values.howWeMeetText}
            address={values.slug.trim() || club.slug || club.id}
          />
          <SharePreview name={values.name} city={values.city} about={values.aboutText} statement={values.howWeMeetText} logo={club.image_url} />
          <CardPreview name={values.name} city={values.city} statement={values.howWeMeetText} about={values.aboutText} />
          <PageChecklist
            items={pageChecklist({
              statement: values.howWeMeetText, pinned: point !== null || (second && point2 !== null), email: values.contactEmail, logo: club.image_url, colour,
            })}
          />
        </div>
      </aside>
    </div>
  )
}
