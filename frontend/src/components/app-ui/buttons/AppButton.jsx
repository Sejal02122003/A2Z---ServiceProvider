import { Loader2 } from 'lucide-react'

const variants = {
  primary:
    'text-white shadow-[0_14px_44px_-14px_rgba(0,43,92,0.5)] bg-linear-to-r from-brand-bright to-brand hover:brightness-[1.06] disabled:shadow-none',
  secondary:
    'border border-slate-200/90 bg-white/90 text-slate-800 shadow-sm backdrop-blur-sm hover:border-brand/25 hover:bg-white',
  ghost: 'border border-transparent bg-transparent text-slate-700 hover:bg-slate-50 hover:border-slate-200/80',
  danger:
    'border border-rose-200/90 bg-rose-50 text-rose-800 shadow-sm hover:bg-rose-50/90',
}

const sizes = {
  sm: 'rounded-xl px-3.5 py-2 text-xs font-semibold gap-1.5',
  md: 'rounded-2xl px-5 py-3.5 text-sm font-semibold gap-2',
  lg: 'rounded-2xl px-6 py-4 text-base font-semibold gap-2',
}

const focus =
  'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand'

/**
 * @param {object} props
 * @param {'primary'|'secondary'|'ghost'|'danger'} [props.variant='primary']
 * @param {'sm'|'md'|'lg'} [props.size='md']
 * @param {boolean} [props.fullWidth=true]
 * @param {boolean} [props.loading]
 * @param {import('react').ElementType} [props.as]
 */
export function AppButton({
  as: Comp = 'button',
  variant = 'primary',
  size = 'md',
  fullWidth = true,
  loading = false,
  className = '',
  children,
  disabled,
  ...rest
}) {
  const isDisabled = disabled || loading
  const width = fullWidth ? 'inline-flex w-full' : 'inline-flex'
  const base = `${width} items-center justify-center transition duration-200 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-45 ${focus} ${variants[variant] || variants.primary} ${sizes[size] || sizes.md}`

  return (
    <Comp className={`${base} ${className}`} disabled={isDisabled} {...rest}>
      {loading ? <Loader2 className="h-[1.1em] w-[1.1em] shrink-0 animate-spin" aria-hidden /> : null}
      {children}
    </Comp>
  )
}
//this is cmnt 