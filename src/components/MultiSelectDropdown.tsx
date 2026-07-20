// src/components/MultiSelectDropdown.tsx
//
// Same collapsed-trigger-with-popover pattern as FilterDropdown, but for
// filters where more than one value can be picked at once (roles, clubs,
// membership statuses). FilterDropdown itself stays single-select — this is
// a sibling component, not a variant of it, since the interaction differs
// (checkable rows, stays open until you click away, no auto-close per pick).

import { useEffect, useRef, useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface MultiSelectOption {
  value: string
  label: string
}

export function MultiSelectDropdown({
  defaultLabel,
  options,
  selected,
  onChange,
  on = 'light',
  className,
}: {
  defaultLabel: string
  options: MultiSelectOption[]
  selected: string[]
  onChange: (values: string[]) => void
  on?: 'navy' | 'light'
  className?: string
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const isActive = selected.length > 0

  useEffect(() => {
    function handle(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [])

  function toggle(value: string) {
    onChange(selected.includes(value) ? selected.filter((v) => v !== value) : [...selected, value])
  }

  const triggerLabel =
    selected.length === 0
      ? defaultLabel
      : selected.length <= 2
        ? options.filter((o) => selected.includes(o.value)).map((o) => o.label).join(', ')
        : `${selected.length} selected`

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
          'flex max-w-[220px] items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-[11px] font-medium transition-colors',
          triggerClass,
        )}
      >
        <span className="truncate">{triggerLabel}</span>
        <ChevronDown className={cn('size-3 flex-shrink-0 transition-transform', open && 'rotate-180')} />
      </button>
      {open && (
        <div className="absolute left-0 top-full z-50 mt-1 max-h-72 min-w-[200px] overflow-y-auto rounded-lg border border-border bg-popover shadow-md">
          {options.map((opt) => {
            const checked = selected.includes(opt.value)
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => toggle(opt.value)}
                className={cn(
                  'flex w-full items-center gap-2 px-3 py-2 text-left text-xs transition-colors hover:bg-muted/50',
                  checked ? 'font-medium text-[#1a2744]' : 'text-muted-foreground',
                )}
              >
                <span className={cn(
                  'flex size-3.5 flex-shrink-0 items-center justify-center rounded border',
                  checked ? 'border-[#c8a94a] bg-[#c8a94a]' : 'border-border',
                )}>
                  {checked && <span className="size-1.5 rounded-sm bg-[#1a2744]" />}
                </span>
                {opt.label}
              </button>
            )
          })}
          {selected.length > 0 && (
            <button
              type="button"
              onClick={() => onChange([])}
              className="w-full border-t border-border px-3 py-1.5 text-left text-[11px] text-muted-foreground hover:text-foreground"
            >
              Clear
            </button>
          )}
        </div>
      )}
    </div>
  )
}