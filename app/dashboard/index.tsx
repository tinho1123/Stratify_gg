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

interface Player {
  id: string;
  name: string;
  role: string;
  status: "online" | "offline" | "injured" | "banned";
  rating: number;
}

interface Team {
  name: string;
  budget: number;
  ranking: number;
  fans: number;
  wins: number;
  losses: number;
}

interface Notification {
  id: string;
  type: "alert" | "info" | "success";
  tag: string;
  message: string;
  read: boolean;
  created_at: string;
}

const STATUS_COLOR: Record<string, string> = {
  online: "#10B981",
  offline: "#6B7280",
  injured: "#EF4444",
  banned: "#F59E0B",
};

const STATUS_LABEL: Record<string, string> = {
  online: "ONLINE",
  offline: "OFFLINE",
  injured: "LESÃO",
  banned: "BANIDO",
};

const NEWS_COLORS: Record<string, { tag: string; border: string; bg: string }> = {
  alert:   { tag: "#EF4444", border: "rgba(239,68,68,0.25)",   bg: "rgba(239,68,68,0.06)" },
  info:    { tag: "#F59E0B", border: "rgba(245,158,11,0.25)",  bg: "rgba(245,158,11,0.06)" },
  success: { tag: "#10B981", border: "rgba(16,185,129,0.25)",  bg: "rgba(16,185,129,0.06)" },
};

function getRatingColor(r: number) {
  if (r >= 90) return "#10B981";
  if (r >= 75) return "#F59E0B";
  return "#EF4444";
}

export default function HomeScreen() {
  const [players, setPlayers] = useState<Player[]>([]);
  const [loadingPlayers, setLoadingPlayers] = useState(true);
  const [team, setTeam] = useState<Team | null>(null);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [notifOpen, setNotifOpen] = useState(false);

  const unreadCount = notifications.filter((n) => !n.read).length;

  useEffect(() => {
    supabase
      .from("players")
      .select("id, name, role, status, rating")
      .then(({ data, error }) => {
        if (!error && data) setPlayers(data as Player[]);
        setLoadingPlayers(false);
      });

    supabase
      .from("teams")
      .select("name, budget, ranking, fans, wins, losses")
      .single()
      .then(({ data, error }) => {
        if (!error && data) setTeam(data as Team);
      });

    supabase
      .from("notifications")
      .select("id, type, tag, message, read, created_at")
      .order("created_at", { ascending: false })
      .then(({ data, error }) => {
        if (!error && data) setNotifications(data as Notification[]);
      });
  }, []);

  const openNotifications = async () => {
    setNotifOpen(true);
    const unreadIds = notifications.filter((n) => !n.read).map((n) => n.id);
    if (unreadIds.length === 0) return;
    await supabase
      .from("notifications")
      .update({ read: true })
      .in("id", unreadIds);
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  const avgRating = players.length
    ? (players.reduce((s, p) => s + p.rating, 0) / players.length).toFixed(1)
    : "—";

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>

        {/* ── TOP HEADER ─────────────────────────────────── */}
        <View style={styles.topHeader}>
          <View style={styles.topHeaderLeft}>
            <View style={styles.logoDot} />
            <Text style={styles.logoText}>STRATIFY</Text>
          </View>
          <View style={styles.topHeaderRight}>
            <TouchableOpacity style={styles.bellBtn} onPress={openNotifications}>
              <Text style={styles.bellIcon}>🔔</Text>
              {unreadCount > 0 && (
                <View style={styles.bellBadge}>
                  <Text style={styles.bellBadgeText}>
                    {unreadCount > 9 ? "9+" : unreadCount}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.profileBtn}
              onPress={() => router.push("/dashboard/profile")}
            >
              <Text style={styles.profileBtnText}>GS</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* ── MODAL DE NOTIFICAÇÕES ───────────────────────── */}
        <Modal
          visible={notifOpen}
          transparent
          animationType="slide"
          onRequestClose={() => setNotifOpen(false)}
        >
          <Pressable style={styles.modalOverlay} onPress={() => setNotifOpen(false)}>
            <Pressable style={styles.modalSheet} onPress={() => {}}>
              <View style={styles.modalHandle} />
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>NOTIFICAÇÕES</Text>
                <TouchableOpacity onPress={() => setNotifOpen(false)}>
                  <Text style={styles.modalClose}>✕</Text>
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
                    const c = NEWS_COLORS[n.type];
                    const date = new Date(n.created_at).toLocaleDateString("pt-BR", {
                      day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit",
                    });
                    return (
                      <View
                        key={n.id}
                        style={[
                          styles.notifItem,
                          { borderColor: c.border, backgroundColor: n.read ? "#0D0D0D" : c.bg },
                        ]}
                      >
                        {!n.read && <View style={[styles.notifUnreadDot, { backgroundColor: c.tag }]} />}
                        <View style={styles.notifBody}>
                          <View style={styles.notifTopRow}>
                            <View style={[styles.newsTag, { backgroundColor: c.tag }]}>
                              <Text style={styles.newsTagText}>{n.tag}</Text>
                            </View>
                            <Text style={styles.notifDate}>{date}</Text>
                          </View>
                          <Text style={[styles.newsMsg, n.read && { color: "#6B7280" }]}>
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

        {/* ── HERO - PRÓXIMA PARTIDA ──────────────────────── */}
        <View style={styles.heroWrapper}>
          <LinearGradient
            colors={["#0D1F16", "#111"]}
            style={styles.heroCard}
          >
            <View style={styles.heroBadge}>
              <View style={styles.heroBadgeDot} />
              <Text style={styles.heroBadgeText}>PRÓXIMA PARTIDA</Text>
            </View>

            <Text style={styles.heroTitle}>FINAL DO TORNEIO</Text>
            <Text style={styles.heroOpponent}>vs. Team Liquid</Text>

            <View style={styles.countdown}>
              {[{ v: 2, l: "DIAS" }, { v: 14, l: "HRS" }, { v: 32, l: "MIN" }].map((item, i) => (
                <React.Fragment key={i}>
                  {i > 0 && <Text style={styles.countdownSep}>:</Text>}
                  <View style={styles.countdownBox}>
                    <Text style={styles.countdownNum}>{String(item.v).padStart(2, "0")}</Text>
                    <Text style={styles.countdownLbl}>{item.l}</Text>
                  </View>
                </React.Fragment>
              ))}
            </View>

            <TouchableOpacity style={styles.heroBtn}>
              <Text style={styles.heroBtnText}>VER DETALHES  →</Text>
            </TouchableOpacity>
          </LinearGradient>
          {/* Glow border */}
          <View style={styles.heroGlowBorder} />
        </View>

        {/* ── KPI ROW ────────────────────────────────────── */}
        <View style={styles.kpiRow}>
          {[
            {
              value: team ? `$${(team.budget / 1000).toFixed(0)}K` : "—",
              label: "Orçamento",
              sub: "disponível",
            },
            {
              value: team ? (team.ranking != null ? `#${team.ranking}` : "—") : "—",
              label: "Ranking",
              sub: team?.ranking != null ? "global" : "sem ranking",
            },
            {
              value: team ? team.fans >= 1000 ? `${(team.fans / 1000).toFixed(1)}K` : String(team.fans) : "—",
              label: "Fãs",
              sub: "seguidores",
            },
            {
              value: team ? `${team.wins}-${team.losses}` : "—",
              label: "Recorde",
              sub: `${team ? team.wins + team.losses : 0} partidas`,
            },
          ].map((kpi, i) => (
            <View key={i} style={styles.kpiCard}>
              <Text style={styles.kpiValue}>{kpi.value}</Text>
              <Text style={styles.kpiLabel}>{kpi.label}</Text>
              <Text style={styles.kpiSub}>{kpi.sub}</Text>
            </View>
          ))}
        </View>

        {/* ── ALERTAS (últimas 3 notificações) ────────────── */}
        <View style={styles.section}>
          <View style={styles.sectionRow}>
            <Text style={styles.sectionTitle}>ALERTAS</Text>
            <TouchableOpacity onPress={openNotifications}>
              <Text style={styles.sectionLink}>ver todos</Text>
            </TouchableOpacity>
          </View>

          {notifications.length === 0 ? (
            <View style={styles.playersEmpty}>
              <Text style={styles.playersEmptyText}>Nenhum alerta</Text>
            </View>
          ) : (
            notifications.slice(0, 3).map((item) => {
              const c = NEWS_COLORS[item.type];
              return (
                <TouchableOpacity
                  key={item.id}
                  activeOpacity={0.75}
                  onPress={openNotifications}
                  style={[styles.newsCard, { borderColor: c.border, backgroundColor: c.bg }]}
                >
                  <View style={[styles.newsTag, { backgroundColor: c.tag }]}>
                    <Text style={styles.newsTagText}>{item.tag}</Text>
                  </View>
                  <Text style={styles.newsMsg}>{item.message}</Text>
                  <Text style={styles.newsChevron}>›</Text>
                </TouchableOpacity>
              );
            })
          )}
        </View>

        {/* ── TIME PRINCIPAL ─────────────────────────────── */}
        <View style={styles.section}>
          <View style={styles.sectionRow}>
            <Text style={styles.sectionTitle}>TIME PRINCIPAL</Text>
            <TouchableOpacity onPress={() => router.push("/dashboard/manage_team")}>
              <Text style={styles.sectionLink}>gerenciar</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.teamCard}>
            <View style={styles.teamMeta}>
              <Text style={styles.teamName}>{team?.name.toUpperCase() ?? "MEU TIME"}</Text>
              <View style={styles.teamRatingBadge}>
                <Text style={styles.teamRatingText}>{avgRating} AVG</Text>
              </View>
            </View>

            {loadingPlayers ? (
              <View style={styles.playersLoading}>
                <ActivityIndicator size="small" color="#10B981" />
              </View>
            ) : players.length === 0 ? (
              <View style={styles.playersEmpty}>
                <Text style={styles.playersEmptyText}>Nenhum jogador ainda</Text>
              </View>
            ) : (
              players.map((p) => (
                <View key={p.id} style={styles.playerRow}>
                  <View style={styles.playerAvatar}>
                    <Text style={styles.playerAvatarText}>{p.name[0]}</Text>
                  </View>
                  <View style={styles.playerInfo}>
                    <Text style={styles.playerName}>{p.name}</Text>
                    <Text style={styles.playerRole}>{p.role}</Text>
                  </View>
                  <View style={[styles.statusPill, { borderColor: STATUS_COLOR[p.status] }]}>
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
        </View>

        {/* ── AÇÕES RÁPIDAS ──────────────────────────────── */}
        <View style={styles.section}>
          <View style={styles.sectionRow}>
            <Text style={styles.sectionTitle}>AÇÕES RÁPIDAS</Text>
          </View>

          <View style={styles.actionsGrid}>
            {[
              { icon: "🎯", label: "TREINAR",  sub: "Melhorar skills",     route: "/dashboard/training",    accent: "#10B981" },
              { icon: "🏪", label: "MERCADO",  sub: "Contratar jogadores",  route: "/dashboard/market",      accent: "#6366F1" },
              { icon: "📋", label: "TÁTICAS",  sub: "Estratégias do time",  route: null,                     accent: "#F59E0B" },
              { icon: "🎮", label: "PARTIDAS", sub: "Ver calendário",       route: null,                     accent: "#EC4899" },
            ].map((a, i) => (
              <TouchableOpacity
                key={i}
                style={[styles.actionCard, { borderColor: a.accent + "33" }]}
                activeOpacity={0.75}
                onPress={() => a.route && router.push(a.route as any)}
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

        {/* ── PERFORMANCE ────────────────────────────────── */}
        <View style={styles.section}>
          <View style={styles.sectionRow}>
            <Text style={styles.sectionTitle}>PERFORMANCE</Text>
          </View>

          <View style={styles.perfCard}>
            {[
              { label: "Moral",       value: 85, color: "#10B981" },
              { label: "Forma",       value: 92, color: "#6366F1" },
              { label: "Hype",        value: 78, color: "#F59E0B" },
              { label: "Comunicação", value: 70, color: "#EC4899" },
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

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: "#080808",
  },
  container: {
    flex: 1,
    backgroundColor: "#080808",
  },

  // Top Header
  topHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 14,
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
    backgroundColor: "#10B981",
  },
  logoText: {
    fontSize: 18,
    fontWeight: "900",
    color: "#FFFFFF",
    letterSpacing: 5,
  },
  topHeaderRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  bellBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#161616",
    borderWidth: 1,
    borderColor: "#242424",
    justifyContent: "center",
    alignItems: "center",
  },
  bellIcon: {
    fontSize: 16,
  },
  bellBadge: {
    position: "absolute",
    top: -2,
    right: -2,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: "#EF4444",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 3,
  },
  bellBadgeText: {
    fontSize: 9,
    fontWeight: "800",
    color: "#FFF",
  },
  profileBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#10B981",
    justifyContent: "center",
    alignItems: "center",
  },
  profileBtnText: {
    fontSize: 12,
    fontWeight: "800",
    color: "#000",
  },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "flex-end",
  },
  modalSheet: {
    backgroundColor: "#0D0D0D",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderWidth: 1,
    borderColor: "#1A1A1A",
    paddingHorizontal: 20,
    paddingTop: 12,
    maxHeight: "80%",
  },
  modalHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#2A2A2A",
    alignSelf: "center",
    marginBottom: 16,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 13,
    fontWeight: "800",
    color: "#FFFFFF",
    letterSpacing: 3,
  },
  modalClose: {
    fontSize: 16,
    color: "#6B7280",
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
    color: "#4B5563",
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
  notifUnreadDot: {
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
  notifDate: {
    fontSize: 10,
    color: "#4B5563",
  },

  // Hero
  heroWrapper: {
    marginHorizontal: 16,
    marginBottom: 4,
  },
  heroCard: {
    borderRadius: 16,
    padding: 24,
    borderWidth: 1,
    borderColor: "#1A3D2A",
  },
  heroGlowBorder: {
    position: "absolute",
    inset: 0,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#10B98130",
    pointerEvents: "none",
  },
  heroBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 10,
  },
  heroBadgeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#10B981",
  },
  heroBadgeText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#10B981",
    letterSpacing: 2,
  },
  heroTitle: {
    fontSize: 26,
    fontWeight: "900",
    color: "#FFFFFF",
    letterSpacing: 1,
  },
  heroOpponent: {
    fontSize: 15,
    color: "#9CA3AF",
    marginTop: 2,
    marginBottom: 20,
  },
  countdown: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 20,
  },
  countdownSep: {
    fontSize: 20,
    color: "#374151",
    fontWeight: "700",
  },
  countdownBox: {
    alignItems: "center",
    backgroundColor: "#0A0A0A",
    borderWidth: 1,
    borderColor: "#1F1F1F",
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
    minWidth: 56,
  },
  countdownNum: {
    fontSize: 26,
    fontWeight: "900",
    color: "#FFFFFF",
    letterSpacing: 1,
  },
  countdownLbl: {
    fontSize: 9,
    color: "#6B7280",
    letterSpacing: 1,
    marginTop: 2,
  },
  heroBtn: {
    alignSelf: "flex-start",
    backgroundColor: "#10B981",
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
  },
  heroBtnText: {
    color: "#000",
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 1,
  },

  // KPI Row
  kpiRow: {
    flexDirection: "row",
    paddingHorizontal: 16,
    paddingVertical: 16,
    gap: 8,
  },
  kpiCard: {
    flex: 1,
    backgroundColor: "#111",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#1E1E1E",
    padding: 10,
    alignItems: "center",
  },
  kpiValue: {
    fontSize: 16,
    fontWeight: "900",
    color: "#10B981",
  },
  kpiLabel: {
    fontSize: 10,
    color: "#9CA3AF",
    marginTop: 2,
  },
  kpiSub: {
    fontSize: 9,
    color: "#4B5563",
    marginTop: 2,
  },

  // Sections
  section: {
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  sectionRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
    paddingVertical: 4,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: "800",
    color: "#6B7280",
    letterSpacing: 3,
  },
  sectionLink: {
    fontSize: 12,
    color: "#10B981",
    fontWeight: "600",
  },

  // News
  newsCard: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 10,
    borderWidth: 1,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginBottom: 8,
    gap: 10,
  },
  newsTag: {
    borderRadius: 4,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  newsTagText: {
    fontSize: 9,
    fontWeight: "800",
    color: "#000",
    letterSpacing: 0.5,
  },
  newsMsg: {
    flex: 1,
    color: "#D1D5DB",
    fontSize: 13,
  },
  newsChevron: {
    fontSize: 20,
    color: "#374151",
  },

  // Team
  teamCard: {
    backgroundColor: "#0D0D0D",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#1A1A1A",
    overflow: "hidden",
  },
  teamMeta: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#1A1A1A",
  },
  teamName: {
    fontSize: 14,
    fontWeight: "800",
    color: "#FFFFFF",
    letterSpacing: 1,
  },
  teamRatingBadge: {
    backgroundColor: "#10B98120",
    borderWidth: 1,
    borderColor: "#10B98140",
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  teamRatingText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#10B981",
  },
  playerRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#111",
    gap: 10,
  },
  playerAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#1A1A1A",
    borderWidth: 1,
    borderColor: "#2A2A2A",
    justifyContent: "center",
    alignItems: "center",
  },
  playerAvatarText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#9CA3AF",
  },
  playerInfo: {
    flex: 1,
  },
  playerName: {
    fontSize: 13,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  playerRole: {
    fontSize: 11,
    color: "#6B7280",
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
    width: 36,
    height: 28,
    borderRadius: 6,
    justifyContent: "center",
    alignItems: "center",
  },
  ratingText: {
    fontSize: 13,
    fontWeight: "800",
  },
  playersLoading: {
    paddingVertical: 24,
    alignItems: "center",
  },
  playersEmpty: {
    paddingVertical: 24,
    alignItems: "center",
  },
  playersEmptyText: {
    color: "#4B5563",
    fontSize: 13,
  },

  // Actions Grid
  actionsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  actionCard: {
    width: (width - 42) / 2,
    backgroundColor: "#0D0D0D",
    borderRadius: 14,
    borderWidth: 1,
    padding: 16,
    alignItems: "flex-start",
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
    fontSize: 22,
  },
  actionLabel: {
    fontSize: 13,
    fontWeight: "800",
    letterSpacing: 0.5,
    marginBottom: 3,
  },
  actionSub: {
    fontSize: 11,
    color: "#6B7280",
  },

  // Performance
  perfCard: {
    backgroundColor: "#0D0D0D",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#1A1A1A",
    paddingHorizontal: 16,
  },
  perfRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    gap: 12,
  },
  perfRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: "#111",
  },
  perfLabel: {
    width: 90,
    fontSize: 13,
    color: "#9CA3AF",
    fontWeight: "500",
  },
  perfBarTrack: {
    flex: 1,
    height: 4,
    backgroundColor: "#1A1A1A",
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
