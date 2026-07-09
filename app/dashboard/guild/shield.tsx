import { ShieldEditor } from "@/components/shield/ShieldEditor";
import { ScreenHeader } from "@/components/ui/ScreenHeader";
import { useLanguage } from "@/i18n/LanguageContext";
import { router, useLocalSearchParams } from "expo-router";
import React from "react";
import { StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function GuildShieldScreen() {
  const { t } = useLanguage();
  const params = useLocalSearchParams<{ guildId: string }>();

  return (
    <SafeAreaView style={s.safe} edges={["top"]}>
      <ScreenHeader title={t("shield.guildHeaderTitle")} centered />
      <ShieldEditor
        target="guild"
        guildId={params.guildId}
        mode="edit"
        onDone={() => router.replace("/dashboard/guild" as any)}
      />
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#080808" },
});
