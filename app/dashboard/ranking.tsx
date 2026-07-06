import { ScreenHeader } from "@/components/ui/ScreenHeader";
import { getTierInfo } from "@/constants/tiers";
import { supabase } from "@/database/supabase";
import { useLanguage } from "@/i18n/LanguageContext";
import { useFocusEffect } from "@react-navigation/native";
import { router } from "expo-router";
import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

// ── Types ─────────────────────────────────────────────────────────────────────

interface LeaderboardRow {
  rank: number;
  team_id: string;
  team_name: string;
  pdl: number;
  wins: number;
  losses: number;
  name_color: string | null;
}

interface MyRank {
  rank: number;
  total: number;
}

const RANK_MEDAL: Record<number, string> = { 1: "🥇", 2: "🥈", 3: "🥉" };

// ── Component ─────────────────────────────────────────────────────────────────

export default function RankingScreen() {
  const { t } = useLanguage();

  const [loading, setLoading]   = useState(true);
  const [rows, setRows]         = useState<LeaderboardRow[]>([]);
  const [myTeamId, setMyTeamId] = useState<string | null>(null);
  const [myRank, setMyRank]     = useState<MyRank | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);

    const [{ data: team }, { data: leaderboard }, { data: rankData }] = await Promise.all([
      supabase.from("teams").select("id").single(),
      supabase.rpc("get_leaderboard", { p_limit: 100 }),
      supabase.rpc("get_my_rank"),
    ]);

    setMyTeamId(team?.id ?? null);
    setRows((leaderboard ?? []) as LeaderboardRow[]);
    if (rankData) setMyRank(rankData as MyRank);

    setLoading(false);
  }, []);

  useFocusEffect(useCallback(() => { fetchData(); }, [fetchData]));

  const myInfo = myRank ? getTierInfo(rows.find((r) => r.team_id === myTeamId)?.pdl ?? 0) : null;

  return (
    <SafeAreaView style={s.safe} edges={["top"]}>

      <ScreenHeader title={t("ranking.headerTitle")} centered />

      {loading ? (
        <View style={s.center}>
          <ActivityIndicator size="large" color="#EC4899" />
          <Text style={s.loadingText}>{t("common.loading")}</Text>
        </View>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 16, paddingBottom: 48 }}>
          {myRank && (
            <View style={s.myRankCard}>
              <View>
                <Text style={s.myRankLabel}>{t("ranking.yourPosition")}</Text>
                <Text style={s.myRankValue}>#{myRank.rank} <Text style={s.myRankTotal}>/ {myRank.total}</Text></Text>
              </View>
              {myInfo && (
                <View style={[s.eloPill, { borderColor: myInfo.color + "55" }]}>
                  <View style={[s.eloDot, { backgroundColor: myInfo.color }]} />
                  <Text style={[s.eloPillText, { color: myInfo.color }]}>
                    {myInfo.tier}{myInfo.division ? ` ${myInfo.division}` : ""}
                  </Text>
                </View>
              )}
            </View>
          )}

          {rows.length === 0 ? (
            <View style={s.emptyCard}>
              <Text style={s.emptyEmoji}>🏆</Text>
              <Text style={s.emptyText}>{t("ranking.emptyState")}</Text>
            </View>
          ) : (
            rows.map((row) => {
              const isMe = row.team_id === myTeamId;
              const info = getTierInfo(row.pdl);
              return (
                <TouchableOpacity
                  key={row.team_id}
                  style={[s.row, isMe && s.rowMe]}
                  activeOpacity={0.75}
                  onPress={() => router.push({ pathname: "/dashboard/team/[id]", params: { id: row.team_id } })}
                >
                  <View style={s.rankWrap}>
                    {RANK_MEDAL[row.rank]
                      ? <Text style={s.rankMedal}>{RANK_MEDAL[row.rank]}</Text>
                      : <Text style={s.rankNumber}>{row.rank}</Text>}
                  </View>

                  <View style={{ flex: 1 }}>
                    <Text
                      style={[s.teamName, row.name_color ? { color: row.name_color } : null]}
                      numberOfLines={1}
                    >
                      {row.team_name}
                    </Text>
                    <View style={s.rowSub}>
                      <View style={[s.eloDot, { backgroundColor: info.color }]} />
                      <Text style={[s.tierText, { color: info.color }]}>
                        {info.tier}{info.division ? ` ${info.division}` : ""}
                      </Text>
                      <Text style={s.recordText}>· {row.wins}V {row.losses}D</Text>
                    </View>
                  </View>

                  <Text style={s.pdlText}>{row.pdl}</Text>
                </TouchableOpacity>
              );
            })
          )}
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

  myRankCard: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    backgroundColor: "#EC489912", borderWidth: 1, borderColor: "#EC489944",
    borderRadius: 14, padding: 14, marginBottom: 16,
  },
  myRankLabel: { fontSize: 10, fontWeight: "800", color: "#6B7280", letterSpacing: 1.5, marginBottom: 4 },
  myRankValue: { fontSize: 20, fontWeight: "900", color: "#FFFFFF" },
  myRankTotal: { fontSize: 12, fontWeight: "700", color: "#6B7280" },

  eloPill: {
    flexDirection: "row", alignItems: "center", gap: 6,
    borderWidth: 1, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6,
  },
  eloPillText: { fontSize: 11, fontWeight: "900" },

  emptyCard: { alignItems: "center", gap: 8, paddingVertical: 48 },
  emptyEmoji: { fontSize: 32 },
  emptyText:  { fontSize: 12, color: "#6B7280", textAlign: "center" },

  row: {
    flexDirection: "row", alignItems: "center", gap: 12,
    backgroundColor: "#0D0D0D", borderRadius: 14, borderWidth: 1, borderColor: "#1A1A1A",
    padding: 12, marginBottom: 8,
  },
  rowMe: { borderColor: "#EC489966" },

  rankWrap: { width: 28, alignItems: "center" },
  rankMedal:  { fontSize: 18 },
  rankNumber: { fontSize: 13, fontWeight: "900", color: "#4B5563" },

  teamName: { fontSize: 13, fontWeight: "800", color: "#FFFFFF" },
  rowSub:   { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 3 },
  eloDot:   { width: 5, height: 5, borderRadius: 2.5 },
  tierText: { fontSize: 10, fontWeight: "800" },
  recordText: { fontSize: 10, color: "#4B5563", fontWeight: "700" },

  pdlText: { fontSize: 15, fontWeight: "900", color: "#EC4899" },
});
