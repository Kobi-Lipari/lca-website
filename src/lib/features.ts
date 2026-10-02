// src/lib/features.ts
//
// On/off switches for parts of the site that are built but not open yet.
// To turn one on, change its value to true and deploy. Nothing else needs
// to change: the code behind each switch stays in place.

export const FEATURES = {
  /**
   * The "By organizer" column on the Tournaments page, which lets visitors
   * filter by LCA club. Off until clubs are given permission to run their
   * own tournaments here.
   */
  clubTournaments: false,

  /**
   * The "USCF rated" and "Register on this site" quick filters on the
   * Tournaments page. Off until the listings carry reliable rating and
   * registration details for every event.
   */
  tournamentQuickFilters: false,

  /**
   * The "Ext" / "External" tags that mark events not run through this site.
   * Off while every listed event is external, since the tag says nothing.
   */
  externalTags: false,
} as const
