import { useAppAlert } from "@/components/ui/AppAlert";
import { getRatingColor, STATUS_COLOR, STATUS_LABEL_KEY } from "@/constants/playerStatus";
import { supabase } from "@/database/supabase";
import { useFeatureFlags } from "@/hooks/useFeatureFlags";
import { useLanguage } from "@/i18n/LanguageContext";
import { useFocusEffect } from "@react-navigation/native";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Dimensions,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const { width } = Dimensions.get("window");

// ── Types ─────────────────────────────────────────────────────────────────────

interface Player {
  id: string;
  name: string;
  role: string;
  status: "online" | "injured" | "banned";
  rating: number;
  morale: number;
  form: number;
  energy: number;
}

interface Team {
  id: string;
  name: string;
  budget: number;
  ranking: number;
  fans: number;
  wins: number;
  losses: number;
  pdl: number;
  premium_credits: number;
  login_streak_count: number;
  last_login_reward_at: string | null;
}

interface Notification {
  id: string;
  type: "alert" | "info" | "success";
  tag: string;
  message: string;
  read: boolean;
  created_at: string;
  related_id: string | null;
}

interface NextMatch {
  id: string;
  opponent_name: string;
  match_type: string;
  scheduled_for: string;
}

// ── Tokens ────────────────────────────────────────────────────────────────────

const C = {
  bg:            "#080808",
  surfaceDeep:   "#0D0D0D",
  surfaceRaised: "#111111",
  surfaceControl:"#161616",
  borderSubtle:  "#1A1A1A",
  borderDefault: "#1F1F1F",
  borderStrong:  "#242424",
  emerald:       "#10B981",
  emerald400:    "#34D399",
  emeraldTint12: "rgba(16,185,129,0.12)",
  emeraldTint30: "rgba(16,185,129,0.30)",
  textPrimary:   "#FFFFFF",
  textSecondary: "#9CA3AF",
  textMuted:     "#6B7280",
  textFaint:     "#4B5563",
  textGhost:     "#374151",
  danger:        "#EF4444",
  warning:       "#F59E0B",
  info:          "#6366F1",
  pink:          "#EC4899",
};

const NOTIF_STYLE: Record<string, { tag: string; border: string; bg: string }> = {
  alert:   { tag: C.danger,   border: "rgba(239,68,68,0.25)",   bg: "rgba(239,68,68,0.06)" },
  info:    { tag: C.warning,  border: "rgba(245,158,11,0.25)",  bg: "rgba(245,158,11,0.06)" },
  success: { tag: C.emerald,  border: "rgba(16,185,129,0.25)",  bg: "rgba(16,185,129,0.06)" },
};

function fmtBudget(n: number) {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n}`;
}

const DASH_TIERS = [
  { name: "Bronze",      color: "#CD7F32", minPdl: 0    },
  { name: "Prata",       color: "#C0C0C0", minPdl: 300  },
  { name: "Ouro",        color: "#FFD700", minPdl: 600  },
  { name: "Platina",     color: "#00B4D8", minPdl: 900  },
  { name: "Diamante",    color: "#B9F2FF", minPdl: 1200 },
  { name: "Mestre",      color: "#9B59B6", minPdl: 1500 },
  { name: "Grão-Mestre", color: "#E74C3C", minPdl: 1800 },
] as const;

function getDashTierInfo(pdl: number): { label: string; color: string } {
  const clamped = Math.max(0, pdl);
  let tier: typeof DASH_TIERS[number] = DASH_TIERS[0];
  for (const t of DASH_TIERS) { if (clamped >= t.minPdl) tier = t; }
  const isSingle = tier.minPdl >= 1500;
  if (isSingle) return { label: tier.name, color: tier.color };
  const divIdx = Math.min(2, Math.floor((clamped - tier.minPdl) / 100));
  const div    = ["III", "II", "I"][divIdx];
  return { label: `${tier.name} ${div}`, color: tier.color };
}

function calcCountdown(scheduledFor: string) {
  const diff = new Date(scheduledFor).getTime() - Date.now();
  if (diff <= 0) return [{ v: 0, key: "dashboard.unitDays" }, { v: 0, key: "dashboard.unitHours" }, { v: 0, key: "dashboard.unitMinutes" }];
  const days = Math.floor(diff / 86_400_000);
  const hrs  = Math.floor((diff % 86_400_000) / 3_600_000);
  const mins = Math.floor((diff % 3_600_000) / 60_000);
  return [
    { v: days, key: "dashboard.unitDays" },
    { v: hrs,  key: "dashboard.unitHours" },
    { v: mins, key: "dashboard.unitMinutes" },
  ];
}

// ── Screen ────────────────────────────────────────────────────────────────────

export default function HomeScreen() {
  const { t } = useLanguage();
  const { isEnabled } = useFeatureFlags();
  const { alert } = useAppAlert();
  const [players, setPlayers] = useState<Player[]>([]);
  const [loadingPlayers, setLoadingPlayers] = useState(true);
  const [team, setTeam] = useState<Team | null>(null);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [notifOpen, setNotifOpen] = useState(false);
  const [nextMatch, setNextMatch] = useState<NextMatch | null>(null);
  const [, setTick] = useState(0);
  const [claimingDaily, setClaimingDaily] = useState(false);

  const unreadCount = notifications.filter((n) => !n.read).length;

  const loadNotifications = useCallback(() => {
    // Checa se alguma partida agendada já passou do horário e, se sim, gera a notificação
    // "pronta pra assistir" (idempotente — não duplica se já foi gerada).
    supabase.rpc("check_ready_matches").then(() => {
      supabase
        .from("notifications")
        .select("id, type, tag, message, read, created_at, related_id")
        .order("created_at", { ascending: false })
        .then(({ data, error }) => {
          if (!error && data) setNotifications(data as Notification[]);
        });
    });
  }, []);

  const loadDashboard = useCallback(() => {
    setLoadingPlayers(true);
    // Manutenção sob demanda antes de carregar o time: remove jogadores com contrato vencido
    // e paga bônus de temporadas de liga já encerradas — ambos alteram budget/fans, por isso
    // rodam antes do fetch do time (senão a tela mostraria valores desatualizados).
    Promise.all([
      supabase.rpc("check_expired_contracts"),
      supabase.rpc("check_expiring_contracts"),
      supabase.rpc("check_recovered_players"),
      supabase.rpc("claim_season_rewards"),
      supabase.rpc("check_achievements"),
    ]).then(() => {
      supabase
        .from("teams")
        .select("id, name, budget, ranking, fans, wins, losses, pdl, premium_credits, login_streak_count, last_login_reward_at")
        .single()
        .then(({ data, error }) => {
          if (!error && data) {
            const d = data as any;
            setTeam({
              ...d,
              pdl: d.pdl ?? 0,
              premium_credits: d.premium_credits ?? 0,
              login_streak_count: d.login_streak_count ?? 0,
              last_login_reward_at: d.last_login_reward_at ?? null,
            } as Team);
            supabase
              .from("players")
              .select("id, name, role, status, rating, morale, form, energy")
              .eq("team_id", data.id)
              .then(({ data: pd, error: pe }) => {
                if (!pe && pd) setPlayers(pd as Player[]);
                setLoadingPlayers(false);
              });
          } else {
            setLoadingPlayers(false);
          }
        });
    });

    loadNotifications();

    supabase
      .from("matches")
      .select("id, opponent_name, match_type, scheduled_for")
      .eq("status", "scheduled")
      .gte("scheduled_for", new Date().toISOString())
      .order("scheduled_for", { ascending: true })
      .limit(1)
      .single()
      .then(({ data, error }) => {
        if (!error && data) setNextMatch(data as NextMatch);
      });
  }, [loadNotifications]);

  // Recarrega sempre que a tela ganha foco — cobre a volta de Gerenciar Time/Mercado/etc.,
  // que mudam budget/elenco/notificações enquanto o Dashboard ficava montado em segundo
  // plano (o Stack não desmonta a tela de baixo ao empilhar outra por cima).
  useFocusEffect(useCallback(() => { loadDashboard(); }, [loadDashboard]));

  useEffect(() => {
    const timer = setInterval(() => {
      setTick((t) => t + 1);
      loadNotifications();
    }, 60_000);
    return () => clearInterval(timer);
  }, [loadNotifications]);

  const openNotifications = async () => {
    setNotifOpen(true);
    const unreadIds = notifications.filter((n) => !n.read).map((n) => n.id);
    if (unreadIds.length === 0) return;
    await supabase.from("notifications").update({ read: true }).in("id", unreadIds);
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  const openNotification = (n: Notification) => {
    if (!n.related_id) return;
    setNotifOpen(false);
    router.push("/dashboard/matches");
  };

  const claimDailyReward = async () => {
    setClaimingDaily(true);
    const { data, error } = await supabase.rpc("claim_daily_reward");
    setClaimingDaily(false);
    if (error) {
      alert(t("common.error"), t("dashboard.dailyRewardErrGeneric"));
      return;
    }
    const credits = (data as any)?.credits_granted ?? 0;
    alert(t("dashboard.dailyRewardClaimedTitle"), t("dashboard.dailyRewardClaimedMsg").replace("{n}", String(credits)), "success");
    loadDashboard();
  };

  const avgRating = players.length
    ? (players.reduce((s, p) => s + p.rating, 0) / players.length).toFixed(1)
    : "—";

  const avgOf = (fn: (p: Player) => number) =>
    players.length ? Math.round(players.reduce((s, p) => s + fn(p), 0) / players.length) : 0;
  const avgMorale = avgOf((p) => p.morale);
  const avgForm   = avgOf((p) => p.form);
  const avgEnergy = avgOf((p) => p.energy);

  const teamPdl  = team?.pdl ?? 0;
  const tierInfo = getDashTierInfo(teamPdl);

  const kpis = [
    { value: team ? fmtBudget(team.budget) : "—",                                  label: t("dashboard.budget"), sub: t("dashboard.budgetSub") },
    { value: team ? `${teamPdl}` : "—",                                             label: "PDL",                 sub: tierInfo.label, subColor: tierInfo.color },
    { value: team ? (team.fans >= 1000 ? `${(team.fans / 1000).toFixed(1)}K` : String(team.fans)) : "—", label: t("dashboard.fans"), sub: t("dashboard.fansSub") },
    { value: team ? `${team.wins}-${team.losses}` : "—",                           label: t("dashboard.record"), sub: `${team ? team.wins + team.losses : 0} ${t("dashboard.recordSub")}` },
  ];

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>

        {/* ── TOP HEADER ───────────────────────────────────── */}
        <View style={styles.topHeader}>
          <View style={styles.topHeaderLeft}>
            <View style={styles.logoDot} />
            <Text style={styles.logoText}>STRATIFY</Text>
          </View>
          <View style={styles.topHeaderRight}>
            <TouchableOpacity style={styles.storeBtn} onPress={() => router.push("/dashboard/store" as any)}>
              <Text style={styles.storeBtnIcon}>💎</Text>
              <Text style={styles.storeBtnText}>{team ? team.premium_credits.toLocaleString() : "—"}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.iconBtn} onPress={openNotifications}>
              <Text style={styles.iconBtnText}>🔔</Text>
              {unreadCount > 0 && (
                <View style={styles.iconBadge}>
                  <Text style={styles.iconBadgeText}>{unreadCount > 9 ? "9+" : unreadCount}</Text>
                </View>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.avatarBtn}
              onPress={() => router.push("/dashboard/profile")}
            >
              <Text style={styles.avatarBtnText}>GS</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* ── NOTIFICATIONS SHEET ──────────────────────────── */}
        <Modal
          visible={notifOpen}
          transparent
          animationType="slide"
          onRequestClose={() => setNotifOpen(false)}
        >
          <Pressable style={styles.overlay} onPress={() => setNotifOpen(false)}>
            <Pressable style={styles.sheet} onPress={() => {}}>
              <View style={styles.sheetHandle} />
              <View style={styles.sheetHeader}>
                <Text style={styles.sheetTitle}>{t("dashboard.notifications")}</Text>
                <TouchableOpacity onPress={() => setNotifOpen(false)}>
                  <Text style={styles.sheetClose}>✕</Text>
                </TouchableOpacity>
              </View>

              <ScrollView showsVerticalScrollIndicator={false}>
                {notifications.length === 0 ? (
                  <View style={styles.notifEmpty}>
                    <Text style={styles.notifEmptyIcon}>🔕</Text>
                    <Text style={styles.notifEmptyText}>{t("dashboard.noNotifications")}</Text>
                  </View>
                ) : (
                  notifications.map((n) => {
                    const s = NOTIF_STYLE[n.type];
                    const date = new Date(n.created_at).toLocaleDateString("pt-BR", {
                      day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit",
                    });
                    return (
                      <TouchableOpacity
                        key={n.id}
                        activeOpacity={n.related_id ? 0.7 : 1}
                        onPress={() => openNotification(n)}
                        style={[
                          styles.notifItem,
                          { borderColor: s.border, backgroundColor: n.read ? C.surfaceDeep : s.bg },
                        ]}
                      >
                        {!n.read && <View style={[styles.notifDot, { backgroundColor: s.tag }]} />}
                        <View style={styles.notifBody}>
                          <View style={styles.notifTopRow}>
                            <View style={[styles.notifTag, { backgroundColor: s.tag }]}>
                              <Text style={styles.notifTagText}>{n.tag}</Text>
                            </View>
                            <Text style={styles.notifDate}>{date}</Text>
                          </View>
                          <Text style={[styles.notifMsg, n.read && { color: C.textFaint }]}>
                            {n.message}
                          </Text>
                        </View>
                      </TouchableOpacity>
                    );
                  })
                )}
                <View style={{ height: 24 }} />
              </ScrollView>
            </Pressable>
          </Pressable>
        </Modal>

        <View style={styles.content}>

          {/* ── HERO — PRÓXIMA PARTIDA ──────────────────────── */}
          <LinearGradient
            colors={["#0D1F16", "#111111"]}
            style={styles.heroCard}
          >
            <View style={styles.heroBorderGlow} pointerEvents="none" />

            <View style={styles.heroBadge}>
              <View style={styles.heroBadgeDot} />
              <Text style={styles.heroBadgeText}>{t("dashboard.nextMatch")}</Text>
            </View>

            {nextMatch ? (
              <>
                <Text style={styles.heroTitle}>
                  {nextMatch.match_type?.toUpperCase() ?? "PARTIDA"}
                </Text>
                <Text style={styles.heroOpponent}>vs. {nextMatch.opponent_name}</Text>

                <View style={styles.countdown}>
                  {calcCountdown(nextMatch.scheduled_for).map((item, i) => (
                    <React.Fragment key={i}>
                      {i > 0 && <Text style={styles.countdownSep}>:</Text>}
                      <View style={styles.countdownBox}>
                        <Text style={styles.countdownNum}>{String(item.v).padStart(2, "0")}</Text>
                        <Text style={styles.countdownLbl}>{t(item.key)}</Text>
                      </View>
                    </React.Fragment>
                  ))}
                </View>

                <TouchableOpacity onPress={() => router.push("/dashboard/matches")}>
                  <Text style={styles.heroLink}>{t("dashboard.viewDetails")}</Text>
                </TouchableOpacity>
              </>
            ) : (
              <View style={styles.heroEmpty}>
                <Text style={styles.heroEmptyText}>{t("dashboard.noMatchScheduled")}</Text>
                <TouchableOpacity onPress={() => router.push("/dashboard/matches")}>
                  <Text style={styles.heroLink}>{t("dashboard.scheduleMatch")}</Text>
                </TouchableOpacity>
              </View>
            )}
          </LinearGradient>

          {/* ── KPI GRID 2×2 ─────────────────────────────────── */}
          <View style={styles.kpiGrid}>
            {kpis.map((kpi, i) => (
              <View key={i} style={styles.kpiCard}>
                <Text style={styles.kpiValue}>{kpi.value}</Text>
                <Text style={styles.kpiLabel}>{kpi.label}</Text>
                <Text style={[styles.kpiSub, (kpi as any).subColor ? { color: (kpi as any).subColor } : undefined]}>
                  {kpi.sub}
                </Text>
              </View>
            ))}
          </View>

          {/* ── RECOMPENSA DIÁRIA ────────────────────────────── */}
          {team && (() => {
            const todayStr = new Date().toISOString().slice(0, 10);
            const claimedToday = team.last_login_reward_at === todayStr;
            const yesterdayStr = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
            const predictedStreak = claimedToday
              ? team.login_streak_count
              : team.last_login_reward_at === yesterdayStr
              ? team.login_streak_count + 1
              : 1;
            const dayInCycle = ((predictedStreak - 1) % 7) + 1;
            return (
              <View style={styles.dailyCard}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.dailyTitle}>{t("dashboard.dailyRewardTitle")}</Text>
                  <View style={styles.dailyDotsRow}>
                    {Array.from({ length: 7 }, (_, i) => i + 1).map((day) => {
                      const filled = day < dayInCycle || (day === dayInCycle && claimedToday);
                      const isToday = day === dayInCycle && !claimedToday;
                      return (
                        <View
                          key={day}
                          style={[
                            styles.dailyDot,
                            filled && styles.dailyDotFilled,
                            isToday && styles.dailyDotToday,
                          ]}
                        />
                      );
                    })}
                  </View>
                </View>
                <TouchableOpacity
                  style={[styles.dailyBtn, claimedToday && styles.dailyBtnDone]}
                  onPress={claimDailyReward}
                  disabled={claimedToday || claimingDaily}
                >
                  {claimingDaily ? (
                    <ActivityIndicator size="small" color="#F59E0B" />
                  ) : (
                    <Text style={styles.dailyBtnText}>
                      {claimedToday ? t("dashboard.dailyRewardClaimedLabel") : t("dashboard.dailyRewardClaimBtn")}
                    </Text>
                  )}
                </TouchableOpacity>
              </View>
            );
          })()}

          {/* ── TIME PRINCIPAL ───────────────────────────────── */}
          <View style={styles.card}>
            {/* Section header */}
            <View style={styles.sectionRow}>
              <Text style={styles.sectionEyebrow}>{t("dashboard.mainTeam")}</Text>
              <TouchableOpacity onPress={() => router.push("/dashboard/manage_team")}>
                <Text style={styles.sectionAction}>{t("dashboard.manage")}</Text>
              </TouchableOpacity>
            </View>

            {/* Team name + avg rating */}
            <View style={styles.teamMeta}>
              <Text style={styles.teamName}>{team?.name?.toUpperCase() ?? "MEU TIME"}</Text>
              <View style={styles.avgBadge}>
                <Text style={styles.avgBadgeText}>{avgRating} AVG</Text>
              </View>
            </View>

            {loadingPlayers ? (
              <View style={styles.centered}>
                <ActivityIndicator size="small" color={C.emerald} />
              </View>
            ) : players.length === 0 ? (
              <View style={styles.centered}>
                <Text style={styles.emptyText}>{t("dashboard.noPlayers")}</Text>
              </View>
            ) : (
              players.map((p, i) => (
                <View key={p.id} style={[styles.playerRow, i < players.length - 1 && styles.playerRowBorder]}>
                  <View style={styles.playerAvatar}>
                    <Text style={styles.playerAvatarText}>{p.name[0]}</Text>
                  </View>
                  <View style={styles.playerInfo}>
                    <Text style={styles.playerName}>{p.name}</Text>
                    <Text style={styles.playerRole}>{p.role}</Text>
                  </View>
                  <View style={[styles.statusPill, { borderColor: STATUS_COLOR[p.status] + "88" }]}>
                    <View style={[styles.statusDot, { backgroundColor: STATUS_COLOR[p.status] }]} />
                    <Text style={[styles.statusText, { color: STATUS_COLOR[p.status] }]}>
                      {t(STATUS_LABEL_KEY[p.status])}
                    </Text>
                  </View>
                  <View style={[styles.ratingBadge, { backgroundColor: getRatingColor(p.rating) + "22" }]}>
                    <Text style={[styles.ratingText, { color: getRatingColor(p.rating) }]}>{p.rating}</Text>
                  </View>
                </View>
              ))
            )}
          </View>

          {/* ── AÇÕES RÁPIDAS ────────────────────────────────── */}
          <View>
            <Text style={styles.sectionEyebrow}>{t("dashboard.quickActions")}</Text>
            <View style={styles.actionsGrid}>
              {[
                { icon: "🎯", label: t("dashboard.actionTrain"),   sub: t("dashboard.actionTrainSub"),   route: "/dashboard/training", accent: C.emerald, flagKey: "training" },
                { icon: "🏪", label: t("dashboard.actionMarket"),  sub: t("dashboard.actionMarketSub"),  route: "/dashboard/market",   accent: C.info },
                { icon: "📋", label: t("dashboard.actionTactics"), sub: t("dashboard.actionTacticsSub"), route: "/dashboard/tactics",  accent: C.warning, flagKey: "tactics" },
                { icon: "🎮", label: t("dashboard.actionMatches"), sub: t("dashboard.actionMatchesSub"), route: "/dashboard/matches",  accent: C.pink },
                { icon: "🏆", label: t("dashboard.actionAchievements"), sub: t("dashboard.actionAchievementsSub"), route: "/dashboard/achievements", accent: C.warning },
                { icon: "💬", label: t("dashboard.actionChat"), sub: t("dashboard.actionChatSub"), route: "/dashboard/chat", accent: C.info, flagKey: "chat" },
                { icon: "📊", label: t("dashboard.actionRanking"), sub: t("dashboard.actionRankingSub"), route: "/dashboard/ranking", accent: C.pink },
                { icon: "✉️", label: t("dashboard.actionMessages"), sub: t("dashboard.actionMessagesSub"), route: "/dashboard/messages", accent: C.emerald },
                { icon: "🛡️", label: t("dashboard.actionGuild"), sub: t("dashboard.actionGuildSub"), route: "/dashboard/guild", accent: C.info, flagKey: "guild" },
              ]
                .filter((a) => !a.flagKey || isEnabled(a.flagKey))
                .map((a, i) => (
                <TouchableOpacity
                  key={i}
                  style={[styles.actionCard, { borderColor: a.accent + "44" }]}
                  activeOpacity={0.75}
                  onPress={() => router.push(a.route as any)}
                >
                  <View style={[styles.actionIconWrap, { backgroundColor: a.accent + "18" }]}>
                    <Text style={styles.actionIcon}>{a.icon}</Text>
                  </View>
                  <Text style={[styles.actionLabel, { color: a.accent }]}>{a.label}</Text>
                  <Text style={styles.actionSub}>{a.sub}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* ── PERFORMANCE ──────────────────────────────────── */}
          <View style={styles.card}>
            <View style={styles.sectionRow}>
              <Text style={styles.sectionEyebrow}>{t("dashboard.performance")}</Text>
            </View>
            {[
              { label: t("dashboard.morale"), value: avgMorale, color: C.emerald },
              { label: t("dashboard.form"),   value: avgForm,   color: C.info },
              { label: t("dashboard.energy"), value: avgEnergy, color: C.warning },
            ].map((m, i, arr) => (
              <View key={i} style={[styles.perfRow, i < arr.length - 1 && styles.perfRowBorder]}>
                <Text style={styles.perfLabel}>{m.label}</Text>
                <View style={styles.perfBarTrack}>
                  <View style={[styles.perfBar, { width: `${m.value}%` as any, backgroundColor: m.color }]} />
                </View>
                <Text style={[styles.perfValue, { color: m.color }]}>{m.value}</Text>
              </View>
            ))}
          </View>

        </View>

        <View style={{ height: 32 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: C.bg,
  },
  container: {
    flex: 1,
    backgroundColor: C.bg,
  },
  content: {
    paddingHorizontal: 16,        // --gutter
    gap: 18,
    paddingTop: 4,
  },

  // Top header
  topHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 18,
    paddingVertical: 16,
  },
  topHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  logoDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: C.emerald,
  },
  logoText: {
    fontSize: 18,
    fontWeight: "900",
    color: C.textPrimary,
    letterSpacing: 5,
  },
  topHeaderRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: C.surfaceControl,
    borderWidth: 1,
    borderColor: C.borderStrong,
    justifyContent: "center",
    alignItems: "center",
  },
  storeBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#161000",
    borderWidth: 1,
    borderColor: "#F59E0B44",
    paddingHorizontal: 10,
  },
  storeBtnIcon: { fontSize: 12 },
  storeBtnText: { fontSize: 12, fontWeight: "900", color: "#F59E0B" },
  iconBtnText: {
    fontSize: 16,
  },
  iconBadge: {
    position: "absolute",
    top: -2,
    right: -2,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: C.danger,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 3,
  },
  iconBadgeText: {
    fontSize: 9,
    fontWeight: "800",
    color: "#FFF",
  },
  avatarBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: C.emerald,
    justifyContent: "center",
    alignItems: "center",
  },
  avatarBtnText: {
    fontSize: 12,
    fontWeight: "800",
    color: "#000",
  },

  // Notification sheet
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.7)",
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: C.surfaceDeep,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderTopWidth: 1,
    borderColor: C.borderDefault,
    paddingHorizontal: 20,
    paddingTop: 12,
    maxHeight: "80%",
  },
  sheetHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#2A2A2A",
    alignSelf: "center",
    marginBottom: 16,
  },
  sheetHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  sheetTitle: {
    fontSize: 13,
    fontWeight: "800",
    color: C.textPrimary,
    letterSpacing: 3,
  },
  sheetClose: {
    fontSize: 16,
    color: C.textMuted,
    padding: 4,
  },
  notifEmpty: {
    alignItems: "center",
    paddingVertical: 40,
    gap: 10,
  },
  notifEmptyIcon: {
    fontSize: 32,
  },
  notifEmptyText: {
    color: C.textFaint,
    fontSize: 14,
  },
  notifItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    borderRadius: 10,
    borderWidth: 1,
    padding: 14,
    marginBottom: 8,
    gap: 10,
  },
  notifDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    marginTop: 4,
    flexShrink: 0,
  },
  notifBody: {
    flex: 1,
    gap: 6,
  },
  notifTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  notifTag: {
    borderRadius: 4,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  notifTagText: {
    fontSize: 9,
    fontWeight: "800",
    color: "#000",
    letterSpacing: 0.5,
  },
  notifDate: {
    fontSize: 10,
    color: C.textFaint,
  },
  notifMsg: {
    color: "#D1D5DB",
    fontSize: 13,
  },

  // Hero
  heroCard: {
    borderRadius: 20,             // --radius-3xl
    padding: 20,
    borderWidth: 1,
    borderColor: "#1A3D2A",
  },
  heroBorderGlow: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(16,185,129,0.18)",
  },
  heroBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 14,
  },
  heroBadgeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: C.emerald,
  },
  heroBadgeText: {
    fontSize: 10,
    fontWeight: "800",
    color: C.emerald400,
    letterSpacing: 2.5,
  },
  heroTitle: {
    fontSize: 26,
    fontWeight: "900",
    color: C.textPrimary,
    letterSpacing: 0.5,
    lineHeight: 30,
  },
  heroOpponent: {
    fontSize: 14,
    fontWeight: "500",
    color: C.textSecondary,
    marginTop: 4,
    marginBottom: 18,
  },
  countdown: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 8,
    marginBottom: 20,
  },
  countdownSep: {
    fontSize: 22,
    fontWeight: "900",
    color: C.textGhost,
    marginBottom: 14,
  },
  countdownBox: {
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.3)",
    borderWidth: 1,
    borderColor: C.borderStrong,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    minWidth: 52,
  },
  countdownNum: {
    fontSize: 22,
    fontWeight: "900",
    color: C.textPrimary,
    letterSpacing: 1,
  },
  countdownLbl: {
    fontSize: 8,
    fontWeight: "700",
    color: C.textMuted,
    letterSpacing: 1.5,
    marginTop: 2,
  },
  heroLink: {
    fontSize: 12,
    fontWeight: "900",
    color: C.emerald400,
    letterSpacing: 1.5,
  },
  heroEmpty: {
    gap: 14,
    paddingVertical: 8,
  },
  heroEmptyText: {
    fontSize: 14,
    color: C.textMuted,
  },

  // KPI grid 2×2
  kpiGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  kpiCard: {
    width: (width - 42) / 2,     // 2 columns with 16px gutters + 10px gap
    backgroundColor: C.surfaceDeep,
    borderRadius: 16,            // --radius-2xl
    borderWidth: 1,
    borderColor: C.borderSubtle,
    padding: 14,
  },
  kpiValue: {
    fontSize: 24,                // --text-2xl, --font-mono weight
    fontWeight: "900",
    color: C.textPrimary,        // white per DS
    lineHeight: 26,
  },
  kpiLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: C.textSecondary,
    letterSpacing: 0.6,
    textTransform: "uppercase",
    marginTop: 6,
  },
  kpiSub: {
    fontSize: 10,
    fontWeight: "500",
    color: C.textFaint,
    marginTop: 2,
  },

  // Recompensa diária
  dailyCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "#161000",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#F59E0B33",
    padding: 14,
  },
  dailyTitle: {
    fontSize: 11,
    fontWeight: "800",
    color: C.warning,
    letterSpacing: 1,
    marginBottom: 8,
  },
  dailyDotsRow: {
    flexDirection: "row",
    gap: 6,
  },
  dailyDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#242424",
    borderWidth: 1,
    borderColor: "#333",
  },
  dailyDotFilled: {
    backgroundColor: C.warning,
    borderColor: C.warning,
  },
  dailyDotToday: {
    borderColor: C.warning,
    borderWidth: 2,
  },
  dailyBtn: {
    height: 40,
    paddingHorizontal: 16,
    borderRadius: 10,
    backgroundColor: "#F59E0B22",
    borderWidth: 1,
    borderColor: "#F59E0B66",
    justifyContent: "center",
    alignItems: "center",
    minWidth: 100,
  },
  dailyBtnDone: {
    backgroundColor: "#161616",
    borderColor: "#242424",
  },
  dailyBtnText: {
    fontSize: 10,
    fontWeight: "800",
    color: C.warning,
    letterSpacing: 0.5,
    textAlign: "center",
  },

  // Card
  card: {
    backgroundColor: C.surfaceDeep,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: C.borderSubtle,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },

  // Section header
  sectionRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  sectionEyebrow: {
    fontSize: 11,
    fontWeight: "800",
    color: C.textMuted,
    letterSpacing: 3,
    textTransform: "uppercase",
  },
  sectionAction: {
    fontSize: 12,
    fontWeight: "600",
    color: C.emerald,
  },

  // Team meta
  teamMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 12,
  },
  teamName: {
    fontSize: 16,
    fontWeight: "900",
    color: C.textPrimary,
    letterSpacing: 0.5,
  },
  avgBadge: {
    backgroundColor: C.emeraldTint12,
    borderWidth: 1,
    borderColor: C.emeraldTint30,
    borderRadius: 20,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  avgBadgeText: {
    fontSize: 10,
    fontWeight: "700",
    color: C.emerald400,
  },

  // Players
  playerRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    gap: 10,
  },
  playerRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: C.borderSubtle,
  },
  playerAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: C.surfaceControl,
    borderWidth: 1,
    borderColor: C.borderStrong,
    justifyContent: "center",
    alignItems: "center",
  },
  playerAvatarText: {
    fontSize: 13,
    fontWeight: "700",
    color: C.textSecondary,
  },
  playerInfo: {
    flex: 1,
  },
  playerName: {
    fontSize: 13,
    fontWeight: "600",
    color: C.textPrimary,
  },
  playerRole: {
    fontSize: 11,
    color: C.textMuted,
    marginTop: 1,
  },
  statusPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  statusDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
  },
  statusText: {
    fontSize: 9,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  ratingBadge: {
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  ratingText: {
    fontSize: 13,
    fontWeight: "800",
  },

  centered: {
    paddingVertical: 20,
    alignItems: "center",
  },
  emptyText: {
    color: C.textFaint,
    fontSize: 13,
  },

  // Quick actions
  actionsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginTop: 12,
  },
  actionCard: {
    width: (width - 42) / 2,
    backgroundColor: C.surfaceDeep,
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
  },
  actionIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 10,
  },
  actionIcon: {
    fontSize: 20,
  },
  actionLabel: {
    fontSize: 13,
    fontWeight: "900",
    letterSpacing: 0.8,
    marginBottom: 3,
  },
  actionSub: {
    fontSize: 11,
    color: C.textFaint,
  },

  // Performance
  perfRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 13,
    gap: 12,
  },
  perfRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: C.borderSubtle,
  },
  perfLabel: {
    width: 90,
    fontSize: 13,
    fontWeight: "500",
    color: C.textSecondary,
  },
  perfBarTrack: {
    flex: 1,
    height: 4,
    backgroundColor: C.borderSubtle,
    borderRadius: 2,
    overflow: "hidden",
  },
  perfBar: {
    height: 4,
    borderRadius: 2,
  },
  perfValue: {
    width: 28,
    fontSize: 13,
    fontWeight: "800",
    textAlign: "right",
  },
});
