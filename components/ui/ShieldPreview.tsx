import { DEFAULT_ICON_REF, SHIELD_ICONS } from "@/constants/shieldIcons";
import { DEFAULT_SHAPE_REF, SHIELD_SHAPES } from "@/constants/shieldShapes";
import React from "react";
import Svg, { G, Path } from "react-native-svg";

interface ShieldPreviewProps {
  shapeRef: string;
  primaryColor: string;
  secondaryColor: string;
  iconRef: string;
  size?: number;
}

// Ícones usam viewBox 0 0 24 24; todas as formas (constants/shieldShapes.ts) compartilham o
// mesmo viewBox 0 0 100 120, então essa transform única centraliza o ícone (escalado ~1.67x,
// ocupando 40x40 das 100x120 unidades) em qualquer forma escolhida.
const ICON_TRANSFORM = "translate(30,40) scale(1.6667)";

export function ShieldPreview({ shapeRef, primaryColor, secondaryColor, iconRef, size = 96 }: ShieldPreviewProps) {
  const shape = SHIELD_SHAPES[shapeRef] ?? SHIELD_SHAPES[DEFAULT_SHAPE_REF];
  const icon = SHIELD_ICONS[iconRef] ?? SHIELD_ICONS[DEFAULT_ICON_REF];

  return (
    <Svg width={size} height={size} viewBox={shape.viewBox}>
      <Path d={shape.path} fill={primaryColor} stroke={secondaryColor} strokeWidth={4} strokeLinejoin="round" />
      <G transform={ICON_TRANSFORM}>
        <Path d={icon.path} fill={secondaryColor} />
      </G>
    </Svg>
  );
}
