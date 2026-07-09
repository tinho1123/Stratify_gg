import { useAppAlert } from "@/components/ui/AppAlert";
import { ScreenHeader } from "@/components/ui/ScreenHeader";
import { supabase } from "@/database/supabase";
import { useLanguage } from "@/i18n/LanguageContext";
import { getCreditPackages, isRevenueCatConfigured, purchasePackage, restorePurchases } from "@/services/revenuecat";
import { useFocusEffect } from "@react-navigation/native";
import { router } from "expo-router";
import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { PurchasesPackage } from "react-native-purchases";

// ── Types ─────────────────────────────────────────────────────────────────────

type CosmeticCategory = "name_color" | "player_frame";

interface Cosmetic {
  id: string;
  key: string;
  category: CosmeticCategory;
  name: string;
  description: string | null;
  price_credits: number;
  preview: { color?: string };
}

interface TeamWallet {
  id: string;
  premium_credits: number;
  equipped_cosmetics: Record<string, string>;
}

const CATEGORY_ORDER: CosmeticCategory[] = ["name_color", "player_frame"];

function sleep(ms: number) {
  return new Promise<void>((r) => setTimeout(r, ms));
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function StoreScreen() {
  const { t } = useLanguage();
  const { alert } = useAppAlert();

  const [loading, setLoading] = useState(true);
  const [wallet, setWallet] = useState<TeamWallet | null>(null);
  const [cosmetics, setCosmetics] = useState<Cosmetic[]>([]);
  const [ownedIds, setOwnedIds] = useState<Set<string>>(new Set());
  const [busyCosmeticId, setBusyCosmeticId] = useState<string | null>(null);

  const [ccPackages, setCcPackages] = useState<PurchasesPackage[]>([]);
  const [buyingPackageId, setBuyingPackageId] = useState<string | null>(null);
  const [restoring, setRestoring] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const { data: teamData } = await supabase
      .from("teams")
      .select("id, premium_credits, equipped_cosmetics")
      .single();
    if (!teamData) { setLoading(false); return; }
    const team = teamData as any as TeamWallet;
    setWallet(team);

    const [{ data: cosmeticsData }, { data: ownedData }] = await Promise.all([
      supabase
        .from("cosmetics")
        .select("id, key, category, name, description, price_credits, preview")
        .eq("is_active", true)
        .eq("source", "shop")
        .order("price_credits", { ascending: true }),
      supabase.from("team_cosmetics").select("cosmetic_id").eq("team_id", team.id),
    ]);

    if (cosmeticsData) setCosmetics(cosmeticsData as Cosmetic[]);
    if (ownedData) setOwnedIds(new Set(ownedData.map((r: any) => r.cosmetic_id)));

    setLoading(false);
  }, []);

  useFocusEffect(useCallback(() => { fetchData(); }, [fetchData]));

  React.useEffect(() => {
    if (!isRevenueCatConfigured()) return;
    getCreditPackages().then(setCcPackages).catch(() => {});
  }, []);

  // ── Ações: cosméticos ───────────────────────────────────────────────────────
  const errorMessage = (err: any): string => {
    const msg = err?.message ?? "";
    if (msg.includes("insufficient_credits")) return t("store.errInsufficientCredits");
    if (msg.includes("already_owned"))        return t("store.errAlreadyOwned");
    return t("store.errGeneric");
  };

  const buyCosmetic = async (cosmetic: Cosmetic) => {
    setBusyCosmeticId(cosmetic.id);
    const { error } = await supabase.rpc("purchase_cosmetic", { p_cosmetic_id: cosmetic.id });
    setBusyCosmeticId(null);
    if (error) { alert(t("common.error"), errorMessage(error)); return; }
    fetchData();
  };

  const equipCosmetic = async (cosmetic: Cosmetic) => {
    setBusyCosmeticId(cosmetic.id);
    const isEquipped = wallet?.equipped_cosmetics?.[cosmetic.category] === cosmetic.id;
    const { error } = isEquipped
      ? await supabase.rpc("unequip_cosmetic", { p_category: cosmetic.category })
      : await supabase.rpc("equip_cosmetic", { p_cosmetic_id: cosmetic.id });
    setBusyCosmeticId(null);
    if (error) { alert(t("common.error"), t("store.errGeneric")); return; }
    fetchData();
  };

  // ── Ações: compra de créditos ────────────────────────────────────────────────
  const buyCredits = async (pkg: PurchasesPackage) => {
    if (!wallet) return;
    setBuyingPackageId(pkg.identifier);
    const creditsBefore = wallet.premium_credits;
    try {
      await purchasePackage(pkg);

      // A concessão real acontece no servidor via webhook do RevenueCat (assíncrono) — espera
      // um pouco e reconsulta o saldo algumas vezes antes de desistir.
      let updated = false;
      for (let i = 0; i < 4 && !updated; i++) {
        await sleep(2000);
        const { data } = await supabase.from("teams").select("premium_credits").eq("id", wallet.id).single();
        if (data && (data as any).premium_credits !== creditsBefore) {
          setWallet((w) => (w ? { ...w, premium_credits: (data as any).premium_credits } : w));
          updated = true;
        }
      }

      alert(
        t("store.purchaseSuccessTitle"),
        updated ? t("store.purchaseSuccessMsg") : t("store.purchasePendingMsg"),
        "success",
      );
    } catch (err: any) {
      if (err?.userCancelled) return;
      alert(t("common.error"), t("store.errPurchase"));
    } finally {
      setBuyingPackageId(null);
    }
  };

  const handleRestore = async () => {
    setRestoring(true);
    try {
      await restorePurchases();
      alert(t("store.restoreSuccessTitle"), t("store.restoreSuccessMsg"), "success");
      fetchData();
    } catch {
      alert(t("common.error"), t("store.errRestore"));
    } finally {
      setRestoring(false);
    }
  };

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={s.safe} edges={["top"]}>
      <ScreenHeader
        title={t("store.headerTitle")}
        right={
          <View style={s.walletPill}>
            <Text style={s.walletIcon}>💎</Text>
            <Text style={s.walletValue}>{wallet ? wallet.premium_credits.toLocaleString() : "—"}</Text>
          </View>
        }
      />

      {loading ? (
        <View style={s.center}>
          <ActivityIndicator size="large" color="#EC4899" />
          <Text style={s.loadingText}>{t("common.loading")}</Text>
        </View>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 16, paddingBottom: 48 }}>

          {/* ══ COMPRAR CRÉDITOS ═══════════════════════════ */}
          <Text style={s.sectionTitle}>{t("store.creditsTitle")}</Text>
          {ccPackages.length > 0 ? (
            <View style={s.packagesGrid}>
              {ccPackages.map((pkg) => (
                <TouchableOpacity
                  key={pkg.identifier}
                  style={s.packageCard}
                  disabled={buyingPackageId !== null}
                  onPress={() => buyCredits(pkg)}
                >
                  {buyingPackageId === pkg.identifier ? (
                    <ActivityIndicator size="small" color="#F59E0B" />
                  ) : (
                    <>
                      <Text style={s.packageIcon}>💎</Text>
                      <Text style={s.packageTitle}>{pkg.product.title}</Text>
                      <Text style={s.packagePrice}>{pkg.product.priceString}</Text>
                    </>
                  )}
                </TouchableOpacity>
              ))}
            </View>
          ) : (
            <View style={s.emptyCard}>
              <Text style={s.emptyEmoji}>💎</Text>
              <Text style={s.emptyText}>{t("store.creditsComingSoon")}</Text>
            </View>
          )}

          <TouchableOpacity style={s.restoreBtn} onPress={handleRestore} disabled={restoring}>
            {restoring
              ? <ActivityIndicator size="small" color="#6B7280" />
              : <Text style={s.restoreBtnText}>{t("store.restoreBtn")}</Text>}
          </TouchableOpacity>

          {/* ══ ATALHO: ESCUDO DO TIME ═════════════════════ */}
          <TouchableOpacity
            style={[s.shieldPromoCard, { marginTop: 24 }]}
            activeOpacity={0.85}
            onPress={() => router.push("/dashboard/manage_team/shield" as any)}
          >
            <Text style={s.shieldPromoIcon}>🛡️</Text>
            <View style={{ flex: 1 }}>
              <Text style={s.shieldPromoTitle}>{t("store.shieldPromoTitle")}</Text>
              <Text style={s.shieldPromoSubtitle}>{t("store.shieldPromoSubtitle")}</Text>
            </View>
            <Text style={s.shieldPromoArrow}>›</Text>
          </TouchableOpacity>

          {/* ══ COSMÉTICOS ═════════════════════════════════ */}
          <Text style={[s.sectionTitle, { marginTop: 24 }]}>{t("store.cosmeticsTitle")}</Text>

          {CATEGORY_ORDER.map((category) => {
            const items = cosmetics.filter((c) => c.category === category);
            if (!items.length) return null;
            return (
              <View key={category} style={{ marginBottom: 16 }}>
                <Text style={s.categoryLabel}>
                  {category === "name_color" ? t("store.categoryNameColor") : t("store.categoryPlayerFrame")}
                </Text>
                {items.map((cosmetic) => {
                  const color = cosmetic.preview?.color ?? "#6B7280";
                  const owned = ownedIds.has(cosmetic.id);
                  const equipped = wallet?.equipped_cosmetics?.[cosmetic.category] === cosmetic.id;
                  const busy = busyCosmeticId === cosmetic.id;
                  return (
                    <View key={cosmetic.id} style={[s.itemCard, equipped && { borderColor: color + "66" }]}>
                      <View style={[s.swatch, { backgroundColor: color + "22", borderColor: color }]} />
                      <View style={{ flex: 1 }}>
                        <Text style={s.itemName}>{cosmetic.name}</Text>
                        {!!cosmetic.description && <Text style={s.itemDesc}>{cosmetic.description}</Text>}
                        {!owned && <Text style={s.itemPrice}>💎 {cosmetic.price_credits}</Text>}
                      </View>
                      <TouchableOpacity
                        style={[
                          s.itemBtn,
                          owned && (equipped ? s.itemBtnEquipped : s.itemBtnOwned),
                        ]}
                        disabled={busy}
                        onPress={() => (owned ? equipCosmetic(cosmetic) : buyCosmetic(cosmetic))}
                      >
                        {busy ? (
                          <ActivityIndicator size="small" color="#9CA3AF" />
                        ) : (
                          <Text style={[s.itemBtnText, equipped && { color: "#10B981" }]}>
                            {owned ? (equipped ? t("store.unequipBtn") : t("store.equipBtn")) : t("store.buyBtn")}
                          </Text>
                        )}
                      </TouchableOpacity>
                    </View>
                  );
                })}
              </View>
            );
          })}

        </ScrollView>
      )}
    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  safe:        { flex: 1, backgroundColor: "#080808" },
  center:      { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
  loadingText: { fontSize: 13, color: "#6B7280" },

  walletPill: {
    flexDirection: "row", alignItems: "center", gap: 5,
    backgroundColor: "#161000", borderWidth: 1, borderColor: "#F59E0B44",
    borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6,
  },
  walletIcon:  { fontSize: 12 },
  walletValue: { fontSize: 12, fontWeight: "900", color: "#F59E0B" },

  sectionTitle: {
    fontSize: 10, fontWeight: "900", color: "#6B7280",
    letterSpacing: 3, marginBottom: 12,
  },

  packagesGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  packageCard: {
    width: "47%", backgroundColor: "#0D0D0D", borderRadius: 14,
    borderWidth: 1, borderColor: "#1A1A1A", padding: 16,
    alignItems: "center", gap: 4, minHeight: 96, justifyContent: "center",
  },
  packageIcon:  { fontSize: 22, marginBottom: 2 },
  packageTitle: { fontSize: 12, fontWeight: "700", color: "#FFFFFF", textAlign: "center" },
  packagePrice: { fontSize: 13, fontWeight: "900", color: "#F59E0B" },

  restoreBtn: { alignItems: "center", paddingVertical: 12, marginTop: 4 },
  restoreBtnText: { fontSize: 11, fontWeight: "800", color: "#6B7280", letterSpacing: 0.5, textDecorationLine: "underline" },

  emptyCard: {
    backgroundColor: "#0D0D0D", borderRadius: 14,
    borderWidth: 1, borderColor: "#1A1A1A",
    padding: 24, alignItems: "center", gap: 8,
  },
  emptyEmoji: { fontSize: 28, marginBottom: 2 },
  emptyText:  { fontSize: 12, color: "#6B7280", textAlign: "center" },

  shieldPromoCard: {
    flexDirection: "row", alignItems: "center", gap: 12,
    backgroundColor: "#0D0D0D", borderRadius: 14,
    borderWidth: 1, borderColor: "#1A1A1A", padding: 14,
  },
  shieldPromoIcon: { fontSize: 22 },
  shieldPromoTitle: { fontSize: 12, fontWeight: "800", color: "#FFFFFF" },
  shieldPromoSubtitle: { fontSize: 10, color: "#6B7280", marginTop: 2 },
  shieldPromoArrow: { fontSize: 20, color: "#4B5563" },

  categoryLabel: {
    fontSize: 9, fontWeight: "800", color: "#4B5563",
    letterSpacing: 1.5, marginBottom: 8,
  },
  itemCard: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: "#0D0D0D", borderRadius: 12,
    borderWidth: 1, borderColor: "#1A1A1A",
    padding: 12, gap: 12, marginBottom: 8,
  },
  swatch: { width: 36, height: 36, borderRadius: 10, borderWidth: 1 },
  itemName:  { fontSize: 13, fontWeight: "700", color: "#FFFFFF" },
  itemDesc:  { fontSize: 10, color: "#4B5563", marginTop: 2 },
  itemPrice: { fontSize: 12, fontWeight: "900", color: "#F59E0B", marginTop: 4 },

  itemBtn: {
    paddingHorizontal: 14, paddingVertical: 10, borderRadius: 8,
    backgroundColor: "#161616", borderWidth: 1, borderColor: "#242424",
    minWidth: 84, alignItems: "center",
  },
  itemBtnOwned:    { backgroundColor: "#111", borderColor: "#242424" },
  itemBtnEquipped: { backgroundColor: "#10B98118", borderColor: "#10B98155" },
  itemBtnText:     { fontSize: 10, fontWeight: "900", color: "#9CA3AF", letterSpacing: 0.5 },
});
