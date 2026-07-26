// src/app/api/agents/sync-registry/route.ts
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export const runtime = "nodejs";

export async function POST(_req: NextRequest) {
  try {
    const agents = await db.agent.findMany({
      select: { id: true, name: true, role: true, desc: true, systemPrompt: true, userPrompt: true, isActive: true },
    });

    let registryCount = 0;
    let promptCount = 0;

    for (const agent of agents) {
      try {
        await db.$executeRaw`
          INSERT INTO public.agent_registry (name, role, description, status)
          VALUES (${agent.name}, ${agent.role}, ${agent.desc}, ${agent.isActive})
          ON CONFLICT (name) DO UPDATE SET
            role = EXCLUDED.role,
            description = EXCLUDED.description,
            status = EXCLUDED.status,
            updated_at = NOW();
        `;
        registryCount++;
      } catch (e) {
        console.error(`[Sync Registry] Gagal sync ${agent.name}:`, e);
      }

      if (agent.systemPrompt) {
        try {
          await db.$executeRaw`
            INSERT INTO public.prompt_library (agent_name, role, system_prompt, user_prompt)
            VALUES (${agent.name}, ${agent.role}, ${agent.systemPrompt}, ${agent.userPrompt || ""})
            ON CONFLICT (agent_name) DO UPDATE SET
              role = EXCLUDED.role,
              system_prompt = EXCLUDED.system_prompt,
              user_prompt = EXCLUDED.user_prompt,
              updated_at = NOW();
          `;
          promptCount++;
        } catch (e) {
          console.error(`[Sync Prompt] Gagal sync ${agent.name}:`, e);
        }
      }
    }

    return NextResponse.json({
      success: true,
      message: `Sync selesai! ${registryCount} agent_registry + ${promptCount} prompt_library berhasil diupdate.`,
      registryCount,
      promptCount,
    });
  } catch (err: any) {
    console.error("[API POST /agents/sync-registry]", err);
    return NextResponse.json({ error: "Gagal sync", details: err?.message || String(err) }, { status: 500 });
  }
}
