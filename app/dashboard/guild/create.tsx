import { useAppAlert } from "@/components/ui/AppAlert";
import { ScreenHeader } from "@/components/ui/ScreenHeader";
import { supabase } from "@/database/supabase";
import { useLanguage } from "@/i18n/LanguageContext";
import { useFocusEffect } from "@react-navigation/native";
import { router } from "expo-router";
import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const GUILD_COST = 1000;

const ERROR_KEY: Record<string, string> = {
  already_in_guild: "guild.errAlreadyInGuild",
  guild_name_taken: "guild.errGuildNameTaken",
  invalid_name: "guild.errInvalidName",
  rate_limited: "guild.errRateLimited",
  insufficient_credits: "guild.errInsufficientCredits",
};

export default function CreateGuildScreen() {
  const { t } = useLanguage();
  const { alert } = useAppAlert();

  const [name, setName]               = useState("");
  const [description, setDescription] = useState("");
  const [isPublic, setIsPublic]       = useState(true);
  const [submitting, setSubmitting]   = useState(false);
  const [credits, setCredits]         = useState<number | null>(null);

  useFocusEffect(useCallback(() => {
    supabase.from("teams").select("premium_credits").single().then(({ data }) => {
      setCredits(data?.premium_credits ?? 0);
    });
  }, []));

  const canAfford = credits !== null && credits >= GUILD_COST;

  const submit = async () => {
    if (submitting) return;
    setSubmitting(true);
    const { error } = await supabase.rpc("create_guild", {
      p_name: name.trim(),
      p_description: description.trim(),
      p_is_public: isPublic,
    });
    setSubmitting(false);
    if (error) {
      alert(t("common.error"), t(ERROR_KEY[error.message] ?? "guild.errGeneric"));
      return;
    }
    router.replace("/dashboard/guild" as any);
  };

  return (
    <SafeAreaView style={s.safe} edges={["top"]}>
      <ScreenHeader title={t("guild.createTitle")} centered />

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 48 }} showsVerticalScrollIndicator={false}>
        <View style={s.costCard}>
          <View>
            <Text style={s.costLabel}>{t("guild.createCost")}</Text>
            <Text style={s.costSub}>
              {t("guild.yourDiamonds")}: 💎 {credits ?? "…"}
            </Text>
          </View>
          {credits !== null && !canAfford && (
            <TouchableOpacity style={s.storeBtn} onPress={() => router.push("/dashboard/store" as any)} activeOpacity={0.85}>
              <Text style={s.storeBtnText}>{t("guild.goToStoreBtn")}</Text>
            </TouchableOpacity>
          )}
        </View>

        <Text style={s.label}>{t("guild.nameLabel")}</Text>
        <TextInput
          style={s.input}
          value={name}
          onChangeText={setName}
          placeholder={t("guild.namePlaceholder")}
          placeholderTextColor="#4B5563"
          maxLength={30}
        />

        <Text style={s.label}>{t("guild.descriptionLabel")}</Text>
        <TextInput
          style={[s.input, s.textArea]}
          value={description}
          onChangeText={setDescription}
          placeholder={t("guild.descriptionPlaceholder")}
          placeholderTextColor="#4B5563"
          maxLength={200}
          multiline
        />

        <View style={s.toggleRow}>
          <View style={{ flex: 1 }}>
            <Text style={s.toggleLabel}>{t("guild.publicToggleLabel")}</Text>
            <Text style={s.toggleHint}>{t("guild.publicToggleHint")}</Text>
          </View>
          <Switch
            value={isPublic}
            onValueChange={setIsPublic}
            trackColor={{ false: "#242424", true: "#EC489988" }}
            thumbColor={isPublic ? "#EC4899" : "#6B7280"}
          />
        </View>

        <TouchableOpacity
          style={[s.submitBtn, (name.trim().length < 3 || !canAfford) && s.submitBtnDisabled]}
          disabled={submitting || name.trim().length < 3 || !canAfford}
          onPress={submit}
          activeOpacity={0.85}
        >
          {submitting ? <ActivityIndicator size="small" color="#080808" /> : <Text style={s.submitBtnText}>{t("guild.createSubmit")}</Text>}
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#080808" },

  costCard: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10,
    backgroundColor: "#0D0D0D", borderWidth: 1, borderColor: "#1A1A1A",
    borderRadius: 12, padding: 14,
  },
  costLabel: { fontSize: 13, fontWeight: "900", color: "#FFFFFF" },
  costSub:   { fontSize: 11, color: "#6B7280", marginTop: 2 },
  storeBtn: { backgroundColor: "#161616", borderWidth: 1, borderColor: "#6366F144", borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8 },
  storeBtnText: { fontSize: 10, fontWeight: "900", color: "#6366F1" },

  label: { fontSize: 10, fontWeight: "900", color: "#6B7280", letterSpacing: 1.5, marginBottom: 8, marginTop: 16 },
  input: {
    backgroundColor: "#0D0D0D", borderWidth: 1, borderColor: "#1F1F1F",
    borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12,
    fontSize: 13, color: "#FFFFFF",
  },
  textArea: { minHeight: 80, textAlignVertical: "top" },

  toggleRow: {
    flexDirection: "row", alignItems: "center", gap: 12,
    backgroundColor: "#0D0D0D", borderWidth: 1, borderColor: "#1A1A1A",
    borderRadius: 12, padding: 14, marginTop: 20,
  },
  toggleLabel: { fontSize: 12, fontWeight: "800", color: "#FFFFFF" },
  toggleHint: { fontSize: 10, color: "#6B7280", marginTop: 2 },

  submitBtn: {
    backgroundColor: "#EC4899", borderRadius: 12, paddingVertical: 15,
    alignItems: "center", marginTop: 28,
  },
  submitBtnDisabled: { opacity: 0.4 },
  submitBtnText: { fontSize: 13, fontWeight: "900", color: "#080808", letterSpacing: 0.5 },
});
