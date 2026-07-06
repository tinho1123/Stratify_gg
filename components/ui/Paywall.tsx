import { PRIVACY_URL, TERMS_URL } from "@/constants/monetization";
import { useLanguage } from "@/i18n/LanguageContext";
import {
  getSeasonPassPackage,
  isRevenueCatConfigured,
  purchasePackage,
  restorePurchases,
} from "@/services/revenuecat";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Linking,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import type { PurchasesPackage } from "react-native-purchases";

// Paywall genérico pro Season Pass — hoje é o único produto por assinatura do app. Se surgir
// um segundo (ex.: plano anual), trocar `getSeasonPassPackage` por um parâmetro `getPackage`.

interface PaywallProps {
  visible: boolean;
  onClose: () => void;
  onSubscribed: () => void;
}

const FEATURE_KEYS = ["feature1", "feature2", "feature3", "feature4"] as const;

export function Paywall({ visible, onClose, onSubscribed }: PaywallProps) {
  const { t } = useLanguage();
  const [pkg, setPkg] = useState<PurchasesPackage | null>(null);
  const [loadingPkg, setLoadingPkg] = useState(true);
  const [subscribing, setSubscribing] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) return;
    setErrorMsg(null);
    if (!isRevenueCatConfigured()) {
      setPkg(null);
      setLoadingPkg(false);
      return;
    }
    setLoadingPkg(true);
    getSeasonPassPackage()
      .then(setPkg)
      .catch(() => setPkg(null))
      .finally(() => setLoadingPkg(false));
  }, [visible]);

  const handleSubscribe = async () => {
    if (!pkg) return;
    setErrorMsg(null);
    setSubscribing(true);
    try {
      await purchasePackage(pkg);
      onSubscribed();
    } catch (err: any) {
      if (err?.userCancelled) return;
      setErrorMsg(t("paywall.errPurchase"));
    } finally {
      setSubscribing(false);
    }
  };

  const handleRestore = async () => {
    setErrorMsg(null);
    setRestoring(true);
    try {
      await restorePurchases();
      onSubscribed();
    } catch {
      setErrorMsg(t("paywall.errRestore"));
    } finally {
      setRestoring(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={s.overlay}>
        <Pressable style={StyleSheet.absoluteFillObject} onPress={onClose} />
        <View style={s.sheet}>
          <TouchableOpacity style={s.closeBtn} onPress={onClose} hitSlop={12}>
            <Text style={s.closeIcon}>✕</Text>
          </TouchableOpacity>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scrollContent}>
            <View style={s.crownWrap}>
              <Text style={s.crownIcon}>👑</Text>
            </View>
            <Text style={s.title}>{t("paywall.title")}</Text>
            <Text style={s.subtitle}>{t("paywall.subtitle")}</Text>

            <View style={s.features}>
              {FEATURE_KEYS.map((key) => (
                <View key={key} style={s.featureRow}>
                  <Text style={s.featureCheck}>✓</Text>
                  <Text style={s.featureText}>{t(`paywall.${key}`)}</Text>
                </View>
              ))}
            </View>

            {!!errorMsg && (
              <View style={s.errorBox}>
                <Text style={s.errorText}>⚠ {errorMsg}</Text>
              </View>
            )}

            {loadingPkg ? (
              <ActivityIndicator size="small" color="#F59E0B" style={{ marginVertical: 20 }} />
            ) : pkg ? (
              <>
                <TouchableOpacity style={s.subscribeBtn} onPress={handleSubscribe} disabled={subscribing}>
                  {subscribing ? (
                    <ActivityIndicator size="small" color="#000" />
                  ) : (
                    <Text style={s.subscribeBtnText}>
                      {t("paywall.subscribeBtn")} · {pkg.product.priceString}
                    </Text>
                  )}
                </TouchableOpacity>
                <Text style={s.disclosure}>
                  {t("paywall.disclosure").replace("{price}", pkg.product.priceString)}
                </Text>
              </>
            ) : (
              <Text style={s.comingSoon}>{t("paywall.comingSoon")}</Text>
            )}

            <TouchableOpacity style={s.restoreBtn} onPress={handleRestore} disabled={restoring}>
              {restoring ? (
                <ActivityIndicator size="small" color="#6B7280" />
              ) : (
                <Text style={s.restoreBtnText}>{t("paywall.restoreBtn")}</Text>
              )}
            </TouchableOpacity>

            <View style={s.legalRow}>
              <Text style={s.legalLink} onPress={() => Linking.openURL(TERMS_URL)}>
                {t("paywall.termsLink")}
              </Text>
              <Text style={s.legalDot}>·</Text>
              <Text style={s.legalLink} onPress={() => Linking.openURL(PRIVACY_URL)}>
                {t("paywall.privacyLink")}
              </Text>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.7)",
    justifyContent: "flex-end",
  },
  sheet: {
    maxHeight: "88%",
    backgroundColor: "#0D0D0D",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    borderColor: "#1A1A1A",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -12 },
    shadowOpacity: 0.6,
    shadowRadius: 40,
    elevation: 16,
  },
  closeBtn: {
    position: "absolute",
    top: 14,
    right: 14,
    zIndex: 1,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#161616",
    borderWidth: 1,
    borderColor: "#242424",
    justifyContent: "center",
    alignItems: "center",
  },
  closeIcon: { fontSize: 14, color: "#9CA3AF", fontWeight: "700" },

  scrollContent: { padding: 24, paddingTop: 32, alignItems: "center" },

  crownWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "#F59E0B1F",
    borderWidth: 1,
    borderColor: "#F59E0B4D",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
  },
  crownIcon: { fontSize: 30 },

  title: { fontSize: 20, fontWeight: "900", color: "#FFFFFF", textAlign: "center", letterSpacing: 0.5 },
  subtitle: {
    fontSize: 13,
    color: "#9CA3AF",
    textAlign: "center",
    lineHeight: 19,
    marginTop: 8,
    marginBottom: 20,
  },

  features: { width: "100%", gap: 12, marginBottom: 8 },
  featureRow: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  featureCheck: { fontSize: 13, fontWeight: "900", color: "#F59E0B", marginTop: 1 },
  featureText: { flex: 1, fontSize: 13, color: "#D1D5DB", lineHeight: 19 },

  errorBox: {
    width: "100%",
    backgroundColor: "rgba(239,68,68,0.1)",
    borderWidth: 1,
    borderColor: "#EF4444",
    borderRadius: 8,
    padding: 12,
    marginTop: 20,
  },
  errorText: { color: "#EF4444", fontSize: 12 },

  subscribeBtn: {
    width: "100%",
    height: 52,
    borderRadius: 12,
    backgroundColor: "#F59E0B",
    justifyContent: "center",
    alignItems: "center",
    marginTop: 24,
  },
  subscribeBtnText: { fontSize: 14, fontWeight: "900", color: "#000000", letterSpacing: 0.5 },
  disclosure: {
    fontSize: 10,
    color: "#4B5563",
    textAlign: "center",
    lineHeight: 14,
    marginTop: 10,
    paddingHorizontal: 8,
  },
  comingSoon: { fontSize: 12, color: "#4B5563", marginTop: 24, marginBottom: 4 },

  restoreBtn: { alignItems: "center", paddingVertical: 14, marginTop: 4 },
  restoreBtnText: {
    fontSize: 11,
    fontWeight: "800",
    color: "#6B7280",
    letterSpacing: 0.5,
    textDecorationLine: "underline",
  },

  legalRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 4 },
  legalLink: { fontSize: 10, color: "#4B5563", textDecorationLine: "underline" },
  legalDot: { fontSize: 10, color: "#2A2A2A" },
});
