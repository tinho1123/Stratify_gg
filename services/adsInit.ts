import mobileAds from "react-native-google-mobile-ads";

// Extraído do app/_layout.tsx pra isolar o import de react-native-google-mobile-ads (que puxa
// BannerAd via barrel export e quebra o bundle web via codegenNativeComponent) atrás de um
// arquivo com variante .web.ts no-op. Ver ads.web.ts / RewardedAdButton.web.tsx pro mesmo padrão.
export async function initializeAds(): Promise<void> {
  await mobileAds().initialize();
}
