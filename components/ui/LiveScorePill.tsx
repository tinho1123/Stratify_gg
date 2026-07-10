import { MatchSource, useMatchLiveSession } from "@/hooks/useMatchLiveSession";
import React from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";

interface LiveScorePillProps {
  matchSource: MatchSource;
  matchId: string;
}

// Placar ao vivo compacto pras telas de Torneio/Desafios — a resolução agora é 100% autônoma
// (motor de partidas + pg_cron), então não existe mais um botão "assistir" que decide o
// resultado; isso só reflete o progresso já decidido no servidor, atualizando via Realtime
// (mesmo hook usado na tela de partida ao vivo da Liga).
export function LiveScorePill({ matchSource, matchId }: LiveScorePillProps) {
  const { loading, state, events } = useMatchLiveSession(matchSource, matchId);

  if (loading || !state) {
    return (
      <View style={s.pill}>
        <ActivityIndicator size="small" color="#EC4899" />
      </View>
    );
  }

  const roundEndEvents = events.filter((e) => e.event_type === "round_end");
  const last = roundEndEvents[roundEndEvents.length - 1]?.payload;
  const scoreA = last?.score_a ?? 0;
  const scoreB = last?.score_b ?? 0;

  return (
    <View style={s.pill}>
      <View style={s.dot} />
      <Text style={s.text}>
        AO VIVO · {scoreA} - {scoreB} · R{state.revealed_rounds}/{state.total_rounds}
      </Text>
    </View>
  );
}

const s = StyleSheet.create({
  pill: {
    width: "100%", flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6,
    height: 40, borderRadius: 8, marginTop: 4,
    backgroundColor: "#EC489922", borderWidth: 1, borderColor: "#EC489966",
  },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: "#EF4444" },
  text: { fontSize: 10, fontWeight: "900", color: "#EC4899", letterSpacing: 0.5 },
});
