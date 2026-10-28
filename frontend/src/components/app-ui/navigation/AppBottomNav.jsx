import { NavLink } from 'react-router-dom'
import { motion, useReducedMotion } from 'framer-motion'

/**
 * Bottom tab bar — solid surface, brand active states (no glass).
 * @param {{ items: { id: string, to: string, end?: boolean, label: string, icon: import('lucide-react').LucideIcon, premium?: boolean, center?: boolean }[] }} props
 */
export function AppBottomNav({ items }) {
  const reduce = useReducedMotion()

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-30 pointer-events-none px-3 sm:px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] print:hidden"
      aria-label="Bottom navigation"
    >
      <div className="pointer-events-auto mx-auto flex w-full max-w-lg items-stretch justify-around rounded-3xl border border-[#E2E8EA] bg-white/95 px-2 py-1.5 shadow-[0_10px_30px_-5px_rgba(0,0,0,0.12),0_4px_12px_rgba(0,0,0,0.06)] backdrop-blur-md">
        {items.map(({ id, to, end, label, icon: Icon, premium, center }) => (
          <NavLink
            key={`${id}-${to}`}
            to={to}
            end={Boolean(end)}
            className={`relative flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-xl py-1.5 outline-none transition active:scale-95 ${
              center ? '-mt-3 max-w-[4.25rem] flex-[1.15]' : ''
            }`}
          >
            {({ isActive }) =>
              center ? (
                <>
                  <span
                    className={`flex h-12 w-12 items-center justify-center rounded-2xl shadow-md transition ${
                      isActive
                        ? 'bg-[#015F6C] text-white shadow-[#015F6C]/30'
                        : 'border border-[#E2E8EA] bg-white text-[#015F6C]'
                    }`}
                  >
                    <Icon className="h-6 w-6" strokeWidth={2.25} aria-hidden />
                  </span>
                  <span
                    className={`truncate px-0.5 text-[10px] font-bold ${isActive ? 'text-[#015F6C]' : 'text-[#64747B]'}`}
                  >
                    {label}
                  </span>
                </>
              ) : premium ? (
                <>
                  <span className="relative flex h-9 w-9 items-center justify-center">
                    {isActive && !reduce ? (
                      <motion.span
                        layoutId="app-tab-bm"
                        className="absolute inset-0 rounded-xl bg-bm-terracotta/15 ring-2 ring-bm-terracotta/30"
                        transition={{ type: 'spring', stiffness: 420, damping: 34 }}
                      />
                    ) : null}
                    {isActive && reduce ? (
                      <span className="absolute inset-0 rounded-xl bg-bm-terracotta/15 ring-2 ring-bm-terracotta/30" />
                    ) : null}
                    <Icon
                      className={`relative z-10 h-[22px] w-[22px] ${isActive ? 'text-bm-terracotta' : 'text-[#64747B]'}`}
                      aria-hidden
                    />
                  </span>
                  <span
                    className={`truncate px-0.5 text-[10px] font-bold ${isActive ? 'text-bm-terracotta' : 'text-[#64747B]'}`}
                  >
                    {label}
                  </span>
                </>
              ) : (
                <>
                  <span className="relative flex h-9 w-9 items-center justify-center">
                    {isActive && !reduce ? (
                      <motion.span
                        layoutId="app-tab-pill"
                        className="absolute inset-0 rounded-xl bg-[#E5F9FA]"
                        transition={{ type: 'spring', stiffness: 420, damping: 34 }}
                      />
                    ) : null}
                    {isActive && reduce ? (
                      <span className="absolute inset-0 rounded-xl bg-[#E5F9FA]" />
                    ) : null}
                    <Icon
                      className={`relative z-10 h-[22px] w-[22px] ${isActive ? 'text-[#015F6C]' : 'text-[#64747B]'}`}
                      strokeWidth={isActive ? 2.25 : 2}
                      aria-hidden
                    />
                  </span>
                  <span
                    className={`truncate px-0.5 text-[10px] font-bold ${isActive ? 'text-[#015F6C]' : 'text-[#64747B]'}`}
                  >
                    {label}
                  </span>
                  {isActive ? (
                    <span className="h-0.5 w-4 rounded-full bg-[#01C7D0]" aria-hidden />
                  ) : (
                    <span className="h-0.5 w-4" aria-hidden />
                  )}
                </>
              )
            }
          </NavLink>
        ))}
      </div>
    </nav>
  )
}
