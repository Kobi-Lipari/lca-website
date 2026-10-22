// src/components/ResponsiveImage.tsx
//
// A picture in the sizes and formats scripts/images.mjs writes: a <picture>
// with an AVIF source and a WebP source, each listing its files by width, so
// the browser takes, in the first format it can show, the smallest file that
// covers the space the picture fills at the screen's density. `sizes` tells
// it that space, as the sizes attribute does. The img inside carries the
// source photo's own width and height, so the page holds the picture's shape
// before a file arrives and nothing moves when one does.
//
// The page's largest picture, the one a visitor sees first, is marked
// `priority`: the browser fetches it ahead of other pictures
// (fetchpriority="high") and loads it at once. Every other picture waits
// until it nears the screen (loading="lazy").
//
// The caller imports the files it draws one by one, so a build carries only
// the files its pages use. It also names the img's own src, `fallback`: the
// photo in a format every browser shows, such as its JPEG. Only a browser
// that can show neither AVIF nor WebP (an older Safari, for one) takes it;
// a browser that takes a source never fetches it, so it adds nothing to what
// the others download.

import type { CSSProperties } from 'react'

/** One file of a picture: its address and its width in pixels. */
interface PictureFile {
  src: string
  width: number
}

export interface ResponsiveImageProps {
  /** The AVIF files, one per width. */
  avif: readonly PictureFile[]
  /** The WebP files, one per width. */
  webp: readonly PictureFile[]
  /** The img's own src, for a browser that can show neither AVIF nor WebP: the photo in a format every browser shows, such as its JPEG. */
  fallback: string
  /** The source photo's width in pixels, which with `height` gives the picture its shape. */
  width: number
  /** The source photo's height in pixels. */
  height: number
  /** How wide the picture is drawn, as the sizes attribute says it: "100vw", or media conditions with widths. */
  sizes: string
  /** Its words for a screen reader; an empty string when the picture is decoration. */
  alt: string
  /** The page's largest picture, seen first: fetched ahead of the others and never lazy. */
  priority?: boolean
  className?: string
  style?: CSSProperties
}

/** A srcset of files by width: "a.avif 640w, b.avif 1024w". */
const srcSetOf = (files: readonly PictureFile[]) => files.map((f) => `${f.src} ${f.width}w`).join(', ')

export function ResponsiveImage({ avif, webp, fallback, width, height, sizes, alt, priority = false, className, style }: ResponsiveImageProps) {
  return (
    <picture>
      <source type="image/avif" srcSet={srcSetOf(avif)} sizes={sizes} />
      <source type="image/webp" srcSet={srcSetOf(webp)} sizes={sizes} />
      <img
        src={fallback}
        width={width}
        height={height}
        alt={alt}
        loading={priority ? 'eager' : 'lazy'}
        fetchPriority={priority ? 'high' : undefined}
        className={className}
        style={style}
      />
    </picture>
  )
}
