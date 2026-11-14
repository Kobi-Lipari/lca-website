// src/areas/clubs/components/EditorPlaces.tsx
//
// The third basic of the one club editor: where the club meets, in up to two
// places. Place 1's name, street and note, and its pin, set with today's
// ClubLocationPicker drawn bare: a click on the map or a drag of the pin when
// the map can be drawn, or pasted coordinates or a Google Maps link, and
// nothing looked up at any provider. A second place has the same four parts,
// its picker naming the place in its words. It is drawn when the club lists
// one, or once the person asks for it with Add another place, and Remove
// this place empties it and folds it away, the focus going back to Add
// another place. Both go with the rest on every save (ClubEditor.tsx), since
// the save replaces every place the club has. While a save runs the boxes
// are read only and the pickers are shut (`waiting`, `disabled`).
import { useEffect, useRef } from 'react'

import { Button } from '@/components/ui/button'
import { ClubLocationPicker } from '@/areas/clubs/components/ClubLocationPicker'
import { EditorField, type Differs } from '@/areas/clubs/components/EditorBasics'
import type { EditorField as FieldName, EditorValues } from '@/areas/clubs/editor'
import type { LatLng } from '@/areas/clubs/mapLocation'

export function EditorPlaces({
  clubName, values, errors, differs, point, point2, pickerKey, disabled, waiting, second, onChange, onPoint, onPoint2, onSecond,
}: {
  clubName: string
  values: EditorValues
  errors: Partial<Record<FieldName, string>>
  /** Today's location beside place 1's line, when the two differ. */
  differs: Differs | null
  /** Place 1's pin as the form holds it. */
  point: LatLng | null
  /** Place 2's pin as the form holds it. */
  point2: LatLng | null
  /** Changes after each save, so the pickers are drawn afresh from the points the save stored; the boxes keep their focus. */
  pickerKey: number
  disabled?: boolean
  /** A save is under way: the boxes are read only until it ends. */
  waiting?: boolean
  /** Whether the second place is drawn. */
  second: boolean
  onChange: (field: keyof EditorValues, value: string) => void
  onPoint: (point: LatLng | null) => void
  onPoint2: (point: LatLng | null) => void
  /** Draws the second place (true) or empties it and folds it away (false). */
  onSecond: (open: boolean) => void
}) {
  // Where the focus goes once the second place is drawn or folded away.
  const addButton = useRef<HTMLButtonElement>(null)
  const focusNext = useRef<'name' | 'add' | null>(null)
  // The mark is cleared only once acted on, so a late first run cannot wipe a press.
  useEffect(() => {
    if (focusNext.current === 'name' && second) {
      document.getElementById('editor-place2Name')?.focus()
      focusNext.current = null
    } else if (focusNext.current === 'add' && !second) {
      addButton.current?.focus()
      focusNext.current = null
    }
  }, [second])

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
      {second ? (
        <fieldset className="m-0 min-w-0 space-y-4 border-0 border-t border-hairline p-0 pt-4">
          <legend className="mb-3 text-sm font-medium leading-snug">Place 2</legend>
          <EditorField
            field="place2Name" label="Place 2 name" autoComplete="off"
            value={values.place2Name} error={errors.place2Name} readOnly={waiting}
            onChange={(v) => onChange('place2Name', v)}
          />
          <EditorField
            field="place2Street" label="Place 2 street address"
            value={values.place2Street} error={errors.place2Street} readOnly={waiting}
            onChange={(v) => onChange('place2Street', v)}
          />
          <EditorField
            field="place2Note" label="Note about place 2"
            value={values.place2Note} error={errors.place2Note} readOnly={waiting}
            onChange={(v) => onChange('place2Note', v)}
          />
          <ClubLocationPicker
            key={`second-${pickerKey}`}
            clubName={clubName}
            latitude={point2?.lat}
            longitude={point2?.lng}
            disabled={disabled}
            bare={{ inputId: 'editor-point-2', onChange: onPoint2, place: 'place 2' }}
          />
          <Button
            type="button" variant="outline" className="min-h-11" disabled={disabled}
            onClick={() => { focusNext.current = 'add'; onSecond(false) }}
          >
            Remove place 2
          </Button>
        </fieldset>
      ) : (
        <Button
          ref={addButton} type="button" variant="outline" className="min-h-11" disabled={disabled}
          onClick={() => { focusNext.current = 'name'; onSecond(true) }}
        >
          Add another place
        </Button>
      )}
    </fieldset>
  )
}
