import { Link, useParams } from 'react-router-dom'
import {
  ArrowLeft,
  Calendar,
  Mail,
  MapPin,
  Newspaper,
  Trophy,
  User,
  Users,
} from 'lucide-react'

import { Button } from '@/components/ui/button'

interface ClubOfficer {
  name: string
  role: string
}

interface ClubTournament {
  id: string
  name: string
  date: string
}

interface ClubNewsItem {
  title: string
  date: string
  excerpt: string
}

interface ClubDetail {
  id: string
  name: string
  city: string
  description: string
  location: string
  meetingSchedule: string
  contactEmail: string
  officers: ClubOfficer[]
  tournaments: ClubTournament[]
  news: ClubNewsItem[]
}

const clubDetails: Record<string, ClubDetail> = {
  'baton-rouge': {
    id: 'baton-rouge',
    name: 'Baton Rouge Chess Club',
    city: 'Baton Rouge',
    description:
      'The Baton Rouge Chess Club is one of Louisiana\'s oldest and most active clubs. We welcome players of all skill levels for weekly casual and rated games, plus quarterly club championships.',
    location: 'Baton Rouge Community Center, 555 Government St, Baton Rouge, LA 70802',
    meetingSchedule: 'Tuesdays, 6:30 PM – 9:00 PM',
    contactEmail: 'brchess@louisianachess.org',
    officers: [
      { name: 'Marcus Johnson', role: 'Club President' },
      { name: 'Emily Tran', role: 'Tournament Director' },
      { name: 'Robert Hale', role: 'Secretary' },
    ],
    tournaments: [
      { id: 'spring-open-2026', name: 'LCA Spring Open', date: 'March 14, 2026' },
      { id: 'baton-rouge-fall-open-2025', name: 'Baton Rouge Fall Open', date: 'October 11, 2025' },
    ],
    news: [
      {
        title: 'Club Championship Results Posted',
        date: 'January 20, 2026',
        excerpt: 'Congratulations to Carlos Rivera for winning the 2025–26 club championship with a perfect 7/7 score.',
      },
      {
        title: 'New Member Orientation February 4',
        date: 'January 10, 2026',
        excerpt: 'First-time visitors are welcome at our monthly orientation — free boards and clocks provided.',
      },
    ],
  },
  'new-orleans': {
    id: 'new-orleans',
    name: 'New Orleans Chess Club',
    city: 'New Orleans',
    description:
      'Located in the heart of the city, the New Orleans Chess Club brings together players from across the metro area. Blitz nights, lectures, and social events make every Wednesday a chess night.',
    location: 'New Orleans Public Library, Main Branch, 219 Loyola Ave, New Orleans, LA 70112',
    meetingSchedule: 'Wednesdays, 7:00 PM – 10:00 PM',
    contactEmail: 'nochess@louisianachess.org',
    officers: [
      { name: 'Andre Williams', role: 'Club President' },
      { name: 'Sophie Martin', role: 'Vice President' },
      { name: 'Maria Santos', role: 'Membership Chair' },
    ],
    tournaments: [
      { id: 'new-orleans-classic-2026', name: 'New Orleans Classic', date: 'April 18, 2026' },
      { id: 'state-championship-2025', name: 'Louisiana State Championship', date: 'November 15, 2025' },
    ],
    news: [
      {
        title: 'Blitz Championship This Month',
        date: 'February 5, 2026',
        excerpt: 'Five rounds of G/5 blitz — $10 entry, trophies for top three in each rating class.',
      },
    ],
  },
  'shreveport': {
    id: 'shreveport',
    name: 'Shreveport Chess Society',
    city: 'Shreveport',
    description:
      'The Shreveport Chess Society serves northwest Louisiana with weekly meetups, scholastic outreach, and the annual Summer Swiss tournament.',
    location: 'Shreveport Public Library, Main Branch, 424 Texas St, Shreveport, LA 71101',
    meetingSchedule: 'Thursdays, 6:00 PM – 8:30 PM',
    contactEmail: 'shreveportchess@louisianachess.org',
    officers: [
      { name: 'Linda Foster', role: 'Club President' },
      { name: 'Robert Hale', role: 'Scholastic Coordinator' },
    ],
    tournaments: [
      { id: 'shreveport-summer-swiss-2026', name: 'Shreveport Summer Swiss', date: 'June 6, 2026' },
    ],
    news: [
      {
        title: 'Scholastic Program Expanding',
        date: 'January 28, 2026',
        excerpt: 'We are partnering with three Caddo Parish schools to bring after-school chess to 120 new students.',
      },
    ],
  },
  'lafayette': {
    id: 'lafayette',
    name: 'Lafayette Chess Alliance',
    city: 'Lafayette',
    description:
      'The Lafayette Chess Alliance unites Acadiana\'s chess community with weekly play, coaching for juniors, and strong participation in LCA state events.',
    location: 'Lafayette Science Museum, 433 Jefferson St, Lafayette, LA 70501',
    meetingSchedule: 'Mondays, 6:30 PM – 9:00 PM',
    contactEmail: 'lafayettechess@louisianachess.org',
    officers: [
      { name: 'David Chen', role: 'Club President' },
      { name: 'Priya Patel', role: 'Treasurer' },
      { name: 'Tyler Brooks', role: 'Events Coordinator' },
    ],
    tournaments: [
      { id: 'lafayette-winter-classic-2026', name: 'Lafayette Winter Classic', date: 'February 8, 2026' },
    ],
    news: [
      {
        title: 'Winter Classic Underway',
        date: 'February 8, 2026',
        excerpt: 'Round 3 of the Lafayette Winter Classic is in progress — follow live results on the tournament page.',
      },
    ],
  },
  'lake-charles': {
    id: 'lake-charles',
    name: 'Lake Charles Chess Society',
    city: 'Lake Charles',
    description:
      'The newest LCA-affiliated club in southwest Louisiana. Family-friendly Saturday meetings with lessons for beginners and rated play for experienced members.',
    location: 'Central Library, 301 W Claude St, Lake Charles, LA 70601',
    meetingSchedule: 'Saturdays, 2:00 PM – 5:00 PM',
    contactEmail: 'lakecharleschess@louisianachess.org',
    officers: [
      { name: 'Grace Wilson', role: 'Club President' },
      { name: 'Noah Davis', role: 'Youth Coordinator' },
    ],
    tournaments: [],
    news: [
      {
        title: 'Welcome to the LCA Network',
        date: 'January 15, 2026',
        excerpt: 'Lake Charles Chess Society is now officially affiliated with the Louisiana Chess Association.',
      },
      {
        title: 'First Club Tournament Planned for April',
        date: 'February 1, 2026',
        excerpt: 'We are planning a four-round Swiss for April — details coming soon.',
      },
    ],
  },
  'monroe': {
    id: 'monroe',
    name: 'Monroe Chess Club',
    city: 'Monroe',
    description:
      'Northeast Louisiana\'s home for competitive and casual chess. Strong scholastic tradition with annual grade-level championships.',
    location: 'Monroe Civic Center, 401 Lea Joyner Memorial Expy, Monroe, LA 71201',
    meetingSchedule: 'Fridays, 6:00 PM – 8:30 PM',
    contactEmail: 'monroechess@louisianachess.org',
    officers: [
      { name: 'Ethan Nguyen', role: 'Club President' },
      { name: 'James Whitfield', role: 'Tournament Director' },
    ],
    tournaments: [
      { id: 'monroe-scholastic-2025', name: 'Monroe Scholastic Championship', date: 'September 20, 2025' },
    ],
    news: [
      {
        title: 'Scholastic Championship Recap',
        date: 'September 25, 2025',
        excerpt: 'Over 80 students competed across four grade-level sections. Full results on the tournament page.',
      },
    ],
  },
  'alexandria': {
    id: 'alexandria',
    name: 'Alexandria Chess Club',
    city: 'Alexandria',
    description:
      'Central Louisiana\'s chess hub. Weekly meetings feature Swiss-style quads, puzzle nights, and preparation for regional tournaments.',
    location: 'Alexandria Main Library, 503 Washington St, Alexandria, LA 71301',
    meetingSchedule: 'Tuesdays, 7:00 PM – 9:30 PM',
    contactEmail: 'alexandriachess@louisianachess.org',
    officers: [
      { name: 'Carlos Rivera', role: 'Club President' },
      { name: 'Anna Kowalski', role: 'Secretary' },
    ],
    tournaments: [],
    news: [
      {
        title: 'Puzzle Night Every First Tuesday',
        date: 'January 5, 2026',
        excerpt: 'Join us for tactical puzzles and prizes — all levels welcome, no rating required.',
      },
    ],
  },
  'hammond': {
    id: 'hammond',
    name: 'Hammond Scholastic Chess',
    city: 'Hammond',
    description:
      'Focused on youth chess development in the Hammond area. Saturday morning sessions combine lessons, supervised play, and tournament preparation for K–12 players.',
    location: 'Southeastern Louisiana University, Student Union, Hammond, LA 70402',
    meetingSchedule: 'Saturdays, 10:00 AM – 12:30 PM',
    contactEmail: 'hammondscholastic@louisianachess.org',
    officers: [
      { name: 'David Chen', role: 'Program Director' },
      { name: 'Grace Wilson', role: 'Parent Coordinator' },
    ],
    tournaments: [],
    news: [
      {
        title: 'Spring Scholastic League Registration Open',
        date: 'February 3, 2026',
        excerpt: 'Teams from Tangipahoa Parish schools can register for the spring inter-school league.',
      },
    ],
  },
  'slidell': {
    id: 'slidell',
    name: 'Slidell Chess Club',
    city: 'Slidell',
    description:
      'Northshore players gather weekly for blitz, bughouse, and classical games. A relaxed atmosphere with serious competition when it counts.',
    location: 'Slidell Branch Library, 555 Robert Blvd, Slidell, LA 70458',
    meetingSchedule: 'Wednesdays, 6:30 PM – 9:00 PM',
    contactEmail: 'slidellchess@louisianachess.org',
    officers: [
      { name: 'Tyler Brooks', role: 'Club President' },
      { name: 'Sophie Martin', role: 'Events Chair' },
    ],
    tournaments: [],
    news: [
      {
        title: 'Northshore Blitz Series Continues',
        date: 'January 22, 2026',
        excerpt: 'Monthly blitz tournaments through June — next round February 19.',
      },
    ],
  },
  'ruston': {
    id: 'ruston',
    name: 'Ruston Chess Club',
    city: 'Ruston',
    description:
      'Serving Lincoln Parish and the I-20 corridor. University students and community members play side by side at weekly meetups.',
    location: 'Ruston Community Center, 400 N Trenton St, Ruston, LA 71270',
    meetingSchedule: 'Thursdays, 6:30 PM – 9:00 PM',
    contactEmail: 'rustonchess@louisianachess.org',
    officers: [
      { name: 'Marcus Johnson', role: 'Club President' },
      { name: 'Emily Tran', role: 'Treasurer' },
    ],
    tournaments: [],
    news: [
      {
        title: 'Tech vs. Community Match February 15',
        date: 'February 1, 2026',
        excerpt: 'Louisiana Tech chess club challenges Ruston regulars in a 20-board team match.',
      },
    ],
  },
  'thibodaux': {
    id: 'thibodaux',
    name: 'Thibodaux Chess Club',
    city: 'Thibodaux',
    description:
      'Bayou region chess at its finest. Monday night meetings include lectures from local masters and friendly ladder matches.',
    location: 'Thibodaux Library, 314 St Mary St, Thibodaux, LA 70301',
    meetingSchedule: 'Mondays, 7:00 PM – 9:30 PM',
    contactEmail: 'thibodauxchess@louisianachess.org',
    officers: [
      { name: 'Priya Patel', role: 'Club President' },
      { name: 'Robert Hale', role: 'Lectures Chair' },
    ],
    tournaments: [],
    news: [
      {
        title: 'Opening Principles Lecture Series',
        date: 'January 18, 2026',
        excerpt: 'Four-week series on opening fundamentals — free for LCA members.',
      },
    ],
  },
  'covington': {
    id: 'covington',
    name: 'Covington Chess Club',
    city: 'Covington',
    description:
      'St. Tammany Parish\'s chess community. Tuesday evenings feature rated rapid games and a growing junior section.',
    location: 'Covington Recreation Center, 1900 Rabbit Run, Covington, LA 70433',
    meetingSchedule: 'Tuesdays, 6:00 PM – 8:30 PM',
    contactEmail: 'covingtonchess@louisianachess.org',
    officers: [
      { name: 'Andre Williams', role: 'Club President' },
      { name: 'Linda Foster', role: 'Junior Coordinator' },
    ],
    tournaments: [],
    news: [
      {
        title: 'Junior Section Hits 25 Members',
        date: 'January 30, 2026',
        excerpt: 'Our youth program has grown to 25 active players — new coaches needed!',
      },
    ],
  },
  'metairie': {
    id: 'metairie',
    name: 'Metairie Chess Club',
    city: 'Metairie',
    description:
      'Sunday afternoon chess in Metairie. Perfect for families and players who prefer weekend meetups over weekday evenings.',
    location: 'Jefferson Parish Library, East Bank Regional, 4747 W Napoleon Ave, Metairie, LA 70001',
    meetingSchedule: 'Sundays, 3:00 PM – 6:00 PM',
    contactEmail: 'metairiechess@louisianachess.org',
    officers: [
      { name: 'Maria Santos', role: 'Club President' },
      { name: 'James Whitfield', role: 'Secretary' },
    ],
    tournaments: [],
    news: [
      {
        title: 'Family Chess Day March 8',
        date: 'February 10, 2026',
        excerpt: 'Bring the kids for simultaneous exhibitions, puzzles, and pizza.',
      },
    ],
  },
  'natchitoches': {
    id: 'natchitoches',
    name: 'Natchitoches Chess Club',
    city: 'Natchitoches',
    description:
      'Historic Natchitoches hosts a welcoming Friday evening club. Small but dedicated group with players from across central Louisiana.',
    location: 'Natchitoches Parish Library, 450 3rd St, Natchitoches, LA 71457',
    meetingSchedule: 'Fridays, 5:30 PM – 8:00 PM',
    contactEmail: 'natchitochess@louisianachess.org',
    officers: [
      { name: 'Carlos Rivera', role: 'Club President' },
    ],
    tournaments: [],
    news: [
      {
        title: 'Seeking New Members',
        date: 'January 12, 2026',
        excerpt: 'We are looking to grow — visitors always welcome, first night free.',
      },
    ],
  },
  'kenner': {
    id: 'kenner',
    name: 'Kenner Chess Club',
    city: 'Kenner',
    description:
      'Jefferson Parish\'s Wednesday night club. Active blitz scene and regular trips to New Orleans tournaments.',
    location: 'Kenner Recreation Center, 6220 Loyola Dr, Kenner, LA 70065',
    meetingSchedule: 'Wednesdays, 7:30 PM – 10:00 PM',
    contactEmail: 'kennerchess@louisianachess.org',
    officers: [
      { name: 'Andre Williams', role: 'Club President' },
      { name: 'Ethan Nguyen', role: 'Blitz Coordinator' },
    ],
    tournaments: [],
    news: [
      {
        title: 'Group Trip to New Orleans Classic',
        date: 'March 1, 2026',
        excerpt: 'Carpool forming for the April 18 New Orleans Classic — sign up at Wednesday meetings.',
      },
    ],
  },
}

export function ClubDetailPage() {
  const { id } = useParams<{ id: string }>()
  const club = id ? clubDetails[id] : undefined

  if (!club) {
    return (
      <div className="mx-auto max-w-6xl px-6 py-12 text-center">
        <Users className="mx-auto size-12 text-muted-foreground" />
        <h1 className="mt-4 text-2xl font-bold text-[#1a2744]">Club not found</h1>
        <p className="mt-2 text-muted-foreground">
          The club you are looking for does not exist or may have been removed.
        </p>
        <Button asChild className="mt-6" variant="outline">
          <Link to="/clubs">
            <ArrowLeft className="size-4" />
            Back to clubs
          </Link>
        </Button>
      </div>
    )
  }

  return (
    <div>
      <section className="border-b-4 border-[#c8a94a] bg-[#1a2744] text-white">
        <div className="mx-auto max-w-6xl px-6 py-12">
          <Link
            to="/clubs"
            className="inline-flex items-center gap-1.5 text-sm text-white/70 transition-colors hover:text-[#c8a94a]"
          >
            <ArrowLeft className="size-4" />
            All clubs
          </Link>

          <h1 className="mt-4 text-3xl font-bold tracking-tight sm:text-4xl">
            {club.name}
          </h1>

          <div className="mt-4 flex flex-col gap-2 text-sm text-white/80 sm:flex-row sm:flex-wrap sm:gap-x-6">
            <span className="inline-flex items-center gap-1.5">
              <MapPin className="size-4 shrink-0 text-[#c8a94a]" />
              {club.city}, LA
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Calendar className="size-4 shrink-0 text-[#c8a94a]" />
              {club.meetingSchedule}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Mail className="size-4 shrink-0 text-[#c8a94a]" />
              {club.contactEmail}
            </span>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-12">
        <div className="grid gap-8 lg:grid-cols-3">
          <div className="space-y-8 lg:col-span-2">
            <div>
              <h2 className="text-xl font-bold text-[#1a2744]">About</h2>
              <p className="mt-3 text-muted-foreground">{club.description}</p>
              <p className="mt-3 text-sm text-muted-foreground">
                <span className="font-medium text-[#1a2744]">Meeting location:</span>{' '}
                {club.location}
              </p>
            </div>

            <div>
              <div className="flex items-center gap-2">
                <User className="size-5 text-[#c8a94a]" />
                <h2 className="text-xl font-bold text-[#1a2744]">Officers</h2>
              </div>
              <ul className="mt-4 grid gap-3 sm:grid-cols-2">
                {club.officers.map((officer) => (
                  <li
                    key={officer.name}
                    className="rounded-xl border bg-card px-4 py-3 shadow-sm"
                  >
                    <p className="font-medium text-[#1a2744]">{officer.name}</p>
                    <p className="text-sm text-[#c8a94a]">{officer.role}</p>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <div className="flex items-center gap-2">
                <Trophy className="size-5 text-[#c8a94a]" />
                <h2 className="text-xl font-bold text-[#1a2744]">
                  Club Tournaments
                </h2>
              </div>
              {club.tournaments.length > 0 ? (
                <ul className="mt-4 space-y-3">
                  {club.tournaments.map((tournament) => (
                    <li
                      key={tournament.id}
                      className="flex flex-col gap-2 rounded-xl border bg-card p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div>
                        <p className="font-medium text-[#1a2744]">
                          {tournament.name}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {tournament.date}
                        </p>
                      </div>
                      <Button asChild variant="outline" size="sm">
                        <Link to={`/tournaments/${tournament.id}`}>
                          View tournament
                        </Link>
                      </Button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-4 text-sm text-muted-foreground">
                  No upcoming club tournaments scheduled. Check back soon.
                </p>
              )}
            </div>

            <div>
              <div className="flex items-center gap-2">
                <Newspaper className="size-5 text-[#c8a94a]" />
                <h2 className="text-xl font-bold text-[#1a2744]">Club News</h2>
              </div>
              <ul className="mt-4 space-y-4">
                {club.news.map((item) => (
                  <li
                    key={item.title}
                    className="rounded-xl border bg-card p-5 shadow-sm"
                  >
                    <p className="text-xs font-medium text-[#c8a94a]">
                      {item.date}
                    </p>
                    <h3 className="mt-1 font-semibold text-[#1a2744]">
                      {item.title}
                    </h3>
                    <p className="mt-2 text-sm text-muted-foreground">
                      {item.excerpt}
                    </p>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="h-fit rounded-xl border bg-card p-6 shadow-sm lg:sticky lg:top-20">
            <h2 className="text-lg font-bold text-[#1a2744]">Visit Us</h2>

            <dl className="mt-4 space-y-4 text-sm">
              <div>
                <dt className="font-medium text-[#1a2744]">When</dt>
                <dd className="text-muted-foreground">{club.meetingSchedule}</dd>
              </div>
              <div>
                <dt className="font-medium text-[#1a2744]">Where</dt>
                <dd className="text-muted-foreground">{club.location}</dd>
              </div>
              <div>
                <dt className="font-medium text-[#1a2744]">Contact</dt>
                <dd>
                  <a
                    href={`mailto:${club.contactEmail}`}
                    className="text-muted-foreground hover:text-[#c8a94a]"
                  >
                    {club.contactEmail}
                  </a>
                </dd>
              </div>
            </dl>

            <p className="mt-6 text-xs text-muted-foreground">
              New players are always welcome. No membership required to attend
              your first meeting.
            </p>

            <Button asChild className="mt-4 w-full bg-[#c8a94a] font-semibold text-[#1a2744] hover:bg-[#c8a94a]/90">
              <Link to="/membership">Join LCA</Link>
            </Button>
          </div>
        </div>
      </section>
    </div>
  )
}