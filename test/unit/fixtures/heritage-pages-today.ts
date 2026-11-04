// test/unit/fixtures/heritage-pages-today.ts
//
// What the six heritage pages draw today (WS01 step 31), with the
// themeHeritage switch off: each page drawn on its own, as src/App.tsx lists
// the six with the switch off, from the files at 0cc7c30, before the step
// changed them, with the made-up answers of test/unit/helpers/heritageAnswers.ts
// and the clock at Thu, Oct 22, 2026, for a visitor and for an LCA admin,
// with newLook off and on. Each is the length and the sha256 of the page's
// markup as the test environment draws it, the logo's address being the one
// it gives the imported file. test/unit/heritage-layout.test.tsx draws the
// pages from today's files the same way and holds each to its entry, so
// with the switch off every page draws the markup it drew, to the attribute.
// The About page's markup is also held in full, as literals, by
// test/unit/brand-placements.test.tsx.
//
// They were made by drawing the files of 0cc7c30 in a copy of that tree with
// the same answers; to make them again after a page changes on purpose,
// draw the page as heritage-layout.test.tsx does and record what it prints
// on a failure. The champions entries were made again on Friday, October 23,
// 2026, when the page became two lists with one entry per person, and again
// when the reigning champion's card took the latest photo and the record.

export interface DrawnToday {
  length: number
  sha256: string
}

/** Keyed by page, visitor and the newLook switch. */
export const HERITAGE_PAGES_TODAY: Record<string, DrawnToday> = {
  'about visitor newLook off': { length: 4648, sha256: 'e73c46c9133b5e338f8452a9ad3279b8a497dde201d370807105c4b75915ba75' },
  'about admin newLook off': { length: 4648, sha256: 'e73c46c9133b5e338f8452a9ad3279b8a497dde201d370807105c4b75915ba75' },
  'board visitor newLook off': { length: 9282, sha256: 'f66f461d2b710f20b4f9b56d19eca95832cccb3a6a14aa0b8decae989f898d81' },
  'board admin newLook off': { length: 17365, sha256: '1128d0415ce48e16c6b884819e7e85af1750a28e9de09e6259f1748199910dba' },
  'bylaws visitor newLook off': { length: 5679, sha256: '659f50e115677bd5ad5898e11cb82682cee03a2e1764bd0e7d75f7064d085e45' },
  'bylaws admin newLook off': { length: 10791, sha256: 'dadcf4e37d45a45348928c1ddffa103b96cdc2e9ba66496b4304e584a5825cd0' },
  'minutes visitor newLook off': { length: 4552, sha256: '3bc674efc30634f06a5efe0bdf937e301d2ac91b6ab43f07e487d33b3b2c74ec' },
  'minutes admin newLook off': { length: 9416, sha256: 'd8e67ca7439f07261faf267b01d737b64ad0f804c3b08259f899c69d2506c0e5' },
  'meeting visitor newLook off': { length: 6884, sha256: '29379c82e4bd867195c69e71ede071126ea9e3f1c104967afc16eb880c39937e' },
  'meeting admin newLook off': { length: 6884, sha256: '29379c82e4bd867195c69e71ede071126ea9e3f1c104967afc16eb880c39937e' },
  'champions visitor newLook off': { length: 10371, sha256: '332b30c247f6297030e31b6ce4121918d3c881b74a911242f372db7df5bd4919' },
  'champions admin newLook off': { length: 10371, sha256: '332b30c247f6297030e31b6ce4121918d3c881b74a911242f372db7df5bd4919' },
  'about visitor newLook on': { length: 4898, sha256: '18ff7decc733dcad36974b1aad26d379a03d1da50b792acf4f07957fdef8714c' },
  'about admin newLook on': { length: 4898, sha256: '18ff7decc733dcad36974b1aad26d379a03d1da50b792acf4f07957fdef8714c' },
  'board visitor newLook on': { length: 9282, sha256: 'f66f461d2b710f20b4f9b56d19eca95832cccb3a6a14aa0b8decae989f898d81' },
  'board admin newLook on': { length: 17365, sha256: '1128d0415ce48e16c6b884819e7e85af1750a28e9de09e6259f1748199910dba' },
  'bylaws visitor newLook on': { length: 5679, sha256: '659f50e115677bd5ad5898e11cb82682cee03a2e1764bd0e7d75f7064d085e45' },
  'bylaws admin newLook on': { length: 10791, sha256: 'dadcf4e37d45a45348928c1ddffa103b96cdc2e9ba66496b4304e584a5825cd0' },
  'minutes visitor newLook on': { length: 4552, sha256: '3bc674efc30634f06a5efe0bdf937e301d2ac91b6ab43f07e487d33b3b2c74ec' },
  'minutes admin newLook on': { length: 9416, sha256: 'd8e67ca7439f07261faf267b01d737b64ad0f804c3b08259f899c69d2506c0e5' },
  'meeting visitor newLook on': { length: 6884, sha256: '29379c82e4bd867195c69e71ede071126ea9e3f1c104967afc16eb880c39937e' },
  'meeting admin newLook on': { length: 6884, sha256: '29379c82e4bd867195c69e71ede071126ea9e3f1c104967afc16eb880c39937e' },
  'champions visitor newLook on': { length: 10371, sha256: '332b30c247f6297030e31b6ce4121918d3c881b74a911242f372db7df5bd4919' },
  'champions admin newLook on': { length: 10371, sha256: '332b30c247f6297030e31b6ce4121918d3c881b74a911242f372db7df5bd4919' },
}
