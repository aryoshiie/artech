// src/app/api/ai/tts/route.ts — Edge TTS (Microsoft Neural Voice)
import { MsEdgeTTS, OUTPUT_FORMAT } from "msedge-tts";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 10;

const VOICES: Record<string, string> = {
  male: "id-ID-ArdiNeural",
  female: "id-ID-GadisNeural",
  neutral: "id-ID-ArdiNeural",
};

export async function POST(req: NextRequest) {
  try {
    const { text, gender = "male" } = await req.json();
    if (!text || typeof text !== "string") {
      return NextResponse.json({ error: "Text required" }, { status: 400 });
    }
    const cleanText = text.slice(0, 500);
    const voice = VOICES[gender] || VOICES.male;
    const tts = new MsEdgeTTS();
    await tts.setMetadata(voice, OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3);
    const { audioStream } = tts.toStream(cleanText);
    const chunks: Buffer[] = [];
    for await (const chunk of audioStream) {
      chunks.push(Buffer.from(chunk));
    }
    tts.close();
    const audioBuffer = Buffer.concat(chunks);
    return new Response(audioBuffer, {
      headers: {
        "Content-Type": "audio/mpeg",
        "Cache-Control": "public, max-age=86400",
        "Content-Length": String(audioBuffer.length),
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
  const gender = url.searchParams.get("gender") || "male";
  try {
    const voice = VOICES[gender] || VOICES.male;
    const tts = new MsEdgeTTS();
    await tts.setMetadata(voice, OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3);
    const { audioStream } = tts.toStream(text.slice(0, 500));
    const chunks: Buffer[] = [];
    for await (const chunk of audioStream) {
      chunks.push(Buffer.from(chunk));
    }
    tts.close();
    const audioBuffer = Buffer.concat(chunks);
    return new Response(audioBuffer, {
      headers: { "Content-Type": "audio/mpeg", "Cache-Control": "public, max-age=86400" },
    });
  } catch (err: any) {
    return NextResponse.json({ error: "TTS failed", details: err?.message }, { status: 500 });
  }
}
