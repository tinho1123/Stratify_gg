import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from "@/database/supabase";
import { router } from "expo-router";
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

const TRAINING_DURATION_MS = 2 * 60 * 60 * 1000; // 2 horas
const STORAGE_KEY = "stratify:active_training";

interface Player {
  id: string;
  name: string;
  role: string;
  rating: number;
  status: "online" | "injured" | "banned";
}

interface TrainingType {
  id: string;
  name: string;
  icon: string;
  description: string;
  energyCost: number;
  benefit: string;
  color: string;
}

interface ActiveSession {
  playerId: string;
  playerName: string;
  playerInitial: string;
  trainingName: string;
  trainingIcon: string;
  trainingColor: string;
  trainingBenefit: string;
  endsAt: number; // timestamp ms
}

const TRAINING_TYPES: TrainingType[] = [
  {
    id: "1",
    name: "AIM TRAINING",
    icon: "🎯",
    description: "Treino intensivo de mira e precisão",
    energyCost: 20,
    benefit: "+5 Precisão  +3 Reação",
    color: "#EF4444",
  },
  {
    id: "2",
    name: "ESTRATÉGIA",
    icon: "🧠",
    description: "Estudo de táticas e map control",
    energyCost: 15,
    benefit: "+7 IQ de Jogo  +4 Comunicação",
    color: "#3B82F6",
  },
  {
    id: "3",
    name: "CLUTCH TRAINING",
    icon: "⚡",
    description: "Situações de pressão 1vX",
    energyCost: 25,
    benefit: "+6 Mental  +5 Decisão",
    color: "#F59E0B",
  },
  {
    id: "4",
    name: "SPRAY CONTROL",
    icon: "🔫",
    description: "Controle de recuo e spray patterns",
    energyCost: 18,
    benefit: "+5 Controle  +4 Consistência",
    color: "#8B5CF6",
  },
  {
    id: "5",
    name: "MOVIMENTO",
    icon: "🏃",
    description: "Peek, strafe e positioning",
    energyCost: 20,
    benefit: "+6 Agilidade  +3 Positioning",
    color: "#10B981",
  },
  {
    id: "6",
    name: "TEAM PRACTICE",
    icon: "👥",
    description: "Scrims e treino em equipe",
    energyCost: 30,
    benefit: "+8 Sincronia  +6 Química",
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
  const [players, setPlayers] = useState<Player[]>([]);
  const [loadingPlayers, setLoadingPlayers] = useState(true);

  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null);
  const [pendingTraining, setPendingTraining] = useState<TrainingType | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const [session, setSession] = useState<ActiveSession | null>(null);
  const [remaining, setRemaining] = useState(0);
  const [justFinished, setJustFinished] = useState(false);

  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Load persisted session ────────────────────────────────────────────────

  const loadSession = useCallback(async () => {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const saved: ActiveSession = JSON.parse(raw);
      const rem = saved.endsAt - Date.now();
      if (rem <= 0) {
        await AsyncStorage.removeItem(STORAGE_KEY);
        return;
      }
      setSession(saved);
      setRemaining(rem);
    } catch {}
  }, []);

  // ── Countdown tick ────────────────────────────────────────────────────────

  useEffect(() => {
    if (!session) return;

    tickRef.current = setInterval(() => {
      const rem = session.endsAt - Date.now();
      if (rem <= 0) {
        clearInterval(tickRef.current!);
        setSession(null);
        setRemaining(0);
        AsyncStorage.removeItem(STORAGE_KEY);
        setJustFinished(true);
        setTimeout(() => setJustFinished(false), 3000);
      } else {
        setRemaining(rem);
      }
    }, 1000);

    return () => {
      if (tickRef.current) clearInterval(tickRef.current);
    };
  }, [session]);

  // ── Load players ──────────────────────────────────────────────────────────

  useEffect(() => {
    loadSession();

    supabase
      .from("teams")
      .select("id")
      .single()
      .then(({ data: team }) => {
        if (!team) { setLoadingPlayers(false); return; }
        supabase
          .from("players")
          .select("id, name, role, rating, status")
          .eq("team_id", team.id)
          .then(({ data, error }) => {
            if (!error && data) setPlayers(data as Player[]);
            setLoadingPlayers(false);
          });
      });
  }, [loadSession]);

  // ── Actions ───────────────────────────────────────────────────────────────

  const handleTrainingPress = (t: TrainingType) => {
    if (!selectedPlayer || session) return;
    setPendingTraining(t);
    setConfirmOpen(true);
  };

  const startTraining = async () => {
    if (!selectedPlayer || !pendingTraining) return;
    setConfirmOpen(false);

    const newSession: ActiveSession = {
      playerId: selectedPlayer.id,
      playerName: selectedPlayer.name,
      playerInitial: selectedPlayer.name[0],
      trainingName: pendingTraining.name,
      trainingIcon: pendingTraining.icon,
      trainingColor: pendingTraining.color,
      trainingBenefit: pendingTraining.benefit,
      endsAt: Date.now() + TRAINING_DURATION_MS,
    };

    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(newSession));
    setSession(newSession);
    setRemaining(TRAINING_DURATION_MS);
    setSelectedPlayer(null);
    setPendingTraining(null);
  };

  const cancelTraining = async () => {
    await AsyncStorage.removeItem(STORAGE_KEY);
    if (tickRef.current) clearInterval(tickRef.current);
    setSession(null);
    setRemaining(0);
  };

  const isLocked = !!session;

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>

      {/* ── HEADER ───────────────────────────────────── */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Text style={styles.backIcon}>‹</Text>
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <View style={styles.headerDot} />
          <Text style={styles.headerTitle}>TREINAMENTO</Text>
        </View>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>

        {/* ── SESSÃO ATIVA ─────────────────────────────── */}
        {session && (
          <View style={[styles.sessionBanner, { borderColor: session.trainingColor + "55" }]}>
            <View style={[styles.sessionIconWrap, { backgroundColor: session.trainingColor + "18" }]}>
              <Text style={styles.sessionIcon}>{session.trainingIcon}</Text>
            </View>

            <View style={styles.sessionInfo}>
              <View style={styles.sessionTopRow}>
                <View style={[styles.sessionDot, { backgroundColor: session.trainingColor }]} />
                <Text style={[styles.sessionLabel, { color: session.trainingColor }]}>
                  EM TREINAMENTO
                </Text>
              </View>
              <Text style={styles.sessionPlayer}>{session.playerName}</Text>
              <Text style={styles.sessionType}>{session.trainingName}</Text>
            </View>

            <View style={styles.sessionTimer}>
              <Text style={styles.sessionTimerLabel}>RESTANTE</Text>
              <Text style={[styles.sessionTimerValue, { color: session.trainingColor }]}>
                {formatCountdown(remaining)}
              </Text>
              <TouchableOpacity onPress={cancelTraining} style={styles.cancelBtn}>
                <Text style={styles.cancelBtnText}>cancelar</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* ── TREINO CONCLUÍDO ─────────────────────────── */}
        {justFinished && (
          <View style={styles.finishedBanner}>
            <Text style={styles.finishedIcon}>🎉</Text>
            <View>
              <Text style={styles.finishedTitle}>TREINO CONCLUÍDO!</Text>
              <Text style={styles.finishedSub}>Jogador disponível para novo treino</Text>
            </View>
          </View>
        )}

        {/* ── LOCK INFO ────────────────────────────────── */}
        {isLocked && (
          <View style={styles.lockInfo}>
            <Text style={styles.lockInfoText}>
              Aguarde o fim do treino para iniciar um novo
            </Text>
          </View>
        )}

        {/* ── SELEÇÃO DE JOGADOR ──────────────────────── */}
        <View style={styles.section}>
          <View style={styles.sectionRow}>
            <Text style={styles.sectionTitle}>
              {isLocked ? "JOGADORES" : "SELECIONAR JOGADOR"}
            </Text>
            {selectedPlayer && !isLocked && (
              <TouchableOpacity onPress={() => setSelectedPlayer(null)}>
                <Text style={styles.sectionLink}>limpar</Text>
              </TouchableOpacity>
            )}
          </View>

          {loadingPlayers ? (
            <View style={styles.centered}>
              <ActivityIndicator size="small" color="#10B981" />
            </View>
          ) : players.length === 0 ? (
            <View style={styles.centered}>
              <Text style={styles.emptyText}>Nenhum jogador no time</Text>
            </View>
          ) : (
            <View style={styles.playersGrid}>
              {players.map((p) => {
                const isTraining = session?.playerId === p.id;
                const isInjured = p.status === "injured";
                const isSelected = selectedPlayer?.id === p.id;
                // Blocked: locked by another player's session, or injured
                const isBlocked = (isLocked && !isTraining) || isInjured;

                return (
                  <TouchableOpacity
                    key={p.id}
                    activeOpacity={isBlocked ? 1 : 0.75}
                    disabled={isBlocked}
                    onPress={() => setSelectedPlayer(isSelected ? null : p)}
                    style={[
                      styles.playerCard,
                      isSelected && styles.playerCardSelected,
                      isTraining && { borderColor: session!.trainingColor, backgroundColor: session!.trainingColor + "0A" },
                      isBlocked && styles.playerCardBlocked,
                    ]}
                  >
                    {isSelected && !isTraining && (
                      <View style={styles.checkBadge}>
                        <Text style={styles.checkBadgeText}>✓</Text>
                      </View>
                    )}
                    {isTraining && (
                      <View style={[styles.checkBadge, { backgroundColor: session!.trainingColor }]}>
                        <Text style={styles.checkBadgeText}>▶</Text>
                      </View>
                    )}

                    <View style={[
                      styles.playerAvatar,
                      isTraining && { borderColor: session!.trainingColor + "88" },
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
                      <Text style={[styles.trainingCountdown, { color: session!.trainingColor }]}>
                        {formatCountdown(remaining)}
                      </Text>
                    ) : (
                      <View style={styles.ratingRow}>
                        <Text style={styles.ratingLabel}>RTG</Text>
                        <Text style={[styles.ratingValue, { color: getRatingColor(p.rating) }]}>
                          {p.rating}
                        </Text>
                      </View>
                    )}

                    {isInjured && (
                      <View style={styles.blockedOverlay}>
                        <Text style={styles.blockedOverlayText}>LESÃO</Text>
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
            <Text style={styles.sectionTitle}>TIPOS DE TREINO</Text>
            {!isLocked && !selectedPlayer && (
              <Text style={styles.sectionHint}>selecione um jogador primeiro</Text>
            )}
          </View>

          {TRAINING_TYPES.map((t) => {
            const disabled = !selectedPlayer || isLocked;
            return (
              <TouchableOpacity
                key={t.id}
                activeOpacity={disabled ? 1 : 0.75}
                disabled={disabled}
                onPress={() => handleTrainingPress(t)}
                style={[styles.trainingCard, disabled && styles.trainingCardDisabled]}
              >
                <View style={[styles.trainingAccent, { backgroundColor: disabled ? "#1F1F1F" : t.color }]} />
                <View style={styles.trainingLeft}>
                  <View style={[styles.trainingIconWrap, { backgroundColor: disabled ? "#111" : t.color + "18" }]}>
                    <Text style={styles.trainingIcon}>{t.icon}</Text>
                  </View>
                  <View style={styles.trainingInfo}>
                    <Text style={[styles.trainingName, disabled && { color: "#4B5563" }]}>
                      {t.name}
                    </Text>
                    <Text style={styles.trainingDesc}>{t.description}</Text>
                    {!disabled && (
                      <View style={[styles.benefitPill, { backgroundColor: t.color + "18" }]}>
                        <Text style={[styles.benefitText, { color: t.color }]}>
                          📈 {t.benefit}
                        </Text>
                      </View>
                    )}
                  </View>
                </View>
                <View style={styles.trainingRight}>
                  <Text style={styles.trainingDuration}>2h</Text>
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
        <Pressable style={styles.overlay} onPress={() => setConfirmOpen(false)}>
          <Pressable style={styles.sheet} onPress={() => {}}>
            <View style={styles.sheetHandle} />

            {selectedPlayer && pendingTraining && (
              <>
                <View style={styles.sheetHeader}>
                  <View style={[styles.sheetIconWrap, { backgroundColor: pendingTraining.color + "22" }]}>
                    <Text style={styles.sheetIcon}>{pendingTraining.icon}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.sheetTitle}>{pendingTraining.name}</Text>
                    <Text style={styles.sheetDesc}>{pendingTraining.description}</Text>
                  </View>
                </View>

                <View style={styles.sheetDivider} />

                <Text style={styles.sheetLabel}>JOGADOR</Text>
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
                  <Text style={styles.sheetSummaryLabel}>Duração</Text>
                  <Text style={styles.sheetSummaryValue}>2 horas</Text>
                </View>
                <View style={styles.sheetSummaryRow}>
                  <Text style={styles.sheetSummaryLabel}>Custo de energia</Text>
                  <Text style={styles.sheetSummaryValue}>{pendingTraining.energyCost} EP</Text>
                </View>
                <View style={styles.sheetSummaryRow}>
                  <Text style={styles.sheetSummaryLabel}>Benefício</Text>
                  <Text style={[styles.sheetSummaryValue, { color: pendingTraining.color }]}>
                    {pendingTraining.benefit}
                  </Text>
                </View>

                <View style={styles.sheetNote}>
                  <Text style={styles.sheetNoteText}>
                    🔒 Nenhum outro jogador poderá treinar durante este período
                  </Text>
                </View>

                <View style={styles.sheetActions}>
                  <TouchableOpacity
                    style={styles.btnCancel}
                    onPress={() => setConfirmOpen(false)}
                  >
                    <Text style={styles.btnCancelText}>CANCELAR</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.btnConfirm, { backgroundColor: pendingTraining.color }]}
                    onPress={startTraining}
                  >
                    <Text style={styles.btnConfirmText}>INICIAR  ▶</Text>
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
  header: {
    flexDirection: "row", alignItems: "center",
    paddingHorizontal: 16, paddingVertical: 14, gap: 12,
  },
  backBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: "#161616", borderWidth: 1, borderColor: "#242424",
    justifyContent: "center", alignItems: "center",
  },
  backIcon: { fontSize: 22, color: "#FFFFFF", lineHeight: 24, marginTop: -2 },
  headerCenter: { flex: 1, flexDirection: "row", alignItems: "center", gap: 8 },
  headerDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: "#10B981" },
  headerTitle: { fontSize: 16, fontWeight: "900", color: "#FFFFFF", letterSpacing: 4 },

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

  // Finished banner
  finishedBanner: {
    flexDirection: "row", alignItems: "center", gap: 12,
    marginHorizontal: 16, marginBottom: 4,
    backgroundColor: "rgba(16,185,129,0.08)",
    borderWidth: 1, borderColor: "rgba(16,185,129,0.25)",
    borderRadius: 12, padding: 14,
  },
  finishedIcon: { fontSize: 28 },
  finishedTitle: { fontSize: 13, fontWeight: "900", color: "#10B981", letterSpacing: 1 },
  finishedSub: { fontSize: 11, color: "#6B7280", marginTop: 2 },

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
