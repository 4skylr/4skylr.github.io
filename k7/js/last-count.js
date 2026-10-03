export function lastCount(sessions, id) {
  const rows = (sessions || []).filter(s => s.status === "committed" && s.counts && s.counts[id] != null);
  rows.sort((a, b) => (b.committedAt || "").localeCompare(a.committedAt || ""));
  const s = rows[0];
  if (!s) return null;
  const counted = Number(s.counts[id]);
  const system = Number(s.system?.[id] || 0);
  return { at: s.committedAt, by: s.counter || "—", location: s.location, counted, system, diff: counted - system };
}
