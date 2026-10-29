import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, useReducedMotion } from 'framer-motion'
import { ChevronRight } from 'lucide-react'
import { fetchAppMartBanners } from '../../api/buildmartApi.js'

export function BuildMartHeroCarousel() {
  const navigate = useNavigate()
  const reduce = useReducedMotion()
  const [index, setIndex] = useState(0)
  const [banners, setBanners] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchAppMartBanners()
      .then((res) => {
        const data = res?.data ?? res ?? []
        // Only show active banners
        setBanners(data.filter((b) => b.active))
      })
      .catch((err) => console.error('Failed to load banners:', err))
      .finally(() => setLoading(false))
  }, [])

  const next = useCallback(() => {
    if (banners.length > 0) {
      setIndex((i) => (i + 1) % banners.length)
    }
  }, [banners.length])

  useEffect(() => {
    if (reduce || banners.length <= 1) return undefined
    const t = window.setInterval(next, 4800)
    return () => window.clearInterval(t)
  }, [next, reduce, banners.length])

  if (loading) {
    return (
      <div className="min-h-[11.5rem] animate-pulse rounded-3xl bg-slate-200/50 shadow-sm" />
    )
  }

  if (banners.length === 0) {
    return null
  }

  const banner = banners[index] || banners[0]

  return (
    <section className="space-y-2" aria-label="Offers and deals">
      <div className="relative overflow-hidden rounded-3xl shadow-[0_20px_50px_-28px_rgba(232,93,42,0.55)] ring-1 ring-orange-200/60">
        <motion.div
          key={banner._id || banner.id}
          className="relative min-h-[11.5rem]"
          initial={reduce ? false : { opacity: 0, x: 24 }}
          animate={{ opacity: 1, x: 0 }}
          exit={reduce ? undefined : { opacity: 0, x: -24 }}
          transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
        >
          <img
            src={banner.imageUrl || banner.image}
            alt={banner.title || ''}
            className="absolute inset-0 h-full w-full object-cover"
            loading="lazy"
          />
          <motion.div
            className={`absolute inset-0 bg-gradient-to-br ${banner.gradient || 'from-stone-800/90 via-orange-900/75 to-stone-950/95'}`}
            initial={false}
            animate={{ opacity: 0.92 }}
          />
          <motion.div
            className="pointer-events-none absolute -right-8 top-8 h-32 w-32 rounded-full bg-orange-400/30 blur-3xl"
            animate={reduce ? undefined : { scale: [1, 1.15, 1], opacity: [0.4, 0.7, 0.4] }}
            transition={{ duration: 3.5, repeat: Infinity, ease: 'easeInOut' }}
          />

          <motion.div
            className="relative flex min-h-[11.5rem] flex-col justify-end p-5 text-white"
            initial={reduce ? false : { opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.08, duration: 0.35 }}
          >
            <span className="inline-flex w-fit rounded-full bg-white/15 px-3 py-1 text-[10px] font-black uppercase tracking-wider ring-1 ring-white/25 backdrop-blur-sm">
              BuildMart
            </span>
            <h2 className="mt-2 text-xl font-extrabold tracking-tight drop-shadow-sm">{banner.title}</h2>
            <p className="mt-1 max-w-[18rem] text-sm font-medium text-white/88">{banner.subtitle}</p>
            {banner.cta && (
              <button
                type="button"
                onClick={() =>
                  navigate(`/user/buildmart?category=${encodeURIComponent(banner.categoryId || '')}`)
                }
                className="mt-4 inline-flex w-fit items-center gap-2 rounded-2xl bg-white px-4 py-2.5 text-sm font-extrabold text-orange-700 shadow-lg transition hover:brightness-105 active:scale-[0.99]"
              >
                {banner.cta}
                <ChevronRight className="h-4 w-4" aria-hidden />
              </button>
            )}
          </motion.div>
        </motion.div>

        <motion.div
          className="pointer-events-none absolute inset-0 buildmart-card-shine opacity-30"
          aria-hidden
        />
      </div>

      <div
        className="flex justify-center gap-1.5"
        role="tablist"
        aria-label="Banner slides"
      >
        {banners.map((b, i) => (
          <button
            key={b._id || b.id}
            type="button"
            role="tab"
            aria-selected={i === index}
            aria-label={b.title}
            onClick={() => setIndex(i)}
            className={`h-1.5 rounded-full transition-all duration-300 ${
              i === index ? 'w-6 bg-bm-orange' : 'w-1.5 bg-slate-300'
            }`}
          />
        ))}
      </div>
    </section>
  )
}
