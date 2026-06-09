import { Link } from 'react-router-dom'
import { Calendar, MapPin, Users } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface Club {
  id: string
  name: string
  city: string
  meetingSchedule: string
}

const clubs: Club[] = [
  {
    id: 'baton-rouge',
    name: 'Baton Rouge Chess Club',
    city: 'Baton Rouge',
    meetingSchedule: 'Tuesdays, 6:30 PM',
  },
  {
    id: 'new-orleans',
    name: 'New Orleans Chess Club',
    city: 'New Orleans',
    meetingSchedule: 'Wednesdays, 7:00 PM',
  },
  {
    id: 'shreveport',
    name: 'Shreveport Chess Society',
    city: 'Shreveport',
    meetingSchedule: 'Thursdays, 6:00 PM',
  },
  {
    id: 'lafayette',
    name: 'Lafayette Chess Alliance',
    city: 'Lafayette',
    meetingSchedule: 'Mondays, 6:30 PM',
  },
  {
    id: 'lake-charles',
    name: 'Lake Charles Chess Society',
    city: 'Lake Charles',
    meetingSchedule: 'Saturdays, 2:00 PM',
  },
  {
    id: 'monroe',
    name: 'Monroe Chess Club',
    city: 'Monroe',
    meetingSchedule: 'Fridays, 6:00 PM',
  },
  {
    id: 'alexandria',
    name: 'Alexandria Chess Club',
    city: 'Alexandria',
    meetingSchedule: 'Tuesdays, 7:00 PM',
  },
  {
    id: 'hammond',
    name: 'Hammond Scholastic Chess',
    city: 'Hammond',
    meetingSchedule: 'Saturdays, 10:00 AM',
  },
  {
    id: 'slidell',
    name: 'Slidell Chess Club',
    city: 'Slidell',
    meetingSchedule: 'Wednesdays, 6:30 PM',
  },
  {
    id: 'ruston',
    name: 'Ruston Chess Club',
    city: 'Ruston',
    meetingSchedule: 'Thursdays, 6:30 PM',
  },
  {
    id: 'thibodaux',
    name: 'Thibodaux Chess Club',
    city: 'Thibodaux',
    meetingSchedule: 'Mondays, 7:00 PM',
  },
  {
    id: 'covington',
    name: 'Covington Chess Club',
    city: 'Covington',
    meetingSchedule: 'Tuesdays, 6:00 PM',
  },
  {
    id: 'metairie',
    name: 'Metairie Chess Club',
    city: 'Metairie',
    meetingSchedule: 'Sundays, 3:00 PM',
  },
  {
    id: 'natchitoches',
    name: 'Natchitoches Chess Club',
    city: 'Natchitoches',
    meetingSchedule: 'Fridays, 5:30 PM',
  },
  {
    id: 'kenner',
    name: 'Kenner Chess Club',
    city: 'Kenner',
    meetingSchedule: 'Wednesdays, 7:30 PM',
  },
]

const goldButtonClass =
  'bg-[#c8a94a] font-semibold text-[#1a2744] hover:bg-[#c8a94a]/90'

export function ClubsPage() {
  return (
    <div>
      <section className="border-b-4 border-[#c8a94a] bg-[#1a2744] text-white">
        <div className="mx-auto max-w-6xl px-6 py-12">
          <div className="flex items-center gap-3">
            <Users className="size-8 text-[#c8a94a] sm:size-10" />
            <div>
              <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
                Affiliated Clubs
              </h1>
              <p className="mt-2 max-w-2xl text-white/80">
                Find a chess club near you. LCA-affiliated clubs host regular
                meetings, lessons, and local tournaments across Louisiana.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-12">
        <p className="text-muted-foreground">
          {clubs.length} clubs affiliated with the Louisiana Chess Association.
        </p>

        <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {clubs.map((club) => (
            <li
              key={club.id}
              className="flex flex-col rounded-xl border bg-card p-5 shadow-sm sm:p-6"
            >
              <h2 className="text-lg font-semibold text-[#1a2744]">
                {club.name}
              </h2>

              <div className="mt-3 space-y-2 text-sm text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <MapPin className="size-4 shrink-0 text-[#c8a94a]" />
                  {club.city}, LA
                </span>
                <span className="flex items-center gap-1.5">
                  <Calendar className="size-4 shrink-0 text-[#c8a94a]" />
                  {club.meetingSchedule}
                </span>
              </div>

              <Button
                asChild
                className={cn('mt-5 w-full sm:w-auto', goldButtonClass)}
              >
                <Link to={`/clubs/${club.id}`}>View Club</Link>
              </Button>
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}