// functions/api/facebook-posts.ts
//
// GET /api/facebook-posts?limit=6
//
// Server-side proxy to the Facebook Graph API. The Page Access Token
// never touches the client — it's read here from a Cloudflare secret
// and the response is our own clean JSON shape.
//
// FALLBACK BEHAVIOR: every successful fetch is saved into the
// facebook_feed_cache D1 table. If the live Graph API call ever fails —
// token expired, rate limited, Facebook down, network error — we serve
// the last known-good cached posts instead of an error, so the feed
// never goes visibly blank just because of a transient (or token-expiry)
// hiccup. Only returns an actual error if there's also nothing cached yet.

interface Env {
  DB: D1Database
  FACEBOOK_PAGE_TOKEN: string
  FACEBOOK_PAGE_ID: string
}

interface GraphPost {
  id: string
  message?: string
  created_time: string
  permalink_url: string
  full_picture?: string
}

interface GraphPostsResponse {
  data: GraphPost[]
  error?: { message: string; code: number }
}

export interface FacebookFeedPost {
  id: string
  message: string
  createdAt: string
  permalinkUrl: string
  imageUrl: string | null
}

const GRAPH_VERSION = "v19.0";
// Edge cache (Cloudflare CDN) — short-lived, just avoids hitting Facebook
// on every page load under normal conditions.
const CACHE_MAX_AGE_SECONDS = 1800;

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { env, request } = context;

  if (!env.FACEBOOK_PAGE_TOKEN || !env.FACEBOOK_PAGE_ID) {
    return await servedFromCacheOrError(env, "Facebook feed is not configured");
  }

  const url = new URL(request.url);
  const limit = clampLimit(url.searchParams.get("limit"));

  const fields = "id,message,created_time,permalink_url,full_picture";
  const graphUrl =
    `https://graph.facebook.com/${GRAPH_VERSION}/${env.FACEBOOK_PAGE_ID}/posts` +
    `?fields=${fields}&limit=${limit}&access_token=${env.FACEBOOK_PAGE_TOKEN}`;

  let graphResponse: Response;
  try {
    graphResponse = await fetch(graphUrl);
  } catch (err) {
    console.error("facebook-posts: network error reaching Facebook", err);
    return await servedFromCacheOrError(env, "Could not reach Facebook");
  }

  let body: GraphPostsResponse;
  try {
    body = await graphResponse.json();
  } catch {
    return await servedFromCacheOrError(env, "Facebook returned an unexpected response");
  }

  if (!graphResponse.ok || body.error) {
    // Covers rate limiting, an expired/invalid token, permission errors, etc.
    console.error("facebook-posts: Graph API error, falling back to cache:", body.error);
    return await servedFromCacheOrError(env, "Could not load Facebook posts");
  }

  const posts: FacebookFeedPost[] = (body.data || [])
    .filter((p) => p.message) // skip posts with no text (pure photo posts, etc.)
    .map((p) => ({
      id: p.id,
      message: p.message ?? "",
      createdAt: p.created_time,
      permalinkUrl: p.permalink_url,
      imageUrl: p.full_picture ?? null,
    }));

  // Live fetch succeeded — persist it as the new fallback for next time.
  try {
    await env.DB.prepare(
      `UPDATE facebook_feed_cache SET posts_json = ?, cached_at = datetime('now') WHERE id = 1`
    ).bind(JSON.stringify(posts)).run();
  } catch (err) {
    // Don't fail the request just because the cache write failed — the
    // user still gets fresh, correct data this time either way.
    console.error("facebook-posts: failed to update cache", err);
  }

  return new Response(JSON.stringify({ posts }), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": `public, max-age=${CACHE_MAX_AGE_SECONDS}`,
    },
  });
};

async function servedFromCacheOrError(env: Env, failureReason: string): Promise<Response> {
  try {
    const row = await env.DB.prepare(
      `SELECT posts_json, cached_at FROM facebook_feed_cache WHERE id = 1`
    ).first<{ posts_json: string; cached_at: string | null }>();

    if (row && row.cached_at) {
      const posts = JSON.parse(row.posts_json) as FacebookFeedPost[];
      if (posts.length > 0) {
        // Short cache header here — we don't want the CDN holding onto a
        // stale-fallback response for a full 30 min if the live API
        // recovers moments later.
        return new Response(JSON.stringify({ posts, stale: true, cachedAt: row.cached_at }), {
          status: 200,
          headers: {
            "Content-Type": "application/json",
            "Cache-Control": "public, max-age=60",
          },
        });
      }
    }
  } catch (err) {
    console.error("facebook-posts: cache read failed too", err);
  }

  // No cache to fall back on (e.g. very first request ever, or the cache
  // table is genuinely empty) — only now do we actually return an error.
  return jsonError(failureReason, 502);
}

function clampLimit(raw: string | null): number {
  const n = raw ? parseInt(raw, 10) : 6;
  if (Number.isNaN(n) || n < 1) return 6;
  return Math.min(n, 25);
}

function jsonError(message: string, status: number): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}