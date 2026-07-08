// Mesmo motivo do RewardedAdButton.web.tsx: importar qualquer coisa de
// react-native-google-mobile-ads (mesmo só TestIds) puxa o BannerAd via barrel export e quebra o
// bundle web. Web não carrega anúncios, então o unit id nunca é usado de fato — só precisa
// satisfazer o tipo de retorno.
export function getRewardedAdUnitId(): string {
  return "";
}
