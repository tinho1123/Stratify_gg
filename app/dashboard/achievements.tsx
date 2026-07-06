import { ScreenHeader } from "@/components/ui/ScreenHeader";
import { supabase } from "@/database/supabase";
import { useLanguage } from "@/i18n/LanguageContext";
import { useFocusEffect } from "@react-navigation/native";
import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

// ── Types ─────────────────────────────────────────────────────────────────────

type RequirementType = "wins_total" | "pdl_reached" | "tournament_titles" | "challenge_wins";

interface Achievement {
  key: string;
  category: "wins" | "tier" | "tournament" | "challenge";
  name: string;
  description: string;
  requirement_type: RequirementType;
  requirement_value: number;
  reward: { type: "credits" | "cosmetic"; amount?: number; cosmetic_id?: string };
}

interface CosmeticInfo {
  name: string;
  color: string;
}

const CATEGORY_ORDER: Achievement["category"][] = ["wins", "tier", "tournament", "challenge"];

// ── Component ─────────────────────────────────────────────────────────────────

export default function AchievementsScreen() {
  const { t } = useLanguage();

  const [loading, setLoading] = useState(true);
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [unlockedKeys, setUnlockedKeys] = useState<Set<string>>(new Set());
  const [progress, setProgress] = useState<Record<RequirementType, number>>({
    wins_total: 0, pdl_reached: 0, tournament_titles: 0, challenge_wins: 0,
  });
  const [cosmeticMap, setCosmeticMap] = useState<Map<string, CosmeticInfo>>(new Map());

  const fetchData = useCallback(async () => {
    setLoading(true);

    // Desbloqueia o que já foi atingido antes de mostrar a lista (também dispara notificação,
    // que já vira push pelo pipeline configurado).
    await supabase.rpc("check_achievements");

    const { data: team } = await supabase.from("teams").select("id, wins, pdl").single();
    if (!team) { setLoading(false); return; }

    const [
      { data: achData },
      { data: unlockedData },
      { data: champData },
      { count: challengeWins },
      { data: cosmeticsData },
    ] = await Promise.all([
      supabase.from("achievements").select("key, category, name, description, requirement_type, requirement_value, reward").order("sort_order", { ascending: true }),
      supabase.from("team_achievements").select("achievement_key").eq("team_id", team.id),
      supabase.from("tournament_matches").select("round, tournaments(bracket_size)").eq("winner_team_id", team.id),
      supabase.from("team_challenges").select("id", { count: "exact", head: true }).eq("winner_team_id", team.id),
      supabase.from("cosmetics").select("id, name, preview").eq("source", "achievement"),
    ]);

    if (achData) setAchievements(achData as Achievement[]);
    setUnlockedKeys(new Set((unlockedData ?? []).map((r: any) => r.achievement_key)));

    const tournamentTitles = (champData ?? []).filter((m: any) => {
      const bracketSize = m.tournaments?.bracket_size ?? 8;
      return m.round === Math.round(Math.log2(bracketSize));
    }).length;

    setProgress({
      wins_total: (team as any).wins ?? 0,
      pdl_reached: (team as any).pdl ?? 0,
      tournament_titles: tournamentTitles,
      challenge_wins: challengeWins ?? 0,
    });

    setCosmeticMap(new Map(
      (cosmeticsData ?? []).map((c: any) => [c.id, { name: c.name, color: c.preview?.color ?? "#6B7280" }]),
    ));

    setLoading(false);
  }, []);

  useFocusEffect(useCallback(() => { fetchData(); }, [fetchData]));

  const categoryLabel = (cat: Achievement["category"]): string => {
    switch (cat) {
      case "wins":       return t("achievements.categoryWins");
      case "tier":       return t("achievements.categoryTier");
      case "tournament": return t("achievements.categoryTournament");
      case "challenge":  return t("achievements.categoryChallenge");
    }
  };

  const rewardDisplay = (reward: Achievement["reward"]): { icon: string; label: string } => {
    if (reward.type === "credits") return { icon: "💎", label: `${reward.amount}` };
    const c = reward.cosmetic_id ? cosmeticMap.get(reward.cosmetic_id) : undefined;
    return { icon: "✨", label: c?.name ?? "—" };
  };

  const unlockedCount = achievements.filter((a) => unlockedKeys.has(a.key)).length;

  return (
    <SafeAreaView style={s.safe} edges={["top"]}>

      <ScreenHeader
        title={t("achievements.headerTitle")}
        right={
          <View style={s.countPill}>
            <Text style={s.countPillText}>{unlockedCount}/{achievements.length}</Text>
          </View>
        }
      />

      {loading ? (
        <View style={s.center}>
          <ActivityIndicator size="large" color="#EC4899" />
          <Text style={s.loadingText}>{t("common.loading")}</Text>
        </View>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 16, paddingBottom: 48 }}>
          {CATEGORY_ORDER.map((category) => {
            const items = achievements.filter((a) => a.category === category);
            if (!items.length) return null;
            return (
              <View key={category} style={{ marginBottom: 20 }}>
                <Text style={s.categoryLabel}>{categoryLabel(category)}</Text>
                {items.map((a) => {
                  const unlocked = unlockedKeys.has(a.key);
                  const current = Math.min(progress[a.requirement_type], a.requirement_value);
                  const pct = Math.min(100, Math.round((current / a.requirement_value) * 100));
                  const reward = rewardDisplay(a.reward);
                  return (
                    <View key={a.key} style={[s.card, unlocked && s.cardUnlocked]}>
                      <View style={[s.iconWrap, unlocked && s.iconWrapUnlocked]}>
                        <Text style={s.icon}>{unlocked ? "🏆" : "🔒"}</Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={[s.name, unlocked && { color: "#FFFFFF" }]}>{a.name}</Text>
                        <Text style={s.description}>{a.description}</Text>
                        {!unlocked && (
                          <View style={s.progressTrack}>
                            <View style={[s.progressFill, { width: `${pct}%` as any }]} />
                          </View>
                        )}
                        {!unlocked && (
                          <Text style={s.progressLabel}>{current}/{a.requirement_value}</Text>
                        )}
                      </View>
                      <View style={s.rewardChip}>
                        <Text style={s.rewardIcon}>{reward.icon}</Text>
                        <Text style={s.rewardLabel} numberOfLines={1}>{reward.label}</Text>
                      </View>
                    </View>
                  );
                })}
              </View>
            );
          })}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  safe:        { flex: 1, backgroundColor: "#080808" },
  center:      { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
  loadingText: { fontSize: 13, color: "#6B7280" },

  countPill: {
    backgroundColor: "#161000", borderWidth: 1, borderColor: "#F59E0B44",
    borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6,
  },
  countPillText: { fontSize: 12, fontWeight: "900", color: "#F59E0B" },

  categoryLabel: {
    fontSize: 10, fontWeight: "900", color: "#6B7280",
    letterSpacing: 3, marginBottom: 12,
  },

  card: {
    flexDirection: "row", alignItems: "center", gap: 12,
    backgroundColor: "#0D0D0D", borderRadius: 14, borderWidth: 1, borderColor: "#1A1A1A",
    padding: 12, marginBottom: 8,
  },
  cardUnlocked: { borderColor: "#F59E0B44" },
  iconWrap: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: "#161616", borderWidth: 1, borderColor: "#242424",
    justifyContent: "center", alignItems: "center",
  },
  iconWrapUnlocked: { backgroundColor: "#F59E0B18", borderColor: "#F59E0B55" },
  icon: { fontSize: 18 },
  name: { fontSize: 13, fontWeight: "700", color: "#9CA3AF" },
  description: { fontSize: 11, color: "#4B5563", marginTop: 2 },

  progressTrack: {
    height: 4, backgroundColor: "#1A1A1A", borderRadius: 2,
    overflow: "hidden", marginTop: 8,
  },
  progressFill: { height: 4, backgroundColor: "#EC4899", borderRadius: 2 },
  progressLabel: { fontSize: 9, color: "#4B5563", marginTop: 4 },

  rewardChip: {
    flexDirection: "row", alignItems: "center", gap: 4,
    backgroundColor: "#111", borderRadius: 8, borderWidth: 1, borderColor: "#1A1A1A",
    paddingHorizontal: 8, paddingVertical: 6, maxWidth: 90,
  },
  rewardIcon:  { fontSize: 12 },
  rewardLabel: { fontSize: 10, fontWeight: "800", color: "#F59E0B" },
});
