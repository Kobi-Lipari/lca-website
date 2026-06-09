import { Link } from 'react-router-dom'
import {
  Building2,
  Crown,
  Mail,
  MapPin,
  Phone,
  Users,
} from 'lucide-react'

import { Button } from '@/components/ui/button'

interface BoardMember {
  name: string
  role: string
}

interface AffiliatedClub {
  name: string
  city: string
}

const boardMembers: BoardMember[] = [
  { name: 'Dr. Robert Chen', role: 'President' },
  { name: 'Maria Santos', role: 'Vice President' },
  { name: 'James Whitfield', role: 'Secretary' },
  { name: 'Linda Foster', role: 'Treasurer' },
  { name: 'Andre Williams', role: 'Tournament Director' },
  { name: 'Priya Patel', role: 'Membership Chair' },
  { name: 'David Chen', role: 'Scholastic Coordinator' },
  { name: 'Grace Wilson', role: 'Communications' },
]

const affiliatedClubs: AffiliatedClub[] = [
  { name: 'Baton Rouge Chess Club', city: 'Baton Rouge' },
  { name: 'New Orleans Chess Club', city: 'New Orleans' },
  { name: 'Shreveport Chess Society', city: 'Shreveport' },
  { name: 'Lafayette Chess Alliance', city: 'Lafayette' },
  { name: 'Lake Charles Chess Society', city: 'Lake Charles' },
  { name: 'Monroe Chess Club', city: 'Monroe' },
  { name: 'Alexandria Chess Club', city: 'Alexandria' },
  { name: 'Hammond Scholastic Chess', city: 'Hammond' },
  { name: 'Slidell Chess Club', city: 'Slidell' },
  { name: 'Ruston Chess Club', city: 'Ruston' },
  { name: 'Thibodaux Chess Club', city: 'Thibodaux' },
  { name: 'Covington Chess Club', city: 'Covington' },
  { name: 'Metairie Chess Club', city: 'Metairie' },
  { name: 'Natchitoches Chess Club', city: 'Natchitoches' },
  { name: 'Kenner Chess Club', city: 'Kenner' },
]

const goldButtonClass =
  'bg-[#c8a94a] font-semibold text-[#1a2744] hover:bg-[#c8a94a]/90'

export function AboutPage() {
  return (
    <div>
      <section className="border-b-4 border-[#c8a94a] bg-[#1a2744] text-white">
        <div className="mx-auto max-w-6xl px-6 py-12">
          <div className="flex items-center gap-3">
            <Building2 className="size-8 text-[#c8a94a] sm:size-10" />
            <div>
              <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
                About the LCA
              </h1>
              <p className="mt-2 max-w-2xl text-white/80">
                The Louisiana Chess Association is the official state affiliate
                promoting chess education, competition, and community across
                Louisiana.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-12">
        <h2 className="text-2xl font-bold text-[#1a2744]">Our Mission</h2>
        <div className="mt-6 max-w-3xl space-y-4 text-muted-foreground">
          <p>
            The Louisiana Chess Association exists to promote the study and
            knowledge of chess throughout the state of Louisiana. We organize
            USCF-rated tournaments, support affiliated clubs, and foster a
            welcoming community for players of all ages and skill levels.
          </p>
          <p>
            From scholastic programs in classrooms to weekend open tournaments
            in every region of the state, the LCA works to make chess accessible
            to everyone. We believe chess builds critical thinking, sportsmanship,
            and lifelong friendships.
          </p>
          <p>
            As a nonprofit organization governed by elected board members, the
            LCA is committed to transparent leadership, USCF compliance, and
            serving Louisiana&apos;s chess community for generations to come.
          </p>
        </div>
      </section>

      <section className="bg-muted/30">
        <div className="mx-auto max-w-6xl px-6 py-12">
          <div className="flex items-center gap-2">
            <Crown className="size-6 text-[#c8a94a]" />
            <h2 className="text-2xl font-bold text-[#1a2744]">
              Board of Directors
            </h2>
          </div>
          <p className="mt-1 text-muted-foreground">
            The LCA is governed by a volunteer board elected by membership.
            Placeholder names below — to be updated with current officers.
          </p>

          <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {boardMembers.map((member) => (
              <li
                key={member.name}
                className="rounded-xl border bg-card p-5 shadow-sm"
              >
                <p className="font-semibold text-[#1a2744]">{member.name}</p>
                <p className="mt-1 text-sm text-[#c8a94a]">{member.role}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-12">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <Users className="size-6 text-[#c8a94a]" />
              <h2 className="text-2xl font-bold text-[#1a2744]">
                Affiliated Clubs
              </h2>
            </div>
            <p className="mt-1 text-muted-foreground">
              {affiliatedClubs.length} chess clubs across Louisiana are
              affiliated with the LCA.
            </p>
          </div>
          <Button asChild variant="outline" className="mt-2 w-fit sm:mt-0">
            <Link to="/clubs">View all clubs</Link>
          </Button>
        </div>

        <ul className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {affiliatedClubs.map((club) => (
            <li
              key={club.name}
              className="flex items-center gap-3 rounded-xl border bg-card px-4 py-3 shadow-sm"
            >
              <MapPin className="size-4 shrink-0 text-[#c8a94a]" />
              <div>
                <p className="font-medium text-[#1a2744]">{club.name}</p>
                <p className="text-sm text-muted-foreground">{club.city}</p>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className="bg-[#1a2744] text-white">
        <div className="mx-auto max-w-6xl px-6 py-12">
          <h2 className="text-2xl font-bold">Contact Us</h2>
          <p className="mt-2 max-w-xl text-white/80">
            Have questions about membership, tournaments, or club affiliation?
            Reach out to the LCA board.
          </p>

          <ul className="mt-8 space-y-4">
            <li className="flex items-start gap-3">
              <Mail className="mt-0.5 size-5 shrink-0 text-[#c8a94a]" />
              <div>
                <p className="font-medium">Email</p>
                <a
                  href="mailto:info@louisianachess.org"
                  className="text-sm text-white/80 hover:text-[#c8a94a]"
                >
                  info@louisianachess.org
                </a>
              </div>
            </li>
            <li className="flex items-start gap-3">
              <Phone className="mt-0.5 size-5 shrink-0 text-[#c8a94a]" />
              <div>
                <p className="font-medium">Phone</p>
                <p className="text-sm text-white/80">(504) 555-0142</p>
              </div>
            </li>
            <li className="flex items-start gap-3">
              <MapPin className="mt-0.5 size-5 shrink-0 text-[#c8a94a]" />
              <div>
                <p className="font-medium">Mailing Address</p>
                <p className="text-sm text-white/80">
                  Louisiana Chess Association
                  <br />
                  P.O. Box 1234
                  <br />
                  Baton Rouge, LA 70801
                </p>
              </div>
            </li>
          </ul>

          <Button asChild size="lg" className={`mt-8 ${goldButtonClass}`}>
            <Link to="/membership">Become a Member</Link>
          </Button>
        </div>
      </section>
    </div>
  )
}