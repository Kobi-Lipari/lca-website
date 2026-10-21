import * as React from "react"

import { cn } from "@/lib/utils"

/**
 * How far a focus ring reaches outside its control, in pixels: the new
 * look's 2px gap and 2px line, which also covers today's 3px glow. A table
 * that pins its header or its first columns keeps a control the keyboard
 * moves to clear of them by this much more than they cover.
 */
const RING_REACH = 4

/**
 * The lines and grounds of a table that pins its header or its first
 * columns (WS01 step 27). Its row lines are drawn by the cells
 * (border-separate), so a line moves with a pinned cell instead of staying
 * where a collapsed table draws it. A row shows its tint through
 * --row-tint, which the row paints and each pinned cell lays over the opaque
 * surface, so a pinned cell matches its row and nothing that scrolls under it
 * shows through; the hover tint and a selected row's tint are set the same
 * way. On paper every cell is static, the pinned cells and a bounded box's
 * header too, so they print where they stand. That rule is important (the
 * trailing !), since the selectors that pin a cell or the header outrank it.
 */
const LINED = [
  "border-separate border-spacing-0",
  "[&_tr>*]:border-b [&_tbody>tr:last-child>*]:border-b-0",
  "[&_tr]:bg-(--row-tint) [&_tr]:transition-none",
  "[&_tbody>tr]:hover:[--row-tint:color-mix(in_oklab,var(--muted)_50%,transparent)]",
  "[&_tr[data-state=selected]]:[--row-tint:var(--muted)]",
  "print:[&_tr>*]:static!",
].join(" ")

/** The first column, pinned to the left edge on the opaque surface. */
const PIN_FIRST = [
  "[&_tr>:first-child]:sticky [&_tr>:first-child]:left-0 [&_tr>:first-child]:z-[1]",
  "[&_tr>:first-child]:bg-surface [&_tr>:first-child]:bg-[image:linear-gradient(var(--row-tint),var(--row-tint))]",
].join(" ")

/** The second column, pinned beside the first at the first's width (--table-pin). */
const PIN_SECOND = [
  "[&_tr>:nth-child(2)]:sticky [&_tr>:nth-child(2)]:left-(--table-pin) [&_tr>:nth-child(2)]:z-[1]",
  "[&_tr>:nth-child(2)]:bg-surface [&_tr>:nth-child(2)]:bg-[image:linear-gradient(var(--row-tint),var(--row-tint))]",
].join(" ")

/**
 * A line down the right edge of the last pinned column, where the rest
 * scrolls under it, in the border colour of the look the table sits in
 * (--border is set on every scope; --color-border is worked out once, on
 * the page's root).
 */
const PIN_EDGE = {
  1: "[&_tr>:first-child]:shadow-[inset_-1px_0_0_var(--border)]",
  2: "[&_tr>:nth-child(2)]:shadow-[inset_-1px_0_0_var(--border)]",
} as const

/** The header row held at the top of a bounded table, its corner above the pinned columns. */
const STICKY_HEAD = [
  "[&_thead_th]:sticky [&_thead_th]:top-0 [&_thead_th]:z-[2]",
  "[&_thead_th]:bg-surface [&_thead_th]:bg-[image:linear-gradient(var(--row-tint),var(--row-tint))]",
  "[&_thead_tr>:first-child]:z-[3] [&_thead_tr>:nth-child(2)]:z-[3]",
].join(" ")

/** A bounded table's box: a height bounded by the viewport, its overscroll kept inside, the whole table on paper. */
const BOUNDED = "max-h-[70vh] overscroll-contain print:max-h-none print:overflow-visible"

/** The box of a table that is a named region: in the tab order, with the focus ring. */
const REGION = "outline-none focus-visible:ring-3 focus-visible:ring-focus"

type TableProps = React.HTMLAttributes<HTMLTableElement> & {
  /**
   * Pins the first column (true), or the first two (2: a number or a place,
   * then the row header beside it), to the left edge while the table
   * scrolls sideways, each pinned cell on the opaque surface with its row's
   * tint over it.
   */
  stickyFirst?: boolean | 2
  /** Classes for the box the table scrolls in. */
  containerClassName?: string
} & (
    | { label?: undefined; bounded?: never }
    | {
        /**
         * What the table holds, as a screen reader names the box it scrolls
         * in ("Open standings"). The box is then a region in the tab order,
         * so the keyboard can scroll a table wider or taller than its box.
         */
        label: string
        /**
         * Bounds the box by the viewport (70vh, which a max-h-* in
         * containerClassName replaces), so a long table scrolls on its own
         * with its header held at the top.
         */
        bounded?: boolean
      }
  )

const Table = React.forwardRef<HTMLTableElement, TableProps>(
  ({ className, stickyFirst, bounded, label, containerClassName, ...props }, ref) => {
    const table = React.useRef<HTMLTableElement>(null)
    const box = React.useRef<HTMLDivElement>(null)
    React.useImperativeHandle(ref, () => table.current as HTMLTableElement, [])
    const pinned = stickyFirst === 2 ? 2 : stickyFirst ? 1 : 0

    // Pins the second column at the first's width, and keeps the box's
    // scroll padding at what the pinned header and columns cover plus the
    // ring's reach, so a control the keyboard moves to is scrolled out from
    // under them (WCAG 2.4.11). Both are read as the table is drawn and again
    // whenever the cells they come from change size, since a column is as
    // wide as its widest cell. They are set on the elements, not through
    // React, so a change of size draws nothing again.
    React.useLayoutEffect(() => {
      const el = table.current
      const scroller = box.current
      if (!el || !scroller || (pinned === 0 && !bounded)) return
      const firstRow = el.rows[0]
      const cells = Array.from(firstRow?.cells ?? []).slice(0, pinned)
      const head = bounded ? el.tHead : null
      const fit = () => {
        const widths = cells.map((c) => c.getBoundingClientRect().width)
        if (pinned === 2) el.style.setProperty("--table-pin", `${widths[0]}px`)
        if (pinned > 0) scroller.style.scrollPaddingLeft = `${widths.reduce((a, b) => a + b, 0) + RING_REACH}px`
        if (head) scroller.style.scrollPaddingTop = `${head.getBoundingClientRect().height + RING_REACH}px`
      }
      fit()
      const watch = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(fit)
      for (const target of [...cells, ...(head ? [head] : [])]) watch?.observe(target)
      return () => {
        watch?.disconnect()
        el.style.removeProperty("--table-pin")
        scroller.style.scrollPaddingLeft = ""
        scroller.style.scrollPaddingTop = ""
      }
    })

    const region = label === undefined ? {} : { role: "region", "aria-label": label, tabIndex: 0 }
    return (
      <div
        ref={box}
        className={cn("relative w-full overflow-auto", label !== undefined && REGION, bounded && BOUNDED, containerClassName)}
        {...region}
      >
        <table
          ref={table}
          className={cn(
            "w-full caption-bottom text-sm",
            (pinned > 0 || bounded) && LINED,
            pinned > 0 && PIN_FIRST,
            pinned === 2 && PIN_SECOND,
            pinned > 0 && PIN_EDGE[pinned as 1 | 2],
            bounded && STICKY_HEAD,
            className
          )}
          {...props}
        />
      </div>
    )
  }
)
Table.displayName = "Table"

const TableHeader = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
  <thead ref={ref} className={cn("[&_tr]:border-b", className)} {...props} />
))
TableHeader.displayName = "TableHeader"

const TableBody = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
  <tbody
    ref={ref}
    className={cn("[&_tr:last-child]:border-0", className)}
    {...props}
  />
))
TableBody.displayName = "TableBody"

const TableFooter = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
  <tfoot
    ref={ref}
    className={cn(
      "border-t bg-muted/50 font-medium [&>tr]:last:border-b-0",
      className
    )}
    {...props}
  />
))
TableFooter.displayName = "TableFooter"

const TableRow = React.forwardRef<
  HTMLTableRowElement,
  React.HTMLAttributes<HTMLTableRowElement>
>(({ className, ...props }, ref) => (
  <tr
    ref={ref}
    className={cn(
      "border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted",
      className
    )}
    {...props}
  />
))
TableRow.displayName = "TableRow"

/** A column's header cell: scope="col" unless told otherwise, which draws nothing new. */
const TableHead = React.forwardRef<
  HTMLTableCellElement,
  React.ThHTMLAttributes<HTMLTableCellElement>
>(({ className, scope = "col", ...props }, ref) => (
  <th
    ref={ref}
    scope={scope}
    className={cn(
      "h-12 px-4 text-left align-middle font-medium text-muted-foreground [&:has([role=checkbox])]:pr-0",
      className
    )}
    {...props}
  />
))
TableHead.displayName = "TableHead"

/**
 * A row's header cell (scope="row"), such as the player's name in a
 * standings row, so a screen reader names the row with it as it reads
 * each cell. Spaced like a TableCell, in the ink at weight 500.
 */
const TableRowHeader = React.forwardRef<
  HTMLTableCellElement,
  Omit<React.ThHTMLAttributes<HTMLTableCellElement>, "scope">
>(({ className, ...props }, ref) => (
  <th
    ref={ref}
    scope="row"
    className={cn("p-4 text-left align-middle font-medium [&:has([role=checkbox])]:pr-0", className)}
    {...props}
  />
))
TableRowHeader.displayName = "TableRowHeader"

const TableCell = React.forwardRef<
  HTMLTableCellElement,
  React.TdHTMLAttributes<HTMLTableCellElement>
>(({ className, ...props }, ref) => (
  <td
    ref={ref}
    className={cn("p-4 align-middle [&:has([role=checkbox])]:pr-0", className)}
    {...props}
  />
))
TableCell.displayName = "TableCell"

const TableCaption = React.forwardRef<
  HTMLTableCaptionElement,
  React.HTMLAttributes<HTMLTableCaptionElement>
>(({ className, ...props }, ref) => (
  <caption
    ref={ref}
    className={cn("mt-4 text-sm text-muted-foreground", className)}
    {...props}
  />
))
TableCaption.displayName = "TableCaption"

export {
  Table,
  TableHeader,
  TableBody,
  TableFooter,
  TableHead,
  TableRowHeader,
  TableRow,
  TableCell,
  TableCaption,
}
export type { TableProps }
