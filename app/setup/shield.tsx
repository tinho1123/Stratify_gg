import { ShieldEditor } from "@/components/shield/ShieldEditor";
import { supabase } from "@/database/supabase";
import { useLanguage } from "@/i18n/LanguageContext";
import { router } from "expo-router";
import React from "react";
import { StatusBar, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function SetupShieldScreen() {
  const { t } = useLanguage();

  const handleDone = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      await supabase.from("teams").update({ onboarded: true }).eq("user_id", user.id);
    }
    router.replace("/dashboard");
  };

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      <StatusBar barStyle="light-content" backgroundColor="#0D0D0D" />
      <View style={styles.header}>
        <Text style={styles.step}>{t("setup.stepShield")}</Text>
        <Text style={styles.title}>{t("setup.shieldTitle")}</Text>
        <Text style={styles.subtitle}>{t("setup.shieldSubtitle")}</Text>
      </View>
      <ShieldEditor target="team" mode="onboarding" onDone={handleDone} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0D0D0D",
  },
  header: {
    alignItems: "center",
    paddingHorizontal: 24,
    paddingTop: 12,
  },
  step: {
    fontSize: 11,
    fontWeight: "700",
    color: "#10B981",
    letterSpacing: 3,
    marginBottom: 8,
  },
  title: {
    fontSize: 20,
    fontWeight: "900",
    color: "#FFFFFF",
    letterSpacing: 3,
    marginBottom: 6,
    textAlign: "center",
  },
  subtitle: {
    fontSize: 12,
    color: "#6B7280",
    textAlign: "center",
  },
});
