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