import { supabase } from "@/database/supabase";
import { useLanguage } from "@/i18n/LanguageContext";
import { router } from "expo-router";
import { useState } from "react";
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function ForgotPasswordScreen() {
  const { t } = useLanguage();
  const [email, setEmail] = useState("");
  const [emailFocused, setEmailFocused] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const handleSubmit = async () => {
    setError(null);
    if (!email.trim()) {
      setError(t("forgotPassword.errEmptyEmail"));
      return;
    }
    setLoading(true);
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim());
    setLoading(false);
    if (resetError) {
      setError(t("forgotPassword.errGeneric"));
      return;
    }
    setSent(true);
  };

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      <StatusBar barStyle="light-content" backgroundColor="#0D0D0D" />
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.keyboardView}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.bgGlow} />

          <View style={styles.header}>
            <Image
              source={require("@/assets/images/stratify-logo.png")}
              style={styles.logo}
              resizeMode="contain"
            />
            <Text style={styles.title}>{t("forgotPassword.title")}</Text>
            <Text style={styles.subtitle}>
              {t("forgotPassword.subtitle")}
            </Text>
          </View>

          {sent ? (
            <View style={styles.successBox}>
              <Text style={styles.successIcon}>📬</Text>
              <Text style={styles.successTitle}>{t("forgotPassword.emailSentTitle")}</Text>
              <Text style={styles.successDesc}>
                {t("forgotPassword.emailSentDesc")}
              </Text>
              <TouchableOpacity
                style={styles.backButton}
                onPress={() => router.replace("/login")}
              >
                <Text style={styles.backButtonText}>{t("forgotPassword.backToLoginBtn")}</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.form}>
              {error && (
                <View style={styles.errorBox}>
                  <Text style={styles.errorText}>⚠ {error}</Text>
                </View>
              )}

              <View style={styles.inputGroup}>
                <Text style={styles.label}>{t("login.emailLabel")}</Text>
                <View style={[styles.inputWrapper, emailFocused && styles.inputFocused]}>
                  <TextInput
                    style={styles.input}
                    placeholder={t("login.emailPlaceholder")}
                    placeholderTextColor="#4B5563"
                    value={email}
                    onChangeText={setEmail}
                    onFocus={() => setEmailFocused(true)}
                    onBlur={() => setEmailFocused(false)}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    editable={!loading}
                  />
                </View>
              </View>

              <TouchableOpacity
                style={[styles.submitButton, loading && styles.submitButtonDisabled]}
                onPress={handleSubmit}
                activeOpacity={0.85}
                disabled={loading}
              >
                {loading ? (
                  <View style={styles.loadingRow}>
                    <ActivityIndicator size="small" color="#000" />
                    <Text style={styles.submitButtonText}>{t("forgotPassword.sending")}</Text>
                  </View>
                ) : (
                  <Text style={styles.submitButtonText}>{t("forgotPassword.submitBtn")}</Text>
                )}
              </TouchableOpacity>
            </View>
          )}

          {!sent && (
            <TouchableOpacity style={styles.loginRow} onPress={() => router.back()}>
              <Text style={styles.loginText}>{t("forgotPassword.backToLoginLink")}</Text>
            </TouchableOpacity>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0D0D0D",
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingVertical: 32,
    justifyContent: "center",
  },
  bgGlow: {
    position: "absolute",
    top: -120,
    alignSelf: "center",
    width: 360,
    height: 360,
    borderRadius: 180,
    backgroundColor: "#10B981",
    opacity: 0.07,
  },
  header: {
    alignItems: "center",
    marginBottom: 36,
  },
  logo: {
    width: 72,
    height: 72,
    marginBottom: 16,
  },
  title: {
    fontSize: 22,
    fontWeight: "900",
    color: "#FFFFFF",
    letterSpacing: 4,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 13,
    color: "#6B7280",
    textAlign: "center",
    lineHeight: 20,
  },
  form: {
    backgroundColor: "#161616",
    borderRadius: 16,
    padding: 24,
    borderWidth: 1,
    borderColor: "#242424",
    marginBottom: 24,
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 13,
    fontWeight: "600",
    color: "#9CA3AF",
    marginBottom: 8,
  },
  inputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#0D0D0D",
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: "#2A2A2A",
  },
  inputFocused: {
    borderColor: "#10B981",
  },
  input: {
    flex: 1,
    color: "#FFFFFF",
    fontSize: 15,
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  errorBox: {
    backgroundColor: "rgba(239,68,68,0.1)",
    borderWidth: 1,
    borderColor: "#EF4444",
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  errorText: {
    color: "#EF4444",
    fontSize: 13,
  },
  submitButton: {
    backgroundColor: "#10B981",
    paddingVertical: 15,
    borderRadius: 10,
    alignItems: "center",
  },
  submitButtonDisabled: {
    opacity: 0.5,
  },
  submitButtonText: {
    color: "#000000",
    fontSize: 15,
    fontWeight: "700",
    letterSpacing: 0.3,
  },
  loadingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  loginRow: {
    alignItems: "center",
  },
  loginText: {
    color: "#10B981",
    fontSize: 14,
    fontWeight: "600",
  },
  successBox: {
    backgroundColor: "#0D1F16",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#1A3D2A",
    padding: 28,
    alignItems: "center",
    marginBottom: 24,
    gap: 12,
  },
  successIcon: {
    fontSize: 40,
  },
  successTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#FFFFFF",
  },
  successDesc: {
    fontSize: 13,
    color: "#9CA3AF",
    textAlign: "center",
    lineHeight: 20,
  },
  backButton: {
    marginTop: 8,
    backgroundColor: "#10B981",
    paddingVertical: 13,
    paddingHorizontal: 28,
    borderRadius: 10,
  },
  backButtonText: {
    color: "#000",
    fontSize: 14,
    fontWeight: "700",
  },
});
