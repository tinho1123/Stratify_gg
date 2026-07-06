// Definição de tiers/elo, compartilhada entre telas do app.
// Os valores de `minPdl` precisam ficar em sincronia com a função `tier_for_pdl`
// em database/migrations/018_create_seasons.sql — mudar um lado sem o outro
// quebra o vínculo entre a tier exibida no app e a liga/temporada no servidor.

export interface TierDef {
  name: string;
  color: string;
  minPdl: number;
  ratingBase: number;
}

export const TIER_DEFS: readonly TierDef[] = [
  { name: "Bronze",      color: "#CD7F32", minPdl: 0,    ratingBase: 65 },
  { name: "Prata",       color: "#C0C0C0", minPdl: 300,  ratingBase: 72 },
  { name: "Ouro",        color: "#FFD700", minPdl: 600,  ratingBase: 79 },
  { name: "Platina",     color: "#00B4D8", minPdl: 900,  ratingBase: 85 },
  { name: "Diamante",    color: "#B9F2FF", minPdl: 1200, ratingBase: 90 },
  { name: "Mestre",      color: "#9B59B6", minPdl: 1500, ratingBase: 93 },
  { name: "Grão-Mestre", color: "#E74C3C", minPdl: 1800, ratingBase: 97 },
] as const;

export const DIVISIONS = ["III", "II", "I"] as const;

export interface TierInfo {
  tier: string;
  division: string;   // "III" | "II" | "I" | ""
  color: string;
  pdlInDiv: number;   // PDL dentro da divisão atual (0-100)
  pdlForNext: number; // PDL faltando para a próxima divisão/tier
  totalPdl: number;
}

export function getTierInfo(pdl: number): TierInfo {
  const clamped = Math.max(0, pdl);
  let tierIdx = TIER_DEFS.length - 1;
  for (let i = TIER_DEFS.length - 1; i >= 0; i--) {
    if (clamped >= TIER_DEFS[i].minPdl) { tierIdx = i; break; }
  }
  const tier = TIER_DEFS[tierIdx];
  const isSingleDiv = tierIdx >= 5; // Mestre / Grão-Mestre não têm divisões

  if (isSingleDiv) {
    return {
      tier:       tier.name,
      division:   "",
      color:      tier.color,
      pdlInDiv:   clamped - tier.minPdl,
      pdlForNext: tierIdx < TIER_DEFS.length - 1 ? TIER_DEFS[tierIdx + 1].minPdl - clamped : 0,
      totalPdl:   clamped,
    };
  }

  const relPdl   = clamped - tier.minPdl;          // 0–299 dentro dessa tier
  const divIdx   = Math.min(2, Math.floor(relPdl / 100)); // 0=III, 1=II, 2=I
  const pdlInDiv = relPdl - divIdx * 100;
  const pdlForNext = 100 - pdlInDiv;

  return {
    tier:       tier.name,
    division:   DIVISIONS[divIdx],
    color:      tier.color,
    pdlInDiv,
    pdlForNext,
    totalPdl:   clamped,
  };
}

export function tierIdxForPdl(pdl: number): number {
  if (pdl >= TIER_DEFS[TIER_DEFS.length - 1].minPdl) return TIER_DEFS.length - 1;
  const idx = TIER_DEFS.findIndex((t) => pdl < t.minPdl);
  return Math.max(0, idx - 1);
}
