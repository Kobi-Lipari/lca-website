// functions/api/facebook-posts.ts
//
// GET /api/facebook-posts?limit=6
//
// Server-side proxy to the Facebook Graph API. The Page Access Token
// never touches the client — it's read here from a Cloudflare secret
// and the response is our own clean JSON shape.
//
// Required secrets (set via `wrangler pages secret put <name>`):
//   FACEBOOK_PAGE_TOKEN  - long-lived or System User Page Access Token
//   FACEBOOK_PAGE_ID     - the LCA Page's numeric ID

interface Env {
  FACEBOOK_PAGE_TOKEN: string;
  FACEBOOK_PAGE_ID: string;
}

interface GraphPost {
  id: string;
  message?: string;
  created_time: string;
  permalink_url: string;
  full_picture?: string;
}

interface GraphPostsResponse {
  data: GraphPost[];
  error?: { message: string; code: number };
}

export interface FacebookFeedPost {
  id: string;
  message: string;
  createdAt: string;
  permalinkUrl: string;
  imageUrl: string | null;
}

const GRAPH_VERSION = "v19.0";
// Cache the upstream response at Cloudflare's edge so we don't hit
// Facebook's rate limits on every page load. 30 min is plenty for a
// feed that updates a few times a week.
const CACHE_MAX_AGE_SECONDS = 1800;

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { env, request } = context;

  if (!env.FACEBOOK_PAGE_TOKEN || !env.FACEBOOK_PAGE_ID) {
    return jsonError("Facebook feed is not configured", 500);
  }

  const url = new URL(request.url);
  const limitParam = url.searchParams.get("limit");
  const limit = clampLimit(limitParam);

  const fields = "id,message,created_time,permalink_url,full_picture";
  const graphUrl =
    `https://graph.facebook.com/${GRAPH_VERSION}/${env.FACEBOOK_PAGE_ID}/posts` +
    `?fields=${fields}&limit=${limit}&access_token=${env.FACEBOOK_PAGE_TOKEN}`;

  let graphResponse: Response;
  try {
    graphResponse = await fetch(graphUrl);
  } catch (err) {
    return jsonError("Could not reach Facebook", 502);
  }

  let body: GraphPostsResponse;
  try {
    body = await graphResponse.json();
  } catch {
    return jsonError("Facebook returned an unexpected response", 502);
  }

  if (!graphResponse.ok || body.error) {
    // Don't leak the token or raw Graph error details to the client.
    // Log server-side only (visible in `wrangler pages deployment tail`).
    console.error("Facebook Graph API error:", body.error);
    return jsonError("Could not load Facebook posts", 502);
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

  return new Response(JSON.stringify({ posts }), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": `public, max-age=${CACHE_MAX_AGE_SECONDS}`,
    },
  });
};

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