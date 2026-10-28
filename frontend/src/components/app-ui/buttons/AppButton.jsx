import { Loader2 } from 'lucide-react'

const variants = {
  primary:
    'text-white bg-[#015F6C] hover:bg-[#014b55] shadow-[0_10px_30px_-10px_rgba(1,95,108,0.5)] active:bg-[#013f48] disabled:bg-slate-200 disabled:text-slate-400 disabled:shadow-none',
  secondary:
    'border border-[#E2E8EA] bg-[#E5F9FA] text-[#015F6C] hover:bg-[#d6f4f6] shadow-sm active:bg-[#cbf0f2]',
  outline:
    'border border-[#015F6C] bg-white text-[#015F6C] hover:bg-[#E5F9FA] shadow-sm',
  ghost:
    'border border-transparent bg-transparent text-[#4D5960] hover:bg-[#F5FAFA] hover:text-[#263238]',
  danger:
    'border border-rose-200 bg-rose-50 text-[#DC2626] shadow-sm hover:bg-rose-100/90',
}

const sizes = {
  sm: 'rounded-xl px-3.5 py-2 text-xs font-semibold gap-1.5',
  md: 'rounded-2xl px-5 py-3.5 text-sm font-semibold gap-2',
  lg: 'rounded-2xl px-6 py-4 text-base font-semibold gap-2',
}

const focus =
  'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#015F6C]'

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