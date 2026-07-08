import { useLanguage } from "@/i18n/LanguageContext";
import React from "react";
import { Linking, Platform, StyleSheet, Text, TouchableOpacity, View } from "react-native";

const PACKAGE_NAME = "gg.stratify.app";

function getStoreUrl(): string {
  if (Platform.OS === "ios") {
    return `https://apps.apple.com/app/${PACKAGE_NAME}`;
  }
  return `market://details?id=${PACKAGE_NAME}`;
}

export function UpdateRequiredScreen() {
  const { t } = useLanguage();

  return (
    <View style={s.container}>
      <Text style={s.icon}>⬆️</Text>
      <Text style={s.title}>{t("update.title")}</Text>
      <Text style={s.message}>{t("update.message")}</Text>
      <TouchableOpacity style={s.button} onPress={() => Linking.openURL(getStoreUrl())}>
        <Text style={s.buttonText}>{t("update.button")}</Text>
      </TouchableOpacity>
    </View>
  );
}

const s = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0D0D0D",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
  },
  icon: { fontSize: 48, marginBottom: 16 },
  title: { fontSize: 20, fontWeight: "800", color: "#fff", marginBottom: 8, textAlign: "center" },
  message: { fontSize: 14, color: "#9BA1A6", textAlign: "center", marginBottom: 24, lineHeight: 20 },
  button: {
    backgroundColor: "#F59E0B",
    borderRadius: 10,
    paddingVertical: 14,
    paddingHorizontal: 32,
  },
  buttonText: { fontSize: 14, fontWeight: "800", color: "#0D0D0D" },
});
