/**
 * Resize + re-encode a picked photo to a web-friendly JPEG before uploading.
 * Phone photos are often 5-15MB or HEIC, which the server rejects (8MB / JPEG-PNG-WebP-GIF only).
 * Throws an Error with a user-friendly message if the browser cannot decode the file.
 */
const IMAGE_EXT = /\.(jpe?g|png|webp|gif|heic|heif|bmp|avif)$/i

export function looksLikeImage(file) {
  return Boolean(file) && ((file.type || '').startsWith('image/') || IMAGE_EXT.test(file.name || ''))
}

async function decode(file) {
  if (typeof createImageBitmap === 'function') {
    try {
      return await createImageBitmap(file, { imageOrientation: 'from-image' })
    } catch {
      // fall through to <img> decoding
    }
  }
  const url = URL.createObjectURL(file)
  try {
    return await new Promise((resolve, reject) => {
      const img = new Image()
      img.onload = () => resolve(img)
      img.onerror = () => reject(new Error('decode failed'))
      img.src = url
    })
  } finally {
    URL.revokeObjectURL(url)
  }
}

export async function prepareImageForUpload(file, { maxSide = 1280, quality = 0.85 } = {}) {
  let bitmap
  try {
    bitmap = await decode(file)
  } catch {
    throw new Error('This photo format is not supported. Please choose a JPG or PNG image.')
  }

  const w = bitmap.width || bitmap.naturalWidth
  const h = bitmap.height || bitmap.naturalHeight
  const scale = Math.min(1, maxSide / Math.max(w, h))
  const cw = Math.max(1, Math.round(w * scale))
  const ch = Math.max(1, Math.round(h * scale))

  const canvas = document.createElement('canvas')
  canvas.width = cw
  canvas.height = ch
  const ctx = canvas.getContext('2d')
  ctx.fillStyle = '#ffffff' // flatten transparency for JPEG
  ctx.fillRect(0, 0, cw, ch)
  ctx.drawImage(bitmap, 0, 0, cw, ch)
  bitmap.close?.()

  const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality))
  if (!blob) throw new Error('Could not process this photo. Please try another one.')

  const base = (file.name || 'photo').replace(/\.[^.]+$/, '') || 'photo'
  return new File([blob], `${base}.jpg`, { type: 'image/jpeg', lastModified: Date.now() })
}
