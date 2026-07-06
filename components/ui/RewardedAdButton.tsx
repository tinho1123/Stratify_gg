import { useAppAlert } from "@/components/ui/AppAlert";
import { supabase } from "@/database/supabase";
import { useLanguage } from "@/i18n/LanguageContext";
import { getRewardedAdUnitId } from "@/services/ads";
import React, { useEffect, useRef } from "react";
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity } from "react-native";
import { useRewardedAd } from "react-native-google-mobile-ads";

// Botão opcional de "assistir vídeo pra ganhar créditos" — some sozinho se nenhum anúncio
// estiver disponível (ex. sem internet), em vez de mostrar um botão quebrado.
export function RewardedAdButton({ onRewardGranted }: { onRewardGranted?: (creditsGranted: number) => void }) {
  const { t } = useLanguage();
  const { alert } = useAppAlert();
  const rewarded = useRewardedAd(getRewardedAdUnitId());
  const grantingRef = useRef(false);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { rewarded.load(); }, [rewarded.load]);

  useEffect(() => {
    if (!rewarded.isEarnedReward || grantingRef.current) return;
    grantingRef.current = true;

    (async () => {
      const { data, error } = await supabase.rpc("grant_ad_reward");
      if (error) {
        const msg = error.message?.includes("cooldown_active") ? t("ads.errCooldown") : t("ads.errGeneric");
        alert(t("common.error"), msg);
      } else {
        const granted = (data as any)?.credits_granted ?? 0;
        onRewardGranted?.(granted);
        alert(t("ads.rewardTitle"), t("ads.rewardMsg").replace("{n}", String(granted)), "success");
      }
      grantingRef.current = false;
      rewarded.load(); // pré-carrega o próximo anúncio
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rewarded.isEarnedReward]);

  if (rewarded.error) return null;

  return (
    <TouchableOpacity style={s.btn} disabled={!rewarded.isLoaded} onPress={() => rewarded.show()}>
      {!rewarded.isLoaded ? (
        <ActivityIndicator size="small" color="#6366F1" />
      ) : (
        <>
          <Text style={s.icon}>🎬</Text>
          <Text style={s.text}>{t("ads.watchBtn")}</Text>
        </>
      )}
    </TouchableOpacity>
  );
}

const s = StyleSheet.create({
  btn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    backgroundColor: "#6366F122", borderWidth: 1, borderColor: "#6366F166",
    borderRadius: 10, paddingVertical: 12, height: 44,
  },
  icon: { fontSize: 14 },
  text: { fontSize: 12, fontWeight: "800", color: "#6366F1", letterSpacing: 0.5 },
});
