import { TeamShield } from "@/lib/shields";
import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { ShieldPreview } from "./ShieldPreview";

interface OpponentShieldProps {
  // undefined = ainda carregando; null = time sem escudo equipado ou adversário bot
  shield: TeamShield | null | undefined;
  size?: number;
}

// Escudo do time adversário. Quando não há dado resolvido (bot gerado pelo sistema, ou time real
// que nunca equipou um escudo completo — ver `get_teams_shields`/migration 068), cai num círculo
// genérico em vez de tentar montar um `ShieldPreview` com refs ausentes.
export function OpponentShield({ shield, size = 40 }: OpponentShieldProps) {
  if (shield) {
    return (
      <ShieldPreview
        shapeRef={shield.shape_ref}
        iconRef={shield.icon_ref}
        primaryColor={shield.primary_color}
        secondaryColor={shield.secondary_color}
        size={size}
      />
    );
  }

  return (
    <View style={[s.fallback, { width: size, height: size, borderRadius: size / 2 }]}>
      <Text style={{ fontSize: size * 0.5 }}>🤖</Text>
    </View>
  );
}

const s = StyleSheet.create({
  fallback: {
    backgroundColor: "#161616",
    borderWidth: 1,
    borderColor: "#242424",
    justifyContent: "center",
    alignItems: "center",
  },
});
