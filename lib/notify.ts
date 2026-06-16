import { Resend } from "resend";

export type RouteChange = {
  routeName: string;
  routeUrl: string;
  statsUrl: string;
  newTicks: number;
  newComments: number;
  newStars: number;
  newTodos: number;
  newRatings: number;
  commentSamples: Array<{ author: string; snippet: string }>;
  tickSamples: Array<{ author: string; snippet: string }>;
  starSamples: Array<{ author: string; snippet: string }>;
  ratingSamples: Array<{ author: string; snippet: string }>;
};

export async function sendDigest(changes: RouteChange[]): Promise<void> {
  if (changes.length === 0) return;
  const key = process.env.RESEND_API_KEY;
  const to = process.env.NOTIFY_EMAIL;
  const from = process.env.NOTIFY_FROM;
  if (!key || !to || !from) {
    console.warn("Resend env vars missing; skipping email.");
    return;
  }

  const resend = new Resend(key);
  const subject = `MP Tracker: activity on ${changes.length} route${changes.length === 1 ? "" : "s"}`;

  const html = changes
    .map((c) => {
      const counts: string[] = [];
      if (c.newTicks > 0) counts.push(`<strong>${c.newTicks}</strong> new tick${c.newTicks === 1 ? "" : "s"}`);
      if (c.newComments > 0)
        counts.push(`<strong>${c.newComments}</strong> new comment${c.newComments === 1 ? "" : "s"}`);
      if (c.newStars > 0)
        counts.push(`<strong>${c.newStars}</strong> new star rating${c.newStars === 1 ? "" : "s"}`);
      if (c.newRatings > 0)
        counts.push(`<strong>${c.newRatings}</strong> new grade suggestion${c.newRatings === 1 ? "" : "s"}`);
      if (c.newTodos > 0)
        counts.push(`<strong>${c.newTodos}</strong> added to to-do list${c.newTodos === 1 ? "" : "s"}`);

      return `
        <h3 style="margin:28px 0 4px"><a href="${c.routeUrl}">${escapeHtml(c.routeName)}</a></h3>
        <div style="font-size:13px;color:#666;margin-bottom:4px">
          <a href="${c.routeUrl}">Route page</a> &middot; <a href="${c.statsUrl}">Stats page</a>
        </div>
        <div style="color:#555">${counts.join(" &middot; ")}</div>
        ${section("New ticks", c.tickSamples)}
        ${section("New comments", c.commentSamples)}
        ${section("New star ratings", c.starSamples)}
        ${section("New grade suggestions", c.ratingSamples)}
      `;
    })
    .join("\n");

  await resend.emails.send({
    from,
    to,
    subject,
    html: `<div style="font-family:system-ui;max-width:680px;line-height:1.45">${html}</div>`,
  });
}

function section(title: string, samples: Array<{ author: string; snippet: string }>): string {
  if (samples.length === 0) return "";
  const items = samples
    .slice(0, 8)
    .map(
      (s) =>
        `<li style="margin:4px 0"><em>${escapeHtml(s.author || "Anonymous")}</em>: ${escapeHtml(s.snippet)}</li>`,
    )
    .join("");
  return `<p style="margin:10px 0 2px"><strong>${title}:</strong></p><ul style="margin:0 0 8px;padding-left:18px">${items}</ul>`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
