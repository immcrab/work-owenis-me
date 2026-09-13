// Public endpoint: anyone can submit a game link. A screenshot of the URL
// is taken (microlink.io) and judged by a vision model (Mistral Large 3) —
// only pages that look like a real, loaded site get inserted into `games`
// under category "Unofficial". Runs with the service role key so it can
// insert past RLS; every attempt (accepted or not) is logged for per-anon
// rate limiting.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const MISTRAL_MODEL = "mistral-large-2512";
const MAX_SUBMISSIONS_PER_DAY = 5;

const BLOCKED_HOST_PATTERNS = [
  /^localhost$/i,
  /^127\./,
  /^0\.0\.0\.0$/,
  /^10\./,
  /^192\.168\./,
  /^172\.(1[6-9]|2\d|3[0-1])\./,
  /^169\.254\./,
  /\.local$/i,
  /\.internal$/i,
  /^\[?::1\]?$/,
];

function slugify(name: string): string {
  const s = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 30);
  return s || "game";
}

function isBlockedHost(hostname: string): boolean {
  return BLOCKED_HOST_PATTERNS.some((re) => re.test(hostname));
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS_HEADERS });
  if (req.method !== "POST") return json({ ok: false, error: "method_not_allowed" }, 405);

  let body: { name?: string; url?: string; desc?: string; anon_id?: string };
  try {
    body = await req.json();
  } catch {
    return json({ ok: false, error: "bad_json" }, 400);
  }

  const name = (body.name || "").trim().slice(0, 60);
  const desc = (body.desc || "").trim().slice(0, 140);
  const anonId = (body.anon_id || "").trim().slice(0, 100);

  let url: URL;
  try {
    url = new URL((body.url || "").trim());
  } catch {
    return json({ ok: false, error: "invalid_url" }, 400);
  }

  if (!name || !anonId) return json({ ok: false, error: "missing_fields" }, 400);
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return json({ ok: false, error: "invalid_url" }, 400);
  }
  if (isBlockedHost(url.hostname)) return json({ ok: false, error: "blocked_host" }, 400);

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const mistralKey = Deno.env.get("MISTRAL_API_KEY")!;
  const db = createClient(supabaseUrl, serviceKey);

  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { count } = await db
    .from("game_submission_log")
    .select("id", { count: "exact", head: true })
    .eq("anon_id", anonId)
    .gte("created_at", since);

  if ((count || 0) >= MAX_SUBMISSIONS_PER_DAY) {
    return json({ ok: false, error: "rate_limited" }, 429);
  }

  async function logSubmission(slug: string | null, verdict: number | null, reason: string) {
    await db.from("game_submission_log").insert({
      anon_id: anonId,
      url: url.toString(),
      slug,
      verdict,
      reason,
    });
  }

  let screenshotUrl: string | undefined;
  try {
    const microlinkRes = await fetch(
      `https://api.microlink.io?url=${encodeURIComponent(url.toString())}&screenshot=true&meta=false`
    );
    const microlinkData = await microlinkRes.json();
    screenshotUrl = microlinkData?.data?.screenshot?.url;
    if (!screenshotUrl) throw new Error("no screenshot in response");
  } catch {
    await logSubmission(null, 2, "screenshot_failed");
    return json({
      ok: true,
      verdict: 2,
      message: "Couldn't load that site to check it — is it publicly reachable?",
    });
  }

  let verdict = 2;
  let reason = "unclear";
  try {
    const visionRes = await fetch("https://api.mistral.ai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${mistralKey}`,
      },
      body: JSON.stringify({
        model: MISTRAL_MODEL,
        temperature: 0,
        max_tokens: 60,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text:
                  "This screenshot is of a website just submitted to a game link directory. " +
                  "Decide if it shows a working, loaded page (a game, a real site, real content) " +
                  "versus a broken page (browser error, DNS failure, blank white page, 404, timeout, " +
                  "parked/for-sale domain, ad-only page). " +
                  "Reply with exactly one line: '1' if it's working, or '2' if it's not working. " +
                  "Then on a second line, a short reason (under 12 words).",
              },
              { type: "image_url", image_url: screenshotUrl },
            ],
          },
        ],
      }),
    });
    const visionData = await visionRes.json();
    const text: string = visionData?.choices?.[0]?.message?.content?.trim() || "";
    const lines = text.split("\n").map((l: string) => l.trim()).filter(Boolean);
    verdict = lines[0]?.startsWith("1") ? 1 : 2;
    reason = lines[1] || (verdict === 1 ? "looks good" : "looks broken");
  } catch {
    verdict = 2;
    reason = "vision_check_failed";
  }

  if (verdict !== 1) {
    await logSubmission(null, verdict, reason);
    return json({ ok: true, verdict: 2, message: `Didn't look like a working site: ${reason}` });
  }

  let slug = slugify(name);
  const { data: existing } = await db.from("games").select("slug").ilike("slug", `${slug}%`);
  const taken = new Set((existing || []).map((r: { slug: string }) => r.slug));
  if (taken.has(slug)) {
    let i = 2;
    while (taken.has(`${slug}-${i}`)) i++;
    slug = `${slug}-${i}`;
  }

  const { error: insertError } = await db.from("games").insert({
    slug,
    name,
    description: desc || null,
    url: url.toString(),
    category: "Unofficial",
    status: "approved",
    submitted_by: anonId,
    visits: 0,
    likes: 0,
    dislikes: 0,
  });

  if (insertError) {
    await logSubmission(slug, verdict, "insert_failed: " + insertError.message);
    return json({ ok: false, error: "insert_failed" }, 500);
  }

  await logSubmission(slug, verdict, reason);
  return json({ ok: true, verdict: 1, message: "Added to Unofficial!", slug });
});
