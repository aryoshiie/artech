// src/lib/sync-prompt.ts
// Helper untuk sync Agent → prompt_library di Supabase
import { createClient } from "@supabase/supabase-js";

let supabaseClient: ReturnType<typeof createClient> | null = null;

function getSupabase() {
  if (supabaseClient) return supabaseClient;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  supabaseClient = createClient(url, key, { auth: { persistSession: false } });
  return supabaseClient;
}

export async function syncToPromptLibrary(agent: {
  id: string;
  name: string;
  role: string;
  systemPrompt: string | null;
  userPrompt: string | null;
  enabled: boolean;
}): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) {
    console.log("[syncToPromptLibrary] Supabase not configured, skip");
    return;
  }

  try {
    const { error } = await supabase
      .from("prompt_library")
      .upsert(
        {
          division: agent.name,
          agent_id: agent.id,
          role: agent.role,
          system_prompt: agent.systemPrompt,
          user_prompt: agent.userPrompt,
          active: agent.enabled,
        },
        { onConflict: "division" }
      );

    if (error) {
      console.error("[syncToPromptLibrary] Error:", error.message);
    } else {
      console.log(`[syncToPromptLibrary] ✅ ${agent.name} synced`);
    }
  } catch (e) {
    console.error("[syncToPromptLibrary] Exception:", e);
  }
}

export async function deleteFromPromptLibrary(agentId: string): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) return;

  try {
    const { error } = await supabase
      .from("prompt_library")
      .delete()
      .eq("agent_id", agentId);

    if (error) {
      console.error("[deleteFromPromptLibrary] Error:", error.message);
    } else {
      console.log(`[deleteFromPromptLibrary] ✅ agent ${agentId} deleted from prompt_library`);
    }
  } catch (e) {
    console.error("[deleteFromPromptLibrary] Exception:", e);
  }
}

export async function loadPromptLibrary(): Promise<any[]> {
  const supabase = getSupabase();
  if (!supabase) return [];

  try {
    const { data, error } = await supabase
      .from("prompt_library")
      .select("*")
      .order("division", { ascending: true });

    if (error) {
      console.error("[loadPromptLibrary] Error:", error.message);
      return [];
    }

    return data || [];
  } catch (e) {
    console.error("[loadPromptLibrary] Exception:", e);
    return [];
  }
}
