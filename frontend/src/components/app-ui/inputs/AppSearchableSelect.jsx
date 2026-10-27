import React, { useState, useRef, useEffect } from 'react'
import { ChevronDown, Search } from 'lucide-react'

export function AppSearchableSelect({
  value,
  onChange,
  options = [],
  placeholder = 'Select...',
  disabled = false,
  className = '',
  hideSearch = false,
}) {
  const [isOpen, setIsOpen] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const containerRef = useRef(null)

  const selectedOption = options.find((o) => o.value === value)

  const filteredOptions = options.filter((o) =>
    o.label.toLowerCase().includes(searchTerm.toLowerCase())
  )

  useEffect(() => {
    function handleClickOutside(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false)
        setSearchTerm('')
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen])

  return (
    <div className={`relative w-full ${className}`} ref={containerRef}>
      <div
        className={`flex w-full items-center justify-between rounded-2xl border border-slate-200/90 bg-white px-4 py-3 text-sm shadow-sm outline-none transition-colors ${
          disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer hover:border-brand/40'
        } ${isOpen ? 'ring-2 ring-brand/35 border-brand/50' : ''}`}
        onClick={() => {
          if (!disabled) setIsOpen(!isOpen)
        }}
      >
        <span className={selectedOption ? 'text-slate-900' : 'text-slate-500'}>
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        <ChevronDown className="h-4 w-4 text-slate-400" />
      </div>

      {isOpen && !disabled && (
        <div className="absolute z-50 mt-1 w-full rounded-2xl border border-slate-200 bg-white p-2 shadow-lg">
          {!hideSearch && (
            <div className="relative mb-2">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                autoFocus
                className="w-full rounded-xl bg-slate-50 py-2 pl-9 pr-4 text-sm outline-none border border-transparent focus:border-brand/30 focus:bg-white"
                placeholder="Search..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          )}
          <div className="max-h-48 overflow-y-auto">
            {filteredOptions.length > 0 ? (
              <ul className="space-y-1">
                {filteredOptions.map((opt, idx) => (
                  <li
                    key={opt.value || opt.id || opt.label || `opt-${idx}`}
                    className={`cursor-pointer rounded-xl px-3 py-2 text-sm transition-colors hover:bg-brand/5 ${
                      value === opt.value ? 'bg-brand/10 font-bold text-brand' : 'text-slate-700'
                    }`}
                    onClick={() => {
                      onChange(opt.value)
                      setIsOpen(false)
                      setSearchTerm('')
                    }}
                  >
                    {opt.label}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="py-3 text-center text-xs text-slate-500">No matches found</p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
