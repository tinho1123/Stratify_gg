import { supabase } from "@/database/supabase";
import { useCallback, useEffect, useState } from "react";

export type MatchSource = "league" | "tournament" | "challenge";

export interface MatchRosterPlayer {
  id: string;
  name: string;
  role: string;
}

export interface MatchLiveState {
  id: string;
  match_source: MatchSource;
  match_id: string;
  status: "scheduled" | "live" | "finalizing" | "played";
  roster_a: MatchRosterPlayer[];
  roster_b: MatchRosterPlayer[];
  total_rounds: number;
  revealed_rounds: number;
  kickoff_at: string | null;
  finalized_at: string | null;
}

export interface MatchEvent {
  id: string;
  round: number;
  seq: number;
  event_type: "round_start" | "kill" | "util" | "round_end" | "match_end";
  payload: any;
  revealed_at: string;
}

// Hidrata a sessão ao vivo de uma partida (Liga/Torneio/Desafio) e assina Realtime pros eventos
// novos — mesmo padrão já usado em chat/DMs/mercado (`supabase.channel(...).on("postgres_changes",
// ...).subscribe()` + `removeChannel` no cleanup). `matchId` é o id "canônico" da sessão: pra
// Liga é `matches.fixture_id` (compartilhado pelas duas linhas espelho), pra Torneio/Desafio é o
// próprio id da linha (já compartilhado pelos dois lados).
//
// Distinguir "ao vivo" de "replay" não precisa de heurística: é literalmente `state.status` —
// 'scheduled'/sem sessão ainda = tela de espera; 'live'/'finalizing' = hidrata os rounds já
// revelados e continua ouvindo novos; 'played' = resultado final já decidido, sem assinar nada.
export function useMatchLiveSession(matchSource: MatchSource, matchId: string | null | undefined) {
  const [loading, setLoading] = useState(true);
  const [state, setState] = useState<MatchLiveState | null>(null);
  const [events, setEvents] = useState<MatchEvent[]>([]);

  const load = useCallback(async () => {
    if (!matchId) {
      setLoading(false);
      return;
    }
    setLoading(true);

    const { data: stateData } = await supabase
      .from("match_live_state")
      .select("id, match_source, match_id, status, roster_a, roster_b, total_rounds, revealed_rounds, kickoff_at, finalized_at")
      .eq("match_source", matchSource)
      .eq("match_id", matchId)
      .maybeSingle();

    setState((stateData as MatchLiveState) ?? null);

    if (stateData) {
      const { data: eventsData } = await supabase
        .from("match_events")
        .select("id, round, seq, event_type, payload, revealed_at")
        .eq("match_source", matchSource)
        .eq("match_id", matchId)
        .order("round", { ascending: true })
        .order("seq", { ascending: true });
      setEvents((eventsData as MatchEvent[]) ?? []);
    } else {
      setEvents([]);
    }

    setLoading(false);
  }, [matchSource, matchId]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!matchId) return;

    const channel = supabase
      .channel(`match:${matchSource}:${matchId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "match_events", filter: `match_id=eq.${matchId}` },
        (payload) => {
          const row = payload.new as MatchEvent;
          setEvents((prev) =>
            prev.some((e) => e.id === row.id)
              ? prev
              : [...prev, row].sort((a, b) => a.round - b.round || a.seq - b.seq),
          );
        },
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "match_live_state", filter: `match_id=eq.${matchId}` },
        (payload) => {
          setState(payload.new as MatchLiveState);
        },
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "match_live_state", filter: `match_id=eq.${matchId}` },
        (payload) => {
          setState(payload.new as MatchLiveState);
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [matchSource, matchId]);

  const isScheduled = !state || state.status === "scheduled";
  const isLive = state?.status === "live" || state?.status === "finalizing";
  const isFinished = state?.status === "played";

  return { loading, state, events, isScheduled, isLive, isFinished, refresh: load };
}
