import React from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { ChevronRight, Trash2 } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { useBookingCart } from '../../../context/BookingCartContext.jsx'

export function FloatingCartBar() {
  const navigate = useNavigate()
  const { cartCount, cartSubtotal, clearCart } = useBookingCart()

  if (typeof document === 'undefined') return null

  return createPortal(
    <AnimatePresence>
      {cartCount > 0 && (
        <motion.div
          key="floating-cart-bar-popup"
          initial={{ y: 90, opacity: 0, scale: 0.95 }}
          animate={{ y: 0, opacity: 1, scale: 1 }}
          exit={{ y: 90, opacity: 0, scale: 0.95 }}
          transition={{ type: 'spring', damping: 24, stiffness: 300 }}
          className="fixed bottom-4 inset-x-3 sm:inset-x-4 z-[999] max-w-md mx-auto pointer-events-auto"
        >
          <div className="flex items-center justify-between rounded-2xl bg-white px-4 py-3 shadow-[0_12px_40px_rgba(0,0,0,0.18),0_4px_12px_rgba(0,0,0,0.08)] border border-slate-200/90 backdrop-blur-md">
            {/* Left: Cart Icon + Item Count */}
            <div className="flex items-center gap-2.5 min-w-0 pr-2">
              <div className="shrink-0 text-brand">
                <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
                  <path d="M7 18c-1.1 0-1.99.9-1.99 2S5.9 22 7 22s2-.9 2-2-.9-2-2-2zM1 2v2h2l3.6 7.59-1.35 2.45c-.16.28-.25.61-.25.96 0 1.1.9 2 2 2h12v-2H7.42c-.14 0-.25-.11-.25-.25l.03-.12.9-1.63h7.45c.75 0 1.41-.41 1.75-1.03l3.58-6.49c.08-.14.12-.31.12-.48 0-.55-.45-1-1-1H5.21l-.94-2H1zm16 16c-1.1 0-1.99.9-1.99 2s.89 2 1.99 2 2-.9 2-2-.9-2-2-2z" />
                </svg>
              </div>
              <div className="text-[13px] sm:text-sm truncate select-none">
                <strong className="font-extrabold text-slate-900">
                  {cartCount} {cartCount === 1 ? 'item' : 'items'}
                </strong>
                <span className="text-slate-500 font-normal ml-1">in cart</span>
              </div>
            </div>

            {/* Right: Pill Button + Trash Icon */}
            <div className="flex items-center gap-2.5 shrink-0">
              <button
                type="button"
                onClick={() => navigate('/app/cart')}
                className="rounded-full bg-brand hover:bg-brand/90 active:scale-95 transition text-white px-4 py-2 text-xs sm:text-sm font-bold flex items-center gap-1 shadow-sm shadow-brand/20 cursor-pointer"
              >
                <span className="font-mono font-bold tracking-tight">
                  ₹ {Number(cartSubtotal).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
                <ChevronRight className="h-4 w-4 stroke-[3]" />
              </button>

              <button
                type="button"
                onClick={clearCart}
                title="Clear cart"
                className="p-1.5 -mr-1 text-slate-400 hover:text-rose-600 active:scale-90 transition cursor-pointer rounded-lg hover:bg-slate-100"
              >
                <Trash2 className="h-5 w-5 stroke-[1.8]" />
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  )
}
export default FloatingCartBar
