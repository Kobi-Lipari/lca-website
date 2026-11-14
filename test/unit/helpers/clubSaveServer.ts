// test/unit/helpers/clubSaveServer.ts
//
// A made-up server for the club editor's jsdom tests. It keeps one club and
// its places, and answers the editor's one save, PATCH /api/admin/clubs/:id,
// the way the real handler does with CLUB_KEEPERS_ON set
// (functions/api/admin/clubs/[id].ts and functions/utils/clubs/save.ts):
// today's fields the body sends, the pin from `mapLocation`, the new texts
// trimmed and stored as null when empty, About and the meeting's words
// copied into today's description and meeting schedule when they hold
// words, and, when the body sends `places`, the places replaced and place
// 1's line and point copied over today's location and pin, never blanking
// either. The rest of the listing as the real save keeps it: the city
// trimmed, the cost, who is welcome and the three links trimmed and null
// when empty, the two ticks as 1 or 0, and a colour taken only as a # and
// six hex digits, any other string leaving the stored colour as it was. The
// answer is the club as saved, with the places as saved when the body sent
// them. Each save starts from the one before, as the real save reads the
// club afresh. test/integration/club-save-one-press.test.ts holds the real
// save to these rules.

type Row = Record<string, unknown>

interface PlaceBody {
  name: string
  street?: string | null
  note?: string | null
  point?: { lat: number; lng: number } | null
}

/** Text as the save stores it: trimmed, and null when nothing is left. */
const stored = (text: unknown): string | null => {
  const trimmed = typeof text === 'string' ? text.trim() : ''
  return trimmed === '' ? null : trimmed
}

/** Today's fields the body may send, by the body's key and the column. */
const TODAYS: ReadonlyArray<readonly [string, string]> = [
  ['name', 'name'], ['location', 'location'], ['description', 'description'], ['meetingSchedule', 'meeting_schedule'], ['contactEmail', 'contact_email'],
]

/** The new texts the editor sends, by the body's key and the column. */
const TEXTS: ReadonlyArray<readonly [string, string]> = [
  ['aboutText', 'about_text'], ['howWeMeetText', 'how_we_meet_text'], ['contactNamePublic', 'contact_name_public'],
  ['costText', 'cost_text'], ['welcomeText', 'welcome_text'], ['facebookUrl', 'facebook_url'], ['websiteUrl', 'website_url'], ['otherUrl', 'other_url'],
]

/** The two ticks, by the body's key and the column, stored as 1 or 0. */
const FLAGS: ReadonlyArray<readonly [string, string]> = [['weekendPlay', 'weekend_play'], ['scholasticFriendly', 'scholastic_friendly']]

export function clubSaveServer(club: Row, places: Row[]) {
  const state = { club: { ...club }, places: places.map((place) => ({ ...place })) }
  let nextId = 100

  function patch(body: Row): { club: Row; places?: Row[] } {
    const next: Row = { ...state.club }
    for (const [key, column] of TODAYS) if (body[key] !== undefined) next[column] = body[key]
    if (body.region !== undefined) next.region = body.region || null
    if (body.slug !== undefined) next.slug = body.slug
    if (body.mapLocation !== undefined) {
      const pin = body.mapLocation as { lat: number; lng: number } | null
      next.latitude = pin?.lat ?? null
      next.longitude = pin?.lng ?? null
    }
    if (typeof body.city === 'string') next.city = body.city.trim()
    if (body.color !== undefined) next.color = body.color === null ? null : /^#[0-9A-Fa-f]{6}$/.test(String(body.color)) ? body.color : next.color
    for (const [key, column] of TEXTS) if (body[key] !== undefined) next[column] = stored(body[key])
    for (const [key, column] of FLAGS) if (body[key] !== undefined) next[column] = body[key] ? 1 : 0
    if (body.aboutText !== undefined && typeof next.about_text === 'string') next.description = next.about_text
    if (body.howWeMeetText !== undefined && typeof next.how_we_meet_text === 'string') next.meeting_schedule = next.how_we_meet_text

    if (Array.isArray(body.places)) {
      state.places = (body.places as PlaceBody[]).map((place) => ({
        id: nextId++,
        name: place.name.trim(),
        street: stored(place.street),
        note: stored(place.note),
        latitude: place.point ? place.point.lat : null,
        longitude: place.point ? place.point.lng : null,
      }))
      const first = state.places[0]
      if (first) {
        next.location = first.street ? `${first.name}, ${first.street}` : first.name
        if (typeof first.latitude === 'number') {
          next.latitude = first.latitude
          next.longitude = first.longitude
        }
      }
    }
    state.club = next
    return Array.isArray(body.places) ? { club: next, places: state.places } : { club: next }
  }

  return { state, patch }
}
