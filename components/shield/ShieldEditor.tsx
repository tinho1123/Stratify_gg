import { useAppAlert } from "@/components/ui/AppAlert";
import { ShieldPreview } from "@/components/ui/ShieldPreview";
import { supabase } from "@/database/supabase";
import { useLanguage } from "@/i18n/LanguageContext";
import React, { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";

type ShieldTarget = "team" | "guild";

interface ShieldCosmetic {
  id: string;
  key: string;
  category: string;
  name: string;
  description: string | null;
  price_credits: number;
  preview: { color?: string; ref?: string };
}

const SLOT_SUFFIXES = ["shape", "primary_color", "secondary_color", "icon"] as const;
type SlotSuffix = (typeof SLOT_SUFFIXES)[number];

const SLOT_LABEL_KEY: Record<SlotSuffix, string> = {
  shape: "shield.slotShape",
  primary_color: "shield.slotPrimaryColor",
  secondary_color: "shield.slotSecondaryColor",
  icon: "shield.slotIcon",
};

interface ShieldEditorProps {
  target: ShieldTarget;
  guildId?: string;
  mode: "onboarding" | "edit";
  onDone: () => void;
}

export function ShieldEditor({ target, guildId, onDone }: ShieldEditorProps) {
  const { t } = useLanguage();
  const { alert } = useAppAlert();

  const prefix = target === "team" ? "shield_" : "guild_shield_";
  const categoryOf = (suffix: SlotSuffix) => `${prefix}${suffix}`;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [busyItemId, setBusyItemId] = useState<string | null>(null);
  const [credits, setCredits] = useState(0);
  const [items, setItems] = useState<ShieldCosmetic[]>([]);
  const [ownedIds, setOwnedIds] = useState<Set<string>>(new Set());
  const [selected, setSelected] = useState<Record<string, string>>({});

  const errorMessage = useCallback(
    (err: any): string => {
      const msg = err?.message ?? "";
      if (msg.includes("insufficient_credits")) return t("shield.errInsufficientCredits");
      if (msg.includes("already_owned")) return t("shield.errAlreadyOwned");
      if (msg.includes("not_authorized")) return t("shield.errNotAuthorized");
      return t("shield.errGeneric");
    },
    [t],
  );

  const fetchData = useCallback(async () => {
    setLoading(true);
    const categories = SLOT_SUFFIXES.map(categoryOf);

    const { data: catalog } = await supabase
      .from("cosmetics")
      .select("id, key, category, name, description, price_credits, preview")
      .in("category", categories)
      .eq("is_active", true)
      .eq("source", "shop")
      .order("price_credits", { ascending: true });

    let equipped: Record<string, string> = {};
    let owned = new Set<string>();
    let balance = 0;

    if (target === "team") {
      const { data: team } = await supabase
        .from("teams")
        .select("id, premium_credits, equipped_cosmetics")
        .single();
      if (team) {
        const t2 = team as any;
        balance = t2.premium_credits ?? 0;
        equipped = t2.equipped_cosmetics ?? {};
        const { data: ownedRows } = await supabase
          .from("team_cosmetics")
          .select("cosmetic_id")
          .eq("team_id", t2.id);
        owned = new Set((ownedRows ?? []).map((r: any) => r.cosmetic_id));
      }
    } else if (guildId) {
      const { data: myGuild } = await supabase.rpc("get_my_guild");
      if (myGuild) {
        const g = myGuild as any;
        balance = g.leader_premium_credits ?? 0;
        equipped = g.equipped_cosmetics ?? {};
      }
      const { data: ownedRows } = await supabase
        .from("guild_cosmetics")
        .select("cosmetic_id")
        .eq("guild_id", guildId);
      owned = new Set((ownedRows ?? []).map((r: any) => r.cosmetic_id));
    }

    const catalogItems = (catalog ?? []) as ShieldCosmetic[];
    setItems(catalogItems);
    setOwnedIds(owned);
    setCredits(balance);

    setSelected((prev) => {
      const next: Record<string, string> = {};
      for (const suffix of SLOT_SUFFIXES) {
        const cat = categoryOf(suffix);
        const equippedId = equipped[cat];
        const catItems = catalogItems.filter((c) => c.category === cat);
        if (equippedId && catItems.some((c) => c.id === equippedId)) {
          next[cat] = equippedId;
        } else if (prev[cat] && catItems.some((c) => c.id === prev[cat])) {
          next[cat] = prev[cat];
        } else {
          const cheapest = [...catItems].sort((a, b) => a.price_credits - b.price_credits)[0];
          if (cheapest) next[cat] = cheapest.id;
        }
      }
      return next;
    });

    setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target, guildId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const purchase = async (cosmeticId: string) => {
    return target === "team"
      ? supabase.rpc("purchase_cosmetic", { p_cosmetic_id: cosmeticId })
      : supabase.rpc("purchase_guild_cosmetic", { p_guild_id: guildId, p_cosmetic_id: cosmeticId });
  };

  const selectItem = async (item: ShieldCosmetic) => {
    if (busyItemId) return;
    setSelected((prev) => ({ ...prev, [item.category]: item.id }));
    if (ownedIds.has(item.id)) return;

    setBusyItemId(item.id);
    const { error } = await purchase(item.id);
    setBusyItemId(null);

    if (error) {
      alert(t("common.error"), errorMessage(error));
      return;
    }
    setOwnedIds((prev) => new Set(prev).add(item.id));
    setCredits((c) => c - item.price_credits);
  };

  const handleSave = async () => {
    if (saving) return;
    setSaving(true);

    for (const suffix of SLOT_SUFFIXES) {
      const id = selected[categoryOf(suffix)];
      if (!id || ownedIds.has(id)) continue;
      const item = items.find((c) => c.id === id);
      if (!item) continue;
      const { error } = await purchase(id);
      if (error) {
        setSaving(false);
        alert(t("common.error"), errorMessage(error));
        return;
      }
      setOwnedIds((prev) => new Set(prev).add(id));
    }

    const shapeId = selected[categoryOf("shape")];
    const primaryId = selected[categoryOf("primary_color")];
    const secondaryId = selected[categoryOf("secondary_color")];
    const iconId = selected[categoryOf("icon")];

    if (!shapeId || !primaryId || !secondaryId || !iconId) {
      setSaving(false);
      alert(t("common.error"), t("shield.errGeneric"));
      return;
    }

    const { error } =
      target === "team"
        ? await supabase.rpc("equip_team_shield", {
            p_shape_id: shapeId,
            p_primary_color_id: primaryId,
            p_secondary_color_id: secondaryId,
            p_icon_id: iconId,
          })
        : await supabase.rpc("equip_guild_shield", {
            p_guild_id: guildId,
            p_shape_id: shapeId,
            p_primary_color_id: primaryId,
            p_secondary_color_id: secondaryId,
            p_icon_id: iconId,
          });

    setSaving(false);
    if (error) {
      alert(t("common.error"), errorMessage(error));
      return;
    }
    onDone();
  };

  const previewShapeRef = items.find((c) => c.id === selected[categoryOf("shape")])?.preview?.ref ?? "classic";
  const previewIconRef = items.find((c) => c.id === selected[categoryOf("icon")])?.preview?.ref ?? "star";
  const previewPrimary = items.find((c) => c.id === selected[categoryOf("primary_color")])?.preview?.color ?? "#0D0D0D";
  const previewSecondary = items.find((c) => c.id === selected[categoryOf("secondary_color")])?.preview?.color ?? "#F5F5F5";

  if (loading) {
    return (
      <View style={s.center}>
        <ActivityIndicator size="large" color="#10B981" />
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <View style={s.previewWrap}>
        <ShieldPreview
          shapeRef={previewShapeRef}
          iconRef={previewIconRef}
          primaryColor={previewPrimary}
          secondaryColor={previewSecondary}
          size={120}
        />
        <View style={s.creditsPill}>
          <Text style={s.creditsIcon}>💎</Text>
          <Text style={s.creditsValue}>{credits.toLocaleString()}</Text>
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 16, paddingBottom: 24 }}>
        {SLOT_SUFFIXES.map((suffix) => {
          const cat = categoryOf(suffix);
          const slotItems = items.filter((c) => c.category === cat);
          if (!slotItems.length) return null;
          return (
            <View key={cat} style={{ marginBottom: 18 }}>
              <Text style={s.slotLabel}>{t(SLOT_LABEL_KEY[suffix])}</Text>
              <View style={s.grid}>
                {slotItems.map((item) => {
                  const owned = ownedIds.has(item.id);
                  const isSelected = selected[cat] === item.id;
                  const busy = busyItemId === item.id;
                  const swatchColor = item.preview?.color ?? "#6B7280";

                  return (
                    <TouchableOpacity
                      key={item.id}
                      style={[s.itemCard, isSelected && s.itemCardSelected]}
                      disabled={busy}
                      onPress={() => selectItem(item)}
                      activeOpacity={0.85}
                    >
                      {busy ? (
                        <ActivityIndicator size="small" color="#9CA3AF" />
                      ) : (
                        <>
                          {item.preview?.color ? (
                            <View style={[s.swatch, { backgroundColor: swatchColor }]} />
                          ) : (
                            <ShieldPreview
                              shapeRef={suffix === "shape" ? (item.preview?.ref ?? "classic") : previewShapeRef}
                              iconRef={suffix === "icon" ? (item.preview?.ref ?? "star") : "star"}
                              primaryColor={suffix === "shape" ? "#2A2A2A" : previewPrimary}
                              secondaryColor={suffix === "icon" ? "#FFFFFF" : previewSecondary}
                              size={40}
                            />
                          )}
                          <Text style={s.itemName} numberOfLines={1}>
                            {item.name}
                          </Text>
                          {!owned && (
                            <Text style={s.itemPrice}>
                              {item.price_credits > 0 ? `💎 ${item.price_credits}` : t("shield.freeLabel")}
                            </Text>
                          )}
                        </>
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          );
        })}
      </ScrollView>

      <TouchableOpacity style={[s.saveBtn, saving && s.saveBtnDisabled]} disabled={saving} onPress={handleSave} activeOpacity={0.85}>
        {saving ? <ActivityIndicator size="small" color="#080808" /> : <Text style={s.saveBtnText}>{t("shield.saveBtn")}</Text>}
      </TouchableOpacity>
    </View>
  );
}

const s = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  previewWrap: { alignItems: "center", paddingVertical: 20, gap: 10 },
  creditsPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "#161000",
    borderWidth: 1,
    borderColor: "#F59E0B44",
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  creditsIcon: { fontSize: 12 },
  creditsValue: { fontSize: 12, fontWeight: "900", color: "#F59E0B" },
  slotLabel: { fontSize: 10, fontWeight: "900", color: "#6B7280", letterSpacing: 1.5, marginBottom: 8 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  itemCard: {
    width: 84,
    alignItems: "center",
    gap: 6,
    backgroundColor: "#0D0D0D",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#1A1A1A",
    paddingVertical: 12,
    paddingHorizontal: 6,
    minHeight: 92,
    justifyContent: "center",
  },
  itemCardSelected: { borderColor: "#10B981", backgroundColor: "#10B98111" },
  swatch: { width: 36, height: 36, borderRadius: 10 },
  itemName: { fontSize: 10, fontWeight: "700", color: "#FFFFFF", textAlign: "center" },
  itemPrice: { fontSize: 10, fontWeight: "900", color: "#F59E0B" },
  saveBtn: {
    backgroundColor: "#10B981",
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: "center",
    marginHorizontal: 16,
    marginBottom: 16,
  },
  saveBtnDisabled: { opacity: 0.5 },
  saveBtnText: { color: "#000", fontSize: 14, fontWeight: "900", letterSpacing: 1 },
});
