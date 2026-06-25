import { supabase } from "@/database/supabase";
import { router } from "expo-router";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
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

// ── Types ────────────────────────────────────────────────────────────────────

interface PlayerSkill {
  name: string;
  value: number;
}

interface AuctionItem {
  id: string;
  player_id: string;
  seller_team_id: string;
  seller_team_name: string;
  current_bidder_team_id: string | null;
  current_bidder_name: string | null;
  start_price: number;
  current_bid: number;
  ends_at: string;
  status: "active" | "ended" | "cancelled";
  player_name: string;
  player_role: string;
  player_age: number;
  player_rating: number;
  player_kills: number;
  player_deaths: number;
  player_assists: number;
  player_adr: number;
  player_skills: PlayerSkill[];
  avg_skill: number;
}

type SortKey = "ends_at" | "current_bid" | "rating" | "avg_skill";
type BidState = "idle" | "loading" | "success" | "error";

// ── Helpers ──────────────────────────────────────────────────────────────────

const ROLE_COLOR: Record<string, string> = {
  IGL: "#6366F1",
  AWPer: "#EC4899",
  Entry: "#EF4444",
  Support: "#10B981",
  Flex: "#F59E0B",
};

function getRatingColor(r: number) {
  if (r >= 90) return "#10B981";
  if (r >= 80) return "#F59E0B";
  return "#EF4444";
}

function formatPrice(v: number) {
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `$${(v / 1_000).toFixed(0)}K`;
  return `$${v}`;
}

function formatCountdown(endsAt: string): { text: string; urgent: boolean } {
  const diff = new Date(endsAt).getTime() - Date.now();
  if (diff <= 0) return { text: "ENCERRADO", urgent: true };
  const h = Math.floor(diff / 3_600_000);
  const m = Math.floor((diff % 3_600_000) / 60_000);
  const s = Math.floor((diff % 60_000) / 1_000);
  if (h > 0) return { text: `${h}h ${m}m`, urgent: h < 2 };
  if (m > 0) return { text: `${m}m ${s}s`, urgent: true };
  return { text: `${s}s`, urgent: true };
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function MarketScreen() {
  const [myTeamId, setMyTeamId] = useState<string | null>(null);
  const [budget, setBudget] = useState<number | null>(null);
  const [auctions, setAuctions] = useState<AuctionItem[]>([]);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>("ends_at");

  const [detail, setDetail] = useState<AuctionItem | null>(null);
  const [bidValue, setBidValue] = useState("");
  const [bidState, setBidState] = useState<BidState>("idle");
  const [bidError, setBidError] = useState("");

  // Tick every second to refresh countdowns
  const [, setTick] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Load team ────────────────────────────────────────────────────────────
  useEffect(() => {
    supabase
      .from("teams")
      .select("id, budget")
      .single()
      .then(({ data }) => {
        if (data) {
          setMyTeamId(data.id);
          setBudget(data.budget);
        }
      });
  }, []);

  // ── Fetch auctions ───────────────────────────────────────────────────────
  const fetchAuctions = useCallback(async () => {
    const { data, error } = await supabase
      .from("auctions")
      .select(`
        id,
        player_id,
        seller_team_id,
        current_bidder_team_id,
        start_price,
        current_bid,
        ends_at,
        status,
        player:players(
          id, name, role, age, rating, kills, deaths, assists, adr,
          player_skills(value, skill:skills(name))
        ),
        seller_team:seller_team_id(id, name),
        current_bidder:current_bidder_team_id(id, name)
      `)
      .eq("status", "active")
      .order("ends_at", { ascending: true });

    if (error || !data) {
      setLoading(false);
      return;
    }

    const items: AuctionItem[] = (data as any[]).map((row) => {
      const p = row.player;
      const skills: PlayerSkill[] = (p?.player_skills ?? []).map((ps: any) => ({
        name: ps.skill?.name ?? "",
        value: ps.value,
      }));
      const avg_skill =
        skills.length > 0
          ? Math.round(skills.reduce((s: number, sk: PlayerSkill) => s + sk.value, 0) / skills.length)
          : 0;

      return {
        id: row.id,
        player_id: row.player_id,
        seller_team_id: row.seller_team_id,
        seller_team_name: row.seller_team?.name ?? "—",
        current_bidder_team_id: row.current_bidder_team_id ?? null,
        current_bidder_name: row.current_bidder?.name ?? null,
        start_price: row.start_price,
        current_bid: row.current_bid,
        ends_at: row.ends_at,
        status: row.status,
        player_name: p?.name ?? "—",
        player_role: p?.role ?? "—",
        player_age: p?.age ?? 0,
        player_rating: p?.rating ?? 0,
        player_kills: p?.kills ?? 0,
        player_deaths: p?.deaths ?? 0,
        player_assists: p?.assists ?? 0,
        player_adr: p?.adr ?? 0,
        player_skills: skills,
        avg_skill,
      };
    });

    setAuctions(items);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchAuctions();
  }, [fetchAuctions]);

  // ── Realtime subscription ────────────────────────────────────────────────
  useEffect(() => {
    const channel = supabase
      .channel("auctions-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "auctions" },
        () => fetchAuctions()
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [fetchAuctions]);

  // ── Countdown tick ────────────────────────────────────────────────────────
  useEffect(() => {
    timerRef.current = setInterval(() => setTick((t) => t + 1), 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, []);

  // ── Filtered / sorted ─────────────────────────────────────────────────────
  const allRoles = useMemo(
    () => Array.from(new Set(auctions.map((a) => a.player_role))),
    [auctions]
  );

  const filtered = useMemo(() => {
    let list = [...auctions];
    if (roleFilter) list = list.filter((a) => a.player_role === roleFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (a) =>
          a.player_name.toLowerCase().includes(q) ||
          a.seller_team_name.toLowerCase().includes(q)
      );
    }
    list.sort((a, b) => {
      if (sortKey === "current_bid")
        return (b.current_bid || b.start_price) - (a.current_bid || a.start_price);
      if (sortKey === "rating") return b.player_rating - a.player_rating;
      if (sortKey === "avg_skill") return b.avg_skill - a.avg_skill;
      return new Date(a.ends_at).getTime() - new Date(b.ends_at).getTime();
    });
    return list;
  }, [auctions, search, roleFilter, sortKey]);

  // ── Actions ───────────────────────────────────────────────────────────────
  const openDetail = (a: AuctionItem) => {
    const minNext = Math.max(a.current_bid, a.start_price) + 500;
    setDetail(a);
    setBidValue(String(minNext));
    setBidState("idle");
    setBidError("");
  };

  const closeDetail = () => {
    setDetail(null);
    setBidState("idle");
    setBidError("");
  };

  const submitBid = async () => {
    if (!detail || !myTeamId) return;
    const amount = parseInt(bidValue.replace(/\D/g, ""), 10);
    const minBid = Math.max(detail.current_bid, detail.start_price) + 1;

    if (!amount || amount < minBid) {
      setBidError(`Lance mínimo: ${formatPrice(minBid)}`);
      return;
    }
    if (budget !== null && amount > budget) {
      setBidError("Saldo insuficiente para este lance");
      return;
    }
    if (detail.seller_team_id === myTeamId) {
      setBidError("Você não pode dar lance no próprio jogador");
      return;
    }

    setBidState("loading");
    setBidError("");

    const { error } = await supabase
      .from("auctions")
      .update({ current_bid: amount, current_bidder_team_id: myTeamId })
      .eq("id", detail.id)
      .eq("status", "active");

    if (error) {
      setBidState("error");
      setBidError("Erro ao registrar lance. Tente novamente.");
      return;
    }

    setBidState("success");
    setDetail((prev) =>
      prev
        ? { ...prev, current_bid: amount, current_bidder_team_id: myTeamId, current_bidder_name: "Você" }
        : prev
    );
    fetchAuctions();
  };

  // ── Render ────────────────────────────────────────────────────────────────
  const SORTS: { key: SortKey; label: string }[] = [
    { key: "ends_at", label: "Tempo" },
    { key: "current_bid", label: "Lance" },
    { key: "rating", label: "RTG" },
    { key: "avg_skill", label: "Skills" },
  ];

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>

      {/* ── HEADER ─────────────────────────────────────── */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Text style={styles.backIcon}>‹</Text>
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <View style={styles.headerDot} />
          <Text style={styles.headerTitle}>MERCADO</Text>
        </View>
        <View style={styles.budgetPill}>
          <Text style={styles.budgetLabel}>ORÇAMENTO</Text>
          <Text style={styles.budgetValue}>
            {budget !== null ? formatPrice(budget) : "—"}
          </Text>
        </View>
      </View>

      {/* ── SEARCH ─────────────────────────────────────── */}
      <View style={styles.searchWrap}>
        <Text style={styles.searchIcon}>🔍</Text>
        <TextInput
          style={styles.searchInput}
          placeholder="Buscar jogador ou time..."
          placeholderTextColor="#4B5563"
          value={search}
          onChangeText={setSearch}
          returnKeyType="search"
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => setSearch("")}>
            <Text style={styles.searchClear}>✕</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* ── ROLE FILTERS ───────────────────────────────── */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.filtersScroll}
        contentContainerStyle={styles.filtersContent}
      >
        <TouchableOpacity
          style={[styles.filterPill, !roleFilter && styles.filterPillActive]}
          onPress={() => setRoleFilter(null)}
        >
          <Text style={[styles.filterPillText, !roleFilter && styles.filterPillTextActive]}>
            TODOS
          </Text>
        </TouchableOpacity>
        {allRoles.map((r) => {
          const rc = ROLE_COLOR[r] ?? "#6366F1";
          return (
            <TouchableOpacity
              key={r}
              style={[
                styles.filterPill,
                roleFilter === r && { backgroundColor: rc + "22", borderColor: rc },
              ]}
              onPress={() => setRoleFilter(roleFilter === r ? null : r)}
            >
              <Text style={[styles.filterPillText, roleFilter === r && { color: rc }]}>
                {r}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* ── SORT ROW ───────────────────────────────────── */}
      <View style={styles.sortRow}>
        <Text style={styles.sortLabel}>Ordenar:</Text>
        {SORTS.map((s) => (
          <TouchableOpacity
            key={s.key}
            style={[styles.sortBtn, sortKey === s.key && styles.sortBtnActive]}
            onPress={() => setSortKey(s.key)}
          >
            <Text style={[styles.sortBtnText, sortKey === s.key && styles.sortBtnTextActive]}>
              {s.label}
            </Text>
          </TouchableOpacity>
        ))}
        <Text style={styles.sortCount}>{filtered.length} leilões</Text>
      </View>

      {/* ── LIST ───────────────────────────────────────── */}
      {loading ? (
        <View style={styles.emptyWrap}>
          <ActivityIndicator size="large" color="#6366F1" />
          <Text style={styles.emptyText}>Carregando leilões...</Text>
        </View>
      ) : filtered.length === 0 ? (
        <View style={styles.emptyWrap}>
          <Text style={styles.emptyEmoji}>🔨</Text>
          <Text style={styles.emptyText}>Nenhum leilão ativo</Text>
          <Text style={styles.emptySub}>
            Coloque jogadores à venda pela tela de Gerenciamento
          </Text>
        </View>
      ) : (
        <ScrollView style={styles.list} showsVerticalScrollIndicator={false}>
          <View style={styles.listInner}>
            {filtered.map((a, i) => {
              const cd = formatCountdown(a.ends_at);
              const isMySeller = a.seller_team_id === myTeamId;
              const isMyBid = a.current_bidder_team_id === myTeamId;
              const rc = ROLE_COLOR[a.player_role] ?? "#6366F1";
              const effectiveBid = a.current_bid > 0 ? a.current_bid : a.start_price;

              return (
                <TouchableOpacity
                  key={a.id}
                  activeOpacity={0.75}
                  onPress={() => openDetail(a)}
                  style={[styles.auctionCard, isMyBid && styles.auctionCardMyBid]}
                >
                  {/* Rank */}
                  <Text style={styles.cardRank}>#{i + 1}</Text>

                  {/* Avatar */}
                  <View style={[styles.cardAvatar, { borderColor: rc + "55" }]}>
                    <Text style={styles.cardAvatarText}>{a.player_name[0]}</Text>
                  </View>

                  {/* Info */}
                  <View style={styles.cardInfo}>
                    <View style={styles.cardNameRow}>
                      <Text style={styles.cardName}>{a.player_name}</Text>
                      {isMySeller && (
                        <View style={styles.myBadge}>
                          <Text style={styles.myBadgeText}>MEU</Text>
                        </View>
                      )}
                      {isMyBid && (
                        <View style={[styles.myBadge, styles.myBadgeWinning]}>
                          <Text style={[styles.myBadgeText, { color: "#10B981" }]}>GANHANDO</Text>
                        </View>
                      )}
                    </View>
                    <View style={styles.cardMetaRow}>
                      <View style={[styles.roleTag, { backgroundColor: rc + "22" }]}>
                        <Text style={[styles.roleTagText, { color: rc }]}>{a.player_role}</Text>
                      </View>
                      <Text style={styles.cardTeam}>{a.seller_team_name}</Text>
                      <Text style={styles.cardAge}>{a.player_age}a</Text>
                    </View>
                    <View style={styles.cardBidRow}>
                      <Text style={styles.cardBidLabel}>
                        {a.current_bid > 0 ? "Lance:" : "Início:"}
                      </Text>
                      <Text style={[styles.cardBidValue, isMyBid && { color: "#10B981" }]}>
                        {formatPrice(effectiveBid)}
                      </Text>
                    </View>
                  </View>

                  {/* Right */}
                  <View style={styles.cardRight}>
                    <View style={[styles.ratingBadge, { backgroundColor: getRatingColor(a.player_rating) + "22" }]}>
                      <Text style={[styles.ratingValue, { color: getRatingColor(a.player_rating) }]}>
                        {a.player_rating}
                      </Text>
                    </View>
                    <Text style={[styles.countdown, cd.urgent && styles.countdownUrgent]}>
                      {cd.text}
                    </Text>
                    <Text style={styles.avgSkill}>avg {a.avg_skill}</Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
          <View style={{ height: 32 }} />
        </ScrollView>
      )}

      {/* ── DETAIL BOTTOM SHEET ─────────────────────────── */}
      <Modal
        visible={!!detail}
        transparent
        animationType="slide"
        onRequestClose={closeDetail}
      >
        <Pressable style={styles.overlay} onPress={closeDetail}>
          <Pressable style={styles.sheet} onPress={() => {}}>
            <View style={styles.sheetHandle} />

            {detail && (
              <ScrollView showsVerticalScrollIndicator={false} bounces={false}>

                {/* ── Player header */}
                <View style={styles.detailHeader}>
                  <View style={[
                    styles.detailAvatar,
                    { borderColor: ROLE_COLOR[detail.player_role] ?? "#6366F1" },
                  ]}>
                    <Text style={styles.detailAvatarText}>{detail.player_name[0]}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.detailName}>{detail.player_name}</Text>
                    <View style={styles.detailMetaRow}>
                      <View style={[
                        styles.roleTag,
                        { backgroundColor: (ROLE_COLOR[detail.player_role] ?? "#6366F1") + "22" },
                      ]}>
                        <Text style={[
                          styles.roleTagText,
                          { color: ROLE_COLOR[detail.player_role] ?? "#6366F1" },
                        ]}>
                          {detail.player_role}
                        </Text>
                      </View>
                      <Text style={styles.detailAge}>{detail.player_age} anos</Text>
                    </View>
                    <View style={styles.sellerRow}>
                      <Text style={styles.sellerLabel}>Vendido por</Text>
                      <Text style={styles.sellerName}>{detail.seller_team_name}</Text>
                    </View>
                  </View>
                </View>

                {/* ── Stats */}
                <View style={styles.statsRow}>
                  {[
                    { v: detail.player_rating, l: "Rating", c: getRatingColor(detail.player_rating) },
                    { v: detail.avg_skill, l: "Avg Skill", c: "#6366F1" },
                    {
                      v: detail.player_deaths > 0
                        ? (detail.player_kills / detail.player_deaths).toFixed(2)
                        : "∞",
                      l: "K/D",
                      c: "#10B981",
                    },
                    { v: Number(detail.player_adr).toFixed(0), l: "ADR", c: "#F59E0B" },
                  ].map((stat) => (
                    <View key={stat.l} style={styles.statCard}>
                      <Text style={[styles.statValue, { color: stat.c }]}>{stat.v}</Text>
                      <Text style={styles.statLabel}>{stat.l}</Text>
                    </View>
                  ))}
                </View>

                {/* ── Skills */}
                {detail.player_skills.length > 0 && (
                  <>
                    <Text style={styles.sectionTitle}>SKILLS</Text>
                    <View style={styles.skillsGrid}>
                      {detail.player_skills.map((sk) => (
                        <View key={sk.name} style={styles.skillRow}>
                          <Text style={styles.skillName}>{sk.name}</Text>
                          <View style={styles.skillBarBg}>
                            <View
                              style={[
                                styles.skillBarFill,
                                {
                                  width: `${sk.value}%` as any,
                                  backgroundColor:
                                    sk.value >= 80 ? "#10B981" :
                                    sk.value >= 60 ? "#F59E0B" : "#EF4444",
                                },
                              ]}
                            />
                          </View>
                          <Text style={styles.skillValue}>{sk.value}</Text>
                        </View>
                      ))}
                    </View>
                  </>
                )}

                {/* ── Auction info */}
                <View style={styles.divider} />
                <Text style={styles.sectionTitle}>LEILÃO</Text>
                <View style={styles.auctionInfoRow}>
                  <View style={styles.auctionInfoItem}>
                    <Text style={styles.auctionInfoLabel}>Lance Atual</Text>
                    <Text style={styles.auctionInfoValue}>
                      {detail.current_bid > 0 ? formatPrice(detail.current_bid) : "—"}
                    </Text>
                    {detail.current_bidder_name && (
                      <Text style={styles.auctionBidder}>{detail.current_bidder_name}</Text>
                    )}
                  </View>
                  <View style={styles.auctionInfoDivider} />
                  <View style={styles.auctionInfoItem}>
                    <Text style={styles.auctionInfoLabel}>Preço Inicial</Text>
                    <Text style={styles.auctionInfoValue}>{formatPrice(detail.start_price)}</Text>
                  </View>
                  <View style={styles.auctionInfoDivider} />
                  <View style={styles.auctionInfoItem}>
                    <Text style={styles.auctionInfoLabel}>Tempo</Text>
                    {(() => {
                      const cd = formatCountdown(detail.ends_at);
                      return (
                        <Text style={[styles.auctionInfoValue, cd.urgent && { color: "#EF4444" }]}>
                          {cd.text}
                        </Text>
                      );
                    })()}
                  </View>
                </View>

                {/* ── Bid section (not shown for seller) */}
                {detail.seller_team_id !== myTeamId ? (
                  <>
                    <View style={styles.divider} />

                    {(bidState === "idle" || bidState === "error") && (
                      <>
                        <Text style={styles.bidTitle}>FAZER LANCE</Text>
                        <Text style={styles.bidSub}>
                          Mínimo:{" "}
                          <Text style={{ color: "#FFF", fontWeight: "700" }}>
                            {formatPrice(Math.max(detail.current_bid, detail.start_price) + 1)}
                          </Text>
                        </Text>

                        <View style={styles.offerInputWrap}>
                          <Text style={styles.offerDollar}>$</Text>
                          <TextInput
                            style={styles.offerInput}
                            keyboardType="numeric"
                            value={bidValue}
                            onChangeText={(v) => {
                              setBidValue(v);
                              setBidError("");
                            }}
                            placeholderTextColor="#4B5563"
                          />
                        </View>

                        {/* Quick bids */}
                        <View style={styles.quickOffers}>
                          {[
                            { label: "+$500", val: Math.max(detail.current_bid, detail.start_price) + 500 },
                            { label: "+10%", val: Math.round(Math.max(detail.current_bid, detail.start_price) * 1.1) },
                            { label: "+25%", val: Math.round(Math.max(detail.current_bid, detail.start_price) * 1.25) },
                            { label: "+50%", val: Math.round(Math.max(detail.current_bid, detail.start_price) * 1.5) },
                          ].map((q) => (
                            <TouchableOpacity
                              key={q.label}
                              style={styles.quickBtn}
                              onPress={() => setBidValue(String(q.val))}
                            >
                              <Text style={styles.quickBtnMult}>{q.label}</Text>
                              <Text style={styles.quickBtnVal}>{formatPrice(q.val)}</Text>
                            </TouchableOpacity>
                          ))}
                        </View>

                        {bidError ? (
                          <View style={styles.warningRow}>
                            <Text style={styles.warningText}>{bidError}</Text>
                          </View>
                        ) : (budget !== null && parseInt(bidValue || "0") > budget) ? (
                          <View style={styles.warningRow}>
                            <Text style={styles.warningText}>⚠️ Valor excede seu orçamento</Text>
                          </View>
                        ) : null}

                        <View style={styles.sheetActions}>
                          <TouchableOpacity style={styles.btnCancel} onPress={closeDetail}>
                            <Text style={styles.btnCancelText}>FECHAR</Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={[
                              styles.btnConfirm,
                              (budget !== null && parseInt(bidValue || "0") > budget) &&
                                styles.btnConfirmDisabled,
                            ]}
                            disabled={budget !== null && parseInt(bidValue || "0") > budget}
                            onPress={submitBid}
                          >
                            <Text style={styles.btnConfirmText}>DAR LANCE</Text>
                          </TouchableOpacity>
                        </View>
                      </>
                    )}

                    {bidState === "loading" && (
                      <View style={styles.feedbackWrap}>
                        <ActivityIndicator size="large" color="#6366F1" />
                        <Text style={styles.feedbackTitle}>Registrando lance...</Text>
                      </View>
                    )}

                    {bidState === "success" && (
                      <View style={styles.feedbackWrap}>
                        <Text style={styles.feedbackEmoji}>🔨</Text>
                        <Text style={[styles.feedbackTitle, { color: "#10B981" }]}>
                          LANCE REGISTRADO!
                        </Text>
                        <Text style={styles.feedbackSub}>
                          Você está vencendo com {formatPrice(parseInt(bidValue))}
                        </Text>
                        <Text style={styles.feedbackSub}>
                          O jogador é seu se ninguém superar antes do fim
                        </Text>
                        <TouchableOpacity
                          style={[styles.btnConfirm, { marginTop: 16, alignSelf: "stretch" }]}
                          onPress={closeDetail}
                        >
                          <Text style={styles.btnConfirmText}>ÓTIMO!</Text>
                        </TouchableOpacity>
                      </View>
                    )}
                  </>
                ) : (
                  <View style={[styles.warningRow, styles.infoRow]}>
                    <Text style={[styles.warningText, { color: "#6366F1" }]}>
                      Este jogador do seu time está sendo leiloado
                    </Text>
                  </View>
                )}

                <View style={{ height: 24 }} />
              </ScrollView>
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
  headerDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: "#6366F1" },
  headerTitle: { fontSize: 16, fontWeight: "900", color: "#FFFFFF", letterSpacing: 4 },
  budgetPill: {
    backgroundColor: "#161616", borderWidth: 1, borderColor: "#242424",
    borderRadius: 10, paddingHorizontal: 12, paddingVertical: 6, alignItems: "flex-end",
  },
  budgetLabel: { fontSize: 9, color: "#6B7280", fontWeight: "700", letterSpacing: 1 },
  budgetValue: { fontSize: 14, fontWeight: "900", color: "#10B981" },

  // Search
  searchWrap: {
    flexDirection: "row", alignItems: "center",
    marginHorizontal: 16, marginBottom: 12,
    backgroundColor: "#0D0D0D", borderWidth: 1, borderColor: "#1A1A1A",
    borderRadius: 10, paddingHorizontal: 14, height: 42, gap: 8,
  },
  searchIcon: { fontSize: 14 },
  searchInput: { flex: 1, color: "#FFFFFF", fontSize: 14 },
  searchClear: { fontSize: 13, color: "#4B5563", padding: 4 },

  // Filters
  filtersScroll: { marginBottom: 8 },
  filtersContent: { paddingHorizontal: 16, gap: 8 },
  filterPill: {
    paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20,
    backgroundColor: "#0D0D0D", borderWidth: 1, borderColor: "#1A1A1A",
  },
  filterPillActive: { backgroundColor: "#6366F122", borderColor: "#6366F1" },
  filterPillText: { fontSize: 11, fontWeight: "700", color: "#6B7280", letterSpacing: 0.5 },
  filterPillTextActive: { color: "#6366F1" },

  // Sort row
  sortRow: {
    flexDirection: "row", alignItems: "center",
    paddingHorizontal: 16, marginBottom: 10, gap: 6,
  },
  sortLabel: { fontSize: 11, color: "#4B5563", marginRight: 2 },
  sortBtn: {
    paddingHorizontal: 10, paddingVertical: 4,
    borderRadius: 6, backgroundColor: "#0D0D0D",
    borderWidth: 1, borderColor: "#1A1A1A",
  },
  sortBtnActive: { backgroundColor: "#1A1A2E", borderColor: "#6366F1" },
  sortBtnText: { fontSize: 11, color: "#6B7280", fontWeight: "600" },
  sortBtnTextActive: { color: "#6366F1" },
  sortCount: { flex: 1, textAlign: "right", fontSize: 11, color: "#374151" },

  // Empty state
  emptyWrap: { flex: 1, alignItems: "center", justifyContent: "center", gap: 8, paddingHorizontal: 32 },
  emptyEmoji: { fontSize: 40, marginBottom: 4 },
  emptyText: { fontSize: 15, fontWeight: "700", color: "#6B7280" },
  emptySub: { fontSize: 12, color: "#374151", textAlign: "center" },

  // Auction card
  list: { flex: 1 },
  listInner: { paddingHorizontal: 16, gap: 8 },
  auctionCard: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: "#0D0D0D", borderRadius: 12,
    borderWidth: 1, borderColor: "#1A1A1A",
    paddingHorizontal: 14, paddingVertical: 12, gap: 10,
  },
  auctionCardMyBid: { borderColor: "#10B98144", backgroundColor: "#0A1A12" },
  cardRank: { fontSize: 11, color: "#374151", fontWeight: "700", width: 22 },
  cardAvatar: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: "#161616", borderWidth: 1.5,
    justifyContent: "center", alignItems: "center",
  },
  cardAvatarText: { fontSize: 16, fontWeight: "700", color: "#9CA3AF" },
  cardInfo: { flex: 1, gap: 3 },
  cardNameRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  cardName: { fontSize: 14, fontWeight: "700", color: "#FFFFFF" },
  myBadge: {
    backgroundColor: "#6366F122", borderWidth: 1, borderColor: "#6366F155",
    borderRadius: 4, paddingHorizontal: 5, paddingVertical: 1,
  },
  myBadgeWinning: { backgroundColor: "#10B98122", borderColor: "#10B98155" },
  myBadgeText: { fontSize: 8, fontWeight: "800", color: "#6366F1", letterSpacing: 0.5 },
  cardMetaRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  roleTag: { borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 },
  roleTagText: { fontSize: 9, fontWeight: "800", letterSpacing: 0.5 },
  cardTeam: { fontSize: 11, color: "#6B7280" },
  cardAge: { fontSize: 11, color: "#4B5563" },
  cardBidRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  cardBidLabel: { fontSize: 10, color: "#4B5563" },
  cardBidValue: { fontSize: 12, fontWeight: "800", color: "#FFFFFF" },
  cardRight: { alignItems: "flex-end", gap: 4 },
  ratingBadge: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  ratingValue: { fontSize: 14, fontWeight: "900" },
  countdown: { fontSize: 10, fontWeight: "700", color: "#6B7280" },
  countdownUrgent: { color: "#EF4444" },
  avgSkill: { fontSize: 10, color: "#4B5563" },

  // Overlay / Sheet
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.8)", justifyContent: "flex-end" },
  sheet: {
    backgroundColor: "#0D0D0D",
    borderTopLeftRadius: 20, borderTopRightRadius: 20,
    borderWidth: 1, borderColor: "#1A1A1A",
    paddingHorizontal: 20, paddingTop: 12,
    maxHeight: "90%",
  },
  sheetHandle: {
    width: 36, height: 4, borderRadius: 2,
    backgroundColor: "#2A2A2A", alignSelf: "center", marginBottom: 20,
  },

  // Detail
  detailHeader: { flexDirection: "row", gap: 14, marginBottom: 16 },
  detailAvatar: {
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: "#161616", borderWidth: 2,
    justifyContent: "center", alignItems: "center", flexShrink: 0,
  },
  detailAvatarText: { fontSize: 22, fontWeight: "700", color: "#9CA3AF" },
  detailName: { fontSize: 18, fontWeight: "900", color: "#FFFFFF", marginBottom: 4 },
  detailMetaRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  detailAge: { fontSize: 12, color: "#6B7280" },
  sellerRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 6 },
  sellerLabel: { fontSize: 10, color: "#4B5563" },
  sellerName: { fontSize: 12, fontWeight: "700", color: "#9CA3AF" },

  // Stats
  statsRow: { flexDirection: "row", gap: 6, marginBottom: 16 },
  statCard: {
    flex: 1, backgroundColor: "#111", borderWidth: 1, borderColor: "#1A1A1A",
    borderRadius: 10, padding: 10, alignItems: "center",
  },
  statValue: { fontSize: 16, fontWeight: "900" },
  statLabel: { fontSize: 9, color: "#6B7280", marginTop: 2, fontWeight: "600" },

  // Skills
  sectionTitle: {
    fontSize: 10, fontWeight: "900", color: "#374151",
    letterSpacing: 2, marginBottom: 10,
  },
  skillsGrid: { gap: 7, marginBottom: 16 },
  skillRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  skillName: { fontSize: 10, color: "#6B7280", width: 80, fontWeight: "600" },
  skillBarBg: {
    flex: 1, height: 6, backgroundColor: "#1A1A1A", borderRadius: 3, overflow: "hidden",
  },
  skillBarFill: { height: 6, borderRadius: 3 },
  skillValue: { fontSize: 10, fontWeight: "700", color: "#9CA3AF", width: 22, textAlign: "right" },

  divider: { height: 1, backgroundColor: "#1A1A1A", marginBottom: 14, marginTop: 4 },

  // Auction info
  auctionInfoRow: {
    flexDirection: "row", marginBottom: 16,
    backgroundColor: "#111", borderWidth: 1, borderColor: "#1A1A1A",
    borderRadius: 12, overflow: "hidden",
  },
  auctionInfoItem: { flex: 1, padding: 14, alignItems: "center" },
  auctionInfoDivider: { width: 1, backgroundColor: "#1A1A1A" },
  auctionInfoLabel: { fontSize: 10, color: "#6B7280", marginBottom: 4 },
  auctionInfoValue: { fontSize: 14, fontWeight: "900", color: "#FFFFFF" },
  auctionBidder: { fontSize: 9, color: "#10B981", marginTop: 2 },

  // Bid form
  bidTitle: {
    fontSize: 13, fontWeight: "900", color: "#FFFFFF",
    letterSpacing: 2, marginBottom: 4,
  },
  bidSub: { fontSize: 12, color: "#6B7280", marginBottom: 14 },
  offerInputWrap: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: "#111", borderWidth: 1, borderColor: "#242424",
    borderRadius: 10, paddingHorizontal: 14, height: 52, gap: 6, marginBottom: 12,
  },
  offerDollar: { fontSize: 18, color: "#6B7280", fontWeight: "700" },
  offerInput: { flex: 1, fontSize: 22, fontWeight: "900", color: "#FFFFFF" },
  quickOffers: { flexDirection: "row", gap: 8, marginBottom: 12 },
  quickBtn: {
    flex: 1, backgroundColor: "#111", borderWidth: 1, borderColor: "#1A1A1A",
    borderRadius: 8, paddingVertical: 8, alignItems: "center",
  },
  quickBtnMult: { fontSize: 11, color: "#9CA3AF", fontWeight: "700" },
  quickBtnVal: { fontSize: 10, color: "#6B7280", marginTop: 2 },
  warningRow: {
    backgroundColor: "rgba(239,68,68,0.08)", borderWidth: 1, borderColor: "rgba(239,68,68,0.2)",
    borderRadius: 8, padding: 10, marginBottom: 12,
  },
  infoRow: {
    backgroundColor: "#6366F111", borderColor: "#6366F144", marginTop: 12,
  },
  warningText: { fontSize: 12, color: "#EF4444", fontWeight: "600" },

  // Actions
  sheetActions: { flexDirection: "row", gap: 12, marginTop: 4 },
  btnCancel: {
    flex: 1, paddingVertical: 14, borderRadius: 10,
    backgroundColor: "#161616", borderWidth: 1, borderColor: "#242424",
    alignItems: "center",
  },
  btnCancelText: { fontSize: 13, fontWeight: "700", color: "#6B7280", letterSpacing: 1 },
  btnConfirm: {
    flex: 2, paddingVertical: 14, borderRadius: 10,
    backgroundColor: "#6366F1", alignItems: "center",
  },
  btnConfirmDisabled: { backgroundColor: "#1A1A2E", opacity: 0.5 },
  btnConfirmText: { fontSize: 13, fontWeight: "900", color: "#FFFFFF", letterSpacing: 1 },

  // Feedback
  feedbackWrap: { paddingVertical: 24, alignItems: "center", gap: 8 },
  feedbackEmoji: { fontSize: 40, marginBottom: 4 },
  feedbackTitle: { fontSize: 15, fontWeight: "900", color: "#FFFFFF", letterSpacing: 2 },
  feedbackSub: { fontSize: 12, color: "#6B7280", textAlign: "center" },
});
