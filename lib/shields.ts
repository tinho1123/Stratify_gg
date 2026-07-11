import { supabase } from "@/database/supabase";

export interface TeamShield {
  shape_ref: string;
  icon_ref: string;
  primary_color: string;
  secondary_color: string;
}

// Busca o escudo (cosméticos equipados já resolvidos) de vários times de uma vez via
// `get_teams_shields` (migration 068). Times sem os 4 slots equipados ficam de fora do mapa
// resultante — quem renderiza deve tratar a ausência como "sem escudo" (fallback genérico, ex.:
// times adversários que são bots e não têm linha em `teams`).
export async function fetchTeamShields(teamIds: (string | null | undefined)[]): Promise<Record<string, TeamShield>> {
  const uniqueIds = [...new Set(teamIds.filter((id): id is string => !!id))];
  if (uniqueIds.length === 0) return {};

  const { data, error } = await supabase.rpc("get_teams_shields", { p_team_ids: uniqueIds });
  if (error || !data) return {};

  const map: Record<string, TeamShield> = {};
  for (const row of data as any[]) {
    if (row.shape_ref && row.icon_ref && row.primary_color && row.secondary_color) {
      map[row.team_id] = {
        shape_ref: row.shape_ref,
        icon_ref: row.icon_ref,
        primary_color: row.primary_color,
        secondary_color: row.secondary_color,
      };
    }
  }
  return map;
}
