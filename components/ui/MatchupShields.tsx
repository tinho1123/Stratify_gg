import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { OpponentShield } from "./OpponentShield";
import { TeamShield } from "@/lib/shields";

interface MatchupShieldsProps {
  ownShield: TeamShield | null | undefined;
  opponentShield: TeamShield | null | undefined;
  size?: number;
}

// Badge de confronto: escudo do próprio time × escudo do adversário, usado nos cards de "cara a
// cara" (próxima partida, placar da partida) — não nas listas (histórico, desafios), que já
// mostram só o escudo do adversário por linha.
export function MatchupShields({ ownShield, opponentShield, size = 40 }: MatchupShieldsProps) {
  return (
    <View style={s.row}>
      <OpponentShield shield={ownShield} size={size} />
      <Text style={[s.x, { fontSize: size * 0.4 }]}>×</Text>
      <OpponentShield shield={opponentShield} size={size} />
    </View>
  );
}

const s = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 10 },
  x: { fontWeight: "900", color: "#4B5563" },
});
