// O SDK react-native-google-mobile-ads reexporta BannerAd (que usa codegenNativeComponent) a
// partir do mesmo index de onde vem useRewardedAd, então qualquer import do pacote quebra o
// bundle web do Metro. O preview web é só pra screenshots — não precisa de anúncios reais — então
// esse botão simplesmente não renderiza nada nessa plataforma.
export function RewardedAdButton(_props: { onRewardGranted?: (creditsGranted: number) => void }) {
  return null;
}
