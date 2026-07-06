import { Platform } from "react-native";
import { TestIds } from "react-native-google-mobile-ads";

// Sem essas envs configuradas, usa os IDs de teste públicos do Google — sempre carregam um
// anúncio de exemplo, nunca um anúncio real (não dá pra veicular anúncio real sem conta AdMob
// aprovada e o app configurado lá). Troque pelas envs abaixo quando tiver isso pronto.
const IOS_REWARDED_UNIT_ID = process.env.EXPO_PUBLIC_ADMOB_REWARDED_IOS_UNIT_ID;
const ANDROID_REWARDED_UNIT_ID = process.env.EXPO_PUBLIC_ADMOB_REWARDED_ANDROID_UNIT_ID;

export function getRewardedAdUnitId(): string {
  const configured = Platform.OS === "ios" ? IOS_REWARDED_UNIT_ID : ANDROID_REWARDED_UNIT_ID;
  return configured || TestIds.REWARDED;
}
