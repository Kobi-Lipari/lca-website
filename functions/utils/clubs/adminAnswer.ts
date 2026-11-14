// functions/utils/clubs/adminAnswer.ts
//
// The columns of clubs today's admin club answers carry: GET and PATCH of
// /api/admin/clubs/[id] and POST /api/admin/clubs. They read SELECT * until
// migration 0066 added the club page's fifteen columns; they now name
// today's 13, so each answers exactly what it answered before, and a column
// WS09 adds reaches an answer only once a step names it here.

/** Today's 13 columns of clubs, in the table's own order, as one select list. */
export const ADMIN_CLUB_COLUMNS =
  'id, name, city, location, description, meeting_schedule, contact_email, created_at, color, image_url, region, latitude, longitude'
