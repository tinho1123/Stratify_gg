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
  rating: number;
  status: "online" | "injured" | "banned";
}

interface TrainingType {
  id: string;
  name: string;
  icon: string;
  description: string;
  duration: string;
  energyCost: number;
  benefit: string;
  color: string;
}

const TRAINING_TYPES: TrainingType[] = [
  {
    id: "1",
    name: "AIM TRAINING",
    icon: "🎯",
    description: "Treino intensivo de mira e precisão",
    duration: "2h",
    energyCost: 20,
    benefit: "+5 Precisão  +3 Reação",
    color: "#EF4444",
  },
  {
    id: "2",
    name: "ESTRATÉGIA",
    icon: "🧠",
    description: "Estudo de táticas e map control",
    duration: "3h",
    energyCost: 15,
    benefit: "+7 IQ de Jogo  +4 Comunicação",
    color: "#3B82F6",
  },
  {
    id: "3",
    name: "CLUTCH TRAINING",
    icon: "⚡",
    description: "Situações de pressão 1vX",
    duration: "2h",
    energyCost: 25,
    benefit: "+6 Mental  +5 Decisão",
    color: "#F59E0B",
  },
  {
    id: "4",
    name: "SPRAY CONTROL",
    icon: "🔫",
    description: "Controle de recuo e spray patterns",
    duration: "2h",
    energyCost: 18,
    benefit: "+5 Controle  +4 Consistência",
    color: "#8B5CF6",
  },
  {
    id: "5",
    name: "MOVIMENTO",
    icon: "🏃",
    description: "Peek, strafe e positioning",
    duration: "2h",
    energyCost: 20,
    benefit: "+6 Agilidade  +3 Positioning",
    color: "#10B981",
  },
  {
    id: "6",
    name: "TEAM PRACTICE",
    icon: "👥",
    description: "Scrims e treino em equipe",
    duration: "4h",
    energyCost: 30,
    benefit: "+8 Sincronia  +6 Química",
    color: "#EC4899",
  },
];

type FeedbackState = "idle" | "loading" | "success" | "error";

export default function TrainingScreen() {
  const [players, setPlayers] = useState<Player[]>([]);
  const [loadingPlayers, setLoadingPlayers] = useState(true);
  const [selectedPlayers, setSelectedPlayers] = useState<string[]>([]);
  const [selectedTraining, setSelectedTraining] = useState<TrainingType | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [feedback, setFeedback] = useState<FeedbackState>("idle");

  useEffect(() => {
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
  }, []);

  const availablePlayers = players.filter((p) => p.status !== "injured");

  const togglePlayer = (id: string) => {
    setSelectedPlayers((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const handleTrainingPress = (training: TrainingType) => {
    if (selectedPlayers.length === 0) return;
    setSelectedTraining(training);
    setConfirmOpen(true);
  };

  const startTraining = async () => {
    if (!selectedTraining) return;
    setConfirmOpen(false);
    setFeedback("loading");

    await new Promise((r) => setTimeout(r, 2500));

    setFeedback("success");
    await new Promise((r) => setTimeout(r, 2000));

    setFeedback("idle");
    setSelectedPlayers([]);
    setSelectedTraining(null);
  };

  const selectedCount = selectedPlayers.length;

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
        <View style={styles.headerRight}>
          <View style={styles.energyPill}>
            <Text style={styles.energyPillIcon}>⚡</Text>
            <Text style={styles.energyPillText}>100 EP</Text>
          </View>
        </View>
      </View>

      <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>

        {/* ── SELEÇÃO DE JOGADORES ──────────────────── */}
        <View style={styles.section}>
          <View style={styles.sectionRow}>
            <Text style={styles.sectionTitle}>SELECIONAR JOGADORES</Text>
            <View style={styles.sectionRowActions}>
              <TouchableOpacity
                onPress={() => setSelectedPlayers(availablePlayers.map((p) => p.id))}
              >
                <Text style={styles.sectionLink}>todos</Text>
              </TouchableOpacity>
              {selectedCount > 0 && (
                <>
                  <Text style={styles.sectionLinkSep}>·</Text>
                  <TouchableOpacity onPress={() => setSelectedPlayers([])}>
                    <Text style={[styles.sectionLink, { color: "#6B7280" }]}>limpar</Text>
                  </TouchableOpacity>
                </>
              )}
            </View>
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
                const isSelected = selectedPlayers.includes(p.id);
                const isInjured = p.status === "injured";
                return (
                  <TouchableOpacity
                    key={p.id}
                    activeOpacity={isInjured ? 1 : 0.75}
                    disabled={isInjured}
                    onPress={() => togglePlayer(p.id)}
                    style={[
                      styles.playerCard,
                      isSelected && styles.playerCardSelected,
                      isInjured && styles.playerCardDisabled,
                    ]}
                  >
                    {isSelected && (
                      <View style={styles.checkBadge}>
                        <Text style={styles.checkBadgeText}>✓</Text>
                      </View>
                    )}
                    <View style={styles.playerAvatar}>
                      <Text style={styles.playerAvatarText}>{p.name[0]}</Text>
                    </View>
                    <Text
                      style={[styles.playerName, isInjured && { color: "#4B5563" }]}
                      numberOfLines={1}
                    >
                      {p.name}
                    </Text>
                    <Text style={styles.playerRole}>{p.role}</Text>
                    <View style={styles.ratingRow}>
                      <Text style={styles.ratingLabel}>RTG</Text>
                      <Text
                        style={[
                          styles.ratingValue,
                          { color: p.rating >= 90 ? "#10B981" : p.rating >= 75 ? "#F59E0B" : "#EF4444" },
                        ]}
                      >
                        {p.rating}
                      </Text>
                    </View>
                    {isInjured && (
                      <View style={styles.injuredOverlay}>
                        <Text style={styles.injuredText}>LESÃO</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          )}

          {selectedCount > 0 && (
            <View style={styles.selectionBar}>
              <Text style={styles.selectionBarText}>
                {selectedCount} jogador{selectedCount !== 1 ? "es" : ""} selecionado{selectedCount !== 1 ? "s" : ""}
              </Text>
            </View>
          )}
        </View>

        {/* ── TIPOS DE TREINO ───────────────────────── */}
        <View style={styles.section}>
          <View style={styles.sectionRow}>
            <Text style={styles.sectionTitle}>TIPOS DE TREINO</Text>
            {selectedCount === 0 && (
              <Text style={styles.sectionHint}>selecione jogadores primeiro</Text>
            )}
          </View>

          {TRAINING_TYPES.map((t) => {
            const disabled = selectedCount === 0;
            return (
              <TouchableOpacity
                key={t.id}
                activeOpacity={disabled ? 1 : 0.75}
                disabled={disabled}
                onPress={() => handleTrainingPress(t)}
                style={[styles.trainingCard, disabled && styles.trainingCardDisabled]}
              >
                <View style={[styles.trainingAccent, { backgroundColor: t.color }]} />
                <View style={styles.trainingLeft}>
                  <View style={[styles.trainingIconWrap, { backgroundColor: t.color + "18" }]}>
                    <Text style={styles.trainingIcon}>{t.icon}</Text>
                  </View>
                  <View style={styles.trainingInfo}>
                    <Text style={[styles.trainingName, disabled && { color: "#4B5563" }]}>
                      {t.name}
                    </Text>
                    <Text style={styles.trainingDesc}>{t.description}</Text>
                    <View style={[styles.benefitPill, { backgroundColor: t.color + "18" }]}>
                      <Text style={[styles.benefitText, { color: t.color }]}>
                        📈 {t.benefit}
                      </Text>
                    </View>
                  </View>
                </View>
                <View style={styles.trainingRight}>
                  <View style={styles.trainingMeta}>
                    <Text style={styles.trainingMetaIcon}>⏱</Text>
                    <Text style={styles.trainingMetaValue}>{t.duration}</Text>
                  </View>
                  <View style={styles.trainingMeta}>
                    <Text style={styles.trainingMetaIcon}>⚡</Text>
                    <Text style={styles.trainingMetaValue}>-{t.energyCost}</Text>
                  </View>
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

            {selectedTraining && (
              <>
                <View style={styles.sheetHeader}>
                  <View style={[styles.sheetIconWrap, { backgroundColor: selectedTraining.color + "22" }]}>
                    <Text style={styles.sheetIcon}>{selectedTraining.icon}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.sheetTitle}>{selectedTraining.name}</Text>
                    <Text style={styles.sheetDesc}>{selectedTraining.description}</Text>
                  </View>
                </View>

                <View style={styles.sheetDivider} />

                <Text style={styles.sheetLabel}>JOGADORES</Text>
                <View style={styles.sheetPlayersWrap}>
                  {selectedPlayers.map((id) => {
                    const p = players.find((x) => x.id === id);
                    if (!p) return null;
                    return (
                      <View key={id} style={styles.sheetPlayerRow}>
                        <View style={styles.sheetPlayerAvatar}>
                          <Text style={styles.sheetPlayerAvatarText}>{p.name[0]}</Text>
                        </View>
                        <Text style={styles.sheetPlayerName}>{p.name}</Text>
                        <Text style={styles.sheetPlayerRole}>{p.role}</Text>
                      </View>
                    );
                  })}
                </View>

                <View style={styles.sheetDivider} />

                <View style={styles.sheetSummaryRow}>
                  <Text style={styles.sheetSummaryLabel}>Duração</Text>
                  <Text style={styles.sheetSummaryValue}>{selectedTraining.duration}</Text>
                </View>
                <View style={styles.sheetSummaryRow}>
                  <Text style={styles.sheetSummaryLabel}>Custo de energia</Text>
                  <Text style={styles.sheetSummaryValue}>
                    {selectedTraining.energyCost * selectedCount} EP
                  </Text>
                </View>
                <View style={styles.sheetSummaryRow}>
                  <Text style={styles.sheetSummaryLabel}>Benefício</Text>
                  <Text style={[styles.sheetSummaryValue, { color: selectedTraining.color }]}>
                    {selectedTraining.benefit}
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
                    style={[styles.btnConfirm, { backgroundColor: selectedTraining.color }]}
                    onPress={startTraining}
                  >
                    <Text style={styles.btnConfirmText}>INICIAR</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </Pressable>
        </Pressable>
      </Modal>

      {/* ── MODAL DE PROGRESSO / SUCESSO ─────────────── */}
      <Modal visible={feedback !== "idle"} transparent animationType="fade">
        <View style={styles.overlay}>
          <View style={styles.feedbackCard}>
            {feedback === "loading" ? (
              <>
                <LinearGradient
                  colors={[selectedTraining?.color + "22" ?? "#10B98122", "#0D0D0D"]}
                  style={styles.feedbackGradient}
                >
                  <Text style={styles.feedbackIcon}>{selectedTraining?.icon ?? "⚡"}</Text>
                  <Text style={styles.feedbackTitle}>TREINAMENTO EM ANDAMENTO</Text>
                  <Text style={styles.feedbackSub}>Aguarde enquanto seu time evolui...</Text>
                  <ActivityIndicator size="large" color={selectedTraining?.color ?? "#10B981"} style={{ marginTop: 16 }} />
                </LinearGradient>
              </>
            ) : (
              <LinearGradient
                colors={["#0D1F16", "#0D0D0D"]}
                style={styles.feedbackGradient}
              >
                <Text style={styles.feedbackIcon}>🎉</Text>
                <Text style={[styles.feedbackTitle, { color: "#10B981" }]}>TREINO CONCLUÍDO!</Text>
                <Text style={styles.feedbackSub}>
                  {selectedTraining?.benefit}
                </Text>
              </LinearGradient>
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: "#080808",
  },

  // Header
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#161616",
    borderWidth: 1,
    borderColor: "#242424",
    justifyContent: "center",
    alignItems: "center",
  },
  backIcon: {
    fontSize: 22,
    color: "#FFFFFF",
    lineHeight: 24,
    marginTop: -2,
  },
  headerCenter: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  headerDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#10B981",
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: "900",
    color: "#FFFFFF",
    letterSpacing: 4,
  },
  headerRight: {},
  energyPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "#161616",
    borderWidth: 1,
    borderColor: "#242424",
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  energyPillIcon: { fontSize: 12 },
  energyPillText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#F59E0B",
  },

  container: {
    flex: 1,
    backgroundColor: "#080808",
  },

  // Sections
  section: {
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  sectionRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
    paddingVertical: 4,
  },
  sectionRowActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
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
  sectionLinkSep: {
    color: "#374151",
    fontSize: 14,
  },
  sectionHint: {
    fontSize: 11,
    color: "#374151",
    fontStyle: "italic",
  },

  centered: {
    paddingVertical: 28,
    alignItems: "center",
  },
  emptyText: {
    color: "#4B5563",
    fontSize: 13,
  },

  // Selection bar
  selectionBar: {
    marginTop: 10,
    backgroundColor: "#10B98118",
    borderWidth: 1,
    borderColor: "#10B98130",
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 14,
    alignItems: "center",
  },
  selectionBarText: {
    fontSize: 12,
    color: "#10B981",
    fontWeight: "700",
    letterSpacing: 0.5,
  },

  // Players grid
  playersGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  playerCard: {
    width: (width - 42) / 3,
    backgroundColor: "#0D0D0D",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#1A1A1A",
    padding: 12,
    alignItems: "center",
    gap: 4,
    position: "relative",
    overflow: "hidden",
  },
  playerCardSelected: {
    borderColor: "#10B981",
    backgroundColor: "#0D1F16",
  },
  playerCardDisabled: {
    opacity: 0.45,
  },
  checkBadge: {
    position: "absolute",
    top: 6,
    right: 6,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: "#10B981",
    justifyContent: "center",
    alignItems: "center",
  },
  checkBadgeText: {
    fontSize: 10,
    fontWeight: "900",
    color: "#000",
  },
  playerAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#1A1A1A",
    borderWidth: 1,
    borderColor: "#2A2A2A",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 4,
  },
  playerAvatarText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#9CA3AF",
  },
  playerName: {
    fontSize: 12,
    fontWeight: "700",
    color: "#FFFFFF",
    textAlign: "center",
  },
  playerRole: {
    fontSize: 10,
    color: "#6B7280",
  },
  ratingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 2,
  },
  ratingLabel: {
    fontSize: 9,
    color: "#4B5563",
    fontWeight: "600",
  },
  ratingValue: {
    fontSize: 13,
    fontWeight: "900",
  },
  injuredOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.65)",
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 12,
  },
  injuredText: {
    fontSize: 10,
    fontWeight: "800",
    color: "#EF4444",
    letterSpacing: 1,
  },

  // Training cards
  trainingCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#0D0D0D",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#1A1A1A",
    marginBottom: 10,
    overflow: "hidden",
  },
  trainingCardDisabled: {
    opacity: 0.4,
  },
  trainingAccent: {
    width: 3,
    alignSelf: "stretch",
  },
  trainingLeft: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
  },
  trainingIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    flexShrink: 0,
  },
  trainingIcon: {
    fontSize: 22,
  },
  trainingInfo: {
    flex: 1,
    gap: 3,
  },
  trainingName: {
    fontSize: 13,
    fontWeight: "800",
    color: "#FFFFFF",
    letterSpacing: 0.5,
  },
  trainingDesc: {
    fontSize: 11,
    color: "#6B7280",
  },
  benefitPill: {
    alignSelf: "flex-start",
    borderRadius: 4,
    paddingHorizontal: 7,
    paddingVertical: 3,
    marginTop: 4,
  },
  benefitText: {
    fontSize: 10,
    fontWeight: "700",
  },
  trainingRight: {
    paddingRight: 14,
    alignItems: "center",
    gap: 6,
  },
  trainingMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  trainingMetaIcon: {
    fontSize: 11,
  },
  trainingMetaValue: {
    fontSize: 11,
    color: "#9CA3AF",
    fontWeight: "600",
  },
  trainingChevron: {
    fontSize: 22,
    color: "#374151",
    marginTop: 4,
  },

  // Modal sheet
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.7)",
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: "#0D0D0D",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderWidth: 1,
    borderColor: "#1A1A1A",
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 32,
  },
  sheetHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#2A2A2A",
    alignSelf: "center",
    marginBottom: 20,
  },
  sheetHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    marginBottom: 20,
  },
  sheetIconWrap: {
    width: 52,
    height: 52,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
  },
  sheetIcon: { fontSize: 26 },
  sheetTitle: {
    fontSize: 16,
    fontWeight: "900",
    color: "#FFFFFF",
    letterSpacing: 1,
  },
  sheetDesc: {
    fontSize: 12,
    color: "#6B7280",
    marginTop: 2,
  },
  sheetDivider: {
    height: 1,
    backgroundColor: "#1A1A1A",
    marginBottom: 16,
  },
  sheetLabel: {
    fontSize: 10,
    fontWeight: "800",
    color: "#6B7280",
    letterSpacing: 3,
    marginBottom: 10,
  },
  sheetPlayersWrap: {
    gap: 8,
    marginBottom: 16,
  },
  sheetPlayerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "#111",
    borderRadius: 8,
    padding: 10,
  },
  sheetPlayerAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#1A1A1A",
    justifyContent: "center",
    alignItems: "center",
  },
  sheetPlayerAvatarText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#9CA3AF",
  },
  sheetPlayerName: {
    flex: 1,
    fontSize: 13,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  sheetPlayerRole: {
    fontSize: 11,
    color: "#6B7280",
  },
  sheetSummaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#111",
  },
  sheetSummaryLabel: {
    fontSize: 13,
    color: "#6B7280",
  },
  sheetSummaryValue: {
    fontSize: 13,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  sheetActions: {
    flexDirection: "row",
    gap: 12,
    marginTop: 20,
  },
  btnCancel: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 10,
    backgroundColor: "#161616",
    borderWidth: 1,
    borderColor: "#242424",
    alignItems: "center",
  },
  btnCancelText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#6B7280",
    letterSpacing: 1,
  },
  btnConfirm: {
    flex: 2,
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: "center",
  },
  btnConfirmText: {
    fontSize: 13,
    fontWeight: "900",
    color: "#000",
    letterSpacing: 2,
  },

  // Feedback modal
  feedbackCard: {
    width: width - 48,
    borderRadius: 16,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#1A1A1A",
  },
  feedbackGradient: {
    padding: 32,
    alignItems: "center",
    gap: 8,
  },
  feedbackIcon: {
    fontSize: 52,
    marginBottom: 8,
  },
  feedbackTitle: {
    fontSize: 15,
    fontWeight: "900",
    color: "#FFFFFF",
    letterSpacing: 2,
    textAlign: "center",
  },
  feedbackSub: {
    fontSize: 13,
    color: "#9CA3AF",
    textAlign: "center",
  },
});
