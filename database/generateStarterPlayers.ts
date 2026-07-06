import { supabase } from "@/database/supabase";

// A geração do elenco inicial roda inteiramente no servidor (RPC `generate_starter_players`,
// migration 026): o client não escreve mais `rating`/`salário` diretamente em `players` — essa
// escrita foi revogada porque nada limitava quantas vezes um client malicioso podia chamá-la
// nem os valores inseridos.
export async function generateStarterPlayers(): Promise<void> {
  await supabase.rpc("generate_starter_players");
}
