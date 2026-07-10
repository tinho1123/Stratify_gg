import Constants from "expo-constants";
import { useEffect, useState } from "react";
import { Platform } from "react-native";
import { supabase } from "@/database/supabase";

// Compara versões semver simples ("1.2.0" vs "1.10.0") — sem dependência externa.
function isOlderThan(current: string, min: string): boolean {
  const c = current.split(".").map(Number);
  const m = min.split(".").map(Number);
  for (let i = 0; i < Math.max(c.length, m.length); i++) {
    const cv = c[i] ?? 0;
    const mv = m[i] ?? 0;
    if (cv < mv) return true;
    if (cv > mv) return false;
  }
  return false;
}

export function useMinVersionCheck(): { checking: boolean; updateRequired: boolean } {
  const [checking, setChecking] = useState(true);
  const [updateRequired, setUpdateRequired] = useState(false);

  useEffect(() => {
    (async () => {
      const platform = Platform.OS === "ios" ? "ios" : "android";
      const currentVersion = Constants.expoConfig?.version ?? "0.0.0";

      const { data, error } = await supabase
        .from("app_min_version")
        .select("min_version")
        .eq("platform", platform)
        .single();

      // Falha de rede/consulta não deve travar o app — só bloqueia quando temos certeza
      // de que a versão instalada está abaixo da mínima exigida.
      if (!error && data) {
        setUpdateRequired(isOlderThan(currentVersion, data.min_version));
      }
      setChecking(false);
    })();
  }, []);

  return { checking, updateRequired };
}
