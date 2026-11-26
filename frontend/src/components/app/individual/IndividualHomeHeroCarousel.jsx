import { useEffect, useState } from 'react'
import { ArrowRight } from 'lucide-react'
import { fetchActiveBanners } from '../../../api/bannersApi.js'
import { useSwipe } from '../../../hooks/useSwipe.js'

export function IndividualHomeHeroCarousel({ onBook }) {
  const [index, setIndex] = useState(0)
  const [banners, setBanners] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    fetchActiveBanners()
      .then((res) => {
        if (!cancelled) {
          setBanners(res.data?.banners ?? [])
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (banners.length <= 1) return
    const id = window.setInterval(() => {
      setIndex((i) => (i + 1) % banners.length)
    }, 5000)
    return () => window.clearInterval(id)
  }, [banners.length])

  const swipe = useSwipe({
    onNext: () => setIndex((i) => (banners.length ? (i + 1) % banners.length : 0)),
    onPrev: () => setIndex((i) => (banners.length ? (i - 1 + banners.length) % banners.length : 0)),
  })

  if (loading) {
    return (
      <section className="mb-1 animate-pulse">
        <article className="lc-home-hero-slide bg-slate-200 !min-h-0 aspect-[21/9]" />
      </section>
    )
  }

  if (banners.length === 0) {
    return null
  }

  const slide = banners[index] || banners[0]

  return (
    <section aria-label="Offers" className="mb-1">
      <article
        {...swipe}
        className="lc-home-hero-slide !min-h-0 !bg-transparent aspect-[21/9] relative overflow-hidden rounded-[1.25rem] select-none"
      >
        {slide.mediaType === 'video' ? (
          <video
            key={slide._id}
            src={slide.imageUrl}
            className="w-full h-full object-cover shadow-sm"
            autoPlay
            loop
            muted
            playsInline
          />
        ) : (
          <img
            key={slide._id}
            src={slide.imageUrl}
            alt=""
            className="w-full h-full object-fill shadow-sm"
            loading="lazy"
            decoding="async"
          />
        )}
      </article>

      {banners.length > 1 && (
        <div className="lc-home-hero-dots" role="tablist" aria-label="Promo slides">
          {banners.map((s, i) => (
            <button
              key={s._id}
              type="button"
              role="tab"
              aria-selected={i === index}
              aria-label={`Slide ${i + 1}`}
              className="lc-home-hero-dot"
              data-active={i === index ? 'true' : 'false'}
              onClick={() => setIndex(i)}
            />
          ))}
        </div>
      )}
    </section>
  )
}
