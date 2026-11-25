import { useEffect, useRef, useState } from 'react'

/** "HH:mm" (24h) -> { h: '9', m: '05', period: 'AM' } */
function parse24(value) {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value || '')
  if (!match) return { h: '', m: '', period: 'AM' }
  const hh = Number(match[1])
  if (hh > 23) return { h: '', m: '', period: 'AM' }
  const period = hh >= 12 ? 'PM' : 'AM'
  const h12 = hh % 12 === 0 ? 12 : hh % 12
  return { h: String(h12), m: match[2], period }
}

/** hour (1-12), minute (0-59), period -> "HH:mm" (24h), or '' while incomplete / invalid */
function to24(h, m, period) {
  if (h === '' || m === '') return ''
  const hh = Number(h)
  const mm = Number(m)
  if (!Number.isInteger(hh) || !Number.isInteger(mm) || hh < 1 || hh > 12 || mm < 0 || mm > 59) return ''
  let h24 = hh % 12
  if (period === 'PM') h24 += 12
  return `${String(h24).padStart(2, '0')}:${String(mm).padStart(2, '0')}`
}

const boxClass =
  'w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-center text-sm font-semibold text-black outline-none focus:border-brand focus:ring-1'

/**
 * Time field you can TYPE into (hour, minute, AM/PM) - the native time picker does not accept typed
 * numbers on many phones / WebViews. Calls onChange with a 24h "HH:mm" string (or '' if incomplete).
 */
export function TimeInput12h({ id, value, onChange, hasError = false }) {
  const initial = parse24(value)
  const [h, setH] = useState(initial.h)
  const [m, setM] = useState(initial.m)
  const [period, setPeriod] = useState(initial.period)
  const minuteRef = useRef(null)

  // Follow outside changes (e.g. a restored draft) without fighting what the user is typing
  useEffect(() => {
    if ((value || '') === to24(h, m, period)) return
    const next = parse24(value)
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setH(next.h)
    setM(next.m)
    setPeriod(next.period)
    // only react to the outside value
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value])

  function commit(nextH, nextM, nextPeriod) {
    const out = to24(nextH, nextM, nextPeriod)
    if (out !== (value || '')) onChange(out)
  }

  function onHourChange(e) {
    let digits = e.target.value.replace(/\D/g, '').slice(0, 2)
    // typing 2-9 can only be a one-digit hour: jump to minutes
    const jump = digits.length === 2 || (digits.length === 1 && Number(digits) > 1)
    if (digits.length === 2 && Number(digits) > 12) digits = digits[0]
    setH(digits)
    commit(digits, m, period)
    if (jump && digits.length >= 1 && Number(digits) >= 1) minuteRef.current?.focus()
  }

  function onMinuteChange(e) {
    const digits = e.target.value.replace(/\D/g, '').slice(0, 2)
    if (digits.length === 2 && Number(digits) > 59) return
    setM(digits)
    commit(h, digits, period)
  }

  function onMinuteBlur() {
    // "5" -> "05"
    if (m.length === 1) {
      const padded = m.padStart(2, '0')
      setM(padded)
      commit(h, padded, period)
    }
  }

  function pickPeriod(next) {
    setPeriod(next)
    commit(h, m, next)
  }

  const invalid = hasError || (h !== '' && (Number(h) < 1 || Number(h) > 12))

  return (
    <div className="flex items-center gap-2" id={id}>
      <input
        type="text"
        inputMode="numeric"
        autoComplete="off"
        placeholder="hh"
        aria-label="Hour"
        maxLength={2}
        value={h}
        onChange={onHourChange}
        onFocus={(e) => e.target.select()}
        className={`${boxClass} ${invalid ? 'border-rose-300' : ''}`}
      />
      <span className="text-lg font-black text-slate-400" aria-hidden>:</span>
      <input
        ref={minuteRef}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        placeholder="mm"
        aria-label="Minute"
        maxLength={2}
        value={m}
        onChange={onMinuteChange}
        onBlur={onMinuteBlur}
        onFocus={(e) => e.target.select()}
        className={`${boxClass} ${invalid ? 'border-rose-300' : ''}`}
      />
      <div className="flex shrink-0 overflow-hidden rounded-xl border border-slate-200 text-xs font-extrabold">
        {['AM', 'PM'].map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => pickPeriod(p)}
            aria-pressed={period === p}
            className={`px-3 py-3 transition ${period === p ? 'bg-brand text-white' : 'bg-white text-slate-600 hover:bg-slate-50'}`}
          >
            {p}
          </button>
        ))}
      </div>
    </div>
  )
}
