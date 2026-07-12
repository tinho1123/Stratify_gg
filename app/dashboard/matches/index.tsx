import { useAppAlert } from "@/components/ui/AppAlert";
import { ScreenHeader } from "@/components/ui/ScreenHeader";
import { TutorialOverlay } from "@/components/ui/TutorialOverlay";
import { getTierInfo, TierInfo } from "@/constants/tiers";
import { supabase } from "@/database/supabase";
import { useFeatureFlags } from "@/hooks/useFeatureFlags";
import { TutorialStepDef, useScreenTutorial } from "@/hooks/useScreenTutorial";
import { useLanguage } from "@/i18n/LanguageContext";
import { useFocusEffect } from "@react-navigation/native";
import { router } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
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

interface ScheduledMatch {
  id: string;
  opponent_name: string;
  opponent_rating: number;
  scheduled_for: string;
  map: string;
  match_type: string;
  status: "scheduled" | "live" | "played" | "cancelled";
  is_bot: boolean;
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
  pdl_delta: number;
  played_at: string;
}

// PDL delta formula — modifier based on opponent strength vs my team
function calcPdlDelta(won: boolean, myAvgRating: number, oppRating: number): number {
  const diff = oppRating - myAvgRating; // positive = they're stronger
  if (won) {
    // Beat stronger team → more PDL; beat weaker → less
    return Math.round(Math.max(5, Math.min(40, 20 + diff * 0.6)));
  } else {
    // Lose to stronger team → less PDL lost; lose to weaker → more lost
    return -Math.round(Math.max(5, Math.min(30, 15 - diff * 0.6)));
  }
}

// ── Other constants ───────────────────────────────────────────────────────────

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

function formatCountdown(target: string): { h: number; m: number; s: number; expired: boolean } {
  const diff = new Date(target).getTime() - Date.now();
  if (diff <= 0) return { h: 0, m: 0, s: 0, expired: true };
  const h = Math.floor(diff / 3_600_000);
  const m = Math.floor((diff % 3_600_000) / 60_000);
  const s = Math.floor((diff % 60_000) / 1_000);
  return { h, m, s, expired: false };
}

function pad(n: number) { return String(n).padStart(2, "0"); }

function formatDate(iso: string, locale: string) {
  return new Date(iso).toLocaleDateString(locale, {
    day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit",
  });
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function MatchesScreen() {
  const { t, language } = useLanguage();
  const { alert } = useAppAlert();
  const { isEnabled } = useFeatureFlags();
  const dateLocale = language === "pt" ? "pt-BR" : "en-US";
  const [team,      setTeam]      = useState<TeamData | null>(null);
  const [players,   setPlayers]   = useState<Player[]>([]);
  const [upcoming,  setUpcoming]  = useState<ScheduledMatch | null>(null);
  const [history,   setHistory]   = useState<PlayedMatch[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [generating, setGenerating] = useState(false);

  const [countdown, setCountdown] = useState({ h: 0, m: 0, s: 0, expired: false });
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Tutorial guiado ─────────────────────────────────────────────────────
  const scrollRef = useRef<ScrollView>(null);
  const tierCardRef = useRef<View>(null);
  const nextMatchRef = useRef<View>(null);
  const perfCardRef = useRef<View>(null);
  const historyRef = useRef<View>(null);

  const tutorialSteps: TutorialStepDef[] = [
    { ref: null, title: t("tutorial.matches.step1Title"), desc: t("tutorial.matches.step1Desc") },
    { ref: tierCardRef, title: t("tutorial.matches.step2Title"), desc: t("tutorial.matches.step2Desc") },
    { ref: nextMatchRef, title: t("tutorial.matches.step3Title"), desc: t("tutorial.matches.step3Desc") },
    { ref: perfCardRef, title: t("tutorial.matches.step4Title"), desc: t("tutorial.matches.step4Desc") },
    { ref: historyRef, title: t("tutorial.matches.step5Title"), desc: t("tutorial.matches.step5Desc") },
    { ref: null, title: t("tutorial.matches.step6Title"), desc: t("tutorial.matches.step6Desc") },
  ];

  const tutorial = useScreenTutorial({
    id: "matches",
    steps: tutorialSteps,
    ready: !loading && !!team,
    scrollRef,
  });

  // ── Fetch ──────────────────────────────────────────────────────────────────
  const fetchData = useCallback(async () => {
    setLoading(true);

    await supabase.rpc("check_ready_matches");

    const { data: teamData } = await supabase
      .from("teams")
      .select("id, name, budget, fans, wins, losses, pdl")
      .single();

    if (!teamData) { setLoading(false); return; }
    const td = teamData as any;
    setTeam({ ...td, pdl: td.pdl ?? 0 } as TeamData);

    const [
      { data: pData },
      { data: upData },
      { data: histData },
    ] = await Promise.all([
      supabase
        .from("players")
        .select("id, name, role, rating, form")
        .eq("team_id", teamData.id)
        .order("rating", { ascending: false }),
      supabase
        .from("matches")
        .select("id, opponent_name, opponent_rating, scheduled_for, map, match_type, status, is_bot")
        .eq("team_id", teamData.id)
        .in("status", ["scheduled", "live"])
        .order("scheduled_for", { ascending: true })
        .limit(1)
        .single(),
      supabase
        .from("matches")
        .select("id, opponent_name, opponent_rating, result, score_own, score_opp, map, match_type, fans_delta, budget_delta, pdl_delta, played_at")
        .eq("team_id", teamData.id)
        .eq("status", "played")
        .order("played_at", { ascending: false })
        .limit(20),
    ]);

    if (pData)    setPlayers(pData as Player[]);
    if (upData)   setUpcoming({ ...(upData as any), is_bot: (upData as any).is_bot ?? false } as ScheduledMatch);
    if (histData) setHistory(histData.map((m: any) => ({ ...m, pdl_delta: m.pdl_delta ?? 0 })) as PlayedMatch[]);

    setLoading(false);
  }, []);

  // Refaz o fetch sempre que a tela ganha foco — cobre o retorno da tela "ao vivo" depois
  // que a partida foi resolvida (economia/PDL/histórico mudaram no servidor nesse meio tempo).
  useFocusEffect(useCallback(() => { fetchData(); }, [fetchData]));

  // ── Countdown tick ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!upcoming) return;
    const update = () => setCountdown(formatCountdown(upcoming.scheduled_for));
    update();
    tickRef.current = setInterval(update, 1000);
    return () => { if (tickRef.current) clearInterval(tickRef.current); };
  }, [upcoming]);

  // ── Generate match ────────────────────────────────────────────────────────
  // Adversário e horário são escolhidos no servidor (RPC `generate_next_match`), não no
  // client: como `resolve_match` usa `opponent_rating` pra calcular chance de vitória e PDL,
  // deixar o client escrever esse valor direto abriria brecha pra forjar adversários fracos.
  const requestNextMatch = async () => {
    if (!team) return;
    setGenerating(true);

    const { error } = await supabase.rpc("generate_next_match");
    if (error) {
      setGenerating(false);
      alert(t("common.error"), t("matches.errRequestMatch"));
      return;
    }

    await fetchData();
    setGenerating(false);
  };

  // ── Derived ───────────────────────────────────────────────────────────────
  const tierInfo = getTierInfo(team?.pdl ?? 0);
  const total    = (team?.wins ?? 0) + (team?.losses ?? 0);
  const winRate  = total > 0 ? Math.round(((team?.wins ?? 0) / total) * 100) : 0;

  const streak = (() => {
    if (!history.length) return null;
    const first = history[0].result;
    let count = 0;
    for (const m of history) { if (m.result === first) count++; else break; }
    return { type: first, count };
  })();

  const mapColor  = upcoming ? (MAP_COLOR[upcoming.map]         ?? "#6B7280") : "#6B7280";
  const typeColor = upcoming ? (TYPE_COLOR[upcoming.match_type] ?? "#6B7280") : "#6B7280";
  // Já virou 'live' no servidor (kickoff do cron) ou o horário já passou — nos dois casos dá
  // pra assistir. Sem isso, uma partida que já foi pro engine ao vivo mas cujo cron de kickoff
  // ainda não rodou localmente ficava invisível aqui, e o botão "Solicitar Partida" sempre
  // falhava (generate_next_match rejeita times com partida 'scheduled'/'live' em aberto).
  const isReady = countdown.expired || upcoming?.status === "live";

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={s.safe} edges={["top"]}>

      <ScreenHeader
        title={t("matches.headerTitle")}
        dotColor="#EC4899"
        right={
          team ? (
            <TouchableOpacity
              style={[s.tierPill, { borderColor: tierInfo.color + "66" }]}
              onPress={() => isEnabled("matches_season") && router.push("/dashboard/matches/season")}
            >
              <View style={[s.tierDot, { backgroundColor: tierInfo.color }]} />
              <Text style={[s.tierName, { color: tierInfo.color }]}>
                {tierInfo.tier}{tierInfo.division ? ` ${tierInfo.division}` : ""}
              </Text>
              <Text style={s.tierPdl}>{tierInfo.totalPdl} PDL</Text>
            </TouchableOpacity>
          ) : undefined
        }
      />

      {loading ? (
        <View style={s.center}>
          <ActivityIndicator size="large" color="#EC4899" />
          <Text style={s.loadingText}>{t("common.loading")}</Text>
        </View>
      ) : (
        <ScrollView
          ref={scrollRef}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 48 }}
          onScroll={tutorial.onScroll}
          scrollEventThrottle={16}
        >

          {/* ══ TIER CARD ════════════════════════════════ */}
          <View style={s.section} ref={tierCardRef} collapsable={false}>
            <TierCard info={tierInfo} wins={team?.wins ?? 0} losses={team?.losses ?? 0} />
          </View>

          {/* ══ TORNEIO ══════════════════════════════════ */}
          {isEnabled("matches_tournament") && (
            <View style={s.section}>
              <TouchableOpacity style={s.tournamentBanner} onPress={() => router.push("/dashboard/matches/tournament")}>
                <Text style={s.tournamentBannerIcon}>🏆</Text>
                <View style={{ flex: 1 }}>
                  <Text style={s.tournamentBannerTitle}>{t("matches.tournamentBannerTitle")}</Text>
                  <Text style={s.tournamentBannerSub}>{t("matches.tournamentBannerSub")}</Text>
                </View>
                <Text style={s.tournamentBannerArrow}>›</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* ══ DESAFIOS ═════════════════════════════════ */}
          {isEnabled("matches_challenges") && (
            <View style={s.section}>
              <TouchableOpacity style={s.tournamentBanner} onPress={() => router.push("/dashboard/matches/challenges")}>
                <Text style={s.tournamentBannerIcon}>⚔️</Text>
                <View style={{ flex: 1 }}>
                  <Text style={s.tournamentBannerTitle}>{t("matches.challengesBannerTitle")}</Text>
                  <Text style={s.tournamentBannerSub}>{t("matches.challengesBannerSub")}</Text>
                </View>
                <Text style={s.tournamentBannerArrow}>›</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* ══ PRÓXIMA PARTIDA ══════════════════════════ */}
          <View style={s.section} ref={nextMatchRef} collapsable={false}>
            <Text style={s.sectionTitle}>{t("matches.nextMatchTitle")}</Text>

            {upcoming ? (
              <View style={[s.upcomingCard, isReady && s.upcomingCardReady]}>
                <View style={[s.upcomingAccent, { backgroundColor: isReady ? "#EC4899" : typeColor }]} />

                <View style={s.upcomingBody}>
                  <View style={s.upcomingBadgeRow}>
                    <View style={[s.badge, { backgroundColor: typeColor + "22", borderColor: typeColor + "55" }]}>
                      <Text style={[s.badgeText, { color: typeColor }]}>{upcoming.match_type}</Text>
                    </View>
                    <View style={[s.badge, { backgroundColor: mapColor + "22", borderColor: mapColor + "55" }]}>
                      <Text style={[s.badgeText, { color: mapColor }]}>{upcoming.map}</Text>
                    </View>
                    <View style={s.oppEloBadge}>
                      <Text style={s.oppEloText}>RTG {upcoming.opponent_rating}</Text>
                    </View>
                    {upcoming.is_bot && (
                      <View style={s.botBadge}>
                        <Text style={s.botBadgeText}>🤖 BOT</Text>
                      </View>
                    )}
                  </View>

                  <View style={s.vsRow}>
                    <Text style={s.vsLabel}>vs.</Text>
                    <Text style={s.vsOpponent}>{upcoming.opponent_name}</Text>
                    {upcoming.is_bot && (
                      <Text style={s.botNote}>{t("matches.autoOpponent")}</Text>
                    )}
                  </View>

                  {/* PDL preview */}
                  {(() => {
                    const myAvg = players.length
                      ? Math.round(players.reduce((s, p) => s + p.rating, 0) / players.length)
                      : 65;
                    const winPdl  = calcPdlDelta(true,  myAvg, upcoming.opponent_rating);
                    const lossPdl = calcPdlDelta(false, myAvg, upcoming.opponent_rating);
                    return (
                      <View style={s.pdlPreview}>
                        <View style={s.pdlPreviewItem}>
                          <Text style={s.pdlPreviewIcon}>🏆</Text>
                          <Text style={[s.pdlPreviewVal, { color: "#10B981" }]}>+{winPdl}</Text>
                          <Text style={s.pdlPreviewLabel}>{t("matches.winLabel")}</Text>
                        </View>
                        <View style={s.pdlPreviewDivider} />
                        <View style={s.pdlPreviewItem}>
                          <Text style={s.pdlPreviewIcon}>💀</Text>
                          <Text style={[s.pdlPreviewVal, { color: "#EF4444" }]}>{lossPdl}</Text>
                          <Text style={s.pdlPreviewLabel}>{t("matches.lossLabel")}</Text>
                        </View>
                      </View>
                    );
                  })()}

                  {isReady ? (
                    <TouchableOpacity
                      style={s.readyBtn}
                      onPress={() => router.push("/dashboard/matches/live")}
                      activeOpacity={0.8}
                    >
                      <Text style={s.readyBtnIcon}>📺</Text>
                      <Text style={s.readyBtnText}>{t("matches.watchBtn")}</Text>
                    </TouchableOpacity>
                  ) : (
                    <View style={s.countdownWrap}>
                      <Text style={s.countdownLabel}>{t("matches.startsIn")}</Text>
                      <View style={s.countdownRow}>
                        {[
                          { v: countdown.h, l: t("matches.unitHrs") },
                          { v: countdown.m, l: t("matches.unitMin") },
                          { v: countdown.s, l: t("matches.unitSec") },
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
                      <Text style={s.countdownDate}>{formatDate(upcoming.scheduled_for, dateLocale)}</Text>
                    </View>
                  )}
                </View>
              </View>
            ) : (
              <View style={s.noMatchCard}>
                <Text style={s.noMatchEmoji}>📅</Text>
                <Text style={s.noMatchText}>{t("matches.noMatchTitle")}</Text>
                <Text style={s.noMatchSub}>
                  {t("matches.noMatchSub")}
                </Text>
                <TouchableOpacity style={s.genBtn} onPress={requestNextMatch} disabled={generating}>
                  {generating
                    ? <ActivityIndicator size="small" color="#EC4899" />
                    : <Text style={s.genBtnText}>{t("matches.requestBtn")}</Text>}
                </TouchableOpacity>
              </View>
            )}
          </View>

          {/* ══ DESEMPENHO ═══════════════════════════════ */}
          <View style={s.section} ref={perfCardRef} collapsable={false}>
            <Text style={s.sectionTitle}>{t("matches.performanceTitle")}</Text>
            <View style={s.perfCard}>
              <View style={s.winRateWrap}>
                <View style={[s.winRateCircle, { borderColor: winRate >= 50 ? "#10B981" : "#EF4444" }]}>
                  <Text style={[s.winRatePct, { color: winRate >= 50 ? "#10B981" : "#EF4444" }]}>
                    {total > 0 ? `${winRate}%` : "—"}
                  </Text>
                  <Text style={s.winRateLabel}>{t("matches.winPct")}</Text>
                </View>
              </View>
              <View style={s.perfDivider} />
              <View style={s.perfStats}>
                <View style={s.perfItem}>
                  <Text style={s.perfValue}>{total}</Text>
                  <Text style={s.perfLabel}>{t("matches.total")}</Text>
                </View>
                <View style={s.perfItem}>
                  <Text style={[s.perfValue, { color: "#10B981" }]}>{team?.wins ?? 0}</Text>
                  <Text style={s.perfLabel}>{t("matches.victories")}</Text>
                </View>
                <View style={s.perfItem}>
                  <Text style={[s.perfValue, { color: "#EF4444" }]}>{team?.losses ?? 0}</Text>
                  <Text style={s.perfLabel}>{t("matches.defeats")}</Text>
                </View>
                <View style={s.perfItem}>
                  {streak ? (
                    <>
                      <Text style={[s.perfValue, { color: streak.type === "win" ? "#10B981" : "#EF4444" }]}>
                        {streak.count}{streak.type === "win" ? "W" : "L"}
                      </Text>
                      <Text style={s.perfLabel}>{t("matches.streak")}</Text>
                    </>
                  ) : (
                    <>
                      <Text style={s.perfValue}>—</Text>
                      <Text style={s.perfLabel}>{t("matches.streak")}</Text>
                    </>
                  )}
                </View>
              </View>
            </View>
          </View>

          {/* ══ HISTÓRICO ════════════════════════════════ */}
          <View style={s.section} ref={historyRef} collapsable={false}>
            <Text style={s.sectionTitle}>{t("matches.historyTitle")}</Text>

            {history.length === 0 ? (
              <View style={s.emptyCard}>
                <Text style={s.emptyEmoji}>🏆</Text>
                <Text style={s.emptyText}>{t("matches.noMatchesPlayed")}</Text>
              </View>
            ) : (
              history.map((m) => {
                const won = m.result === "win";
                const mc  = MAP_COLOR[m.map]         ?? "#6B7280";
                const tc  = TYPE_COLOR[m.match_type] ?? "#6B7280";
                const pdlColor = m.pdl_delta > 0 ? "#10B981" : "#EF4444";
                return (
                  <TouchableOpacity
                    key={m.id}
                    style={[s.histCard, won ? s.histCardWin : s.histCardLoss]}
                    activeOpacity={0.75}
                    onPress={() => router.push({ pathname: "/dashboard/matches/[id]", params: { id: m.id } })}
                  >
                    <View style={[s.histBar, { backgroundColor: won ? "#10B981" : "#EF4444" }]} />

                    <View style={s.histLeft}>
                      <View style={[s.resultBadge, { backgroundColor: won ? "#10B98122" : "#EF444422" }]}>
                        <Text style={[s.resultBadgeText, { color: won ? "#10B981" : "#EF4444" }]}>
                          {won ? t("matches.resultWin") : t("matches.resultLoss")}
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
                      {m.pdl_delta !== 0 && (
                        <View style={[s.pdlDeltaBadge, { backgroundColor: pdlColor + "18", borderColor: pdlColor + "44" }]}>
                          <Text style={[s.pdlDeltaText, { color: pdlColor }]}>
                            {m.pdl_delta > 0 ? "+" : ""}{m.pdl_delta} PDL
                          </Text>
                        </View>
                      )}
                      <Text style={s.histDate}>{formatDate(m.played_at, dateLocale)}</Text>
                    </View>
                  </TouchableOpacity>
                );
              })
            )}
          </View>

        </ScrollView>
      )}

      <TutorialOverlay
        visible={tutorial.active}
        stepIndex={tutorial.step}
        totalSteps={tutorialSteps.length}
        title={tutorialSteps[tutorial.step].title}
        description={tutorialSteps[tutorial.step].desc}
        spotlight={tutorial.spotlight}
        onNext={tutorial.next}
        onSkip={tutorial.skip}
        isLast={tutorial.isLast}
        nextLabel={t("tutorial.next")}
        finishLabel={t("tutorial.finish")}
        skipLabel={t("tutorial.skip")}
      />

    </SafeAreaView>
  );
}

// ── Tier card component ───────────────────────────────────────────────────────

function TierCard({ info, wins, losses }: { info: TierInfo; wins: number; losses: number }) {
  const pct = info.pdlInDiv;
  const isTopTier = !info.division;
  return (
    <View style={[tc.card, { borderColor: info.color + "44" }]}>
      {/* Left: tier name */}
      <View style={tc.left}>
        <View style={[tc.shield, { backgroundColor: info.color + "18", borderColor: info.color + "44" }]}>
          <Text style={[tc.shieldText, { color: info.color }]}>
            {info.tier[0]}
          </Text>
        </View>
        <View>
          <Text style={[tc.tierName, { color: info.color }]}>
            {info.tier}{info.division ? ` ${info.division}` : ""}
          </Text>
          <Text style={tc.pdlTotal}>{info.totalPdl} PDL total</Text>
        </View>
      </View>

      {/* Right: progress + next */}
      <View style={tc.right}>
        {!isTopTier && (
          <>
            <View style={tc.progressTrack}>
              <View style={[tc.progressFill, { width: `${pct}%` as any, backgroundColor: info.color }]} />
            </View>
            <Text style={tc.progressLabel}>
              {pct}/100 · +{info.pdlForNext} para subir
            </Text>
          </>
        )}
        <View style={tc.record}>
          <Text style={[tc.recordW, { color: "#10B981" }]}>{wins}V</Text>
          <Text style={tc.recordSep}> – </Text>
          <Text style={[tc.recordL, { color: "#EF4444" }]}>{losses}D</Text>
        </View>
      </View>
    </View>
  );
}

const tc = StyleSheet.create({
  card: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: "#0D0D0D", borderRadius: 14,
    borderWidth: 1, padding: 16, gap: 16,
  },
  left:  { flexDirection: "row", alignItems: "center", gap: 12, flex: 1 },
  shield: {
    width: 48, height: 48, borderRadius: 12, borderWidth: 1,
    justifyContent: "center", alignItems: "center",
  },
  shieldText: { fontSize: 22, fontWeight: "900" },
  tierName:   { fontSize: 16, fontWeight: "900", letterSpacing: 0.5 },
  pdlTotal:   { fontSize: 10, color: "#4B5563", marginTop: 2 },
  right:      { alignItems: "flex-end", gap: 6 },
  progressTrack: {
    width: 100, height: 4, backgroundColor: "#1A1A1A",
    borderRadius: 2, overflow: "hidden",
  },
  progressFill:  { height: 4, borderRadius: 2 },
  progressLabel: { fontSize: 9, color: "#4B5563" },
  record:        { flexDirection: "row", alignItems: "center" },
  recordW:       { fontSize: 13, fontWeight: "900" },
  recordSep:     { fontSize: 13, color: "#374151", fontWeight: "700" },
  recordL:       { fontSize: 13, fontWeight: "900" },
});

// ── Main styles ───────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  safe:        { flex: 1, backgroundColor: "#080808" },
  center:      { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
  loadingText: { fontSize: 13, color: "#6B7280" },

  // Header
  tierPill: {
    flexDirection: "row", alignItems: "center", gap: 5,
    backgroundColor: "#0D0D0D", borderWidth: 1,
    borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6,
  },
  tierDot:  { width: 6, height: 6, borderRadius: 3 },
  tierName: { fontSize: 11, fontWeight: "900", letterSpacing: 0.5 },
  tierPdl:  { fontSize: 9, color: "#4B5563", fontWeight: "600" },

  tournamentBanner: {
    flexDirection: "row", alignItems: "center", gap: 12,
    backgroundColor: "#161000", borderRadius: 14, borderWidth: 1, borderColor: "#F59E0B33",
    padding: 14,
  },
  tournamentBannerIcon:  { fontSize: 24 },
  tournamentBannerTitle: { fontSize: 13, fontWeight: "800", color: "#FFFFFF" },
  tournamentBannerSub:   { fontSize: 11, color: "#6B7280", marginTop: 2 },
  tournamentBannerArrow: { fontSize: 22, color: "#F59E0B", fontWeight: "900" },

  // Section
  section: { paddingHorizontal: 16, marginBottom: 20 },
  sectionTitle: {
    fontSize: 10, fontWeight: "900", color: "#6B7280",
    letterSpacing: 3, marginBottom: 12,
  },

  // Badge
  badge: { borderRadius: 5, paddingHorizontal: 7, paddingVertical: 3, borderWidth: 1 },
  badgeText: { fontSize: 9, fontWeight: "800", letterSpacing: 0.5 },

  // Upcoming card
  upcomingCard: {
    backgroundColor: "#0D0D0D", borderRadius: 16,
    borderWidth: 1, borderColor: "#1A1A1A", overflow: "hidden",
  },
  upcomingCardReady: { borderColor: "#EC489944" },
  upcomingAccent:    { height: 3 },
  upcomingBody:      { padding: 18 },
  upcomingBadgeRow:  { flexDirection: "row", gap: 8, marginBottom: 14, flexWrap: "wrap" },

  oppEloBadge: {
    backgroundColor: "#161616", borderWidth: 1, borderColor: "#242424",
    borderRadius: 5, paddingHorizontal: 7, paddingVertical: 3,
  },
  oppEloText: { fontSize: 9, fontWeight: "700", color: "#9CA3AF" },

  botBadge: {
    backgroundColor: "#1A1400", borderWidth: 1, borderColor: "#F59E0B44",
    borderRadius: 5, paddingHorizontal: 7, paddingVertical: 3,
  },
  botBadgeText: { fontSize: 9, fontWeight: "800", color: "#F59E0B" },
  botNote:      { fontSize: 10, color: "#4B5563", fontStyle: "italic" },

  vsRow:     { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 14 },
  vsLabel:   { fontSize: 12, color: "#6B7280", fontWeight: "700" },
  vsOpponent:{ fontSize: 20, fontWeight: "900", color: "#FFFFFF", flex: 1 },

  // PDL preview
  pdlPreview: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: "#111", borderRadius: 10,
    borderWidth: 1, borderColor: "#1A1A1A",
    padding: 12, marginBottom: 16, gap: 12,
  },
  pdlPreviewItem:    { flex: 1, alignItems: "center", gap: 2 },
  pdlPreviewIcon:    { fontSize: 14 },
  pdlPreviewVal:     { fontSize: 16, fontWeight: "900" },
  pdlPreviewLabel:   { fontSize: 9, color: "#4B5563", fontWeight: "600" },
  pdlPreviewDivider: { width: 1, height: 32, backgroundColor: "#1A1A1A" },

  countdownWrap:  { alignItems: "center", gap: 6 },
  countdownLabel: { fontSize: 9, fontWeight: "900", color: "#4B5563", letterSpacing: 2 },
  countdownRow:   { flexDirection: "row", alignItems: "center", gap: 4 },
  countdownBox:   { alignItems: "center", gap: 2 },
  countdownNum:   { fontSize: 32, fontWeight: "900", color: "#FFFFFF", fontVariant: ["tabular-nums"] as any },
  countdownUnit:  { fontSize: 8, color: "#4B5563", fontWeight: "700", letterSpacing: 1 },
  countdownSep:   { fontSize: 28, color: "#374151", fontWeight: "900", marginBottom: 14 },
  countdownDate:  { fontSize: 11, color: "#4B5563", marginTop: 4 },

  readyBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 10, backgroundColor: "#EC4899", borderRadius: 12, paddingVertical: 14,
  },
  readyBtnIcon: { fontSize: 20 },
  readyBtnText: { fontSize: 14, fontWeight: "900", color: "#FFFFFF", letterSpacing: 2 },

  noMatchCard: {
    backgroundColor: "#0D0D0D", borderRadius: 16,
    borderWidth: 1, borderColor: "#1A1A1A",
    padding: 28, alignItems: "center", gap: 8,
  },
  noMatchEmoji: { fontSize: 36, marginBottom: 4 },
  noMatchText:  { fontSize: 14, fontWeight: "700", color: "#6B7280" },
  noMatchSub:   { fontSize: 12, color: "#374151", textAlign: "center", marginBottom: 8 },
  genBtn: {
    paddingHorizontal: 20, paddingVertical: 12, borderRadius: 10,
    backgroundColor: "#EC489922", borderWidth: 1, borderColor: "#EC489966",
    minWidth: 180, alignItems: "center", height: 44,
  },
  genBtnText: { fontSize: 12, fontWeight: "800", color: "#EC4899", letterSpacing: 1 },

  // Performance
  perfCard: {
    backgroundColor: "#0D0D0D", borderRadius: 16,
    borderWidth: 1, borderColor: "#1A1A1A", padding: 16,
    flexDirection: "row", alignItems: "center", gap: 16,
  },
  winRateWrap:   { alignItems: "center" },
  winRateCircle: {
    width: 80, height: 80, borderRadius: 40, borderWidth: 3,
    justifyContent: "center", alignItems: "center", backgroundColor: "#111",
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
  histCardWin:     { borderColor: "#10B98122" },
  histCardLoss:    { borderColor: "#EF444422" },
  histBar:         { width: 3, alignSelf: "stretch" },
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
  histRight:    { alignItems: "flex-end", gap: 4 },
  histDate:     { fontSize: 9, color: "#374151" },

  pdlDeltaBadge: {
    borderRadius: 6, borderWidth: 1,
    paddingHorizontal: 7, paddingVertical: 2,
  },
  pdlDeltaText: { fontSize: 10, fontWeight: "800" },
});
