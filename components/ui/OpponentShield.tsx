import { DEFAULT_ICON_REF } from "@/constants/shieldIcons";
import { DEFAULT_SHAPE_REF } from "@/constants/shieldShapes";
import { TeamShield } from "@/lib/shields";
import React from "react";
import { ShieldPreview } from "./ShieldPreview";

interface OpponentShieldProps {
  // undefined = ainda carregando; null = time sem escudo equipado ou adversário bot
  shield: TeamShield | null | undefined;
  size?: number;
}

// Cor de fallback pro escudo do primeiro slot (branco) — usada quando não há dado resolvido
// (bot gerado pelo sistema, ou time real que nunca equipou um escudo completo — ver
// `get_teams_shields`/migration 068). Em vez de um placeholder genérico sem relação com o
// design real, renderiza o mesmo `ShieldPreview` com a forma/ícone padrão do catálogo em branco.
const FALLBACK_PRIMARY_COLOR = "#FFFFFF";
const FALLBACK_SECONDARY_COLOR = "#E5E7EB";

export function OpponentShield({ shield, size = 40 }: OpponentShieldProps) {
  return (
    <ShieldPreview
      shapeRef={shield?.shape_ref ?? DEFAULT_SHAPE_REF}
      iconRef={shield?.icon_ref ?? DEFAULT_ICON_REF}
      primaryColor={shield?.primary_color ?? FALLBACK_PRIMARY_COLOR}
      secondaryColor={shield?.secondary_color ?? FALLBACK_SECONDARY_COLOR}
      size={size}
    />
  );
}
