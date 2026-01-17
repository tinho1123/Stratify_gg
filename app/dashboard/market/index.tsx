import { LinearGradient } from "expo-linear-gradient";
import React, { useState } from "react";
import {
    Dimensions,
    Modal,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";

const { width } = Dimensions.get("window");

interface Player {
  id: string;
  name: string;
  role: string;
  age: number;
  rating: number;
  price: number;
  salary: number;
  nationality: string;
  team: string;
  potential: number;
  stats: {
    kills: number;
    deaths: number;
    assists: number;
    adr: number;
    headshot: number;
  };
  personality: string[];
}

type FilterRole = "ALL" | "IGL" | "AWPer" | "Entry" | "Support" | "Flex";

export default function MarketScreen() {
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null);
  const [showPlayerModal, setShowPlayerModal] = useState(false);
  const [showNegotiateModal, setShowNegotiateModal] = useState(false);
  const [offerAmount, setOfferAmount] = useState("");
  const [budget, setBudget] = useState(125000);
  const [filterRole, setFilterRole] = useState<FilterRole>("ALL");
  const [searchQuery, setSearchQuery] = useState("");

  const players: Player[] = [
    {
      id: "1",
      name: "ZywOo",
      role: "AWPer",
      age: 23,
      rating: 96,
      price: 250000,
      salary: 25000,
      nationality: "🇫🇷",
      team: "Vitality",
      potential: 98,
      stats: {
        kills: 2450,
        deaths: 1820,
        assists: 680,
        adr: 95.2,
        headshot: 62,
      },
      personality: ["Focado", "Clutch Master"],
    },
    {
      id: "2",
      name: "s1mple",
      role: "AWPer",
      age: 26,
      rating: 95,
      price: 280000,
      salary: 28000,
      nationality: "🇺🇦",
      team: "NAVI",
      potential: 95,
      stats: {
        kills: 2680,
        deaths: 1920,
        assists: 720,
        adr: 93.8,
        headshot: 58,
      },
      personality: ["Lenda", "Competitivo"],
    },
    {
      id: "3",
      name: "NiKo",
      role: "Flex",
      age: 27,
      rating: 93,
      price: 220000,
      salary: 22000,
      nationality: "🇧🇦",
      team: "G2",
      potential: 92,
      stats: {
        kills: 2520,
        deaths: 1890,
        assists: 840,
        adr: 89.5,
        headshot: 64,
      },
      personality: ["Versátil", "Líder"],
    },
    {
      id: "4",
      name: "frozen",
      role: "Entry",
      age: 22,
      rating: 88,
      price: 150000,
      salary: 16000,
      nationality: "🇸🇰",
      team: "MOUZ",
      potential: 94,
      stats: {
        kills: 2180,
        deaths: 1980,
        assists: 620,
        adr: 84.3,
        headshot: 59,
      },
      personality: ["Jovem Promessa", "Agressivo"],
    },
    {
      id: "5",
      name: "ropz",
      role: "Support",
      age: 24,
      rating: 90,
      price: 180000,
      salary: 18000,
      nationality: "🇪🇪",
      team: "FaZe",
      potential: 91,
      stats: {
        kills: 2280,
        deaths: 1850,
        assists: 920,
        adr: 82.7,
        headshot: 56,
      },
      personality: ["Inteligente", "Consistente"],
    },
    {
      id: "6",
      name: "karrigan",
      role: "IGL",
      age: 34,
      rating: 85,
      price: 120000,
      salary: 15000,
      nationality: "🇩🇰",
      team: "FaZe",
      potential: 84,
      stats: {
        kills: 1880,
        deaths: 1920,
        assists: 1020,
        adr: 75.4,
        headshot: 52,
      },
      personality: ["Veterano", "Tático", "Líder Nato"],
    },
    {
      id: "7",
      name: "donk",
      role: "Entry",
      age: 18,
      rating: 89,
      price: 160000,
      salary: 14000,
      nationality: "🇷🇺",
      team: "Spirit",
      potential: 97,
      stats: {
        kills: 2320,
        deaths: 2020,
        assists: 580,
        adr: 88.9,
        headshot: 67,
      },
      personality: ["Prodígio", "Fenômeno"],
    },
    {
      id: "8",
      name: "YEKINDAR",
      role: "Flex",
      age: 25,
      rating: 87,
      price: 140000,
      salary: 16000,
      nationality: "🇱🇻",
      team: "Liquid",
      potential: 89,
      stats: {
        kills: 2120,
        deaths: 1950,
        assists: 760,
        adr: 81.2,
        headshot: 54,
      },
      personality: ["Energético", "Multi-role"],
    },
  ];

  const roles: FilterRole[] = [
    "ALL",
    "IGL",
    "AWPer",
    "Entry",
    "Support",
    "Flex",
  ];

  const filteredPlayers = players.filter((player) => {
    const matchesRole = filterRole === "ALL" || player.role === filterRole;
    const matchesSearch =
      player.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      player.team.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesRole && matchesSearch;
  });

  const handlePlayerPress = (player: Player) => {
    setSelectedPlayer(player);
    setShowPlayerModal(true);
  };

  const handleNegotiate = () => {
    if (!selectedPlayer) return;
    setOfferAmount(selectedPlayer.price.toString());
    setShowPlayerModal(false);
    setShowNegotiateModal(true);
  };

  const handleSendOffer = () => {
    const offer = parseInt(offerAmount);
    if (!selectedPlayer || !offer) return;

    if (offer > budget) {
      alert("Você não tem orçamento suficiente! 💸");
      return;
    }

    const difference =
      ((offer - selectedPlayer.price) / selectedPlayer.price) * 100;

    if (difference < -20) {
      alert("Oferta muito baixa! O time recusou. ❌");
    } else if (difference < 0) {
      alert("O time está considerando sua oferta... 🤔");
    } else {
      alert(`Oferta aceita! ${selectedPlayer.name} agora é seu! 🎉`);
      setBudget(budget - offer);
      setShowNegotiateModal(false);
      setSelectedPlayer(null);
    }
  };

  const getRatingColor = (rating: number) => {
    if (rating >= 90) return "#10B981";
    if (rating >= 80) return "#3B82F6";
    if (rating >= 70) return "#F59E0B";
    return "#6B7280";
  };

  const getPotentialColor = (potential: number) => {
    if (potential >= 95) return "#EC4899";
    if (potential >= 90) return "#8B5CF6";
    return "#10B981";
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <LinearGradient colors={["#10B981", "#059669"]} style={styles.header}>
        <Text style={styles.headerTitle}>MERCADO DE TRANSFERÊNCIAS</Text>
        <Text style={styles.headerSubtitle}>Encontre a próxima estrela</Text>

        <View style={styles.budgetCard}>
          <Text style={styles.budgetIcon}>💰</Text>
          <View>
            <Text style={styles.budgetValue}>${budget.toLocaleString()}</Text>
            <Text style={styles.budgetLabel}>Orçamento Disponível</Text>
          </View>
        </View>
      </LinearGradient>

      <View style={styles.content}>
        {/* Search Bar */}
        <View style={styles.searchContainer}>
          <Text style={styles.searchIcon}>🔍</Text>
          <TextInput
            style={styles.searchInput}
            placeholder="Buscar jogador ou time..."
            placeholderTextColor="#6B7280"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>

        {/* Role Filters */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.filtersContainer}
          contentContainerStyle={styles.filtersContent}
        >
          {roles.map((role) => (
            <TouchableOpacity
              key={role}
              style={[
                styles.filterChip,
                filterRole === role && styles.filterChipActive,
              ]}
              onPress={() => setFilterRole(role)}
            >
              <Text
                style={[
                  styles.filterChipText,
                  filterRole === role && styles.filterChipTextActive,
                ]}
              >
                {role}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Players List */}
        <ScrollView
          style={styles.playersList}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.playersGrid}>
            {filteredPlayers.map((player) => (
              <TouchableOpacity
                key={player.id}
                style={styles.playerCard}
                onPress={() => handlePlayerPress(player)}
                activeOpacity={0.7}
              >
                {/* Player Header */}
                <View style={styles.playerCardHeader}>
                  <View style={styles.playerBasicInfo}>
                    <Text style={styles.playerNationality}>
                      {player.nationality}
                    </Text>
                    <View>
                      <Text style={styles.playerName}>{player.name}</Text>
                      <Text style={styles.playerTeam}>{player.team}</Text>
                    </View>
                  </View>
                  <View
                    style={[
                      styles.ratingBadge,
                      { backgroundColor: getRatingColor(player.rating) },
                    ]}
                  >
                    <Text style={styles.ratingText}>{player.rating}</Text>
                  </View>
                </View>

                {/* Player Info */}
                <View style={styles.playerInfo}>
                  <View style={styles.playerInfoItem}>
                    <Text style={styles.playerInfoLabel}>Função</Text>
                    <Text style={styles.playerInfoValue}>{player.role}</Text>
                  </View>
                  <View style={styles.playerInfoItem}>
                    <Text style={styles.playerInfoLabel}>Idade</Text>
                    <Text style={styles.playerInfoValue}>{player.age}</Text>
                  </View>
                  <View style={styles.playerInfoItem}>
                    <Text style={styles.playerInfoLabel}>Potencial</Text>
                    <Text
                      style={[
                        styles.playerInfoValue,
                        { color: getPotentialColor(player.potential) },
                      ]}
                    >
                      {player.potential}
                    </Text>
                  </View>
                </View>

                {/* Player Stats Preview */}
                <View style={styles.statsPreview}>
                  <View style={styles.statPreviewItem}>
                    <Text style={styles.statPreviewValue}>
                      {(player.stats.kills / player.stats.deaths).toFixed(2)}
                    </Text>
                    <Text style={styles.statPreviewLabel}>K/D</Text>
                  </View>
                  <View style={styles.statPreviewItem}>
                    <Text style={styles.statPreviewValue}>
                      {player.stats.adr}
                    </Text>
                    <Text style={styles.statPreviewLabel}>ADR</Text>
                  </View>
                  <View style={styles.statPreviewItem}>
                    <Text style={styles.statPreviewValue}>
                      {player.stats.headshot}%
                    </Text>
                    <Text style={styles.statPreviewLabel}>HS%</Text>
                  </View>
                </View>

                {/* Personality Tags */}
                <View style={styles.personalityTags}>
                  {player.personality.map((trait, index) => (
                    <View key={index} style={styles.personalityTag}>
                      <Text style={styles.personalityTagText}>{trait}</Text>
                    </View>
                  ))}
                </View>

                {/* Price */}
                <View style={styles.priceContainer}>
                  <View>
                    <Text style={styles.priceLabel}>
                      Valor de Transferência
                    </Text>
                    <Text style={styles.priceValue}>
                      ${player.price.toLocaleString()}
                    </Text>
                  </View>
                  <Text style={styles.salaryText}>
                    💰 ${player.salary.toLocaleString()}/mês
                  </Text>
                </View>

                <View style={styles.viewDetailsArrow}>
                  <Text style={styles.viewDetailsText}>VER DETALHES ›</Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>

          {filteredPlayers.length === 0 && (
            <View style={styles.emptyState}>
              <Text style={styles.emptyStateIcon}>🔍</Text>
              <Text style={styles.emptyStateText}>
                Nenhum jogador encontrado
              </Text>
              <Text style={styles.emptyStateSubtext}>
                Tente ajustar os filtros
              </Text>
            </View>
          )}

          <View style={{ height: 40 }} />
        </ScrollView>
      </View>

      {/* Player Details Modal */}
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
                  colors={[getRatingColor(selectedPlayer.rating), "#059669"]}
                  style={styles.modalHeader}
                >
                  <Text style={styles.modalNationality}>
                    {selectedPlayer.nationality}
                  </Text>
                  <Text style={styles.modalPlayerName}>
                    {selectedPlayer.name}
                  </Text>
                  <Text style={styles.modalPlayerTeam}>
                    {selectedPlayer.team}
                  </Text>
                  <View style={styles.modalRatings}>
                    <View style={styles.modalRatingItem}>
                      <Text style={styles.modalRatingValue}>
                        {selectedPlayer.rating}
                      </Text>
                      <Text style={styles.modalRatingLabel}>Rating</Text>
                    </View>
                    <View style={styles.modalRatingItem}>
                      <Text
                        style={[
                          styles.modalRatingValue,
                          {
                            color: getPotentialColor(selectedPlayer.potential),
                          },
                        ]}
                      >
                        {selectedPlayer.potential}
                      </Text>
                      <Text style={styles.modalRatingLabel}>Potencial</Text>
                    </View>
                  </View>
                </LinearGradient>

                <ScrollView style={styles.modalBody}>
                  <View style={styles.modalSection}>
                    <Text style={styles.modalSectionTitle}>INFORMAÇÕES</Text>
                    <View style={styles.modalInfoGrid}>
                      <View style={styles.modalInfoCard}>
                        <Text style={styles.modalInfoCardLabel}>Idade</Text>
                        <Text style={styles.modalInfoCardValue}>
                          {selectedPlayer.age} anos
                        </Text>
                      </View>
                      <View style={styles.modalInfoCard}>
                        <Text style={styles.modalInfoCardLabel}>Função</Text>
                        <Text style={styles.modalInfoCardValue}>
                          {selectedPlayer.role}
                        </Text>
                      </View>
                    </View>
                  </View>

                  <View style={styles.modalSection}>
                    <Text style={styles.modalSectionTitle}>ESTATÍSTICAS</Text>
                    <View style={styles.modalStatsGrid}>
                      <View style={styles.modalStatCard}>
                        <Text style={styles.modalStatValue}>
                          {selectedPlayer.stats.kills}
                        </Text>
                        <Text style={styles.modalStatLabel}>Kills</Text>
                      </View>
                      <View style={styles.modalStatCard}>
                        <Text style={styles.modalStatValue}>
                          {selectedPlayer.stats.deaths}
                        </Text>
                        <Text style={styles.modalStatLabel}>Deaths</Text>
                      </View>
                      <View style={styles.modalStatCard}>
                        <Text style={styles.modalStatValue}>
                          {selectedPlayer.stats.assists}
                        </Text>
                        <Text style={styles.modalStatLabel}>Assists</Text>
                      </View>
                      <View style={styles.modalStatCard}>
                        <Text style={styles.modalStatValue}>
                          {selectedPlayer.stats.adr}
                        </Text>
                        <Text style={styles.modalStatLabel}>ADR</Text>
                      </View>
                      <View style={styles.modalStatCard}>
                        <Text style={styles.modalStatValue}>
                          {(
                            selectedPlayer.stats.kills /
                            selectedPlayer.stats.deaths
                          ).toFixed(2)}
                        </Text>
                        <Text style={styles.modalStatLabel}>K/D Ratio</Text>
                      </View>
                      <View style={styles.modalStatCard}>
                        <Text style={styles.modalStatValue}>
                          {selectedPlayer.stats.headshot}%
                        </Text>
                        <Text style={styles.modalStatLabel}>HS%</Text>
                      </View>
                    </View>
                  </View>

                  <View style={styles.modalSection}>
                    <Text style={styles.modalSectionTitle}>PERSONALIDADE</Text>
                    <View style={styles.modalPersonality}>
                      {selectedPlayer.personality.map((trait, index) => (
                        <View key={index} style={styles.modalPersonalityTag}>
                          <Text style={styles.modalPersonalityText}>
                            ✨ {trait}
                          </Text>
                        </View>
                      ))}
                    </View>
                  </View>

                  <View style={styles.modalSection}>
                    <Text style={styles.modalSectionTitle}>CUSTO</Text>
                    <View style={styles.modalCostCard}>
                      <View style={styles.modalCostRow}>
                        <Text style={styles.modalCostLabel}>
                          Transferência:
                        </Text>
                        <Text style={styles.modalCostValue}>
                          ${selectedPlayer.price.toLocaleString()}
                        </Text>
                      </View>
                      <View style={styles.modalCostRow}>
                        <Text style={styles.modalCostLabel}>
                          Salário Mensal:
                        </Text>
                        <Text style={styles.modalCostValue}>
                          ${selectedPlayer.salary.toLocaleString()}
                        </Text>
                      </View>
                      <View style={styles.modalCostDivider} />
                      <View style={styles.modalCostRow}>
                        <Text style={styles.modalCostLabel}>
                          Custo Anual Total:
                        </Text>
                        <Text
                          style={[styles.modalCostValue, styles.modalCostTotal]}
                        >
                          $
                          {(
                            selectedPlayer.price +
                            selectedPlayer.salary * 12
                          ).toLocaleString()}
                        </Text>
                      </View>
                    </View>
                  </View>
                </ScrollView>

                <View style={styles.modalActions}>
                  <TouchableOpacity
                    style={styles.modalButtonSecondary}
                    onPress={() => setShowPlayerModal(false)}
                  >
                    <Text style={styles.modalButtonTextSecondary}>VOLTAR</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.modalButtonPrimary}
                    onPress={handleNegotiate}
                  >
                    <Text style={styles.modalButtonTextPrimary}>
                      FAZER OFERTA
                    </Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>

      {/* Negotiate Modal */}
      <Modal
        visible={showNegotiateModal}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setShowNegotiateModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.negotiateModal}>
            {selectedPlayer && (
              <>
                <LinearGradient
                  colors={["#10B981", "#059669"]}
                  style={styles.negotiateHeader}
                >
                  <Text style={styles.negotiateIcon}>💼</Text>
                  <Text style={styles.negotiateTitle}>NEGOCIAÇÃO</Text>
                  <Text style={styles.negotiateSubtitle}>
                    {selectedPlayer.name}
                  </Text>
                </LinearGradient>

                <View style={styles.negotiateBody}>
                  <View style={styles.negotiateInfo}>
                    <View style={styles.negotiateInfoRow}>
                      <Text style={styles.negotiateInfoLabel}>
                        Valor Pedido:
                      </Text>
                      <Text style={styles.negotiateInfoValue}>
                        ${selectedPlayer.price.toLocaleString()}
                      </Text>
                    </View>
                    <View style={styles.negotiateInfoRow}>
                      <Text style={styles.negotiateInfoLabel}>
                        Seu Orçamento:
                      </Text>
                      <Text
                        style={[
                          styles.negotiateInfoValue,
                          { color: "#10B981" },
                        ]}
                      >
                        ${budget.toLocaleString()}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.offerInputContainer}>
                    <Text style={styles.offerInputLabel}>SUA OFERTA</Text>
                    <View style={styles.offerInputWrapper}>
                      <Text style={styles.offerCurrency}>$</Text>
                      <TextInput
                        style={styles.offerInput}
                        placeholder="0"
                        placeholderTextColor="#6B7280"
                        keyboardType="numeric"
                        value={offerAmount}
                        onChangeText={setOfferAmount}
                      />
                    </View>

                    {offerAmount && (
                      <View style={styles.offerFeedback}>
                        {parseInt(offerAmount) > budget ? (
                          <Text style={styles.offerFeedbackError}>
                            ❌ Você não tem orçamento suficiente
                          </Text>
                        ) : parseInt(offerAmount) <
                          selectedPlayer.price * 0.8 ? (
                          <Text style={styles.offerFeedbackWarning}>
                            ⚠️ Oferta muito baixa - provavelmente será recusada
                          </Text>
                        ) : parseInt(offerAmount) < selectedPlayer.price ? (
                          <Text style={styles.offerFeedbackInfo}>
                            💭 Oferta razoável - pode ser aceita
                          </Text>
                        ) : (
                          <Text style={styles.offerFeedbackSuccess}>
                            ✅ Ótima oferta - alta chance de sucesso!
                          </Text>
                        )}
                      </View>
                    )}
                  </View>

                  <View style={styles.offerSuggestions}>
                    <Text style={styles.offerSuggestionsTitle}>
                      OFERTAS RÁPIDAS
                    </Text>
                    <View style={styles.offerSuggestionsButtons}>
                      <TouchableOpacity
                        style={styles.suggestionButton}
                        onPress={() =>
                          setOfferAmount(
                            (selectedPlayer.price * 0.8).toFixed(0),
                          )
                        }
                      >
                        <Text style={styles.suggestionButtonText}>80%</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.suggestionButton}
                        onPress={() =>
                          setOfferAmount(
                            (selectedPlayer.price * 0.9).toFixed(0),
                          )
                        }
                      >
                        <Text style={styles.suggestionButtonText}>90%</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[
                          styles.suggestionButton,
                          styles.suggestionButtonHighlight,
                        ]}
                        onPress={() =>
                          setOfferAmount(selectedPlayer.price.toString())
                        }
                      >
                        <Text
                          style={[
                            styles.suggestionButtonText,
                            styles.suggestionButtonTextHighlight,
                          ]}
                        >
                          100%
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.suggestionButton}
                        onPress={() =>
                          setOfferAmount(
                            (selectedPlayer.price * 1.1).toFixed(0),
                          )
                        }
                      >
                        <Text style={styles.suggestionButtonText}>110%</Text>
                      </TouchableOpacity>
                    </View>
                  </View>

                  <View style={styles.negotiateActions}>
                    <TouchableOpacity
                      style={styles.negotiateButtonSecondary}
                      onPress={() => {
                        setShowNegotiateModal(false);
                        setShowPlayerModal(true);
                      }}
                    >
                      <Text style={styles.negotiateButtonTextSecondary}>
                        CANCELAR
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[
                        styles.negotiateButtonPrimary,
                        (!offerAmount || parseInt(offerAmount) > budget) &&
                          styles.negotiateButtonDisabled,
                      ]}
                      onPress={handleSendOffer}
                      disabled={!offerAmount || parseInt(offerAmount) > budget}
                    >
                      <Text style={styles.negotiateButtonTextPrimary}>
                        ENVIAR OFERTA
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
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
    fontSize: 22,
    fontWeight: "bold",
    color: "#FFFFFF",
    letterSpacing: 2,
  },
  headerSubtitle: {
    fontSize: 14,
    color: "#D1FAE5",
    marginTop: 4,
  },
  budgetCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.2)",
    padding: 16,
    borderRadius: 8,
    marginTop: 20,
    gap: 12,
  },
  budgetIcon: {
    fontSize: 32,
  },
  budgetValue: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#FFFFFF",
  },
  budgetLabel: {
    fontSize: 12,
    color: "#D1FAE5",
  },

  // Content
  content: {
    flex: 1,
    backgroundColor: "#000000",
  },

  // Search
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#0A0A0A",
    margin: 20,
    marginBottom: 12,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#1F1F1F",
    gap: 12,
  },
  searchIcon: {
    fontSize: 20,
  },
  searchInput: {
    flex: 1,
    color: "#FFFFFF",
    fontSize: 16,
  },

  // Filters
  filtersContainer: {
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  filtersContent: {
    gap: 8,
  },
  filterChip: {
    backgroundColor: "#0A0A0A",
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#1F1F1F",
  },
  filterChipActive: {
    backgroundColor: "#10B981",
    borderColor: "#10B981",
  },
  filterChipText: {
    color: "#6B7280",
    fontSize: 12,
    fontWeight: "bold",
    letterSpacing: 1,
  },
  filterChipTextActive: {
    color: "#000000",
  },

  // Players List
  playersList: {
    flex: 1,
    paddingHorizontal: 20,
  },
  playersGrid: {
    gap: 16,
  },

  // Player Card
  playerCard: {
    backgroundColor: "#0A0A0A",
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: "#1F1F1F",
  },
  playerCardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 16,
  },
  playerBasicInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  playerNationality: {
    fontSize: 32,
  },
  playerName: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#FFFFFF",
  },
  playerTeam: {
    fontSize: 13,
    color: "#6B7280",
    marginTop: 2,
  },
  ratingBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  ratingText: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#000000",
  },
  playerInfo: {
    flexDirection: "row",
    justifyContent: "space-around",
    marginBottom: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#1F1F1F",
  },
  playerInfoItem: {
    alignItems: "center",
  },
  playerInfoLabel: {
    fontSize: 11,
    color: "#6B7280",
    marginBottom: 4,
  },
  playerInfoValue: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#10B981",
  },
  statsPreview: {
    flexDirection: "row",
    justifyContent: "space-around",
    marginBottom: 16,
    backgroundColor: "#000000",
    padding: 12,
    borderRadius: 6,
  },
  statPreviewItem: {
    alignItems: "center",
  },
  statPreviewValue: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#10B981",
    marginBottom: 2,
  },
  statPreviewLabel: {
    fontSize: 10,
    color: "#6B7280",
  },
  personalityTags: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 16,
  },
  personalityTag: {
    backgroundColor: "#1F1F1F",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  personalityTagText: {
    fontSize: 11,
    color: "#10B981",
    fontWeight: "600",
  },
  priceContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: "#1F1F1F",
    marginBottom: 12,
  },
  priceLabel: {
    fontSize: 11,
    color: "#6B7280",
    marginBottom: 4,
  },
  priceValue: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#10B981",
  },
  salaryText: {
    fontSize: 12,
    color: "#6B7280",
  },
  viewDetailsArrow: {
    alignItems: "center",
  },
  viewDetailsText: {
    fontSize: 12,
    fontWeight: "bold",
    color: "#10B981",
    letterSpacing: 1,
  },

  // Empty State
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 60,
  },
  emptyStateIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  emptyStateText: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#6B7280",
    marginBottom: 8,
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: "#4B5563",
  },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.95)",
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
  modalNationality: {
    fontSize: 48,
    marginBottom: 8,
  },
  modalPlayerName: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#FFFFFF",
    marginBottom: 4,
  },
  modalPlayerTeam: {
    fontSize: 16,
    color: "#D1FAE5",
    marginBottom: 16,
  },
  modalRatings: {
    flexDirection: "row",
    gap: 24,
  },
  modalRatingItem: {
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.3)",
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  modalRatingValue: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#FFFFFF",
  },
  modalRatingLabel: {
    fontSize: 11,
    color: "#D1FAE5",
    marginTop: 4,
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
  modalInfoGrid: {
    flexDirection: "row",
    gap: 12,
  },
  modalInfoCard: {
    flex: 1,
    backgroundColor: "#0A0A0A",
    padding: 16,
    borderRadius: 8,
    alignItems: "center",
  },
  modalInfoCardLabel: {
    fontSize: 12,
    color: "#6B7280",
    marginBottom: 6,
  },
  modalInfoCardValue: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#FFFFFF",
  },
  modalStatsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  modalStatCard: {
    width: (width - 64) / 3,
    backgroundColor: "#0A0A0A",
    padding: 12,
    borderRadius: 8,
    alignItems: "center",
  },
  modalStatValue: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#10B981",
    marginBottom: 4,
  },
  modalStatLabel: {
    fontSize: 10,
    color: "#6B7280",
  },
  modalPersonality: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  modalPersonalityTag: {
    backgroundColor: "#0A0A0A",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
  },
  modalPersonalityText: {
    fontSize: 14,
    color: "#10B981",
  },
  modalCostCard: {
    backgroundColor: "#0A0A0A",
    padding: 16,
    borderRadius: 8,
  },
  modalCostRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  modalCostLabel: {
    fontSize: 14,
    color: "#6B7280",
  },
  modalCostValue: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#FFFFFF",
  },
  modalCostDivider: {
    height: 1,
    backgroundColor: "#1F1F1F",
    marginVertical: 8,
  },
  modalCostTotal: {
    color: "#10B981",
    fontSize: 18,
  },
  modalActions: {
    flexDirection: "row",
    gap: 12,
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: "#0A0A0A",
  },
  modalButtonSecondary: {
    flex: 1,
    backgroundColor: "#0A0A0A",
    padding: 16,
    borderRadius: 8,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#1F1F1F",
  },
  modalButtonTextSecondary: {
    fontSize: 14,
    fontWeight: "bold",
    color: "#6B7280",
    letterSpacing: 1,
  },
  modalButtonPrimary: {
    flex: 1,
    backgroundColor: "#10B981",
    padding: 16,
    borderRadius: 8,
    alignItems: "center",
  },
  modalButtonTextPrimary: {
    fontSize: 14,
    fontWeight: "bold",
    color: "#000000",
    letterSpacing: 1,
  },

  // Negotiate Modal
  negotiateModal: {
    backgroundColor: "#000000",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: "80%",
  },
  negotiateHeader: {
    padding: 24,
    alignItems: "center",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  negotiateIcon: {
    fontSize: 48,
    marginBottom: 12,
  },
  negotiateTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#FFFFFF",
    letterSpacing: 2,
  },
  negotiateSubtitle: {
    fontSize: 16,
    color: "#D1FAE5",
    marginTop: 4,
  },
  negotiateBody: {
    padding: 20,
  },
  negotiateInfo: {
    backgroundColor: "#0A0A0A",
    padding: 16,
    borderRadius: 8,
    marginBottom: 24,
    gap: 12,
  },
  negotiateInfoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  negotiateInfoLabel: {
    fontSize: 14,
    color: "#6B7280",
  },
  negotiateInfoValue: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#FFFFFF",
  },
  offerInputContainer: {
    marginBottom: 24,
  },
  offerInputLabel: {
    fontSize: 12,
    fontWeight: "bold",
    color: "#10B981",
    letterSpacing: 2,
    marginBottom: 12,
  },
  offerInputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#0A0A0A",
    borderWidth: 2,
    borderColor: "#10B981",
    borderRadius: 8,
    paddingHorizontal: 16,
  },
  offerCurrency: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#10B981",
    marginRight: 8,
  },
  offerInput: {
    flex: 1,
    fontSize: 32,
    fontWeight: "bold",
    color: "#FFFFFF",
    paddingVertical: 16,
  },
  offerFeedback: {
    marginTop: 12,
    padding: 12,
    backgroundColor: "#0A0A0A",
    borderRadius: 8,
  },
  offerFeedbackError: {
    fontSize: 13,
    color: "#EF4444",
  },
  offerFeedbackWarning: {
    fontSize: 13,
    color: "#F59E0B",
  },
  offerFeedbackInfo: {
    fontSize: 13,
    color: "#3B82F6",
  },
  offerFeedbackSuccess: {
    fontSize: 13,
    color: "#10B981",
  },
  offerSuggestions: {
    marginBottom: 24,
  },
  offerSuggestionsTitle: {
    fontSize: 12,
    fontWeight: "bold",
    color: "#6B7280",
    letterSpacing: 1,
    marginBottom: 12,
  },
  offerSuggestionsButtons: {
    flexDirection: "row",
    gap: 8,
  },
  suggestionButton: {
    flex: 1,
    backgroundColor: "#0A0A0A",
    padding: 12,
    borderRadius: 8,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#1F1F1F",
  },
  suggestionButtonHighlight: {
    backgroundColor: "#10B981",
    borderColor: "#10B981",
  },
  suggestionButtonText: {
    fontSize: 14,
    fontWeight: "bold",
    color: "#6B7280",
  },
  suggestionButtonTextHighlight: {
    color: "#000000",
  },
  negotiateActions: {
    flexDirection: "row",
    gap: 12,
  },
  negotiateButtonSecondary: {
    flex: 1,
    backgroundColor: "#0A0A0A",
    padding: 16,
    borderRadius: 8,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#1F1F1F",
  },
  negotiateButtonTextSecondary: {
    fontSize: 14,
    fontWeight: "bold",
    color: "#6B7280",
    letterSpacing: 1,
  },
  negotiateButtonPrimary: {
    flex: 1,
    backgroundColor: "#10B981",
    padding: 16,
    borderRadius: 8,
    alignItems: "center",
  },
  negotiateButtonDisabled: {
    backgroundColor: "#1F1F1F",
  },
  negotiateButtonTextPrimary: {
    fontSize: 14,
    fontWeight: "bold",
    color: "#000000",
    letterSpacing: 1,
  },
});
