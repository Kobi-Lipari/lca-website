// A filter chip (Looks-3 Minimal tile, .t-chip): a toggle that turns one
// filter on or off, with an optional count of what it would show, and, when
// the filter can be taken away, a remove button named "Remove filter: <name>"
// (Tourn-Table-Final). The toggle and the remove button sit side by side in
// the chip, never one inside the other, so each is a control of its own for
// a keyboard and a screen reader, and the remove button is 24 by 24 pixels,
// the smallest target WCAG 2.2 allows.
//
// Every colour is a token, so the chip follows the look. A chip that is on
// takes the soon tag's tint and words with a gold-ink line, as the tile draws
// it, and a check mark, so its state shows by shape as well as by colour
// (today's navy chips are hard to tell apart in dark mode). Its count takes
// the chip's words then, since the muted ink on the gold tint falls below
// 4.5:1 with newLook off.
//
// A chip with no onPressedChange is a plain label, for a filter that is
// already applied and can only be removed. When a chip is removed, the list
// that draws it decides where the focus goes next.
import { Check, X } from "lucide-react"

import { cn } from "@/lib/utils"

interface FilterChipProps {
  /** The filter's name: what the chip shows, and what its remove button names. */
  label: string
  /** Whether the filter is on. */
  pressed?: boolean
  /** Makes the chip a toggle; called with the state it should take. */
  onPressedChange?: (pressed: boolean) => void
  /** How many results the filter gives, shown after its name. */
  count?: number
  /** Adds the remove button, and is called when it is pressed. */
  onRemove?: () => void
  className?: string
}

function FilterChip({ label, pressed = false, onPressedChange, count, onRemove, className }: FilterChipProps) {
  const removable = onRemove !== undefined
  const words = (
    <>
      {pressed && <Check className="size-3.5" aria-hidden="true" />}
      {label}
      {count !== undefined && (
        <>
          {" "}
          <span data-slot="filter-chip-count" className={cn("font-mono text-[11px] tabular-nums", !pressed && "text-ink-muted")}>
            {count}
          </span>
        </>
      )}
    </>
  )
  const inner = cn("inline-flex h-full items-center gap-1.5 rounded-sm", removable ? "pr-1 pl-3" : "px-3")

  return (
    <span
      data-slot="filter-chip"
      data-state={pressed ? "on" : "off"}
      role={removable ? "group" : undefined}
      aria-label={removable ? label : undefined}
      className={cn(
        "inline-flex h-8 items-center rounded-sm border text-[13px] font-medium whitespace-nowrap transition-colors",
        pressed ? "border-gold-ink bg-status-soon-tint text-status-soon" : "border-hairline bg-surface text-ink hover:border-field",
        className,
      )}
    >
      {onPressedChange ? (
        <button
          type="button"
          data-slot="filter-chip-toggle"
          aria-pressed={pressed}
          onClick={() => onPressedChange(!pressed)}
          className={cn(inner, "outline-none focus-visible:ring-3 focus-visible:ring-focus")}
        >
          {words}
        </button>
      ) : (
        <span data-slot="filter-chip-label" className={inner}>
          {words}
        </span>
      )}
      {removable && (
        <button
          type="button"
          data-slot="filter-chip-remove"
          aria-label={`Remove filter: ${label}`}
          onClick={onRemove}
          className="mr-1 inline-flex size-6 flex-none items-center justify-center rounded-sm outline-none hover:bg-surface-2 focus-visible:ring-3 focus-visible:ring-focus"
        >
          <X className="size-3.5" aria-hidden="true" />
        </button>
      )}
    </span>
  )
}

export { FilterChip }
