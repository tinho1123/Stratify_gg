import { supabase } from "@/database/supabase";
import { useLanguage } from "@/i18n/LanguageContext";
import { LANGUAGE_LABELS, Language } from "@/i18n/translations";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function ProfileScreen() {
  const { language, setLanguage, t } = useLanguage();
  const [email, setEmail] = useState<string | null>(null);
  const [createdAt, setCreatedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loggingOut, setLoggingOut] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setEmail(user?.email ?? null);
      if (user?.created_at) {
        const date = new Date(user.created_at);
        setCreatedAt(date.toLocaleDateString(language === "pt" ? "pt-BR" : "en-US"));
      }
      setLoading(false);
    });
  }, [language]);

  const handleLogout = async () => {
    setLoggingOut(true);
    await supabase.auth.signOut();
    router.replace("/login");
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#10B981" />
      </View>
    );
  }

  const avatarLetter = email?.[0]?.toUpperCase() ?? "?";

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Text style={styles.backText}>← {t("common.back")}</Text>
          </TouchableOpacity>
          <Text style={styles.title}>{t("profile.title")}</Text>
          <View style={styles.headerSpacer} />
        </View>

        {/* Avatar */}
        <View style={styles.avatarSection}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{avatarLetter}</Text>
          </View>
          <Text style={styles.emailDisplay}>{email}</Text>
          {createdAt && (
            <Text style={styles.memberSince}>{t("profile.memberSince")} {createdAt}</Text>
          )}
        </View>

        {/* Info Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t("profile.accountInfoSection")}</Text>
          <View style={styles.infoCard}>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>{t("profile.email")}</Text>
              <Text style={styles.infoValue}>{email}</Text>
            </View>
            <View style={[styles.infoRow, styles.infoRowLast]}>
              <Text style={styles.infoLabel}>{t("profile.password")}</Text>
              <Text style={styles.infoValue}>••••••••</Text>
            </View>
          </View>
        </View>

        {/* Settings Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t("profile.settingsSection")}</Text>
          <View style={styles.infoCard}>
            <View style={[styles.infoRow, styles.infoRowLast, { flexDirection: "column", alignItems: "stretch", gap: 10 }]}>
              <Text style={styles.infoLabel}>{t("profile.language")}</Text>
              <View style={styles.languageRow}>
                {(Object.keys(LANGUAGE_LABELS) as Language[]).map((lang) => (
                  <TouchableOpacity
                    key={lang}
                    style={[styles.languageOption, language === lang && styles.languageOptionActive]}
                    onPress={() => setLanguage(lang)}
                  >
                    <Text style={[styles.languageOptionText, language === lang && styles.languageOptionTextActive]}>
                      {LANGUAGE_LABELS[lang]}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </View>
        </View>

        {/* Security Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t("profile.securitySection")}</Text>
          <View style={styles.securityCard}>
            <Text style={styles.securityIcon}>🔒</Text>
            <View style={styles.securityContent}>
              <Text style={styles.securityTitle}>{t("profile.securityTitle")}</Text>
              <Text style={styles.securityDesc}>{t("profile.securityDesc")}</Text>
            </View>
          </View>
        </View>

        {/* Logout */}
        <TouchableOpacity
          style={[styles.logoutButton, loggingOut && styles.logoutButtonDisabled]}
          onPress={handleLogout}
          disabled={loggingOut}
          activeOpacity={0.8}
        >
          {loggingOut ? (
            <ActivityIndicator size="small" color="#EF4444" />
          ) : (
            <Text style={styles.logoutText}>{t("profile.logout")}</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0D0D0D",
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: "#0D0D0D",
    justifyContent: "center",
    alignItems: "center",
  },
  content: {
    paddingHorizontal: 24,
    paddingVertical: 20,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 32,
  },
  backButton: {
    padding: 4,
  },
  backText: {
    color: "#10B981",
    fontSize: 14,
    fontWeight: "600",
  },
  title: {
    fontSize: 16,
    fontWeight: "900",
    color: "#FFFFFF",
    letterSpacing: 4,
  },
  headerSpacer: {
    width: 60,
  },
  avatarSection: {
    alignItems: "center",
    marginBottom: 32,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "#10B981",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 12,
  },
  avatarText: {
    fontSize: 36,
    fontWeight: "900",
    color: "#000000",
  },
  emailDisplay: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
  },
  memberSince: {
    color: "#6B7280",
    fontSize: 12,
    marginTop: 4,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: "700",
    color: "#10B981",
    letterSpacing: 2,
    marginBottom: 12,
  },
  infoCard: {
    backgroundColor: "#161616",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#242424",
    overflow: "hidden",
  },
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#242424",
  },
  infoRowLast: {
    borderBottomWidth: 0,
  },
  infoLabel: {
    color: "#6B7280",
    fontSize: 14,
  },
  infoValue: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "500",
  },
  languageRow: {
    flexDirection: "row",
    gap: 8,
  },
  languageOption: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#242424",
    backgroundColor: "#0D0D0D",
    alignItems: "center",
  },
  languageOptionActive: {
    borderColor: "#10B981",
    backgroundColor: "rgba(16,185,129,0.12)",
  },
  languageOptionText: {
    color: "#6B7280",
    fontSize: 13,
    fontWeight: "700",
  },
  languageOptionTextActive: {
    color: "#10B981",
  },
  securityCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: "#0D1F16",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#1A3D2A",
    padding: 16,
    gap: 12,
  },
  securityIcon: {
    fontSize: 24,
  },
  securityContent: {
    flex: 1,
  },
  securityTitle: {
    color: "#10B981",
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 4,
  },
  securityDesc: {
    color: "#6B7280",
    fontSize: 13,
    lineHeight: 18,
  },
  logoutButton: {
    backgroundColor: "rgba(239,68,68,0.1)",
    borderWidth: 1,
    borderColor: "#EF4444",
    borderRadius: 10,
    paddingVertical: 15,
    alignItems: "center",
    marginTop: 8,
  },
  logoutButtonDisabled: {
    opacity: 0.5,
  },
  logoutText: {
    color: "#EF4444",
    fontSize: 14,
    fontWeight: "700",
    letterSpacing: 1,
  },
});
