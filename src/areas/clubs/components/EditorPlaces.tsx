// src/areas/clubs/components/EditorPlaces.tsx
//
// The third basic of the one club editor: where the club meets. Place 1's
// name, street and note, and its pin, set with today's ClubLocationPicker
// drawn bare: a click on the map or a drag of the pin when the map can be
// drawn, or pasted coordinates or a Google Maps link, and nothing looked up
// at any provider. A second place the club already lists is kept as it is
// and sent back with place 1 on every save (ClubEditor.tsx), since the save
// replaces every place the club has. While a save runs the boxes are read
// only and the picker is shut (`waiting`, `disabled`).
import { ClubLocationPicker } from '@/areas/clubs/components/ClubLocationPicker'
import { EditorField, type Differs } from '@/areas/clubs/components/EditorBasics'
import type { EditorField as FieldName, EditorValues } from '@/areas/clubs/editor'
import type { LatLng } from '@/areas/clubs/mapLocation'

export function EditorPlaces({
  clubName, values, errors, differs, point, pickerKey, disabled, waiting, onChange, onPoint,
}: {
  clubName: string
  values: EditorValues
  errors: Partial<Record<FieldName, string>>
  /** Today's location beside place 1's line, when the two differ. */
  differs: Differs | null
  /** Place 1's pin as the form holds it. */
  point: LatLng | null
  /** Changes after each save, so the picker is drawn afresh from the point the save stored; the boxes keep their focus. */
  pickerKey: number
  disabled?: boolean
  /** A save is under way: the boxes are read only until it ends. */
  waiting?: boolean
  onChange: (field: keyof EditorValues, value: string) => void
  onPoint: (point: LatLng | null) => void
}) {
  return (
    <fieldset className="m-0 min-w-0 space-y-4 border-0 p-0">
      <legend className="mb-3 text-sm font-medium leading-snug">Where</legend>
      <EditorField
        field="placeName" label="Place name" autoComplete="organization"
        value={values.placeName} error={errors.placeName} differs={differs} readOnly={waiting}
        onChange={(v) => onChange('placeName', v)}
      />
      <EditorField
        field="placeStreet" label="Street address" autoComplete="street-address"
        value={values.placeStreet} error={errors.placeStreet} readOnly={waiting}
        onChange={(v) => onChange('placeStreet', v)}
      />
      <EditorField
        field="placeNote" label="Note about the place"
        value={values.placeNote} error={errors.placeNote} readOnly={waiting}
        onChange={(v) => onChange('placeNote', v)}
      />
      <ClubLocationPicker
        key={pickerKey}
        clubName={clubName}
        latitude={point?.lat}
        longitude={point?.lng}
        disabled={disabled}
        bare={{ inputId: 'editor-point', onChange: onPoint }}
      />
    </fieldset>
  )
}
