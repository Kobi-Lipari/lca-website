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
} as const
