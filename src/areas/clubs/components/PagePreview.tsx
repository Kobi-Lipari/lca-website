// src/areas/clubs/components/PagePreview.tsx
//
// The club's page itself in the club editor's preview column (WS09 step 21),
// drawn with the new club page's own parts (ClubCover, ClubAbout and
// WhenAndWhere) from what the form holds, so it updates as the person
// types. It is drawn only while the new club pages are on (clubPagesOn), so
// with them off the column is as it was. It is a drawing: smaller, its
// headings are words, and nothing in it is a link or a button. It draws the
// sections the page itself would draw from these words, by the one rule
// the server's answer follows (domain/clubs/sections.ts), and leaves out
// the two lines only the server words, who keeps the page and whose words
// they are, and the map. Its heading says "your club's page" only to the
// club's own rep.
import { LCA } from '@/lib/brand'
import { drawnSections } from '@/areas/clubs/clubPage'
import type { LatLng } from '@/areas/clubs/mapLocation'
import { ClubAbout } from '@/areas/clubs/components/ClubAbout'
import { ClubCover } from '@/areas/clubs/components/ClubCover'
import { WhenAndWhere } from '@/areas/clubs/components/WhenAndWhere'
import { clubPageSections } from '@domain/clubs/sections'
import type { ClubPageResponse } from '@domain/contracts'

/** What the preview reads of the form, by the form's own names (EditorValues in src/areas/clubs/editor.ts). */
interface FormWords {
  name: string
  city: string
  region: string
  aboutText: string
  howWeMeetText: string
  placeName: string
  placeStreet: string
  placeNote: string
  place2Name: string
  place2Street: string
  place2Note: string
  costText: string
  welcomeText: string
  facebookUrl: string
  websiteUrl: string
  otherUrl: string
  weekendPlay: boolean
  scholasticFriendly: boolean
}

/** The form's words with the spaces taken off each end, or null for none. */
const words = (text: string): string | null => (text.trim() ? text.trim() : null)

export function PagePreview({
  own, clubId, address, values, colour, logo, point, point2, second,
}: {
  /** The club is the reader's own. */
  own: boolean
  clubId: string
  /** The page's address part: the slug the form holds, else the stored one, else the id. */
  address: string
  values: FormWords
  /** The club's own colour, as the editor reads it (a changed swatch, else the stored one), or null for none, which draws navy. */
  colour: string | null
  /** The club's own logo on this site, or null. */
  logo: string | null
  point: LatLng | null
  point2: LatLng | null
  /** The form shows a second place. */
  second: boolean
}) {
  const places: ClubPageResponse['places'] = []
  const name1 = words(values.placeName)
  if (name1) places.push({ name: name1, street: words(values.placeStreet), note: words(values.placeNote), latitude: point?.lat ?? null, longitude: point?.lng ?? null })
  const name2 = second ? words(values.place2Name) : null
  if (name2) places.push({ name: name2, street: words(values.place2Street), note: words(values.place2Note), latitude: point2?.lat ?? null, longitude: point2?.lng ?? null })

  const about: ClubPageResponse['about'] = {
    text: words(values.aboutText),
    cost: words(values.costText),
    welcome: words(values.welcomeText),
    facebook: words(values.facebookUrl),
    website: words(values.websiteUrl),
    other: words(values.otherUrl),
    weekend_play: values.weekendPlay,
    scholastic_friendly: values.scholasticFriendly,
  }
  const statement = words(values.howWeMeetText)
  const sections = drawnSections(clubPageSections({
    aboutText: about.text, costText: about.cost, welcomeText: about.welcome, links: [about.facebook, about.website, about.other],
    weekendPlay: about.weekend_play, scholasticFriendly: about.scholastic_friendly, statement, places: places.length, events: 0, news: 0, photos: 0,
  }))
  const club: ClubPageResponse['club'] = {
    id: clubId, slug: address, name: values.name.trim(), city: values.city.trim(), region: words(values.region),
    color: colour ?? LCA.navy.toLowerCase(), logo,
  }

  return (
    <section aria-labelledby="preview-page-title" className="space-y-2">
      <h3 id="preview-page-title" className="text-sm font-semibold text-ink">{own ? 'Your club\'s page' : 'The club\'s page'}</h3>
      <div role="group" aria-label="Club page" data-slot="page-preview" className="@container overflow-hidden rounded-lg border border-hairline bg-ground">
        <ClubCover compact club={club} statement={statement} />
        {sections.includes('about') && <ClubAbout compact name={club.name} about={about} />}
        {sections.includes('when_and_where') && <WhenAndWhere compact name={club.name} statement={statement} told={null} places={places} />}
      </div>
    </section>
  )
}
