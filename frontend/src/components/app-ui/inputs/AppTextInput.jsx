import { forwardRef } from 'react'

export const AppTextInput = forwardRef(function AppTextInput(
  { className = '', inputClassName = '', leftSlot, rightSlot, ...rest },
  ref,
) {
  return (
    <div
      className={`flex min-h-[2.75rem] items-center gap-2 rounded-2xl border border-[#E2E8EA] bg-white px-3 shadow-sm transition focus-within:border-[#015F6C] focus-within:ring-2 focus-within:ring-[#015F6C]/20 ${className}`}
    >
      {leftSlot ? <span className="shrink-0 text-[#64747B]">{leftSlot}</span> : null}
      <input
        ref={ref}
        className={`min-w-0 flex-1 bg-transparent py-2.5 text-sm font-medium text-[#263238] outline-none placeholder:text-[#64747B] focus:outline-none focus-visible:outline-none ${inputClassName}`}
        {...rest}
      />
      {rightSlot ? <span className="shrink-0 text-[#64747B]">{rightSlot}</span> : null}
    </div>
  )
})
