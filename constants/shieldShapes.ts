// Registry local dos formatos de escudo disponíveis. O banco (cosmetics.preview.ref) guarda só
// a chave (ex.: "classic"); o path SVG em si vive aqui — nunca em dados vindos do servidor.
// Todas as formas compartilham o mesmo viewBox pra que o ícone central (constants/shieldIcons.ts)
// possa ser posicionado com uma única transform, igual pra qualquer forma escolhida.

export interface ShieldShapeDef {
  viewBox: string;
  path: string;
}

export const SHIELD_SHAPE_VIEWBOX = "0 0 100 120";

export const DEFAULT_SHAPE_REF = "classic";

export const SHIELD_SHAPES: Record<string, ShieldShapeDef> = {
  classic: {
    viewBox: SHIELD_SHAPE_VIEWBOX,
    path: "M10,8 L90,8 L90,58 C90,92 62,112 50,118 C38,112 10,92 10,58 Z",
  },
  circle: {
    viewBox: SHIELD_SHAPE_VIEWBOX,
    path: "M50,12 A48,48 0 1 1 49.99,12 Z",
  },
  hexagon: {
    viewBox: SHIELD_SHAPE_VIEWBOX,
    path: "M50,6 L92,33 L92,87 L50,114 L8,87 L8,33 Z",
  },
  pennant: {
    viewBox: SHIELD_SHAPE_VIEWBOX,
    path: "M20,8 L80,8 L80,60 L50,118 L20,60 Z",
  },
  arch: {
    viewBox: SHIELD_SHAPE_VIEWBOX,
    path: "M10,60 C10,25 10,8 50,8 C90,8 90,25 90,60 L90,90 C90,105 70,115 50,118 C30,115 10,105 10,90 Z",
  },
};
