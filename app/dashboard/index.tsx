import { supabase } from "@/database/supabase";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import React, { useEffect, useState } from "react";
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
}

interface Notification {
  id: string;
  type: "alert" | "info" | "success";
  tag: string;
  message: string;
  read: boolean;
  created_at: string;
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

const STATUS_COLOR: Record<string, string> = {
  online:  C.emerald,
  injured: C.danger,
  banned:  C.warning,
};

const STATUS_LABEL: Record<string, string> = {
  online:  "ONLINE",
  injured: "LESÃO",
  banned:  "BANIDO",
};

const NOTIF_STYLE: Record<string, { tag: string; border: string; bg: string }> = {
  alert:   { tag: C.danger,   border: "rgba(239,68,68,0.25)",   bg: "rgba(239,68,68,0.06)" },
  info:    { tag: C.warning,  border: "rgba(245,158,11,0.25)",  bg: "rgba(245,158,11,0.06)" },
  success: { tag: C.emerald,  border: "rgba(16,185,129,0.25)",  bg: "rgba(16,185,129,0.06)" },
};

function getRatingColor(r: number) {
  if (r >= 90) return C.emerald;
  if (r >= 75) return C.warning;
  return C.danger;
}

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
  if (diff <= 0) return [{ v: 0, l: "DIAS" }, { v: 0, l: "HRS" }, { v: 0, l: "MIN" }];
  const days = Math.floor(diff / 86_400_000);
  const hrs  = Math.floor((diff % 86_400_000) / 3_600_000);
  const mins = Math.floor((diff % 3_600_000) / 60_000);
  return [{ v: days, l: "DIAS" }, { v: hrs, l: "HRS" }, { v: mins, l: "MIN" }];
}

// ── Screen ────────────────────────────────────────────────────────────────────

export default function HomeScreen() {
  const [players, setPlayers] = useState<Player[]>([]);
  const [loadingPlayers, setLoadingPlayers] = useState(true);
  const [team, setTeam] = useState<Team | null>(null);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [notifOpen, setNotifOpen] = useState(false);
  const [nextMatch, setNextMatch] = useState<NextMatch | null>(null);
  const [, setTick] = useState(0);

  const unreadCount = notifications.filter((n) => !n.read).length;

  useEffect(() => {
    supabase
      .from("teams")
      .select("id, name, budget, ranking, fans, wins, losses, pdl")
      .single()
      .then(({ data, error }) => {
        if (!error && data) {
          const d = data as any;
          setTeam({ ...d, pdl: d.pdl ?? 0 } as Team);
          supabase
            .from("players")
            .select("id, name, role, status, rating")
            .eq("team_id", data.id)
            .then(({ data: pd, error: pe }) => {
              if (!pe && pd) setPlayers(pd as Player[]);
              setLoadingPlayers(false);
            });
        } else {
          setLoadingPlayers(false);
        }
      });

    supabase
      .from("notifications")
      .select("id, type, tag, message, read, created_at")
      .order("created_at", { ascending: false })
      .then(({ data, error }) => {
        if (!error && data) setNotifications(data as Notification[]);
      });

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

    const timer = setInterval(() => setTick((t) => t + 1), 60_000);
    return () => clearInterval(timer);
  }, []);

  const openNotifications = async () => {
    setNotifOpen(true);
    const unreadIds = notifications.filter((n) => !n.read).map((n) => n.id);
    if (unreadIds.length === 0) return;
    await supabase.from("notifications").update({ read: true }).in("id", unreadIds);
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  const avgRating = players.length
    ? (players.reduce((s, p) => s + p.rating, 0) / players.length).toFixed(1)
    : "—";

  const teamPdl  = team?.pdl ?? 0;
  const tierInfo = getDashTierInfo(teamPdl);

  const kpis = [
    { value: team ? fmtBudget(team.budget) : "—",                                  label: "Orçamento", sub: "disponível" },
    { value: team ? `${teamPdl}` : "—",                                             label: "PDL",       sub: tierInfo.label, subColor: tierInfo.color },
    { value: team ? (team.fans >= 1000 ? `${(team.fans / 1000).toFixed(1)}K` : String(team.fans)) : "—", label: "Fãs", sub: "seguidores" },
    { value: team ? `${team.wins}-${team.losses}` : "—",                           label: "Recorde",   sub: `${team ? team.wins + team.losses : 0} partidas` },
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
                <Text style={styles.sheetTitle}>NOTIFICAÇÕES</Text>
                <TouchableOpacity onPress={() => setNotifOpen(false)}>
                  <Text style={styles.sheetClose}>✕</Text>
                </TouchableOpacity>
              </View>

              <ScrollView showsVerticalScrollIndicator={false}>
                {notifications.length === 0 ? (
                  <View style={styles.notifEmpty}>
                    <Text style={styles.notifEmptyIcon}>🔕</Text>
                    <Text style={styles.notifEmptyText}>Nenhuma notificação</Text>
                  </View>
                ) : (
                  notifications.map((n) => {
                    const s = NOTIF_STYLE[n.type];
                    const date = new Date(n.created_at).toLocaleDateString("pt-BR", {
                      day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit",
                    });
                    return (
                      <View
                        key={n.id}
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
                      </View>
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
              <Text style={styles.heroBadgeText}>PRÓXIMA PARTIDA</Text>
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
                        <Text style={styles.countdownLbl}>{item.l}</Text>
                      </View>
                    </React.Fragment>
                  ))}
                </View>

                <TouchableOpacity onPress={() => router.push("/dashboard/matches")}>
                  <Text style={styles.heroLink}>VER DETALHES  →</Text>
                </TouchableOpacity>
              </>
            ) : (
              <View style={styles.heroEmpty}>
                <Text style={styles.heroEmptyText}>Nenhuma partida agendada</Text>
                <TouchableOpacity onPress={() => router.push("/dashboard/matches")}>
                  <Text style={styles.heroLink}>AGENDAR PARTIDA  →</Text>
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

          {/* ── TIME PRINCIPAL ───────────────────────────────── */}
          <View style={styles.card}>
            {/* Section header */}
            <View style={styles.sectionRow}>
              <Text style={styles.sectionEyebrow}>TIME PRINCIPAL</Text>
              <TouchableOpacity onPress={() => router.push("/dashboard/manage_team")}>
                <Text style={styles.sectionAction}>gerenciar</Text>
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
                <Text style={styles.emptyText}>Nenhum jogador ainda</Text>
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
                      {STATUS_LABEL[p.status]}
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
            <Text style={styles.sectionEyebrow}>AÇÕES RÁPIDAS</Text>
            <View style={styles.actionsGrid}>
              {[
                { icon: "🎯", label: "TREINAR",  sub: "Melhorar skills",     route: "/dashboard/training", accent: C.emerald },
                { icon: "🏪", label: "MERCADO",  sub: "Contratar jogadores", route: "/dashboard/market",   accent: C.info },
                { icon: "📋", label: "TÁTICAS",  sub: "Estratégias do time", route: "/dashboard/tactics",  accent: C.warning },
                { icon: "🎮", label: "PARTIDAS", sub: "Ver calendário",      route: "/dashboard/matches",  accent: C.pink },
              ].map((a, i) => (
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
              <Text style={styles.sectionEyebrow}>PERFORMANCE</Text>
            </View>
            {[
              { label: "Moral",       value: 85, color: C.emerald },
              { label: "Forma",       value: 92, color: C.info },
              { label: "Hype",        value: 78, color: C.warning },
              { label: "Comunicação", value: 70, color: C.pink },
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
