const SLOT_SUFFIXES = ["shape", "primary_color", "secondary_color", "icon"] as const;

// Um time/guilda "tem escudo completo" quando as 4 chaves de categoria (forma, cor primária,
// cor secundária, ícone) estão presentes em equipped_cosmetics.
export function hasCompleteShield(
  equipped: Record<string, string> | null | undefined,
  prefix: "shield_" | "guild_shield_" = "shield_",
): boolean {
  if (!equipped) return false;
  return SLOT_SUFFIXES.every((suffix) => !!equipped[`${prefix}${suffix}`]);
}
