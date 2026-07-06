import { ScreenHeader } from "@/components/ui/ScreenHeader";
import { supabase } from "@/database/supabase";
import { useLanguage } from "@/i18n/LanguageContext";
import { router, useLocalSearchParams } from "expo-router";
import React, { useEffect, useState } from "react";
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

interface StatLine {
  id: string;
  name: string;
  role: string;
  kills: number;
  deaths: number;
  assists: number;
  rating: number;
  mvp: boolean;
}

interface MatchEvent {
  id: string;
  round: number;
  type: "kill" | "util";
  text: string;
  killerSide?: "own" | "opp";
}

interface MatchReport {
  own: StatLine[];
  opp: StatLine[];
  events: MatchEvent[];
}

interface MatchRow {
  id: string;
  opponent_name: string;
  result: "win" | "loss";
  score_own: number;
  score_opp: number;
  map: string;
  match_type: string;
  fans_delta: number;
  budget_delta: number;
  pdl_delta: number;
  played_at: string;
  player_stats: unknown;
}

// `player_stats` só tem o shape de MatchReport pra partidas jogadas depois da migration 031 —
// as anteriores ficaram com o default `[]`.
function isMatchReport(v: unknown): v is MatchReport {
  return !!v && typeof v === "object" && !Array.isArray(v)
    && Array.isArray((v as any).own) && Array.isArray((v as any).opp);
}

const TYPE_COLOR: Record<string, string> = {
  Liga:    "#6366F1",
  Torneio: "#F59E0B",
  Scrim:   "#6B7280",
  Final:   "#EC4899",
};

const MAP_COLOR: Record<string, string> = {
  Mirage:  "#D97706",
  Inferno: "#EA580C",
  Nuke:    "#65A30D",
  Ancient: "#7C3AED",
  Anubis:  "#B45309",
  Vertigo: "#2563EB",
  Dust2:   "#CA8A04",
};

// MVP da partida: o melhor rating entre os dois times, não só dentro de cada um.
function pickMatchMvp(own: StatLine[], opp: StatLine[]): { stat: StatLine; side: "own" | "opp" } | null {
  const combined = [
    ...own.map((stat) => ({ stat, side: "own" as const })),
    ...opp.map((stat) => ({ stat, side: "opp" as const })),
  ];
  if (!combined.length) return null;
  return combined.reduce((best, cur) => (cur.stat.rating > best.stat.rating ? cur : best), combined[0]);
}

function formatDate(iso: string, locale: string) {
  return new Date(iso).toLocaleDateString(locale, {
    day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit",
  });
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function MatchDetailScreen() {
  const { t, language } = useLanguage();
  const dateLocale = language === "pt" ? "pt-BR" : "en-US";
  const params = useLocalSearchParams<{ id: string }>();

  const [loading, setLoading] = useState(true);
  const [match, setMatch] = useState<MatchRow | null>(null);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("matches")
        .select("id, opponent_name, result, score_own, score_opp, map, match_type, fans_delta, budget_delta, pdl_delta, played_at, player_stats")
        .eq("id", params.id)
        .single();
      if (cancelled) return;
      if (error || !data) {
        setNotFound(true);
      } else {
        setMatch(data as MatchRow);
      }
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [params.id]);

  if (loading) {
    return (
      <SafeAreaView style={s.safe} edges={["top"]}>
        <View style={s.center}>
          <ActivityIndicator size="large" color="#EC4899" />
          <Text style={s.loadingText}>{t("matchDetail.loading")}</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (notFound || !match) {
    return (
      <SafeAreaView style={s.safe} edges={["top"]}>
        <View style={s.center}>
          <Text style={s.errorEmoji}>⚠️</Text>
          <Text style={s.errorText}>{t("matchDetail.errNotFound")}</Text>
          <TouchableOpacity style={s.errorBtn} onPress={() => router.back()}>
            <Text style={s.errorBtnText}>{t("matchDetail.backBtn")}</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const won = match.result === "win";
  const report = isMatchReport(match.player_stats) ? match.player_stats : null;
  const matchMvp = report ? pickMatchMvp(report.own, report.opp) : null;
  const mapColor  = MAP_COLOR[match.map] ?? "#6B7280";
  const typeColor = TYPE_COLOR[match.match_type] ?? "#6B7280";

  return (
    <SafeAreaView style={s.safe} edges={["top"]}>
      <ScreenHeader title={t("matchDetail.headerTitle")} centered />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>

        {/* ── HERO ────────────────────────────────────────── */}
        <View style={[s.heroCard, won ? s.heroWin : s.heroLoss]}>
          <View style={s.heroBadgeRow}>
            <View style={[s.badge, { backgroundColor: typeColor + "22", borderColor: typeColor + "55" }]}>
              <Text style={[s.badgeText, { color: typeColor }]}>{match.match_type}</Text>
            </View>
            <View style={[s.badge, { backgroundColor: mapColor + "22", borderColor: mapColor + "55" }]}>
              <Text style={[s.badgeText, { color: mapColor }]}>{match.map}</Text>
            </View>
          </View>

          <View style={s.scoreRow}>
            <View style={s.scoreTeam}>
              <Text style={s.scoreTeamName} numberOfLines={1}>{t("matchDetail.yourTeamTitle")}</Text>
              <Text style={[s.scoreNum, won ? s.scoreWin : s.scoreLoss]}>{match.score_own}</Text>
            </View>
            <Text style={s.scoreDash}>–</Text>
            <View style={s.scoreTeam}>
              <Text style={s.scoreTeamName} numberOfLines={1}>{match.opponent_name.toUpperCase()}</Text>
              <Text style={[s.scoreNum, !won ? s.scoreWin : s.scoreLoss]}>{match.score_opp}</Text>
            </View>
          </View>

          <View style={[s.verdictBadge, won ? s.verdictWin : s.verdictLoss]}>
            <Text style={[s.verdictText, { color: won ? "#10B981" : "#EF4444" }]}>
              {won ? t("live.victory") : t("live.defeat")}
            </Text>
          </View>

          <Text style={s.heroDate}>{formatDate(match.played_at, dateLocale)}</Text>
        </View>

        {/* ── REWARDS ─────────────────────────────────────── */}
        <View style={s.rewardsRow}>
          {match.pdl_delta !== 0 && (
            <View style={[s.rewardPill, match.pdl_delta > 0 ? s.pillGreen : s.pillRed]}>
              <Text style={s.rewardText}>{match.pdl_delta > 0 ? "+" : ""}{match.pdl_delta} PDL</Text>
            </View>
          )}
          {match.fans_delta !== 0 && (
            <View style={[s.rewardPill, match.fans_delta > 0 ? s.pillGreen : s.pillRed]}>
              <Text style={s.rewardText}>{match.fans_delta > 0 ? "+" : ""}{match.fans_delta} {t("live.fansUnit")}</Text>
            </View>
          )}
          {match.budget_delta > 0 && (
            <View style={[s.rewardPill, s.pillYellow]}>
              <Text style={s.rewardText}>+${match.budget_delta.toLocaleString("pt-BR")}</Text>
            </View>
          )}
        </View>

        {/* ── DESEMPENHO + HISTÓRICO ──────────────────────── */}
        {report ? (
          <>
            {matchMvp && (
              <View style={[s.mvpCard, { borderColor: (matchMvp.side === "own" ? "#10B981" : "#EF4444") + "44" }]}>
                <Text style={s.mvpCardTrophy}>🏆</Text>
                <Text style={s.mvpCardLabel}>{t("matchDetail.matchMvpTitle")}</Text>
                <Text style={s.mvpCardName}>{matchMvp.stat.name}</Text>
                <Text style={[s.mvpCardTeam, { color: matchMvp.side === "own" ? "#10B981" : "#EF4444" }]}>
                  {matchMvp.stat.role} · {matchMvp.side === "own" ? t("matchDetail.yourTeamTitle") : match.opponent_name.toUpperCase()}
                </Text>
                <View style={s.mvpCardStatsRow}>
                  <View style={s.mvpStatItem}>
                    <Text style={s.mvpStatVal}>{matchMvp.stat.kills}</Text>
                    <Text style={s.mvpStatLabel}>K</Text>
                  </View>
                  <View style={s.mvpStatItem}>
                    <Text style={s.mvpStatVal}>{matchMvp.stat.deaths}</Text>
                    <Text style={s.mvpStatLabel}>D</Text>
                  </View>
                  <View style={s.mvpStatItem}>
                    <Text style={s.mvpStatVal}>{matchMvp.stat.assists}</Text>
                    <Text style={s.mvpStatLabel}>A</Text>
                  </View>
                  <View style={s.mvpStatItem}>
                    <Text style={[s.mvpStatVal, { color: "#F59E0B" }]}>{matchMvp.stat.rating.toFixed(2)}</Text>
                    <Text style={s.mvpStatLabel}>RTG</Text>
                  </View>
                </View>
              </View>
            )}

            <Text style={s.sectionTitle}>{t("matchDetail.scoreboardTitle")}</Text>
            <ScoreboardTable title={t("matchDetail.yourTeamTitle")} stats={report.own} accent="#10B981" playerCol={t("matchDetail.playerCol")} />
            <ScoreboardTable title={match.opponent_name.toUpperCase()} stats={report.opp} accent="#EF4444" playerCol={t("matchDetail.playerCol")} />

            {report.events.length > 0 && (
              <>
                <Text style={s.sectionTitle}>{t("matchDetail.historyTitle")}</Text>
                <View style={s.feedCard}>
                  {report.events.map((ev) => (
                    <View key={ev.id} style={s.feedRow}>
                      <Text style={s.feedRound}>R{ev.round}</Text>
                      <Text style={[s.feedIcon, ev.type === "util" && { opacity: 0.6 }]}>
                        {ev.type === "util" ? "💨" : ev.killerSide === "own" ? "🔫" : "☠️"}
                      </Text>
                      <Text style={[s.feedText, ev.type === "util" && s.feedTextUtil]}>{ev.text}</Text>
                    </View>
                  ))}
                </View>
              </>
            )}
          </>
        ) : (
          <View style={s.emptyCard}>
            <Text style={s.emptyEmoji}>📋</Text>
            <Text style={s.emptyTitle}>{t("matchDetail.noReportTitle")}</Text>
            <Text style={s.emptySub}>{t("matchDetail.noReportSub")}</Text>
          </View>
        )}

      </ScrollView>
    </SafeAreaView>
  );
}

// ── Subcomponents ────────────────────────────────────────────────────────────

function ScoreboardTable({
  title, stats, accent, playerCol,
}: { title: string; stats: StatLine[]; accent: string; playerCol: string }) {
  return (
    <View style={s.statsTable}>
      <Text style={[s.statsTableTitle, { color: accent }]}>{title}</Text>
      <View style={s.statsHeader}>
        <Text style={[s.statsCol, { flex: 1, textAlign: "left" }]}>{playerCol}</Text>
        <Text style={s.statsCol}>K</Text>
        <Text style={s.statsCol}>D</Text>
        <Text style={s.statsCol}>A</Text>
        <Text style={[s.statsCol, { color: "#FFFFFF" }]}>RTG</Text>
      </View>
      {stats.map((ps) => (
        <View key={ps.id} style={[s.statsRow, ps.mvp && s.statsRowMvp]}>
          <View style={[s.statsNameWrap, { flex: 1 }]}>
            {ps.mvp && (
              <View style={s.mvpBadge}><Text style={s.mvpText}>MVP</Text></View>
            )}
            <View>
              <Text style={s.statsName}>{ps.name}</Text>
              <Text style={s.statsRole}>{ps.role}</Text>
            </View>
          </View>
          <Text style={s.statNum}>{ps.kills}</Text>
          <Text style={s.statNum}>{ps.deaths}</Text>
          <Text style={s.statNum}>{ps.assists}</Text>
          <Text style={[s.statRtg, {
            color: ps.rating >= 1.2 ? "#10B981" : ps.rating >= 0.9 ? "#F59E0B" : "#EF4444",
          }]}>
            {ps.rating.toFixed(2)}
          </Text>
        </View>
      ))}
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  safe:        { flex: 1, backgroundColor: "#080808" },
  center:      { flex: 1, alignItems: "center", justifyContent: "center", gap: 12, paddingHorizontal: 32 },
  loadingText: { fontSize: 13, color: "#6B7280" },
  errorEmoji:  { fontSize: 36 },
  errorText:   { fontSize: 14, color: "#9CA3AF", textAlign: "center" },
  errorBtn: {
    marginTop: 8, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 10,
    backgroundColor: "#161616", borderWidth: 1, borderColor: "#242424",
  },
  errorBtnText: { fontSize: 12, fontWeight: "800", color: "#9CA3AF", letterSpacing: 1 },

  badge: { borderRadius: 5, paddingHorizontal: 7, paddingVertical: 3, borderWidth: 1 },
  badgeText: { fontSize: 9, fontWeight: "800", letterSpacing: 0.5 },

  heroCard: {
    borderRadius: 16, padding: 20, marginBottom: 16,
    borderWidth: 1, alignItems: "center",
  },
  heroWin:  { backgroundColor: "#0A1F14", borderColor: "#10B98133" },
  heroLoss: { backgroundColor: "#1A0A0A", borderColor: "#EF444433" },
  heroBadgeRow: { flexDirection: "row", gap: 8, marginBottom: 14 },
  scoreRow:     { flexDirection: "row", alignItems: "center", gap: 16, marginBottom: 16 },
  scoreTeam:    { alignItems: "center", flex: 1 },
  scoreTeamName:{ fontSize: 9, fontWeight: "800", color: "#6B7280", letterSpacing: 1, marginBottom: 4 },
  scoreNum:     { fontSize: 52, fontWeight: "900", lineHeight: 56 },
  scoreWin:     { color: "#10B981" },
  scoreLoss:    { color: "#EF4444" },
  scoreDash:    { fontSize: 28, color: "#374151", fontWeight: "900" },
  verdictBadge: { paddingHorizontal: 24, paddingVertical: 8, borderRadius: 20, borderWidth: 1, marginBottom: 10 },
  verdictWin:   { backgroundColor: "#10B98122", borderColor: "#10B98155" },
  verdictLoss:  { backgroundColor: "#EF444422", borderColor: "#EF444455" },
  verdictText:  { fontSize: 14, fontWeight: "900", letterSpacing: 3 },
  heroDate:     { fontSize: 11, color: "#4B5563" },

  rewardsRow: { flexDirection: "row", gap: 8, marginBottom: 20, justifyContent: "center", flexWrap: "wrap" },
  rewardPill: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, borderWidth: 1 },
  pillGreen:  { backgroundColor: "#10B98122", borderColor: "#10B98155" },
  pillRed:    { backgroundColor: "#EF444422", borderColor: "#EF444455" },
  pillYellow: { backgroundColor: "#F59E0B22", borderColor: "#F59E0B55" },
  rewardText: { fontSize: 12, fontWeight: "700", color: "#FFFFFF" },

  mvpCard: {
    backgroundColor: "#161000", borderRadius: 16,
    borderWidth: 1, padding: 18, alignItems: "center", gap: 4, marginBottom: 16,
  },
  mvpCardTrophy: { fontSize: 28, marginBottom: 2 },
  mvpCardLabel:  { fontSize: 9, fontWeight: "900", color: "#F59E0B", letterSpacing: 2 },
  mvpCardName:   { fontSize: 20, fontWeight: "900", color: "#FFFFFF", marginTop: 2 },
  mvpCardTeam:   { fontSize: 11, fontWeight: "700", marginBottom: 10 },
  mvpCardStatsRow: { flexDirection: "row", gap: 20 },
  mvpStatItem:   { alignItems: "center", gap: 2 },
  mvpStatVal:    { fontSize: 16, fontWeight: "900", color: "#FFFFFF" },
  mvpStatLabel:  { fontSize: 9, color: "#6B7280", fontWeight: "700", letterSpacing: 1 },

  sectionTitle: {
    fontSize: 10, fontWeight: "900", color: "#6B7280",
    letterSpacing: 3, marginBottom: 12,
  },

  statsTable: {
    backgroundColor: "#0D0D0D", borderRadius: 14,
    borderWidth: 1, borderColor: "#1A1A1A",
    overflow: "hidden", marginBottom: 12,
  },
  statsTableTitle: {
    fontSize: 10, fontWeight: "900", letterSpacing: 1.5, padding: 12, paddingBottom: 8,
  },
  statsHeader: {
    flexDirection: "row", alignItems: "center",
    paddingHorizontal: 12, paddingBottom: 8,
    borderBottomWidth: 1, borderBottomColor: "#1A1A1A",
  },
  statsCol: { width: 32, fontSize: 9, fontWeight: "800", color: "#4B5563", textAlign: "center" },
  statsRow: {
    flexDirection: "row", alignItems: "center",
    paddingHorizontal: 12, paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: "#111",
  },
  statsRowMvp:   { backgroundColor: "#1A1400" },
  statsNameWrap: { flexDirection: "row", alignItems: "center", gap: 8 },
  statsName:     { fontSize: 13, fontWeight: "700", color: "#FFFFFF" },
  statsRole:     { fontSize: 9, color: "#4B5563" },
  statNum:       { width: 32, fontSize: 13, fontWeight: "600", color: "#9CA3AF", textAlign: "center" },
  statRtg:       { width: 32, fontSize: 13, fontWeight: "900", textAlign: "center" },
  mvpBadge: {
    backgroundColor: "#F59E0B22", borderWidth: 1, borderColor: "#F59E0B55",
    borderRadius: 4, paddingHorizontal: 5, paddingVertical: 1,
  },
  mvpText: { fontSize: 8, fontWeight: "900", color: "#F59E0B", letterSpacing: 0.5 },

  feedCard: {
    backgroundColor: "#0D0D0D", borderRadius: 14,
    borderWidth: 1, borderColor: "#1A1A1A",
    padding: 12, marginBottom: 12,
  },
  feedRow: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 6 },
  feedRound: { width: 24, fontSize: 9, fontWeight: "800", color: "#4B5563" },
  feedIcon: { fontSize: 12 },
  feedText: { flex: 1, fontSize: 12, color: "#D1D5DB" },
  feedTextUtil: { color: "#6B7280", fontStyle: "italic" },

  emptyCard: {
    backgroundColor: "#0D0D0D", borderRadius: 14,
    borderWidth: 1, borderColor: "#1A1A1A",
    padding: 28, alignItems: "center", gap: 6,
  },
  emptyEmoji: { fontSize: 32, marginBottom: 4 },
  emptyTitle: { fontSize: 13, fontWeight: "700", color: "#9CA3AF" },
  emptySub:   { fontSize: 11, color: "#4B5563", textAlign: "center", lineHeight: 16 },
});
