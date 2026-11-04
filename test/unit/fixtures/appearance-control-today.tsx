// test/unit/fixtures/appearance-control-today.tsx
//
// The Appearance control as the footer draws it today, with every switch
// off but newLook: src/components/AppearanceControl.tsx as it stood at
// commit 8d7df98, kept word for word but for this comment and its export's
// name, AppearanceControlToday. test/unit/appearance-control-today.test.tsx
// draws it beside the live control and holds the two the same, byte for
// byte, wherever the live one is drawn with its defaults.
import { useColorScheme } from '@/hooks/useColorScheme'
import { APPEARANCES, type Appearance } from '@/lib/colorScheme'
import { cn } from '@/lib/utils'

const LABELS: Record<Appearance, string> = {
  system: 'System',
  light: 'Light',
  dark: 'Dark',
}

export function AppearanceControlToday({ className }: { className?: string }) {
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
