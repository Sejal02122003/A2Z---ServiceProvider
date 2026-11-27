import { useState } from 'react'
import { ChevronDown } from 'lucide-react'

/**
 * A text input with a dropdown of suggestions: pick one or type any other value.
 * `options` are `{ value, label?, hint? }`; `onSelect` receives the picked option.
 */
export function ComboInput({ value, onChange, onSelect, options, className = '', ...inputProps }) {
  const [open, setOpen] = useState(false)
  // Show every option until the user types, so a prefilled value doesn't hide the rest
  const [typed, setTyped] = useState(false)
  const [active, setActive] = useState(-1)

  const query = typed ? String(value).trim().toLowerCase() : ''
  const visible = query ? options.filter((o) => String(o.value).toLowerCase().includes(query)) : options
  const showList = open && visible.length > 0

  const close = () => {
    setOpen(false)
    setTyped(false)
    setActive(-1)
  }

  const choose = (option) => {
    onChange(String(option.value))
    onSelect?.(option)
    close()
  }

  const handleKeyDown = (e) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault()
      if (!showList) return setOpen(true)
      const step = e.key === 'ArrowDown' ? 1 : -1
      setActive((i) => (i < 0 && step < 0 ? visible.length - 1 : (i + step + visible.length) % visible.length))
    } else if (e.key === 'Enter' && showList && visible[active]) {
      e.preventDefault()
      choose(visible[active])
    } else if (e.key === 'Escape' && showList) {
      e.preventDefault()
      close()
    }
  }

  return (
    <div className="relative">
      <input
        {...inputProps}
        autoComplete="off"
        value={value}
        onChange={(e) => {
          onChange(e.target.value)
          setOpen(true)
          setTyped(true)
          setActive(-1)
        }}
        onFocus={() => setOpen(true)}
        onClick={() => setOpen(true)}
        onBlur={close}
        onKeyDown={handleKeyDown}
        className={`${className} pr-8`}
      />
      <button
        type="button"
        tabIndex={-1}
        aria-label="Show options"
        onMouseDown={(e) => e.preventDefault()}
        onClick={(e) => {
          if (open) return close()
          e.currentTarget.previousElementSibling.focus()
          setOpen(true)
        }}
        className="absolute inset-y-0 right-0 mt-1 flex items-center px-2 text-slate-400 hover:text-slate-600"
      >
        <ChevronDown className={`h-4 w-4 transition ${showList ? 'rotate-180' : ''}`} />
      </button>

      {showList && (
        <ul
          // Keeps focus on the input while clicking or scrolling the list
          onMouseDown={(e) => e.preventDefault()}
          className="absolute left-0 right-0 z-20 mt-1 max-h-52 overflow-y-auto rounded-xl border border-slate-200 bg-white py-1 shadow-xl"
        >
          {visible.map((option, i) => (
            <li key={option.value}>
              <button
                type="button"
                tabIndex={-1}
                ref={i === active ? (el) => el?.scrollIntoView({ block: 'nearest' }) : undefined}
                onClick={() => choose(option)}
                className={`flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-xs hover:bg-blue-50 ${
                  i === active ? 'bg-blue-50' : ''
                } ${String(option.value) === String(value) ? 'font-bold text-blue-700' : 'font-semibold text-slate-700'}`}
              >
                <span>{option.label ?? option.value}</span>
                {option.hint && <span className="shrink-0 text-[10px] font-medium text-slate-400">{option.hint}</span>}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
