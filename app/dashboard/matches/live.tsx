import { MatchupShields } from "@/components/ui/MatchupShields";
import { OpponentShield } from "@/components/ui/OpponentShield";
import { RewardedAdButton } from "@/components/ui/RewardedAdButton";
import { ScreenHeader } from "@/components/ui/ScreenHeader";
import { supabase } from "@/database/supabase";
import { MatchEvent, MatchRosterPlayer, useMatchLiveSession } from "@/hooks/useMatchLiveSession";
import { useLanguage } from "@/i18n/LanguageContext";
import { fetchTeamShields, TeamShield } from "@/lib/shields";
import { router } from "expo-router";
import React, { useEffect, useMemo, useRef, useState } from "react";
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

interface TeamData {
  id: string;
  name: string;
  budget: number;
  fans: number;
  wins: number;
  losses: number;
  pdl: number;
}

interface MatchInfo {
  id: string;
  fixture_id: string;
  opponent_name: string;
  opponent_team_id: string | null;
  map: string;
}

interface FinalResult {
  result: "win" | "loss";
  score_own: number;
  score_opp: number;
  fans_delta: number;
  budget_delta: number;
  pdl_delta: number;
}

interface FeedItem {
  id: string;
  round: number;
  text: string;
  killerSide: "own" | "opp";
  killerId: string;
  victimSide: "own" | "opp";
  victimId: string;
}

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

// ── Helpers ───────────────────────────────────────────────────────────────────

function killLine(killer: string, victim: string, t: (key: string) => string): string {
  const templates = [
    "live.killTemplate1", "live.killTemplate2", "live.killTemplate3",
    "live.killTemplate4", "live.killTemplate5",
  ];
  const key = templates[(killer.length + victim.length) % templates.length];
  return t(key).replace("{k}", killer).replace("{v}", victim);
}

function buildStatLines(roster: MatchRosterPlayer[], feed: FeedItem[], mySide: "a" | "b", side: "own" | "opp"): StatLine[] {
  const tally: Record<string, { kills: number; deaths: number }> = {};
  roster.forEach((p) => { tally[p.id] = { kills: 0, deaths: 0 }; });

  for (const item of feed) {
    if (item.victimSide === side && tally[item.victimId]) tally[item.victimId].deaths++;
    if (item.killerSide === side && tally[item.killerId]) tally[item.killerId].kills++;
  }
  return roster.map((p) => {
    const t = tally[p.id] ?? { kills: 0, deaths: 0 };
    const kd = t.deaths > 0 ? t.kills / t.deaths : t.kills;
    const rating = Math.max(0.3, Math.min(2.4, 0.6 + kd * 0.35));
    return { id: p.id, name: p.name, role: p.role, kills: t.kills, deaths: t.deaths, assists: 0, rating, mvp: false };
  });
}

function pickMatchMvp(own: StatLine[], opp: StatLine[]): { stat: StatLine; side: "own" | "opp" } | null {
  const combined = [
    ...own.map((stat) => ({ stat, side: "own" as const })),
    ...opp.map((stat) => ({ stat, side: "opp" as const })),
  ];
  if (!combined.length) return null;
  return combined.reduce((best, cur) => (cur.stat.rating > best.stat.rating ? cur : best), combined[0]);
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function LiveMatchScreen() {
  const { t } = useLanguage();

  const [team, setTeam] = useState<TeamData | null>(null);
  const [match, setMatch] = useState<MatchInfo | null>(null);
  const [mySide, setMySide] = useState<"a" | "b" | null>(null);
  const [finalResult, setFinalResult] = useState<FinalResult | null>(null);
  const [tab, setTab] = useState<"live" | "history">("live");
  const [loadingBase, setLoadingBase] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");
  const [opponentShield, setOpponentShield] = useState<TeamShield | null>(null);
  const [ownShield, setOwnShield] = useState<TeamShield | null>(null);

  const liveScrollRef = useRef<ScrollView>(null);
  const historyScrollRef = useRef<ScrollView>(null);

  const { loading: loadingSession, state, events, isScheduled, isLive, isFinished } =
    useMatchLiveSession("league", match?.fixture_id);

  useEffect(() => {
    (async () => {
      const { data: teamData } = await supabase
        .from("teams")
        .select("id, name, budget, fans, wins, losses, pdl")
        .single();
      if (!teamData) { setErrorMsg(t("live.errTeamNotFound")); setLoadingBase(false); return; }
      setTeam({ ...(teamData as any), pdl: (teamData as any).pdl ?? 0 } as TeamData);

      const { data: matchData } = await supabase
        .from("matches")
        .select("id, fixture_id, opponent_name, opponent_team_id, map")
        .eq("team_id", (teamData as any).id)
        .in("status", ["scheduled", "live", "played"])
        .order("scheduled_for", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!matchData) { setErrorMsg(t("live.errNoMatchReady")); setLoadingBase(false); return; }
      const m = matchData as MatchInfo;
      setMatch(m);
      const ownId = (teamData as any).id as string;
      fetchTeamShields([ownId, m.opponent_team_id]).then((shields) => {
        setOwnShield(shields[ownId] ?? null);
        if (m.opponent_team_id) setOpponentShield(shields[m.opponent_team_id] ?? null);
      });
      setLoadingBase(false);
    })();
  }, [t]);

  // Determina se sou o lado "a" ou "b" da sessão comparando meus jogadores com roster_a.
  useEffect(() => {
    if (!state || !team) return;
    (async () => {
      const { data: myPlayers } = await supabase.from("players").select("id").eq("team_id", team.id);
      const myIds = new Set((myPlayers ?? []).map((p: any) => p.id));
      const isA = state.roster_a.some((p) => myIds.has(p.id));
      setMySide(isA ? "a" : "b");
    })();
  }, [state, team]);

  // Busca o resultado final gravado pelo motor assim que a sessão vira 'played'.
  useEffect(() => {
    if (!isFinished || !match) return;
    supabase
      .from("matches")
      .select("result, score_own, score_opp, fans_delta, budget_delta, pdl_delta")
      .eq("id", match.id)
      .maybeSingle()
      .then(({ data }) => {
        if (data) setFinalResult(data as FinalResult);
      });
  }, [isFinished, match]);

  const feed: FeedItem[] = useMemo(() => {
    if (!mySide) return [];
    return events
      .filter((e): e is MatchEvent & { event_type: "kill" } => e.event_type === "kill")
      .map((e) => {
        const p = e.payload;
        const killerSide: "own" | "opp" = p.killer_side === mySide ? "own" : "opp";
        const victimSide: "own" | "opp" = p.victim_side === mySide ? "own" : "opp";
        return {
          id: e.id,
          round: e.round,
          text: killLine(p.killer_name, p.victim_name, t),
          killerSide, victimSide,
          killerId: p.killer_id,
          victimId: p.victim_id,
        };
      });
  }, [events, mySide, t]);

  const ownRoster = mySide === "a" ? state?.roster_a : state?.roster_b;
  const oppRoster = mySide === "a" ? state?.roster_b : state?.roster_a;

  const roundEndEvents = events.filter((e) => e.event_type === "round_end");
  const lastRoundEnd = roundEndEvents[roundEndEvents.length - 1]?.payload;
  const scoreOwn = lastRoundEnd ? (mySide === "a" ? lastRoundEnd.score_a : lastRoundEnd.score_b) : 0;
  const scoreOpp = lastRoundEnd ? (mySide === "a" ? lastRoundEnd.score_b : lastRoundEnd.score_a) : 0;

  const aliveOwn = useMemo(() => {
    if (!ownRoster) return [];
    const dead = new Set(feed.filter((f) => f.victimSide === "own").map((f) => f.victimId));
    return ownRoster.filter((p) => !dead.has(p.id)).map((p) => p.id);
  }, [ownRoster, feed]);
  const aliveOpp = useMemo(() => {
    if (!oppRoster) return [];
    const dead = new Set(feed.filter((f) => f.victimSide === "opp").map((f) => f.victimId));
    return oppRoster.filter((p) => !dead.has(p.id)).map((p) => p.id);
  }, [oppRoster, feed]);

  const ownStats = useMemo(() => (ownRoster ? buildStatLines(ownRoster, feed, mySide ?? "a", "own") : []), [ownRoster, feed, mySide]);
  const oppStats = useMemo(() => (oppRoster ? buildStatLines(oppRoster, feed, mySide ?? "a", "opp") : []), [oppRoster, feed, mySide]);

  useEffect(() => { liveScrollRef.current?.scrollToEnd({ animated: true }); }, [feed.length]);

  const goBack = () => router.replace("/dashboard/matches");

  // ── Loading / error states ───────────────────────────────────────────────
  if (loadingBase || (match && loadingSession && !state)) {
    return (
      <SafeAreaView style={s.safe} edges={["top"]}>
        <View style={s.center}>
          <ActivityIndicator size="large" color="#EC4899" />
          <Text style={s.loadingText}>{t("live.loading")}</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (errorMsg) {
    return (
      <SafeAreaView style={s.safe} edges={["top"]}>
        <View style={s.center}>
          <Text style={s.errorEmoji}>⚠️</Text>
          <Text style={s.errorText}>{errorMsg}</Text>
          <TouchableOpacity style={s.errorBtn} onPress={goBack}>
            <Text style={s.errorBtnText}>{t("live.backBtn")}</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // A partida ainda não começou no servidor (kickoff do cron pode levar até ~1min depois do
  // horário agendado) — não há mais nada pro client decidir, só esperar o próximo tick.
  if (isScheduled) {
    return (
      <SafeAreaView style={s.safe} edges={["top"]}>
        <View style={s.center}>
          <ActivityIndicator size="large" color="#EC4899" />
          <Text style={s.loadingText}>{t("live.waitingKickoff")}</Text>
        </View>
      </SafeAreaView>
    );
  }

  // ── Result state ──────────────────────────────────────────────────────────
  if (isFinished && finalResult && team) {
    const won = finalResult.result === "win";
    const matchMvp = pickMatchMvp(ownStats, oppStats);
    return (
      <SafeAreaView style={s.safe} edges={["top"]}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>

          <View style={[s.heroCard, won ? s.heroWin : s.heroLoss]}>
            <Text style={s.heroMap}>{match?.map}</Text>
            <View style={s.matchupRow}>
              <MatchupShields ownShield={ownShield} opponentShield={opponentShield} size={36} />
            </View>
            <View style={s.scoreRow}>
              <View style={s.scoreTeam}>
                <Text style={s.scoreTeamName} numberOfLines={1}>{team.name.toUpperCase()}</Text>
                <Text style={[s.scoreNum, won ? s.scoreWin : s.scoreLoss]}>{finalResult.score_own}</Text>
              </View>
              <Text style={s.scoreDash}>–</Text>
              <View style={s.scoreTeam}>
                <Text style={s.scoreTeamName} numberOfLines={1}>{match?.opponent_name.toUpperCase()}</Text>
                <Text style={[s.scoreNum, !won ? s.scoreWin : s.scoreLoss]}>{finalResult.score_opp}</Text>
              </View>
            </View>
            <View style={[s.verdictBadge, won ? s.verdictWin : s.verdictLoss]}>
              <Text style={[s.verdictText, { color: won ? "#10B981" : "#EF4444" }]}>
                {won ? t("live.victory") : t("live.defeat")}
              </Text>
            </View>
          </View>

          <View style={[s.pdlResultCard, { borderColor: (finalResult.pdl_delta > 0 ? "#10B981" : "#EF4444") + "44" }]}>
            <Text style={[s.pdlResultDelta, { color: finalResult.pdl_delta > 0 ? "#10B981" : "#EF4444" }]}>
              {finalResult.pdl_delta > 0 ? "+" : ""}{finalResult.pdl_delta} PDL
            </Text>
            <Text style={s.pdlResultAfter}>{t("live.newTotal")} {team.pdl}</Text>
          </View>

          {(finalResult.fans_delta !== 0 || finalResult.budget_delta > 0) && (
            <View style={s.rewardsRow}>
              {finalResult.fans_delta !== 0 && (
                <View style={[s.rewardPill, finalResult.fans_delta > 0 ? s.pillGreen : s.pillRed]}>
                  <Text style={s.rewardText}>{finalResult.fans_delta > 0 ? "+" : ""}{finalResult.fans_delta} {t("live.fansUnit")}</Text>
                </View>
              )}
              {finalResult.budget_delta > 0 && (
                <View style={[s.rewardPill, s.pillYellow]}>
                  <Text style={s.rewardText}>+${finalResult.budget_delta.toLocaleString("pt-BR")}</Text>
                </View>
              )}
            </View>
          )}

          {matchMvp && (
            <View style={[s.mvpCard, { borderColor: (matchMvp.side === "own" ? "#10B981" : "#EF4444") + "44" }]}>
              <Text style={s.mvpCardTrophy}>🏆</Text>
              <Text style={s.mvpCardLabel}>{t("live.matchMvpTitle")}</Text>
              <Text style={s.mvpCardName}>{matchMvp.stat.name}</Text>
              <Text style={[s.mvpCardTeam, { color: matchMvp.side === "own" ? "#10B981" : "#EF4444" }]}>
                {matchMvp.stat.role} · {matchMvp.side === "own" ? team.name.toUpperCase() : (match?.opponent_name ?? t("live.opponentFallback")).toUpperCase()}
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

          <ScoreboardTable title={team.name.toUpperCase()} stats={ownStats} accent="#10B981" playerCol={t("live.playerCol")} mvpLabel="MVP" />
          <ScoreboardTable title={match?.opponent_name.toUpperCase() ?? t("live.opponentFallback")} shield={opponentShield} stats={oppStats} accent="#EF4444" playerCol={t("live.playerCol")} mvpLabel="MVP" />

          <View style={{ marginBottom: 10 }}>
            <RewardedAdButton />
          </View>

          <TouchableOpacity style={s.closeBtn} onPress={goBack}>
            <Text style={s.closeBtnText}>{t("live.backToMatches")}</Text>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // ── Live state (ao vivo ou já finalizando, aguardando o finalize gravar o resultado) ───────
  return (
    <SafeAreaView style={s.safe} edges={["top"]}>
      <ScreenHeader
        title={t("live.headerLive")}
        titleStyle={{ fontSize: 14, letterSpacing: 3 }}
        dotColor="#EF4444"
        centered
        onBack={goBack}
      />

      <View style={s.scoreBar}>
        <Text style={s.scoreBarNum}>{scoreOwn}</Text>
        <View style={s.scoreBarMid}>
          <Text style={s.scoreBarMap}>{match?.map}</Text>
          <Text style={s.scoreBarRound}>{t("live.roundLabel")} {state?.revealed_rounds ?? 0}/{state?.total_rounds ?? 0}</Text>
        </View>
        <Text style={s.scoreBarNum}>{scoreOpp}</Text>
      </View>

      {/* ── ROSTERS ─────────────────────────────────────── */}
      <View style={s.rosters}>
        <RosterColumn label={t("live.yourTeam")} players={ownRoster ?? []} aliveIds={aliveOwn} align="left" accent="#10B981" />
        <View style={s.rostersDivider} />
        <RosterColumn label={match?.opponent_name ?? t("live.opponentFallback")} shield={opponentShield} players={oppRoster ?? []} aliveIds={aliveOpp} align="right" accent="#EF4444" />
      </View>

      {/* ── TABS ────────────────────────────────────────── */}
      <View style={s.tabs}>
        <TouchableOpacity style={[s.tab, tab === "live" && s.tabActive]} onPress={() => setTab("live")}>
          <Text style={[s.tabText, tab === "live" && s.tabTextActive]}>{t("live.tabLive")}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[s.tab, tab === "history" && s.tabActive]} onPress={() => setTab("history")}>
          <Text style={[s.tabText, tab === "history" && s.tabTextActive]}>{t("live.tabHistory")}</Text>
        </TouchableOpacity>
      </View>

      {tab === "live" ? (
        <ScrollView
          ref={liveScrollRef}
          style={s.feed}
          showsVerticalScrollIndicator={false}
          onContentSizeChange={() => liveScrollRef.current?.scrollToEnd({ animated: true })}
        >
          {feed.slice(-30).map((ev) => <FeedRow key={ev.id} ev={ev} />)}
        </ScrollView>
      ) : (
        <ScrollView
          ref={historyScrollRef}
          style={s.feed}
          showsVerticalScrollIndicator={false}
          onContentSizeChange={() => historyScrollRef.current?.scrollToEnd({ animated: true })}
        >
          {feed.map((ev) => <FeedRow key={ev.id} ev={ev} showRound />)}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

// ── Subcomponents ────────────────────────────────────────────────────────────

function RosterColumn({
  label, shield, players, aliveIds, align, accent,
}: {
  label: string;
  shield?: TeamShield | null;
  players: MatchRosterPlayer[];
  aliveIds: string[];
  align: "left" | "right";
  accent: string;
}) {
  return (
    <View style={s.rosterCol}>
      <View style={[s.rosterLabelRow, align === "right" && { flexDirection: "row-reverse" }]}>
        {shield !== undefined && <OpponentShield shield={shield} size={16} />}
        <Text style={[s.rosterLabel, { color: accent, textAlign: align }]} numberOfLines={1}>{label}</Text>
      </View>
      {players.map((p) => {
        const alive = aliveIds.includes(p.id);
        return (
          <View key={p.id} style={[s.rosterRow, align === "right" && { flexDirection: "row-reverse" }]}>
            <View style={[s.rosterDot, { backgroundColor: alive ? accent : "#333" }]} />
            <Text
              style={[
                s.rosterName,
                { textAlign: align },
                !alive && s.rosterNameDead,
              ]}
              numberOfLines={1}
            >
              {p.name}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

function FeedRow({ ev, showRound }: { ev: FeedItem; showRound?: boolean }) {
  return (
    <View style={s.feedRow}>
      {showRound && <Text style={s.feedRound}>R{ev.round}</Text>}
      <Text style={s.feedIcon}>{ev.killerSide === "own" ? "🔫" : "☠️"}</Text>
      <Text style={s.feedText} numberOfLines={2}>{ev.text}</Text>
    </View>
  );
}

function ScoreboardTable({
  title, shield, stats, accent, playerCol, mvpLabel,
}: { title: string; shield?: TeamShield | null; stats: StatLine[]; accent: string; playerCol: string; mvpLabel: string }) {
  return (
    <View style={s.statsTable}>
      <View style={s.statsTableTitleRow}>
        {shield !== undefined && <OpponentShield shield={shield} size={16} />}
        <Text style={[s.statsTableTitle, { color: accent }]}>{title}</Text>
      </View>
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
              <View style={s.mvpBadge}><Text style={s.mvpText}>{mvpLabel}</Text></View>
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
  errorBtnText: { fontSize: 12, fontWeight: "800", color: "#9CA3AF" },

  scoreBar: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 24, paddingVertical: 10,
  },
  scoreBarNum: { fontSize: 28, fontWeight: "900", color: "#FFFFFF", width: 60, textAlign: "center" },
  scoreBarMid: { alignItems: "center", gap: 2 },
  scoreBarMap: { fontSize: 11, fontWeight: "800", color: "#9CA3AF", letterSpacing: 1 },
  scoreBarRound: { fontSize: 10, color: "#4B5563" },

  rosters: {
    flexDirection: "row", paddingHorizontal: 16, paddingVertical: 8,
    borderTopWidth: 1, borderBottomWidth: 1, borderColor: "#141414",
  },
  rosterCol: { flex: 1, gap: 6 },
  rosterLabelRow: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 4 },
  rosterLabel: { fontSize: 10, fontWeight: "900", letterSpacing: 1, flexShrink: 1 },
  rosterRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  rosterDot: { width: 6, height: 6, borderRadius: 3 },
  rosterName: { flex: 1, fontSize: 11, color: "#D1D5DB" },
  rosterNameDead: { color: "#374151", textDecorationLine: "line-through" },
  rostersDivider: { width: 1, backgroundColor: "#1A1A1A", marginHorizontal: 8 },

  tabs: { flexDirection: "row", paddingHorizontal: 16, paddingTop: 10, gap: 8 },
  tab: {
    flex: 1, paddingVertical: 8, borderRadius: 8, alignItems: "center",
    backgroundColor: "#111", borderWidth: 1, borderColor: "#1A1A1A",
  },
  tabActive: { backgroundColor: "#1A0D14", borderColor: "#EC489966" },
  tabText: { fontSize: 10, fontWeight: "800", color: "#6B7280", letterSpacing: 1 },
  tabTextActive: { color: "#EC4899" },

  feed: { flex: 1, paddingHorizontal: 16, paddingTop: 10 },
  feedRow: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 5 },
  feedRound: { fontSize: 9, fontWeight: "800", color: "#4B5563", width: 24 },
  feedIcon: { fontSize: 13 },
  feedText: { flex: 1, fontSize: 12, color: "#D1D5DB" },

  heroCard: { borderRadius: 20, borderWidth: 1, padding: 24, alignItems: "center", marginBottom: 16 },
  heroWin: { backgroundColor: "#0D1F16", borderColor: "#1A3D2A" },
  heroLoss: { backgroundColor: "#1F0D0D", borderColor: "#3D1A1A" },
  heroMap: { fontSize: 11, fontWeight: "800", color: "#6B7280", letterSpacing: 2, marginBottom: 12 },
  matchupRow: { marginBottom: 12 },
  scoreRow: { flexDirection: "row", alignItems: "center", gap: 16 },
  scoreTeam: { alignItems: "center", gap: 4, minWidth: 100 },
  scoreTeamName: { fontSize: 11, fontWeight: "800", color: "#9CA3AF" },
  scoreNum: { fontSize: 40, fontWeight: "900" },
  scoreWin: { color: "#10B981" },
  scoreLoss: { color: "#EF4444" },
  scoreDash: { fontSize: 24, fontWeight: "900", color: "#374151" },
  verdictBadge: { marginTop: 14, borderRadius: 10, paddingHorizontal: 16, paddingVertical: 6, borderWidth: 1 },
  verdictWin: { backgroundColor: "#10B98118", borderColor: "#10B98144" },
  verdictLoss: { backgroundColor: "#EF444418", borderColor: "#EF444444" },
  verdictText: { fontSize: 12, fontWeight: "900", letterSpacing: 1 },

  pdlResultCard: {
    backgroundColor: "#0D0D0D", borderRadius: 14, borderWidth: 1,
    padding: 16, alignItems: "center", marginBottom: 12,
  },
  pdlResultDelta: { fontSize: 22, fontWeight: "900" },
  pdlResultAfter: { fontSize: 11, color: "#6B7280", marginTop: 4 },

  rewardsRow: { flexDirection: "row", gap: 8, marginBottom: 16, justifyContent: "center" },
  rewardPill: { borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8, borderWidth: 1 },
  pillGreen: { backgroundColor: "#10B98118", borderColor: "#10B98144" },
  pillRed: { backgroundColor: "#EF444418", borderColor: "#EF444444" },
  pillYellow: { backgroundColor: "#F59E0B18", borderColor: "#F59E0B44" },
  rewardText: { fontSize: 12, fontWeight: "800", color: "#FFFFFF" },

  mvpCard: {
    backgroundColor: "#0D0D0D", borderRadius: 16, borderWidth: 1,
    padding: 18, alignItems: "center", marginBottom: 16,
  },
  mvpCardTrophy: { fontSize: 28, marginBottom: 6 },
  mvpCardLabel: { fontSize: 10, fontWeight: "900", color: "#6B7280", letterSpacing: 2 },
  mvpCardName: { fontSize: 18, fontWeight: "900", color: "#FFFFFF", marginTop: 6 },
  mvpCardTeam: { fontSize: 11, fontWeight: "700", marginTop: 2 },
  mvpCardStatsRow: { flexDirection: "row", gap: 20, marginTop: 14 },
  mvpStatItem: { alignItems: "center" },
  mvpStatVal: { fontSize: 16, fontWeight: "900", color: "#FFFFFF" },
  mvpStatLabel: { fontSize: 9, color: "#4B5563", fontWeight: "700", marginTop: 2 },

  statsTable: { marginBottom: 14 },
  statsTableTitleRow: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 8 },
  statsTableTitle: { fontSize: 11, fontWeight: "900", letterSpacing: 1 },
  statsHeader: { flexDirection: "row", paddingHorizontal: 4, marginBottom: 4 },
  statsCol: { width: 40, fontSize: 9, fontWeight: "800", color: "#4B5563", textAlign: "center" },
  statsRow: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: "#0D0D0D", borderRadius: 10, borderWidth: 1, borderColor: "#1A1A1A",
    paddingHorizontal: 10, paddingVertical: 8, marginBottom: 4,
  },
  statsRowMvp: { borderColor: "#F59E0B55" },
  statsNameWrap: { flexDirection: "row", alignItems: "center", gap: 8 },
  mvpBadge: { backgroundColor: "#F59E0B22", borderRadius: 4, paddingHorizontal: 5, paddingVertical: 2 },
  mvpText: { fontSize: 8, fontWeight: "900", color: "#F59E0B" },
  statsName: { fontSize: 11, fontWeight: "700", color: "#FFFFFF" },
  statsRole: { fontSize: 9, color: "#6B7280" },
  statNum: { width: 40, fontSize: 11, fontWeight: "700", color: "#D1D5DB", textAlign: "center" },
  statRtg: { width: 40, fontSize: 12, fontWeight: "900", textAlign: "center" },

  closeBtn: { backgroundColor: "#10B981", borderRadius: 12, paddingVertical: 16, alignItems: "center", marginTop: 8 },
  closeBtnText: { fontSize: 14, fontWeight: "900", color: "#000", letterSpacing: 1 },
});
