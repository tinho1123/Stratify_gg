import { supabase } from "@/database/supabase";
import { useLanguage } from "@/i18n/LanguageContext";
import { router } from "expo-router";
import React, { useState } from "react";
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

export default function LoginScreen() {
  const { t } = useLanguage();
  const [email, setEmail] = useState<string>("");
  const [password, setPassword] = useState<string>("");
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [emailFocused, setEmailFocused] = useState<boolean>(false);
  const [passwordFocused, setPasswordFocused] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async (): Promise<void> => {
    setError(null);
    if (!email || !password) {
      setError(t("login.errorFillFields"));
      return;
    }
    setLoading(true);
    const { error: loginError } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (loginError) {
      if (loginError.message.toLowerCase().includes("email not confirmed")) {
        setError(t("login.errorEmailNotConfirmed"));
      } else {
        setError(t("login.errorInvalidCredentials"));
      }
      return;
    }
    router.replace("/dashboard");
  };

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      <StatusBar barStyle="light-content" backgroundColor="#080808" />
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.keyboardView}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Radial glow */}
          <View style={styles.bgGlow} />

          {/* Header */}
          <View style={styles.header}>
            <Image
              source={require("@/assets/images/stratify-logo.png")}
              style={styles.logo}
              resizeMode="contain"
            />
            <Text style={styles.title}>STRATIFY</Text>
            <Text style={styles.subtitle}>{t("login.subtitle")}</Text>
          </View>

          {/* Form */}
          <View style={styles.form}>
            {/* E-mail */}
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
                />
              </View>
            </View>

            {/* Senha */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>{t("login.passwordLabel")}</Text>
              <View style={[styles.inputWrapper, passwordFocused && styles.inputFocused]}>
                <TextInput
                  style={styles.input}
                  placeholder="••••••••"
                  placeholderTextColor="#4B5563"
                  value={password}
                  onChangeText={setPassword}
                  onFocus={() => setPasswordFocused(true)}
                  onBlur={() => setPasswordFocused(false)}
                  secureTextEntry={!showPassword}
                />
                <TouchableOpacity
                  onPress={() => setShowPassword(!showPassword)}
                  style={styles.eyeButton}
                >
                  <Text style={styles.eyeButtonText}>{showPassword ? "👁" : "🙈"}</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Forgot */}
            <TouchableOpacity
              style={styles.forgotRow}
              onPress={() => router.push("/login/forgot-password")}
            >
              <Text style={styles.forgotText}>{t("login.forgotPassword")}</Text>
            </TouchableOpacity>

            {/* Error */}
            {error && (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>⚠ {error}</Text>
              </View>
            )}

            {/* CTA */}
            <TouchableOpacity
              style={[styles.loginButton, loading && styles.loginButtonDisabled]}
              onPress={handleLogin}
              activeOpacity={0.85}
              disabled={loading}
            >
              {loading ? (
                <View style={styles.loadingRow}>
                  <ActivityIndicator size="small" color="#000" />
                  <Text style={styles.loginButtonText}>{t("login.loggingIn")}</Text>
                </View>
              ) : (
                <Text style={styles.loginButtonText}>{t("login.loginButton")}</Text>
              )}
            </TouchableOpacity>
          </View>

          {/* Footer */}
          <View style={styles.signupRow}>
            <Text style={styles.signupText}>{t("login.noAccount")}</Text>
            <TouchableOpacity onPress={() => router.push("/login/signup")}>
              <Text style={styles.signupLink}>{t("login.createTeam")}</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#080808",   // --surface-app
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,        // --space-8
    paddingVertical: 32,
    justifyContent: "center",
  },

  // Glow
  bgGlow: {
    position: "absolute",
    top: -100,
    alignSelf: "center",
    width: 340,
    height: 340,
    borderRadius: 170,
    backgroundColor: "#10B981",   // --emerald-500
    opacity: 0.07,
  },

  // Header
  header: {
    alignItems: "center",
    marginBottom: 36,
  },
  logo: {
    width: 84,
    height: 84,
    marginBottom: 14,
  },
  title: {
    fontSize: 26,
    fontWeight: "900",
    color: "#FFFFFF",
    letterSpacing: 8,             // --tracking-widest ≈ 0.32em
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 13,
    fontWeight: "500",
    color: "#6B7280",             // --text-muted
    letterSpacing: 0.3,
  },

  // Form — flat, no card wrapper per design system
  form: {
    gap: 0,
    marginBottom: 28,
  },
  inputGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 13,
    fontWeight: "600",
    color: "#9CA3AF",             // --text-secondary
    marginBottom: 8,
    letterSpacing: 0.2,
  },
  inputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#0D0D0D",  // --surface-deep
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: "#2A2A2A",      // --border-input
    height: 42,                  // --control-h
  },
  inputFocused: {
    borderColor: "#10B981",      // --focus-ring
  },
  input: {
    flex: 1,
    color: "#FFFFFF",
    fontSize: 15,
    paddingHorizontal: 16,
  },
  eyeButton: {
    paddingHorizontal: 14,
    height: "100%",
    justifyContent: "center",
  },
  eyeButtonText: {
    fontSize: 17,
  },

  forgotRow: {
    alignSelf: "flex-end",
    marginBottom: 20,
    marginTop: -4,
    minHeight: 44,               // --tap-min
    justifyContent: "center",
  },
  forgotText: {
    color: "#10B981",            // --emerald-500
    fontSize: 13,
    fontWeight: "600",
  },

  errorBox: {
    backgroundColor: "rgba(239,68,68,0.1)",
    borderWidth: 1,
    borderColor: "#EF4444",      // --danger
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  errorText: {
    color: "#EF4444",
    fontSize: 13,
  },

  loginButton: {
    backgroundColor: "#10B981",  // --emerald-500
    height: 48,                  // --button-h
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  loginButtonDisabled: {
    opacity: 0.5,
  },
  loginButtonText: {
    color: "#000000",            // --accent-on
    fontSize: 15,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  loadingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },

  // Footer
  signupRow: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
  },
  signupText: {
    color: "#6B7280",            // --text-muted
    fontSize: 13,
    fontWeight: "500",
  },
  signupLink: {
    color: "#10B981",            // --emerald-500
    fontSize: 13,
    fontWeight: "700",
  },
});
