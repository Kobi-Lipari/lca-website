// src/components/FilterDropdown.tsx
//
// Compact single-select filter, extracted from TournamentsPage's local
// Dropdown so ClubsPage can use it too. Always shows the selected option's
// label (per K: one button showing the current value, expandable to change
// it — replaces the messy pill rows). `on` picks the surface: 'navy' for
// hero bars, 'light' for light filter bars.

import { useEffect, useRef, useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface FilterOption<T extends string> {
  value: T
  label: string
}

export function FilterDropdown<T extends string>({
  value,
  options,
  onChange,
  on = 'light',
  className,
}: {
  value: T
  options: FilterOption<T>[]
  onChange: (v: T) => void
  on?: 'navy' | 'light'
  className?: string
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const isActive = value !== options[0]?.value
  const current = options.find((o) => o.value === value)

  useEffect(() => {
    function handle(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [])

  const triggerClass =
    on === 'navy'
      ? isActive
        ? 'border-[#c8a94a]/50 bg-[#c8a94a]/15 text-[#f0d07a]'
        : 'border-white/15 bg-white/6 text-white/60 hover:border-white/25 hover:text-white/80'
      : isActive
      ? 'border-[#c8a94a]/60 bg-[#c8a94a]/10 text-[#7a5c00]'
      : 'border-border bg-background text-muted-foreground hover:border-[#1a2744]/40 hover:text-foreground'

  return (
    <div ref={ref} className={cn('relative', className)}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={cn(
          'flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-[11px] font-medium transition-colors',
          triggerClass,
        )}
      >
        {current?.label ?? '—'}
        <ChevronDown className={cn('size-3 transition-transform', open && 'rotate-180')} />
      </button>
      {open && (
        <div className="absolute right-0 top-full z-50 mt-1 max-h-72 min-w-[170px] overflow-y-auto rounded-lg border border-border bg-popover shadow-md">
          {options.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => { onChange(opt.value); setOpen(false) }}
              className={cn(
                'flex w-full items-center gap-2 px-3 py-2 text-left text-xs transition-colors hover:bg-muted/50',
                opt.value === value ? 'bg-[#c8a94a]/8 font-medium text-[#1a2744]' : 'text-muted-foreground',
              )}
            >
              <span className={cn(
                'size-3 flex-shrink-0 rounded-full border',
                opt.value === value ? 'border-[#c8a94a] bg-[#c8a94a]' : 'border-border',
              )} />
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}