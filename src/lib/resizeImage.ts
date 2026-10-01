// src/lib/resizeImage.ts

/**
 * Resizes an image file to fit within a target box without cropping,
 * returning a JPEG Blob. Runs entirely client-side via canvas. Uses
 * "contain" fit (like CSS object-fit: contain) rather than "cover" — a
 * logo mark should never lose part of itself to a crop, unlike a wide
 * promotional photo where cover-fit made sense.
 */
export async function resizeImageToFit(
  file: File,
  targetWidth: number,
  targetHeight: number,
  quality = 0.9,
): Promise<Blob> {
  const bitmap = await createImageBitmap(file)

  const scale = Math.min(targetWidth / bitmap.width, targetHeight / bitmap.height, 1)
  const scaledWidth = bitmap.width * scale
  const scaledHeight = bitmap.height * scale
  const offsetX = (targetWidth - scaledWidth) / 2
  const offsetY = (targetHeight - scaledHeight) / 2

  const canvas = document.createElement('canvas')
  canvas.width = targetWidth
  canvas.height = targetHeight
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas not supported')

  // JPEG has no transparency — fill white first so a transparent-background
  // logo doesn't get black letterboxing.
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, targetWidth, targetHeight)
  ctx.drawImage(bitmap, offsetX, offsetY, scaledWidth, scaledHeight)

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('Failed to encode image'))),
      'image/jpeg',
      quality,
    )
  })
}

/**
 * Shrinks a photo so its longest edge is at most maxEdge, keeping its shape,
 * and returns a JPEG Blob. Never enlarges.
 *
 * For scoresheet scans, where resizeImageToFit's padding would be wrong: the
 * vision model reads a plain photo best, and white bars would only waste
 * pixels it is billed for. 1568px is the long edge the model works at, so
 * anything bigger is resized on the server anyway; doing it here makes the
 * upload a few hundred KB instead of several MB. Re-encoding through canvas
 * also turns an iPhone HEIC into a JPEG the model accepts.
 */
export async function downscaleImage(
  file: Blob,
  maxEdge = 1568,
  quality = 0.8,
): Promise<Blob> {
  // from-image honours the EXIF rotation, so a phone photo taken upright
  // does not reach the model lying on its side.
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })

  const scale = Math.min(maxEdge / Math.max(bitmap.width, bitmap.height), 1)
  const width = Math.round(bitmap.width * scale)
  const height = Math.round(bitmap.height * scale)

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas not supported')

  ctx.drawImage(bitmap, 0, 0, width, height)
  bitmap.close()

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('Failed to encode image'))),
      'image/jpeg',
      quality,
    )
  })
}

/**
 * A square portrait for an officer card: crops to a square (keeping the
 * top of a tall photo, where faces usually are) and scales to size x size.
 */
export async function cropToSquare(file: Blob, size = 480, quality = 0.85): Promise<Blob> {
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
  const side = Math.min(bitmap.width, bitmap.height)
  const sx = (bitmap.width - side) / 2
  const sy = bitmap.height > bitmap.width ? (bitmap.height - side) * 0.2 : (bitmap.height - side) / 2
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas not supported')
  ctx.drawImage(bitmap, sx, sy, side, side, 0, 0, size, size)
  bitmap.close()
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('Failed to encode image'))),
      'image/jpeg',
      quality,
    )
  })
}
