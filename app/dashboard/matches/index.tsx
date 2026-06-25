import { supabase } from "@/database/supabase";
import { router } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Dimensions,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const { width } = Dimensions.get("window");

// ── Types ─────────────────────────────────────────────────────────────────────

interface TeamData {
  id: string;
  name: string;
  budget: number;
  fans: number;
  wins: number;
  losses: number;
}

interface Player {
  id: string;
  name: string;
  role: string;
  rating: number;
  form: number;
}

interface ScheduledMatch {
  id: string;
  opponent_name: string;
  opponent_rating: number;
  scheduled_for: string;
  map: string;
  match_type: string;
  status: "scheduled" | "played" | "cancelled";
}

interface PlayedMatch {
  id: string;
  opponent_name: string;
  opponent_rating: number;
  result: "win" | "loss";
  score_own: number;
  score_opp: number;
  map: string;
  match_type: string;
  fans_delta: number;
  budget_delta: number;
  played_at: string;
}

interface PlayerStat {
  id: string;
  name: string;
  role: string;
  kills: number;
  deaths: number;
  assists: number;
  rating: number;
  mvp: boolean;
}

interface MatchResult {
  won: boolean;
  score_own: number;
  score_opp: number;
  playerStats: PlayerStat[];
  fans_delta: number;
  budget_delta: number;
}

type SimPhase = "idle" | "simulating" | "result";

// ── Constants ─────────────────────────────────────────────────────────────────

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

// ── Helpers ───────────────────────────────────────────────────────────────────

function rnd(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function winProbability(myAvg: number, myForm: number, oppRating: number, gameStyle: string): number {
  const bonus: Record<string, number> = { agressivo: 4, adaptativo: 0, controlado: 3 };
  const eff  = myAvg + (myForm / 100) * 8 + (bonus[gameStyle] ?? 0);
  return Math.max(0.12, Math.min(0.88, 0.5 + (eff - oppRating) / 80));
}

function simulateResult(
  players: Player[],
  oppRating: number,
  gameStyle: string,
): MatchResult {
  const myAvg  = players.length ? Math.round(players.reduce((s, p) => s + p.rating, 0) / players.length) : 50;
  const myForm = players.length ? Math.round(players.reduce((s, p) => s + p.form,   0) / players.length) : 80;
  const prob   = winProbability(myAvg, myForm, oppRating, gameStyle);
  const won    = Math.random() < prob;

  const score_own = won ? 16 : rnd(3, 14);
  const score_opp = won ? rnd(3, 14) : 16;

  const stats: PlayerStat[] = players.map((p) => {
    const base    = p.rating / 100;
    const kills   = Math.max(2, rnd(Math.round(9 * base + (won ? 2 : -2)), Math.round(22 * base + (won ? 4 : 0))));
    const deaths  = Math.max(1, rnd(Math.round(7 - 4 * base), Math.round(19 - 6 * base)));
    const assists = rnd(2, 9);
    const kd      = deaths > 0 ? kills / deaths : kills;
    const rating  = Math.max(0.45, Math.min(2.4, 0.6 + kd * 0.35 + Math.random() * 0.25));
    return { id: p.id, name: p.name, role: p.role, kills, deaths, assists, rating, mvp: false };
  });

  if (stats.length > 0) {
    const mvpIdx = stats.reduce((best, cur, i) => cur.rating > stats[best].rating ? i : best, 0);
    stats[mvpIdx].mvp = true;
  }

  const fans_delta   = won ? rnd(200, 800) : -rnd(80, 300);
  const budget_delta = won ? rnd(1000, 5000) : 0;

  return { won, score_own, score_opp, playerStats: stats, fans_delta, budget_delta };
}

function formatCountdown(target: string): { h: number; m: number; s: number; expired: boolean } {
  const diff = new Date(target).getTime() - Date.now();
  if (diff <= 0) return { h: 0, m: 0, s: 0, expired: true };
  const h = Math.floor(diff / 3_600_000);
  const m = Math.floor((diff % 3_600_000) / 60_000);
  const s = Math.floor((diff % 60_000) / 1_000);
  return { h, m, s, expired: false };
}

function pad(n: number) { return String(n).padStart(2, "0"); }

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("pt-BR", {
    day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit",
  });
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function MatchesScreen() {
  const [team,      setTeam]      = useState<TeamData | null>(null);
  const [players,   setPlayers]   = useState<Player[]>([]);
  const [upcoming,  setUpcoming]  = useState<ScheduledMatch | null>(null);
  const [history,   setHistory]   = useState<PlayedMatch[]>([]);
  const [gameStyle, setGameStyle] = useState("adaptativo");
  const [loading,   setLoading]   = useState(true);
  const [generating, setGenerating] = useState(false);

  const [simPhase,  setSimPhase]  = useState<SimPhase>("idle");
  const [simCount,  setSimCount]  = useState(0);
  const [matchResult, setMatchResult] = useState<MatchResult | null>(null);

  const [countdown, setCountdown] = useState({ h: 0, m: 0, s: 0, expired: false });
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const simRef  = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Fetch ──────────────────────────────────────────────────────────────────
  const fetchData = useCallback(async () => {
    setLoading(true);

    const { data: teamData } = await supabase
      .from("teams")
      .select("id, name, budget, fans, wins, losses")
      .single();

    if (!teamData) { setLoading(false); return; }
    setTeam(teamData as TeamData);

    const [
      { data: pData },
      { data: upData },
      { data: histData },
      { data: tData },
    ] = await Promise.all([
      supabase
        .from("players")
        .select("id, name, role, rating, form")
        .eq("team_id", teamData.id)
        .order("rating", { ascending: false }),
      supabase
        .from("matches")
        .select("id, opponent_name, opponent_rating, scheduled_for, map, match_type, status")
        .eq("team_id", teamData.id)
        .eq("status", "scheduled")
        .order("scheduled_for", { ascending: true })
        .limit(1)
        .single(),
      supabase
        .from("matches")
        .select("id, opponent_name, opponent_rating, result, score_own, score_opp, map, match_type, fans_delta, budget_delta, played_at")
        .eq("team_id", teamData.id)
        .eq("status", "played")
        .order("played_at", { ascending: false })
        .limit(20),
      supabase
        .from("tactics")
        .select("game_style")
        .eq("team_id", teamData.id)
        .single(),
    ]);

    if (pData)    setPlayers(pData as Player[]);
    if (upData)   setUpcoming(upData as ScheduledMatch);
    if (histData) setHistory(histData as PlayedMatch[]);
    if (tData)    setGameStyle(tData.game_style ?? "adaptativo");

    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  // ── Countdown tick ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!upcoming) return;
    const update = () => setCountdown(formatCountdown(upcoming.scheduled_for));
    update();
    tickRef.current = setInterval(update, 1000);
    return () => { if (tickRef.current) clearInterval(tickRef.current); };
  }, [upcoming]);

  // ── Generate next match (via RPC) ─────────────────────────────────────────
  const requestNextMatch = async () => {
    if (!team) return;
    setGenerating(true);
    await supabase.rpc("generate_next_match", { p_team_id: team.id });
    await fetchData();
    setGenerating(false);
  };

  // ── Simulate match ────────────────────────────────────────────────────────
  const startSimulation = async () => {
    if (!upcoming || !team) return;
    setSimPhase("simulating");
    setSimCount(0);

    simRef.current = setInterval(() => {
      setSimCount((c) => {
        const next = c + rnd(3, 8);
        if (next >= 100) { clearInterval(simRef.current!); return 100; }
        return next;
      });
    }, 70);

    const result = simulateResult(players, upcoming.opponent_rating, gameStyle);
    await new Promise((r) => setTimeout(r, 2800));
    clearInterval(simRef.current!);

    const newFans   = Math.max(0, team.fans   + result.fans_delta);
    const newBudget = team.budget + result.budget_delta;
    const newWins   = team.wins   + (result.won ? 1 : 0);
    const newLosses = team.losses + (result.won ? 0 : 1);

    await Promise.all([
      supabase.from("matches").update({
        status:       "played",
        result:       result.won ? "win" : "loss",
        score_own:    result.score_own,
        score_opp:    result.score_opp,
        player_stats: result.playerStats,
        fans_delta:   result.fans_delta,
        budget_delta: result.budget_delta,
        played_at:    new Date().toISOString(),
      }).eq("id", upcoming.id),
      supabase.from("teams").update({
        fans: newFans, budget: newBudget, wins: newWins, losses: newLosses,
      }).eq("id", team.id),
    ]);

    setTeam((prev) => prev
      ? { ...prev, fans: newFans, budget: newBudget, wins: newWins, losses: newLosses }
      : prev);

    setMatchResult(result);
    setSimPhase("result");
  };

  const closeResult = async () => {
    setSimPhase("idle");
    setMatchResult(null);
    setUpcoming(null);
    // Gera próxima partida automaticamente
    if (team) {
      await supabase.rpc("generate_next_match", { p_team_id: team.id });
    }
    fetchData();
  };

  // ── Derived ───────────────────────────────────────────────────────────────
  const total   = (team?.wins ?? 0) + (team?.losses ?? 0);
  const winRate = total > 0 ? Math.round(((team?.wins ?? 0) / total) * 100) : 0;

  const streak = (() => {
    if (!history.length) return null;
    const first = history[0].result;
    let count = 0;
    for (const m of history) { if (m.result === first) count++; else break; }
    return { type: first, count };
  })();

  const mapColor    = upcoming ? (MAP_COLOR[upcoming.map]         ?? "#6B7280") : "#6B7280";
  const typeColor   = upcoming ? (TYPE_COLOR[upcoming.match_type] ?? "#6B7280") : "#6B7280";

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={s.safe} edges={["top"]}>

      {/* ── HEADER ──────────────────────────────────────── */}
      <View style={s.header}>
        <TouchableOpacity style={s.backBtn} onPress={() => router.back()}>
          <Text style={s.backIcon}>‹</Text>
        </TouchableOpacity>
        <View style={s.headerCenter}>
          <View style={s.headerDot} />
          <Text style={s.headerTitle}>PARTIDAS</Text>
        </View>
        {team && (
          <View style={s.recordPill}>
            <Text style={s.recordW}>{team.wins}W</Text>
            <Text style={s.recordSep}> – </Text>
            <Text style={s.recordL}>{team.losses}L</Text>
          </View>
        )}
      </View>

      {loading ? (
        <View style={s.center}>
          <ActivityIndicator size="large" color="#EC4899" />
          <Text style={s.loadingText}>Carregando...</Text>
        </View>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 48 }}>

          {/* ══ PRÓXIMA PARTIDA ══════════════════════════ */}
          <View style={s.section}>
            <Text style={s.sectionTitle}>PRÓXIMA PARTIDA</Text>

            {upcoming ? (
              <View style={[s.upcomingCard, countdown.expired && s.upcomingCardReady]}>
                {/* Top accent */}
                <View style={[s.upcomingAccent, { backgroundColor: countdown.expired ? "#EC4899" : typeColor }]} />

                <View style={s.upcomingBody}>
                  {/* Type + map badges */}
                  <View style={s.upcomingBadgeRow}>
                    <View style={[s.badge, { backgroundColor: typeColor + "22", borderColor: typeColor + "55" }]}>
                      <Text style={[s.badgeText, { color: typeColor }]}>{upcoming.match_type}</Text>
                    </View>
                    <View style={[s.badge, { backgroundColor: mapColor + "22", borderColor: mapColor + "55" }]}>
                      <Text style={[s.badgeText, { color: mapColor }]}>{upcoming.map}</Text>
                    </View>
                  </View>

                  {/* VS */}
                  <View style={s.vsRow}>
                    <Text style={s.vsLabel}>vs.</Text>
                    <Text style={s.vsOpponent}>{upcoming.opponent_name}</Text>
                    <View style={s.oppRatingBadge}>
                      <Text style={s.oppRatingText}>RTG {upcoming.opponent_rating}</Text>
                    </View>
                  </View>

                  {/* Countdown OR result button */}
                  {countdown.expired ? (
                    <TouchableOpacity style={s.readyBtn} onPress={startSimulation} activeOpacity={0.8}>
                      <Text style={s.readyBtnIcon}>🏆</Text>
                      <Text style={s.readyBtnText}>VER RESULTADO</Text>
                    </TouchableOpacity>
                  ) : (
                    <View style={s.countdownWrap}>
                      <Text style={s.countdownLabel}>COMEÇA EM</Text>
                      <View style={s.countdownRow}>
                        {[
                          { v: countdown.h, l: "HRS"  },
                          { v: countdown.m, l: "MIN"  },
                          { v: countdown.s, l: "SEG"  },
                        ].map((item, i) => (
                          <React.Fragment key={i}>
                            {i > 0 && <Text style={s.countdownSep}>:</Text>}
                            <View style={s.countdownBox}>
                              <Text style={s.countdownNum}>{pad(item.v)}</Text>
                              <Text style={s.countdownUnit}>{item.l}</Text>
                            </View>
                          </React.Fragment>
                        ))}
                      </View>
                      <Text style={s.countdownDate}>
                        {formatDate(upcoming.scheduled_for)}
                      </Text>
                    </View>
                  )}
                </View>
              </View>
            ) : (
              <View style={s.noMatchCard}>
                <Text style={s.noMatchEmoji}>📅</Text>
                <Text style={s.noMatchText}>Nenhuma partida agendada</Text>
                <Text style={s.noMatchSub}>O sistema agenda automaticamente, ou solicite abaixo</Text>
                <TouchableOpacity
                  style={s.genBtn}
                  onPress={requestNextMatch}
                  disabled={generating}
                >
                  {generating
                    ? <ActivityIndicator size="small" color="#EC4899" />
                    : <Text style={s.genBtnText}>SOLICITAR PARTIDA</Text>}
                </TouchableOpacity>
              </View>
            )}
          </View>

          {/* ══ DESEMPENHO ═══════════════════════════════ */}
          <View style={s.section}>
            <Text style={s.sectionTitle}>DESEMPENHO</Text>
            <View style={s.perfCard}>
              {/* Win rate */}
              <View style={s.winRateWrap}>
                <View style={[
                  s.winRateCircle,
                  { borderColor: winRate >= 50 ? "#10B981" : "#EF4444" },
                ]}>
                  <Text style={[s.winRatePct, { color: winRate >= 50 ? "#10B981" : "#EF4444" }]}>
                    {total > 0 ? `${winRate}%` : "—"}
                  </Text>
                  <Text style={s.winRateLabel}>WIN</Text>
                </View>
              </View>

              <View style={s.perfDivider} />

              <View style={s.perfStats}>
                <View style={s.perfItem}>
                  <Text style={s.perfValue}>{total}</Text>
                  <Text style={s.perfLabel}>Total</Text>
                </View>
                <View style={s.perfItem}>
                  <Text style={[s.perfValue, { color: "#10B981" }]}>{team?.wins ?? 0}</Text>
                  <Text style={s.perfLabel}>Vitórias</Text>
                </View>
                <View style={s.perfItem}>
                  <Text style={[s.perfValue, { color: "#EF4444" }]}>{team?.losses ?? 0}</Text>
                  <Text style={s.perfLabel}>Derrotas</Text>
                </View>
                <View style={s.perfItem}>
                  {streak ? (
                    <>
                      <Text style={[s.perfValue, { color: streak.type === "win" ? "#10B981" : "#EF4444" }]}>
                        {streak.count}{streak.type === "win" ? "W" : "L"}
                      </Text>
                      <Text style={s.perfLabel}>Sequência</Text>
                    </>
                  ) : (
                    <>
                      <Text style={s.perfValue}>—</Text>
                      <Text style={s.perfLabel}>Sequência</Text>
                    </>
                  )}
                </View>
              </View>
            </View>
          </View>

          {/* ══ HISTÓRICO ════════════════════════════════ */}
          <View style={s.section}>
            <Text style={s.sectionTitle}>HISTÓRICO</Text>

            {history.length === 0 ? (
              <View style={s.emptyCard}>
                <Text style={s.emptyEmoji}>🏆</Text>
                <Text style={s.emptyText}>Nenhuma partida disputada</Text>
              </View>
            ) : (
              history.map((m) => {
                const won = m.result === "win";
                const mc  = MAP_COLOR[m.map]         ?? "#6B7280";
                const tc  = TYPE_COLOR[m.match_type] ?? "#6B7280";
                return (
                  <View key={m.id} style={[s.histCard, won ? s.histCardWin : s.histCardLoss]}>
                    <View style={[s.histBar, { backgroundColor: won ? "#10B981" : "#EF4444" }]} />

                    <View style={s.histLeft}>
                      <View style={[s.resultBadge, { backgroundColor: won ? "#10B98122" : "#EF444422" }]}>
                        <Text style={[s.resultBadgeText, { color: won ? "#10B981" : "#EF4444" }]}>
                          {won ? "V" : "D"}
                        </Text>
                      </View>
                      <View>
                        <Text style={s.histScore}>
                          <Text style={{ color: won ? "#10B981" : "#EF4444" }}>{m.score_own}</Text>
                          <Text style={{ color: "#374151" }}> – </Text>
                          <Text style={{ color: won ? "#374151" : "#EF4444" }}>{m.score_opp}</Text>
                        </Text>
                        <Text style={s.histOpponent}>vs. {m.opponent_name}</Text>
                      </View>
                    </View>

                    <View style={s.histCenter}>
                      <View style={[s.badge, { backgroundColor: mc + "22", borderColor: mc + "55" }]}>
                        <Text style={[s.badgeText, { color: mc }]}>{m.map}</Text>
                      </View>
                      <View style={[s.badge, { backgroundColor: tc + "22", borderColor: tc + "55" }]}>
                        <Text style={[s.badgeText, { color: tc }]}>{m.match_type}</Text>
                      </View>
                    </View>

                    <View style={s.histRight}>
                      {m.fans_delta !== 0 && (
                        <Text style={[s.histDelta, { color: m.fans_delta > 0 ? "#10B981" : "#EF4444" }]}>
                          {m.fans_delta > 0 ? "+" : ""}{m.fans_delta} fãs
                        </Text>
                      )}
                      {m.budget_delta > 0 && (
                        <Text style={[s.histDelta, { color: "#F59E0B" }]}>
                          +${(m.budget_delta / 1000).toFixed(1)}K
                        </Text>
                      )}
                      <Text style={s.histDate}>{formatDate(m.played_at)}</Text>
                    </View>
                  </View>
                );
              })
            )}
          </View>

        </ScrollView>
      )}

      {/* ════════════════════════════════════════════════
          MODAL: SIMULANDO
      ════════════════════════════════════════════════ */}
      <Modal visible={simPhase === "simulating"} transparent animationType="fade">
        <View style={s.simOverlay}>
          <View style={s.simCard}>
            <Text style={s.simCardLabel}>PARTIDA EM CURSO</Text>
            <Text style={s.simCardOpp}>{upcoming?.opponent_name}</Text>
            <View style={[s.simMapBadge, { backgroundColor: (mapColor) + "22", borderColor: mapColor + "55" }]}>
              <Text style={[s.simMapText, { color: mapColor }]}>{upcoming?.map}</Text>
            </View>
            <View style={s.simBar}>
              <View style={[s.simBarFill, { width: `${Math.min(simCount, 100)}%` as any }]} />
            </View>
            <Text style={s.simPct}>{Math.min(simCount, 100)}%</Text>
            <ActivityIndicator size="large" color="#EC4899" style={{ marginTop: 8 }} />
          </View>
        </View>
      </Modal>

      {/* ════════════════════════════════════════════════
          MODAL: RESULTADO
      ════════════════════════════════════════════════ */}
      <Modal
        visible={simPhase === "result" && !!matchResult}
        transparent
        animationType="slide"
        onRequestClose={closeResult}
      >
        <View style={s.resultOverlay}>
          <View style={s.resultSheet}>
            <View style={s.sheetHandle} />

            {matchResult && upcoming && (
              <ScrollView showsVerticalScrollIndicator={false} bounces={false}>

                {/* ── HERO ── */}
                <View style={[s.heroCard, matchResult.won ? s.heroWin : s.heroLoss]}>
                  <Text style={s.heroMap}>{upcoming.map}</Text>
                  <View style={[s.badge, { backgroundColor: typeColor + "33", borderColor: typeColor + "55", alignSelf: "center", marginBottom: 14 }]}>
                    <Text style={[s.badgeText, { color: typeColor }]}>{upcoming.match_type}</Text>
                  </View>

                  {/* Score */}
                  <View style={s.scoreRow}>
                    <View style={s.scoreTeam}>
                      <Text style={s.scoreTeamName} numberOfLines={1}>{team?.name.toUpperCase()}</Text>
                      <Text style={[s.scoreNum, matchResult.won ? s.scoreWin : s.scoreLoss]}>
                        {matchResult.score_own}
                      </Text>
                    </View>
                    <Text style={s.scoreDash}>–</Text>
                    <View style={s.scoreTeam}>
                      <Text style={s.scoreTeamName} numberOfLines={1}>{upcoming.opponent_name.toUpperCase()}</Text>
                      <Text style={[s.scoreNum, !matchResult.won ? s.scoreWin : s.scoreLoss]}>
                        {matchResult.score_opp}
                      </Text>
                    </View>
                  </View>

                  {/* Verdict */}
                  <View style={[s.verdictBadge, matchResult.won ? s.verdictWin : s.verdictLoss]}>
                    <Text style={[s.verdictText, { color: matchResult.won ? "#10B981" : "#EF4444" }]}>
                      {matchResult.won ? "VITÓRIA" : "DERROTA"}
                    </Text>
                  </View>
                </View>

                {/* Rewards */}
                {(matchResult.fans_delta !== 0 || matchResult.budget_delta > 0) && (
                  <View style={s.rewardsRow}>
                    {matchResult.fans_delta !== 0 && (
                      <View style={[s.rewardPill, matchResult.fans_delta > 0 ? s.pillGreen : s.pillRed]}>
                        <Text style={s.rewardText}>
                          {matchResult.fans_delta > 0 ? "+" : ""}{matchResult.fans_delta} fãs
                        </Text>
                      </View>
                    )}
                    {matchResult.budget_delta > 0 && (
                      <View style={[s.rewardPill, s.pillYellow]}>
                        <Text style={s.rewardText}>
                          +${matchResult.budget_delta.toLocaleString("pt-BR")}
                        </Text>
                      </View>
                    )}
                  </View>
                )}

                {/* Player stats */}
                <View style={s.statsTable}>
                  <Text style={s.statsTableTitle}>PERFORMANCE</Text>
                  <View style={s.statsHeader}>
                    <Text style={[s.statsCol, { flex: 1 }]}>JOGADOR</Text>
                    <Text style={s.statsCol}>K</Text>
                    <Text style={s.statsCol}>D</Text>
                    <Text style={s.statsCol}>A</Text>
                    <Text style={[s.statsCol, { color: "#FFFFFF" }]}>RTG</Text>
                  </View>
                  {[...matchResult.playerStats]
                    .sort((a, b) => b.rating - a.rating)
                    .map((ps) => (
                      <View key={ps.id} style={[s.statsRow, ps.mvp && s.statsRowMvp]}>
                        <View style={[s.statsNameWrap, { flex: 1 }]}>
                          {ps.mvp && (
                            <View style={s.mvpBadge}>
                              <Text style={s.mvpText}>MVP</Text>
                            </View>
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

                <TouchableOpacity style={s.closeBtn} onPress={closeResult}>
                  <Text style={s.closeBtnText}>FECHAR</Text>
                </TouchableOpacity>
                <View style={{ height: 24 }} />
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>

    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  safe:        { flex: 1, backgroundColor: "#080808" },
  center:      { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
  loadingText: { fontSize: 13, color: "#6B7280" },

  // Header
  header: {
    flexDirection: "row", alignItems: "center",
    paddingHorizontal: 16, paddingVertical: 14, gap: 12,
  },
  backBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: "#161616", borderWidth: 1, borderColor: "#242424",
    justifyContent: "center", alignItems: "center",
  },
  backIcon:     { fontSize: 22, color: "#FFFFFF", lineHeight: 24, marginTop: -2 },
  headerCenter: { flex: 1, flexDirection: "row", alignItems: "center", gap: 8 },
  headerDot:    { width: 8, height: 8, borderRadius: 4, backgroundColor: "#EC4899" },
  headerTitle:  { fontSize: 16, fontWeight: "900", color: "#FFFFFF", letterSpacing: 4 },
  recordPill: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: "#161616", borderWidth: 1, borderColor: "#242424",
    borderRadius: 10, paddingHorizontal: 12, paddingVertical: 6,
  },
  recordW:   { fontSize: 13, fontWeight: "900", color: "#10B981" },
  recordSep: { fontSize: 13, color: "#374151", fontWeight: "700" },
  recordL:   { fontSize: 13, fontWeight: "900", color: "#EF4444" },

  // Section
  section: { paddingHorizontal: 16, marginBottom: 20 },
  sectionTitle: {
    fontSize: 10, fontWeight: "900", color: "#6B7280",
    letterSpacing: 3, marginBottom: 12,
  },

  // Badges (shared)
  badge: {
    borderRadius: 5, paddingHorizontal: 7, paddingVertical: 3,
    borderWidth: 1,
  },
  badgeText: { fontSize: 9, fontWeight: "800", letterSpacing: 0.5 },

  // Upcoming match card
  upcomingCard: {
    backgroundColor: "#0D0D0D", borderRadius: 16,
    borderWidth: 1, borderColor: "#1A1A1A",
    overflow: "hidden",
  },
  upcomingCardReady: { borderColor: "#EC489944" },
  upcomingAccent: { height: 3 },
  upcomingBody:   { padding: 18 },
  upcomingBadgeRow: { flexDirection: "row", gap: 8, marginBottom: 16 },
  vsRow: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 18 },
  vsLabel:    { fontSize: 12, color: "#6B7280", fontWeight: "700" },
  vsOpponent: { fontSize: 20, fontWeight: "900", color: "#FFFFFF", flex: 1 },
  oppRatingBadge: {
    backgroundColor: "#161616", borderWidth: 1, borderColor: "#242424",
    borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4,
  },
  oppRatingText: { fontSize: 11, fontWeight: "700", color: "#9CA3AF" },

  countdownWrap: { alignItems: "center", gap: 6 },
  countdownLabel:{ fontSize: 9, fontWeight: "900", color: "#4B5563", letterSpacing: 2 },
  countdownRow:  { flexDirection: "row", alignItems: "center", gap: 4 },
  countdownBox:  { alignItems: "center", gap: 2 },
  countdownNum:  { fontSize: 32, fontWeight: "900", color: "#FFFFFF", fontVariant: ["tabular-nums"] as any },
  countdownUnit: { fontSize: 8, color: "#4B5563", fontWeight: "700", letterSpacing: 1 },
  countdownSep:  { fontSize: 28, color: "#374151", fontWeight: "900", marginBottom: 14 },
  countdownDate: { fontSize: 11, color: "#4B5563", marginTop: 4 },

  readyBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 10, backgroundColor: "#EC4899", borderRadius: 12,
    paddingVertical: 14,
  },
  readyBtnIcon: { fontSize: 20 },
  readyBtnText: { fontSize: 14, fontWeight: "900", color: "#FFFFFF", letterSpacing: 2 },

  // No match card
  noMatchCard: {
    backgroundColor: "#0D0D0D", borderRadius: 16,
    borderWidth: 1, borderColor: "#1A1A1A",
    padding: 28, alignItems: "center", gap: 8,
  },
  noMatchEmoji: { fontSize: 36, marginBottom: 4 },
  noMatchText:  { fontSize: 14, fontWeight: "700", color: "#6B7280" },
  noMatchSub:   { fontSize: 12, color: "#374151", textAlign: "center", marginBottom: 8 },
  genBtn: {
    paddingHorizontal: 20, paddingVertical: 10, borderRadius: 10,
    backgroundColor: "#EC489922", borderWidth: 1, borderColor: "#EC489966",
    minWidth: 160, alignItems: "center",
  },
  genBtnText: { fontSize: 12, fontWeight: "800", color: "#EC4899", letterSpacing: 1 },

  // Performance card
  perfCard: {
    backgroundColor: "#0D0D0D", borderRadius: 16,
    borderWidth: 1, borderColor: "#1A1A1A", padding: 16,
    flexDirection: "row", alignItems: "center", gap: 16,
  },
  winRateWrap:   { alignItems: "center" },
  winRateCircle: {
    width: 80, height: 80, borderRadius: 40, borderWidth: 3,
    justifyContent: "center", alignItems: "center",
    backgroundColor: "#111",
  },
  winRatePct:  { fontSize: 20, fontWeight: "900" },
  winRateLabel:{ fontSize: 8, color: "#6B7280", fontWeight: "700", letterSpacing: 1 },
  perfDivider: { width: 1, height: 60, backgroundColor: "#1A1A1A" },
  perfStats:   { flex: 1, flexDirection: "row", justifyContent: "space-around" },
  perfItem:    { alignItems: "center", gap: 3 },
  perfValue:   { fontSize: 18, fontWeight: "900", color: "#FFFFFF" },
  perfLabel:   { fontSize: 9, color: "#6B7280", fontWeight: "600", letterSpacing: 0.5 },

  // History
  emptyCard: {
    backgroundColor: "#0D0D0D", borderRadius: 14,
    borderWidth: 1, borderColor: "#1A1A1A",
    padding: 28, alignItems: "center", gap: 8,
  },
  emptyEmoji: { fontSize: 32, marginBottom: 4 },
  emptyText:  { fontSize: 13, fontWeight: "700", color: "#6B7280" },

  histCard: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: "#0D0D0D", borderRadius: 12,
    borderWidth: 1, borderColor: "#1A1A1A",
    marginBottom: 8, overflow: "hidden", paddingRight: 12,
  },
  histCardWin:  { borderColor: "#10B98122" },
  histCardLoss: { borderColor: "#EF444422" },
  histBar:      { width: 3, alignSelf: "stretch" },
  histLeft: {
    flexDirection: "row", alignItems: "center",
    gap: 10, paddingVertical: 12, paddingLeft: 12, flex: 1,
  },
  resultBadge: {
    width: 28, height: 28, borderRadius: 8,
    justifyContent: "center", alignItems: "center",
  },
  resultBadgeText: { fontSize: 13, fontWeight: "900" },
  histScore:    { fontSize: 16, fontWeight: "900", color: "#FFFFFF" },
  histOpponent: { fontSize: 11, color: "#6B7280", marginTop: 2 },
  histCenter:   { alignItems: "center", gap: 5, paddingHorizontal: 8 },
  histRight:    { alignItems: "flex-end", gap: 3 },
  histDelta:    { fontSize: 10, fontWeight: "700" },
  histDate:     { fontSize: 9, color: "#374151" },

  // Simulating modal
  simOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.85)", justifyContent: "center", alignItems: "center" },
  simCard: {
    width: width - 48,
    backgroundColor: "#0D0D0D", borderRadius: 20,
    borderWidth: 1, borderColor: "#EC489944",
    padding: 28, alignItems: "center", gap: 10,
  },
  simCardLabel: { fontSize: 10, fontWeight: "900", color: "#6B7280", letterSpacing: 3 },
  simCardOpp:   { fontSize: 22, fontWeight: "900", color: "#FFFFFF" },
  simMapBadge: { borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4, borderWidth: 1 },
  simMapText:  { fontSize: 11, fontWeight: "700" },
  simBar: {
    width: "100%", height: 4, backgroundColor: "#1A1A1A",
    borderRadius: 2, overflow: "hidden", marginTop: 6,
  },
  simBarFill: { height: 4, backgroundColor: "#EC4899", borderRadius: 2 },
  simPct:     { fontSize: 11, color: "#EC4899", fontWeight: "700" },

  // Result modal
  resultOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.92)", justifyContent: "flex-end" },
  resultSheet: {
    backgroundColor: "#0A0A0A",
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    borderWidth: 1, borderColor: "#1A1A1A",
    paddingHorizontal: 20, paddingTop: 12,
    maxHeight: "92%",
  },
  sheetHandle: {
    width: 36, height: 4, borderRadius: 2,
    backgroundColor: "#2A2A2A", alignSelf: "center", marginBottom: 16,
  },

  heroCard: {
    borderRadius: 16, padding: 20, marginBottom: 16,
    borderWidth: 1, alignItems: "center",
  },
  heroWin:  { backgroundColor: "#0A1F14", borderColor: "#10B98133" },
  heroLoss: { backgroundColor: "#1A0A0A", borderColor: "#EF444433" },
  heroMap: {
    fontSize: 10, fontWeight: "900", color: "#6B7280",
    letterSpacing: 3, marginBottom: 10,
  },
  scoreRow: { flexDirection: "row", alignItems: "center", gap: 16, marginBottom: 16 },
  scoreTeam:     { alignItems: "center", flex: 1 },
  scoreTeamName: { fontSize: 9, fontWeight: "800", color: "#6B7280", letterSpacing: 1, marginBottom: 4 },
  scoreNum:      { fontSize: 52, fontWeight: "900", lineHeight: 56 },
  scoreWin:      { color: "#10B981" },
  scoreLoss:     { color: "#EF4444" },
  scoreDash:     { fontSize: 28, color: "#374151", fontWeight: "900" },
  verdictBadge:  { paddingHorizontal: 24, paddingVertical: 8, borderRadius: 20, borderWidth: 1 },
  verdictWin:    { backgroundColor: "#10B98122", borderColor: "#10B98155" },
  verdictLoss:   { backgroundColor: "#EF444422", borderColor: "#EF444455" },
  verdictText:   { fontSize: 14, fontWeight: "900", letterSpacing: 3 },

  rewardsRow: {
    flexDirection: "row", gap: 8, marginBottom: 16, justifyContent: "center",
  },
  rewardPill:   { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, borderWidth: 1 },
  pillGreen:    { backgroundColor: "#10B98122", borderColor: "#10B98155" },
  pillRed:      { backgroundColor: "#EF444422", borderColor: "#EF444455" },
  pillYellow:   { backgroundColor: "#F59E0B22", borderColor: "#F59E0B55" },
  rewardText:   { fontSize: 12, fontWeight: "700", color: "#FFFFFF" },

  statsTable: {
    backgroundColor: "#0D0D0D", borderRadius: 14,
    borderWidth: 1, borderColor: "#1A1A1A",
    overflow: "hidden", marginBottom: 16,
  },
  statsTableTitle: {
    fontSize: 9, fontWeight: "900", color: "#4B5563",
    letterSpacing: 2, padding: 12, paddingBottom: 8,
  },
  statsHeader: {
    flexDirection: "row", alignItems: "center",
    paddingHorizontal: 12, paddingBottom: 8,
    borderBottomWidth: 1, borderBottomColor: "#1A1A1A",
  },
  statsCol:     { width: 32, fontSize: 9, fontWeight: "800", color: "#4B5563", textAlign: "center" },
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

  closeBtn: {
    paddingVertical: 14, borderRadius: 12,
    backgroundColor: "#161616", borderWidth: 1, borderColor: "#242424",
    alignItems: "center",
  },
  closeBtnText: { fontSize: 13, fontWeight: "700", color: "#9CA3AF", letterSpacing: 1 },
});
