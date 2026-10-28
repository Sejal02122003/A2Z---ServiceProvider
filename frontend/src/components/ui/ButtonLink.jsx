import { Link } from 'react-router-dom'

export function ButtonLink({
  href,
  children,
  variant = 'primary',
  className = '',
  ...rest
}) {
  const base =
    'inline-flex items-center justify-center gap-2 rounded-2xl px-5 py-3 text-sm font-semibold transition-all duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#015F6C] active:scale-[0.98]'

  const styles = {
    primary:
      'bg-[#015F6C] text-white shadow-[0_12px_36px_-12px_rgba(1,95,108,0.5)] hover:bg-[#014b55]',
    secondary:
      'border border-[#E2E8EA] bg-[#E5F9FA] text-[#015F6C] shadow-sm hover:bg-[#d6f4f6]',
    outline:
      'border border-[#015F6C] bg-white text-[#015F6C] shadow-sm hover:bg-[#E5F9FA]',
    ghost: 'text-[#4D5960] bg-transparent hover:bg-[#F5FAFA] hover:text-[#263238]',
  }

  const combinedClassName = `${base} ${styles[variant]} ${className}`

  if (href.startsWith('http') || href.startsWith('#')) {
    return (
      <a href={href} className={combinedClassName} {...rest}>
        {children}
      </a>
    )
  }

  return (
    <Link to={href} className={combinedClassName} {...rest}>
      {children}
    </Link>
  )
}
