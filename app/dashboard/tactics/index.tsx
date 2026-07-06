import { ScreenHeader } from "@/components/ui/ScreenHeader";
import { supabase } from "@/database/supabase";
import { useFeatureFlags } from "@/hooks/useFeatureFlags";
import { useLanguage } from "@/i18n/LanguageContext";
import { router } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Dimensions,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const { width } = Dimensions.get("window");

// ── Types ─────────────────────────────────────────────────────────────────────

type TacticalRole = "IGL" | "AWPer" | "Entry" | "Support" | "Flex";
type GameStyle    = "agressivo" | "adaptativo" | "controlado";
type EcoStrategy  = "economico" | "balanceado" | "full_buy";

interface SkillMap { [name: string]: number; }

interface TacticalPlayer {
  id: string;
  name: string;
  naturalRole: TacticalRole;
  rating: number;
  skills: SkillMap;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const ROLES: TacticalRole[] = ["IGL", "AWPer", "Entry", "Support", "Flex"];

const ROLE_COLOR: Record<TacticalRole, string> = {
  IGL:     "#8B5CF6",
  AWPer:   "#EF4444",
  Entry:   "#F59E0B",
  Support: "#10B981",
  Flex:    "#3B82F6",
};

const ROLE_SHORT: Record<TacticalRole, string> = {
  IGL:     "IGL",
  AWPer:   "AWP",
  Entry:   "ENT",
  Support: "SUP",
  Flex:    "FLX",
};

// Which skills drive each role's "fit" score
const ROLE_SKILLS: Record<TacticalRole, string[]> = {
  IGL:     ["leitura", "decisao", "posicionamento", "comunicacao", "teamplay", "mapa"],
  AWPer:   ["aim", "flick", "precisao", "reacao", "peek"],
  Entry:   ["aim", "reacao", "movimentacao", "strafing", "peek"],
  Support: ["utilitarios", "teamplay", "comunicacao", "posicionamento", "awareness"],
  Flex:    ["aim", "movimentacao", "decisao", "awareness", "leitura"],
};

const MAPS = [
  { name: "Mirage",  emoji: "🏜️", color: "#D97706" },
  { name: "Inferno", emoji: "🔥", color: "#EA580C" },
  { name: "Nuke",    emoji: "☢️", color: "#65A30D" },
  { name: "Ancient", emoji: "🏛️", color: "#7C3AED" },
  { name: "Anubis",  emoji: "⚱️", color: "#B45309" },
  { name: "Vertigo", emoji: "🏙️", color: "#2563EB" },
  { name: "Dust2",   emoji: "🌅", color: "#CA8A04" },
];

const GAME_STYLES: {
  key: GameStyle; labelKey: string; icon: string; descKey: string; color: string;
}[] = [
  {
    key: "agressivo",  labelKey: "tactics.styleAggressiveLabel",  icon: "⚡",
    descKey: "tactics.styleAggressiveDesc",
    color: "#EF4444",
  },
  {
    key: "adaptativo", labelKey: "tactics.styleAdaptiveLabel", icon: "⚖️",
    descKey: "tactics.styleAdaptiveDesc",
    color: "#6366F1",
  },
  {
    key: "controlado", labelKey: "tactics.styleControlledLabel", icon: "🎯",
    descKey: "tactics.styleControlledDesc",
    color: "#10B981",
  },
];

const ECO_OPTIONS: {
  key: EcoStrategy; labelKey: string; icon: string; descKey: string;
}[] = [
  { key: "economico",  labelKey: "tactics.ecoEconomicLabel",  icon: "💰", descKey: "tactics.ecoEconomicDesc" },
  { key: "balanceado", labelKey: "tactics.ecoBalancedLabel", icon: "⚖️", descKey: "tactics.ecoBalancedDesc" },
  { key: "full_buy",   labelKey: "tactics.ecoFullBuyLabel",   icon: "🛡️", descKey: "tactics.ecoFullBuyDesc" },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function calcFit(player: TacticalPlayer, role: TacticalRole): number {
  const keys = ROLE_SKILLS[role];
  const vals = keys.map((k) => player.skills[k] ?? 0);
  return Math.round(vals.reduce((a, b) => a + b, 0) / vals.length);
}

function fitDots(score: number): { filled: number; color: string } {
  const color = score >= 70 ? "#10B981" : score >= 50 ? "#F59E0B" : "#EF4444";
  return { filled: Math.max(1, Math.round((score / 100) * 5)), color };
}

// ── Screen ────────────────────────────────────────────────────────────────────

export default function TacticsScreen() {
  const { t } = useLanguage();
  const { isEnabled, loaded } = useFeatureFlags();

  useEffect(() => {
    if (loaded && !isEnabled("tactics")) router.replace("/dashboard");
  }, [loaded]);
  const [teamId,  setTeamId]  = useState<string | null>(null);
  const [players, setPlayers] = useState<TacticalPlayer[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving,  setSaving]  = useState(false);
  const [saved,   setSaved]   = useState(false);

  const [gameStyle,        setGameStyle]        = useState<GameStyle>("adaptativo");
  const [ecoStrategy,      setEcoStrategy]      = useState<EcoStrategy>("balanceado");
  const [mapPool,          setMapPool]          = useState<string[]>(["Mirage", "Inferno", "Nuke"]);
  const [roleAssignments,  setRoleAssignments]  = useState<Record<string, TacticalRole>>({});

  // ── Fetch ──────────────────────────────────────────────────────────────────
  const fetchData = useCallback(async () => {
    setLoading(true);

    const { data: teamData } = await supabase.from("teams").select("id").single();
    if (!teamData) { setLoading(false); return; }
    setTeamId(teamData.id);

    // Players with skills
    const { data: pData } = await supabase
      .from("players")
      .select("id, name, role, rating, player_skills(value, skill:skills(name))")
      .eq("team_id", teamData.id)
      .order("rating", { ascending: false });

    if (pData) {
      const list: TacticalPlayer[] = (pData as any[]).map((p) => {
        const skills: SkillMap = {};
        (p.player_skills ?? []).forEach((ps: any) => {
          if (ps.skill?.name) skills[ps.skill.name] = ps.value;
        });
        return { id: p.id, name: p.name, naturalRole: p.role as TacticalRole, rating: p.rating, skills };
      });
      setPlayers(list);

      // Default: assign natural roles
      const defaults: Record<string, TacticalRole> = {};
      list.forEach((p) => { defaults[p.id] = p.naturalRole; });
      setRoleAssignments(defaults);
    }

    // Existing tactics
    const { data: tData } = await supabase
      .from("tactics")
      .select("*")
      .eq("team_id", teamData.id)
      .single();

    if (tData) {
      setGameStyle(tData.game_style as GameStyle);
      setEcoStrategy(tData.eco_strategy as EcoStrategy);
      if (tData.map_pool?.length) setMapPool(tData.map_pool);
      if (tData.role_assignments && Object.keys(tData.role_assignments).length > 0) {
        setRoleAssignments((prev) => ({ ...prev, ...tData.role_assignments }));
      }
    }

    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  // ── Actions ────────────────────────────────────────────────────────────────
  const toggleMap = (name: string) =>
    setMapPool((prev) => prev.includes(name) ? prev.filter((m) => m !== name) : [...prev, name]);

  const assignRole = (playerId: string, role: TacticalRole) =>
    setRoleAssignments((prev) => ({ ...prev, [playerId]: role }));

  const saveTactics = async () => {
    if (!teamId) return;
    setSaving(true);
    await supabase.from("tactics").upsert(
      {
        team_id: teamId,
        game_style: gameStyle,
        eco_strategy: ecoStrategy,
        map_pool: mapPool,
        role_assignments: roleAssignments,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "team_id" }
    );
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={s.safe} edges={["top"]}>

      <ScreenHeader
        title={t("tactics.headerTitle")}
        dotColor="#6366F1"
        right={
          <TouchableOpacity
            style={[s.saveBtn, saved && s.saveBtnDone, saving && { opacity: 0.6 }]}
            onPress={saveTactics}
            disabled={saving || loading}
          >
            {saving
              ? <ActivityIndicator size="small" color="#FFF" />
              : <Text style={s.saveBtnText}>{saved ? t("tactics.savedBtn") : t("tactics.saveBtn")}</Text>}
          </TouchableOpacity>
        }
      />

      {loading ? (
        <View style={s.center}>
          <ActivityIndicator size="large" color="#6366F1" />
          <Text style={s.loadingText}>{t("common.loading")}</Text>
        </View>
      ) : (
        <ScrollView
          style={s.scroll}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 48 }}
        >

          {/* ══════════════════════════════════════════════
              ESCALAÇÃO TÁTICA
          ══════════════════════════════════════════════ */}
          <View style={s.section}>
            <View style={s.sectionHeader}>
              <Text style={s.sectionTitle}>{t("tactics.lineupTitle")}</Text>
              <Text style={s.sectionSub}>{t("tactics.lineupSub")}</Text>
            </View>

            {players.length === 0 ? (
              <View style={s.emptyCard}>
                <Text style={s.emptyText}>{t("tactics.emptyRoster")}</Text>
              </View>
            ) : (
              players.map((player) => {
                const assigned = roleAssignments[player.id] ?? player.naturalRole;
                const fit    = calcFit(player, assigned);
                const dots   = fitDots(fit);
                const isOff  = assigned !== player.naturalRole;
                const rc     = ROLE_COLOR[assigned];

                return (
                  <View key={player.id} style={s.playerCard}>
                    {/* Top: avatar + name + fit */}
                    <View style={s.playerTop}>
                      <View style={[s.playerAvatar, { borderColor: rc + "55" }]}>
                        <Text style={[s.playerAvatarText, { color: rc }]}>
                          {player.name[0]}
                        </Text>
                      </View>

                      <View style={{ flex: 1 }}>
                        <View style={s.playerNameRow}>
                          <Text style={s.playerName}>{player.name}</Text>
                          {isOff && (
                            <View style={s.adaptBadge}>
                              <Text style={s.adaptText}>{t("tactics.outOfPosition")}</Text>
                            </View>
                          )}
                        </View>
                        <Text style={s.playerNatRole}>
                          {t("tactics.naturalLabel")} <Text style={{ color: ROLE_COLOR[player.naturalRole] }}>
                            {player.naturalRole}
                          </Text>
                        </Text>
                      </View>

                      {/* Fit indicator */}
                      <View style={s.fitBox}>
                        <Text style={s.fitLabel}>{t("tactics.fitLabel")}</Text>
                        <View style={s.fitDots}>
                          {[1, 2, 3, 4, 5].map((i) => (
                            <View
                              key={i}
                              style={[
                                s.fitDot,
                                { backgroundColor: i <= dots.filled ? dots.color : "#1E1E1E" },
                              ]}
                            />
                          ))}
                        </View>
                        <Text style={[s.fitScore, { color: dots.color }]}>{fit}</Text>
                      </View>
                    </View>

                    {/* Role chips */}
                    <View style={s.roleChips}>
                      {ROLES.map((role) => {
                        const active = assigned === role;
                        const chipColor = ROLE_COLOR[role];
                        return (
                          <TouchableOpacity
                            key={role}
                            style={[
                              s.roleChip,
                              active && {
                                backgroundColor: chipColor + "22",
                                borderColor: chipColor,
                              },
                            ]}
                            onPress={() => assignRole(player.id, role)}
                          >
                            <Text style={[s.roleChipText, active && { color: chipColor }]}>
                              {ROLE_SHORT[role]}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </View>
                );
              })
            )}
          </View>

          {/* ══════════════════════════════════════════════
              ESTILO DE JOGO
          ══════════════════════════════════════════════ */}
          <View style={s.section}>
            <View style={s.sectionHeader}>
              <Text style={s.sectionTitle}>{t("tactics.styleTitle")}</Text>
              <Text style={s.sectionSub}>{t("tactics.styleSub")}</Text>
            </View>

            <View style={s.styleGrid}>
              {GAME_STYLES.map((gs) => {
                const active = gameStyle === gs.key;
                return (
                  <TouchableOpacity
                    key={gs.key}
                    style={[
                      s.styleCard,
                      active && {
                        borderColor: gs.color,
                        backgroundColor: gs.color + "0E",
                      },
                    ]}
                    onPress={() => setGameStyle(gs.key)}
                    activeOpacity={0.75}
                  >
                    {active && <View style={[s.styleActiveBar, { backgroundColor: gs.color }]} />}
                    <Text style={s.styleIcon}>{gs.icon}</Text>
                    <Text style={[s.styleLabel, active && { color: gs.color }]}>
                      {t(gs.labelKey)}
                    </Text>
                    <Text style={s.styleDesc}>{t(gs.descKey)}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* ══════════════════════════════════════════════
              POOL DE MAPAS
          ══════════════════════════════════════════════ */}
          <View style={s.section}>
            <View style={s.sectionHeaderRow}>
              <View style={s.sectionHeader}>
                <Text style={s.sectionTitle}>{t("tactics.mapPoolTitle")}</Text>
                <Text style={s.sectionSub}>{t("tactics.mapPoolSub")}</Text>
              </View>
              <View style={s.poolBadge}>
                <Text style={s.poolBadgeText}>{mapPool.length}/7</Text>
              </View>
            </View>

            <View style={s.mapsGrid}>
              {MAPS.map((map) => {
                const active = mapPool.includes(map.name);
                return (
                  <TouchableOpacity
                    key={map.name}
                    style={[
                      s.mapCard,
                      active && {
                        borderColor: map.color,
                        backgroundColor: map.color + "18",
                      },
                    ]}
                    onPress={() => toggleMap(map.name)}
                    activeOpacity={0.75}
                  >
                    {active && (
                      <View style={[s.mapActiveLine, { backgroundColor: map.color }]} />
                    )}
                    <Text style={s.mapEmoji}>{map.emoji}</Text>
                    <Text style={[s.mapName, active && { color: map.color }]}>
                      {map.name}
                    </Text>
                    <View style={[
                      s.mapStatusDot,
                      { backgroundColor: active ? map.color : "#1E1E1E" },
                    ]} />
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* ══════════════════════════════════════════════
              ESTRATÉGIA DE ECONOMIA
          ══════════════════════════════════════════════ */}
          <View style={s.section}>
            <View style={s.sectionHeader}>
              <Text style={s.sectionTitle}>{t("tactics.ecoTitle")}</Text>
              <Text style={s.sectionSub}>{t("tactics.ecoSub")}</Text>
            </View>

            <View style={s.ecoRow}>
              {ECO_OPTIONS.map((opt) => {
                const active = ecoStrategy === opt.key;
                return (
                  <TouchableOpacity
                    key={opt.key}
                    style={[s.ecoCard, active && s.ecoCardActive]}
                    onPress={() => setEcoStrategy(opt.key)}
                    activeOpacity={0.75}
                  >
                    <Text style={s.ecoIcon}>{opt.icon}</Text>
                    <Text style={[s.ecoLabel, active && s.ecoLabelActive]}>
                      {t(opt.labelKey)}
                    </Text>
                    <Text style={s.ecoDesc}>{t(opt.descKey)}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

        </ScrollView>
      )}
    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const CARD_GAP = 10;

const s = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: "#080808" },
  scroll: { flex: 1 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
  loadingText: { fontSize: 13, color: "#6B7280" },

  // Header
  saveBtn: {
    paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8,
    backgroundColor: "#6366F1", minWidth: 72, alignItems: "center",
  },
  saveBtnDone: { backgroundColor: "#10B981" },
  saveBtnText: { fontSize: 12, fontWeight: "800", color: "#FFFFFF", letterSpacing: 1 },

  // Sections
  section: { paddingHorizontal: 16, marginBottom: 28 },
  sectionHeader: { marginBottom: 14 },
  sectionHeaderRow: {
    flexDirection: "row", alignItems: "flex-start",
    justifyContent: "space-between", marginBottom: 14,
  },
  sectionTitle: {
    fontSize: 10, fontWeight: "900", color: "#6B7280",
    letterSpacing: 3, marginBottom: 3,
  },
  sectionSub: { fontSize: 12, color: "#374151" },

  emptyCard: {
    backgroundColor: "#0D0D0D", borderRadius: 12,
    borderWidth: 1, borderColor: "#1A1A1A",
    padding: 20, alignItems: "center",
  },
  emptyText: { fontSize: 13, color: "#4B5563" },

  // Player cards
  playerCard: {
    backgroundColor: "#0D0D0D", borderRadius: 14,
    borderWidth: 1, borderColor: "#1A1A1A",
    padding: 14, marginBottom: CARD_GAP, gap: 12,
  },
  playerTop: { flexDirection: "row", alignItems: "center", gap: 12 },
  playerAvatar: {
    width: 42, height: 42, borderRadius: 21,
    backgroundColor: "#161616", borderWidth: 1.5,
    justifyContent: "center", alignItems: "center",
  },
  playerAvatarText: { fontSize: 17, fontWeight: "800" },
  playerNameRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 3 },
  playerName: { fontSize: 14, fontWeight: "700", color: "#FFFFFF" },
  adaptBadge: {
    backgroundColor: "#F59E0B22", borderWidth: 1, borderColor: "#F59E0B55",
    borderRadius: 4, paddingHorizontal: 5, paddingVertical: 1,
  },
  adaptText: { fontSize: 8, fontWeight: "800", color: "#F59E0B", letterSpacing: 0.5 },
  playerNatRole: { fontSize: 11, color: "#4B5563" },

  fitBox: { alignItems: "center", gap: 3 },
  fitLabel: { fontSize: 8, color: "#4B5563", fontWeight: "700", letterSpacing: 1 },
  fitDots: { flexDirection: "row", gap: 3 },
  fitDot: { width: 7, height: 7, borderRadius: 3.5 },
  fitScore: { fontSize: 11, fontWeight: "900" },

  roleChips: { flexDirection: "row", gap: 6 },
  roleChip: {
    flex: 1, paddingVertical: 7, borderRadius: 8,
    backgroundColor: "#111", borderWidth: 1, borderColor: "#1E1E1E",
    alignItems: "center",
  },
  roleChipText: { fontSize: 10, fontWeight: "800", color: "#4B5563", letterSpacing: 0.5 },

  // Game style
  styleGrid: { gap: CARD_GAP },
  styleCard: {
    backgroundColor: "#0D0D0D", borderRadius: 14,
    borderWidth: 1, borderColor: "#1A1A1A",
    padding: 16, overflow: "hidden",
  },
  styleActiveBar: {
    position: "absolute", top: 0, left: 0, right: 0, height: 3, borderRadius: 1,
  },
  styleIcon:  { fontSize: 22, marginBottom: 6 },
  styleLabel: { fontSize: 14, fontWeight: "800", color: "#9CA3AF", marginBottom: 4 },
  styleDesc:  { fontSize: 12, color: "#4B5563", lineHeight: 17 },

  // Map pool
  poolBadge: {
    backgroundColor: "#1A1A2E", borderWidth: 1, borderColor: "#6366F133",
    borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4,
  },
  poolBadgeText: { fontSize: 12, fontWeight: "800", color: "#6366F1" },
  mapsGrid: {
    flexDirection: "row", flexWrap: "wrap", gap: CARD_GAP,
  },
  mapCard: {
    width: (width - 32 - CARD_GAP * 3) / 4,
    backgroundColor: "#0D0D0D", borderRadius: 12,
    borderWidth: 1, borderColor: "#1A1A1A",
    paddingVertical: 14, alignItems: "center", gap: 5,
    overflow: "hidden",
  },
  mapActiveLine: {
    position: "absolute", top: 0, left: 0, right: 0, height: 3,
  },
  mapEmoji:  { fontSize: 22 },
  mapName:   { fontSize: 10, fontWeight: "700", color: "#6B7280", textAlign: "center" },
  mapStatusDot: {
    width: 6, height: 6, borderRadius: 3,
  },

  // Eco strategy
  ecoRow: { flexDirection: "row", gap: CARD_GAP },
  ecoCard: {
    flex: 1, backgroundColor: "#0D0D0D", borderRadius: 14,
    borderWidth: 1, borderColor: "#1A1A1A",
    padding: 14, alignItems: "center", gap: 5,
  },
  ecoCardActive: { backgroundColor: "#6366F10E", borderColor: "#6366F1" },
  ecoIcon:  { fontSize: 22 },
  ecoLabel: { fontSize: 11, fontWeight: "800", color: "#6B7280", letterSpacing: 0.5 },
  ecoLabelActive: { color: "#6366F1" },
  ecoDesc:  { fontSize: 9, color: "#374151", textAlign: "center", lineHeight: 13 },
});
