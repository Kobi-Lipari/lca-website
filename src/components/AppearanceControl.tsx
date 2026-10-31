// src/components/AppearanceControl.tsx
//
// System · Light · Dark, for the new look. It sits in two places: the
// current footer, on navy, behind newLook until the footer is rebuilt (its
// default), and the Menu sheet of the new chrome
// (src/components/layout/MobileMenu.tsx), on the sheet's light ground, with
// on="light" and a label id of its own, so a page that draws both never
// holds one id twice. Both write the choice through the one module that
// keeps it, so a pick in one shows in the other. System follows the device
// setting; the choice is kept in this browser only. The pressed option is
// marked in words for screen readers (aria-pressed) and on screen by its
// fill, border and weight, never by colour alone.
import { useColorScheme } from '@/hooks/useColorScheme'
import { APPEARANCES, type Appearance } from '@/lib/colorScheme'
import { cn } from '@/lib/utils'

const LABELS: Record<Appearance, string> = {
  system: 'System',
  light: 'Light',
  dark: 'Dark',
}

interface AppearanceControlProps {
  className?: string
  /** The id of its label, which names its group: the footer's is appearance-label, so another place gives its own. */
  labelId?: string
  /**
   * The ground it is drawn on: navy, the footer's, where its words and lines
   * are white; or light, the Menu sheet's, where they are the sheet's ink.
   */
  on?: 'navy' | 'light'
}

export function AppearanceControl({ className, labelId = 'appearance-label', on = 'navy' }: AppearanceControlProps) {
  const { appearance, setAppearance } = useColorScheme()
  return (
    <div className={cn('flex items-center gap-2', className)}>
      <span id={labelId} className={cn('text-sm', on === 'navy' ? 'text-white/70' : 'font-semibold')}>
        Appearance
      </span>
      <div role="group" aria-labelledby={labelId} className="flex gap-1">
        {APPEARANCES.map((option) => {
          const pressed = appearance === option
          return (
            <button
              key={option}
              type="button"
              aria-pressed={pressed}
              onClick={() => setAppearance(option)}
              className={cn(
                'h-8 rounded-md border px-3 text-sm transition-colors',
                on === 'navy'
                  ? pressed
                    ? 'border-white/60 bg-white/15 font-semibold text-white'
                    : 'border-white/20 text-white/80 hover:border-white/40 hover:text-white'
                  : pressed
                    ? 'h-11 border-ink bg-muted font-semibold'
                    : 'h-11 border-hairline hover:bg-muted',
              )}
            >
              {LABELS[option]}
            </button>
          )
        })}
      </div>
    </div>
  )
}
