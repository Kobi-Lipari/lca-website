import { describe, expect, it } from 'vitest'
import {
  buildUploadFiles, defaultSettings, ratingSystemFor, readDbf, roundCell, settingsProblems, uschessName, writeDbf, zipFiles,
} from '../../src/lib/uschessUpload'
import type { ApiRatingReport } from '../../src/lib/api'

const report: ApiRatingReport = {
  tournament: { name: 'Kenner Fall Open', startDate: '2026-10-17', endDate: '2026-10-18', location: 'Kenner, LA', rounds: 3, timeControl: 'G/90;d5' },
  sections: [{
    name: 'Open',
    players: [
      { pairingNum: 1, name: 'Ana Belén Núñez', uscfId: '12345678', preRating: 1900, score: 2.5, rounds: [
        { round: 1, code: 'W', opponentPairingNum: 3, color: 'W' },
        { round: 2, code: 'D', opponentPairingNum: 2, color: 'B' },
        { round: 3, code: 'B', opponentPairingNum: null, color: null },
      ] },
      { pairingNum: 2, name: 'John Smith Jr.', uscfId: '23456789', preRating: 1500, score: 1.5, rounds: [
        { round: 1, code: 'H', opponentPairingNum: null, color: null },
        { round: 2, code: 'D', opponentPairingNum: 1, color: 'W' },
        { round: 3, code: 'X', opponentPairingNum: 3, color: null },
      ] },
      { pairingNum: 3, name: 'Kim Lee', uscfId: '34567890', preRating: null, score: 0, rounds: [
        { round: 1, code: 'L', opponentPairingNum: 1, color: 'B' },
        { round: 2, code: 'U', opponentPairingNum: null, color: null },
        { round: 3, code: 'F', opponentPairingNum: 2, color: null },
      ] },
    ],
  }],
  validationErrors: [],
  upload: { settings: null, suggested: { chiefTdId: '87654321', chiefTdName: 'Td', assistantTdId: '', city: 'Kenner', state: 'LA', zip: '70065' } },
}

describe('dBase writer', () => {
  it('writes a file that reads back field for field', () => {
    const bytes = writeDbf(
      [{ name: 'A', type: 'C', length: 5 }, { name: 'N', type: 'N', length: 4 }, { name: 'D', type: 'D', length: 8 }],
      [{ A: 'hello world', N: 42, D: '2026-10-17' }, { A: 'é', N: null, D: '' }],
    )
    expect(bytes[0]).toBe(0x03)
    expect(bytes[bytes.length - 1]).toBe(0x1a)
    const back = readDbf(bytes)
    expect(back.fields.map((f) => f.name)).toEqual(['A', 'N', 'D'])
    expect(back.rows).toEqual([{ A: 'hello', N: '42', D: '20261017' }, { A: 'e', N: '', D: '' }])
  })
})

describe('US Chess upload files', () => {
  const settings = { ...defaultSettings(report), affiliateId: 'A6012345' }

  it('fills in sensible defaults and checks what is missing', () => {
    expect(defaultSettings(report)).toMatchObject({ chiefTdId: '87654321', city: 'Kenner', state: 'LA', zip: '70065' })
    expect(settingsProblems(defaultSettings(report))).toHaveLength(1) // affiliate ID
    expect(settingsProblems(settings)).toEqual([])
  })

  it('builds the three files', () => {
    const files = buildUploadFiles(report, settings)
    const h = readDbf(files.thexport)
    expect(h.rows).toHaveLength(1)
    expect(h.rows[0]).toMatchObject({ H_NAME: 'Kenner Fall Open', H_TOT_SECT: '1', H_BEG_DATE: '20261017', H_AFF_ID: 'A6012345', H_CTD_ID: '87654321' })
    const s = readDbf(files.tsexport)
    expect(s.rows[0]).toMatchObject({ S_SEC_NUM: '1', S_SEC_NAME: 'Open', S_TOT_RNDS: '3', S_LST_PAIR: '3', S_R_SYSTEM: 'R' })
    const d = readDbf(files.tdexport)
    expect(d.fields.filter((f) => f.name.startsWith('D_RND'))).toHaveLength(3)
    expect(d.rows[0]).toMatchObject({ D_MEM_ID: '12345678', D_NAME: 'NUNEZ, ANA BELEN', D_RND01: 'W    3W', D_RND03: 'B' })
    expect(d.rows[1].D_NAME).toBe('SMITH JR, JOHN')
    expect(d.rows[2]).toMatchObject({ D_RATING: '', D_RND02: 'U', D_RND03: 'F    2' })
  })

  it('writes rounds as result, opponent, color', () => {
    expect(roundCell('W', 12, 'B')).toBe('W   12B')
    expect(roundCell('H', null, null)).toBe('H      ')
  })

  it('reads the rating system from the time control', () => {
    expect(ratingSystemFor('G/90;d5')).toBe('R')
    expect(ratingSystemFor('G/45;d5')).toBe('D')
    expect(ratingSystemFor('G/30+10')).toBe('D')
    expect(ratingSystemFor('G/15+5')).toBe('Q')
    expect(ratingSystemFor('G/5+2')).toBe('B')
    expect(ratingSystemFor('40/90, SD/30;d5')).toBe('R')
    expect(ratingSystemFor('Game in 60, 5 second delay')).toBe('D')
  })

  it('names players the way US Chess lists them', () => {
    expect(uschessName('Mary Ann O Brien')).toBe('BRIEN, MARY ANN O')
    expect(uschessName('Cher')).toBe('CHER')
  })

  it('zips the three files into one download', () => {
    const files = buildUploadFiles(report, settings)
    const zip = zipFiles([{ name: 'THEXPORT.DBF', data: files.thexport }])
    expect([zip[0], zip[1], zip[2], zip[3]]).toEqual([0x50, 0x4b, 0x03, 0x04])
  })
})
