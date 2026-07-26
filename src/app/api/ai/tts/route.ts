// src/app/api/ai/tts/route.ts — Google Translate TTS (no package needed)
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 10;

export async function POST(req: NextRequest) {
  try {
    const { text, gender = "male" } = await req.json();
    if (!text || typeof text !== "string") {
      return NextResponse.json({ error: "Text required" }, { status: 400 });
    }
    
    const cleanText = text.slice(0, 200);
    const encoded = encodeURIComponent(cleanText);
    const ttsUrl = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encoded}&tl=id&client=tw-ob`;
    
    const res = await fetch(ttsUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      },
    });
    
    if (!res.ok) {
      return NextResponse.json({ error: `TTS failed: HTTP ${res.status}` }, { status: 500 });
    }
    
    const audioBuffer = await res.arrayBuffer();
    
    return new Response(audioBuffer, {
      headers: {
        "Content-Type": "audio/mpeg",
        "Cache-Control": "public, max-age=86400",
      },
    });
  } catch (err: any) {
    console.error("[TTS] Error:", err?.message || err);
    return NextResponse.json(
      { error: "TTS generation failed", details: err?.message || String(err) },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const text = url.searchParams.get("text") || "Halo, ini test suara";
  
  try {
    const encoded = encodeURIComponent(text.slice(0, 200));
    const ttsUrl = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encoded}&tl=id&client=tw-ob`;
    
    const res = await fetch(ttsUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      },
    });
    
    if (!res.ok) {
      return NextResponse.json({ error: `TTS failed: HTTP ${res.status}` }, { status: 500 });
    }
    
    const audioBuffer = await res.arrayBuffer();
    
    return new Response(audioBuffer, {
      headers: {
        "Content-Type": "audio/mpeg",
        "Cache-Control": "public, max-age=86400",
      },
    });
  } catch (err: any) {
    return NextResponse.json({ error: "TTS failed", details: err?.message }, { status: 500 });
  }
}
