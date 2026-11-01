// src/components/LcaLogo.tsx
//
// The official, board-voted full-colour LCA logo of decision D1, for the
// roomy places: the footer's brand block, the About and history pages, and
// later the homepage identity band, the membership card and certificates.
// The rook mark, for the header and tight spaces, is LcaMark.
//
// It draws src/assets/lca-logo.webp, the file the header and the footer
// have always drawn (400 by 399 pixels; public/lca-logo.jpg is its large
// source, which no page shows), as it is: one img with a size and its words,
// and a fixed shape of its own (rounded corners, the picture contained in
// its box), with nothing laid over it. The logo is never recoloured, so it
// takes no class, style, colour, filter or opacity, and its type refuses
// each; nor does it take another file. The picture has a white ground of
// its own, edge to edge, so it always sits on white, as D1 asks, even where
// the page around it is navy or dark; on a light page a caller may frame it
// with a mat.
//
// The new footer's 56 pixel place (WS02 step 8) passes `sized`, which its
// type allows only at 56 by 56: the img then offers the two copies
// scripts/images.mjs makes of the same file for that place,
// src/assets/lca-logo-56.webp for a screen of ordinary density and
// src/assets/lca-logo-112.webp for a sharp one, with the 400 pixel file as
// the fallback for a browser that reads no srcset. A caller that passes
// nothing draws exactly what it drew before, and no caller names a file.

import lcaLogo from '@/assets/lca-logo.webp'
import lcaLogo56 from '@/assets/lca-logo-56.webp'
import lcaLogo112 from '@/assets/lca-logo-112.webp'

/**
 * The logo's size and its words: at any size from the 400 pixel file, or,
 * with `sized`, at the new footer's 56 pixels from the two copies made for
 * that place.
 */
export type LcaLogoProps =
  | {
      /** The width it is drawn at, in pixels. */
      width: number
      /** The height it is drawn at, in pixels (the file is 400 by 399). */
      height: number
      /**
       * Its words for a screen reader, "Louisiana Chess Association" unless
       * others are given; an empty string where the name stands in words
       * beside it.
       */
      alt?: string
      sized?: false
    }
  | {
      width: 56
      height: 56
      alt?: string
      /** Drawn from the 56 and 112 pixel copies, as the browser's density asks. */
      sized: true
    }

export function LcaLogo(props: LcaLogoProps) {
  const { width, height, alt = 'Louisiana Chess Association' } = props
  if (props.sized) {
    return <img data-slot="lca-logo" src={lcaLogo} srcSet={`${lcaLogo56} 1x, ${lcaLogo112} 2x`} width={56} height={56} alt={alt} className="rounded-xl object-contain" />
  }
  return <img data-slot="lca-logo" src={lcaLogo} width={width} height={height} alt={alt} className="rounded-xl object-contain" />
}
