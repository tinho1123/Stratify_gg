import { faker } from "@faker-js/faker";
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config();

const supabase = createClient(
  process.env.EXPO_PUBLIC_SUPABASE_URL!,
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!
);

// ─── Types ───────────────────────────────────────────────────────────────────

type Level   = "ruim" | "mediano";
type Role    = "IGL" | "AWPer" | "Support" | "Entry" | "Flex";
type Profile = "afobado" | "lento" | "suporte_nato" | "inconsistente" | "disciplinado";

const ROLES: Role[]       = ["IGL", "AWPer", "Support", "Entry", "Flex"];
const PROFILES: Profile[] = ["afobado", "lento", "suporte_nato", "inconsistente", "disciplinado"];

// ─── Ranges by level ─────────────────────────────────────────────────────────

const BASE_RANGE: Record<Level, [number, number]> = {
  ruim:    [30, 55],
  mediano: [50, 65],
};

// ─── Role: category-level adjustments ────────────────────────────────────────
// Applied as a shift to [min, max] for each category

const ROLE_CAT_ADJ: Record<Role, Record<string, number>> = {
  IGL:     { combate: -8,  mecanica: -5, game_sense: +10, consciencia: +3,  equipe: +10 },
  AWPer:   { combate: +10, mecanica: +5, game_sense:   0, consciencia:  0,  equipe: -8  },
  Support: { combate: -8,  mecanica:  0, game_sense:  +5, consciencia: +8,  equipe: +10 },
  Entry:   { combate: +10, mecanica: +8, game_sense:  -8, consciencia:  0,  equipe: -8  },
  Flex:    { combate:  0,  mecanica:  0, game_sense:   0, consciencia:  0,  equipe:  0  },
};

// ─── Role: specific attribute adjustments ────────────────────────────────────

const ROLE_ATTR_ADJ: Record<Role, Record<string, number>> = {
  IGL:     { decisao: +5, comunicacao: +5, leitura: +5 },
  AWPer:   { aim: +8, precisao: +8, reacao: +5, utilitarios: -5 },
  Support: { comunicacao: +5, teamplay: +5, utilitarios: +8 },
  Entry:   { reacao: +5, flick: +5, decisao: -5 },
  Flex:    {},
};

// ─── Profile: specific attribute adjustments ─────────────────────────────────

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

function clamp(v: number): number {
  return Math.max(25, Math.min(70, Math.round(v)));
}

function mean(vals: number[]): number {
  return vals.reduce((a, b) => a + b, 0) / vals.length;
}

// ─── Core attribute generator ─────────────────────────────────────────────────

function genAttr(
  level: Level,
  category: string,
  attr: string,
  role: Role,
  profile: Profile
): number {
  let [min, max] = BASE_RANGE[level];

  // Category-level role shift
  const catAdj = ROLE_CAT_ADJ[role][category] ?? 0;
  min += catAdj;
  max += catAdj;

  // Profile: range modification
  if (profile === "inconsistente") {
    // Each attribute gets an independent random shift → high variance between attrs
    const shift = ri(-12, 12);
    min += shift;
    max += shift;
  } else if (profile === "disciplinado") {
    // Narrow range around the midpoint → low variance
    const mid = Math.round((min + max) / 2);
    min = mid - 4;
    max = mid + 4;
  }

  // Specific adjustments (role attr + profile attr)
  const specificAdj =
    (ROLE_ATTR_ADJ[role][attr] ?? 0) +
    (PROFILE_ATTR_ADJ[profile][attr] ?? 0);

  return clamp(ri(min, max) + specificAdj);
}

// ─── Attribute structure generation ──────────────────────────────────────────

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

// ─── Overall calculation (weighted) ──────────────────────────────────────────

function calcOverall(attrs: Attributes): number {
  return Math.round(
    mean(Object.values(attrs.combate))     * 0.30 +
    mean(Object.values(attrs.mecanica))    * 0.25 +
    mean(Object.values(attrs.game_sense))  * 0.20 +
    mean(Object.values(attrs.consciencia)) * 0.15 +
    mean(Object.values(attrs.equipe))      * 0.10
  );
}

// ─── Map to player_skills rows ───────────────────────────────────────────────

function buildSkills(attrs: Attributes, playerId: string) {
  const avg = (...vals: number[]) => Math.round(mean(vals));
  const { combate: c, mecanica: m, game_sense: g, equipe: e } = attrs;

  return [
    { player_id: playerId, skill_name: "Mira",               value: avg(c.aim, c.flick, c.precisao) },
    { player_id: playerId, skill_name: "Leitura de Jogo",    value: avg(g.leitura, g.decisao) },
    { player_id: playerId, skill_name: "Comunicação",        value: e.comunicacao },
    { player_id: playerId, skill_name: "Clutch",             value: avg(m.reacao, g.decisao, c.aim) },
    { player_id: playerId, skill_name: "Uso de Utilitários", value: e.utilitarios },
    { player_id: playerId, skill_name: "Posicionamento",     value: attrs.game_sense.posicionamento },
  ];
}

// ─── Esports name generator ───────────────────────────────────────────────────

function generateEsportsName(): string {
  const style = ri(1, 3);
  if (style === 1) {
    const prefix = faker.helpers.arrayElement(["z", "x", "v", "k", "n"]);
    const word = faker.word.noun({ length: { min: 4, max: 7 } });
    return prefix + word.charAt(0).toUpperCase() + word.slice(1);
  }
  if (style === 2) {
    const adj  = faker.word.adjective({ length: { min: 4, max: 6 } });
    const noun = faker.word.noun({ length: { min: 3, max: 6 } });
    return (
      adj.charAt(0).toUpperCase() + adj.slice(1) +
      noun.charAt(0).toUpperCase() + noun.slice(1)
    );
  }
  return faker.internet.username().replace(/[^a-zA-Z0-9]/g, "").slice(0, 10);
}

// ─── Main seed ────────────────────────────────────────────────────────────────

async function seed() {
  console.log("Generating players...\n");

  for (const role of ROLES) {
    // 80% ruim, 20% mediano
    const level   = Math.random() < 0.80 ? "ruim" : "mediano";
    const profile = faker.helpers.arrayElement(PROFILES);
    const attrs   = generateAttributes(level, role, profile);
    const overall = calcOverall(attrs);
    const name    = generateEsportsName();

    // Derive match stats from combate attributes
    const combatAvg = Math.round(mean(Object.values(attrs.combate)));
    const kills     = ri(combatAvg * 4, combatAvg * 8);
    const deaths    = ri(Math.round(kills * 0.8), Math.round(kills * 1.5));
    const assists   = ri(Math.round(kills * 0.3), Math.round(kills * 0.6));
    const adr       = parseFloat((combatAvg * 0.65 + ri(-5, 10)).toFixed(2));

    const { data: player, error: playerErr } = await supabase
      .from("players")
      .insert({
        name,
        role,
        status:   "online",
        rating:   overall,
        salary:   level === "ruim" ? ri(1500, 4000) : ri(4000, 8000),
        contract_end: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString(),
        age:      level === "ruim" ? ri(17, 21) : ri(20, 25),
        energy:   ri(55, 90),
        morale:   ri(50, 85),
        form:     ri(50, 85),
        kills,
        deaths,
        assists,
        adr,
      })
      .select("id")
      .single();

    if (playerErr || !player) {
      console.error(`Failed to insert ${name}:`, playerErr?.message);
      continue;
    }

    const { error: skillsErr } = await supabase
      .from("player_skills")
      .insert(buildSkills(attrs, player.id));

    if (skillsErr) {
      console.error(`Failed to insert skills for ${name}:`, skillsErr?.message);
      continue;
    }

    console.log(
      `${name.padEnd(16)} | ${role.padEnd(7)} | ${level.padEnd(6)} | ${profile.padEnd(14)} | overall: ${overall}`
    );
  }

  console.log("\nDone.");
}

seed();
