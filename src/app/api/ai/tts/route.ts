// src/app/api/ai/tts/route.ts — StreamElements TTS (no package needed)
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 10;

const VOICES: Record<string, string> = {
  male: "Brian",
  female: "Salli",
  neutral: "Matthew",
};

export async function POST(req: NextRequest) {
  try {
    const { text, gender = "male" } = await req.json();
    if (!text || typeof text !== "string") {
      return NextResponse.json({ error: "Text required" }, { status: 400 });
    }
    const cleanText = encodeURIComponent(text.slice(0, 500));
    const voice = VOICES[gender] || VOICES.male;
    const ttsUrl = `https://api.streamelements.com/kappa/v2/speech?voice=${voice}&text=${cleanText}`;
    
    const res = await fetch(ttsUrl);
    if (!res.ok) {
      return NextResponse.json({ error: "TTS failed" }, { status: 500 });
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
      { error: "TTS generation failed" },
      { status: 500 }
    );
  }
}
