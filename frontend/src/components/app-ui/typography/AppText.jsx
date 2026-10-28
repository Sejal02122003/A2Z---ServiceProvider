const styles = {
  display: 'text-3xl font-extrabold tracking-tight text-[#263238]',
  title: 'text-lg font-extrabold tracking-tight text-[#263238]',
  subtitle: 'text-sm font-semibold text-[#015F6C]',
  body: 'text-sm font-medium leading-relaxed text-[#263238]',
  caption: 'text-xs font-medium text-[#64747B]',
  overline: 'text-[10px] font-bold uppercase tracking-wider text-[#64747B]',
}

export function AppText({ as: Comp = 'p', variant = 'body', className = '', children, ...rest }) {
  return <Comp className={`${styles[variant] || styles.body} ${className}`} {...rest}>{children}</Comp>
}
