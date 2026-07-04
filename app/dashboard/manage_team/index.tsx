import { supabase } from "@/database/supabase";
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
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const { width } = Dimensions.get("window");

// ─── Types ────────────────────────────────────────────────────────────────────

interface PlayerSkill {
  skill_id: string;
  value: number;
  skills: { name: string };
}

interface Player {
  id: string;
  name: string;
  role: string;
  status: "online" | "injured" | "banned";
  rating: number;
  salary: number;
  contract_end: string;
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

// ─── Constants ────────────────────────────────────────────────────────────────

const ATTR_GROUPS = [
  {
    label: "COMBATE", color: "#EF4444",
    keys: [
      { key: "aim",            label: "Aim" },
      { key: "flick",          label: "Flick" },
      { key: "tracking",       label: "Tracking" },
      { key: "precisao",       label: "Precisão" },
      { key: "recoil_control", label: "Controle de Recuo" },
    ],
  },
  {
    label: "MECÂNICA", color: "#F59E0B",
    keys: [
      { key: "reacao",       label: "Reação" },
      { key: "movimentacao", label: "Movimentação" },
      { key: "strafing",     label: "Strafing" },
      { key: "peek",         label: "Peek" },
    ],
  },
  {
    label: "GAME SENSE", color: "#8B5CF6",
    keys: [
      { key: "leitura",        label: "Leitura" },
      { key: "posicionamento", label: "Posicionamento" },
      { key: "decisao",        label: "Decisão" },
    ],
  },
  {
    label: "CONSCIÊNCIA", color: "#3B82F6",
    keys: [
      { key: "audio",     label: "Áudio" },
      { key: "mapa",      label: "Mapa" },
      { key: "awareness", label: "Awareness" },
    ],
  },
  {
    label: "EQUIPE", color: "#10B981",
    keys: [
      { key: "comunicacao", label: "Comunicação" },
      { key: "teamplay",    label: "Teamplay" },
      { key: "utilitarios", label: "Utilitários" },
    ],
  },
];

const ROLE_COLOR: Record<string, string> = {
  IGL:     "#8B5CF6",
  AWPer:   "#EF4444",
  Support: "#10B981",
  Entry:   "#F59E0B",
  Flex:    "#3B82F6",
};

const STATUS_COLOR: Record<string, string> = {
  online:  "#10B981",
  injured: "#EF4444",
  banned:  "#F59E0B",
};

const STATUS_LABEL: Record<string, string> = {
  online:  "DISPONÍVEL",
  injured: "LESIONADO",
  banned:  "SUSPENSO",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function ratingColor(r: number) {
  if (r >= 60) return "#10B981";
  if (r >= 48) return "#F59E0B";
  return "#EF4444";
}

function kd(kills: number, deaths: number) {
  return deaths > 0 ? (kills / deaths).toFixed(2) : "—";
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function PlayerAttributes({ skills, loading }: { skills?: PlayerSkill[]; loading: boolean }) {
  if (loading) {
    return (
      <View style={{ paddingVertical: 24, alignItems: "center" }}>
        <ActivityIndicator size="small" color="#10B981" />
        <Text style={{ color: "#6B7280", fontSize: 12, marginTop: 8 }}>Carregando atributos...</Text>
      </View>
    );
  }

  if (!skills || skills.length === 0) {
    return (
      <View style={{ paddingVertical: 16, alignItems: "center" }}>
        <Text style={{ color: "#4B5563", fontSize: 13 }}>Nenhum atributo registrado</Text>
      </View>
    );
  }

  const sm = Object.fromEntries(skills.map((s) => [s.skills.name, s.value]));

  return (
    <>
      {ATTR_GROUPS.map((group) => {
        const vals = group.keys.map((k) => sm[k.key]).filter((v) => v !== undefined) as number[];
        if (vals.length === 0) return null;
        const groupAvg = Math.round(vals.reduce((a, b) => a + b, 0) / vals.length);
        return (
          <View key={group.label} style={attrStyle.group}>
            <View style={attrStyle.groupHeader}>
              <View style={[attrStyle.dot, { backgroundColor: group.color }]} />
              <Text style={[attrStyle.groupLabel, { color: group.color }]}>{group.label}</Text>
              <View style={[attrStyle.avgBadge, { backgroundColor: group.color + "20" }]}>
                <Text style={[attrStyle.avgText, { color: group.color }]}>{groupAvg}</Text>
              </View>
            </View>
            <View style={attrStyle.attrList}>
              {group.keys.map((attr) => {
                const val = sm[attr.key];
                if (val === undefined) return null;
                const ac = val >= 60 ? "#10B981" : val >= 45 ? "#F59E0B" : "#EF4444";
                return (
                  <View key={attr.key} style={attrStyle.attrRow}>
                    <Text style={attrStyle.attrLabel}>{attr.label}</Text>
                    <View style={attrStyle.track}>
                      <View style={[attrStyle.fill, { width: `${val}%` as any, backgroundColor: ac }]} />
                    </View>
                    <Text style={[attrStyle.attrValue, { color: ac }]}>{val}</Text>
                  </View>
                );
              })}
            </View>
          </View>
        );
      })}
    </>
  );
}

const attrStyle = StyleSheet.create({
  group:       { paddingHorizontal: 16, paddingTop: 14 },
  groupHeader: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 10 },
  dot:         { width: 6, height: 6, borderRadius: 3 },
  groupLabel:  { fontSize: 10, fontWeight: "800", letterSpacing: 3, flex: 1 },
  avgBadge:    { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
  avgText:     { fontSize: 11, fontWeight: "800" },
  attrList:    { backgroundColor: "#111", borderRadius: 12, borderWidth: 1, borderColor: "#1E1E1E", padding: 12, gap: 10 },
  attrRow:     { flexDirection: "row", alignItems: "center", gap: 8 },
  attrLabel:   { width: 118, fontSize: 11, color: "#9CA3AF" },
  track:       { flex: 1, height: 4, backgroundColor: "#1E1E1E", borderRadius: 2, overflow: "hidden" },
  fill:        { height: 4, borderRadius: 2 },
  attrValue:   { width: 24, fontSize: 11, fontWeight: "800", textAlign: "right" },
});

function CondBar({ label, value, color = "#10B981" }: { label: string; value: number; color?: string }) {
  return (
    <View style={bar.row}>
      <Text style={bar.label}>{label}</Text>
      <View style={bar.track}>
        <View style={[bar.fill, { width: `${value}%` as any, backgroundColor: color }]} />
      </View>
      <Text style={[bar.value, { color }]}>{value}</Text>
    </View>
  );
}

const bar = StyleSheet.create({
  row:   { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 6 },
  label: { width: 52, fontSize: 11, color: "#6B7280" },
  track: { flex: 1, height: 4, backgroundColor: "#1E1E1E", borderRadius: 2, overflow: "hidden" },
  fill:  { height: 4, borderRadius: 2 },
  value: { width: 28, fontSize: 11, fontWeight: "700", textAlign: "right" },
});

// ─── Main Screen ──────────────────────────────────────────────────────────────

type SellState = "idle" | "loading" | "success" | "error";

const DURATIONS = [
  { label: "1h",  hours: 1 },
  { label: "6h",  hours: 6 },
  { label: "12h", hours: 12 },
  { label: "24h", hours: 24 },
];

function fmtPrice(v: number) {
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `$${(v / 1_000).toFixed(0)}K`;
  return `$${v}`;
}

export default function ManageTeamScreen() {
  const [players,       setPlayers]       = useState<Player[]>([]);
  const [myTeamId,      setMyTeamId]      = useState<string | null>(null);
  const [selected,      setSelected]      = useState<Player | null>(null);
  const [modalOpen,     setModalOpen]     = useState(false);
  const [loading,       setLoading]       = useState(true);
  const [loadingSkills, setLoadingSkills] = useState(false);

  // Sell flow
  const [sellOpen,     setSellOpen]     = useState(false);
  const [sellPrice,    setSellPrice]    = useState("");
  const [sellDuration, setSellDuration] = useState(24);
  const [sellState,    setSellState]    = useState<SellState>("idle");
  const [sellError,    setSellError]    = useState("");

  const fetchPlayers = useCallback(async () => {
    setLoading(true);
    const { data: teamData } = await supabase.from("teams").select("id").single();
    if (teamData) {
      setMyTeamId(teamData.id);
      const { data, error } = await supabase
        .from("players")
        .select("*")
        .eq("team_id", teamData.id)
        .order("rating", { ascending: false });
      if (!error && data) setPlayers(data as Player[]);
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchPlayers(); }, [fetchPlayers]);

  const openPlayer = async (player: Player) => {
    setSelected(player);
    setModalOpen(true);
    if (!player.skills) {
      setLoadingSkills(true);
      const { data, error } = await supabase
        .from("player_skills")
        .select("skill_id, value, skills(name)")
        .eq("player_id", player.id);
      if (error) {
        console.error("[openPlayer] erro ao buscar skills:", error);
      } else if (data) {
        console.log("[openPlayer] skills recebidas:", data.length, data);
        const updated = { ...player, skills: data as unknown as PlayerSkill[] };
        setSelected(updated);
        setPlayers((prev) => prev.map((p) => (p.id === player.id ? updated : p)));
      }
      setLoadingSkills(false);
    }
  };

  const openSell = () => {
    if (!selected) return;
    // Sugere preço com base no rating (rating * 1000)
    setSellPrice(String(selected.rating * 1000));
    setSellDuration(24);
    setSellState("idle");
    setSellError("");
    setSellOpen(true);
  };

  const closeSell = () => {
    setSellOpen(false);
    setSellState("idle");
    setSellError("");
  };

  const submitSell = async () => {
    if (!selected || !myTeamId) return;
    const price = parseInt(sellPrice.replace(/\D/g, ""), 10);
    if (!price || price <= 0) {
      setSellError("Informe um preço inicial válido");
      return;
    }

    setSellState("loading");
    setSellError("");

    const endsAt = new Date(Date.now() + sellDuration * 3_600_000).toISOString();

    const { error } = await supabase.from("auctions").insert({
      player_id: selected.id,
      seller_team_id: myTeamId,
      start_price: price,
      ends_at: endsAt,
      status: "active",
    });

    if (error) {
      setSellState("error");
      setSellError("Erro ao criar leilão. Tente novamente.");
      return;
    }

    setSellState("success");
  };

  // Derived stats
  const avg = (fn: (p: Player) => number) =>
    players.length ? Math.round(players.reduce((s, p) => s + fn(p), 0) / players.length) : 0;

  const avgRating  = players.length ? (players.reduce((s, p) => s + p.rating, 0) / players.length).toFixed(1) : "—";
  const totalSal   = players.reduce((s, p) => s + p.salary, 0);
  const avgForm    = avg((p) => p.form);
  const avgMorale  = avg((p) => p.morale);
  const avgEnergy  = avg((p) => p.energy);

  return (
    <SafeAreaView style={s.safe} edges={["top"]}>

      {/* ── HEADER ─────────────────────────────────────────── */}
      <View style={s.header}>
        <View style={s.headerTop}>
          <Text style={s.headerTitle}>ELENCO</Text>
          <TouchableOpacity style={s.addBtn} onPress={() => router.push("/dashboard/market")}>
            <Text style={s.addBtnText}>+ CONTRATAR</Text>
          </TouchableOpacity>
        </View>

        {/* Stats row */}
        <View style={s.statsRow}>
          {[
            { label: "Jogadores", value: `${players.length}/5` },
            { label: "Rating",    value: avgRating },
            { label: "Salário",   value: `$${(totalSal / 1000).toFixed(1)}K` },
            { label: "Forma",     value: `${avgForm}%` },
          ].map((item, i) => (
            <View key={i} style={s.statCard}>
              <Text style={s.statValue}>{item.value}</Text>
              <Text style={s.statLabel}>{item.label}</Text>
            </View>
          ))}
        </View>

        {/* Condition bars */}
        <View style={s.condRow}>
          {[
            { label: "Moral",    value: avgMorale, color: "#8B5CF6" },
            { label: "Energia",  value: avgEnergy, color: "#3B82F6" },
            { label: "Forma",    value: avgForm,   color: "#10B981" },
          ].map((item) => (
            <View key={item.label} style={s.condItem}>
              <View style={s.condTrack}>
                <View style={[s.condFill, { width: `${item.value}%` as any, backgroundColor: item.color }]} />
              </View>
              <Text style={[s.condLabel, { color: item.color }]}>{item.label} {item.value}%</Text>
            </View>
          ))}
        </View>
      </View>

      {/* ── PLAYER LIST ────────────────────────────────────── */}
      <ScrollView style={s.list} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 32 }}>

        {/* Quick actions */}
        <View style={s.actions}>
          {[
            { icon: "🎯", label: "TREINAR",  route: "/dashboard/training" },
            { icon: "📋", label: "TÁTICAS",  route: "/dashboard/tactics" },
            { icon: "🔄", label: "MERCADO",  route: "/dashboard/market" },
          ].map((a) => (
            <TouchableOpacity
              key={a.label}
              style={s.actionBtn}
              onPress={() => a.route && router.push(a.route as any)}
            >
              <Text style={s.actionIcon}>{a.icon}</Text>
              <Text style={s.actionLabel}>{a.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={s.sectionTitle}>JOGADORES</Text>

        {loading ? (
          <View style={s.center}>
            <ActivityIndicator size="large" color="#10B981" />
          </View>
        ) : players.length === 0 ? (
          <View style={s.center}>
            <Text style={s.emptyText}>Nenhum jogador no elenco</Text>
          </View>
        ) : (
          players.map((player) => {
            const rc = ROLE_COLOR[player.role] ?? "#6B7280";
            const sc = STATUS_COLOR[player.status] ?? "#6B7280";
            const ratingC = ratingColor(player.rating);
            return (
              <TouchableOpacity
                key={player.id}
                style={[s.card, { borderLeftColor: rc }]}
                onPress={() => openPlayer(player)}
                activeOpacity={0.75}
              >
                {/* Top row */}
                <View style={s.cardTop}>
                  {/* Avatar */}
                  <View style={[s.avatar, { backgroundColor: rc + "22", borderColor: rc + "55" }]}>
                    <Text style={[s.avatarText, { color: rc }]}>{player.name[0].toUpperCase()}</Text>
                  </View>

                  {/* Name + role */}
                  <View style={s.cardInfo}>
                    <Text style={s.playerName}>{player.name}</Text>
                    <View style={s.cardMeta}>
                      <View style={[s.roleBadge, { backgroundColor: rc + "22" }]}>
                        <Text style={[s.roleText, { color: rc }]}>{player.role}</Text>
                      </View>
                      <Text style={s.ageDot}>·</Text>
                      <Text style={s.ageText}>{player.age} anos</Text>
                    </View>
                  </View>

                  {/* Rating */}
                  <View style={[s.ratingBadge, { backgroundColor: ratingC + "18", borderColor: ratingC + "44" }]}>
                    <Text style={[s.ratingText, { color: ratingC }]}>{player.rating}</Text>
                  </View>
                </View>

                {/* Status */}
                <View style={[s.statusChip, { backgroundColor: sc + "15", borderColor: sc + "40" }]}>
                  <View style={[s.statusDot, { backgroundColor: sc }]} />
                  <Text style={[s.statusText, { color: sc }]}>{STATUS_LABEL[player.status]}</Text>
                </View>

                {/* Stats */}
                <View style={s.statsGrid}>
                  {[
                    { label: "K/D",     value: kd(player.kills, player.deaths) },
                    { label: "ADR",     value: String(player.adr) },
                    { label: "Assists", value: String(player.assists) },
                    { label: "Salário", value: `$${(player.salary / 1000).toFixed(1)}K` },
                  ].map((stat) => (
                    <View key={stat.label} style={s.statItem}>
                      <Text style={s.statItemLabel}>{stat.label}</Text>
                      <Text style={s.statItemValue}>{stat.value}</Text>
                    </View>
                  ))}
                </View>

                {/* Condition mini bars */}
                <View style={s.miniBars}>
                  {[
                    { label: "E", value: player.energy, color: "#3B82F6" },
                    { label: "M", value: player.morale, color: "#8B5CF6" },
                    { label: "F", value: player.form,   color: "#10B981" },
                  ].map((b) => (
                    <View key={b.label} style={s.miniBar}>
                      <Text style={[s.miniBarLabel, { color: b.color }]}>{b.label}</Text>
                      <View style={s.miniBarTrack}>
                        <View style={[s.miniBarFill, { width: `${b.value}%` as any, backgroundColor: b.color }]} />
                      </View>
                      <Text style={[s.miniBarValue, { color: b.color }]}>{b.value}</Text>
                    </View>
                  ))}
                </View>

                {/* Contract */}
                <Text style={s.contractText}>
                  Contrato até {new Date(player.contract_end).toLocaleDateString("pt-BR")}
                </Text>
              </TouchableOpacity>
            );
          })
        )}
      </ScrollView>

      {/* ── PLAYER MODAL ───────────────────────────────────── */}
      <Modal visible={modalOpen} animationType="slide" transparent onRequestClose={() => setModalOpen(false)}>
        <Pressable style={s.overlay} onPress={() => setModalOpen(false)}>
          <Pressable style={s.sheet} onPress={() => {}}>

            {selected && (() => {
              const rc = ROLE_COLOR[selected.role] ?? "#6B7280";
              const sc = STATUS_COLOR[selected.status] ?? "#6B7280";
              const ratingC = ratingColor(selected.rating);
              return (
                <>
                  {/* Modal handle */}
                  <View style={s.handle} />

                  {/* Modal header */}
                  <View style={[s.modalHeader, { borderBottomColor: rc + "33" }]}>
                    <View style={[s.modalAvatar, { backgroundColor: rc + "22", borderColor: rc }]}>
                      <Text style={[s.modalAvatarText, { color: rc }]}>{selected.name[0].toUpperCase()}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={s.modalName}>{selected.name}</Text>
                      <View style={s.modalMeta}>
                        <View style={[s.roleBadge, { backgroundColor: rc + "22" }]}>
                          <Text style={[s.roleText, { color: rc }]}>{selected.role}</Text>
                        </View>
                        <View style={[s.statusChip, { backgroundColor: sc + "15", borderColor: sc + "40" }]}>
                          <View style={[s.statusDot, { backgroundColor: sc }]} />
                          <Text style={[s.statusText, { color: sc }]}>{STATUS_LABEL[selected.status]}</Text>
                        </View>
                      </View>
                    </View>
                    <View style={[s.modalRating, { backgroundColor: ratingC + "18", borderColor: ratingC + "55" }]}>
                      <Text style={[s.modalRatingNum, { color: ratingC }]}>{selected.rating}</Text>
                      <Text style={s.modalRatingLabel}>OVR</Text>
                    </View>
                  </View>

                  <ScrollView showsVerticalScrollIndicator={false} style={{ flex: 1 }}>

                    {/* Info */}
                    <View style={s.modalSection}>
                      <Text style={s.modalSectionTitle}>INFORMAÇÕES</Text>
                      <View style={s.infoGrid}>
                        {[
                          { label: "Idade",    value: `${selected.age} anos` },
                          { label: "Salário",  value: `$${selected.salary.toLocaleString()}/mês` },
                          { label: "Contrato", value: `até ${new Date(selected.contract_end).toLocaleDateString("pt-BR")}` },
                        ].map((item) => (
                          <View key={item.label} style={s.infoCard}>
                            <Text style={s.infoLabel}>{item.label}</Text>
                            <Text style={s.infoValue}>{item.value}</Text>
                          </View>
                        ))}
                      </View>
                    </View>

                    {/* Stats */}
                    <View style={s.modalSection}>
                      <Text style={s.modalSectionTitle}>ESTATÍSTICAS</Text>
                      <View style={s.statsGrid4}>
                        {[
                          { label: "Kills",   value: selected.kills },
                          { label: "Deaths",  value: selected.deaths },
                          { label: "Assists", value: selected.assists },
                          { label: "ADR",     value: selected.adr },
                          { label: "K/D",     value: kd(selected.kills, selected.deaths) },
                        ].map((stat) => (
                          <View key={stat.label} style={s.statBox}>
                            <Text style={s.statBoxValue}>{stat.value}</Text>
                            <Text style={s.statBoxLabel}>{stat.label}</Text>
                          </View>
                        ))}
                      </View>
                    </View>

                    {/* Atributos por categoria */}
                    <View style={s.modalSection}>
                      <Text style={s.modalSectionTitle}>ATRIBUTOS</Text>
                    </View>
                    <PlayerAttributes skills={selected.skills} loading={loadingSkills} />

                    {/* Condition */}
                    <View style={s.modalSection}>
                      <Text style={s.modalSectionTitle}>CONDIÇÃO</Text>
                      <View style={s.condCard}>
                        <CondBar label="Energia" value={selected.energy} color="#3B82F6" />
                        <CondBar label="Moral"   value={selected.morale} color="#8B5CF6" />
                        <CondBar label="Forma"   value={selected.form}   color="#10B981" />
                      </View>
                    </View>

                    {/* Actions */}
                    <View style={s.modalActions}>
                      <TouchableOpacity style={[s.modalBtn, { backgroundColor: rc }]}>
                        <Text style={s.modalBtnText}>🎯  TREINAR</Text>
                      </TouchableOpacity>
                      <View style={s.modalBtnRow}>
                        <TouchableOpacity style={[s.modalBtnSm, { borderColor: "#374151" }]}>
                          <Text style={s.modalBtnSmText}>💬  CONVERSAR</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[s.modalBtnSm, { borderColor: "#EF444460" }]}
                          onPress={openSell}
                        >
                          <Text style={[s.modalBtnSmText, { color: "#EF4444" }]}>🔄  VENDER</Text>
                        </TouchableOpacity>
                      </View>
                    </View>

                    <View style={{ height: 32 }} />
                  </ScrollView>
                </>
              );
            })()}
          </Pressable>
        </Pressable>
      </Modal>

      {/* ── SELL MODAL ────────────────────────────────────── */}
      <Modal visible={sellOpen} animationType="slide" transparent onRequestClose={closeSell}>
        <Pressable style={s.overlay} onPress={() => sellState === "idle" && closeSell()}>
          <Pressable style={s.sheet} onPress={() => {}}>
            <View style={s.handle} />

            {selected && (
              <View style={s.sellContent}>

                {sellState !== "success" ? (
                  <>
                    {/* Header */}
                    <View style={s.sellHeader}>
                      <Text style={s.sellTitle}>COLOCAR À VENDA</Text>
                      <Text style={s.sellSub}>
                        <Text style={{ color: "#FFFFFF", fontWeight: "700" }}>{selected.name}</Text>
                        {" "}será leiloado — o maior lance vence ao fim do tempo
                      </Text>
                    </View>

                    {/* Player summary */}
                    <View style={s.sellPlayerRow}>
                      <View style={[s.sellAvatar, { borderColor: (ROLE_COLOR[selected.role] ?? "#6366F1") + "88" }]}>
                        <Text style={[s.sellAvatarText, { color: ROLE_COLOR[selected.role] ?? "#6366F1" }]}>
                          {selected.name[0]}
                        </Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={s.sellPlayerName}>{selected.name}</Text>
                        <Text style={s.sellPlayerMeta}>
                          {selected.role} · {selected.age} anos · Rating {selected.rating}
                        </Text>
                      </View>
                      <View style={[s.sellRating, { borderColor: ratingColor(selected.rating) + "55" }]}>
                        <Text style={[s.sellRatingNum, { color: ratingColor(selected.rating) }]}>
                          {selected.rating}
                        </Text>
                      </View>
                    </View>

                    {/* Price input */}
                    <Text style={s.sellLabel}>PREÇO INICIAL DO LEILÃO</Text>
                    <View style={s.sellInputWrap}>
                      <Text style={s.sellDollar}>$</Text>
                      <TextInput
                        style={s.sellInput}
                        keyboardType="numeric"
                        value={sellPrice}
                        onChangeText={(v) => { setSellPrice(v); setSellError(""); }}
                        placeholderTextColor="#4B5563"
                        placeholder="0"
                      />
                      {sellPrice.length > 0 && (
                        <Text style={s.sellPriceFmt}>
                          {fmtPrice(parseInt(sellPrice.replace(/\D/g, "") || "0"))}
                        </Text>
                      )}
                    </View>

                    {/* Duration */}
                    <Text style={s.sellLabel}>DURAÇÃO DO LEILÃO</Text>
                    <View style={s.durationRow}>
                      {DURATIONS.map((d) => (
                        <TouchableOpacity
                          key={d.hours}
                          style={[
                            s.durationBtn,
                            sellDuration === d.hours && s.durationBtnActive,
                          ]}
                          onPress={() => setSellDuration(d.hours)}
                        >
                          <Text style={[
                            s.durationBtnText,
                            sellDuration === d.hours && s.durationBtnTextActive,
                          ]}>
                            {d.label}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>

                    {sellError ? (
                      <View style={s.sellWarning}>
                        <Text style={s.sellWarningText}>{sellError}</Text>
                      </View>
                    ) : null}

                    {/* Actions */}
                    <View style={s.sellActions}>
                      <TouchableOpacity style={s.sellBtnCancel} onPress={closeSell}>
                        <Text style={s.sellBtnCancelText}>CANCELAR</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[s.sellBtnConfirm, sellState === "loading" && { opacity: 0.6 }]}
                        onPress={submitSell}
                        disabled={sellState === "loading"}
                      >
                        {sellState === "loading" ? (
                          <ActivityIndicator size="small" color="#FFF" />
                        ) : (
                          <Text style={s.sellBtnConfirmText}>LEILOAR</Text>
                        )}
                      </TouchableOpacity>
                    </View>
                  </>
                ) : (
                  /* Success state */
                  <View style={s.sellSuccess}>
                    <Text style={s.sellSuccessEmoji}>🔨</Text>
                    <Text style={s.sellSuccessTitle}>LEILÃO CRIADO!</Text>
                    <Text style={s.sellSuccessSub}>
                      {selected.name} está no mercado por {sellDuration}h
                    </Text>
                    <Text style={s.sellSuccessSub}>
                      Preço inicial: {fmtPrice(parseInt(sellPrice || "0"))}
                    </Text>
                    <TouchableOpacity
                      style={[s.sellBtnConfirm, { marginTop: 20 }]}
                      onPress={() => {
                        closeSell();
                        setModalOpen(false);
                      }}
                    >
                      <Text style={s.sellBtnConfirmText}>ÓTIMO!</Text>
                    </TouchableOpacity>
                  </View>
                )}

              </View>
            )}
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#080808" },

  // Header
  header: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#141414",
    gap: 12,
  },
  headerTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  headerTitle: { fontSize: 13, fontWeight: "800", color: "#6B7280", letterSpacing: 3 },
  addBtn: { backgroundColor: "#10B981", paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6 },
  addBtnText: { fontSize: 11, fontWeight: "800", color: "#000", letterSpacing: 0.5 },

  statsRow: { flexDirection: "row", gap: 8 },
  statCard: {
    flex: 1, backgroundColor: "#111", borderRadius: 10, borderWidth: 1,
    borderColor: "#1E1E1E", paddingVertical: 10, alignItems: "center",
  },
  statValue: { fontSize: 15, fontWeight: "900", color: "#10B981" },
  statLabel: { fontSize: 9, color: "#6B7280", marginTop: 2, letterSpacing: 0.5 },

  condRow: { gap: 6 },
  condItem: { gap: 4 },
  condTrack: { height: 3, backgroundColor: "#1E1E1E", borderRadius: 2, overflow: "hidden" },
  condFill:  { height: 3, borderRadius: 2 },
  condLabel: { fontSize: 9, fontWeight: "600", letterSpacing: 0.5 },

  // List
  list: { flex: 1 },

  actions: { flexDirection: "row", gap: 8, padding: 16, paddingBottom: 8 },
  actionBtn: {
    flex: 1, backgroundColor: "#111", borderRadius: 10, borderWidth: 1,
    borderColor: "#1E1E1E", paddingVertical: 12, alignItems: "center", gap: 6,
  },
  actionIcon:  { fontSize: 20 },
  actionLabel: { fontSize: 10, fontWeight: "700", color: "#9CA3AF", letterSpacing: 1 },

  sectionTitle: {
    fontSize: 11, fontWeight: "800", color: "#4B5563",
    letterSpacing: 3, paddingHorizontal: 16, marginBottom: 8,
  },

  center: { paddingVertical: 40, alignItems: "center" },
  emptyText: { color: "#4B5563", fontSize: 13 },

  // Player card
  card: {
    marginHorizontal: 16, marginBottom: 10, backgroundColor: "#0D0D0D",
    borderRadius: 12, borderWidth: 1, borderColor: "#1A1A1A",
    borderLeftWidth: 3, padding: 14, gap: 10,
  },
  cardTop: { flexDirection: "row", alignItems: "center", gap: 10 },
  avatar: {
    width: 40, height: 40, borderRadius: 20,
    borderWidth: 1, justifyContent: "center", alignItems: "center",
  },
  avatarText: { fontSize: 16, fontWeight: "800" },
  cardInfo: { flex: 1, gap: 4 },
  playerName: { fontSize: 15, fontWeight: "700", color: "#FFFFFF" },
  cardMeta: { flexDirection: "row", alignItems: "center", gap: 6 },
  roleBadge: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 4 },
  roleText:  { fontSize: 10, fontWeight: "700", letterSpacing: 0.5 },
  ageDot:    { color: "#374151", fontSize: 12 },
  ageText:   { fontSize: 11, color: "#6B7280" },
  ratingBadge: {
    width: 44, height: 44, borderRadius: 10, borderWidth: 1,
    justifyContent: "center", alignItems: "center",
  },
  ratingText: { fontSize: 17, fontWeight: "900" },

  statusChip: {
    alignSelf: "flex-start", flexDirection: "row", alignItems: "center",
    gap: 5, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20, borderWidth: 1,
  },
  statusDot:  { width: 5, height: 5, borderRadius: 2.5 },
  statusText: { fontSize: 9, fontWeight: "800", letterSpacing: 0.5 },

  statsGrid: {
    flexDirection: "row", justifyContent: "space-between",
    paddingTop: 10, borderTopWidth: 1, borderTopColor: "#141414",
  },
  statItem:       { alignItems: "center", flex: 1 },
  statItemLabel:  { fontSize: 9, color: "#6B7280", marginBottom: 2, letterSpacing: 0.5 },
  statItemValue:  { fontSize: 13, fontWeight: "700", color: "#E5E7EB" },

  miniBars: { gap: 5 },
  miniBar:  { flexDirection: "row", alignItems: "center", gap: 6 },
  miniBarLabel: { width: 10, fontSize: 9, fontWeight: "700" },
  miniBarTrack: { flex: 1, height: 3, backgroundColor: "#1E1E1E", borderRadius: 2, overflow: "hidden" },
  miniBarFill:  { height: 3, borderRadius: 2 },
  miniBarValue: { width: 20, fontSize: 9, fontWeight: "700", textAlign: "right" },

  contractText: { fontSize: 10, color: "#4B5563" },

  // Modal
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.7)", justifyContent: "flex-end" },
  sheet: {
    backgroundColor: "#0D0D0D", borderTopLeftRadius: 24, borderTopRightRadius: 24,
    borderWidth: 1, borderColor: "#1A1A1A", maxHeight: "92%",
  },
  handle: {
    width: 36, height: 4, borderRadius: 2, backgroundColor: "#2A2A2A",
    alignSelf: "center", marginTop: 12, marginBottom: 4,
  },
  modalHeader: {
    flexDirection: "row", alignItems: "center", gap: 12,
    padding: 16, paddingBottom: 14, borderBottomWidth: 1,
  },
  modalAvatar: {
    width: 52, height: 52, borderRadius: 26,
    borderWidth: 2, justifyContent: "center", alignItems: "center",
  },
  modalAvatarText: { fontSize: 22, fontWeight: "900" },
  modalName:       { fontSize: 20, fontWeight: "800", color: "#FFFFFF", marginBottom: 6 },
  modalMeta:       { flexDirection: "row", gap: 6, flexWrap: "wrap" },
  modalRating: {
    width: 52, height: 52, borderRadius: 12, borderWidth: 1,
    justifyContent: "center", alignItems: "center",
  },
  modalRatingNum:   { fontSize: 20, fontWeight: "900" },
  modalRatingLabel: { fontSize: 8, color: "#6B7280", fontWeight: "700", letterSpacing: 1 },

  modalSection:      { paddingHorizontal: 16, paddingTop: 16 },
  modalSectionTitle: { fontSize: 10, fontWeight: "800", color: "#4B5563", letterSpacing: 3, marginBottom: 10 },

  infoGrid: { flexDirection: "row", gap: 8 },
  infoCard: {
    flex: 1, backgroundColor: "#111", borderRadius: 10, borderWidth: 1,
    borderColor: "#1E1E1E", padding: 12,
  },
  infoLabel: { fontSize: 9, color: "#6B7280", letterSpacing: 0.5, marginBottom: 4 },
  infoValue: { fontSize: 12, fontWeight: "700", color: "#E5E7EB" },

  statsGrid4: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  statBox: {
    width: (width - 56) / 3, backgroundColor: "#111", borderRadius: 10,
    borderWidth: 1, borderColor: "#1E1E1E", padding: 12, alignItems: "center",
  },
  statBoxValue: { fontSize: 20, fontWeight: "900", color: "#FFFFFF", marginBottom: 2 },
  statBoxLabel: { fontSize: 9, color: "#6B7280", letterSpacing: 0.5 },

  skillsContainer: { backgroundColor: "#111", borderRadius: 12, borderWidth: 1, borderColor: "#1E1E1E", padding: 14, gap: 12 },
  skillRow:   { gap: 6 },
  skillName:  { fontSize: 12, color: "#9CA3AF" },
  skillTrack: { height: 5, backgroundColor: "#1E1E1E", borderRadius: 3, overflow: "hidden" },
  skillFill:  { height: 5, borderRadius: 3 },
  skillValue: { fontSize: 11, fontWeight: "700", textAlign: "right" },

  condCard: { backgroundColor: "#111", borderRadius: 12, borderWidth: 1, borderColor: "#1E1E1E", padding: 14 },

  modalActions: { paddingHorizontal: 16, paddingTop: 16, gap: 10 },
  modalBtn: { paddingVertical: 14, borderRadius: 12, alignItems: "center" },
  modalBtnText: { fontSize: 13, fontWeight: "800", color: "#000", letterSpacing: 0.5 },
  modalBtnRow: { flexDirection: "row", gap: 10 },
  modalBtnSm: {
    flex: 1, paddingVertical: 12, borderRadius: 12, borderWidth: 1,
    alignItems: "center", backgroundColor: "#111",
  },
  modalBtnSmText: { fontSize: 12, fontWeight: "700", color: "#9CA3AF" },

  // Attribute groups
  attrGroupHeader: {
    flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 10,
  },
  attrGroupDot:  { width: 6, height: 6, borderRadius: 3 },
  attrGroupAvg:  { marginLeft: "auto", paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
  attrGroupAvgText: { fontSize: 11, fontWeight: "800" },
  attrList:  { backgroundColor: "#111", borderRadius: 12, borderWidth: 1, borderColor: "#1E1E1E", padding: 12, gap: 9 },
  attrRow:   { flexDirection: "row", alignItems: "center", gap: 8 },
  attrLabel: { width: 110, fontSize: 11, color: "#9CA3AF" },
  attrTrack: { flex: 1, height: 4, backgroundColor: "#1E1E1E", borderRadius: 2, overflow: "hidden" },
  attrFill:  { height: 4, borderRadius: 2 },
  attrValue: { width: 24, fontSize: 11, fontWeight: "800", textAlign: "right" },

  // Sell modal
  sellContent: { paddingHorizontal: 20, paddingBottom: 36 },
  sellHeader: { marginBottom: 16 },
  sellTitle: { fontSize: 13, fontWeight: "900", color: "#FFFFFF", letterSpacing: 3, marginBottom: 6 },
  sellSub: { fontSize: 12, color: "#6B7280", lineHeight: 18 },

  sellPlayerRow: {
    flexDirection: "row", alignItems: "center", gap: 12,
    backgroundColor: "#111", borderRadius: 12, borderWidth: 1, borderColor: "#1A1A1A",
    padding: 12, marginBottom: 20,
  },
  sellAvatar: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: "#1A1A1A", borderWidth: 1.5,
    justifyContent: "center", alignItems: "center",
  },
  sellAvatarText: { fontSize: 18, fontWeight: "800" },
  sellPlayerName: { fontSize: 14, fontWeight: "700", color: "#FFFFFF" },
  sellPlayerMeta: { fontSize: 11, color: "#6B7280", marginTop: 2 },
  sellRating: {
    width: 40, height: 40, borderRadius: 8, borderWidth: 1,
    backgroundColor: "#0D0D0D", justifyContent: "center", alignItems: "center",
  },
  sellRatingNum: { fontSize: 16, fontWeight: "900" },

  sellLabel: {
    fontSize: 10, fontWeight: "800", color: "#4B5563",
    letterSpacing: 2, marginBottom: 8,
  },
  sellInputWrap: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: "#111", borderWidth: 1, borderColor: "#242424",
    borderRadius: 10, paddingHorizontal: 14, height: 52, gap: 6, marginBottom: 16,
  },
  sellDollar: { fontSize: 18, color: "#6B7280", fontWeight: "700" },
  sellInput: { flex: 1, fontSize: 22, fontWeight: "900", color: "#FFFFFF" },
  sellPriceFmt: { fontSize: 12, color: "#4B5563", fontWeight: "600" },

  durationRow: { flexDirection: "row", gap: 8, marginBottom: 20 },
  durationBtn: {
    flex: 1, paddingVertical: 10, borderRadius: 10,
    backgroundColor: "#111", borderWidth: 1, borderColor: "#1A1A1A",
    alignItems: "center",
  },
  durationBtnActive: { backgroundColor: "#EF444422", borderColor: "#EF4444" },
  durationBtnText: { fontSize: 13, fontWeight: "700", color: "#6B7280" },
  durationBtnTextActive: { color: "#EF4444" },

  sellWarning: {
    backgroundColor: "rgba(239,68,68,0.08)", borderWidth: 1, borderColor: "rgba(239,68,68,0.2)",
    borderRadius: 8, padding: 10, marginBottom: 12,
  },
  sellWarningText: { fontSize: 12, color: "#EF4444", fontWeight: "600" },

  sellActions: { flexDirection: "row", gap: 12 },
  sellBtnCancel: {
    flex: 1, paddingVertical: 14, borderRadius: 10,
    backgroundColor: "#161616", borderWidth: 1, borderColor: "#242424", alignItems: "center",
  },
  sellBtnCancelText: { fontSize: 13, fontWeight: "700", color: "#6B7280", letterSpacing: 1 },
  sellBtnConfirm: {
    flex: 2, paddingVertical: 14, borderRadius: 10,
    backgroundColor: "#EF4444", alignItems: "center",
  },
  sellBtnConfirmText: { fontSize: 13, fontWeight: "900", color: "#FFFFFF", letterSpacing: 1 },

  sellSuccess: { paddingVertical: 32, alignItems: "center", gap: 8 },
  sellSuccessEmoji: { fontSize: 44, marginBottom: 4 },
  sellSuccessTitle: { fontSize: 15, fontWeight: "900", color: "#10B981", letterSpacing: 2 },
  sellSuccessSub: { fontSize: 12, color: "#6B7280", textAlign: "center" },
});
