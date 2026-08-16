import type { Context, Config } from "@netlify/functions";

const FPL = "https://fantasy.premierleague.com/api";

async function json(url: string) {
  const r = await fetch(url, { headers: { "user-agent": "Mozilla/5.0" } });
  if (!r.ok) return { ok: false as const, status: r.status, data: null };
  return { ok: true as const, status: r.status, data: await r.json() };
}

export default async (req: Request, context: Context) => {
  try {
    const url = new URL(req.url);
    const entry = url.searchParams.get("entry")?.trim();
    if (!entry || !/^\d+$/.test(entry)) {
      return Response.json({ error: "Enter a valid numeric FPL Team ID." }, { status: 400 });
    }

    const [bootR, entryR] = await Promise.all([
      json(`${FPL}/bootstrap-static/`),
      json(`${FPL}/entry/${entry}/`),
    ]);

    if (!entryR.ok) {
      return Response.json({ error: entryR.status === 404 ? "FPL Team ID not found." : "Could not load that FPL team." }, { status: entryR.status === 404 ? 404 : 502 });
    }
    if (!bootR.ok) return Response.json({ error: "Could not load current FPL gameweek data." }, { status: 502 });

    const boot: any = bootR.data;
    const manager: any = entryR.data;
    const now = Date.now();
    const eligibleEvents = (boot.events || [])
      .filter((e: any) => e.id && new Date(e.deadline_time).getTime() <= now)
      .sort((a: any, b: any) => b.id - a.id);

    let picks: any = null;
    let eventId: number | null = null;
    for (const event of eligibleEvents) {
      const picksR = await json(`${FPL}/entry/${entry}/event/${event.id}/picks/`);
      if (picksR.ok && Array.isArray((picksR.data as any)?.picks)) {
        picks = picksR.data;
        eventId = event.id;
        break;
      }
    }

    if (!picks || eventId == null) {
      return Response.json({
        entry: Number(entry),
        manager: `${manager.player_first_name || ""} ${manager.player_last_name || ""}`.trim(),
        teamName: manager.name || "",
        publicPicksAvailable: false,
        message: "No public squad is available yet for this team this season. Public picks become available after a gameweek deadline.",
      });
    }

    const mapped = picks.picks.map((p: any) => ({
      playerId: p.element,
      position: p.position,
      multiplier: p.multiplier,
      captain: Boolean(p.is_captain),
      viceCaptain: Boolean(p.is_vice_captain),
      role: p.position <= 11 ? "start" : "bench",
    }));

    return Response.json({
      entry: Number(entry),
      manager: `${manager.player_first_name || ""} ${manager.player_last_name || ""}`.trim(),
      teamName: manager.name || "",
      event: eventId,
      publicPicksAvailable: true,
      picks: mapped,
      captainId: mapped.find((p: any) => p.captain)?.playerId || "",
      viceId: mapped.find((p: any) => p.viceCaptain)?.playerId || "",
      fetchedAt: new Date().toISOString(),
      source: "Official FPL API",
    });
  } catch (e: any) {
    return Response.json({ error: e?.message || "Unexpected error" }, { status: 500 });
  }
};

export const config: Config = { path: "/api/team" };
