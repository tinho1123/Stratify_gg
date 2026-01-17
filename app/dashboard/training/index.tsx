import { LinearGradient } from "expo-linear-gradient";
import React, { useState } from "react";
import {
  Dimensions,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

const { width } = Dimensions.get("window");

interface Player {
  id: string;
  name: string;
  role: string;
  energy: number;
  selected: boolean;
}

interface TrainingType {
  id: string;
  name: string;
  icon: string;
  description: string;
  duration: number;
  energyCost: number;
  benefit: string;
  color: string;
}

export default function TrainingScreen() {
  const [selectedPlayers, setSelectedPlayers] = useState<string[]>([]);
  const [selectedTraining, setSelectedTraining] = useState<TrainingType | null>(
    null,
  );
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [trainingInProgress, setTrainingInProgress] = useState(false);
  const [sessionPoints, setSessionPoints] = useState(100);

  const players: Player[] = [
    { id: "1", name: "Alice", role: "IGL", energy: 85, selected: false },
    { id: "2", name: "Bob", role: "AWPer", energy: 75, selected: false },
    { id: "3", name: "Charlie", role: "Support", energy: 90, selected: false },
    { id: "4", name: "Diana", role: "Entry", energy: 30, selected: false },
    { id: "5", name: "Eve", role: "Flex", energy: 88, selected: false },
  ];

  const trainingTypes: TrainingType[] = [
    {
      id: "1",
      name: "AIM TRAINING",
      icon: "🎯",
      description: "Treino intensivo de mira e precisão",
      duration: 2,
      energyCost: 20,
      benefit: "+5 Precisão, +3 Reação",
      color: "#EF4444",
    },
    {
      id: "2",
      name: "ESTRATÉGIA",
      icon: "🧠",
      description: "Estudo de táticas e map control",
      duration: 3,
      energyCost: 15,
      benefit: "+7 IQ de Jogo, +4 Comunicação",
      color: "#3B82F6",
    },
    {
      id: "3",
      name: "CLUTCH TRAINING",
      icon: "⚡",
      description: "Situações de pressão 1vX",
      duration: 2,
      energyCost: 25,
      benefit: "+6 Mental, +5 Decisão",
      color: "#F59E0B",
    },
    {
      id: "4",
      name: "SPRAY CONTROL",
      icon: "🔫",
      description: "Controle de recuo e spray patterns",
      duration: 2,
      energyCost: 18,
      benefit: "+5 Controle, +4 Consistência",
      color: "#8B5CF6",
    },
    {
      id: "5",
      name: "MOVIMENTO",
      icon: "🏃",
      description: "Peek, strafe e positioning",
      duration: 2,
      energyCost: 20,
      benefit: "+6 Agilidade, +3 Positioning",
      color: "#10B981",
    },
    {
      id: "6",
      name: "TEAM PRACTICE",
      icon: "👥",
      description: "Scrims e treino em equipe",
      duration: 4,
      energyCost: 30,
      benefit: "+8 Sincronia, +6 Química",
      color: "#EC4899",
    },
  ];

  const togglePlayer = (playerId: string) => {
    if (selectedPlayers.includes(playerId)) {
      setSelectedPlayers(selectedPlayers.filter((id) => id !== playerId));
    } else {
      setSelectedPlayers([...selectedPlayers, playerId]);
    }
  };

  const selectAllPlayers = () => {
    const availablePlayers = players
      .filter((p) => p.energy >= 30)
      .map((p) => p.id);
    setSelectedPlayers(availablePlayers);
  };

  const clearSelection = () => {
    setSelectedPlayers([]);
  };

  const handleTrainingSelect = (training: TrainingType) => {
    if (selectedPlayers.length === 0) {
      alert("Selecione pelo menos um jogador!");
      return;
    }
    setSelectedTraining(training);
    setShowConfirmModal(true);
  };

  const startTraining = () => {
    setShowConfirmModal(false);
    setTrainingInProgress(true);

    // Simula conclusão do treino após 3 segundos
    setTimeout(() => {
      setTrainingInProgress(false);
      setSessionPoints(
        sessionPoints -
          (selectedTraining?.energyCost || 0) * selectedPlayers.length,
      );
      alert("Treino concluído com sucesso! 🎉");
      setSelectedPlayers([]);
      setSelectedTraining(null);
    }, 3000);
  };

  const getPlayerById = (id: string) => players.find((p) => p.id === id);

  return (
    <View style={styles.container}>
      {/* Header */}
      <LinearGradient colors={["#10B981", "#059669"]} style={styles.header}>
        <Text style={styles.headerTitle}>CENTRO DE TREINAMENTO</Text>
        <Text style={styles.headerSubtitle}>Desenvolva seu time</Text>

        <View style={styles.pointsCard}>
          <Text style={styles.pointsIcon}>⚡</Text>
          <View>
            <Text style={styles.pointsValue}>{sessionPoints}</Text>
            <Text style={styles.pointsLabel}>Pontos de Energia</Text>
          </View>
        </View>
      </LinearGradient>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Player Selection */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>SELECIONAR JOGADORES</Text>
            <View style={styles.sectionAccent} />
          </View>

          <View style={styles.selectionButtons}>
            <TouchableOpacity
              style={styles.selectionButton}
              onPress={selectAllPlayers}
            >
              <Text style={styles.selectionButtonText}>TODOS</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.selectionButton, styles.selectionButtonSecondary]}
              onPress={clearSelection}
            >
              <Text
                style={[
                  styles.selectionButtonText,
                  styles.selectionButtonTextSecondary,
                ]}
              >
                LIMPAR
              </Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.selectedCount}>
            {selectedPlayers.length} jogador(es) selecionado(s)
          </Text>

          <View style={styles.playersGrid}>
            {players.map((player) => {
              const isSelected = selectedPlayers.includes(player.id);
              const isDisabled = player.energy < 30;

              return (
                <TouchableOpacity
                  key={player.id}
                  style={[
                    styles.playerCard,
                    isSelected && styles.playerCardSelected,
                    isDisabled && styles.playerCardDisabled,
                  ]}
                  onPress={() => !isDisabled && togglePlayer(player.id)}
                  disabled={isDisabled}
                  activeOpacity={0.7}
                >
                  {isSelected && (
                    <View style={styles.selectedBadge}>
                      <Text style={styles.selectedBadgeText}>✓</Text>
                    </View>
                  )}

                  <Text
                    style={[
                      styles.playerCardName,
                      isDisabled && styles.playerCardNameDisabled,
                    ]}
                  >
                    {player.name}
                  </Text>
                  <Text style={styles.playerCardRole}>{player.role}</Text>

                  <View style={styles.energyContainer}>
                    <Text
                      style={[
                        styles.energyLabel,
                        isDisabled && styles.energyLabelLow,
                      ]}
                    >
                      Energia
                    </Text>
                    <View style={styles.energyBar}>
                      <View
                        style={[
                          styles.energyFill,
                          { width: `${player.energy}%` },
                          isDisabled && styles.energyFillLow,
                        ]}
                      />
                    </View>
                    <Text
                      style={[
                        styles.energyValue,
                        isDisabled && styles.energyValueLow,
                      ]}
                    >
                      {player.energy}%
                    </Text>
                  </View>

                  {isDisabled && (
                    <View style={styles.disabledOverlay}>
                      <Text style={styles.disabledText}>Cansado</Text>
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Training Types */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>TIPOS DE TREINAMENTO</Text>
            <View style={styles.sectionAccent} />
          </View>

          {trainingTypes.map((training) => (
            <TouchableOpacity
              key={training.id}
              style={[styles.trainingCard, { borderLeftColor: training.color }]}
              onPress={() => handleTrainingSelect(training)}
              activeOpacity={0.7}
              disabled={selectedPlayers.length === 0}
            >
              <View style={styles.trainingHeader}>
                <View style={styles.trainingInfo}>
                  <Text style={styles.trainingIcon}>{training.icon}</Text>
                  <View>
                    <Text style={styles.trainingName}>{training.name}</Text>
                    <Text style={styles.trainingDescription}>
                      {training.description}
                    </Text>
                  </View>
                </View>
              </View>

              <View style={styles.trainingStats}>
                <View style={styles.trainingStatItem}>
                  <Text style={styles.trainingStatIcon}>⏱️</Text>
                  <Text style={styles.trainingStatText}>
                    {training.duration}h
                  </Text>
                </View>
                <View style={styles.trainingStatItem}>
                  <Text style={styles.trainingStatIcon}>⚡</Text>
                  <Text style={styles.trainingStatText}>
                    -{training.energyCost}%
                  </Text>
                </View>
              </View>

              <View
                style={[
                  styles.trainingBenefit,
                  { backgroundColor: training.color + "20" },
                ]}
              >
                <Text
                  style={[
                    styles.trainingBenefitText,
                    { color: training.color },
                  ]}
                >
                  📈 {training.benefit}
                </Text>
              </View>

              <View style={styles.trainingArrow}>
                <Text style={styles.trainingArrowText}>▶</Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Confirm Training Modal */}
      <Modal
        visible={showConfirmModal}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setShowConfirmModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            {selectedTraining && (
              <>
                <View
                  style={[
                    styles.modalHeader,
                    { backgroundColor: selectedTraining.color },
                  ]}
                >
                  <Text style={styles.modalIcon}>{selectedTraining.icon}</Text>
                  <Text style={styles.modalTitle}>{selectedTraining.name}</Text>
                </View>

                <View style={styles.modalBody}>
                  <Text style={styles.modalDescription}>
                    {selectedTraining.description}
                  </Text>

                  <View style={styles.modalSection}>
                    <Text style={styles.modalSectionTitle}>
                      JOGADORES SELECIONADOS
                    </Text>
                    <View style={styles.modalPlayersList}>
                      {selectedPlayers.map((playerId) => {
                        const player = getPlayerById(playerId);
                        return player ? (
                          <View key={playerId} style={styles.modalPlayerItem}>
                            <Text style={styles.modalPlayerName}>
                              • {player.name}
                            </Text>
                            <Text style={styles.modalPlayerEnergy}>
                              {player.energy}% →{" "}
                              {player.energy - selectedTraining.energyCost}%
                            </Text>
                          </View>
                        ) : null;
                      })}
                    </View>
                  </View>

                  <View style={styles.modalSection}>
                    <Text style={styles.modalSectionTitle}>RESUMO</Text>
                    <View style={styles.modalSummary}>
                      <View style={styles.modalSummaryRow}>
                        <Text style={styles.modalSummaryLabel}>Duração:</Text>
                        <Text style={styles.modalSummaryValue}>
                          {selectedTraining.duration} horas
                        </Text>
                      </View>
                      <View style={styles.modalSummaryRow}>
                        <Text style={styles.modalSummaryLabel}>
                          Custo Total:
                        </Text>
                        <Text style={styles.modalSummaryValue}>
                          {selectedTraining.energyCost * selectedPlayers.length}{" "}
                          energia
                        </Text>
                      </View>
                      <View style={styles.modalSummaryRow}>
                        <Text style={styles.modalSummaryLabel}>Benefício:</Text>
                        <Text
                          style={[
                            styles.modalSummaryValue,
                            { color: selectedTraining.color },
                          ]}
                        >
                          {selectedTraining.benefit}
                        </Text>
                      </View>
                    </View>
                  </View>

                  <View style={styles.modalActions}>
                    <TouchableOpacity
                      style={[styles.modalButton, styles.modalButtonSecondary]}
                      onPress={() => setShowConfirmModal(false)}
                    >
                      <Text style={styles.modalButtonTextSecondary}>
                        CANCELAR
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[
                        styles.modalButton,
                        { backgroundColor: selectedTraining.color },
                      ]}
                      onPress={startTraining}
                    >
                      <Text style={styles.modalButtonText}>INICIAR TREINO</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>

      {/* Training in Progress Modal */}
      <Modal
        visible={trainingInProgress}
        animationType="fade"
        transparent={true}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.progressModal}>
            <LinearGradient
              colors={["#10B981", "#059669"]}
              style={styles.progressGradient}
            >
              <Text style={styles.progressIcon}>⚡</Text>
              <Text style={styles.progressTitle}>TREINAMENTO EM ANDAMENTO</Text>
              <Text style={styles.progressSubtitle}>
                Aguarde enquanto seu time evolui...
              </Text>

              <View style={styles.progressBar}>
                <View style={styles.progressFill} />
              </View>
            </LinearGradient>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000000",
  },

  // Header
  header: {
    padding: 24,
    paddingTop: 60,
    paddingBottom: 24,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#FFFFFF",
    letterSpacing: 2,
  },
  headerSubtitle: {
    fontSize: 14,
    color: "#D1FAE5",
    marginTop: 4,
  },
  pointsCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.2)",
    padding: 16,
    borderRadius: 8,
    marginTop: 20,
    gap: 12,
  },
  pointsIcon: {
    fontSize: 32,
  },
  pointsValue: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#FFFFFF",
  },
  pointsLabel: {
    fontSize: 12,
    color: "#D1FAE5",
  },

  // Content
  content: {
    flex: 1,
  },

  // Section
  section: {
    padding: 20,
  },
  sectionHeader: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: "bold",
    color: "#10B981",
    letterSpacing: 2,
  },
  sectionAccent: {
    width: 60,
    height: 2,
    backgroundColor: "#10B981",
    marginTop: 4,
  },

  // Selection Buttons
  selectionButtons: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 12,
  },
  selectionButton: {
    flex: 1,
    backgroundColor: "#10B981",
    padding: 12,
    borderRadius: 8,
    alignItems: "center",
  },
  selectionButtonSecondary: {
    backgroundColor: "#0A0A0A",
    borderWidth: 1,
    borderColor: "#1F1F1F",
  },
  selectionButtonText: {
    fontSize: 12,
    fontWeight: "bold",
    color: "#000000",
    letterSpacing: 1,
  },
  selectionButtonTextSecondary: {
    color: "#6B7280",
  },
  selectedCount: {
    fontSize: 12,
    color: "#6B7280",
    marginBottom: 16,
  },

  // Players Grid
  playersGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  playerCard: {
    width: (width - 52) / 2,
    backgroundColor: "#0A0A0A",
    padding: 16,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: "#1F1F1F",
    position: "relative",
  },
  playerCardSelected: {
    borderColor: "#10B981",
    backgroundColor: "#10B98110",
  },
  playerCardDisabled: {
    opacity: 0.5,
  },
  selectedBadge: {
    position: "absolute",
    top: 8,
    right: 8,
    backgroundColor: "#10B981",
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  selectedBadgeText: {
    color: "#000000",
    fontSize: 14,
    fontWeight: "bold",
  },
  playerCardName: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#FFFFFF",
    marginBottom: 4,
  },
  playerCardNameDisabled: {
    color: "#6B7280",
  },
  playerCardRole: {
    fontSize: 12,
    color: "#6B7280",
    marginBottom: 12,
  },
  energyContainer: {
    gap: 4,
  },
  energyLabel: {
    fontSize: 10,
    color: "#10B981",
    fontWeight: "bold",
  },
  energyLabelLow: {
    color: "#EF4444",
  },
  energyBar: {
    height: 6,
    backgroundColor: "#1F1F1F",
    borderRadius: 3,
    overflow: "hidden",
  },
  energyFill: {
    height: "100%",
    backgroundColor: "#10B981",
  },
  energyFillLow: {
    backgroundColor: "#EF4444",
  },
  energyValue: {
    fontSize: 12,
    fontWeight: "bold",
    color: "#10B981",
    textAlign: "right",
  },
  energyValueLow: {
    color: "#EF4444",
  },
  disabledOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0,0,0,0.7)",
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 8,
  },
  disabledText: {
    color: "#EF4444",
    fontSize: 12,
    fontWeight: "bold",
  },

  // Training Card
  trainingCard: {
    backgroundColor: "#0A0A0A",
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
    borderLeftWidth: 4,
    position: "relative",
  },
  trainingHeader: {
    marginBottom: 12,
  },
  trainingInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  trainingIcon: {
    fontSize: 36,
  },
  trainingName: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#FFFFFF",
    letterSpacing: 1,
  },
  trainingDescription: {
    fontSize: 12,
    color: "#6B7280",
    marginTop: 2,
  },
  trainingStats: {
    flexDirection: "row",
    gap: 16,
    marginBottom: 12,
  },
  trainingStatItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  trainingStatIcon: {
    fontSize: 16,
  },
  trainingStatText: {
    fontSize: 12,
    color: "#D1D5DB",
    fontWeight: "600",
  },
  trainingBenefit: {
    padding: 8,
    borderRadius: 4,
  },
  trainingBenefitText: {
    fontSize: 12,
    fontWeight: "bold",
  },
  trainingArrow: {
    position: "absolute",
    right: 16,
    top: "50%",
    marginTop: -12,
  },
  trainingArrowText: {
    fontSize: 20,
    color: "#1F1F1F",
  },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.95)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalContent: {
    width: width - 40,
    backgroundColor: "#000000",
    borderRadius: 12,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#1F1F1F",
  },
  modalHeader: {
    padding: 24,
    alignItems: "center",
  },
  modalIcon: {
    fontSize: 48,
    marginBottom: 12,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#FFFFFF",
    letterSpacing: 1,
  },
  modalBody: {
    padding: 20,
  },
  modalDescription: {
    fontSize: 14,
    color: "#D1D5DB",
    textAlign: "center",
    marginBottom: 24,
  },
  modalSection: {
    marginBottom: 20,
  },
  modalSectionTitle: {
    fontSize: 12,
    fontWeight: "bold",
    color: "#10B981",
    letterSpacing: 1,
    marginBottom: 12,
  },
  modalPlayersList: {
    backgroundColor: "#0A0A0A",
    padding: 16,
    borderRadius: 8,
    gap: 8,
  },
  modalPlayerItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  modalPlayerName: {
    fontSize: 14,
    color: "#FFFFFF",
  },
  modalPlayerEnergy: {
    fontSize: 12,
    color: "#6B7280",
  },
  modalSummary: {
    backgroundColor: "#0A0A0A",
    padding: 16,
    borderRadius: 8,
    gap: 12,
  },
  modalSummaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  modalSummaryLabel: {
    fontSize: 14,
    color: "#6B7280",
  },
  modalSummaryValue: {
    fontSize: 14,
    fontWeight: "bold",
    color: "#FFFFFF",
  },
  modalActions: {
    flexDirection: "row",
    gap: 12,
    marginTop: 20,
  },
  modalButton: {
    flex: 1,
    padding: 16,
    borderRadius: 8,
    alignItems: "center",
  },
  modalButtonSecondary: {
    backgroundColor: "#0A0A0A",
    borderWidth: 1,
    borderColor: "#1F1F1F",
  },
  modalButtonText: {
    fontSize: 14,
    fontWeight: "bold",
    color: "#000000",
    letterSpacing: 1,
  },
  modalButtonTextSecondary: {
    color: "#6B7280",
  },

  // Progress Modal
  progressModal: {
    width: width - 80,
    borderRadius: 12,
    overflow: "hidden",
  },
  progressGradient: {
    padding: 32,
    alignItems: "center",
  },
  progressIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  progressTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#FFFFFF",
    letterSpacing: 1,
    marginBottom: 8,
  },
  progressSubtitle: {
    fontSize: 14,
    color: "#D1FAE5",
    marginBottom: 24,
  },
  progressBar: {
    width: "100%",
    height: 8,
    backgroundColor: "rgba(0,0,0,0.3)",
    borderRadius: 4,
    overflow: "hidden",
  },
  progressFill: {
    width: "100%",
    height: "100%",
    backgroundColor: "#FFFFFF",
  },
});
