import { useEffect, useState } from 'react'
import { useSwipe } from '../../../hooks/useSwipe.js'

/**
 * "Explore" banner on the user home. Supports several banners (images/videos)
 * with swipe / drag gestures, dots, and a gentle auto-advance.
 */
export function IndividualHomeExploreBanner({ banners = [], loading = false, fallbackSrc }) {
  const [index, setIndex] = useState(0)
  const [paused, setPaused] = useState(false)
  const count = banners.length

  // Keep index valid if the list shrinks
  useEffect(() => {
    if (index >= count) setIndex(0)
  }, [count, index])

  useEffect(() => {
    if (count <= 1 || paused) return
    const id = window.setInterval(() => setIndex((i) => (i + 1) % count), 6000)
    return () => window.clearInterval(id)
  }, [count, paused])

  const swipe = useSwipe({
    onNext: () => setIndex((i) => (count ? (i + 1) % count : 0)),
    onPrev: () => setIndex((i) => (count ? (i - 1 + count) % count : 0)),
    onStart: () => setPaused(true),
    onEnd: () => setPaused(false),
  })

  if (loading) {
    return (
      <div className="relative aspect-[2/1] w-full overflow-hidden rounded-[1.25rem] bg-slate-100 animate-pulse" />
    )
  }

  if (count === 0) {
    return (
      <div className="relative flex aspect-[2/1] w-full items-center justify-center overflow-hidden rounded-[1.25rem] bg-transparent shadow-sm">
        <img src={fallbackSrc} alt="Explore Skills" className="h-full w-full object-contain" />
      </div>
    )
  }

  return (
    <div
      {...swipe}
      className="relative aspect-[2/1] w-full select-none overflow-hidden rounded-[1.25rem] bg-transparent shadow-sm"
      aria-roledescription="carousel"
      aria-label="Explore banners"
    >
      <div
        className="flex h-full transition-transform duration-300 ease-out"
        style={{ transform: `translateX(-${index * 100}%)` }}
      >
        {banners.map((b, i) => (
          <div key={b._id || i} className="h-full w-full shrink-0">
            {b.mediaType === 'video' ? (
              <video
                src={b.imageUrl}
                className="pointer-events-none h-full w-full object-cover"
                autoPlay
                loop
                muted
                playsInline
              />
            ) : (
              <img
                src={b.imageUrl}
                alt="Explore Skills"
                draggable={false}
                className="h-full w-full object-cover"
              />
            )}
          </div>
        ))}
      </div>

      {count > 1 && (
        <div className="absolute bottom-2 left-0 right-0 flex justify-center gap-1.5" role="tablist">
          {banners.map((b, i) => (
            <button
              key={b._id || i}
              type="button"
              role="tab"
              aria-selected={i === index}
              aria-label={`Banner ${i + 1}`}
              onClick={() => setIndex(i)}
              className={`h-1.5 rounded-full transition-all ${
                i === index ? 'w-5 bg-white' : 'w-1.5 bg-white/60'
              }`}
            />
          ))}
        </div>
      )}
    </div>
  )
}
