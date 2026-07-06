// Cores/labels de status de jogador e faixa de cor por rating, compartilhadas entre o elenco do
// próprio time (dashboard) e o perfil público de outro time (team/[id]) — os valores precisam
// bater nos dois lugares, então ficam centralizados aqui em vez de duplicados.

export const STATUS_COLOR: Record<string, string> = {
  online:  "#10B981",
  injured: "#EF4444",
  banned:  "#F59E0B",
};

// Chaves de tradução — só fazem sentido no dashboard (elenco do próprio time mostra o rótulo);
// o perfil público de outro time mostra só o ponto colorido, sem o texto.
export const STATUS_LABEL_KEY: Record<string, string> = {
  online:  "dashboard.statusOnline",
  injured: "dashboard.statusInjured",
  banned:  "dashboard.statusBanned",
};

export function getRatingColor(rating: number): string {
  if (rating >= 90) return "#10B981";
  if (rating >= 75) return "#F59E0B";
  return "#EF4444";
}
