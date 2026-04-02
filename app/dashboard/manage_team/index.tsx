import { supabase } from "@/database/supabase";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
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

const { width } = Dimensions.get("window");

interface PlayerSkill {
  skill_name: string;
  value: number;
}

interface Player {
  id: string;
  name: string;
  role: string;
  status: "online" | "offline" | "injured" | "banned";
  rating: number;
  salary: number;
  contract: string;
  age: number;
  energy: number;
  morale: number;
  form: number;
  kills: number;
  deaths: number;
  assists: number;
  adr: number;
  skills?: PlayerSkill[];
}

const SKILL_ORDER = [
  "Mira",
  "Leitura de Jogo",
  "Comunicação",
  "Clutch",
  "Uso de Utilitários",
  "Posicionamento",
];

export default function ManageTeamScreen() {
  const [players, setPlayers] = useState<Player[]>([]);
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null);
  const [showPlayerModal, setShowPlayerModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingSkills, setLoadingSkills] = useState(false);

  const fetchPlayers = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("players")
      .select("*")
      .order("name");

    if (!error && data) {
      setPlayers(data as Player[]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchPlayers();
  }, [fetchPlayers]);

  const handlePlayerPress = async (player: Player) => {
    setSelectedPlayer(player);
    setShowPlayerModal(true);

    if (!player.skills) {
      setLoadingSkills(true);
      const { data, error } = await supabase
        .from("player_skills")
        .select("skill_name, value")
        .eq("player_id", player.id)
        .order("skill_name");

      if (!error && data) {
        const skills = data as PlayerSkill[];
        const updated = { ...player, skills };
        setSelectedPlayer(updated);
        setPlayers((prev) =>
          prev.map((p) => (p.id === player.id ? updated : p))
        );
      }
      setLoadingSkills(false);
    }
  };

  const avgRating =
    players.length > 0
      ? (players.reduce((s, p) => s + p.rating, 0) / players.length).toFixed(1)
      : "—";

  const totalSalary = players.reduce((s, p) => s + p.salary, 0);

  const avgMorale =
    players.length > 0
      ? Math.round(players.reduce((s, p) => s + p.morale, 0) / players.length)
      : 0;

  const avgEnergy =
    players.length > 0
      ? Math.round(players.reduce((s, p) => s + p.energy, 0) / players.length)
      : 0;

  const avgForm =
    players.length > 0
      ? Math.round(players.reduce((s, p) => s + p.form, 0) / players.length)
      : 0;

  const getStatusColor = (status: string) => {
    switch (status) {
      case "online":
        return "#10B981";
      case "offline":
        return "#6B7280";
      case "injured":
        return "#EF4444";
      case "banned":
        return "#F59E0B";
      default:
        return "#6B7280";
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case "online":
        return "DISPONÍVEL";
      case "offline":
        return "OFFLINE";
      case "injured":
        return "LESIONADO";
      case "banned":
        return "SUSPENSO";
      default:
        return status.toUpperCase();
    }
  };

  const getSkillColor = (value: number) => {
    if (value >= 90) return "#10B981";
    if (value >= 75) return "#3B82F6";
    if (value >= 60) return "#F59E0B";
    return "#EF4444";
  };

  const sortedSkills = (skills: PlayerSkill[]) =>
    [...skills].sort(
      (a, b) => SKILL_ORDER.indexOf(a.skill_name) - SKILL_ORDER.indexOf(b.skill_name)
    );

  return (
    <View style={styles.container}>
      {/* Header */}
      <LinearGradient colors={["#10B981", "#059669"]} style={styles.header}>
        <Text style={styles.headerTitle}>GERENCIAR TIME</Text>
        <Text style={styles.headerSubtitle}>Stratify Esports</Text>

        <View style={styles.headerStats}>
          <View style={styles.headerStatItem}>
            <Text style={styles.headerStatValue}>{avgRating}</Text>
            <Text style={styles.headerStatLabel}>Rating Médio</Text>
          </View>
          <View style={styles.headerStatDivider} />
          <View style={styles.headerStatItem}>
            <Text style={styles.headerStatValue}>
              ${(totalSalary / 1000).toFixed(0)}K
            </Text>
            <Text style={styles.headerStatLabel}>Folha Salarial</Text>
          </View>
          <View style={styles.headerStatDivider} />
          <View style={styles.headerStatItem}>
            <Text style={styles.headerStatValue}>{players.length}/5</Text>
            <Text style={styles.headerStatLabel}>Jogadores</Text>
          </View>
        </View>
      </LinearGradient>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Action Buttons */}
        <View style={styles.actionButtons}>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => router.push("/dashboard/market")}
          >
            <Text style={styles.actionButtonIcon}>➕</Text>
            <Text style={styles.actionButtonText}>CONTRATAR</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => router.push("/dashboard/training")}
          >
            <Text style={styles.actionButtonIcon}>🎯</Text>
            <Text style={styles.actionButtonText}>TREINAR</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionButton}>
            <Text style={styles.actionButtonIcon}>📋</Text>
            <Text style={styles.actionButtonText}>TÁTICAS</Text>
          </TouchableOpacity>
        </View>

        {/* Team Overview */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>VISÃO GERAL</Text>
            <View style={styles.sectionAccent} />
          </View>

          <View style={styles.overviewGrid}>
            <View style={styles.overviewCard}>
              <Text style={styles.overviewValue}>{avgMorale}%</Text>
              <Text style={styles.overviewLabel}>Moral Geral</Text>
              <View style={[styles.overviewBar, { width: `${avgMorale}%` }]} />
            </View>
            <View style={styles.overviewCard}>
              <Text style={styles.overviewValue}>{avgEnergy}%</Text>
              <Text style={styles.overviewLabel}>Energia Média</Text>
              <View style={[styles.overviewBar, { width: `${avgEnergy}%` }]} />
            </View>
            <View style={styles.overviewCard}>
              <Text style={styles.overviewValue}>{avgForm}%</Text>
              <Text style={styles.overviewLabel}>Forma Atual</Text>
              <View style={[styles.overviewBar, { width: `${avgForm}%` }]} />
            </View>
          </View>
        </View>

        {/* Players List */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>ELENCO PRINCIPAL</Text>
            <View style={styles.sectionAccent} />
          </View>

          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#10B981" />
              <Text style={styles.loadingText}>Carregando jogadores...</Text>
            </View>
          ) : (
            players.map((player) => (
              <TouchableOpacity
                key={player.id}
                style={styles.playerCard}
                onPress={() => handlePlayerPress(player)}
                activeOpacity={0.7}
              >
                <View style={styles.playerHeader}>
                  <View style={styles.playerBasicInfo}>
                    <View
                      style={[
                        styles.statusDot,
                        { backgroundColor: getStatusColor(player.status) },
                      ]}
                    />
                    <View>
                      <Text style={styles.playerName}>{player.name}</Text>
                      <Text style={styles.playerRole}>
                        {player.role} • {player.age} anos
                      </Text>
                    </View>
                  </View>
                  <View style={styles.playerRatingBadge}>
                    <Text style={styles.playerRatingText}>{player.rating}</Text>
                  </View>
                </View>

                <View
                  style={[
                    styles.playerStatus,
                    { backgroundColor: getStatusColor(player.status) + "20" },
                  ]}
                >
                  <Text
                    style={[
                      styles.playerStatusText,
                      { color: getStatusColor(player.status) },
                    ]}
                  >
                    {getStatusText(player.status)}
                  </Text>
                </View>

                <View style={styles.playerStats}>
                  <View style={styles.playerStatItem}>
                    <Text style={styles.playerStatLabel}>K/D</Text>
                    <Text style={styles.playerStatValue}>
                      {player.deaths > 0
                        ? (player.kills / player.deaths).toFixed(2)
                        : "—"}
                    </Text>
                  </View>
                  <View style={styles.playerStatItem}>
                    <Text style={styles.playerStatLabel}>ADR</Text>
                    <Text style={styles.playerStatValue}>{player.adr}</Text>
                  </View>
                  <View style={styles.playerStatItem}>
                    <Text style={styles.playerStatLabel}>Assists</Text>
                    <Text style={styles.playerStatValue}>{player.assists}</Text>
                  </View>
                </View>

                <View style={styles.playerMetrics}>
                  <View style={styles.metricMini}>
                    <Text style={styles.metricMiniLabel}>Energia</Text>
                    <View style={styles.metricMiniBar}>
                      <View
                        style={[
                          styles.metricMiniFill,
                          { width: `${player.energy}%` },
                        ]}
                      />
                    </View>
                  </View>
                  <View style={styles.metricMini}>
                    <Text style={styles.metricMiniLabel}>Moral</Text>
                    <View style={styles.metricMiniBar}>
                      <View
                        style={[
                          styles.metricMiniFill,
                          { width: `${player.morale}%` },
                        ]}
                      />
                    </View>
                  </View>
                  <View style={styles.metricMini}>
                    <Text style={styles.metricMiniLabel}>Forma</Text>
                    <View style={styles.metricMiniBar}>
                      <View
                        style={[
                          styles.metricMiniFill,
                          { width: `${player.form}%` },
                        ]}
                      />
                    </View>
                  </View>
                </View>

                <View style={styles.playerFooter}>
                  <Text style={styles.playerContract}>
                    📄 Contrato: {player.contract}
                  </Text>
                  <Text style={styles.playerSalary}>
                    💰 ${player.salary.toLocaleString()}/mês
                  </Text>
                </View>

                <View style={styles.playerArrow}>
                  <Text style={styles.playerArrowText}>›</Text>
                </View>
              </TouchableOpacity>
            ))
          )}
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Player Detail Modal */}
      <Modal
        visible={showPlayerModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowPlayerModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            {selectedPlayer && (
              <>
                <LinearGradient
                  colors={["#10B981", "#059669"]}
                  style={styles.modalHeader}
                >
                  <Text style={styles.modalPlayerName}>
                    {selectedPlayer.name}
                  </Text>
                  <Text style={styles.modalPlayerRole}>
                    {selectedPlayer.role}
                  </Text>
                  <View style={styles.modalRating}>
                    <Text style={styles.modalRatingText}>
                      {selectedPlayer.rating}
                    </Text>
                  </View>
                </LinearGradient>

                <ScrollView style={styles.modalBody}>
                  {/* Informações */}
                  <View style={styles.modalSection}>
                    <Text style={styles.modalSectionTitle}>INFORMAÇÕES</Text>
                    <View style={styles.modalInfo}>
                      <Text style={styles.modalInfoText}>
                        Idade: {selectedPlayer.age} anos
                      </Text>
                      <Text style={styles.modalInfoText}>
                        Contrato: {selectedPlayer.contract}
                      </Text>
                      <Text style={styles.modalInfoText}>
                        Salário: ${selectedPlayer.salary.toLocaleString()}/mês
                      </Text>
                      <Text
                        style={[
                          styles.modalInfoText,
                          { color: getStatusColor(selectedPlayer.status) },
                        ]}
                      >
                        Status: {getStatusText(selectedPlayer.status)}
                      </Text>
                    </View>
                  </View>

                  {/* Estatísticas */}
                  <View style={styles.modalSection}>
                    <Text style={styles.modalSectionTitle}>ESTATÍSTICAS</Text>
                    <View style={styles.modalStatsGrid}>
                      <View style={styles.modalStatCard}>
                        <Text style={styles.modalStatValue}>
                          {selectedPlayer.kills}
                        </Text>
                        <Text style={styles.modalStatLabel}>Kills</Text>
                      </View>
                      <View style={styles.modalStatCard}>
                        <Text style={styles.modalStatValue}>
                          {selectedPlayer.deaths}
                        </Text>
                        <Text style={styles.modalStatLabel}>Deaths</Text>
                      </View>
                      <View style={styles.modalStatCard}>
                        <Text style={styles.modalStatValue}>
                          {selectedPlayer.assists}
                        </Text>
                        <Text style={styles.modalStatLabel}>Assists</Text>
                      </View>
                      <View style={styles.modalStatCard}>
                        <Text style={styles.modalStatValue}>
                          {selectedPlayer.adr}
                        </Text>
                        <Text style={styles.modalStatLabel}>ADR</Text>
                      </View>
                    </View>
                  </View>

                  {/* Skills */}
                  <View style={styles.modalSection}>
                    <Text style={styles.modalSectionTitle}>SKILLS</Text>

                    {loadingSkills ? (
                      <View style={styles.skillsLoading}>
                        <ActivityIndicator size="small" color="#10B981" />
                        <Text style={styles.skillsLoadingText}>
                          Carregando skills...
                        </Text>
                      </View>
                    ) : selectedPlayer.skills &&
                      selectedPlayer.skills.length > 0 ? (
                      <View style={styles.skillsContainer}>
                        {sortedSkills(selectedPlayer.skills).map((skill) => (
                          <View key={skill.skill_name} style={styles.skillItem}>
                            <View style={styles.skillHeader}>
                              <Text style={styles.skillName}>
                                {skill.skill_name}
                              </Text>
                              <Text
                                style={[
                                  styles.skillValue,
                                  { color: getSkillColor(skill.value) },
                                ]}
                              >
                                {skill.value}
                              </Text>
                            </View>
                            <View style={styles.skillBar}>
                              <View
                                style={[
                                  styles.skillBarFill,
                                  {
                                    width: `${skill.value}%`,
                                    backgroundColor: getSkillColor(skill.value),
                                  },
                                ]}
                              />
                            </View>
                          </View>
                        ))}
                      </View>
                    ) : (
                      <Text style={styles.skillsEmpty}>
                        Nenhuma skill registrada.
                      </Text>
                    )}
                  </View>

                  {/* Condição */}
                  <View style={styles.modalSection}>
                    <Text style={styles.modalSectionTitle}>CONDIÇÃO</Text>
                    <View style={styles.modalMetrics}>
                      {(
                        [
                          { label: "Energia", value: selectedPlayer.energy },
                          { label: "Moral", value: selectedPlayer.morale },
                          { label: "Forma", value: selectedPlayer.form },
                        ] as const
                      ).map(({ label, value }) => (
                        <View key={label} style={styles.modalMetricItem}>
                          <Text style={styles.modalMetricLabel}>{label}</Text>
                          <View style={styles.modalMetricBar}>
                            <View
                              style={[
                                styles.modalMetricFill,
                                { width: `${value}%` },
                              ]}
                            />
                          </View>
                          <Text style={styles.modalMetricValue}>{value}%</Text>
                        </View>
                      ))}
                    </View>
                  </View>

                  {/* Ações */}
                  <View style={styles.modalActions}>
                    <TouchableOpacity style={styles.modalActionButton}>
                      <Text style={styles.modalActionButtonText}>
                        🎯 TREINAR
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.modalActionButton}>
                      <Text style={styles.modalActionButtonText}>
                        💬 CONVERSAR
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[
                        styles.modalActionButton,
                        styles.modalActionButtonDanger,
                      ]}
                    >
                      <Text
                        style={[
                          styles.modalActionButtonText,
                          styles.modalActionButtonDangerText,
                        ]}
                      >
                        🔄 VENDER
                      </Text>
                    </TouchableOpacity>
                  </View>
                </ScrollView>

                <TouchableOpacity
                  style={styles.modalCloseButton}
                  onPress={() => setShowPlayerModal(false)}
                >
                  <Text style={styles.modalCloseButtonText}>FECHAR</Text>
                </TouchableOpacity>
              </>
            )}
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
  headerStats: {
    flexDirection: "row",
    justifyContent: "space-around",
    marginTop: 20,
    backgroundColor: "rgba(0,0,0,0.2)",
    padding: 16,
    borderRadius: 8,
  },
  headerStatItem: {
    alignItems: "center",
  },
  headerStatValue: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#FFFFFF",
  },
  headerStatLabel: {
    fontSize: 11,
    color: "#D1FAE5",
    marginTop: 4,
  },
  headerStatDivider: {
    width: 1,
    backgroundColor: "rgba(255,255,255,0.2)",
  },

  // Content
  content: {
    flex: 1,
  },

  // Action Buttons
  actionButtons: {
    flexDirection: "row",
    padding: 20,
    gap: 12,
  },
  actionButton: {
    flex: 1,
    backgroundColor: "#0A0A0A",
    padding: 16,
    borderRadius: 8,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#1F1F1F",
  },
  actionButtonIcon: {
    fontSize: 24,
    marginBottom: 8,
  },
  actionButtonText: {
    color: "#10B981",
    fontSize: 11,
    fontWeight: "bold",
    letterSpacing: 1,
  },

  // Section
  section: {
    padding: 20,
    paddingTop: 0,
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

  // Overview
  overviewGrid: {
    flexDirection: "row",
    gap: 12,
  },
  overviewCard: {
    flex: 1,
    backgroundColor: "#0A0A0A",
    padding: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#1F1F1F",
  },
  overviewValue: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#10B981",
    marginBottom: 4,
  },
  overviewLabel: {
    fontSize: 10,
    color: "#6B7280",
    marginBottom: 8,
  },
  overviewBar: {
    height: 3,
    backgroundColor: "#10B981",
    borderRadius: 2,
  },

  // Loading
  loadingContainer: {
    alignItems: "center",
    paddingVertical: 40,
    gap: 12,
  },
  loadingText: {
    color: "#6B7280",
    fontSize: 14,
  },

  // Player Card
  playerCard: {
    backgroundColor: "#0A0A0A",
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#1F1F1F",
    position: "relative",
  },
  playerHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 12,
  },
  playerBasicInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  playerName: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#FFFFFF",
  },
  playerRole: {
    fontSize: 12,
    color: "#6B7280",
    marginTop: 2,
  },
  playerRatingBadge: {
    backgroundColor: "#10B981",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 4,
  },
  playerRatingText: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#000000",
  },
  playerStatus: {
    padding: 8,
    borderRadius: 4,
    marginBottom: 12,
  },
  playerStatusText: {
    fontSize: 11,
    fontWeight: "bold",
    textAlign: "center",
    letterSpacing: 1,
  },
  playerStats: {
    flexDirection: "row",
    justifyContent: "space-around",
    marginBottom: 12,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: "#1F1F1F",
  },
  playerStatItem: {
    alignItems: "center",
  },
  playerStatLabel: {
    fontSize: 10,
    color: "#6B7280",
    marginBottom: 4,
  },
  playerStatValue: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#10B981",
  },
  playerMetrics: {
    gap: 8,
    marginBottom: 12,
  },
  metricMini: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  metricMiniLabel: {
    fontSize: 11,
    color: "#6B7280",
    width: 60,
  },
  metricMiniBar: {
    flex: 1,
    height: 6,
    backgroundColor: "#1F1F1F",
    borderRadius: 3,
    overflow: "hidden",
  },
  metricMiniFill: {
    height: "100%",
    backgroundColor: "#10B981",
  },
  playerFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  playerContract: {
    fontSize: 11,
    color: "#6B7280",
  },
  playerSalary: {
    fontSize: 11,
    color: "#10B981",
    fontWeight: "bold",
  },
  playerArrow: {
    position: "absolute",
    right: 16,
    top: "50%",
    marginTop: -12,
  },
  playerArrowText: {
    fontSize: 32,
    color: "#1F1F1F",
  },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.9)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: "#000000",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: "90%",
  },
  modalHeader: {
    padding: 24,
    alignItems: "center",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  modalPlayerName: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#FFFFFF",
    marginBottom: 4,
  },
  modalPlayerRole: {
    fontSize: 14,
    color: "#D1FAE5",
  },
  modalRating: {
    backgroundColor: "rgba(0,0,0,0.3)",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    marginTop: 12,
  },
  modalRatingText: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#FFFFFF",
  },
  modalBody: {
    padding: 20,
  },
  modalSection: {
    marginBottom: 24,
  },
  modalSectionTitle: {
    fontSize: 12,
    fontWeight: "bold",
    color: "#10B981",
    letterSpacing: 2,
    marginBottom: 12,
  },
  modalInfo: {
    backgroundColor: "#0A0A0A",
    padding: 16,
    borderRadius: 8,
    gap: 8,
  },
  modalInfoText: {
    fontSize: 14,
    color: "#D1D5DB",
  },
  modalStatsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  modalStatCard: {
    width: (width - 64) / 2,
    backgroundColor: "#0A0A0A",
    padding: 16,
    borderRadius: 8,
    alignItems: "center",
  },
  modalStatValue: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#10B981",
    marginBottom: 4,
  },
  modalStatLabel: {
    fontSize: 12,
    color: "#6B7280",
  },

  // Skills
  skillsContainer: {
    backgroundColor: "#0A0A0A",
    padding: 16,
    borderRadius: 8,
    gap: 16,
  },
  skillItem: {
    gap: 6,
  },
  skillHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  skillName: {
    fontSize: 13,
    color: "#D1D5DB",
    fontWeight: "500",
  },
  skillValue: {
    fontSize: 14,
    fontWeight: "bold",
  },
  skillBar: {
    height: 8,
    backgroundColor: "#1F1F1F",
    borderRadius: 4,
    overflow: "hidden",
  },
  skillBarFill: {
    height: "100%",
    borderRadius: 4,
  },
  skillsLoading: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 16,
    backgroundColor: "#0A0A0A",
    borderRadius: 8,
  },
  skillsLoadingText: {
    color: "#6B7280",
    fontSize: 13,
  },
  skillsEmpty: {
    color: "#6B7280",
    fontSize: 13,
    padding: 16,
    backgroundColor: "#0A0A0A",
    borderRadius: 8,
  },

  // Metrics
  modalMetrics: {
    gap: 16,
  },
  modalMetricItem: {
    backgroundColor: "#0A0A0A",
    padding: 16,
    borderRadius: 8,
  },
  modalMetricLabel: {
    fontSize: 12,
    color: "#6B7280",
    marginBottom: 8,
  },
  modalMetricBar: {
    height: 8,
    backgroundColor: "#1F1F1F",
    borderRadius: 4,
    overflow: "hidden",
    marginBottom: 8,
  },
  modalMetricFill: {
    height: "100%",
    backgroundColor: "#10B981",
  },
  modalMetricValue: {
    fontSize: 14,
    fontWeight: "bold",
    color: "#10B981",
    textAlign: "right",
  },

  // Modal Actions
  modalActions: {
    gap: 12,
    marginBottom: 20,
  },
  modalActionButton: {
    backgroundColor: "#10B981",
    padding: 16,
    borderRadius: 8,
    alignItems: "center",
  },
  modalActionButtonText: {
    fontSize: 14,
    fontWeight: "bold",
    color: "#000000",
    letterSpacing: 1,
  },
  modalActionButtonDanger: {
    backgroundColor: "#0A0A0A",
    borderWidth: 1,
    borderColor: "#EF4444",
  },
  modalActionButtonDangerText: {
    color: "#EF4444",
  },
  modalCloseButton: {
    backgroundColor: "#1F1F1F",
    padding: 16,
    alignItems: "center",
    borderTopWidth: 1,
    borderTopColor: "#0A0A0A",
  },
  modalCloseButtonText: {
    fontSize: 14,
    fontWeight: "bold",
    color: "#6B7280",
    letterSpacing: 1,
  },
});
