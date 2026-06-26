export const TIER_DEFS = [
  { name: "Bronze",      color: "#CD7F32", minPdl: 0,    ratingBase: 65 },
  { name: "Prata",       color: "#C0C0C0", minPdl: 300,  ratingBase: 72 },
  { name: "Ouro",        color: "#FFD700", minPdl: 600,  ratingBase: 79 },
  { name: "Platina",     color: "#00B4D8", minPdl: 900,  ratingBase: 85 },
  { name: "Diamante",    color: "#B9F2FF", minPdl: 1200, ratingBase: 90 },
  { name: "Mestre",      color: "#9B59B6", minPdl: 1500, ratingBase: 93 },
  { name: "Grão-Mestre", color: "#E74C3C", minPdl: 1800, ratingBase: 97 },
] as const;

export type TierDef = typeof TIER_DEFS[number];

export function getTierInfo(pdl: number): { name: string; color: string; label: string; divIdx: number } {
  const clamped = Math.max(0, pdl);
  let tier: TierDef = TIER_DEFS[0];
  for (const t of TIER_DEFS) {
    if (clamped >= t.minPdl) tier = t;
  }
  const isSingle = tier.minPdl >= 1500;
  if (isSingle) {
    return { name: tier.name, color: tier.color, label: tier.name, divIdx: -1 };
  }
  const divIdx = Math.min(2, Math.floor((clamped - tier.minPdl) / 100));
  const div = ["III", "II", "I"][divIdx];
  return { name: tier.name, color: tier.color, label: `${tier.name} ${div}`, divIdx };
}

export function calcPdlDelta(won: boolean, myAvgRating: number, oppRating: number): number {
  const diff = oppRating - myAvgRating;
  if (won) return Math.round(Math.max(5, Math.min(40, 20 + diff * 0.6)));
  return -Math.round(Math.max(5, Math.min(30, 15 - diff * 0.6)));
}

export function nextMatchSlot(now: Date = new Date()): Date {
  const HOURS = [14, 17];
  for (let dayOffset = 0; dayOffset <= 1; dayOffset++) {
    for (const hour of HOURS) {
      const candidate = new Date(now);
      candidate.setDate(now.getDate() + dayOffset);
      candidate.setHours(hour, 0, 0, 0);
      if (candidate.getTime() > now.getTime() + 10 * 60 * 1000) return candidate;
    }
  }
  const fallback = new Date(now);
  fallback.setDate(now.getDate() + 2);
  fallback.setHours(14, 0, 0, 0);
  return fallback;
}

export function generateBotRating(myAvgRating: number, seed: number): number {
  // deterministic for testing: seed in [5,14]
  return Math.max(30, myAvgRating - seed);
}
