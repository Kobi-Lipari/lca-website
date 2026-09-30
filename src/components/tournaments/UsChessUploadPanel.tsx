// src/components/tournaments/UsChessUploadPanel.tsx
//
// Makes the three files US Chess's rating report upload takes. The few
// details the site doesn't already know (affiliate ID, TD IDs, where the
// event was) are asked once, saved on the event, and filled in next time.
import { useState } from 'react'
import { Download } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { adminUpdateTournament, type ApiRatingReport } from '@/lib/api'
import {
  buildUploadFiles, defaultSettings, settingsProblems, zipFiles,
  type RatingSystem, type SendCrosstable, type UploadSettings,
} from '@/lib/uschessUpload'

const SYSTEMS: Array<[RatingSystem, string]> = [
  ['R', 'Regular'], ['D', 'Dual (regular and quick)'], ['Q', 'Quick'], ['B', 'Blitz'],
]
const SEND: Array<[SendCrosstable, string]> = [['A', 'Affiliate'], ['T', 'Chief TD'], ['N', 'Nobody']]

function download(name: string, data: Uint8Array, type: string) {
  const url = URL.createObjectURL(new Blob([data as BlobPart], { type }))
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.click()
  URL.revokeObjectURL(url)
}

export function UsChessUploadPanel({ tournamentId, report, canEdit }: {
  tournamentId: string
  report: ApiRatingReport
  canEdit: boolean
}) {
  const [s, setS] = useState<UploadSettings>(() => defaultSettings(report))
  const [saving, setSaving] = useState(false)
  const [note, setNote] = useState<string | null>(null)
  const problems = settingsProblems(s)
  const blocked = problems.length > 0 || report.validationErrors.length > 0
  const set = (patch: Partial<UploadSettings>) => { setS((prev) => ({ ...prev, ...patch })); setNote(null) }
  const slug = report.tournament.name.replace(/[^a-z0-9]+/gi, '-').toLowerCase()

  async function save(): Promise<boolean> {
    if (!canEdit) return true
    setSaving(true)
    try {
      await adminUpdateTournament(tournamentId, { reportSettings: s as unknown as Record<string, unknown> })
      return true
    } catch (err) {
      setNote(err instanceof Error ? err.message : 'Could not save these details')
      return false
    } finally {
      setSaving(false)
    }
  }

  async function makeFiles(which: 'zip' | 'thexport' | 'tsexport' | 'tdexport') {
    if (!(await save())) return
    const files = buildUploadFiles(report, s)
    if (which === 'zip') {
      download(`${slug}-us-chess-upload.zip`, zipFiles([
        { name: 'THEXPORT.DBF', data: files.thexport },
        { name: 'TSEXPORT.DBF', data: files.tsexport },
        { name: 'TDEXPORT.DBF', data: files.tdexport },
      ]), 'application/zip')
    } else {
      download(`${which.toUpperCase()}.DBF`, files[which], 'application/octet-stream')
    }
    setNote('Saved. Upload all three .DBF files on US Chess\'s rating report page.')
  }

  return (
    <div className="rounded-lg border p-4">
      <h3 className="text-base font-semibold text-lca-navy">Upload files for US Chess</h3>
      <p className="mt-1 text-xs text-muted-foreground">
        The three files (THEXPORT, TSEXPORT, TDEXPORT) US Chess's rating report upload asks for, the same ones
        SwissSys and WinTD make. Fill these in once; they're saved with the event.
      </p>

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <div className="space-y-1">
          <Label htmlFor="us-aff" className="text-xs">Affiliate ID</Label>
          <Input id="us-aff" placeholder="A1234567" value={s.affiliateId} onChange={(e) => set({ affiliateId: e.target.value.toUpperCase() })} />
        </div>
        <div className="space-y-1">
          <Label htmlFor="us-ctd" className="text-xs">Chief TD's US Chess ID</Label>
          <Input id="us-ctd" inputMode="numeric" value={s.chiefTdId} onChange={(e) => set({ chiefTdId: e.target.value.replace(/\D/g, '') })} />
          {report.upload?.suggested.chiefTdName && s.chiefTdId === report.upload.suggested.chiefTdId && (
            <p className="text-[11px] text-muted-foreground">{report.upload.suggested.chiefTdName}</p>
          )}
        </div>
        <div className="space-y-1">
          <Label htmlFor="us-atd" className="text-xs">Assistant TD's ID (optional)</Label>
          <Input id="us-atd" inputMode="numeric" value={s.assistantTdId} onChange={(e) => set({ assistantTdId: e.target.value.replace(/\D/g, '') })} />
        </div>
        <div className="space-y-1">
          <Label htmlFor="us-city" className="text-xs">City</Label>
          <Input id="us-city" value={s.city} onChange={(e) => set({ city: e.target.value })} />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <Label htmlFor="us-state" className="text-xs">State</Label>
            <Input id="us-state" maxLength={2} value={s.state} onChange={(e) => set({ state: e.target.value.toUpperCase() })} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="us-zip" className="text-xs">ZIP</Label>
            <Input id="us-zip" inputMode="numeric" value={s.zip} onChange={(e) => set({ zip: e.target.value })} />
          </div>
        </div>
        <label className="flex items-center gap-2 self-end pb-2 text-sm">
          <input type="checkbox" checked={s.scholastic} onChange={(e) => set({ scholastic: e.target.checked })} />
          Scholastic event
        </label>
      </div>

      <div className="mt-4 space-y-2">
        {report.sections.map((sec) => {
          const cur = s.sections[sec.name] ?? { ratingSystem: 'R' as RatingSystem, sendCrosstable: 'A' as SendCrosstable }
          const setSec = (patch: Partial<typeof cur>) => set({ sections: { ...s.sections, [sec.name]: { ...cur, ...patch } } })
          return (
            <div key={sec.name} className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
              <span className="w-32 font-medium">{sec.name}</span>
              <label className="flex items-center gap-1.5 text-xs">
                Rated as
                <select className="h-8 rounded-md border bg-background px-1.5 text-sm" value={cur.ratingSystem}
                  onChange={(e) => setSec({ ratingSystem: e.target.value as RatingSystem })}>
                  {SYSTEMS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </label>
              <label className="flex items-center gap-1.5 text-xs">
                Crosstable mailed to
                <select className="h-8 rounded-md border bg-background px-1.5 text-sm" value={cur.sendCrosstable}
                  onChange={(e) => setSec({ sendCrosstable: e.target.value as SendCrosstable })}>
                  {SEND.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </label>
            </div>
          )
        })}
        <p className="text-[11px] text-muted-foreground">
          "Rated as" is filled in from the time control{report.tournament.timeControl ? ` (${report.tournament.timeControl})` : ''}; change it if needed.
        </p>
      </div>

      {problems.length > 0 && (
        <ul className="mt-3 list-disc pl-5 text-xs text-amber-800">
          {problems.map((p) => <li key={p}>{p}</li>)}
        </ul>
      )}
      {report.validationErrors.length > 0 && (
        <p className="mt-2 text-xs text-amber-800">Fix the problems listed above first.</p>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Button type="button" size="sm" disabled={blocked || saving} onClick={() => makeFiles('zip')}>
          <Download className="mr-1 size-3.5" />{saving ? 'Saving…' : 'Download all three (.zip)'}
        </Button>
        {(['thexport', 'tsexport', 'tdexport'] as const).map((f) => (
          <Button key={f} type="button" size="sm" variant="outline" disabled={blocked || saving} onClick={() => makeFiles(f)}>
            {f.toUpperCase()}.DBF
          </Button>
        ))}
      </div>
      {note && <p className="mt-2 text-xs text-muted-foreground">{note}</p>}
      <p className="mt-3 text-[11px] text-muted-foreground">
        New feature: if US Chess's upload rejects a file, note the exact message and send it to the site team; the fix is quick.
        Until it's confirmed, the table above works for typing the event in by hand.
      </p>
    </div>
  )
}
