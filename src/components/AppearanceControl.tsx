// src/components/AppearanceControl.tsx
//
// System · Light · Dark, for the new look. It sits in the current footer
// (on navy) behind newLook until the footer is rebuilt. System follows the
// device setting; the choice is kept in this browser only. The pressed
// option is marked in words for screen readers (aria-pressed) and on screen
// by its fill, border and weight, never by colour alone.
import { useColorScheme } from '@/hooks/useColorScheme'
import { APPEARANCES, type Appearance } from '@/lib/colorScheme'
import { cn } from '@/lib/utils'

const LABELS: Record<Appearance, string> = {
  system: 'System',
  light: 'Light',
  dark: 'Dark',
}

export function AppearanceControl({ className }: { className?: string }) {
  const { appearance, setAppearance } = useColorScheme()
  return (
    <div className={cn('flex items-center gap-2', className)}>
      <span id="appearance-label" className="text-sm text-white/70">
        Appearance
      </span>
      <div role="group" aria-labelledby="appearance-label" className="flex gap-1">
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
                pressed
                  ? 'border-white/60 bg-white/15 font-semibold text-white'
                  : 'border-white/20 text-white/80 hover:border-white/40 hover:text-white',
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
