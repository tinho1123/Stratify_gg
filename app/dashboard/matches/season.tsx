import { useAppAlert } from "@/components/ui/AppAlert";
import { ScreenHeader } from "@/components/ui/ScreenHeader";
import { getTierInfo } from "@/constants/tiers";
import { supabase } from "@/database/supabase";
import { useFeatureFlags } from "@/hooks/useFeatureFlags";
import { useLanguage } from "@/i18n/LanguageContext";
import { getSeasonPassPackage, isRevenueCatConfigured, purchasePackage } from "@/services/revenuecat";
import { router } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import type { PurchasesPackage } from "react-native-purchases";
import { SafeAreaView } from "react-native-safe-area-context";

// ── Types ─────────────────────────────────────────────────────────────────────

interface SeasonInfo {
  id: string;
  tier: string;
  season_number: number;
  starts_at: string;
  ends_at: string;
  status: "active" | "ended";
}

interface StandingRow {
  team_id: string;
  team_name: string;
  points: number;
  wins: number;
  losses: number;
  matches_played: number;
}

type PassRewardType = "credits" | "fans" | "budget" | "cosmetic";

interface PassReward {
  type: PassRewardType;
  amount?: number;
  cosmetic_id?: string;
}

interface PassTier {
  tier_number: number;
  points_required: number;
  free_reward: PassReward;
  premium_reward: PassReward;
}

interface CosmeticInfo {
  name: string;
  color: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function sleep(ms: number) {
  return new Promise<void>((r) => setTimeout(r, ms));
}

function rewardDisplay(
  reward: PassReward,
  cosmetics: Map<string, CosmeticInfo>,
): { icon: string; label: string; color?: string } {
  switch (reward.type) {
    case "credits":  return { icon: "💎", label: `${reward.amount}` };
    case "fans":     return { icon: "👥", label: `+${reward.amount}` };
    case "budget":   return { icon: "$",  label: `${(reward.amount ?? 0).toLocaleString()}` };
    case "cosmetic": {
      const c = reward.cosmetic_id ? cosmetics.get(reward.cosmetic_id) : undefined;
      return { icon: "✨", label: c?.name ?? "—", color: c?.color };
    }
  }
}

function formatTimeLeft(target: string, t: (key: string) => string): string {
  const diff = new Date(target).getTime() - Date.now();
  if (diff <= 0) return t("season.ended");
  const days  = Math.floor(diff / 86_400_000);
  const hours = Math.floor((diff % 86_400_000) / 3_600_000);
  if (days > 0) {
    return t("season.daysHoursLeft").replace("{d}", String(days)).replace("{h}", String(hours));
  }
  const mins = Math.floor((diff % 3_600_000) / 60_000);
  return t("season.hoursMinsLeft").replace("{h}", String(hours)).replace("{m}", String(mins));
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function SeasonScreen() {
  const { t } = useLanguage();
  const { isEnabled, loaded } = useFeatureFlags();

  useEffect(() => {
    if (loaded && !isEnabled("matches_season")) router.replace("/dashboard/matches");
  }, [loaded]);
  const { alert } = useAppAlert();
  const [loading, setLoading]     = useState(true);
  const [joining, setJoining]     = useState(false);
  const [season, setSeason]       = useState<SeasonInfo | null>(null);
  const [standings, setStandings] = useState<StandingRow[]>([]);
  const [myTeamId, setMyTeamId]   = useState<string | null>(null);
  const [tierColor, setTierColor] = useState("#6B7280");
  const [myNameColor, setMyNameColor] = useState<string | null>(null);

  const [passActive, setPassActive]   = useState(false);
  const [myPoints, setMyPoints]       = useState(0);
  const [passTiers, setPassTiers]     = useState<PassTier[]>([]);
  const [claimedKeys, setClaimedKeys] = useState<Set<string>>(new Set());
  const [cosmeticMap, setCosmeticMap] = useState<Map<string, CosmeticInfo>>(new Map());
  const [claimingKey, setClaimingKey] = useState<string | null>(null);
  const [passPkg, setPassPkg]         = useState<PurchasesPackage | null>(null);
  const [subscribing, setSubscribing] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);

    // Paga bônus de temporadas já encerradas antes de mostrar a classificação atual, e desativa
    // o Season Pass se o período pago já venceu (lazy-cron, mesmo padrão de check_expired_contracts).
    await Promise.all([
      supabase.rpc("claim_season_rewards"),
      supabase.rpc("check_season_pass_expiry"),
    ]);

    const { data: team } = await supabase
      .from("teams")
      .select("id, pdl, equipped_cosmetics, season_pass_active")
      .single();
    if (!team) { setLoading(false); return; }
    setMyTeamId(team.id);
    setPassActive(!!(team as any).season_pass_active);

    const info = getTierInfo((team as any).pdl ?? 0);
    setTierColor(info.color);

    // Cosmético "cor do nome" (loja de créditos premium) — puramente visual, só na própria linha.
    const nameColorCosmeticId = (team as any).equipped_cosmetics?.name_color;
    if (nameColorCosmeticId) {
      const { data: cosmetic } = await supabase
        .from("cosmetics")
        .select("preview")
        .eq("id", nameColorCosmeticId)
        .single();
      setMyNameColor((cosmetic as any)?.preview?.color ?? null);
    } else {
      setMyNameColor(null);
    }

    const { data: seasonData, error: seasonErr } = await supabase.rpc("get_or_create_season", {
      p_tier: info.tier,
    });
    if (seasonErr || !seasonData) { setLoading(false); return; }
    setSeason(seasonData as SeasonInfo);

    const { data: standingsData } = await supabase
      .from("season_standings")
      .select("team_id, team_name, points, wins, losses, matches_played")
      .eq("season_id", (seasonData as SeasonInfo).id)
      .order("points", { ascending: false })
      .order("wins", { ascending: false });

    setStandings((standingsData ?? []) as StandingRow[]);
    setMyPoints((standingsData ?? []).find((r: any) => r.team_id === team.id)?.points ?? 0);

    // ── Season Pass: tiers, cosméticos exclusivos e o que já foi resgatado nesta temporada ──
    const [{ data: tiersData }, { data: exclusiveCosmetics }, { data: claimsData }] = await Promise.all([
      supabase
        .from("season_pass_tiers")
        .select("tier_number, points_required, free_reward, premium_reward")
        .order("tier_number", { ascending: true }),
      supabase.from("cosmetics").select("id, name, preview").eq("source", "season_pass"),
      supabase
        .from("season_pass_claims")
        .select("tier_number, track")
        .eq("team_id", team.id)
        .eq("season_id", (seasonData as SeasonInfo).id),
    ]);

    if (tiersData) setPassTiers(tiersData as PassTier[]);
    setCosmeticMap(new Map(
      (exclusiveCosmetics ?? []).map((c: any) => [c.id, { name: c.name, color: c.preview?.color ?? "#6B7280" }]),
    ));
    setClaimedKeys(new Set((claimsData ?? []).map((c: any) => `${c.tier_number}:${c.track}`)));

    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  useEffect(() => {
    if (!isRevenueCatConfigured()) return;
    getSeasonPassPackage().then(setPassPkg).catch(() => {});
  }, []);

  const hasJoined = !!myTeamId && standings.some((row) => row.team_id === myTeamId);

  const joinLeague = async () => {
    if (!season) return;
    setJoining(true);
    const { error } = await supabase.rpc("join_season", { p_season_id: season.id });
    setJoining(false);
    if (error) {
      alert(t("common.error"), t("season.errJoin"));
      return;
    }
    fetchData();
  };

  const claimReward = async (tierNumber: number, track: "free" | "premium") => {
    const key = `${tierNumber}:${track}`;
    setClaimingKey(key);
    const { error } = await supabase.rpc("claim_season_pass_reward", {
      p_tier_number: tierNumber,
      p_track: track,
    });
    setClaimingKey(null);
    if (error) {
      const msg = error.message?.includes("season_pass_required")
        ? t("season.errPassRequired")
        : error.message?.includes("tier_locked")
        ? t("season.errTierLocked")
        : error.message?.includes("already_claimed")
        ? t("season.errAlreadyClaimed")
        : t("season.errClaimGeneric");
      alert(t("common.error"), msg);
      return;
    }
    fetchData();
  };

  const subscribePass = async () => {
    if (!passPkg || !myTeamId) return;
    setSubscribing(true);
    try {
      await purchasePackage(passPkg);

      // A ativação em si acontece no servidor (webhook do RevenueCat), de forma assíncrona —
      // reconsulta o time algumas vezes antes de desistir.
      let updated = false;
      for (let i = 0; i < 4 && !updated; i++) {
        await sleep(2000);
        const { data } = await supabase.from("teams").select("season_pass_active").eq("id", myTeamId).single();
        if (data && (data as any).season_pass_active) {
          setPassActive(true);
          updated = true;
        }
      }

      alert(
        t("season.passSubscribeSuccessTitle"),
        updated ? t("season.passSubscribeSuccessMsg") : t("season.passSubscribePendingMsg"),
        "success",
      );
    } catch (err: any) {
      if (err?.userCancelled) return;
      alert(t("common.error"), t("season.errPurchase"));
    } finally {
      setSubscribing(false);
    }
  };

  return (
    <SafeAreaView style={s.safe} edges={["top"]}>

      <ScreenHeader title={t("season.headerTitle")} dotColor={tierColor} centered />

      {loading ? (
        <View style={s.center}>
          <ActivityIndicator size="large" color="#EC4899" />
          <Text style={s.loadingText}>{t("common.loading")}</Text>
        </View>
      ) : !season ? (
        <View style={s.center}>
          <Text style={s.loadingText}>{t("season.notFound")}</Text>
        </View>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 48 }}>

          {/* ══ TEMPORADA ════════════════════════════════ */}
          <View style={s.section}>
            <View style={[s.seasonCard, { borderColor: tierColor + "44" }]}>
              <Text style={[s.seasonTier, { color: tierColor }]}>{season.tier}</Text>
              <Text style={s.seasonNumber}>{t("season.seasonLabel")} {season.season_number}</Text>
              <Text style={s.seasonCountdown}>{formatTimeLeft(season.ends_at, t)}</Text>
            </View>
          </View>

          {/* ══ INSCRIÇÃO ════════════════════════════════ */}
          {!hasJoined && (
            <View style={s.section}>
              <View style={s.joinCard}>
                <Text style={s.joinEmoji}>🏆</Text>
                <Text style={s.joinText}>{t("season.notJoinedTitle")}</Text>
                <Text style={s.joinSub}>
                  {t("season.notJoinedSub").replace("{tier}", season.tier)}
                </Text>
                <TouchableOpacity style={s.joinBtn} onPress={joinLeague} disabled={joining}>
                  {joining
                    ? <ActivityIndicator size="small" color="#EC4899" />
                    : <Text style={s.joinBtnText}>{t("season.joinBtn")}</Text>}
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* ══ SEASON PASS ═══════════════════════════════ */}
          <View style={s.section}>
            <View style={s.passHeader}>
              <Text style={s.sectionTitle}>{t("season.passTitle")}</Text>
              <Text style={s.passPoints}>{myPoints} {t("season.pointsLabel")}</Text>
            </View>

            {!passActive && (
              <View style={s.passCta}>
                <Text style={s.passCtaText}>{t("season.passCtaText")}</Text>
                {passPkg ? (
                  <>
                    <TouchableOpacity style={s.passCtaBtn} onPress={subscribePass} disabled={subscribing}>
                      {subscribing
                        ? <ActivityIndicator size="small" color="#F59E0B" />
                        : <Text style={s.passCtaBtnText}>{t("season.passSubscribeBtn")} · {passPkg.product.priceString}</Text>}
                    </TouchableOpacity>
                    <Text style={s.passDisclosure}>
                      {t("season.passDisclosure").replace("{price}", passPkg.product.priceString)}
                    </Text>
                  </>
                ) : (
                  <Text style={s.passComingSoon}>{t("season.passComingSoon")}</Text>
                )}
              </View>
            )}

            {passTiers.map((tier) => {
              const unlocked = myPoints >= tier.points_required;
              return (
                <View key={tier.tier_number} style={[s.tierRow, !unlocked && s.tierRowLocked]}>
                  <View style={s.tierBadge}>
                    <Text style={s.tierBadgeText}>{tier.tier_number}</Text>
                  </View>
                  <View style={s.tierInfo}>
                    <Text style={s.tierPoints}>{tier.points_required} {t("season.pointsLabel")}</Text>
                  </View>
                  <PassRewardChip
                    reward={tier.free_reward}
                    cosmetics={cosmeticMap}
                    unlocked={unlocked}
                    claimed={claimedKeys.has(`${tier.tier_number}:free`)}
                    busy={claimingKey === `${tier.tier_number}:free`}
                    locked={false}
                    onClaim={() => claimReward(tier.tier_number, "free")}
                    claimLabel={t("season.claimBtn")}
                    claimedLabel={t("season.claimedLabel")}
                  />
                  <PassRewardChip
                    reward={tier.premium_reward}
                    cosmetics={cosmeticMap}
                    unlocked={unlocked}
                    claimed={claimedKeys.has(`${tier.tier_number}:premium`)}
                    busy={claimingKey === `${tier.tier_number}:premium`}
                    locked={!passActive}
                    onClaim={() => claimReward(tier.tier_number, "premium")}
                    claimLabel={t("season.claimBtn")}
                    claimedLabel={t("season.claimedLabel")}
                    premium
                  />
                </View>
              );
            })}
          </View>

          {/* ══ CLASSIFICAÇÃO ════════════════════════════ */}
          <View style={s.section}>
            <Text style={s.sectionTitle}>{t("season.standingsTitle")}</Text>

            {standings.length === 0 ? (
              <View style={s.emptyCard}>
                <Text style={s.emptyEmoji}>📋</Text>
                <Text style={s.emptyText}>{t("season.emptyStandings")}</Text>
              </View>
            ) : (
              standings.map((row, i) => {
                const isMe = row.team_id === myTeamId;
                return (
                  <View key={row.team_id} style={[s.rowCard, isMe && s.rowCardMe]}>
                    <Text style={[s.rank, isMe && { color: tierColor }]}>{i + 1}</Text>
                    <View style={s.rowInfo}>
                      <Text
                        style={[s.teamName, isMe && { color: myNameColor ?? "#FFFFFF" }]}
                        numberOfLines={1}
                      >
                        {row.team_name}{isMe ? t("season.youSuffix") : ""}
                      </Text>
                      <Text style={s.rowSub}>
                        {row.matches_played} {t("season.matchesLabel")} · {row.wins}V {row.losses}D
                      </Text>
                    </View>
                    <Text style={[s.points, isMe && { color: tierColor }]}>{row.points} {t("season.pointsLabel")}</Text>
                  </View>
                );
              })
            )}
          </View>

        </ScrollView>
      )}
    </SafeAreaView>
  );
}

// ── Season Pass reward chip ──────────────────────────────────────────────────

function PassRewardChip({
  reward, cosmetics, unlocked, claimed, busy, locked, onClaim, claimLabel, claimedLabel, premium,
}: {
  reward: PassReward;
  cosmetics: Map<string, CosmeticInfo>;
  unlocked: boolean;
  claimed: boolean;
  busy: boolean;
  locked: boolean;
  onClaim: () => void;
  claimLabel: string;
  claimedLabel: string;
  premium?: boolean;
}) {
  const { icon, label, color } = rewardDisplay(reward, cosmetics);
  const canClaim = unlocked && !claimed && !locked;

  return (
    <TouchableOpacity
      style={[
        s.rewardChip,
        premium && s.rewardChipPremium,
        !unlocked && s.rewardChipDim,
        claimed && s.rewardChipClaimed,
      ]}
      disabled={!canClaim || busy}
      onPress={onClaim}
    >
      {busy ? (
        <ActivityIndicator size="small" color="#9CA3AF" />
      ) : (
        <>
          <Text style={[s.rewardChipIcon, color ? { color } : null]}>{icon}</Text>
          <Text style={s.rewardChipLabel} numberOfLines={1}>{label}</Text>
          {claimed ? (
            <Text style={s.rewardChipState}>{claimedLabel}</Text>
          ) : locked && unlocked ? (
            <Text style={s.rewardChipLock}>🔒</Text>
          ) : canClaim ? (
            <Text style={s.rewardChipClaim}>{claimLabel}</Text>
          ) : null}
        </>
      )}
    </TouchableOpacity>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  safe:        { flex: 1, backgroundColor: "#080808" },
  center:      { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
  loadingText: { fontSize: 13, color: "#6B7280" },

  section:     { paddingHorizontal: 16, marginBottom: 20 },
  sectionTitle: {
    fontSize: 10, fontWeight: "900", color: "#6B7280",
    letterSpacing: 3, marginBottom: 12,
  },

  passHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  passPoints: { fontSize: 11, fontWeight: "900", color: "#F59E0B", marginBottom: 12 },

  passCta: {
    backgroundColor: "#161000", borderRadius: 14, borderWidth: 1, borderColor: "#F59E0B33",
    padding: 16, alignItems: "center", gap: 10, marginBottom: 12,
  },
  passCtaText: { fontSize: 12, color: "#9CA3AF", textAlign: "center" },
  passCtaBtn: {
    paddingHorizontal: 20, paddingVertical: 12, borderRadius: 10,
    backgroundColor: "#F59E0B22", borderWidth: 1, borderColor: "#F59E0B66",
    minWidth: 220, alignItems: "center", height: 44, justifyContent: "center",
  },
  passCtaBtnText: { fontSize: 12, fontWeight: "800", color: "#F59E0B", letterSpacing: 0.5 },
  passComingSoon: { fontSize: 11, color: "#4B5563" },
  passDisclosure: { fontSize: 10, color: "#6B7280", textAlign: "center", lineHeight: 14, paddingHorizontal: 8 },

  tierRow: {
    flexDirection: "row", alignItems: "center", gap: 8,
    backgroundColor: "#0D0D0D", borderRadius: 12, borderWidth: 1, borderColor: "#1A1A1A",
    padding: 8, marginBottom: 8,
  },
  tierRowLocked: { opacity: 0.55 },
  tierBadge: {
    width: 28, height: 28, borderRadius: 8, backgroundColor: "#161616",
    borderWidth: 1, borderColor: "#242424", justifyContent: "center", alignItems: "center",
  },
  tierBadgeText: { fontSize: 12, fontWeight: "900", color: "#9CA3AF" },
  tierInfo:   { width: 48 },
  tierPoints: { fontSize: 9, fontWeight: "700", color: "#4B5563" },

  rewardChip: {
    flex: 1, flexDirection: "row", alignItems: "center", gap: 6,
    backgroundColor: "#111", borderRadius: 8, borderWidth: 1, borderColor: "#1A1A1A",
    paddingHorizontal: 8, paddingVertical: 8, minHeight: 36,
  },
  rewardChipPremium: { borderColor: "#F59E0B33" },
  rewardChipDim:     { opacity: 0.4 },
  rewardChipClaimed: { borderColor: "#10B98155", backgroundColor: "#10B98111" },
  rewardChipIcon:  { fontSize: 13 },
  rewardChipLabel: { flex: 1, fontSize: 11, fontWeight: "700", color: "#D1D5DB" },
  rewardChipState: { fontSize: 8, fontWeight: "900", color: "#10B981" },
  rewardChipLock:  { fontSize: 11 },
  rewardChipClaim: { fontSize: 8, fontWeight: "900", color: "#EC4899", letterSpacing: 0.5 },

  seasonCard: {
    backgroundColor: "#0D0D0D", borderRadius: 16, borderWidth: 1,
    padding: 20, alignItems: "center", gap: 4,
  },
  seasonTier:      { fontSize: 20, fontWeight: "900", letterSpacing: 0.5 },
  seasonNumber:    { fontSize: 12, color: "#9CA3AF", fontWeight: "700" },
  seasonCountdown: { fontSize: 11, color: "#4B5563", marginTop: 4 },

  joinCard: {
    backgroundColor: "#0D0D0D", borderRadius: 16, borderWidth: 1, borderColor: "#1A1A1A",
    padding: 24, alignItems: "center", gap: 8,
  },
  joinEmoji: { fontSize: 32, marginBottom: 4 },
  joinText:  { fontSize: 14, fontWeight: "700", color: "#FFFFFF", textAlign: "center" },
  joinSub:   { fontSize: 12, color: "#6B7280", textAlign: "center", marginBottom: 8 },
  joinBtn: {
    paddingHorizontal: 24, paddingVertical: 12, borderRadius: 10,
    backgroundColor: "#EC489922", borderWidth: 1, borderColor: "#EC489966",
    minWidth: 200, alignItems: "center", height: 44, justifyContent: "center",
  },
  joinBtnText: { fontSize: 12, fontWeight: "800", color: "#EC4899", letterSpacing: 1 },

  emptyCard: {
    backgroundColor: "#0D0D0D", borderRadius: 14, borderWidth: 1, borderColor: "#1A1A1A",
    padding: 28, alignItems: "center", gap: 8,
  },
  emptyEmoji: { fontSize: 32, marginBottom: 4 },
  emptyText:  { fontSize: 13, fontWeight: "700", color: "#6B7280" },

  rowCard: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: "#0D0D0D", borderRadius: 12, borderWidth: 1, borderColor: "#1A1A1A",
    marginBottom: 8, padding: 12, gap: 12,
  },
  rowCardMe: { borderColor: "#EC489944", backgroundColor: "#1A0D14" },
  rank:      { width: 24, fontSize: 14, fontWeight: "900", color: "#4B5563", textAlign: "center" },
  rowInfo:   { flex: 1 },
  teamName:  { fontSize: 14, fontWeight: "700", color: "#9CA3AF" },
  rowSub:    { fontSize: 10, color: "#4B5563", marginTop: 2 },
  points:    { fontSize: 14, fontWeight: "900", color: "#FFFFFF" },
});
