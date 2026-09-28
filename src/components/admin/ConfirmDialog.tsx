// src/components/admin/ConfirmDialog.tsx
import { Button } from '@/components/ui/button'


// ── Confirm dialog ────────────────────────────────────────────────────────────

export function ConfirmDialog({ message, onConfirm, onCancel }: {
  message: string; onConfirm: () => void; onCancel: () => void
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.45)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onCancel() }}>
      <div className="mx-4 w-full max-w-sm rounded-xl border bg-background p-6 shadow-lg">
        <p className="mb-6 text-sm font-medium">{message}</p>
        <div className="flex gap-3">
          <Button variant="outline" className="flex-1" onClick={onCancel}>Cancel</Button>
          <Button className="flex-1 bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={onConfirm}>Delete</Button>
        </div>
      </div>
    </div>
  )
}
