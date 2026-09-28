/**
 * Runs the decoder off the main thread.
 *
 * A game takes roughly 0.5-2 seconds to decode on a desktop (see
 * scanner/sandbox/bench.ts) and several times that on a phone. On the main
 * thread that would freeze the page, spinner included, for the whole time.
 * Loaded through decodeInBackground() in ./decodeInBackground.ts; nothing
 * else should import this file.
 */

import { decodeScan } from './decoder';
import type { DecodedGame, RawScan } from './types';

export interface DecodeRequest {
  id: number;
  scan: RawScan;
  /** Moves the member has fixed, from the start of the game. */
  forcedSans?: string[];
}

export type DecodeResponse =
  | { id: number; ok: true; game: DecodedGame }
  | { id: number; ok: false; error: string };

// The app's tsconfig uses the DOM lib, where `self` is a Window and
// postMessage wants a target origin. Inside a worker it takes one argument.
const scope = self as unknown as {
  onmessage: ((event: MessageEvent<DecodeRequest>) => void) | null;
  postMessage(message: DecodeResponse): void;
};

scope.onmessage = (event) => {
  const { id, scan, forcedSans } = event.data;
  let response: DecodeResponse;
  try {
    response = { id, ok: true, game: decodeScan(scan, forcedSans ? { forcedSans } : {}) };
  } catch (err) {
    response = { id, ok: false, error: err instanceof Error ? err.message : String(err) };
  }
  scope.postMessage(response);
};
