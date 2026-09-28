/**
 * The one way the app should run the decoder: in a Web Worker, so the page
 * stays responsive while a game decodes.
 *
 * A fresh worker per decode, closed as soon as it answers. Scans are rare
 * (a handful per member per day), so keeping a worker alive would hold the
 * decoder and chess.js in memory for nothing, and a new worker also starts
 * with an empty position cache every time.
 *
 * Where workers aren't available (very old browsers, some test runners) it
 * falls back to decoding on the main thread: slower to feel, same result.
 */

import type { DecodeRequest, DecodeResponse } from './decode.worker';
import type { DecodedGame, RawScan } from './types';

let nextId = 1;

export function decodeInBackground(scan: RawScan): Promise<DecodedGame> {
  if (typeof Worker === 'undefined') {
    return import('./decoder').then(({ decodeScan }) => decodeScan(scan));
  }

  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL('./decode.worker.ts', import.meta.url), {
      type: 'module',
    });
    const id = nextId++;

    worker.onmessage = (event: MessageEvent<DecodeResponse>) => {
      if (event.data.id !== id) return;
      worker.terminate();
      if (event.data.ok) resolve(event.data.game);
      else reject(new Error(event.data.error));
    };

    worker.onerror = (event) => {
      worker.terminate();
      reject(new Error(event.message || 'The decoder failed to start.'));
    };

    const request: DecodeRequest = { id, scan };
    worker.postMessage(request);
  });
}
