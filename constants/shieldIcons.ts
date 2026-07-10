// Registry local dos ícones/emblemas de escudo disponíveis. O banco (cosmetics.preview.ref)
// guarda só a chave (ex.: "star"); o path SVG em si vive aqui. Todos os ícones usam o mesmo
// viewBox 0 0 24 24, centralizados, pra poderem ser escalados/posicionados de forma uniforme
// dentro de qualquer forma de escudo (components/ui/ShieldPreview.tsx).

export interface ShieldIconDef {
  viewBox: string;
  path: string;
}

export const SHIELD_ICON_VIEWBOX = "0 0 24 24";

export const DEFAULT_ICON_REF = "star";

export const SHIELD_ICONS: Record<string, ShieldIconDef> = {
  star: {
    viewBox: SHIELD_ICON_VIEWBOX,
    path: "M12 2l2.9 6.26L22 9.27l-5 4.87L18.18 22 12 18.27 5.82 22 7 14.14l-5-4.87 7.1-1.01L12 2z",
  },
  ball: {
    viewBox: SHIELD_ICON_VIEWBOX,
    path: "M12 2a10 10 0 1 0 .001 0z",
  },
  bolt: {
    viewBox: SHIELD_ICON_VIEWBOX,
    path: "M13 2L3 14h7l-1 8 11-14h-7l1-6z",
  },
  skull: {
    viewBox: SHIELD_ICON_VIEWBOX,
    path: "M12 2C7 2 4 5 4 9c0 2.5 1 4.5 2.5 6L6 20h3l.5-2h5l.5 2h3l-1.5-5c1.5-1.5 2.5-3.5 2.5-6 0-4-3-7-8-7zm-3 9a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3zm6 0a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3z",
  },
  crown: {
    viewBox: SHIELD_ICON_VIEWBOX,
    path: "M3 17l1.5-9L9 12l3-7 3 7 4.5-4L21 17H3zm0 2h18v2H3v-2z",
  },
  claw: {
    viewBox: SHIELD_ICON_VIEWBOX,
    path: "M4 4l3 16h2L6 4H4zm6 0l3 16h2l-3-16h-2zm6 0l3 16h2L19 4h-2z",
  },
  sword: {
    viewBox: SHIELD_ICON_VIEWBOX,
    path: "M14.5 2l-1 1 2 2-8 8-2-2-1 1 2 2-4 4 1 1 4-4 2 2 1-1-2-2 8-8 2 2 1-1-6-6z",
  },
  wings: {
    viewBox: SHIELD_ICON_VIEWBOX,
    path: "M2 12c4-6 8-6 10-2-2 4-6 6-10 2zm20 0c-4-6-8-6-10-2 2 4 6 6 10 2z",
  },
  dragon: {
    viewBox: SHIELD_ICON_VIEWBOX,
    path: "M2 14c2-4 6-8 10-8 1-2 3-3 5-2-1 1-1 2 0 3 3 1 5 4 5 7-2-1-4-1-5 1-2-1-4-1-5 1-3-3-7-2-10-2z",
  },
};
