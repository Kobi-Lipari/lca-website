// src/areas/admin/mediaManagerAnswer.ts
//
// The media manager's answer (WS16 step 6) as Admin's page reads it: the
// answer the route that let the person in was given, handed down by
// RoleProtectedRoute, so the page draws what the route decided and asks
// nothing itself. It makes no call: useMediaManager.ts asks the server, and
// this module stays apart from it so that Admin's page, a chunk of its own,
// takes in no call, which would move the sign-in library out of the main
// script into a chunk of its own.

import { createContext, useContext } from 'react'

export interface MediaManagerAnswer {
  /** True while the first answer for this session is on the way, so a route waits as it waits for a session. */
  asking: boolean
  mediaManager: boolean
  secondFactor: boolean
}

/** The answer before anything is asked, and with mailLists off: no. */
export const NOT_ASKED: MediaManagerAnswer = { asking: false, mediaManager: false, secondFactor: false }

/** The answer the route let the person in on, for the page inside it; no, outside a route that lets the media manager in. */
export const MediaManagerAnswerContext = createContext<MediaManagerAnswer>(NOT_ASKED)

/** The route's answer, read by the page it let the person into. */
export function useMediaManagerAnswer(): MediaManagerAnswer {
  return useContext(MediaManagerAnswerContext)
}
