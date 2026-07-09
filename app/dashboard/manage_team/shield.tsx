import { ShieldEditor } from "@/components/shield/ShieldEditor";
import { ScreenHeader } from "@/components/ui/ScreenHeader";
import { useLanguage } from "@/i18n/LanguageContext";
import { router } from "expo-router";
import React from "react";
import { StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function ManageTeamShieldScreen() {
  const { t } = useLanguage();

  return (
    <SafeAreaView style={s.safe} edges={["top"]}>
      <ScreenHeader title={t("shield.teamHeaderTitle")} centered />
      <ShieldEditor target="team" mode="edit" onDone={() => router.back()} />
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#080808" },
});
