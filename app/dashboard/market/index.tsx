import { RewardedAdButton } from "@/components/ui/RewardedAdButton";
import { ScreenHeader } from "@/components/ui/ScreenHeader";
import { TutorialOverlay } from "@/components/ui/TutorialOverlay";
import { supabase } from "@/database/supabase";
import { TutorialStepDef, useScreenTutorial } from "@/hooks/useScreenTutorial";
import { useLanguage } from "@/i18n/LanguageContext";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
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

// ── Types ─────────────────────────────────────────────────────────────────────

type ListingType = "auction" | "direct_sale";
type MarketTab   = "buy" | "sell";
type BuyFilter   = "all" | "auction" | "direct_sale";
type BidState    = "idle" | "loading" | "success" | "error";
type SellStep    = "pick_player" | "configure" | "success";
type SellState   = "idle" | "loading" | "error";

interface PlayerSkill { name: string; value: number }

interface Listing {
  id: string;
  player_id: string;
  seller_team_id: string;
  seller_team_name: string;
  listing_type: ListingType;
  // auction
  start_price: number;
  current_bid: number;
  current_bidder_team_id: string | null;
  current_bidder_name: string | null;
  ends_at: string;
  // direct sale
  sale_price: number | null;
  // common
  status: "active" | "ended" | "cancelled";
  // player snapshot
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

interface RosterPlayer {
  id: string;
  name: string;
  role: string;
  rating: number;
  age: number;
  salary: number;
  listed: boolean; // already has an active listing
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const ROLE_COLOR: Record<string, string> = {
  IGL: "#6366F1", AWPer: "#EC4899", Entry: "#EF4444",
  Support: "#10B981", Flex: "#F59E0B",
};

function getRatingColor(r: number) {
  return r >= 90 ? "#10B981" : r >= 80 ? "#F59E0B" : "#EF4444";
}

function fmtPrice(v: number) {
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `$${(v / 1_000).toFixed(0)}K`;
  return `$${v}`;
}

function fmtCountdown(endsAt: string, closedLabel: string): { text: string; urgent: boolean } {
  const diff = new Date(endsAt).getTime() - Date.now();
  if (diff <= 0) return { text: closedLabel, urgent: true };
  const h = Math.floor(diff / 3_600_000);
  const m = Math.floor((diff % 3_600_000) / 60_000);
  const s = Math.floor((diff % 60_000) / 1_000);
  if (h > 0) return { text: `${h}h ${m}m`, urgent: h < 2 };
  if (m > 0) return { text: `${m}m ${s}s`, urgent: true };
  return { text: `${s}s`, urgent: true };
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function MarketScreen() {
  const { t } = useLanguage();
  const [myTeamId, setMyTeamId]   = useState<string | null>(null);
  const [budget,   setBudget]     = useState<number | null>(null);
  const [listings, setListings]   = useState<Listing[]>([]);
  const [roster,   setRoster]     = useState<RosterPlayer[]>([]);
  const [loading,  setLoading]    = useState(true);

  const [activeTab,   setActiveTab]   = useState<MarketTab>("buy");
  const [buyFilter,   setBuyFilter]   = useState<BuyFilter>("all");
  const [roleFilter,  setRoleFilter]  = useState<string | null>(null);
  const [search,      setSearch]      = useState("");

  // Detail modal (buy side)
  const [detail,    setDetail]    = useState<Listing | null>(null);
  const [bidValue,  setBidValue]  = useState("");
  const [bidState,  setBidState]  = useState<BidState>("idle");
  const [bidError,  setBidError]  = useState("");

  // Direct buy confirm
  const [buyTarget,    setBuyTarget]    = useState<Listing | null>(null);
  const [buyingDirect, setBuyingDirect] = useState(false);
  const [buyError,     setBuyError]     = useState("");

  // Sell side
  const [sellStep,     setSellStep]     = useState<SellStep>("pick_player");
  const [sellPlayer,   setSellPlayer]   = useState<RosterPlayer | null>(null);
  const [sellType,     setSellType]     = useState<ListingType>("auction");
  const [sellPrice,    setSellPrice]    = useState("");
  const [sellDuration, setSellDuration] = useState(24);
  const [sellState,    setSellState]    = useState<SellState>("idle");
  const [sellError,    setSellError]    = useState("");

  const [, setTick] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Tutorial guiado ─────────────────────────────────────────────────────
  const scrollRef = useRef<ScrollView>(null);
  const budgetRef = useRef<View>(null);
  const tabBarRef = useRef<View>(null);
  const searchRowRef = useRef<View>(null);
  const listingsRef = useRef<View>(null);

  const tutorialSteps: TutorialStepDef[] = [
    { ref: null, title: t("tutorial.market.step1Title"), desc: t("tutorial.market.step1Desc") },
    { ref: budgetRef, title: t("tutorial.market.step2Title"), desc: t("tutorial.market.step2Desc") },
    { ref: tabBarRef, title: t("tutorial.market.step3Title"), desc: t("tutorial.market.step3Desc") },
    { ref: searchRowRef, title: t("tutorial.market.step4Title"), desc: t("tutorial.market.step4Desc") },
    { ref: listingsRef, title: t("tutorial.market.step5Title"), desc: t("tutorial.market.step5Desc") },
    { ref: null, title: t("tutorial.market.step6Title"), desc: t("tutorial.market.step6Desc") },
  ];

  const tutorial = useScreenTutorial({
    id: "market",
    steps: tutorialSteps,
    ready: !loading,
    scrollRef,
  });

  // ── Fetch ──────────────────────────────────────────────────────────────────
  const fetchAll = useCallback(async () => {
    // Fecha leilões por lance vencidos (transfere jogador + cobra o vencedor) antes de
    // buscar a lista, já que não há cron — a liquidação é sob demanda pelo client.
    await supabase.rpc("settle_expired_auctions");

    const { data: teamData } = await supabase
      .from("teams").select("id, budget").single();
    if (!teamData) return;
    const tid = teamData.id;
    setMyTeamId(tid);
    setBudget(teamData.budget);

    const [{ data: listData }, { data: pData }, { data: activeListings }] = await Promise.all([
      // All active listings
      supabase.from("auctions").select(`
        id, player_id, seller_team_id, listing_type, sale_price,
        start_price, current_bid, current_bidder_team_id, ends_at, status,
        player:players(id, name, role, age, rating, kills, deaths, assists, adr,
          player_skills(value, skill:skills(name))),
        seller_team:seller_team_id(id, name),
        current_bidder:current_bidder_team_id(id, name)
      `).eq("status", "active").order("ends_at", { ascending: true }),

      // Own roster
      supabase.from("players")
        .select("id, name, role, rating, age, salary")
        .eq("team_id", tid)
        .order("rating", { ascending: false }),

      // Own active listing IDs
      supabase.from("auctions")
        .select("player_id")
        .eq("seller_team_id", tid)
        .eq("status", "active"),
    ]);

    if (listData) {
      const listedIds = new Set((activeListings ?? []).map((l: any) => l.player_id));
      const mapped: Listing[] = (listData as any[]).map((row) => {
        const p = row.player;
        const skills: PlayerSkill[] = (p?.player_skills ?? []).map((ps: any) => ({
          name: ps.skill?.name ?? "", value: ps.value,
        }));
        const avg_skill = skills.length
          ? Math.round(skills.reduce((s, sk) => s + sk.value, 0) / skills.length) : 0;
        return {
          id: row.id,
          player_id: row.player_id,
          seller_team_id: row.seller_team_id,
          seller_team_name: row.seller_team?.name ?? "—",
          listing_type: (row.listing_type ?? "auction") as ListingType,
          start_price: row.start_price,
          current_bid: row.current_bid,
          current_bidder_team_id: row.current_bidder_team_id ?? null,
          current_bidder_name: row.current_bidder?.name ?? null,
          ends_at: row.ends_at,
          sale_price: row.sale_price ?? null,
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
        } as Listing;
      });
      setListings(mapped);

      if (pData) {
        setRoster((pData as any[]).map((p) => ({
          id: p.id, name: p.name, role: p.role,
          rating: p.rating, age: p.age, salary: p.salary,
          listed: listedIds.has(p.id),
        })));
      }
    }

    setLoading(false);
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // Realtime
  useEffect(() => {
    const ch = supabase.channel("market-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "auctions" }, fetchAll)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [fetchAll]);

  // Countdown tick
  useEffect(() => {
    timerRef.current = setInterval(() => setTick((t) => t + 1), 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, []);

  // ── Derived ────────────────────────────────────────────────────────────────
  const allRoles = useMemo(
    () => Array.from(new Set(listings.map((l) => l.player_role))),
    [listings],
  );

  const filtered = useMemo(() => {
    let list = [...listings];
    if (buyFilter !== "all") list = list.filter((l) => l.listing_type === buyFilter);
    if (roleFilter)          list = list.filter((l) => l.player_role === roleFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((l) =>
        l.player_name.toLowerCase().includes(q) ||
        l.seller_team_name.toLowerCase().includes(q),
      );
    }
    return list;
  }, [listings, buyFilter, roleFilter, search]);

  const myListings = useMemo(
    () => listings.filter((l) => l.seller_team_id === myTeamId),
    [listings, myTeamId],
  );

  // ── Buy: auction bid ───────────────────────────────────────────────────────
  const openDetail = (l: Listing) => {
    const minNext = Math.max(l.current_bid, l.start_price) + 500;
    setDetail(l);
    setBidValue(String(minNext));
    setBidState("idle");
    setBidError("");
  };

  const closeDetail = () => { setDetail(null); setBidState("idle"); setBidError(""); };

  const submitBid = async () => {
    if (!detail || !myTeamId) return;
    const amount = parseInt(bidValue.replace(/\D/g, ""), 10);
    const minBid = Math.max(detail.current_bid, detail.start_price) + 1;
    if (!amount || amount < minBid) { setBidError(`${t("market.errMinBid")} ${fmtPrice(minBid)}`); return; }
    if (budget !== null && amount > budget) { setBidError(t("market.errInsufficientBudget")); return; }
    if (detail.seller_team_id === myTeamId) { setBidError(t("market.errCannotBidOwn")); return; }
    setBidState("loading"); setBidError("");
    const { error } = await supabase.rpc("place_bid", {
      p_listing_id: detail.id,
      p_amount:     amount,
    });
    if (error) {
      const msg = error.message?.includes("insufficient_budget")
        ? t("market.errInsufficientBudget")
        : error.message?.includes("bid_too_low")
        ? `${t("market.errMinBid")} ${fmtPrice(minBid)}`
        : error.message?.includes("cannot_bid_own_player")
        ? t("market.errCannotBidOwn")
        : error.message?.includes("auction_ended")
        ? t("market.errAuctionEnded")
        : t("market.errBidGeneric");
      setBidState("error");
      setBidError(msg);
      return;
    }
    setBidState("success");
    setDetail((prev) => prev
      ? { ...prev, current_bid: amount, current_bidder_team_id: myTeamId, current_bidder_name: t("market.you") }
      : prev);
    fetchAll();
  };

  // ── Buy: direct purchase ───────────────────────────────────────────────────
  const confirmBuyDirect = (l: Listing) => { setBuyTarget(l); setBuyError(""); };

  const executeBuyDirect = async () => {
    if (!buyTarget || !myTeamId) return;
    setBuyingDirect(true); setBuyError("");
    const { error } = await supabase.rpc("buy_player_direct", {
      p_listing_id:    buyTarget.id,
      p_buyer_team_id: myTeamId,
    });
    if (error) {
      const msg = error.message?.includes("listing_not_available")
        ? t("market.errListingUnavailable")
        : error.message?.includes("cannot_buy_own_player")
        ? t("market.errCannotBuyOwn")
        : error.message?.includes("insufficient_budget")
        ? t("market.errInsufficientBudget")
        : t("market.errBuyGeneric");
      setBuyError(msg);
      setBuyingDirect(false);
      return;
    }
    setBuyTarget(null);
    setBuyingDirect(false);
    fetchAll();
  };

  // ── Sell ───────────────────────────────────────────────────────────────────
  const selectSellPlayer = (p: RosterPlayer) => {
    setSellPlayer(p);
    setSellPrice(String(p.rating * 1000));
    setSellType("auction");
    setSellDuration(24);
    setSellState("idle");
    setSellError("");
    setSellStep("configure");
  };

  const resetSell = () => {
    setSellStep("pick_player");
    setSellPlayer(null);
    setSellPrice("");
    setSellState("idle");
    setSellError("");
  };

  const submitSell = async () => {
    if (!sellPlayer || !myTeamId) return;
    const price = parseInt(sellPrice.replace(/\D/g, ""), 10);
    if (!price || price <= 0) { setSellError(t("market.errInvalidPrice")); return; }

    setSellState("loading"); setSellError("");
    const endsAt = new Date(Date.now() + sellDuration * 3_600_000).toISOString();

    const payload: Record<string, unknown> = {
      player_id: sellPlayer.id,
      seller_team_id: myTeamId,
      listing_type: sellType,
      start_price: sellType === "auction" ? price : 0,
      ends_at: endsAt,
      status: "active",
    };
    if (sellType === "direct_sale") payload.sale_price = price;

    const { error } = await supabase.from("auctions").insert(payload);
    if (error) { setSellState("error"); setSellError(t("market.errListingGeneric")); return; }

    setSellStep("success");
    fetchAll();
  };

  // ── Render helpers ─────────────────────────────────────────────────────────
  const DURATIONS = [{ label: "1h", hours: 1 }, { label: "6h", hours: 6 }, { label: "12h", hours: 12 }, { label: "24h", hours: 24 }];

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={s.safe} edges={["top"]}>

      <ScreenHeader
        title={t("market.headerTitle")}
        dotColor="#10B981"
        right={
          <View style={s.budgetPill} ref={budgetRef} collapsable={false}>
            <Text style={s.budgetLabel}>{t("market.budgetLabel")}</Text>
            <Text style={s.budgetValue}>{budget !== null ? fmtPrice(budget) : "—"}</Text>
          </View>
        }
      />

      {/* ── TAB BAR ────────────────────────────────────── */}
      <View style={s.tabBar} ref={tabBarRef} collapsable={false}>
        {(["buy", "sell"] as MarketTab[]).map((tab) => (
          <TouchableOpacity
            key={tab}
            style={[s.tabBtn, activeTab === tab && s.tabBtnActive]}
            onPress={() => setActiveTab(tab)}
          >
            <Text style={[s.tabBtnText, activeTab === tab && s.tabBtnTextActive]}>
              {tab === "buy" ? t("market.tabBuy") : t("market.tabSell")}
            </Text>
            {tab === "buy" && listings.length > 0 && (
              <View style={s.tabCount}>
                <Text style={s.tabCountText}>{listings.length}</Text>
              </View>
            )}
            {tab === "sell" && myListings.length > 0 && (
              <View style={[s.tabCount, { backgroundColor: "#F59E0B" }]}>
                <Text style={s.tabCountText}>{myListings.length}</Text>
              </View>
            )}
          </TouchableOpacity>
        ))}
      </View>

      <View style={{ paddingHorizontal: 16, marginTop: 12 }}>
        <RewardedAdButton />
      </View>

      {loading ? (
        <View style={s.center}>
          <ActivityIndicator size="large" color="#10B981" />
          <Text style={s.loadingText}>{t("common.loading")}</Text>
        </View>
      ) : activeTab === "buy" ? (

        /* ════════════════════════════════════════════════
           BUY TAB
        ════════════════════════════════════════════════ */
        <>
          {/* Search */}
          <View style={s.searchRow} ref={searchRowRef} collapsable={false}>
            <View style={s.searchWrap}>
              <Text style={s.searchIcon}>🔍</Text>
              <TextInput
                style={s.searchInput}
                placeholder={t("market.searchPlaceholder")}
                placeholderTextColor="#4B5563"
                value={search}
                onChangeText={setSearch}
              />
              {search.length > 0 && (
                <TouchableOpacity onPress={() => setSearch("")}>
                  <Text style={s.searchClear}>✕</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>

          {/* Type filter */}
          <View style={s.typeRow}>
            {([
              { key: "all",         label: t("market.filterAll") },
              { key: "auction",     label: t("market.filterAuction") },
              { key: "direct_sale", label: t("market.filterDirectSale") },
            ] as { key: BuyFilter; label: string }[]).map((f) => (
              <TouchableOpacity
                key={f.key}
                style={[s.typePill, buyFilter === f.key && s.typePillActive]}
                onPress={() => setBuyFilter(f.key)}
              >
                <Text style={[s.typePillText, buyFilter === f.key && s.typePillTextActive]}>
                  {f.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Role filter */}
          {allRoles.length > 0 && (
            <ScrollView
              horizontal showsHorizontalScrollIndicator={false}
              style={s.rolesScroll} contentContainerStyle={s.rolesContent}
            >
              <TouchableOpacity
                style={[s.rolePill, !roleFilter && s.rolePillActive]}
                onPress={() => setRoleFilter(null)}
              >
                <Text style={[s.rolePillText, !roleFilter && s.rolePillTextActive]}>{t("market.filterAll")}</Text>
              </TouchableOpacity>
              {allRoles.map((r) => {
                const rc = ROLE_COLOR[r] ?? "#6B7280";
                const active = roleFilter === r;
                return (
                  <TouchableOpacity
                    key={r}
                    style={[s.rolePill, active && { backgroundColor: rc + "22", borderColor: rc }]}
                    onPress={() => setRoleFilter(active ? null : r)}
                  >
                    <Text style={[s.rolePillText, active && { color: rc }]}>{r}</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          )}

          {/* Listings */}
          <ScrollView
            ref={scrollRef}
            style={s.list}
            showsVerticalScrollIndicator={false}
            onScroll={tutorial.onScroll}
            scrollEventThrottle={16}
          >
            <View style={s.listInner} ref={listingsRef} collapsable={false}>

              {filtered.length === 0 ? (
                <View style={s.emptyCard}>
                  <Text style={s.emptyEmoji}>🔍</Text>
                  <Text style={s.emptyTitle}>{t("market.emptyTitle")}</Text>
                  <Text style={s.emptySub}>{t("market.emptySub")}</Text>
                </View>
              ) : (
                filtered.map((l) => {
                  const rc       = ROLE_COLOR[l.player_role] ?? "#6B7280";
                  const rtgColor = getRatingColor(l.player_rating);
                  const isMyOwn  = l.seller_team_id === myTeamId;
                  const isMyBid  = l.current_bidder_team_id === myTeamId;
                  const canAfford = budget !== null && (
                    l.listing_type === "direct_sale"
                      ? (l.sale_price ?? 0) <= budget
                      : (Math.max(l.current_bid, l.start_price) + 500) <= budget
                  );

                  return (
                    <View
                      key={l.id}
                      style={[
                        s.listingCard,
                        isMyOwn && s.listingCardOwn,
                        isMyBid && s.listingCardMyBid,
                        l.listing_type === "direct_sale" && s.listingCardDirect,
                      ]}
                    >
                      {/* Type accent bar */}
                      <View style={[
                        s.listingBar,
                        { backgroundColor: l.listing_type === "direct_sale" ? "#10B981" : "#6366F1" },
                      ]} />

                      <View style={s.listingBody}>
                        {/* Top row */}
                        <View style={s.listingTop}>
                          <View style={[s.listingAvatar, { borderColor: rc + "55" }]}>
                            <Text style={[s.listingAvatarText, { color: rc }]}>
                              {l.player_name[0]}
                            </Text>
                          </View>

                          <View style={{ flex: 1 }}>
                            <View style={s.listingNameRow}>
                              <Text style={s.listingName}>{l.player_name}</Text>
                              {isMyOwn && <View style={s.ownBadge}><Text style={s.ownBadgeText}>{t("market.ownBadge")}</Text></View>}
                              {isMyBid && <View style={s.winningBadge}><Text style={s.winningBadgeText}>{t("market.winningBadge")}</Text></View>}
                              <View style={[
                                s.typeBadge,
                                { backgroundColor: l.listing_type === "direct_sale" ? "#10B98122" : "#6366F122",
                                  borderColor:      l.listing_type === "direct_sale" ? "#10B98155" : "#6366F155" },
                              ]}>
                                <Text style={[s.typeBadgeText, {
                                  color: l.listing_type === "direct_sale" ? "#10B981" : "#6366F1",
                                }]}>
                                  {l.listing_type === "direct_sale" ? t("market.typeSale") : t("market.typeAuction")}
                                </Text>
                              </View>
                            </View>

                            <View style={s.listingMeta}>
                              <View style={[s.roleTag, { backgroundColor: rc + "22" }]}>
                                <Text style={[s.roleTagText, { color: rc }]}>{l.player_role}</Text>
                              </View>
                              <Text style={s.listingTeam}>{l.seller_team_name}</Text>
                              <Text style={s.listingAge}>{l.player_age}a</Text>
                            </View>
                          </View>

                          <View style={[s.rtgBadge, { backgroundColor: rtgColor + "22" }]}>
                            <Text style={[s.rtgText, { color: rtgColor }]}>{l.player_rating}</Text>
                          </View>
                        </View>

                        {/* Price / action row */}
                        {l.listing_type === "direct_sale" ? (
                          <View style={s.priceRow}>
                            <View>
                              <Text style={s.priceLabel}>{t("market.priceFixed")}</Text>
                              <Text style={s.priceValue}>{l.sale_price ? fmtPrice(l.sale_price) : "—"}</Text>
                            </View>
                            {!isMyOwn && (
                              <TouchableOpacity
                                style={[s.buyBtn, !canAfford && s.buyBtnDisabled]}
                                disabled={!canAfford}
                                onPress={() => confirmBuyDirect(l)}
                              >
                                <Text style={s.buyBtnText}>
                                  {canAfford ? t("market.buyBtn") : t("market.noBudget")}
                                </Text>
                              </TouchableOpacity>
                            )}
                            {isMyOwn && <Text style={s.ownNote}>{t("market.ownListingNote")}</Text>}
                          </View>
                        ) : (
                          <View style={s.priceRow}>
                            <View>
                              <Text style={s.priceLabel}>
                                {l.current_bid > 0 ? t("market.currentBid") : t("market.startingBid")}
                              </Text>
                              <Text style={[s.priceValue, isMyBid && { color: "#10B981" }]}>
                                {fmtPrice(l.current_bid > 0 ? l.current_bid : l.start_price)}
                              </Text>
                              {(() => {
                                const cd = fmtCountdown(l.ends_at, t("market.closedLabel"));
                                return (
                                  <Text style={[s.cdText, cd.urgent && { color: "#EF4444" }]}>
                                    ⏱ {cd.text}
                                  </Text>
                                );
                              })()}
                            </View>
                            {!isMyOwn && (
                              <TouchableOpacity
                                style={s.bidBtn}
                                onPress={() => openDetail(l)}
                              >
                                <Text style={s.bidBtnText}>{t("market.bidBtn")}</Text>
                              </TouchableOpacity>
                            )}
                            {isMyOwn && <Text style={s.ownNote}>{t("market.ownAuctionNote")}</Text>}
                          </View>
                        )}
                      </View>
                    </View>
                  );
                })
              )}

              {/* My active listings summary */}
              {myListings.length > 0 && (
                <View style={s.myListingsSection}>
                  <Text style={s.myListingsTitle}>{t("market.myListingsTitle")}</Text>
                  {myListings.map((l) => {
                    const cd = l.listing_type === "auction" ? fmtCountdown(l.ends_at, t("market.closedLabel")) : null;
                    return (
                      <View key={l.id} style={s.myListingRow}>
                        <View style={[s.myListingDot, {
                          backgroundColor: l.listing_type === "direct_sale" ? "#10B981" : "#6366F1",
                        }]} />
                        <Text style={s.myListingName}>{l.player_name}</Text>
                        <Text style={s.myListingType}>
                          {l.listing_type === "direct_sale" ? `${fmtPrice(l.sale_price ?? 0)} ${t("market.fixedSuffix")}` : `${l.current_bid > 0 ? fmtPrice(l.current_bid) : fmtPrice(l.start_price)} · ${cd?.text}`}
                        </Text>
                      </View>
                    );
                  })}
                </View>
              )}
            </View>
            <View style={{ height: 48 }} />
          </ScrollView>
        </>

      ) : (

        /* ════════════════════════════════════════════════
           SELL TAB
        ════════════════════════════════════════════════ */
        <ScrollView style={s.list} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 48 }}>

          {sellStep === "pick_player" && (
            <View style={s.sellSection}>
              <Text style={s.sellSectionTitle}>{t("market.pickPlayerTitle")}</Text>
              <Text style={s.sellSectionSub}>{t("market.pickPlayerSub")}</Text>

              {roster.length === 0 ? (
                <View style={s.emptyCard}>
                  <Text style={s.emptyEmoji}>👥</Text>
                  <Text style={s.emptyTitle}>{t("market.emptyRosterTitle")}</Text>
                </View>
              ) : (
                roster.map((p) => {
                  const rc = ROLE_COLOR[p.role] ?? "#6B7280";
                  return (
                    <TouchableOpacity
                      key={p.id}
                      style={[s.rosterCard, p.listed && s.rosterCardListed]}
                      onPress={() => !p.listed && selectSellPlayer(p)}
                      disabled={p.listed}
                      activeOpacity={p.listed ? 1 : 0.75}
                    >
                      <View style={[s.rosterAvatar, { borderColor: rc + "55" }]}>
                        <Text style={[s.rosterAvatarText, { color: rc }]}>{p.name[0]}</Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={[s.rosterName, p.listed && { color: "#4B5563" }]}>{p.name}</Text>
                        <View style={s.rosterMeta}>
                          <View style={[s.roleTag, { backgroundColor: rc + "22" }]}>
                            <Text style={[s.roleTagText, { color: rc }]}>{p.role}</Text>
                          </View>
                          <Text style={s.rosterAge}>{p.age}a</Text>
                          <Text style={s.rosterSalary}>{fmtPrice(p.salary)}{t("market.perMonth")}</Text>
                        </View>
                      </View>
                      <View style={[s.rosterRtg, { backgroundColor: getRatingColor(p.rating) + "22" }]}>
                        <Text style={[s.rosterRtgText, { color: getRatingColor(p.rating) }]}>{p.rating}</Text>
                      </View>
                      {p.listed && (
                        <View style={s.listedOverlay}>
                          <Text style={s.listedOverlayText}>{t("market.listedOverlay")}</Text>
                        </View>
                      )}
                    </TouchableOpacity>
                  );
                })
              )}
            </View>
          )}

          {sellStep === "configure" && sellPlayer && (
            <View style={s.sellSection}>
              {/* Back */}
              <TouchableOpacity style={s.sellBack} onPress={resetSell}>
                <Text style={s.sellBackText}>{t("market.changePlayer")}</Text>
              </TouchableOpacity>

              {/* Player header */}
              {(() => {
                const rc = ROLE_COLOR[sellPlayer.role] ?? "#6B7280";
                return (
                  <View style={[s.sellPlayerCard, { borderColor: rc + "44" }]}>
                    <View style={[s.rosterAvatar, { borderColor: rc + "55" }]}>
                      <Text style={[s.rosterAvatarText, { color: rc }]}>{sellPlayer.name[0]}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={s.rosterName}>{sellPlayer.name}</Text>
                      <View style={s.rosterMeta}>
                        <View style={[s.roleTag, { backgroundColor: rc + "22" }]}>
                          <Text style={[s.roleTagText, { color: rc }]}>{sellPlayer.role}</Text>
                        </View>
                        <Text style={s.rosterAge}>{sellPlayer.age}a</Text>
                      </View>
                    </View>
                    <View style={[s.rosterRtg, { backgroundColor: getRatingColor(sellPlayer.rating) + "22" }]}>
                      <Text style={[s.rosterRtgText, { color: getRatingColor(sellPlayer.rating) }]}>
                        {sellPlayer.rating}
                      </Text>
                    </View>
                  </View>
                );
              })()}

              {/* Type selector */}
              <Text style={s.configLabel}>{t("market.saleTypeLabel")}</Text>
              <View style={s.typeSelector}>
                <TouchableOpacity
                  style={[s.typeSelectorBtn, sellType === "auction" && s.typeSelectorBtnActive]}
                  onPress={() => setSellType("auction")}
                >
                  <Text style={s.typeSelectorIcon}>🔨</Text>
                  <Text style={[s.typeSelectorLabel, sellType === "auction" && s.typeSelectorLabelActive]}>
                    {t("market.auctionOption")}
                  </Text>
                  <Text style={s.typeSelectorDesc}>{t("market.auctionDesc")}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[s.typeSelectorBtn, sellType === "direct_sale" && s.typeSelectorBtnActiveDirect]}
                  onPress={() => setSellType("direct_sale")}
                >
                  <Text style={s.typeSelectorIcon}>🏷️</Text>
                  <Text style={[s.typeSelectorLabel, sellType === "direct_sale" && s.typeSelectorLabelActiveDirect]}>
                    {t("market.directSaleOption")}
                  </Text>
                  <Text style={s.typeSelectorDesc}>{t("market.directSaleDesc")}</Text>
                </TouchableOpacity>
              </View>

              {/* Price */}
              <Text style={s.configLabel}>
                {sellType === "auction" ? t("market.startingBidLabel") : t("market.salePriceLabel")}
              </Text>
              <View style={s.priceInputWrap}>
                <Text style={s.priceInputDollar}>$</Text>
                <TextInput
                  style={s.priceInput}
                  keyboardType="numeric"
                  value={sellPrice}
                  onChangeText={(v) => { setSellPrice(v); setSellError(""); }}
                  placeholderTextColor="#4B5563"
                  placeholder="0"
                />
                {sellPrice.length > 0 && (
                  <Text style={s.priceInputFmt}>
                    {fmtPrice(parseInt(sellPrice.replace(/\D/g, "") || "0"))}
                  </Text>
                )}
              </View>

              {/* Duration (auction only) */}
              {sellType === "auction" && (
                <>
                  <Text style={s.configLabel}>{t("market.auctionDurationLabel")}</Text>
                  <View style={s.durationRow}>
                    {DURATIONS.map((d) => (
                      <TouchableOpacity
                        key={d.hours}
                        style={[s.durationBtn, sellDuration === d.hours && s.durationBtnActive]}
                        onPress={() => setSellDuration(d.hours)}
                      >
                        <Text style={[s.durationBtnText, sellDuration === d.hours && s.durationBtnTextActive]}>
                          {d.label}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </>
              )}

              {/* Info note */}
              <View style={[s.infoNote, { borderColor: sellType === "direct_sale" ? "#10B98133" : "#6366F133" }]}>
                <Text style={[s.infoNoteText, { color: sellType === "direct_sale" ? "#10B981" : "#818CF8" }]}>
                  {sellType === "direct_sale"
                    ? t("market.infoDirectSale")
                    : t("market.infoAuction").replace("{h}", String(sellDuration))}
                </Text>
              </View>

              {sellError ? (
                <View style={s.errorBox}>
                  <Text style={s.errorText}>⚠ {sellError}</Text>
                </View>
              ) : null}

              {/* Actions */}
              <View style={s.sellActions}>
                <TouchableOpacity style={s.sellBtnCancel} onPress={resetSell}>
                  <Text style={s.sellBtnCancelText}>{t("market.cancelBtn")}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    s.sellBtnConfirm,
                    { backgroundColor: sellType === "direct_sale" ? "#10B981" : "#6366F1" },
                    sellState === "loading" && { opacity: 0.6 },
                  ]}
                  onPress={submitSell}
                  disabled={sellState === "loading"}
                >
                  {sellState === "loading"
                    ? <ActivityIndicator size="small" color="#FFF" />
                    : <Text style={s.sellBtnConfirmText}>
                        {sellType === "direct_sale" ? t("market.listBtn") : t("market.createAuctionBtn")}
                      </Text>}
                </TouchableOpacity>
              </View>
            </View>
          )}

          {sellStep === "success" && sellPlayer && (
            <View style={s.successCard}>
              <Text style={s.successEmoji}>{sellType === "direct_sale" ? "🏷️" : "🔨"}</Text>
              <Text style={s.successTitle}>
                {sellType === "direct_sale" ? t("market.listingCreatedTitle") : t("market.auctionCreatedTitle")}
              </Text>
              <Text style={s.successSub}>{sellPlayer.name} {t("market.onMarket")}</Text>
              {sellType === "auction" && (
                <Text style={s.successSub}>{t("market.startingBidColon")} {fmtPrice(parseInt(sellPrice || "0"))}</Text>
              )}
              {sellType === "direct_sale" && (
                <Text style={s.successSub}>{t("market.priceColon")} {fmtPrice(parseInt(sellPrice || "0"))}</Text>
              )}
              <TouchableOpacity
                style={[s.sellBtnConfirm, { backgroundColor: "#10B981", marginTop: 24, alignSelf: "stretch" }]}
                onPress={() => { resetSell(); setActiveTab("buy"); }}
              >
                <Text style={s.sellBtnConfirmText}>{t("market.viewOnMarket")}</Text>
              </TouchableOpacity>
            </View>
          )}

        </ScrollView>
      )}

      {/* ── MODAL: LEILÃO — DAR LANCE ─────────────────── */}
      <Modal visible={!!detail} transparent animationType="slide" onRequestClose={closeDetail}>
        <Pressable style={s.overlay} onPress={closeDetail}>
          <Pressable style={s.sheet} onPress={() => {}}>
            <View style={s.sheetHandle} />
            {detail && (
              <ScrollView showsVerticalScrollIndicator={false} bounces={false}>
                {/* Player header */}
                <View style={s.detailHeader}>
                  <View style={[s.detailAvatar, { borderColor: (ROLE_COLOR[detail.player_role] ?? "#6B7280") }]}>
                    <Text style={s.detailAvatarText}>{detail.player_name[0]}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.detailName}>{detail.player_name}</Text>
                    <View style={s.detailMeta}>
                      <View style={[s.roleTag, { backgroundColor: (ROLE_COLOR[detail.player_role] ?? "#6B7280") + "22" }]}>
                        <Text style={[s.roleTagText, { color: ROLE_COLOR[detail.player_role] ?? "#6B7280" }]}>
                          {detail.player_role}
                        </Text>
                      </View>
                      <Text style={s.detailAge}>{detail.player_age} {t("market.yearsOld")}</Text>
                    </View>
                    <Text style={s.detailTeam}>{t("market.soldBy")} {detail.seller_team_name}</Text>
                  </View>
                  <View style={[s.rtgBadge, { backgroundColor: getRatingColor(detail.player_rating) + "22" }]}>
                    <Text style={[s.rtgText, { color: getRatingColor(detail.player_rating) }]}>
                      {detail.player_rating}
                    </Text>
                  </View>
                </View>

                {/* Stats */}
                <View style={s.statsRow}>
                  {[
                    { v: detail.player_rating, l: t("market.statRating"), c: getRatingColor(detail.player_rating) },
                    { v: detail.avg_skill,     l: t("market.statAvgSkill"), c: "#6366F1" },
                    { v: detail.player_deaths > 0
                        ? (detail.player_kills / detail.player_deaths).toFixed(2) : "∞",
                      l: t("market.statKD"), c: "#10B981" },
                    { v: Number(detail.player_adr).toFixed(0), l: t("market.statADR"), c: "#F59E0B" },
                  ].map((stat) => (
                    <View key={stat.l} style={s.statCard}>
                      <Text style={[s.statValue, { color: stat.c }]}>{stat.v}</Text>
                      <Text style={s.statLabel}>{stat.l}</Text>
                    </View>
                  ))}
                </View>

                {/* Skills */}
                {detail.player_skills.length > 0 && (
                  <View style={s.skillsWrap}>
                    <Text style={s.skillsTitle}>{t("market.skillsTitle")}</Text>
                    {detail.player_skills.map((sk) => (
                      <View key={sk.name} style={s.skillRow}>
                        <Text style={s.skillName}>{sk.name}</Text>
                        <View style={s.skillBarBg}>
                          <View style={[s.skillBarFill, {
                            width: `${sk.value}%` as any,
                            backgroundColor: sk.value >= 80 ? "#10B981" : sk.value >= 60 ? "#F59E0B" : "#EF4444",
                          }]} />
                        </View>
                        <Text style={s.skillValue}>{sk.value}</Text>
                      </View>
                    ))}
                  </View>
                )}

                {/* Auction info */}
                <View style={s.auctionInfoRow}>
                  <View style={s.auctionInfoItem}>
                    <Text style={s.auctionInfoLabel}>{t("market.auctionCurrentBid")}</Text>
                    <Text style={s.auctionInfoValue}>
                      {detail.current_bid > 0 ? fmtPrice(detail.current_bid) : "—"}
                    </Text>
                    {detail.current_bidder_name && (
                      <Text style={s.auctionBidder}>{detail.current_bidder_name}</Text>
                    )}
                  </View>
                  <View style={s.auctionInfoDivider} />
                  <View style={s.auctionInfoItem}>
                    <Text style={s.auctionInfoLabel}>{t("market.auctionStart")}</Text>
                    <Text style={s.auctionInfoValue}>{fmtPrice(detail.start_price)}</Text>
                  </View>
                  <View style={s.auctionInfoDivider} />
                  <View style={s.auctionInfoItem}>
                    <Text style={s.auctionInfoLabel}>{t("market.auctionTime")}</Text>
                    {(() => {
                      const cd = fmtCountdown(detail.ends_at, t("market.closedLabel"));
                      return <Text style={[s.auctionInfoValue, cd.urgent && { color: "#EF4444" }]}>{cd.text}</Text>;
                    })()}
                  </View>
                </View>

                {/* Bid form */}
                {bidState !== "success" ? (
                  <>
                    <Text style={s.bidTitle}>{t("market.makeBidTitle")}</Text>
                    <Text style={s.bidSub}>
                      {t("market.minimumLabel")}{" "}
                      <Text style={{ color: "#FFF", fontWeight: "700" }}>
                        {fmtPrice(Math.max(detail.current_bid, detail.start_price) + 1)}
                      </Text>
                    </Text>
                    <View style={s.bidInputWrap}>
                      <Text style={s.bidInputDollar}>$</Text>
                      <TextInput
                        style={s.bidInput}
                        keyboardType="numeric"
                        value={bidValue}
                        onChangeText={(v) => { setBidValue(v); setBidError(""); }}
                        placeholderTextColor="#4B5563"
                      />
                    </View>
                    {/* Quick bids */}
                    <View style={s.quickBids}>
                      {[
                        { label: "+$500",  val: Math.max(detail.current_bid, detail.start_price) + 500 },
                        { label: "+10%",   val: Math.round(Math.max(detail.current_bid, detail.start_price) * 1.1) },
                        { label: "+25%",   val: Math.round(Math.max(detail.current_bid, detail.start_price) * 1.25) },
                        { label: "+50%",   val: Math.round(Math.max(detail.current_bid, detail.start_price) * 1.5) },
                      ].map((q) => (
                        <TouchableOpacity key={q.label} style={s.quickBidBtn} onPress={() => setBidValue(String(q.val))}>
                          <Text style={s.quickBidMult}>{q.label}</Text>
                          <Text style={s.quickBidVal}>{fmtPrice(q.val)}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                    {bidError ? <View style={s.errBox}><Text style={s.errText}>{bidError}</Text></View> : null}
                    <View style={s.bidActions}>
                      <TouchableOpacity style={s.bidBtnCancel} onPress={closeDetail}>
                        <Text style={s.bidBtnCancelText}>{t("market.closeBtn")}</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[s.bidBtnConfirm, bidState === "loading" && { opacity: 0.6 }]}
                        onPress={submitBid}
                        disabled={bidState === "loading"}
                      >
                        {bidState === "loading"
                          ? <ActivityIndicator size="small" color="#FFF" />
                          : <Text style={s.bidBtnConfirmText}>{t("market.bidBtn")}</Text>}
                      </TouchableOpacity>
                    </View>
                  </>
                ) : (
                  <View style={s.bidSuccessWrap}>
                    <Text style={s.bidSuccessEmoji}>🔨</Text>
                    <Text style={s.bidSuccessTitle}>{t("market.bidRegisteredTitle")}</Text>
                    <Text style={s.bidSuccessSub}>
                      {t("market.winningWith")} {fmtPrice(parseInt(bidValue))}
                    </Text>
                    <TouchableOpacity style={[s.bidBtnConfirm, { marginTop: 16, alignSelf: "stretch" }]} onPress={closeDetail}>
                      <Text style={s.bidBtnConfirmText}>{t("market.greatBtn")}</Text>
                    </TouchableOpacity>
                  </View>
                )}
                <View style={{ height: 24 }} />
              </ScrollView>
            )}
          </Pressable>
        </Pressable>
      </Modal>

      {/* ── MODAL: CONFIRMAR COMPRA DIRETA ────────────── */}
      <Modal visible={!!buyTarget} transparent animationType="fade" onRequestClose={() => setBuyTarget(null)}>
        <Pressable style={s.confirmOverlay} onPress={() => !buyingDirect && setBuyTarget(null)}>
          <Pressable style={s.confirmCard} onPress={() => {}}>
            {buyTarget && (
              <>
                <Text style={s.confirmEmoji}>🏷️</Text>
                <Text style={s.confirmTitle}>{t("market.confirmPurchaseTitle")}</Text>
                <Text style={s.confirmSub}>
                  {t("market.buyingText")}{" "}
                  <Text style={{ color: "#FFF", fontWeight: "700" }}>{buyTarget.player_name}</Text>
                  {" "}{t("market.forText")}{" "}
                  <Text style={{ color: "#10B981", fontWeight: "700" }}>
                    {fmtPrice(buyTarget.sale_price ?? 0)}
                  </Text>
                </Text>
                <View style={s.confirmBudgetRow}>
                  <View style={s.confirmBudgetItem}>
                    <Text style={s.confirmBudgetLabel}>{t("market.currentBudget")}</Text>
                    <Text style={s.confirmBudgetVal}>{budget !== null ? fmtPrice(budget) : "—"}</Text>
                  </View>
                  <Text style={s.confirmArrow}>→</Text>
                  <View style={s.confirmBudgetItem}>
                    <Text style={s.confirmBudgetLabel}>{t("market.afterPurchase")}</Text>
                    <Text style={[s.confirmBudgetVal, { color: "#EF4444" }]}>
                      {budget !== null ? fmtPrice(budget - (buyTarget.sale_price ?? 0)) : "—"}
                    </Text>
                  </View>
                </View>
                {buyError ? <View style={s.errBox}><Text style={s.errText}>{buyError}</Text></View> : null}
                <View style={s.confirmActions}>
                  <TouchableOpacity
                    style={s.bidBtnCancel}
                    onPress={() => setBuyTarget(null)}
                    disabled={buyingDirect}
                  >
                    <Text style={s.bidBtnCancelText}>{t("market.cancelBtn")}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[s.bidBtnConfirm, { backgroundColor: "#10B981" }, buyingDirect && { opacity: 0.6 }]}
                    onPress={executeBuyDirect}
                    disabled={buyingDirect}
                  >
                    {buyingDirect
                      ? <ActivityIndicator size="small" color="#FFF" />
                      : <Text style={s.bidBtnConfirmText}>{t("market.confirmBuyBtn")}</Text>}
                  </TouchableOpacity>
                </View>
              </>
            )}
          </Pressable>
        </Pressable>
      </Modal>

      <TutorialOverlay
        visible={tutorial.active}
        stepIndex={tutorial.step}
        totalSteps={tutorialSteps.length}
        title={tutorialSteps[tutorial.step].title}
        description={tutorialSteps[tutorial.step].desc}
        spotlight={tutorial.spotlight}
        onNext={tutorial.next}
        onSkip={tutorial.skip}
        isLast={tutorial.isLast}
        nextLabel={t("tutorial.next")}
        finishLabel={t("tutorial.finish")}
        skipLabel={t("tutorial.skip")}
      />

    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#080808" },
  center: { flex: 1, justifyContent: "center", alignItems: "center", gap: 12 },
  loadingText: { fontSize: 13, color: "#6B7280" },

  // Header
  budgetPill: {
    backgroundColor: "#0D0D0D", borderWidth: 1, borderColor: "#242424",
    borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, alignItems: "flex-end",
  },
  budgetLabel: { fontSize: 8, color: "#6B7280", fontWeight: "700", letterSpacing: 1.2 },
  budgetValue: { fontSize: 13, fontWeight: "900", color: "#34D399" },

  // Tabs
  tabBar: {
    flexDirection: "row", marginHorizontal: 16, marginBottom: 12,
    backgroundColor: "#111", borderRadius: 12, borderWidth: 1, borderColor: "#1A1A1A",
    padding: 4, gap: 4,
  },
  tabBtn: {
    flex: 1, paddingVertical: 10, borderRadius: 9,
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6,
  },
  tabBtnActive:   { backgroundColor: "#1A1A1A" },
  tabBtnText:     { fontSize: 12, fontWeight: "700", color: "#4B5563" },
  tabBtnTextActive: { color: "#FFFFFF", fontWeight: "900" },
  tabCount: {
    backgroundColor: "#10B981", borderRadius: 8,
    paddingHorizontal: 5, paddingVertical: 1, minWidth: 18, alignItems: "center",
  },
  tabCountText: { fontSize: 9, fontWeight: "900", color: "#000" },

  // Buy — filters
  searchRow: { paddingHorizontal: 16, marginBottom: 10 },
  searchWrap: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: "#0D0D0D", borderWidth: 1, borderColor: "#1A1A1A",
    borderRadius: 10, paddingHorizontal: 12, height: 40, gap: 8,
  },
  searchIcon:  { fontSize: 13 },
  searchInput: { flex: 1, color: "#FFFFFF", fontSize: 13 },
  searchClear: { fontSize: 12, color: "#4B5563", padding: 4 },

  typeRow: {
    flexDirection: "row", gap: 8,
    paddingHorizontal: 16, marginBottom: 10,
  },
  typePill: {
    paddingHorizontal: 10, paddingVertical: 6, borderRadius: 20,
    backgroundColor: "#161616", borderWidth: 1, borderColor: "#242424",
  },
  typePillActive:   { backgroundColor: "#10B98122", borderColor: "#10B98155" },
  typePillText:     { fontSize: 10, fontWeight: "700", color: "#6B7280" },
  typePillTextActive: { color: "#34D399" },

  rolesScroll:  { marginBottom: 10 },
  rolesContent: { paddingHorizontal: 16, gap: 8 },
  rolePill: {
    paddingHorizontal: 12, paddingVertical: 5, borderRadius: 16,
    backgroundColor: "#161616", borderWidth: 1, borderColor: "#242424",
  },
  rolePillActive:   { backgroundColor: "#10B98122", borderColor: "#10B98155" },
  rolePillText:     { fontSize: 10, fontWeight: "700", color: "#6B7280" },
  rolePillTextActive: { color: "#34D399" },

  // Listing cards
  list:      { flex: 1 },
  listInner: { paddingHorizontal: 16, gap: 10 },

  listingCard: {
    backgroundColor: "#0D0D0D", borderRadius: 14,
    borderWidth: 1, borderColor: "#1A1A1A",
    flexDirection: "row", overflow: "hidden",
  },
  listingCardOwn:    { borderColor: "#F59E0B22" },
  listingCardMyBid:  { borderColor: "#10B98133", backgroundColor: "#0A1A12" },
  listingCardDirect: { borderColor: "#10B98122" },
  listingBar:  { width: 3 },
  listingBody: { flex: 1, padding: 14, gap: 10 },

  listingTop:       { flexDirection: "row", alignItems: "center", gap: 10 },
  listingAvatar: {
    width: 42, height: 42, borderRadius: 21,
    backgroundColor: "#161616", borderWidth: 1.5,
    justifyContent: "center", alignItems: "center",
  },
  listingAvatarText: { fontSize: 17, fontWeight: "800", color: "#9CA3AF" },
  listingNameRow:    { flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap", marginBottom: 3 },
  listingName:       { fontSize: 14, fontWeight: "700", color: "#FFFFFF" },
  listingMeta:       { flexDirection: "row", alignItems: "center", gap: 6 },
  listingTeam:       { fontSize: 11, color: "#6B7280" },
  listingAge:        { fontSize: 10, color: "#4B5563" },

  ownBadge: {
    backgroundColor: "#F59E0B22", borderWidth: 1, borderColor: "#F59E0B55",
    borderRadius: 4, paddingHorizontal: 5, paddingVertical: 1,
  },
  ownBadgeText: { fontSize: 8, fontWeight: "800", color: "#F59E0B" },
  winningBadge: {
    backgroundColor: "#10B98122", borderWidth: 1, borderColor: "#10B98155",
    borderRadius: 4, paddingHorizontal: 5, paddingVertical: 1,
  },
  winningBadgeText: { fontSize: 8, fontWeight: "800", color: "#10B981" },
  typeBadge: { borderRadius: 4, paddingHorizontal: 5, paddingVertical: 1, borderWidth: 1 },
  typeBadgeText: { fontSize: 8, fontWeight: "800" },

  rtgBadge: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 5, justifyContent: "center" },
  rtgText:  { fontSize: 16, fontWeight: "900" },

  priceRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  priceLabel: { fontSize: 9, fontWeight: "700", color: "#4B5563", letterSpacing: 1, marginBottom: 2 },
  priceValue: { fontSize: 18, fontWeight: "900", color: "#FFFFFF" },
  cdText:     { fontSize: 10, color: "#6B7280", marginTop: 2 },
  ownNote:    { fontSize: 10, color: "#4B5563", fontStyle: "italic" },

  buyBtn: {
    backgroundColor: "#10B981", borderRadius: 10,
    paddingHorizontal: 16, paddingVertical: 10,
  },
  buyBtnDisabled: { backgroundColor: "#1A1A1A" },
  buyBtnText:     { fontSize: 11, fontWeight: "900", color: "#000", letterSpacing: 1 },
  bidBtn: {
    backgroundColor: "#6366F122", borderWidth: 1, borderColor: "#6366F155",
    borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10,
  },
  bidBtnText: { fontSize: 11, fontWeight: "900", color: "#6366F1", letterSpacing: 0.5 },

  // Role tag
  roleTag:     { borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 },
  roleTagText: { fontSize: 9, fontWeight: "800", letterSpacing: 0.5 },

  // My listings summary
  myListingsSection: {
    backgroundColor: "#0D0D0D", borderRadius: 12,
    borderWidth: 1, borderColor: "#F59E0B22",
    padding: 14, marginTop: 4, gap: 8,
  },
  myListingsTitle: { fontSize: 9, fontWeight: "800", color: "#F59E0B", letterSpacing: 2, marginBottom: 4 },
  myListingRow:    { flexDirection: "row", alignItems: "center", gap: 8 },
  myListingDot:    { width: 6, height: 6, borderRadius: 3 },
  myListingName:   { flex: 1, fontSize: 12, fontWeight: "700", color: "#FFFFFF" },
  myListingType:   { fontSize: 11, color: "#6B7280" },

  // Empty
  emptyCard: {
    backgroundColor: "#0D0D0D", borderRadius: 14,
    borderWidth: 1, borderColor: "#1A1A1A",
    padding: 32, alignItems: "center", gap: 8,
  },
  emptyEmoji: { fontSize: 36, marginBottom: 4 },
  emptyTitle: { fontSize: 14, fontWeight: "700", color: "#6B7280" },
  emptySub:   { fontSize: 12, color: "#374151", textAlign: "center" },

  // Sell tab
  sellSection: { paddingHorizontal: 16, paddingTop: 4 },
  sellSectionTitle: { fontSize: 10, fontWeight: "900", color: "#6B7280", letterSpacing: 3, marginBottom: 4 },
  sellSectionSub:   { fontSize: 12, color: "#374151", marginBottom: 16 },
  sellBack:    { marginBottom: 14 },
  sellBackText: { fontSize: 13, color: "#10B981", fontWeight: "600" },

  // Roster cards
  rosterCard: {
    flexDirection: "row", alignItems: "center", gap: 12,
    backgroundColor: "#0D0D0D", borderRadius: 12,
    borderWidth: 1, borderColor: "#1A1A1A",
    padding: 14, marginBottom: 8, position: "relative", overflow: "hidden",
  },
  rosterCardListed: { opacity: 0.6 },
  rosterAvatar: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: "#161616", borderWidth: 1.5,
    justifyContent: "center", alignItems: "center",
  },
  rosterAvatarText: { fontSize: 16, fontWeight: "800" },
  rosterName:       { fontSize: 14, fontWeight: "700", color: "#FFFFFF", marginBottom: 4 },
  rosterMeta:       { flexDirection: "row", alignItems: "center", gap: 6 },
  rosterAge:        { fontSize: 10, color: "#6B7280" },
  rosterSalary:     { fontSize: 10, color: "#4B5563" },
  rosterRtg: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 5, justifyContent: "center", minWidth: 36, alignItems: "center" },
  rosterRtgText: { fontSize: 15, fontWeight: "900" },
  listedOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "flex-end", alignItems: "flex-end",
    padding: 10,
  },
  listedOverlayText: {
    fontSize: 8, fontWeight: "800", color: "#F59E0B",
    letterSpacing: 1, backgroundColor: "#F59E0B22",
    paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4,
  },

  // Sell configure
  sellPlayerCard: {
    flexDirection: "row", alignItems: "center", gap: 12,
    backgroundColor: "#111", borderRadius: 12, borderWidth: 1,
    padding: 14, marginBottom: 20,
  },
  configLabel: {
    fontSize: 9, fontWeight: "800", color: "#6B7280",
    letterSpacing: 2, marginBottom: 10, marginTop: 4,
  },
  typeSelector: { flexDirection: "row", gap: 10, marginBottom: 20 },
  typeSelectorBtn: {
    flex: 1, backgroundColor: "#0D0D0D", borderRadius: 12,
    borderWidth: 1, borderColor: "#1A1A1A",
    padding: 14, alignItems: "center", gap: 4,
  },
  typeSelectorBtnActive:       { backgroundColor: "#6366F10E", borderColor: "#6366F1" },
  typeSelectorBtnActiveDirect: { backgroundColor: "#10B9810E", borderColor: "#10B981" },
  typeSelectorIcon:  { fontSize: 22, marginBottom: 2 },
  typeSelectorLabel: { fontSize: 12, fontWeight: "800", color: "#6B7280" },
  typeSelectorLabelActive:       { color: "#6366F1" },
  typeSelectorLabelActiveDirect: { color: "#10B981" },
  typeSelectorDesc:  { fontSize: 9, color: "#374151", textAlign: "center" },

  priceInputWrap: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: "#111", borderWidth: 1, borderColor: "#242424",
    borderRadius: 10, paddingHorizontal: 14, height: 52, gap: 6, marginBottom: 16,
  },
  priceInputDollar: { fontSize: 18, color: "#6B7280", fontWeight: "700" },
  priceInput:       { flex: 1, fontSize: 22, fontWeight: "900", color: "#FFFFFF" },
  priceInputFmt:    { fontSize: 12, color: "#4B5563", fontWeight: "600" },

  durationRow: { flexDirection: "row", gap: 8, marginBottom: 16 },
  durationBtn: {
    flex: 1, paddingVertical: 10, borderRadius: 10,
    backgroundColor: "#111", borderWidth: 1, borderColor: "#1A1A1A",
    alignItems: "center",
  },
  durationBtnActive:     { backgroundColor: "#6366F122", borderColor: "#6366F1" },
  durationBtnText:       { fontSize: 13, fontWeight: "700", color: "#6B7280" },
  durationBtnTextActive: { color: "#6366F1" },

  infoNote: {
    borderRadius: 8, borderWidth: 1, padding: 12, marginBottom: 16,
    backgroundColor: "#080808",
  },
  infoNoteText: { fontSize: 12, lineHeight: 18 },
  errorBox: {
    backgroundColor: "rgba(239,68,68,0.08)", borderWidth: 1, borderColor: "rgba(239,68,68,0.25)",
    borderRadius: 8, padding: 10, marginBottom: 12,
  },
  errorText: { fontSize: 12, color: "#EF4444", fontWeight: "600" },

  sellActions: { flexDirection: "row", gap: 10, marginTop: 4 },
  sellBtnCancel: {
    flex: 1, paddingVertical: 14, borderRadius: 10,
    backgroundColor: "#161616", borderWidth: 1, borderColor: "#242424", alignItems: "center",
  },
  sellBtnCancelText:  { fontSize: 13, fontWeight: "700", color: "#6B7280", letterSpacing: 1 },
  sellBtnConfirm:     { flex: 2, paddingVertical: 14, borderRadius: 10, alignItems: "center" },
  sellBtnConfirmText: { fontSize: 13, fontWeight: "900", color: "#FFF", letterSpacing: 0.5 },

  successCard: {
    margin: 20, backgroundColor: "#0D0D0D",
    borderRadius: 16, borderWidth: 1, borderColor: "#10B98133",
    padding: 28, alignItems: "center", gap: 8,
  },
  successEmoji: { fontSize: 44, marginBottom: 4 },
  successTitle: { fontSize: 15, fontWeight: "900", color: "#10B981", letterSpacing: 2 },
  successSub:   { fontSize: 12, color: "#6B7280", textAlign: "center" },

  // Bottom sheet
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.8)", justifyContent: "flex-end" },
  sheet: {
    backgroundColor: "#0D0D0D",
    borderTopLeftRadius: 20, borderTopRightRadius: 20,
    borderWidth: 1, borderColor: "#1A1A1A",
    paddingHorizontal: 20, paddingTop: 12,
    maxHeight: "92%",
  },
  sheetHandle: {
    width: 36, height: 4, borderRadius: 2,
    backgroundColor: "#2A2A2A", alignSelf: "center", marginBottom: 16,
  },

  // Detail modal content
  detailHeader: { flexDirection: "row", gap: 12, marginBottom: 16 },
  detailAvatar: {
    width: 52, height: 52, borderRadius: 26,
    backgroundColor: "#161616", borderWidth: 2,
    justifyContent: "center", alignItems: "center",
  },
  detailAvatarText: { fontSize: 20, fontWeight: "800", color: "#9CA3AF" },
  detailName:       { fontSize: 17, fontWeight: "900", color: "#FFFFFF", marginBottom: 4 },
  detailMeta:       { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 2 },
  detailAge:        { fontSize: 11, color: "#6B7280" },
  detailTeam:       { fontSize: 10, color: "#4B5563" },

  statsRow:  { flexDirection: "row", gap: 6, marginBottom: 14 },
  statCard:  {
    flex: 1, backgroundColor: "#111", borderRadius: 10,
    borderWidth: 1, borderColor: "#1A1A1A", padding: 10, alignItems: "center",
  },
  statValue: { fontSize: 15, fontWeight: "900" },
  statLabel: { fontSize: 9, color: "#6B7280", marginTop: 2 },

  skillsWrap:  { marginBottom: 14 },
  skillsTitle: { fontSize: 9, fontWeight: "800", color: "#4B5563", letterSpacing: 2, marginBottom: 8 },
  skillRow:    { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 6 },
  skillName:   { fontSize: 10, color: "#6B7280", width: 80 },
  skillBarBg:  { flex: 1, height: 5, backgroundColor: "#1A1A1A", borderRadius: 3, overflow: "hidden" },
  skillBarFill:{ height: 5, borderRadius: 3 },
  skillValue:  { fontSize: 10, fontWeight: "700", color: "#9CA3AF", width: 22, textAlign: "right" },

  auctionInfoRow: {
    flexDirection: "row", marginBottom: 16,
    backgroundColor: "#111", borderWidth: 1, borderColor: "#1A1A1A",
    borderRadius: 12, overflow: "hidden",
  },
  auctionInfoItem:    { flex: 1, padding: 12, alignItems: "center" },
  auctionInfoDivider: { width: 1, backgroundColor: "#1A1A1A" },
  auctionInfoLabel:   { fontSize: 9, color: "#6B7280", marginBottom: 4 },
  auctionInfoValue:   { fontSize: 14, fontWeight: "900", color: "#FFFFFF" },
  auctionBidder:      { fontSize: 9, color: "#10B981", marginTop: 2 },

  bidTitle: { fontSize: 12, fontWeight: "900", color: "#FFFFFF", letterSpacing: 2, marginBottom: 4 },
  bidSub:   { fontSize: 12, color: "#6B7280", marginBottom: 12 },
  bidInputWrap: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: "#111", borderWidth: 1, borderColor: "#242424",
    borderRadius: 10, paddingHorizontal: 14, height: 52, gap: 6, marginBottom: 10,
  },
  bidInputDollar: { fontSize: 18, color: "#6B7280", fontWeight: "700" },
  bidInput:       { flex: 1, fontSize: 22, fontWeight: "900", color: "#FFFFFF" },
  quickBids:      { flexDirection: "row", gap: 6, marginBottom: 10 },
  quickBidBtn: {
    flex: 1, backgroundColor: "#111", borderWidth: 1, borderColor: "#1A1A1A",
    borderRadius: 8, paddingVertical: 8, alignItems: "center",
  },
  quickBidMult: { fontSize: 10, color: "#9CA3AF", fontWeight: "700" },
  quickBidVal:  { fontSize: 9, color: "#6B7280", marginTop: 2 },
  errBox: {
    backgroundColor: "rgba(239,68,68,0.08)", borderWidth: 1, borderColor: "rgba(239,68,68,0.25)",
    borderRadius: 8, padding: 10, marginBottom: 10,
  },
  errText: { fontSize: 12, color: "#EF4444", fontWeight: "600" },

  bidActions:       { flexDirection: "row", gap: 10 },
  bidBtnCancel: {
    flex: 1, paddingVertical: 13, borderRadius: 10,
    backgroundColor: "#161616", borderWidth: 1, borderColor: "#242424", alignItems: "center",
  },
  bidBtnCancelText:  { fontSize: 12, fontWeight: "700", color: "#6B7280", letterSpacing: 1 },
  bidBtnConfirm:     { flex: 2, paddingVertical: 13, borderRadius: 10, backgroundColor: "#6366F1", alignItems: "center" },
  bidBtnConfirmText: { fontSize: 12, fontWeight: "900", color: "#FFF", letterSpacing: 1 },

  bidSuccessWrap:  { paddingVertical: 24, alignItems: "center", gap: 8 },
  bidSuccessEmoji: { fontSize: 36, marginBottom: 4 },
  bidSuccessTitle: { fontSize: 14, fontWeight: "900", color: "#10B981", letterSpacing: 2 },
  bidSuccessSub:   { fontSize: 12, color: "#6B7280", textAlign: "center" },

  // Confirm buy direct modal
  confirmOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.85)", justifyContent: "center", alignItems: "center" },
  confirmCard: {
    width: width - 48, backgroundColor: "#0D0D0D",
    borderRadius: 20, borderWidth: 1, borderColor: "#10B98144",
    padding: 28, alignItems: "center", gap: 10,
  },
  confirmEmoji: { fontSize: 36, marginBottom: 4 },
  confirmTitle: { fontSize: 14, fontWeight: "900", color: "#FFFFFF", letterSpacing: 2 },
  confirmSub:   { fontSize: 13, color: "#9CA3AF", textAlign: "center", lineHeight: 20 },
  confirmBudgetRow: {
    flexDirection: "row", alignItems: "center", gap: 12,
    backgroundColor: "#111", borderRadius: 12, borderWidth: 1, borderColor: "#1A1A1A",
    padding: 14, width: "100%",
  },
  confirmBudgetItem:  { flex: 1, alignItems: "center", gap: 4 },
  confirmBudgetLabel: { fontSize: 9, color: "#4B5563", fontWeight: "600", letterSpacing: 0.5 },
  confirmBudgetVal:   { fontSize: 16, fontWeight: "900", color: "#FFFFFF" },
  confirmArrow:       { fontSize: 18, color: "#374151" },
  confirmActions:     { flexDirection: "row", gap: 10, width: "100%", marginTop: 4 },
});
