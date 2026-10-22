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

import lcaLogo from '@/assets/lca-logo.webp'

export interface LcaLogoProps {
  /** The width it is drawn at, in pixels. */
  width: number
  /** The height it is drawn at, in pixels (the file is 400 by 399). */
  height: number
  /**
   * Its words for a screen reader, "Louisiana Chess Association" unless
   * others are given; an empty string where the name stands in words beside
   * it.
   */
  alt?: string
}

export function LcaLogo({ width, height, alt = 'Louisiana Chess Association' }: LcaLogoProps) {
  return <img data-slot="lca-logo" src={lcaLogo} width={width} height={height} alt={alt} className="rounded-xl object-contain" />
}
