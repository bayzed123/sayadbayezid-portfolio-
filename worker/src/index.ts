import { Hono } from "hono";
import { cors } from "hono/cors";

type Env = {
  META_CONVERSIONS_API_TOKEN: string;
  META_PIXEL_ID: string;
  DB: D1Database;
};

const app = new Hono<{ Bindings: Env }>();
app.use("*", cors());

const uid = () => crypto.randomUUID();

// ---------------------------------------------------------------------------
// Reviews — public submission, admin-approved before showing on the site.
// No login system for this site, so "admin" is just direct D1 access for
// now (ask to have one approved/rejected) rather than a full auth flow.
// ---------------------------------------------------------------------------
app.post("/api/reviews", async (c) => {
  const body = await c.req.json<{ name?: string; avatarUrl?: string; rating?: number; comment?: string }>();
  if (!body.name?.trim() || !body.comment?.trim()) {
    return c.json({ error: "Name and a comment are required." }, 400);
  }
  if (!body.rating || body.rating < 1 || body.rating > 5) {
    return c.json({ error: "Rating must be 1–5." }, 400);
  }
  await c.env.DB.prepare(
    `INSERT INTO reviews (id, name, avatar_url, rating, comment) VALUES (?, ?, ?, ?, ?)`
  )
    .bind(uid(), body.name.trim().slice(0, 80), body.avatarUrl?.trim() || null, body.rating, body.comment.trim().slice(0, 500))
    .run();
  return c.json({ ok: true, note: "Thanks — this will show once it's approved." });
});

app.get("/api/reviews", async (c) => {
  const { results } = await c.env.DB
    .prepare(`SELECT name, avatar_url, rating, comment, created_at FROM reviews WHERE approved = 1 ORDER BY created_at DESC LIMIT 20`)
    .all();
  return c.json({ reviews: results });
});

// ---------------------------------------------------------------------------
// Contact form — stored in D1; also fires the Lead Conversions API event
// (the browser-side fbq('track','Lead') call happens on the page itself,
// with the same event_id, right before this request goes out).
// ---------------------------------------------------------------------------
app.post("/api/contact", async (c) => {
  const body = await c.req.json<{ name?: string; email?: string; message?: string }>();
  if (!body.name?.trim() || !body.email?.trim() || !body.message?.trim()) {
    return c.json({ error: "Name, email, and a message are all required." }, 400);
  }
  await c.env.DB.prepare(`INSERT INTO contact_submissions (id, name, email, message) VALUES (?, ?, ?, ?)`)
    .bind(uid(), body.name.trim().slice(0, 120), body.email.trim().slice(0, 200), body.message.trim().slice(0, 2000))
    .run();
  return c.json({ ok: true });
});

/**
 * Receives the same event the browser Pixel already fired (fbq('track', ...))
 * and forwards it to Meta server-side via Conversions API — this is the
 * "dual delivery" pattern Meta recommends: the browser Pixel can be blocked
 * by ad-blockers/Safari's tracking prevention, so CAPI is a second, more
 * reliable path for the SAME event. event_id must match what the browser
 * sent so Meta de-duplicates them into one event, not two.
 */
app.post("/api/track", async (c) => {
  const body = await c.req.json<{
    event_name?: string;
    event_id?: string;
    event_source_url?: string;
    custom_data?: Record<string, unknown>;
    user_data?: { em?: string; ph?: string }; // pre-hashed (SHA-256) if you ever collect email/phone — never send raw
  }>();

  if (!body.event_name || !body.event_id) {
    return c.json({ error: "event_name and event_id are required." }, 400);
  }

  const clientIp = c.req.header("CF-Connecting-IP") || undefined;
  const userAgent = c.req.header("User-Agent") || undefined;

  const payload = {
    data: [
      {
        event_name: body.event_name,
        event_time: Math.floor(Date.now() / 1000),
        event_id: body.event_id,
        event_source_url: body.event_source_url,
        action_source: "website",
        user_data: {
          client_ip_address: clientIp,
          client_user_agent: userAgent,
          ...(body.user_data ?? {}),
        },
        custom_data: body.custom_data ?? {},
      },
    ],
  };

  try {
    const resp = await fetch(
      `https://graph.facebook.com/v21.0/${c.env.META_PIXEL_ID}/events?access_token=${c.env.META_CONVERSIONS_API_TOKEN}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }
    );
    const result = await resp.json();
    if (!resp.ok) return c.json({ error: "Meta rejected the event.", detail: result }, 502);
    return c.json({ ok: true });
  } catch (e: any) {
    return c.json({ error: e.message ?? "Couldn't reach Meta right now." }, 502);
  }
});

app.onError((err, c) => {
  console.error(err);
  return c.json({ error: err.message || "Something went wrong on the server." }, 500);
});

export default app;
