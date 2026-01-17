import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import React, { useState } from "react";
import {
  Dimensions,
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
  status: "online" | "offline" | "injured" | "banned";
  rating: number;
}

interface NewsItem {
  id: string;
  type: "alert" | "info" | "success";
  message: string;
  icon: string;
}

export default function HomeScreen() {
  const [timeLeft, setTimeLeft] = useState({
    days: 2,
    hours: 14,
    minutes: 32,
  });

  const players: Player[] = [
    { id: "1", name: "Alice", role: "IGL", status: "online", rating: 92 },
    { id: "2", name: "Bob", role: "AWPer", status: "online", rating: 88 },
    { id: "3", name: "Charlie", role: "Support", status: "online", rating: 85 },
    { id: "4", name: "Diana", role: "Entry", status: "injured", rating: 90 },
    { id: "5", name: "Eve", role: "Flex", status: "online", rating: 87 },
  ];

  const news: NewsItem[] = [
    {
      id: "1",
      type: "alert",
      message: "Diana está machucada! Tempo estimado: 7 dias",
      icon: "🏥",
    },
    {
      id: "2",
      type: "info",
      message: "Proposta de patrocínio: $50.000/mês da HyperX",
      icon: "💼",
    },
    {
      id: "3",
      type: "success",
      message: "Seu time subiu para #12 no ranking mundial!",
      icon: "📈",
    },
  ];

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      {/* HERO - Próximo Jogo */}
      <LinearGradient
        colors={["#10B981", "#059669", "#047857"]}
        style={styles.heroContainer}
      >
        <View style={styles.heroContent}>
          <Text style={styles.heroLabel}>PRÓXIMA PARTIDA</Text>
          <Text style={styles.heroTitle}>FINAL DO TORNEIO</Text>
          <Text style={styles.heroOpponent}>vs. Team Liquid</Text>

          {/* Countdown */}
          <View style={styles.countdown}>
            <View style={styles.countdownItem}>
              <Text style={styles.countdownNumber}>{timeLeft.days}</Text>
              <Text style={styles.countdownLabel}>DIAS</Text>
            </View>
            <Text style={styles.countdownSeparator}>:</Text>
            <View style={styles.countdownItem}>
              <Text style={styles.countdownNumber}>{timeLeft.hours}</Text>
              <Text style={styles.countdownLabel}>HORAS</Text>
            </View>
            <Text style={styles.countdownSeparator}>:</Text>
            <View style={styles.countdownItem}>
              <Text style={styles.countdownNumber}>{timeLeft.minutes}</Text>
              <Text style={styles.countdownLabel}>MIN</Text>
            </View>
          </View>

          <TouchableOpacity style={styles.heroButton}>
            <Text style={styles.heroButtonText}>VER DETALHES</Text>
          </TouchableOpacity>
        </View>
      </LinearGradient>

      {/* Stats Rápidos */}
      <View style={styles.quickStats}>
        <View style={styles.statCard}>
          <Text style={styles.statIcon}>💰</Text>
          <Text style={styles.statValue}>$125K</Text>
          <Text style={styles.statLabel}>Orçamento</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statIcon}>🏆</Text>
          <Text style={styles.statValue}>#12</Text>
          <Text style={styles.statLabel}>Ranking</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statIcon}>👥</Text>
          <Text style={styles.statValue}>89K</Text>
          <Text style={styles.statLabel}>Fãs</Text>
        </View>
      </View>

      {/* Notícias/Alertas */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>NOTÍCIAS & ALERTAS</Text>
          <View style={styles.sectionAccent} />
        </View>

        {news.map((item) => (
          <TouchableOpacity
            key={item.id}
            style={[
              styles.newsCard,
              item.type === "alert" && styles.newsCardAlert,
              item.type === "success" && styles.newsCardSuccess,
            ]}
          >
            <Text style={styles.newsIcon}>{item.icon}</Text>
            <Text style={styles.newsText}>{item.message}</Text>
            <Text style={styles.newsArrow}>›</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Time Principal */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>TIME PRINCIPAL</Text>
          <View style={styles.sectionAccent} />
        </View>

        <View style={styles.teamCard}>
          <View style={styles.teamHeader}>
            <View>
              <Text style={styles.teamName}>STRATIFY ESPORTS</Text>
              <Text style={styles.teamStats}>
                Rating Médio: 88.4 • Forma: ↑
              </Text>
            </View>
            <TouchableOpacity
              style={styles.manageButton}
              onPress={() => router.push("/dashboard/manage_team")}
            >
              <Text style={styles.manageButtonText}>GERENCIAR</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.playersList}>
            {players.map((player) => (
              <View key={player.id} style={styles.playerRow}>
                <View
                  style={[
                    styles.statusDot,
                    player.status === "online" && styles.statusOnline,
                    player.status === "injured" && styles.statusInjured,
                    player.status === "offline" && styles.statusOffline,
                  ]}
                />
                <Text style={styles.playerName}>{player.name}</Text>
                <Text style={styles.playerRole}>{player.role}</Text>
                <View style={styles.playerRating}>
                  <Text style={styles.playerRatingText}>{player.rating}</Text>
                </View>
              </View>
            ))}
          </View>
        </View>
      </View>

      {/* Ações Rápidas */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>AÇÕES RÁPIDAS</Text>
          <View style={styles.sectionAccent} />
        </View>

        <View style={styles.actionsGrid}>
          <TouchableOpacity
            style={styles.actionCard}
            onPress={() => router.push("/dashboard/training")}
          >
            <Text style={styles.actionIcon}>🎯</Text>
            <Text style={styles.actionTitle}>TREINAR</Text>
            <Text style={styles.actionSubtitle}>Melhorar habilidades</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionCard}
            onPress={() => router.push("/dashboard/market")}
          >
            <Text style={styles.actionIcon}>🏪</Text>
            <Text style={styles.actionTitle}>MERCADO</Text>
            <Text style={styles.actionSubtitle}>Contratar jogadores</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.actionCard}>
            <Text style={styles.actionIcon}>📋</Text>
            <Text style={styles.actionTitle}>TÁTICAS</Text>
            <Text style={styles.actionSubtitle}>Estratégias do time</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.actionCard}>
            <Text style={styles.actionIcon}>🎮</Text>
            <Text style={styles.actionTitle}>PARTIDAS</Text>
            <Text style={styles.actionSubtitle}>Ver calendário</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Métricas do Time */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>PERFORMANCE</Text>
          <View style={styles.sectionAccent} />
        </View>

        <View style={styles.metricsRow}>
          <View style={styles.metricCard}>
            <Text style={styles.metricValue}>85%</Text>
            <Text style={styles.metricLabel}>Moral</Text>
            <View style={[styles.metricBar, { width: "85%" }]} />
          </View>

          <View style={styles.metricCard}>
            <Text style={styles.metricValue}>92%</Text>
            <Text style={styles.metricLabel}>Forma</Text>
            <View style={[styles.metricBar, { width: "92%" }]} />
          </View>

          <View style={styles.metricCard}>
            <Text style={styles.metricValue}>78%</Text>
            <Text style={styles.metricLabel}>Hype</Text>
            <View style={[styles.metricBar, { width: "78%" }]} />
          </View>
        </View>
      </View>

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000000",
  },

  // Hero Section
  heroContainer: {
    padding: 24,
    paddingTop: 40,
    paddingBottom: 32,
  },
  heroContent: {
    alignItems: "center",
  },
  heroLabel: {
    fontSize: 12,
    color: "#D1FAE5",
    letterSpacing: 2,
    fontWeight: "600",
  },
  heroTitle: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#FFFFFF",
    marginTop: 8,
    letterSpacing: 1,
  },
  heroOpponent: {
    fontSize: 18,
    color: "#D1FAE5",
    marginTop: 4,
  },
  countdown: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 24,
    marginBottom: 24,
  },
  countdownItem: {
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.3)",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  countdownNumber: {
    fontSize: 32,
    fontWeight: "bold",
    color: "#FFFFFF",
  },
  countdownLabel: {
    fontSize: 10,
    color: "#D1FAE5",
    marginTop: 4,
    letterSpacing: 1,
  },
  countdownSeparator: {
    fontSize: 32,
    color: "#FFFFFF",
    marginHorizontal: 8,
    fontWeight: "bold",
  },
  heroButton: {
    backgroundColor: "#000000",
    paddingVertical: 12,
    paddingHorizontal: 32,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: "#FFFFFF",
  },
  heroButtonText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "bold",
    letterSpacing: 1,
  },

  // Quick Stats
  quickStats: {
    flexDirection: "row",
    justifyContent: "space-around",
    paddingVertical: 20,
    backgroundColor: "#0A0A0A",
    borderBottomWidth: 1,
    borderBottomColor: "#1F1F1F",
  },
  statCard: {
    alignItems: "center",
  },
  statIcon: {
    fontSize: 28,
    marginBottom: 8,
  },
  statValue: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#10B981",
  },
  statLabel: {
    fontSize: 12,
    color: "#6B7280",
    marginTop: 4,
  },

  // Section
  section: {
    padding: 20,
  },
  sectionHeader: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 16,
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

  // News Cards
  newsCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#0A0A0A",
    padding: 16,
    borderRadius: 8,
    marginBottom: 12,
    borderLeftWidth: 4,
    borderLeftColor: "#10B981",
  },
  newsCardAlert: {
    borderLeftColor: "#EF4444",
  },
  newsCardSuccess: {
    borderLeftColor: "#10B981",
  },
  newsIcon: {
    fontSize: 24,
    marginRight: 12,
  },
  newsText: {
    flex: 1,
    color: "#D1D5DB",
    fontSize: 14,
  },
  newsArrow: {
    fontSize: 24,
    color: "#4B5563",
  },

  // Team Card
  teamCard: {
    backgroundColor: "#0A0A0A",
    borderRadius: 8,
    padding: 20,
    borderWidth: 1,
    borderColor: "#1F1F1F",
  },
  teamHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#1F1F1F",
  },
  teamName: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#10B981",
    letterSpacing: 1,
  },
  teamStats: {
    fontSize: 12,
    color: "#6B7280",
    marginTop: 4,
  },
  manageButton: {
    backgroundColor: "#10B981",
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 4,
  },
  manageButtonText: {
    color: "#000000",
    fontSize: 12,
    fontWeight: "bold",
    letterSpacing: 1,
  },
  playersList: {
    gap: 12,
  },
  playerRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#000000",
    padding: 12,
    borderRadius: 4,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 12,
  },
  statusOnline: {
    backgroundColor: "#10B981",
  },
  statusOffline: {
    backgroundColor: "#6B7280",
  },
  statusInjured: {
    backgroundColor: "#EF4444",
  },
  playerName: {
    flex: 1,
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "600",
  },
  playerRole: {
    color: "#6B7280",
    fontSize: 12,
    marginRight: 12,
  },
  playerRating: {
    backgroundColor: "#1F1F1F",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  playerRatingText: {
    color: "#10B981",
    fontSize: 12,
    fontWeight: "bold",
  },

  // Actions Grid
  actionsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  actionCard: {
    width: (width - 52) / 2,
    backgroundColor: "#0A0A0A",
    padding: 20,
    borderRadius: 8,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#1F1F1F",
  },
  actionIcon: {
    fontSize: 40,
    marginBottom: 12,
  },
  actionTitle: {
    fontSize: 14,
    fontWeight: "bold",
    color: "#10B981",
    letterSpacing: 1,
    marginBottom: 4,
  },
  actionSubtitle: {
    fontSize: 11,
    color: "#6B7280",
    textAlign: "center",
  },

  // Metrics
  metricsRow: {
    flexDirection: "row",
    gap: 12,
  },
  metricCard: {
    flex: 1,
    backgroundColor: "#0A0A0A",
    padding: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#1F1F1F",
  },
  metricValue: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#10B981",
    marginBottom: 4,
  },
  metricLabel: {
    fontSize: 12,
    color: "#6B7280",
    marginBottom: 8,
  },
  metricBar: {
    height: 4,
    backgroundColor: "#10B981",
    borderRadius: 2,
  },
});
