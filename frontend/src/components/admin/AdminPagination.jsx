import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react'

const DEFAULT_PAGE_SIZES = [10, 20, 50]

/** Page numbers with gaps, e.g. 1 … 4 [5] 6 … 20 */
function getPageItems(current, totalPages) {
  if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1)
  const items = [1]
  const start = Math.max(2, current - 1)
  const end = Math.min(totalPages - 1, current + 1)
  if (start > 2) items.push('left-gap')
  for (let n = start; n <= end; n += 1) items.push(n)
  if (end < totalPages - 1) items.push('right-gap')
  items.push(totalPages)
  return items
}

const navBtn =
  'rounded-lg border border-slate-200 bg-white p-1.5 text-slate-700 hover:bg-slate-100 disabled:opacity-40 disabled:hover:bg-white'

/**
 * Reusable pagination bar for admin lists: record range, rows-per-page, first/prev/numbers/next/last.
 * Always shown when there is at least one record. Controlled via page / pageSize props.
 */
export function AdminPagination({
  page,
  pageSize,
  total,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = DEFAULT_PAGE_SIZES,
  itemLabel = 'records',
}) {
  if (!total || total < 1) return null
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const current = Math.min(Math.max(1, page), totalPages)
  const from = (current - 1) * pageSize + 1
  const to = Math.min(current * pageSize, total)
  const go = (n) => onPageChange(Math.min(totalPages, Math.max(1, n)))

  return (
    <div className="flex flex-col gap-3 border-t border-slate-100 bg-slate-50 px-4 py-3 text-xs font-semibold text-slate-600 md:flex-row md:items-center md:justify-between">
      <div className="flex flex-wrap items-center gap-3">
        <span>
          Showing {from}–{to} of {total} {itemLabel}
        </span>
        {onPageSizeChange ? (
          <label className="flex items-center gap-1.5">
            <span className="text-slate-500">Rows</span>
            <select
              value={pageSize}
              onChange={(e) => onPageSizeChange(Number(e.target.value))}
              className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-bold text-slate-700 outline-none focus:border-brand"
            >
              {pageSizeOptions.map((n) => (
                <option key={n} value={n}>{n}</option>
              ))}
            </select>
          </label>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        <button type="button" className={navBtn} disabled={current <= 1} onClick={() => go(1)} aria-label="First page">
          <ChevronsLeft className="h-4 w-4" />
        </button>
        <button type="button" className={navBtn} disabled={current <= 1} onClick={() => go(current - 1)} aria-label="Previous page">
          <ChevronLeft className="h-4 w-4" />
        </button>

        {getPageItems(current, totalPages).map((item) =>
          typeof item === 'number' ? (
            <button
              key={item}
              type="button"
              onClick={() => go(item)}
              aria-current={item === current ? 'page' : undefined}
              className={`min-w-8 rounded-lg border px-2 py-1.5 text-xs font-bold transition ${
                item === current
                  ? 'border-brand bg-brand text-white'
                  : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-100'
              }`}
            >
              {item}
            </button>
          ) : (
            <span key={item} className="px-1 text-slate-400">…</span>
          ),
        )}

        <button type="button" className={navBtn} disabled={current >= totalPages} onClick={() => go(current + 1)} aria-label="Next page">
          <ChevronRight className="h-4 w-4" />
        </button>
        <button type="button" className={navBtn} disabled={current >= totalPages} onClick={() => go(totalPages)} aria-label="Last page">
          <ChevronsRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}
