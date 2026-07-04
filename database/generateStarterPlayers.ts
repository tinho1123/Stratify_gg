import { supabase } from "@/database/supabase";

// ─── Types ────────────────────────────────────────────────────────────────────

type Level   = "ruim" | "mediano";
type Role    = "IGL" | "AWPer" | "Support" | "Entry" | "Flex";
type Profile = "afobado" | "lento" | "suporte_nato" | "inconsistente" | "disciplinado";

const ROLES: Role[]       = ["IGL", "AWPer", "Support", "Entry", "Flex"];
const PROFILES: Profile[] = ["afobado", "lento", "suporte_nato", "inconsistente", "disciplinado"];

// ─── Name pools (sem dependência externa) ────────────────────────────────────

const NAME_PREFIXES  = ["z", "x", "v", "k", "n", "s", "d"];
const NAME_WORDS     = [
  "blade", "wolf", "nova", "frost", "raven", "storm", "ghost",
  "viper", "cipher", "echo", "reaper", "shadow", "phantom", "blaze",
  "hawk", "spike", "lotus", "apex", "pulse", "neon", "void", "zero",
  "saber", "jinx", "flare", "drift", "omen", "hunt", "crest",
];
const NAME_ADJECTIVES = [
  "cold", "dark", "swift", "sharp", "wild", "dead", "lone",
  "iron", "steel", "bold", "hard", "grim", "pure", "fast",
];

// ─── Category adjustments by role ────────────────────────────────────────────

const ROLE_CAT_ADJ: Record<Role, Record<string, number>> = {
  IGL:     { combate: -8,  mecanica: -5, game_sense: +10, consciencia: +3,  equipe: +10 },
  AWPer:   { combate: +10, mecanica: +5, game_sense:   0, consciencia:  0,  equipe: -8  },
  Support: { combate: -8,  mecanica:  0, game_sense:  +5, consciencia: +8,  equipe: +10 },
  Entry:   { combate: +10, mecanica: +8, game_sense:  -8, consciencia:  0,  equipe: -8  },
  Flex:    { combate:  0,  mecanica:  0, game_sense:   0, consciencia:  0,  equipe:  0  },
};

// ─── Specific attribute adjustments by role ───────────────────────────────────

const ROLE_ATTR_ADJ: Record<Role, Record<string, number>> = {
  IGL:     { decisao: +5, comunicacao: +5, leitura: +5 },
  AWPer:   { aim: +8, precisao: +8, reacao: +5, utilitarios: -5 },
  Support: { comunicacao: +5, teamplay: +5, utilitarios: +8 },
  Entry:   { reacao: +5, flick: +5, decisao: -5 },
  Flex:    {},
};

// ─── Specific attribute adjustments by profile ────────────────────────────────

const PROFILE_ATTR_ADJ: Record<Profile, Record<string, number>> = {
  afobado:       { reacao: +12, decisao: -10 },
  lento:         { leitura: +10, reacao: -10 },
  suporte_nato:  { teamplay: +10, comunicacao: +8, aim: -8 },
  inconsistente: {},
  disciplinado:  {},
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function ri(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pick<T>(arr: T[]): T {
  return arr[ri(0, arr.length - 1)];
}

function clamp(v: number): number {
  return Math.max(25, Math.min(70, Math.round(v)));
}

function mean(vals: number[]): number {
  return vals.reduce((a, b) => a + b, 0) / vals.length;
}

// ─── Attribute generator ──────────────────────────────────────────────────────

function genAttr(
  level: Level,
  category: string,
  attr: string,
  role: Role,
  profile: Profile
): number {
  const BASE: Record<Level, [number, number]> = {
    ruim:    [30, 55],
    mediano: [50, 65],
  };

  let [min, max] = BASE[level];
  const catAdj = ROLE_CAT_ADJ[role][category] ?? 0;
  min += catAdj;
  max += catAdj;

  if (profile === "inconsistente") {
    const shift = ri(-12, 12);
    min += shift;
    max += shift;
  } else if (profile === "disciplinado") {
    const mid = Math.round((min + max) / 2);
    min = mid - 4;
    max = mid + 4;
  }

  const specificAdj =
    (ROLE_ATTR_ADJ[role][attr] ?? 0) +
    (PROFILE_ATTR_ADJ[profile][attr] ?? 0);

  return clamp(ri(min, max) + specificAdj);
}

// ─── Full attribute structure ─────────────────────────────────────────────────

function generateAttributes(level: Level, role: Role, profile: Profile) {
  const g = (cat: string, attr: string) => genAttr(level, cat, attr, role, profile);
  return {
    combate: {
      aim:            g("combate",     "aim"),
      flick:          g("combate",     "flick"),
      tracking:       g("combate",     "tracking"),
      precisao:       g("combate",     "precisao"),
      recoil_control: g("combate",     "recoil_control"),
    },
    mecanica: {
      reacao:         g("mecanica",    "reacao"),
      movimentacao:   g("mecanica",    "movimentacao"),
      strafing:       g("mecanica",    "strafing"),
      peek:           g("mecanica",    "peek"),
    },
    game_sense: {
      leitura:        g("game_sense",  "leitura"),
      posicionamento: g("game_sense",  "posicionamento"),
      decisao:        g("game_sense",  "decisao"),
    },
    consciencia: {
      audio:          g("consciencia", "audio"),
      mapa:           g("consciencia", "mapa"),
      awareness:      g("consciencia", "awareness"),
    },
    equipe: {
      comunicacao:    g("equipe",      "comunicacao"),
      teamplay:       g("equipe",      "teamplay"),
      utilitarios:    g("equipe",      "utilitarios"),
    },
  };
}

type Attributes = ReturnType<typeof generateAttributes>;

function calcOverall(attrs: Attributes): number {
  return Math.round(
    mean(Object.values(attrs.combate))     * 0.30 +
    mean(Object.values(attrs.mecanica))    * 0.25 +
    mean(Object.values(attrs.game_sense))  * 0.20 +
    mean(Object.values(attrs.consciencia)) * 0.15 +
    mean(Object.values(attrs.equipe))      * 0.10
  );
}

// ─── Map to player_skills rows usando skill_id ────────────────────────────────

function buildSkills(
  attrs: Attributes,
  playerId: string,
  skillIds: Record<string, string>
) {
  const rows: { player_id: string; skill_id: string; value: number }[] = [];
  for (const category of Object.values(attrs)) {
    for (const [name, value] of Object.entries(category as Record<string, number>)) {
      const skill_id = skillIds[name];
      if (skill_id) rows.push({ player_id: playerId, skill_id, value });
    }
  }
  return rows;
}

// ─── Esports name generator (sem biblioteca) ──────────────────────────────────

function generateEsportsName(): string {
  const style = ri(1, 3);
  if (style === 1) {
    return pick(NAME_PREFIXES) + pick(NAME_WORDS).replace(/^\w/, (c) => c.toUpperCase());
  }
  if (style === 2) {
    return (
      pick(NAME_ADJECTIVES).replace(/^\w/, (c) => c.toUpperCase()) +
      pick(NAME_WORDS).replace(/^\w/, (c) => c.toUpperCase())
    );
  }
  return pick(NAME_WORDS) + ri(10, 99);
}

// ─── Main export ──────────────────────────────────────────────────────────────

export async function generateStarterPlayers(userId: string, teamId: string): Promise<void> {
  // Buscar IDs das skills uma única vez
  const { data: skillsData, error: skillsErr } = await supabase
    .from("skills")
    .select("id, name");

  if (skillsErr || !skillsData) return;
  const skillIds: Record<string, string> = Object.fromEntries(
    skillsData.map((s) => [s.name, s.id])
  );

  for (const role of ROLES) {
    const level   = Math.random() < 0.80 ? "ruim" : "mediano";
    const profile = pick(PROFILES);
    const attrs   = generateAttributes(level, role, profile);
    const overall = calcOverall(attrs);

    const { data: player, error: playerErr } = await supabase
      .from("players")
      .insert({
        user_id:      userId,
        team_id:      teamId,
        name:         generateEsportsName(),
        role,
        status:       "online",
        rating:       overall,
        salary:       level === "ruim" ? ri(1500, 4000) : ri(4000, 8000),
        contract_end: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString(),
        age:          level === "ruim" ? ri(17, 21) : ri(20, 25),
        energy:       100,
        morale:       100,
        form:         ri(50, 85),
        kills:        0,
        deaths:       0,
        assists:      0,
        adr:          0,
      })
      .select("id")
      .single();

    if (playerErr || !player) continue;

    await supabase.from("player_skills").insert(buildSkills(attrs, player.id, skillIds));
  }
}
