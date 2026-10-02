// test/unit/map-location.test.ts
import { describe, expect, it } from 'vitest'
import { parseLocation } from '../../src/lib/mapLocation'

describe('reading a pasted map location', () => {
  it('takes plain coordinates', () => {
    expect(parseLocation('30.4515, -91.1871')).toEqual({ lat: 30.4515, lng: -91.1871 })
    expect(parseLocation('30.4515 -91.1871')).toEqual({ lat: 30.4515, lng: -91.1871 })
  })

  it('takes Google Maps links', () => {
    expect(parseLocation('https://www.google.com/maps/@30.3964191,-91.0186082,15z')).toEqual({ lat: 30.396419, lng: -91.018608 })
    expect(parseLocation('https://www.google.com/maps/search/?api=1&query=30.45,-91.18')).toEqual({ lat: 30.45, lng: -91.18 })
    expect(parseLocation('https://maps.google.com/?q=30.45%2C-91.18')).toEqual({ lat: 30.45, lng: -91.18 })
    expect(parseLocation('https://www.google.com/maps/place/Library/@30.39,-91.01,17z/data=!3m1!4b1!4m6!3m5!1s0x0:0x0!8m2!3d30.3964191!4d-91.0186082')).toEqual({ lat: 30.396419, lng: -91.018608 })
  })

  it('refuses things that are not a location', () => {
    expect(parseLocation('')).toBeNull()
    expect(parseLocation('Baton Rouge')).toBeNull()
    expect(parseLocation('130, -91')).toBeNull()
  })
})
