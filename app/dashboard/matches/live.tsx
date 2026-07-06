import { RewardedAdButton } from "@/components/ui/RewardedAdButton";
import { ScreenHeader } from "@/components/ui/ScreenHeader";
import { supabase } from "@/database/supabase";
import { useLanguage } from "@/i18n/LanguageContext";
import { router } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
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

interface Player {
  id: string;
  name: string;
  role: string;
  rating: number;
  form: number;
}

interface OppPlayer {
  id: string;
  name: string;
  role: string;
}

interface MatchInfo {
  id: string;
  opponent_name: string;
  map: string;
}

interface RoundSummary {
  round: number;
  ownScore: number;
  oppScore: number;
  won: boolean;
}

type UtilKind = "smoke" | "flash" | "nade";

interface KillEvent {
  id: string;
  round: number;
  type: "kill" | "util";
  text: string;
  killerSide?: "own" | "opp";
  victimSide?: "own" | "opp";
  victimId?: string;
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

interface RpcResult {
  won: boolean;
  score_own: number;
  score_opp: number;
  fans_delta: number;
  budget_delta: number;
  pdl_delta: number;
}

interface SimData {
  rounds: RoundSummary[];
  events: KillEvent[];
  tally: Record<string, { kills: number; deaths: number; assists: number }>;
}

type Phase = "loading" | "playing" | "result" | "error";

// ── Helpers ───────────────────────────────────────────────────────────────────

function rnd(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function sleep(ms: number) {
  return new Promise<void>((r) => setTimeout(r, ms));
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const OPP_ROLES = ["IGL", "AWPer", "Support", "Entry", "Flex"];
const NAME_PREFIX = ["z", "x", "v", "k", "n", "s", "d", "r", "t"];
const NAME_WORD = [
  "blade", "wolf", "nova", "frost", "raven", "storm", "ghost", "viper",
  "cipher", "echo", "reaper", "shadow", "phantom", "blaze", "hawk", "spike",
];

function generateOpponentRoster(): OppPlayer[] {
  return OPP_ROLES.map((role, i) => {
    const w = NAME_WORD[rnd(0, NAME_WORD.length - 1)];
    const p = NAME_PREFIX[rnd(0, NAME_PREFIX.length - 1)];
    const name = p + w.charAt(0).toUpperCase() + w.slice(1);
    return { id: `opp-${i}`, name, role };
  });
}

function utilLine(kind: UtilKind, player: string, t: (key: string) => string): string {
  const key = kind === "smoke" ? "live.smokeLine" : kind === "flash" ? "live.flashLine" : "live.nadeLine";
  return t(key).replace("{p}", player);
}

function killLine(killer: string, victim: string, t: (key: string) => string): string {
  const templates = [
    "live.killTemplate1", "live.killTemplate2", "live.killTemplate3",
    "live.killTemplate4", "live.killTemplate5",
  ];
  const key = templates[rnd(0, templates.length - 1)];
  return t(key).replace("{k}", killer).replace("{v}", victim);
}

// Gera a partida inteira (rounds + eventos round a round) a partir do placar final já
// decidido pelo servidor (`resolve_match`). É só apresentação — nada aqui grava no banco.
function simulateMatch(
  ownPlayers: Player[],
  oppRoster: OppPlayer[],
  scoreOwn: number,
  scoreOpp: number,
  opponentName: string,
  t: (key: string) => string,
): SimData {
  const tally: SimData["tally"] = {};
  [...ownPlayers, ...oppRoster].forEach((p) => { tally[p.id] = { kills: 0, deaths: 0, assists: 0 }; });

  const nameOf = (id: string) =>
    ownPlayers.find((p) => p.id === id)?.name ?? oppRoster.find((p) => p.id === id)?.name ?? "?";

  const outcomes = shuffle([...Array(scoreOwn).fill(true), ...Array(scoreOpp).fill(false)]);
  const rounds: RoundSummary[] = [];
  const events: KillEvent[] = [];
  let own = 0, opp = 0, eid = 0;

  for (let r = 0; r < outcomes.length; r++) {
    const ownWon   = outcomes[r];
    const roundNum = r + 1;

    let ownAlive = ownPlayers.map((p) => p.id);
    let oppAlive = oppRoster.map((p) => p.id);

    const losingIds   = shuffle(ownWon ? [...oppAlive] : [...ownAlive]);
    const winningPool = ownWon ? ownAlive : oppAlive;
    const casualties  = rnd(0, Math.min(2, winningPool.length - 1));
    const winningDeaths = shuffle([...winningPool]).slice(0, casualties);

    const middle     = shuffle([...winningDeaths, ...losingIds.slice(0, -1)]);
    const deathOrder = [...middle, losingIds[losingIds.length - 1]];

    for (const victimId of deathOrder) {
      const victimIsOwn = ownAlive.includes(victimId);
      const victimSide: "own" | "opp" = victimIsOwn ? "own" : "opp";
      if (victimIsOwn) ownAlive = ownAlive.filter((id) => id !== victimId);
      else oppAlive = oppAlive.filter((id) => id !== victimId);
      tally[victimId].deaths++;

      const killerSide: "own" | "opp" = victimIsOwn ? "opp" : "own";
      const killerPool = killerSide === "own" ? ownAlive : oppAlive;
      const killerId = killerPool.length ? killerPool[rnd(0, killerPool.length - 1)] : null;

      if (killerId && Math.random() < 0.3) {
        const kind = (["smoke", "flash", "nade"] as UtilKind[])[rnd(0, 2)];
        events.push({ id: `e${eid++}`, round: roundNum, type: "util", text: utilLine(kind, nameOf(killerId), t) });
      }

      let assistName: string | null = null;
      if (killerId) {
        tally[killerId].kills++;
        if (Math.random() < 0.35) {
          const mates = (killerSide === "own" ? ownAlive : oppAlive).filter((id) => id !== killerId);
          if (mates.length) {
            const aId = mates[rnd(0, mates.length - 1)];
            tally[aId].assists++;
            assistName = nameOf(aId);
          }
        }
      }

      const killerName = killerId ? nameOf(killerId) : (killerSide === "own" ? t("live.yourTeamGeneric") : opponentName);
      let text = killLine(killerName, nameOf(victimId), t);
      if (assistName) text += t("live.assistSuffix").replace("{a}", assistName);

      events.push({ id: `e${eid++}`, round: roundNum, type: "kill", text, killerSide, victimSide, victimId });
    }

    if (ownWon) own++; else opp++;
    rounds.push({ round: roundNum, ownScore: own, oppScore: opp, won: ownWon });
  }

  return { rounds, events, tally };
}

function buildStatLines(
  roster: (Player | OppPlayer)[],
  tally: SimData["tally"],
): StatLine[] {
  const lines = roster.map((p) => {
    const t = tally[p.id] ?? { kills: 0, deaths: 0, assists: 0 };
    const kd = t.deaths > 0 ? t.kills / t.deaths : t.kills;
    const rating = Math.max(0.3, Math.min(2.4, 0.6 + kd * 0.35 + t.assists * 0.02));
    return { id: p.id, name: p.name, role: p.role, kills: t.kills, deaths: t.deaths, assists: t.assists, rating, mvp: false };
  });
  if (lines.length > 0) {
    const bestIdx = lines.reduce((best, cur, i) => cur.rating > lines[best].rating ? i : best, 0);
    lines[bestIdx].mvp = true;
  }
  return lines.sort((a, b) => b.rating - a.rating);
}

// MVP da partida: o melhor rating entre os dois times, não só dentro de cada um.
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
  const [phase, setPhase] = useState<Phase>("loading");
  const [errorMsg, setErrorMsg] = useState("");

  const [team, setTeam]           = useState<TeamData | null>(null);
  const [ownPlayers, setOwnPlayers] = useState<Player[]>([]);
  const [oppRoster, setOppRoster]   = useState<OppPlayer[]>([]);
  const [match, setMatch]           = useState<MatchInfo | null>(null);

  const [roundIdx, setRoundIdx]   = useState(0);
  const [totalRounds, setTotalRounds] = useState(0);
  const [scoreOwn, setScoreOwn]   = useState(0);
  const [scoreOpp, setScoreOpp]   = useState(0);
  const [ownAlive, setOwnAlive]   = useState<string[]>([]);
  const [oppAlive, setOppAlive]   = useState<string[]>([]);
  const [liveFeed, setLiveFeed]   = useState<KillEvent[]>([]);
  const [historyFeed, setHistoryFeed] = useState<KillEvent[]>([]);
  const [roundBanner, setRoundBanner] = useState<"win" | "loss" | null>(null);
  const [tab, setTab] = useState<"live" | "history">("live");

  const [finalResult, setFinalResult] = useState<RpcResult | null>(null);
  const [ownStats, setOwnStats] = useState<StatLine[]>([]);
  const [oppStats, setOppStats] = useState<StatLine[]>([]);

  const cancelledRef = useRef(false);
  const skipRef = useRef(false);
  const liveScrollRef = useRef<ScrollView>(null);
  const historyScrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    cancelledRef.current = false;
    load();
    return () => { cancelledRef.current = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function load() {
    const { data: teamData } = await supabase
      .from("teams")
      .select("id, name, budget, fans, wins, losses, pdl")
      .single();

    if (cancelledRef.current) return;
    if (!teamData) { setPhase("error"); setErrorMsg(t("live.errTeamNotFound")); return; }
    const baseTeam = { ...(teamData as any), pdl: (teamData as any).pdl ?? 0 } as TeamData;

    const [{ data: pData }, { data: matchData }] = await Promise.all([
      supabase.from("players").select("id, name, role, rating, form").eq("team_id", baseTeam.id),
      supabase
        .from("matches")
        .select("id, opponent_name, map")
        .eq("team_id", baseTeam.id)
        .eq("status", "scheduled")
        .order("scheduled_for", { ascending: true })
        .limit(1)
        .single(),
    ]);

    if (cancelledRef.current) return;
    if (!matchData) { setPhase("error"); setErrorMsg(t("live.errNoMatchReady")); return; }

    const ownP = (pData ?? []) as Player[];
    const oppR = generateOpponentRoster();

    setTeam(baseTeam);
    setOwnPlayers(ownP);
    setOppRoster(oppR);
    setMatch(matchData as MatchInfo);

    // Estatísticas por jogador (kills/deaths/assists) vêm inteiramente da simulação local —
    // não têm impacto de segurança, é só apresentação. O que afeta economia/ranking (won,
    // placar, deltas) é calculado e gravado no servidor via RPC, que não confia em nada
    // vindo do client.
    const { data: rpcResult, error } = await supabase.rpc("resolve_match", {
      p_match_id:     (matchData as any).id,
      p_player_stats: [],
    });

    if (cancelledRef.current) return;
    if (error || !rpcResult) {
      setPhase("error");
      setErrorMsg(t("live.errResolveGeneric"));
      return;
    }

    const result = rpcResult as RpcResult;
    setFinalResult(result);

    const sim = simulateMatch(ownP, oppR, result.score_own, result.score_opp, (matchData as any).opponent_name, t);
    setTotalRounds(sim.rounds.length);
    const ownStatLines = buildStatLines(ownP, sim.tally);
    const oppStatLines = buildStatLines(oppR, sim.tally);
    setOwnStats(ownStatLines);
    setOppStats(oppStatLines);

    // Salva o relatório (K/D/A + histórico de rounds) pra poder ser reaberto depois na tela de
    // histórico. É melhor-esforço: se falhar, a partida continua jogável, só o relatório
    // detalhado fica indisponível no histórico.
    supabase.rpc("save_match_report", {
      p_match_id: (matchData as any).id,
      p_report: { own: ownStatLines, opp: oppStatLines, rounds: sim.rounds, events: sim.events },
    }).then(() => {});

    setPhase("playing");
    playback(sim, ownP, oppR, baseTeam, result);
  }

  async function playback(sim: SimData, ownP: Player[], oppR: OppPlayer[], baseTeam: TeamData, result: RpcResult) {
    for (const round of sim.rounds) {
      if (cancelledRef.current) return;
      setRoundIdx(round.round);
      setOwnAlive(ownP.map((p) => p.id));
      setOppAlive(oppR.map((p) => p.id));
      setLiveFeed([]);
      setRoundBanner(null);
      if (!skipRef.current) await sleep(380);

      const roundEvents = sim.events.filter((e) => e.round === round.round);
      for (const ev of roundEvents) {
        if (cancelledRef.current) return;
        if (ev.type === "kill" && ev.victimId) {
          if (ev.victimSide === "own") setOwnAlive((prev) => prev.filter((id) => id !== ev.victimId));
          else setOppAlive((prev) => prev.filter((id) => id !== ev.victimId));
        }
        setLiveFeed((prev) => [...prev, ev]);
        setHistoryFeed((prev) => [...prev, ev]);
        if (!skipRef.current) await sleep(ev.type === "util" ? 180 : 260);
      }

      setScoreOwn(round.ownScore);
      setScoreOpp(round.oppScore);
      setRoundBanner(round.won ? "win" : "loss");
      if (!skipRef.current) await sleep(600);
    }

    if (cancelledRef.current) return;

    setTeam({
      ...baseTeam,
      fans:   Math.max(0, baseTeam.fans + result.fans_delta),
      budget: baseTeam.budget + result.budget_delta,
      wins:   baseTeam.wins   + (result.won ? 1 : 0),
      losses: baseTeam.losses + (result.won ? 0 : 1),
      pdl:    Math.max(0, (baseTeam.pdl ?? 0) + result.pdl_delta),
    });
    setPhase("result");
  }

  const goBack = () => router.replace("/dashboard/matches");

  // ── Loading / error states ───────────────────────────────────────────────
  if (phase === "loading") {
    return (
      <SafeAreaView style={s.safe} edges={["top"]}>
        <View style={s.center}>
          <ActivityIndicator size="large" color="#EC4899" />
          <Text style={s.loadingText}>{t("live.loading")}</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (phase === "error") {
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

  // ── Result state ──────────────────────────────────────────────────────────
  if (phase === "result" && finalResult && team) {
    const won = finalResult.won;
    const matchMvp = pickMatchMvp(ownStats, oppStats);
    return (
      <SafeAreaView style={s.safe} edges={["top"]}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>

          <View style={[s.heroCard, won ? s.heroWin : s.heroLoss]}>
            <Text style={s.heroMap}>{match?.map}</Text>
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
          <ScoreboardTable title={match?.opponent_name.toUpperCase() ?? t("live.opponentFallback")} stats={oppStats} accent="#EF4444" playerCol={t("live.playerCol")} mvpLabel="MVP" />

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

  // ── Playing state ─────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={s.safe} edges={["top"]}>
      <ScreenHeader
        title={t("live.headerLive")}
        titleStyle={{ fontSize: 14, letterSpacing: 3 }}
        dotColor="#EF4444"
        centered
        onBack={goBack}
        right={
          <TouchableOpacity style={s.skipBtn} onPress={() => { skipRef.current = true; }}>
            <Text style={s.skipBtnText}>{t("live.skipBtn")}</Text>
          </TouchableOpacity>
        }
      />

      <View style={s.scoreBar}>
        <Text style={s.scoreBarNum}>{scoreOwn}</Text>
        <View style={s.scoreBarMid}>
          <Text style={s.scoreBarMap}>{match?.map}</Text>
          <Text style={s.scoreBarRound}>{t("live.roundLabel")} {roundIdx}/{totalRounds}</Text>
        </View>
        <Text style={s.scoreBarNum}>{scoreOpp}</Text>
      </View>

      {/* ── ROSTERS ─────────────────────────────────────── */}
      <View style={s.rosters}>
        <RosterColumn label={t("live.yourTeam")} players={ownPlayers} aliveIds={ownAlive} align="left" accent="#10B981" />
        <View style={s.rostersDivider} />
        <RosterColumn label={match?.opponent_name ?? t("live.opponentFallback")} players={oppRoster} aliveIds={oppAlive} align="right" accent="#EF4444" />
      </View>

      {roundBanner && (
        <View style={[s.roundBanner, roundBanner === "win" ? s.roundBannerWin : s.roundBannerLoss]}>
          <Text style={[s.roundBannerText, { color: roundBanner === "win" ? "#10B981" : "#EF4444" }]}>
            {roundBanner === "win" ? t("live.wonRound") : t("live.lostRound")}
          </Text>
        </View>
      )}

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
          {liveFeed.map((ev) => <FeedRow key={ev.id} ev={ev} />)}
        </ScrollView>
      ) : (
        <ScrollView
          ref={historyScrollRef}
          style={s.feed}
          showsVerticalScrollIndicator={false}
          onContentSizeChange={() => historyScrollRef.current?.scrollToEnd({ animated: true })}
        >
          {historyFeed.map((ev) => <FeedRow key={ev.id} ev={ev} showRound />)}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

// ── Subcomponents ────────────────────────────────────────────────────────────

function RosterColumn({
  label, players, aliveIds, align, accent,
}: {
  label: string;
  players: (Player | OppPlayer)[];
  aliveIds: string[];
  align: "left" | "right";
  accent: string;
}) {
  return (
    <View style={s.rosterCol}>
      <Text style={[s.rosterLabel, { color: accent, textAlign: align }]} numberOfLines={1}>{label}</Text>
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

function FeedRow({ ev, showRound }: { ev: KillEvent; showRound?: boolean }) {
  const isUtil = ev.type === "util";
  return (
    <View style={s.feedRow}>
      {showRound && <Text style={s.feedRound}>R{ev.round}</Text>}
      <Text style={[s.feedIcon, isUtil && { opacity: 0.6 }]}>
        {isUtil ? "💨" : ev.killerSide === "own" ? "🔫" : "☠️"}
      </Text>
      <Text style={[s.feedText, isUtil && s.feedTextUtil]} numberOfLines={2}>{ev.text}</Text>
    </View>
  );
}

function ScoreboardTable({
  title, stats, accent, playerCol, mvpLabel,
}: { title: string; stats: StatLine[]; accent: string; playerCol: string; mvpLabel: string }) {
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
  errorBtnText: { fontSize: 12, fontWeight: "800", color: "#9CA3AF", letterSpacing: 1 },

  // Header
  skipBtn: {
    paddingHorizontal: 10, paddingVertical: 8, borderRadius: 8,
    backgroundColor: "#161616", borderWidth: 1, borderColor: "#242424",
  },
  skipBtnText: { fontSize: 10, fontWeight: "800", color: "#6B7280" },

  // Score bar
  scoreBar: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 20, paddingVertical: 10,
  },
  scoreBarNum: { fontSize: 34, fontWeight: "900", color: "#FFFFFF", minWidth: 44, textAlign: "center" },
  scoreBarMid: { alignItems: "center", gap: 2 },
  scoreBarMap: { fontSize: 12, fontWeight: "800", color: "#9CA3AF" },
  scoreBarRound: { fontSize: 9, fontWeight: "700", color: "#4B5563", letterSpacing: 1 },

  // Rosters
  rosters: {
    flexDirection: "row", paddingHorizontal: 16, paddingVertical: 10,
    backgroundColor: "#0D0D0D", borderTopWidth: 1, borderBottomWidth: 1, borderColor: "#1A1A1A",
  },
  rosterCol: { flex: 1, gap: 6 },
  rostersDivider: { width: 1, backgroundColor: "#1A1A1A", marginHorizontal: 10 },
  rosterLabel: { fontSize: 9, fontWeight: "900", letterSpacing: 1, marginBottom: 4 },
  rosterRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  rosterDot: { width: 6, height: 6, borderRadius: 3 },
  rosterName: { flex: 1, fontSize: 11, fontWeight: "700", color: "#D1D5DB" },
  rosterNameDead: { color: "#4B5563", textDecorationLine: "line-through" },

  // Round banner
  roundBanner: { alignItems: "center", paddingVertical: 8 },
  roundBannerWin:  {},
  roundBannerLoss: {},
  roundBannerText: { fontSize: 11, fontWeight: "900", letterSpacing: 2 },

  // Tabs
  tabs: { flexDirection: "row", paddingHorizontal: 16, gap: 8, marginTop: 8, marginBottom: 8 },
  tab: {
    flex: 1, alignItems: "center", paddingVertical: 8, borderRadius: 8,
    backgroundColor: "#0D0D0D", borderWidth: 1, borderColor: "#1A1A1A",
  },
  tabActive: { backgroundColor: "#EC489922", borderColor: "#EC489966" },
  tabText: { fontSize: 10, fontWeight: "800", color: "#6B7280", letterSpacing: 1 },
  tabTextActive: { color: "#EC4899" },

  // Feed
  feed: { flex: 1, paddingHorizontal: 16 },
  feedRow: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 6 },
  feedRound: { width: 24, fontSize: 9, fontWeight: "800", color: "#4B5563" },
  feedIcon: { fontSize: 12 },
  feedText: { flex: 1, fontSize: 12, color: "#D1D5DB" },
  feedTextUtil: { color: "#6B7280", fontStyle: "italic" },

  // Result screen
  heroCard: {
    borderRadius: 16, padding: 20, marginBottom: 16,
    borderWidth: 1, alignItems: "center",
  },
  heroWin:  { backgroundColor: "#0A1F14", borderColor: "#10B98133" },
  heroLoss: { backgroundColor: "#1A0A0A", borderColor: "#EF444433" },
  heroMap:  { fontSize: 10, fontWeight: "900", color: "#6B7280", letterSpacing: 3, marginBottom: 10 },
  scoreRow:     { flexDirection: "row", alignItems: "center", gap: 16, marginBottom: 16 },
  scoreTeam:    { alignItems: "center", flex: 1 },
  scoreTeamName:{ fontSize: 9, fontWeight: "800", color: "#6B7280", letterSpacing: 1, marginBottom: 4 },
  scoreNum:     { fontSize: 52, fontWeight: "900", lineHeight: 56 },
  scoreWin:     { color: "#10B981" },
  scoreLoss:    { color: "#EF4444" },
  scoreDash:    { fontSize: 28, color: "#374151", fontWeight: "900" },
  verdictBadge: { paddingHorizontal: 24, paddingVertical: 8, borderRadius: 20, borderWidth: 1 },
  verdictWin:   { backgroundColor: "#10B98122", borderColor: "#10B98155" },
  verdictLoss:  { backgroundColor: "#EF444422", borderColor: "#EF444455" },
  verdictText:  { fontSize: 14, fontWeight: "900", letterSpacing: 3 },

  pdlResultCard: {
    alignItems: "center", backgroundColor: "#0D0D0D", borderRadius: 14,
    borderWidth: 1, padding: 16, marginBottom: 12, gap: 4,
  },
  pdlResultDelta: { fontSize: 22, fontWeight: "900" },
  pdlResultAfter: { fontSize: 11, color: "#6B7280" },

  rewardsRow: { flexDirection: "row", gap: 8, marginBottom: 16, justifyContent: "center" },
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

  closeBtn: {
    paddingVertical: 14, borderRadius: 12,
    backgroundColor: "#161616", borderWidth: 1, borderColor: "#242424",
    alignItems: "center", marginTop: 4,
  },
  closeBtnText: { fontSize: 13, fontWeight: "700", color: "#9CA3AF", letterSpacing: 1 },
});
