import { useAppAlert } from "@/components/ui/AppAlert";
import { LiveScorePill } from "@/components/ui/LiveScorePill";
import { OpponentShield } from "@/components/ui/OpponentShield";
import { ScreenHeader } from "@/components/ui/ScreenHeader";
import { getTierInfo } from "@/constants/tiers";
import { supabase } from "@/database/supabase";
import { useFeatureFlags } from "@/hooks/useFeatureFlags";
import { useLanguage } from "@/i18n/LanguageContext";
import { fetchTeamShields, TeamShield } from "@/lib/shields";
import { useFocusEffect } from "@react-navigation/native";
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

interface RivalTeam {
  team_id: string;
  team_name: string;
}

interface TeamChallenge {
  id: string;
  challenger_team_id: string;
  challenger_name: string;
  opponent_team_id: string;
  opponent_name: string;
  status: "pending" | "accepted" | "declined" | "expired" | "live" | "played";
  scheduled_for: string | null;
  score_challenger: number | null;
  score_opponent: number | null;
  winner_team_id: string | null;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function ChallengesScreen() {
  const { t } = useLanguage();
  const { isEnabled, loaded } = useFeatureFlags();

  useEffect(() => {
    if (loaded && !isEnabled("matches_challenges")) router.replace("/dashboard/matches");
  }, [loaded]);
  const { alert } = useAppAlert();

  const [loading, setLoading]   = useState(true);
  const [myTeamId, setMyTeamId] = useState<string | null>(null);
  const [tierColor, setTierColor] = useState("#6B7280");
  const [rivals, setRivals]     = useState<RivalTeam[]>([]);
  const [challenges, setChallenges] = useState<TeamChallenge[]>([]);
  const [shields, setShields] = useState<Record<string, TeamShield>>({});

  const [challengingId, setChallengingId] = useState<string | null>(null);
  const [respondingId, setRespondingId]   = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);

    const { data: team } = await supabase.from("teams").select("id, pdl").single();
    if (!team) { setLoading(false); return; }
    setMyTeamId(team.id);

    const info = getTierInfo((team as any).pdl ?? 0);
    setTierColor(info.color);

    const { data: seasonData } = await supabase.rpc("get_or_create_season", { p_tier: info.tier });
    let rivalsList: RivalTeam[] = [];
    if (seasonData) {
      const { data: standingsData } = await supabase
        .from("season_standings")
        .select("team_id, team_name")
        .eq("season_id", (seasonData as any).id)
        .neq("team_id", team.id);
      rivalsList = (standingsData ?? []) as RivalTeam[];
      setRivals(rivalsList);
    } else {
      setRivals([]);
    }

    const { data: challengesData } = await supabase
      .from("team_challenges")
      .select("id, challenger_team_id, challenger_name, opponent_team_id, opponent_name, status, scheduled_for, score_challenger, score_opponent, winner_team_id")
      .or(`challenger_team_id.eq.${team.id},opponent_team_id.eq.${team.id}`)
      .order("created_at", { ascending: false });

    const challengesList = (challengesData ?? []) as TeamChallenge[];
    setChallenges(challengesList);

    const teamIds = [
      ...rivalsList.map((r) => r.team_id),
      ...challengesList.map((c) => c.challenger_team_id),
      ...challengesList.map((c) => c.opponent_team_id),
    ];
    fetchTeamShields(teamIds).then(setShields);

    setLoading(false);
  }, []);

  useFocusEffect(useCallback(() => { fetchData(); }, [fetchData]));

  // A partida agora progride sozinha no servidor (cron) — sem gatilho de client, a lista
  // precisa se atualizar por conta própria pra refletir accepted/live/played mudando.
  useEffect(() => {
    const timer = setInterval(fetchData, 15_000);
    return () => clearInterval(timer);
  }, [fetchData]);

  const errorMessage = (err: any, fallbackKey: string): string => {
    const msg = err?.message ?? "";
    if (msg.includes("challenge_already_pending")) return t("challenges.errAlreadyPending");
    if (msg.includes("wrong_tier")) return t("challenges.errWrongTier");
    return t(fallbackKey);
  };

  const challengeTeam = async (opponentId: string) => {
    setChallengingId(opponentId);
    const { error } = await supabase.rpc("send_challenge", { p_opponent_team_id: opponentId });
    setChallengingId(null);
    if (error) { alert(t("common.error"), errorMessage(error, "challenges.errSendGeneric")); return; }
    fetchData();
  };

  const respond = async (id: string, accept: boolean) => {
    setRespondingId(id);
    const { error } = await supabase.rpc("respond_to_challenge", { p_challenge_id: id, p_accept: accept });
    setRespondingId(null);
    if (error) { alert(t("common.error"), t("challenges.errRespondGeneric")); return; }
    fetchData();
  };

  const incoming = challenges.filter((c) => c.opponent_team_id === myTeamId && c.status === "pending");
  const outgoing = challenges.filter((c) => c.challenger_team_id === myTeamId && c.status === "pending");
  const accepted = challenges.filter((c) => c.status === "accepted" || c.status === "live");
  const history  = challenges.filter((c) => c.status === "played").slice(0, 10);

  const pendingRivalIds = new Set(
    challenges
      .filter((c) => c.status === "pending" || c.status === "accepted" || c.status === "live")
      .map((c) => (c.challenger_team_id === myTeamId ? c.opponent_team_id : c.challenger_team_id)),
  );

  return (
    <SafeAreaView style={s.safe} edges={["top"]}>

      <ScreenHeader title={t("challenges.headerTitle")} dotColor={tierColor} centered />

      {loading ? (
        <View style={s.center}>
          <ActivityIndicator size="large" color="#EC4899" />
          <Text style={s.loadingText}>{t("common.loading")}</Text>
        </View>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 48 }}>

          {/* ══ RECEBIDOS ══════════════════════════════════ */}
          {incoming.length > 0 && (
            <View style={s.section}>
              <Text style={s.sectionTitle}>{t("challenges.incomingTitle")}</Text>
              {incoming.map((c) => (
                <View key={c.id} style={s.challengeCard}>
                  <OpponentShield shield={shields[c.challenger_team_id] ?? null} size={28} />
                  <Text style={s.challengeName} numberOfLines={1}>{c.challenger_name}</Text>
                  <View style={s.respondRow}>
                    <TouchableOpacity
                      style={[s.respondBtn, s.declineBtn]}
                      onPress={() => respond(c.id, false)}
                      disabled={respondingId === c.id}
                    >
                      <Text style={s.declineBtnText}>{t("challenges.declineBtn")}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[s.respondBtn, s.acceptBtn]}
                      onPress={() => respond(c.id, true)}
                      disabled={respondingId === c.id}
                    >
                      {respondingId === c.id
                        ? <ActivityIndicator size="small" color="#10B981" />
                        : <Text style={s.acceptBtnText}>{t("challenges.acceptBtn")}</Text>}
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
            </View>
          )}

          {/* ══ PRONTOS / AGUARDANDO ═══════════════════════ */}
          {accepted.length > 0 && (
            <View style={s.section}>
              <Text style={s.sectionTitle}>{t("challenges.acceptedTitle")}</Text>
              {accepted.map((c) => {
                const opponentTeamId = c.challenger_team_id === myTeamId ? c.opponent_team_id : c.challenger_team_id;
                const opponentName = c.challenger_team_id === myTeamId ? c.opponent_name : c.challenger_name;
                const dueNotYetLive = c.status === "accepted"
                  && !!c.scheduled_for && new Date(c.scheduled_for) <= new Date();
                return (
                  <View key={c.id} style={s.challengeCard}>
                    <OpponentShield shield={shields[opponentTeamId] ?? null} size={28} />
                    <Text style={s.challengeName} numberOfLines={1}>{t("challenges.vsPrefix")} {opponentName}</Text>
                    {c.status === "live" ? (
                      <LiveScorePill matchSource="challenge" matchId={c.id} />
                    ) : dueNotYetLive ? (
                      <Text style={s.waitingNote}>{t("challenges.startingSoon")}</Text>
                    ) : (
                      <Text style={s.waitingNote}>{t("challenges.waitingTime")}</Text>
                    )}
                  </View>
                );
              })}
            </View>
          )}

          {/* ══ ENVIADOS ═══════════════════════════════════ */}
          {outgoing.length > 0 && (
            <View style={s.section}>
              <Text style={s.sectionTitle}>{t("challenges.outgoingTitle")}</Text>
              {outgoing.map((c) => (
                <View key={c.id} style={s.challengeCard}>
                  <OpponentShield shield={shields[c.opponent_team_id] ?? null} size={28} />
                  <Text style={s.challengeName} numberOfLines={1}>{c.opponent_name}</Text>
                  <Text style={s.waitingNote}>{t("challenges.awaitingResponse")}</Text>
                </View>
              ))}
            </View>
          )}

          {/* ══ TIMES DO ELO ═══════════════════════════════ */}
          <View style={s.section}>
            <Text style={s.sectionTitle}>{t("challenges.rivalsTitle")}</Text>
            {rivals.length === 0 ? (
              <View style={s.emptyCard}>
                <Text style={s.emptyEmoji}>🤝</Text>
                <Text style={s.emptyText}>{t("challenges.noRivals")}</Text>
              </View>
            ) : (
              rivals.map((r) => {
                const disabled = pendingRivalIds.has(r.team_id) || challengingId === r.team_id;
                return (
                  <View key={r.team_id} style={s.rivalRow}>
                    <OpponentShield shield={shields[r.team_id] ?? null} size={24} />
                    <Text style={s.rivalName} numberOfLines={1}>{r.team_name}</Text>
                    <TouchableOpacity
                      style={[s.challengeBtn, disabled && s.challengeBtnDisabled]}
                      onPress={() => challengeTeam(r.team_id)}
                      disabled={disabled}
                    >
                      {challengingId === r.team_id
                        ? <ActivityIndicator size="small" color="#EC4899" />
                        : <Text style={s.challengeBtnText}>
                            {pendingRivalIds.has(r.team_id) ? t("challenges.pendingLabel") : t("challenges.challengeBtn")}
                          </Text>}
                    </TouchableOpacity>
                  </View>
                );
              })
            )}
          </View>

          {/* ══ HISTÓRICO ══════════════════════════════════ */}
          {history.length > 0 && (
            <View style={s.section}>
              <Text style={s.sectionTitle}>{t("challenges.historyTitle")}</Text>
              {history.map((c) => {
                const iAmChallenger = c.challenger_team_id === myTeamId;
                const myScore  = iAmChallenger ? c.score_challenger : c.score_opponent;
                const oppScore = iAmChallenger ? c.score_opponent  : c.score_challenger;
                const oppName  = iAmChallenger ? c.opponent_name   : c.challenger_name;
                const oppTeamId = iAmChallenger ? c.opponent_team_id : c.challenger_team_id;
                const won = c.winner_team_id === myTeamId;
                return (
                  <View key={c.id} style={[s.historyCard, won ? s.historyCardWin : s.historyCardLoss]}>
                    <Text style={[s.historyResult, { color: won ? "#10B981" : "#EF4444" }]}>
                      {won ? t("challenges.resultWin") : t("challenges.resultLoss")}
                    </Text>
                    <Text style={s.historyScore}>{myScore} – {oppScore}</Text>
                    <OpponentShield shield={shields[oppTeamId] ?? null} size={18} />
                    <Text style={s.historyOpponent} numberOfLines={1}>{t("challenges.vsPrefix")} {oppName}</Text>
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

  challengeCard: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    backgroundColor: "#0D0D0D", borderRadius: 12, borderWidth: 1, borderColor: "#1A1A1A",
    padding: 12, marginBottom: 8, gap: 8,
  },
  challengeName: { flex: 1, fontSize: 13, fontWeight: "700", color: "#FFFFFF" },
  respondRow:    { flexDirection: "row", gap: 8 },
  respondBtn: {
    paddingHorizontal: 14, height: 36, borderRadius: 8,
    justifyContent: "center", alignItems: "center", borderWidth: 1,
  },
  declineBtn:     { backgroundColor: "#161616", borderColor: "#242424" },
  declineBtnText: { fontSize: 10, fontWeight: "800", color: "#6B7280", letterSpacing: 0.5 },
  acceptBtn:      { backgroundColor: "#10B98122", borderColor: "#10B98166" },
  acceptBtnText:  { fontSize: 10, fontWeight: "800", color: "#10B981", letterSpacing: 0.5 },

  watchBtn: {
    paddingHorizontal: 16, height: 36, borderRadius: 8,
    backgroundColor: "#EC489922", borderWidth: 1, borderColor: "#EC489966",
    justifyContent: "center", alignItems: "center",
  },
  watchBtnText: { fontSize: 10, fontWeight: "800", color: "#EC4899", letterSpacing: 0.5 },
  waitingNote:  { fontSize: 10, color: "#4B5563" },

  emptyCard: {
    backgroundColor: "#0D0D0D", borderRadius: 14, borderWidth: 1, borderColor: "#1A1A1A",
    padding: 24, alignItems: "center", gap: 8,
  },
  emptyEmoji: { fontSize: 28, marginBottom: 2 },
  emptyText:  { fontSize: 12, color: "#6B7280", textAlign: "center" },

  rivalRow: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    backgroundColor: "#0D0D0D", borderRadius: 10, borderWidth: 1, borderColor: "#1A1A1A",
    paddingHorizontal: 14, paddingVertical: 10, marginBottom: 6, gap: 8,
  },
  rivalName: { flex: 1, fontSize: 13, fontWeight: "700", color: "#9CA3AF" },
  challengeBtn: {
    paddingHorizontal: 14, height: 32, borderRadius: 8,
    backgroundColor: "#EC489922", borderWidth: 1, borderColor: "#EC489966",
    justifyContent: "center", alignItems: "center", minWidth: 84,
  },
  challengeBtnDisabled: { backgroundColor: "#161616", borderColor: "#242424" },
  challengeBtnText: { fontSize: 9, fontWeight: "800", color: "#EC4899", letterSpacing: 0.5 },

  historyCard: {
    flexDirection: "row", alignItems: "center", gap: 10,
    backgroundColor: "#0D0D0D", borderRadius: 10, borderWidth: 1,
    paddingHorizontal: 14, paddingVertical: 10, marginBottom: 6,
  },
  historyCardWin:  { borderColor: "#10B98122" },
  historyCardLoss: { borderColor: "#EF444422" },
  historyResult: { fontSize: 11, fontWeight: "900", width: 24 },
  historyScore:  { fontSize: 13, fontWeight: "900", color: "#FFFFFF", width: 50 },
  historyOpponent: { flex: 1, fontSize: 12, color: "#6B7280" },
});
