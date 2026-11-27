// domain/clubs/directoryAddress.ts
//
// The Clubs page's choices as they live in its address (WS09 step 32), so a
// link someone shares opens the list as they saw it:
//   - near: a ZIP code of five digits, and nothing else: never the device's
//     own point, a town's name or other text a person typed. The page finds
//     the ZIP code in the browser (domain/clubs/nearZip.ts).
//   - sort: "az" or "nearest". Nearest is the order with a place and A to Z
//     the order without one, so only "sort=az" beside a place is written.
//   - region: one of REGIONS by a short key made from the first name of its
//     title ("baton-rouge" for "Baton Rouge / East Central"), never the
//     region's whole title, which no one could type into an address by hand.
//   - weekends and scholastic: "1" when the tick is chosen.
// Reading is forgiving: a part it does not know, or one whose value it
// cannot read, is dropped, and the first of two of the same name is read.
// Writing is canonical: the same choices always write the same address, in
// the order above, with every default left out.
//
// Pure code with no zod: it reads no location, no clock and no device.
import { REGIONS, type Region } from './regions'
import { slugFor } from './slug'
import { NO_FILTERS, type DirectoryFilters } from './order'

/** The two orders. */
export type DirectorySort = 'az' | 'nearest'

/** The page's choices as the address holds them. */
export interface DirectoryAddress extends DirectoryFilters {
  /** A ZIP code of five digits, or null for no place. */
  near: string | null
  sort: DirectorySort
}

/** No place, A to Z, no filter: the address with nothing after the path. */
export const DEFAULT_ADDRESS: DirectoryAddress = { near: null, sort: 'az', ...NO_FILTERS }

/** A region's key in the address: the first name of its title, as the slug rule writes it ("lake-charles"). */
export function regionKey(region: Region): string {
  return slugFor(region.split('/')[0])
}

/** The region a key names, or null for a key no region has. */
export function regionByKey(key: string): Region | null {
  return REGIONS.find((region) => regionKey(region) === key) ?? null
}

/** A ZIP code as the address holds it: exactly five digits. */
const ZIP = /^\d{5}$/

/** The values a tick is read as chosen by. */
const TICKED = ['1', 'true', 'yes', 'on']

/** The page's choices from its address's query ("?near=70808&sort=az" or without the question mark). */
export function readDirectoryAddress(search: string): DirectoryAddress {
  const params = new URLSearchParams(search)
  const near = params.get('near')
  const place = near !== null && ZIP.test(near) ? near : null
  const sort = params.get('sort')
  const region = params.get('region')
  const ticked = (name: string) => TICKED.includes((params.get(name) ?? '').toLowerCase())
  return {
    near: place,
    // A to Z when it is asked for, and whenever there is no place to be near; nearest with a place otherwise.
    sort: place === null || sort === 'az' ? 'az' : 'nearest',
    region: region === null ? null : regionByKey(region),
    weekends: ticked('weekends'),
    scholastic: ticked('scholastic'),
  }
}

/** The address's query for the page's choices: "" for the defaults, or "?" and the parts in their one order. */
export function writeDirectoryAddress(choices: DirectoryAddress): string {
  const parts: string[] = []
  const place = choices.near !== null && ZIP.test(choices.near) ? choices.near : null
  if (place !== null) {
    parts.push(`near=${place}`)
    if (choices.sort === 'az') parts.push('sort=az')
  }
  if (choices.region !== null) parts.push(`region=${regionKey(choices.region)}`)
  if (choices.weekends) parts.push('weekends=1')
  if (choices.scholastic) parts.push('scholastic=1')
  return parts.length === 0 ? '' : `?${parts.join('&')}`
}
