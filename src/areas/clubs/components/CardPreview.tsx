// src/areas/clubs/components/CardPreview.tsx
//
// The club's card in LCA's club directory, drawn in the club editor's
// preview column as the brief words it: at most three lines, the club's name
// and town, then how the club meets in its own words, held to two lines, or,
// with none, "Schedule not listed · Know when they meet? Suggest an update"
// and the club's own description in grey. The card carries no colour, logo
// or initials, and no date of any kind: no next meeting, no "Checked" month
// and no claim about a week. A screen reader reads it as its lines. It is a
// drawing, so nothing in it is a link or a button. Its heading says "your
// card" only to the club's own rep, and "the club's card" to anyone else who
// keeps the club.
import { plainText } from '@domain/clubs/pageMeta'

export function CardPreview({
  own, name, city, statement, about,
}: {
  /** The club is the reader's own. */
  own: boolean
  name: string
  city: string
  /** How the club meets, in its own words. */
  statement: string
  /** The club's own description, shown in grey when it has no statement. */
  about: string
}) {
  const meets = plainText(statement)
  const said = plainText(about)
  const town = plainText(city)
  return (
    <section aria-labelledby="preview-card-title" className="space-y-2">
      <h3 id="preview-card-title" className="text-sm font-semibold text-ink">{own ? 'Your card in LCA\'s club directory' : 'The club\'s card in LCA\'s club directory'}</h3>
      <div role="group" aria-label="Directory card" className="space-y-1 rounded-lg border border-hairline bg-card p-3 text-sm">
        <p className="break-words font-semibold text-ink">{plainText(name)}{town ? ` · ${town}` : ''}</p>
        {meets ? (
          <p className="line-clamp-2 break-words text-ink">{meets}</p>
        ) : (
          <>
            <p className="text-ink">Schedule not listed · Know when they meet? Suggest an update</p>
            {said && <p className="line-clamp-1 break-words text-muted-foreground">{said}</p>}
          </>
        )}
      </div>
    </section>
  )
}
