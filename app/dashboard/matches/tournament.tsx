import { useAppAlert } from "@/components/ui/AppAlert";
import { ScreenHeader } from "@/components/ui/ScreenHeader";
import { getTierInfo } from "@/constants/tiers";
import { supabase } from "@/database/supabase";
import { useFeatureFlags } from "@/hooks/useFeatureFlags";
import { useLanguage } from "@/i18n/LanguageContext";
import { router } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
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

interface TournamentInfo {
  id: string;
  tier: string;
  status: "registering" | "active" | "completed" | "cancelled";
  bracket_size: number;
  registration_ends_at: string;
  ends_at: string;
}

interface TournamentEntry {
  team_id: string;
  team_name: string;
}

interface TournamentMatch {
  id: string;
  round: number;
  slot: number;
  team_a_id: string | null;
  team_b_id: string | null;
  team_a_name: string | null;
  team_b_name: string | null;
  status: "pending" | "ready" | "played";
  scheduled_for: string | null;
  score_a: number | null;
  score_b: number | null;
  winner_team_id: string | null;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatTimeLeft(target: string, t: (key: string) => string): string {
  const diff = new Date(target).getTime() - Date.now();
  if (diff <= 0) return t("season.ended");
  const days  = Math.floor(diff / 86_400_000);
  const hours = Math.floor((diff % 86_400_000) / 3_600_000);
  if (days > 0) {
    return t("season.daysHoursLeft").replace("{d}", String(days)).replace("{h}", String(hours));
  }
  const mins = Math.floor((diff % 3_600_000) / 60_000);
  return t("season.hoursMinsLeft").replace("{h}", String(hours)).replace("{m}", String(mins));
}

function roundLabel(round: number, totalRounds: number, t: (key: string) => string): string {
  const remaining = totalRounds - round;
  if (remaining === 0) return t("tournament.roundFinal");
  if (remaining === 1) return t("tournament.roundSemifinals");
  if (remaining === 2) return t("tournament.roundQuarterfinals");
  return t("tournament.roundGeneric").replace("{n}", String(round));
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function TournamentScreen() {
  const { t } = useLanguage();
  const { isEnabled, loaded } = useFeatureFlags();

  useEffect(() => {
    if (loaded && !isEnabled("matches_tournament")) router.replace("/dashboard/matches");
  }, [loaded]);
  const { alert } = useAppAlert();

  const [loading, setLoading]     = useState(true);
  const [joining, setJoining]     = useState(false);
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const [tournament, setTournament] = useState<TournamentInfo | null>(null);
  const [entries, setEntries]     = useState<TournamentEntry[]>([]);
  const [matches, setMatches]     = useState<TournamentMatch[]>([]);
  const [myTeamId, setMyTeamId]   = useState<string | null>(null);
  const [tierColor, setTierColor] = useState("#6B7280");

  const fetchData = useCallback(async () => {
    setLoading(true);

    const { data: team } = await supabase.from("teams").select("id, pdl").single();
    if (!team) { setLoading(false); return; }
    setMyTeamId(team.id);

    const info = getTierInfo((team as any).pdl ?? 0);
    setTierColor(info.color);

    const { data: tournamentData, error } = await supabase.rpc("get_or_create_tournament", {
      p_tier: info.tier,
    });
    if (error || !tournamentData) { setLoading(false); return; }
    setTournament(tournamentData as TournamentInfo);

    const [{ data: entriesData }, { data: matchesData }] = await Promise.all([
      supabase
        .from("tournament_entries")
        .select("team_id, team_name")
        .eq("tournament_id", (tournamentData as TournamentInfo).id),
      supabase
        .from("tournament_matches")
        .select("id, round, slot, team_a_id, team_b_id, team_a_name, team_b_name, status, scheduled_for, score_a, score_b, winner_team_id")
        .eq("tournament_id", (tournamentData as TournamentInfo).id)
        .order("round", { ascending: true })
        .order("slot", { ascending: true }),
    ]);

    setEntries((entriesData ?? []) as TournamentEntry[]);
    setMatches((matchesData ?? []) as TournamentMatch[]);
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const hasJoined = !!myTeamId && entries.some((e) => e.team_id === myTeamId);

  const joinTournament = async () => {
    if (!tournament) return;
    setJoining(true);
    const { error } = await supabase.rpc("join_tournament", { p_tournament_id: tournament.id });
    setJoining(false);
    if (error) {
      const msg = error.message?.includes("tournament_full")
        ? t("tournament.errFull")
        : error.message?.includes("registration_closed")
        ? t("tournament.errClosed")
        : t("tournament.errJoinGeneric");
      alert(t("common.error"), msg);
      return;
    }
    fetchData();
  };

  const resolveMatch = async (matchId: string) => {
    setResolvingId(matchId);
    const { error } = await supabase.rpc("resolve_tournament_match", { p_match_id: matchId });
    setResolvingId(null);
    if (error) {
      alert(t("common.error"), t("tournament.errResolveGeneric"));
      return;
    }
    fetchData();
  };

  const totalRounds = tournament ? Math.round(Math.log2(tournament.bracket_size)) : 0;
  const rounds: TournamentMatch[][] = [];
  for (let r = 1; r <= totalRounds; r++) {
    rounds.push(matches.filter((m) => m.round === r));
  }

  return (
    <SafeAreaView style={s.safe} edges={["top"]}>

      <ScreenHeader title={t("tournament.headerTitle")} dotColor={tierColor} centered />

      {loading ? (
        <View style={s.center}>
          <ActivityIndicator size="large" color="#EC4899" />
          <Text style={s.loadingText}>{t("common.loading")}</Text>
        </View>
      ) : !tournament ? (
        <View style={s.center}>
          <Text style={s.loadingText}>{t("tournament.notFound")}</Text>
        </View>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 48 }}>

          {tournament.status === "registering" && (
            <View style={s.section}>
              <View style={[s.regCard, { borderColor: tierColor + "44" }]}>
                <Text style={s.regTitle}>{t("tournament.registeringTitle")}</Text>
                <Text style={[s.regCount, { color: tierColor }]}>
                  {entries.length}/{tournament.bracket_size}
                </Text>
                <Text style={s.regSub}>{formatTimeLeft(tournament.registration_ends_at, t)}</Text>

                {hasJoined ? (
                  <Text style={s.joinedNote}>{t("tournament.alreadyJoined")}</Text>
                ) : (
                  <TouchableOpacity style={s.joinBtn} onPress={joinTournament} disabled={joining}>
                    {joining
                      ? <ActivityIndicator size="small" color="#EC4899" />
                      : <Text style={s.joinBtnText}>{t("tournament.joinBtn")}</Text>}
                  </TouchableOpacity>
                )}
              </View>

              {entries.map((e) => (
                <View key={e.team_id} style={[s.entryRow, e.team_id === myTeamId && s.entryRowMe]}>
                  <Text style={[s.entryName, e.team_id === myTeamId && { color: "#FFFFFF" }]} numberOfLines={1}>
                    {e.team_name}{e.team_id === myTeamId ? t("season.youSuffix") : ""}
                  </Text>
                </View>
              ))}
            </View>
          )}

          {tournament.status === "cancelled" && (
            <View style={s.section}>
              <View style={s.emptyCard}>
                <Text style={s.emptyEmoji}>🚫</Text>
                <Text style={s.emptyTitle}>{t("tournament.cancelledTitle")}</Text>
                <Text style={s.emptySub}>{t("tournament.cancelledSub")}</Text>
              </View>
            </View>
          )}

          {(tournament.status === "active" || tournament.status === "completed") && (
            <View style={s.section}>
              <Text style={s.sectionTitle}>{t("tournament.bracketTitle")}</Text>
              {rounds.map((roundMatches, idx) => {
                const round = idx + 1;
                return (
                  <View key={round} style={{ marginBottom: 16 }}>
                    <Text style={s.roundLabel}>{roundLabel(round, totalRounds, t)}</Text>
                    {roundMatches.map((m) => {
                      const isMine = m.team_a_id === myTeamId || m.team_b_id === myTeamId;
                      const played = m.status === "played";
                      const canWatch = isMine && m.status === "ready"
                        && !!m.scheduled_for && new Date(m.scheduled_for) <= new Date();
                      const aWon = played && m.winner_team_id === m.team_a_id;
                      const bWon = played && m.winner_team_id === m.team_b_id;
                      return (
                        <View key={m.id} style={[s.matchCard, isMine && s.matchCardMine]}>
                          <View style={s.matchSide}>
                            <Text style={[s.matchName, aWon && s.matchNameWin]} numberOfLines={1}>
                              {m.team_a_name ?? t("tournament.pendingSlot")}
                            </Text>
                            {played && <Text style={[s.matchScore, aWon && s.matchScoreWin]}>{m.score_a}</Text>}
                          </View>
                          <Text style={s.matchVs}>{t("tournament.vsLabel")}</Text>
                          <View style={[s.matchSide, { alignItems: "flex-end" }]}>
                            {played && <Text style={[s.matchScore, bWon && s.matchScoreWin]}>{m.score_b}</Text>}
                            <Text style={[s.matchName, bWon && s.matchNameWin]} numberOfLines={1}>
                              {m.team_b_name ?? t("tournament.pendingSlot")}
                            </Text>
                          </View>

                          {canWatch && (
                            <TouchableOpacity
                              style={s.watchBtn}
                              onPress={() => resolveMatch(m.id)}
                              disabled={resolvingId === m.id}
                            >
                              {resolvingId === m.id
                                ? <ActivityIndicator size="small" color="#EC4899" />
                                : <Text style={s.watchBtnText}>{t("tournament.watchBtn")}</Text>}
                            </TouchableOpacity>
                          )}
                          {isMine && m.status === "ready" && !canWatch && (
                            <Text style={s.waitingNote}>{t("tournament.waitingTime")}</Text>
                          )}
                        </View>
                      );
                    })}
                  </View>
                );
              })}
            </View>
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

  section:     { paddingHorizontal: 16, marginBottom: 20 },
  sectionTitle: {
    fontSize: 10, fontWeight: "900", color: "#6B7280",
    letterSpacing: 3, marginBottom: 12,
  },

  regCard: {
    backgroundColor: "#0D0D0D", borderRadius: 16, borderWidth: 1,
    padding: 20, alignItems: "center", gap: 4, marginBottom: 12,
  },
  regTitle: { fontSize: 12, fontWeight: "800", color: "#9CA3AF", letterSpacing: 1 },
  regCount: { fontSize: 28, fontWeight: "900", marginTop: 4 },
  regSub:   { fontSize: 11, color: "#4B5563", marginBottom: 12 },
  joinedNote: { fontSize: 11, color: "#6B7280", textAlign: "center" },
  joinBtn: {
    paddingHorizontal: 24, paddingVertical: 12, borderRadius: 10,
    backgroundColor: "#EC489922", borderWidth: 1, borderColor: "#EC489966",
    minWidth: 200, alignItems: "center", height: 44, justifyContent: "center",
  },
  joinBtnText: { fontSize: 12, fontWeight: "800", color: "#EC4899", letterSpacing: 1 },

  entryRow: {
    backgroundColor: "#0D0D0D", borderRadius: 10, borderWidth: 1, borderColor: "#1A1A1A",
    paddingHorizontal: 14, paddingVertical: 10, marginBottom: 6,
  },
  entryRowMe: { borderColor: "#EC489944", backgroundColor: "#1A0D14" },
  entryName:  { fontSize: 13, fontWeight: "700", color: "#9CA3AF" },

  emptyCard: {
    backgroundColor: "#0D0D0D", borderRadius: 14, borderWidth: 1, borderColor: "#1A1A1A",
    padding: 28, alignItems: "center", gap: 6,
  },
  emptyEmoji: { fontSize: 32, marginBottom: 4 },
  emptyTitle: { fontSize: 13, fontWeight: "700", color: "#9CA3AF" },
  emptySub:   { fontSize: 11, color: "#4B5563", textAlign: "center" },

  roundLabel: {
    fontSize: 10, fontWeight: "900", color: "#4B5563",
    letterSpacing: 2, marginBottom: 8,
  },
  matchCard: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: "#0D0D0D", borderRadius: 12, borderWidth: 1, borderColor: "#1A1A1A",
    padding: 12, marginBottom: 8, gap: 8, flexWrap: "wrap",
  },
  matchCardMine: { borderColor: "#EC489944" },
  matchSide:  { flex: 1, gap: 2 },
  matchName:  { fontSize: 12, fontWeight: "700", color: "#9CA3AF" },
  matchNameWin: { color: "#FFFFFF" },
  matchScore: { fontSize: 14, fontWeight: "900", color: "#4B5563" },
  matchScoreWin: { color: "#10B981" },
  matchVs:    { fontSize: 10, color: "#374151", fontWeight: "700", marginHorizontal: 4 },
  watchBtn: {
    width: "100%", height: 40, borderRadius: 8, marginTop: 4,
    backgroundColor: "#EC489922", borderWidth: 1, borderColor: "#EC489966",
    alignItems: "center", justifyContent: "center",
  },
  watchBtnText: { fontSize: 11, fontWeight: "800", color: "#EC4899", letterSpacing: 1 },
  waitingNote: { width: "100%", fontSize: 10, color: "#4B5563", textAlign: "center", marginTop: 4 },
});
