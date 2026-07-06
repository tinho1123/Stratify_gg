import { useAppAlert } from "@/components/ui/AppAlert";
import { ScreenHeader } from "@/components/ui/ScreenHeader";
import { supabase } from "@/database/supabase";
import { useFeatureFlags } from "@/hooks/useFeatureFlags";
import { useLanguage } from "@/i18n/LanguageContext";
import { useFocusEffect } from "@react-navigation/native";
import { router, useLocalSearchParams } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
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

// ── Constants ─────────────────────────────────────────────────────────────────

interface Player {
  id: string;
  name: string;
  role: string;
  rating: number;
  status: "online" | "injured" | "banned";
  energy: number;
  training_type: string | null;
  training_ends_at: string | null;
}

interface TrainingType {
  id: string;
  nameKey: string;
  icon: string;
  descKey: string;
  energyCost: number;
  benefitKey: string;
  color: string;
}

const TRAINING_TYPES: TrainingType[] = [
  {
    id: "aim",
    nameKey: "training.type1Name",
    icon: "🎯",
    descKey: "training.type1Desc",
    energyCost: 20,
    benefitKey: "training.type1Benefit",
    color: "#EF4444",
  },
  {
    id: "strategy",
    nameKey: "training.type2Name",
    icon: "🧠",
    descKey: "training.type2Desc",
    energyCost: 15,
    benefitKey: "training.type2Benefit",
    color: "#3B82F6",
  },
  {
    id: "clutch",
    nameKey: "training.type3Name",
    icon: "⚡",
    descKey: "training.type3Desc",
    energyCost: 25,
    benefitKey: "training.type3Benefit",
    color: "#F59E0B",
  },
  {
    id: "spray",
    nameKey: "training.type4Name",
    icon: "🔫",
    descKey: "training.type4Desc",
    energyCost: 18,
    benefitKey: "training.type4Benefit",
    color: "#8B5CF6",
  },
  {
    id: "movement",
    nameKey: "training.type5Name",
    icon: "🏃",
    descKey: "training.type5Desc",
    energyCost: 20,
    benefitKey: "training.type5Benefit",
    color: "#10B981",
  },
  {
    id: "team_practice",
    nameKey: "training.type6Name",
    icon: "👥",
    descKey: "training.type6Desc",
    energyCost: 30,
    benefitKey: "training.type6Benefit",
    color: "#EC4899",
  },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function getRatingColor(r: number) {
  if (r >= 90) return "#10B981";
  if (r >= 75) return "#F59E0B";
  return "#EF4444";
}

function formatCountdown(ms: number): string {
  if (ms <= 0) return "00:00:00";
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  const s = Math.floor((ms % 60_000) / 1_000);
  return [h, m, s].map((v) => String(v).padStart(2, "0")).join(":");
}

// ── Screen ────────────────────────────────────────────────────────────────────

export default function TrainingScreen() {
  const { t } = useLanguage();
  const { isEnabled, loaded } = useFeatureFlags();

  useEffect(() => {
    if (loaded && !isEnabled("training")) router.replace("/dashboard");
  }, [loaded]);
  const { alert } = useAppAlert();
  const params = useLocalSearchParams<{ playerId?: string }>();
  const autoSelectedRef = useRef(false);
  const [players, setPlayers] = useState<Player[]>([]);
  const [loadingPlayers, setLoadingPlayers] = useState(true);

  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null);
  const [pendingTraining, setPendingTraining] = useState<TrainingType | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [starting, setStarting] = useState(false);

  const [, setTick] = useState(0);
  const claimedRef = useRef(false);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Fetch ──────────────────────────────────────────────────────────────────
  const fetchData = useCallback(async () => {
    setLoadingPlayers(true);
    // Aplica bônus de qualquer treino já concluído (e regenera energia) e libera quem já
    // cumpriu o prazo de lesão — antes de mostrar o elenco, senão a tela ficaria desatualizada.
    await Promise.all([
      supabase.rpc("claim_completed_training"),
      supabase.rpc("check_recovered_players"),
    ]);

    const { data: team } = await supabase.from("teams").select("id").single();
    if (!team) { setLoadingPlayers(false); return; }

    const { data, error } = await supabase
      .from("players")
      .select("id, name, role, rating, status, energy, training_type, training_ends_at")
      .eq("team_id", team.id);
    if (!error && data) setPlayers(data as Player[]);
    setLoadingPlayers(false);
  }, []);

  // Recarrega sempre que a tela ganha foco (cobre voltar de outra tela sem desmontar).
  useFocusEffect(useCallback(() => { claimedRef.current = false; fetchData(); }, [fetchData]));

  const session = players.find((p) => p.training_ends_at) ?? null;
  const remaining = session ? new Date(session.training_ends_at as string).getTime() - Date.now() : 0;

  // Veio de "TREINAR" no modal de um jogador (Gerenciar Time) — pré-seleciona ele aqui.
  useEffect(() => {
    if (autoSelectedRef.current || !params.playerId || players.length === 0) return;
    autoSelectedRef.current = true;
    const match = players.find((p) => p.id === params.playerId);
    if (match && match.status === "online" && !session) {
      setSelectedPlayer(match);
    }
  }, [params.playerId, players, session]);

  // ── Countdown tick ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!session) return;
    tickRef.current = setInterval(() => {
      const rem = new Date(session.training_ends_at as string).getTime() - Date.now();
      if (rem <= 0 && !claimedRef.current) {
        claimedRef.current = true;
        fetchData();
      } else {
        setTick((v) => v + 1);
      }
    }, 1000);
    return () => { if (tickRef.current) clearInterval(tickRef.current); };
  }, [session, fetchData]);

  // ── Actions ───────────────────────────────────────────────────────────────

  const handleTrainingPress = (tr: TrainingType) => {
    if (!selectedPlayer || session) return;
    if (selectedPlayer.energy < tr.energyCost) {
      alert(t("common.error"), t("training.errInsufficientEnergy"));
      return;
    }
    setPendingTraining(tr);
    setConfirmOpen(true);
  };

  const startTraining = async () => {
    if (!selectedPlayer || !pendingTraining) return;
    setStarting(true);
    const { error } = await supabase.rpc("start_training", {
      p_player_id:     selectedPlayer.id,
      p_training_type: pendingTraining.id,
    });
    setStarting(false);

    if (error) {
      const msg = error.message?.includes("team_already_training")
        ? t("training.errTeamTraining")
        : error.message?.includes("insufficient_energy")
        ? t("training.errInsufficientEnergy")
        : error.message?.includes("player_unavailable")
        ? t("training.errPlayerUnavailable")
        : t("training.errGeneric");
      alert(t("common.error"), msg);
      return;
    }

    setConfirmOpen(false);
    setSelectedPlayer(null);
    setPendingTraining(null);
    fetchData();
  };

  const cancelTraining = async (playerId: string) => {
    await supabase.rpc("cancel_training", { p_player_id: playerId });
    fetchData();
  };

  const isLocked = !!session;

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>

      <ScreenHeader title={t("training.headerTitle")} dotColor="#10B981" />

      <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>

        {/* ── SESSÃO ATIVA ─────────────────────────────── */}
        {session && (() => {
          const tr = TRAINING_TYPES.find((x) => x.id === session.training_type);
          const color = tr?.color ?? "#10B981";
          return (
            <View style={[styles.sessionBanner, { borderColor: color + "55" }]}>
              <View style={[styles.sessionIconWrap, { backgroundColor: color + "18" }]}>
                <Text style={styles.sessionIcon}>{tr?.icon ?? "🏋️"}</Text>
              </View>

              <View style={styles.sessionInfo}>
                <View style={styles.sessionTopRow}>
                  <View style={[styles.sessionDot, { backgroundColor: color }]} />
                  <Text style={[styles.sessionLabel, { color }]}>
                    {t("training.statusTraining")}
                  </Text>
                </View>
                <Text style={styles.sessionPlayer}>{session.name}</Text>
                <Text style={styles.sessionType}>{tr ? t(tr.nameKey) : ""}</Text>
              </View>

              <View style={styles.sessionTimer}>
                <Text style={styles.sessionTimerLabel}>{t("training.remaining")}</Text>
                <Text style={[styles.sessionTimerValue, { color }]}>
                  {formatCountdown(remaining)}
                </Text>
                <TouchableOpacity onPress={() => cancelTraining(session.id)} style={styles.cancelBtn}>
                  <Text style={styles.cancelBtnText}>{t("training.cancelLink")}</Text>
                </TouchableOpacity>
              </View>
            </View>
          );
        })()}

        {/* ── LOCK INFO ────────────────────────────────── */}
        {isLocked && (
          <View style={styles.lockInfo}>
            <Text style={styles.lockInfoText}>
              {t("training.lockInfo")}
            </Text>
          </View>
        )}

        {/* ── SELEÇÃO DE JOGADOR ──────────────────────── */}
        <View style={styles.section}>
          <View style={styles.sectionRow}>
            <Text style={styles.sectionTitle}>
              {isLocked ? t("training.playersTitle") : t("training.selectPlayerTitle")}
            </Text>
            {selectedPlayer && !isLocked && (
              <TouchableOpacity onPress={() => setSelectedPlayer(null)}>
                <Text style={styles.sectionLink}>{t("training.clearLink")}</Text>
              </TouchableOpacity>
            )}
          </View>

          {loadingPlayers ? (
            <View style={styles.centered}>
              <ActivityIndicator size="small" color="#10B981" />
            </View>
          ) : players.length === 0 ? (
            <View style={styles.centered}>
              <Text style={styles.emptyText}>{t("training.emptyTeam")}</Text>
            </View>
          ) : (
            <View style={styles.playersGrid}>
              {players.map((p) => {
                const isTraining = session?.id === p.id;
                const isInjured = p.status === "injured";
                const isSelected = selectedPlayer?.id === p.id;
                // Blocked: locked by another player's session, or injured
                const isBlocked = (isLocked && !isTraining) || isInjured;
                const tr = isTraining ? TRAINING_TYPES.find((x) => x.id === p.training_type) : undefined;
                const trainColor = tr?.color ?? "#10B981";

                return (
                  <TouchableOpacity
                    key={p.id}
                    activeOpacity={isBlocked ? 1 : 0.75}
                    disabled={isBlocked}
                    onPress={() => setSelectedPlayer(isSelected ? null : p)}
                    style={[
                      styles.playerCard,
                      isSelected && styles.playerCardSelected,
                      isTraining && { borderColor: trainColor, backgroundColor: trainColor + "0A" },
                      isBlocked && styles.playerCardBlocked,
                    ]}
                  >
                    {isSelected && !isTraining && (
                      <View style={styles.checkBadge}>
                        <Text style={styles.checkBadgeText}>✓</Text>
                      </View>
                    )}
                    {isTraining && (
                      <View style={[styles.checkBadge, { backgroundColor: trainColor }]}>
                        <Text style={styles.checkBadgeText}>▶</Text>
                      </View>
                    )}

                    <View style={[
                      styles.playerAvatar,
                      isTraining && { borderColor: trainColor + "88" },
                    ]}>
                      <Text style={styles.playerAvatarText}>{p.name[0]}</Text>
                    </View>
                    <Text
                      style={[styles.playerName, isBlocked && !isTraining && { color: "#4B5563" }]}
                      numberOfLines={1}
                    >
                      {p.name}
                    </Text>
                    <Text style={styles.playerRole}>{p.role}</Text>
                    {isTraining ? (
                      <Text style={[styles.trainingCountdown, { color: trainColor }]}>
                        {formatCountdown(remaining)}
                      </Text>
                    ) : (
                      <View style={styles.ratingRow}>
                        <Text style={styles.ratingLabel}>⚡</Text>
                        <Text style={[styles.ratingValue, { color: p.energy >= 50 ? "#10B981" : p.energy >= 25 ? "#F59E0B" : "#EF4444" }]}>
                          {p.energy}
                        </Text>
                      </View>
                    )}

                    {isInjured && (
                      <View style={styles.blockedOverlay}>
                        <Text style={styles.blockedOverlayText}>{t("training.injuredOverlay")}</Text>
                      </View>
                    )}
                    {isLocked && !isTraining && !isInjured && (
                      <View style={styles.blockedOverlay}>
                        <Text style={styles.blockedOverlayText}>🔒</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
        </View>

        {/* ── TIPOS DE TREINO ───────────────────────── */}
        <View style={styles.section}>
          <View style={styles.sectionRow}>
            <Text style={styles.sectionTitle}>{t("training.trainingTypesTitle")}</Text>
            {!isLocked && !selectedPlayer && (
              <Text style={styles.sectionHint}>{t("training.selectPlayerFirst")}</Text>
            )}
          </View>

          {TRAINING_TYPES.map((tr) => {
            const disabled = !selectedPlayer || isLocked;
            const cantAfford = !!selectedPlayer && selectedPlayer.energy < tr.energyCost;
            return (
              <TouchableOpacity
                key={tr.id}
                activeOpacity={disabled ? 1 : 0.75}
                disabled={disabled}
                onPress={() => handleTrainingPress(tr)}
                style={[styles.trainingCard, disabled && styles.trainingCardDisabled]}
              >
                <View style={[styles.trainingAccent, { backgroundColor: disabled ? "#1F1F1F" : tr.color }]} />
                <View style={styles.trainingLeft}>
                  <View style={[styles.trainingIconWrap, { backgroundColor: disabled ? "#111" : tr.color + "18" }]}>
                    <Text style={styles.trainingIcon}>{tr.icon}</Text>
                  </View>
                  <View style={styles.trainingInfo}>
                    <Text style={[styles.trainingName, disabled && { color: "#4B5563" }]}>
                      {t(tr.nameKey)}
                    </Text>
                    <Text style={styles.trainingDesc}>{t(tr.descKey)}</Text>
                    {!disabled && (
                      <View style={[styles.benefitPill, { backgroundColor: tr.color + "18" }]}>
                        <Text style={[styles.benefitText, { color: tr.color }]}>
                          📈 {t(tr.benefitKey)}
                        </Text>
                      </View>
                    )}
                  </View>
                </View>
                <View style={styles.trainingRight}>
                  <Text style={[styles.trainingDuration, cantAfford && { color: "#EF4444" }]}>
                    ⚡{tr.energyCost}
                  </Text>
                  <Text style={[styles.trainingChevron, disabled && { color: "#1F1F1F" }]}>›</Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>

        <View style={{ height: 32 }} />
      </ScrollView>

      {/* ── MODAL DE CONFIRMAÇÃO ─────────────────────── */}
      <Modal
        visible={confirmOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setConfirmOpen(false)}
      >
        <Pressable style={styles.overlay} onPress={() => !starting && setConfirmOpen(false)}>
          <Pressable style={styles.sheet} onPress={() => {}}>
            <View style={styles.sheetHandle} />

            {selectedPlayer && pendingTraining && (
              <>
                <View style={styles.sheetHeader}>
                  <View style={[styles.sheetIconWrap, { backgroundColor: pendingTraining.color + "22" }]}>
                    <Text style={styles.sheetIcon}>{pendingTraining.icon}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.sheetTitle}>{t(pendingTraining.nameKey)}</Text>
                    <Text style={styles.sheetDesc}>{t(pendingTraining.descKey)}</Text>
                  </View>
                </View>

                <View style={styles.sheetDivider} />

                <Text style={styles.sheetLabel}>{t("training.playerLabel")}</Text>
                <View style={styles.sheetPlayerRow}>
                  <View style={styles.sheetPlayerAvatar}>
                    <Text style={styles.sheetPlayerAvatarText}>{selectedPlayer.name[0]}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.sheetPlayerName}>{selectedPlayer.name}</Text>
                    <Text style={styles.sheetPlayerRole}>{selectedPlayer.role}</Text>
                  </View>
                  <View style={[styles.sheetRatingBadge, { backgroundColor: getRatingColor(selectedPlayer.rating) + "22" }]}>
                    <Text style={[styles.sheetRatingValue, { color: getRatingColor(selectedPlayer.rating) }]}>
                      {selectedPlayer.rating}
                    </Text>
                  </View>
                </View>

                <View style={styles.sheetDivider} />

                <View style={styles.sheetSummaryRow}>
                  <Text style={styles.sheetSummaryLabel}>{t("training.confirmDuration")}</Text>
                  <Text style={styles.sheetSummaryValue}>{t("training.confirmDurationValue")}</Text>
                </View>
                <View style={styles.sheetSummaryRow}>
                  <Text style={styles.sheetSummaryLabel}>{t("training.confirmEnergyCost")}</Text>
                  <Text style={styles.sheetSummaryValue}>
                    {pendingTraining.energyCost} {t("training.energyUnit")} ({selectedPlayer.energy} → {selectedPlayer.energy - pendingTraining.energyCost})
                  </Text>
                </View>
                <View style={styles.sheetSummaryRow}>
                  <Text style={styles.sheetSummaryLabel}>{t("training.confirmBenefit")}</Text>
                  <Text style={[styles.sheetSummaryValue, { color: pendingTraining.color }]}>
                    {t(pendingTraining.benefitKey)}
                  </Text>
                </View>

                <View style={styles.sheetNote}>
                  <Text style={styles.sheetNoteText}>
                    {t("training.confirmNote")}
                  </Text>
                </View>

                <View style={styles.sheetActions}>
                  <TouchableOpacity
                    style={styles.btnCancel}
                    onPress={() => setConfirmOpen(false)}
                    disabled={starting}
                  >
                    <Text style={styles.btnCancelText}>{t("training.cancelBtn")}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.btnConfirm, { backgroundColor: pendingTraining.color }, starting && { opacity: 0.6 }]}
                    onPress={startTraining}
                    disabled={starting}
                  >
                    {starting
                      ? <ActivityIndicator size="small" color="#000" />
                      : <Text style={styles.btnConfirmText}>{t("training.startBtn")}</Text>}
                  </TouchableOpacity>
                </View>
              </>
            )}
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#080808" },
  container: { flex: 1, backgroundColor: "#080808" },

  // Header
  // Active session banner
  sessionBanner: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: 16,
    marginBottom: 4,
    backgroundColor: "#0D0D0D",
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
    gap: 12,
  },
  sessionIconWrap: {
    width: 48, height: 48, borderRadius: 12,
    justifyContent: "center", alignItems: "center",
  },
  sessionIcon: { fontSize: 24 },
  sessionInfo: { flex: 1, gap: 2 },
  sessionTopRow: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 2 },
  sessionDot: { width: 6, height: 6, borderRadius: 3 },
  sessionLabel: { fontSize: 9, fontWeight: "800", letterSpacing: 2 },
  sessionPlayer: { fontSize: 15, fontWeight: "900", color: "#FFFFFF" },
  sessionType: { fontSize: 11, color: "#6B7280" },
  sessionTimer: { alignItems: "flex-end", gap: 2 },
  sessionTimerLabel: { fontSize: 8, fontWeight: "700", color: "#6B7280", letterSpacing: 1.5 },
  sessionTimerValue: { fontSize: 18, fontWeight: "900", letterSpacing: 1 },
  cancelBtn: { marginTop: 4 },
  cancelBtnText: { fontSize: 10, color: "#4B5563", fontWeight: "600" },

  // Lock info
  lockInfo: {
    marginHorizontal: 16, marginBottom: 4,
    backgroundColor: "#111", borderRadius: 8,
    paddingVertical: 8, paddingHorizontal: 14, alignItems: "center",
  },
  lockInfoText: { fontSize: 11, color: "#4B5563" },

  // Sections
  section: { paddingHorizontal: 16, marginBottom: 8, marginTop: 16 },
  sectionRow: {
    flexDirection: "row", alignItems: "center",
    justifyContent: "space-between", marginBottom: 12,
  },
  sectionTitle: { fontSize: 11, fontWeight: "800", color: "#6B7280", letterSpacing: 3 },
  sectionLink: { fontSize: 12, color: "#10B981", fontWeight: "600" },
  sectionHint: { fontSize: 11, color: "#374151", fontStyle: "italic" },

  centered: { paddingVertical: 28, alignItems: "center" },
  emptyText: { color: "#4B5563", fontSize: 13 },

  // Players grid
  playersGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  playerCard: {
    width: (width - 42) / 3,
    backgroundColor: "#0D0D0D",
    borderRadius: 12, borderWidth: 1, borderColor: "#1A1A1A",
    padding: 12, alignItems: "center", gap: 4,
    position: "relative", overflow: "hidden",
  },
  playerCardSelected: { borderColor: "#10B981", backgroundColor: "#0D1F16" },
  playerCardBlocked: { opacity: 0.35 },
  checkBadge: {
    position: "absolute", top: 6, right: 6,
    width: 18, height: 18, borderRadius: 9,
    backgroundColor: "#10B981",
    justifyContent: "center", alignItems: "center",
  },
  checkBadgeText: { fontSize: 10, fontWeight: "900", color: "#000" },
  playerAvatar: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: "#1A1A1A", borderWidth: 1, borderColor: "#2A2A2A",
    justifyContent: "center", alignItems: "center", marginBottom: 4,
  },
  playerAvatarText: { fontSize: 15, fontWeight: "700", color: "#9CA3AF" },
  playerName: { fontSize: 12, fontWeight: "700", color: "#FFFFFF", textAlign: "center" },
  playerRole: { fontSize: 10, color: "#6B7280" },
  ratingRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 2 },
  ratingLabel: { fontSize: 9, color: "#4B5563", fontWeight: "600" },
  ratingValue: { fontSize: 13, fontWeight: "900" },
  trainingCountdown: { fontSize: 11, fontWeight: "900", marginTop: 2 },
  blockedOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.65)",
    justifyContent: "center", alignItems: "center", borderRadius: 12,
  },
  blockedOverlayText: { fontSize: 10, fontWeight: "800", color: "#EF4444", letterSpacing: 1 },

  // Training type cards
  trainingCard: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: "#0D0D0D", borderRadius: 12, borderWidth: 1, borderColor: "#1A1A1A",
    marginBottom: 10, overflow: "hidden",
  },
  trainingCardDisabled: { opacity: 0.4 },
  trainingAccent: { width: 3, alignSelf: "stretch" },
  trainingLeft: { flex: 1, flexDirection: "row", alignItems: "center", gap: 12, padding: 14 },
  trainingIconWrap: {
    width: 44, height: 44, borderRadius: 12,
    justifyContent: "center", alignItems: "center", flexShrink: 0,
  },
  trainingIcon: { fontSize: 22 },
  trainingInfo: { flex: 1, gap: 3 },
  trainingName: { fontSize: 13, fontWeight: "800", color: "#FFFFFF", letterSpacing: 0.5 },
  trainingDesc: { fontSize: 11, color: "#6B7280" },
  benefitPill: {
    alignSelf: "flex-start", borderRadius: 4,
    paddingHorizontal: 7, paddingVertical: 3, marginTop: 4,
  },
  benefitText: { fontSize: 10, fontWeight: "700" },
  trainingRight: { paddingRight: 14, alignItems: "center", gap: 4 },
  trainingDuration: { fontSize: 11, color: "#9CA3AF", fontWeight: "700" },
  trainingChevron: { fontSize: 22, color: "#374151" },

  // Overlay / Sheet
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.75)", justifyContent: "flex-end" },
  sheet: {
    backgroundColor: "#0D0D0D",
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    borderWidth: 1, borderColor: "#1A1A1A",
    paddingHorizontal: 20, paddingTop: 12, paddingBottom: 32,
  },
  sheetHandle: {
    width: 36, height: 4, borderRadius: 2,
    backgroundColor: "#2A2A2A", alignSelf: "center", marginBottom: 20,
  },
  sheetHeader: { flexDirection: "row", alignItems: "center", gap: 14, marginBottom: 20 },
  sheetIconWrap: { width: 52, height: 52, borderRadius: 14, justifyContent: "center", alignItems: "center" },
  sheetIcon: { fontSize: 26 },
  sheetTitle: { fontSize: 16, fontWeight: "900", color: "#FFFFFF", letterSpacing: 0.5 },
  sheetDesc: { fontSize: 12, color: "#6B7280", marginTop: 2 },
  sheetDivider: { height: 1, backgroundColor: "#1A1A1A", marginBottom: 14 },
  sheetLabel: { fontSize: 10, fontWeight: "800", color: "#6B7280", letterSpacing: 3, marginBottom: 10 },
  sheetPlayerRow: {
    flexDirection: "row", alignItems: "center", gap: 12,
    backgroundColor: "#111", borderRadius: 10, padding: 12, marginBottom: 16,
  },
  sheetPlayerAvatar: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: "#1A1A1A", justifyContent: "center", alignItems: "center",
  },
  sheetPlayerAvatarText: { fontSize: 15, fontWeight: "700", color: "#9CA3AF" },
  sheetPlayerName: { fontSize: 14, fontWeight: "700", color: "#FFFFFF" },
  sheetPlayerRole: { fontSize: 11, color: "#6B7280", marginTop: 2 },
  sheetRatingBadge: { borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
  sheetRatingValue: { fontSize: 15, fontWeight: "900" },
  sheetSummaryRow: {
    flexDirection: "row", justifyContent: "space-between",
    alignItems: "center", paddingVertical: 9,
    borderBottomWidth: 1, borderBottomColor: "#111",
  },
  sheetSummaryLabel: { fontSize: 13, color: "#6B7280" },
  sheetSummaryValue: { fontSize: 13, fontWeight: "700", color: "#FFFFFF" },
  sheetNote: {
    marginTop: 14,
    backgroundColor: "rgba(99,102,241,0.08)",
    borderWidth: 1, borderColor: "rgba(99,102,241,0.2)",
    borderRadius: 8, paddingVertical: 10, paddingHorizontal: 14,
  },
  sheetNoteText: { fontSize: 12, color: "#818CF8" },
  sheetActions: { flexDirection: "row", gap: 12, marginTop: 16 },
  btnCancel: {
    flex: 1, height: 48, borderRadius: 10,
    backgroundColor: "#161616", borderWidth: 1, borderColor: "#242424",
    alignItems: "center", justifyContent: "center",
  },
  btnCancelText: { fontSize: 13, fontWeight: "700", color: "#6B7280", letterSpacing: 1 },
  btnConfirm: {
    flex: 2, height: 48, borderRadius: 10,
    alignItems: "center", justifyContent: "center",
  },
  btnConfirmText: { fontSize: 13, fontWeight: "900", color: "#000", letterSpacing: 1 },
});
