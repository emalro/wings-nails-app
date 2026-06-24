import React, { useState, useMemo, useEffect } from 'react'

export interface Column<T> {
  key: string
  label: string
  sortable?: boolean
  filterable?: boolean
  render?: (value: any, row: T) => React.ReactNode
  sortFn?: (a: T, b: T) => number
  /** Custom filter value for computed columns (e.g., arrays rendered as strings) */
  filterValue?: (item: T) => string
}

interface DataTableProps<T> {
  columns: Column<T>[]
  data: T[]
  keyExtractor: (item: T) => string | number
  isLoading?: boolean
  error?: string | null
  emptyMessage?: string
  searchPlaceholder?: string
  pageSize?: number
}

export default function DataTable<T>({
  columns,
  data,
  keyExtractor,
  isLoading = false,
  error = null,
  emptyMessage = 'No data found',
  searchPlaceholder = 'Search...',
  pageSize = 20,
}: DataTableProps<T>) {
  const [sortKey, setSortKey] = useState<string | null>(null)
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')
  const [filter, setFilter] = useState('')
  const [page, setPage] = useState(0)

  const hasFilterable = columns.some((c) => c.filterable)

  // Reset page when filter changes
  useEffect(() => {
    setPage(0)
  }, [filter])

  // Sorting
  const sorted = useMemo(() => {
    if (!sortKey || !data) return data || []
    const col = columns.find((c) => c.key === sortKey)
    if (!col) return data
    return [...data].sort((a, b) => {
      if (col.sortFn) return sortDir === 'asc' ? col.sortFn(a, b) : col.sortFn(b, a)
      const aVal = (a as any)[col.key]
      const bVal = (b as any)[col.key]
      if (aVal == null && bVal == null) return 0
      if (aVal == null) return 1
      if (bVal == null) return -1
      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return sortDir === 'asc' ? aVal - bVal : bVal - aVal
      }
      const aStr = String(aVal)
      const bStr = String(bVal)
      return sortDir === 'asc' ? aStr.localeCompare(bStr) : bStr.localeCompare(aStr)
    })
  }, [data, sortKey, sortDir, columns])

  // Filtering
  const filtered = useMemo(() => {
    if (!filter) return sorted
    const q = filter.toLowerCase()
    return sorted.filter((item) =>
      columns.some((col) => {
        if (!col.filterable) return false
        const raw = col.filterValue ? col.filterValue(item) : (item as any)[col.key]
        if (raw == null) return false
        return String(raw).toLowerCase().includes(q)
      }),
    )
  }, [sorted, filter, columns])

  // Pagination
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize))
  const paged = useMemo(() => {
    const start = page * pageSize
    return filtered.slice(start, start + pageSize)
  }, [filtered, page, pageSize])

  function handleSort(key: string) {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(key)
      setSortDir('asc')
    }
  }

  function renderCell(col: Column<T>, item: T) {
    if (col.render) return col.render((item as any)[col.key], item)
    const val = (item as any)[col.key]
    if (val == null || val === '') return <span className="data-table-null">&mdash;</span>
    if (Array.isArray(val)) return String(val)
    return String(val)
  }

  // ── Loading ──
  if (isLoading) {
    return (
      <div className="data-table-wrapper">
        {hasFilterable && <div className="data-table-search-placeholder" />}
        <div className="data-table-desktop">
          <table className="data-table">
            <thead>
              <tr>
                {columns.map((col) => (
                  <th key={col.key}>{col.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: 5 }).map((_, i) => (
                <tr key={i}>
                  {columns.map((col) => (
                    <td key={col.key}>
                      <div className="data-table-skeleton" />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="data-table-mobile">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="data-card data-card-skeleton">
              {columns.map((col) => (
                <div key={col.key} className="data-card-row">
                  <span className="data-card-label">{col.label}</span>
                  <div className="data-table-skeleton" />
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    )
  }

  // ── Error ──
  if (error) {
    return (
      <div className="data-table-wrapper">
        <div className="data-table-error">{error}</div>
      </div>
    )
  }

  // ── Empty ──
  if (filtered.length === 0) {
    return (
      <div className="data-table-wrapper">
        {hasFilterable && (
          <div className="data-table-search">
            <input
              type="text"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder={searchPlaceholder}
            />
          </div>
        )}
        <div className="data-table-empty">
          <p>{emptyMessage}</p>
          {filter && (
            <button className="data-table-clear-filter" onClick={() => setFilter('')}>
              Limpiar filtro
            </button>
          )}
        </div>
      </div>
    )
  }

  // ── Table ──
  return (
    <div className="data-table-wrapper">
      {hasFilterable && (
        <div className="data-table-search">
          <input
            type="text"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder={searchPlaceholder}
          />
        </div>
      )}

      <div className="data-table-desktop">
        <table className="data-table">
          <thead>
            <tr>
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={col.sortable ? 'data-table-sortable' : ''}
                  onClick={col.sortable ? () => handleSort(col.key) : undefined}
                  role={col.sortable ? 'columnheader button' : 'columnheader'}
                  tabIndex={col.sortable ? 0 : undefined}
                  onKeyDown={
                    col.sortable
                      ? (e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault()
                            handleSort(col.key)
                          }
                        }
                      : undefined
                  }
                >
                  {col.label}
                  {sortKey === col.key && (
                    <span className="data-table-sort-icon">{sortDir === 'asc' ? ' \u25B2' : ' \u25BC'}</span>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {paged.map((item) => (
              <tr key={keyExtractor(item)}>
                {columns.map((col) => (
                  <td key={col.key}>{renderCell(col, item)}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="data-table-mobile">
        {paged.map((item) => (
          <div key={keyExtractor(item)} className="data-card">
            {columns.map((col) => (
              <div key={col.key} className="data-card-row">
                <span className="data-card-label">{col.label}</span>
                <span className="data-card-value">{renderCell(col, item)}</span>
              </div>
            ))}
          </div>
        ))}
      </div>

      {totalPages > 1 && (
        <div className="data-table-pagination">
          <button type="button" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>
            &lsaquo;
          </button>
          <span>
            Página {page + 1} de {totalPages}
          </span>
          <button type="button" disabled={page >= totalPages - 1} onClick={() => setPage((p) => p + 1)}>
            &rsaquo;
          </button>
        </div>
      )}
    </div>
  )
}
