/**
 * HeyGen API helper
 * Docs: https://docs.heygen.com/reference/create-an-avatar-video-v2
 *
 * When HEYGEN_API_KEY is not set, all methods return mock/disabled responses
 * so the UI can still be built and tested without a real key.
 */

const HEYGEN_BASE = "https://api.heygen.com";

function getApiKey(): string | null {
  return process.env.HEYGEN_API_KEY ?? null;
}

function heygenHeaders() {
  const key = getApiKey();
  if (!key) throw new Error("HEYGEN_API_KEY is not configured");
  return {
    "accept": "application/json",
    "content-type": "application/json",
    "x-api-key": key,
  };
}

export function isHeygenEnabled(): boolean {
  return !!getApiKey();
}

// ─── List Avatars ─────────────────────────────────────────────────────────────

export interface HeygenAvatar {
  avatar_id: string;
  avatar_name: string;
  gender: string;
  preview_image_url: string;
  preview_video_url?: string;
}

export async function listAvatars(): Promise<HeygenAvatar[]> {
  const res = await fetch(`${HEYGEN_BASE}/v2/avatars`, {
    headers: heygenHeaders(),
  });
  if (!res.ok) throw new Error(`HeyGen listAvatars failed: ${res.status}`);
  const json = await res.json() as { data: { avatars: HeygenAvatar[] } };
  return json.data?.avatars ?? [];
}

// ─── List Voices ─────────────────────────────────────────────────────────────

export interface HeygenVoice {
  voice_id: string;
  language: string;
  gender: string;
  name: string;
  preview_audio?: string;
}

export async function listVoices(language = "hu"): Promise<HeygenVoice[]> {
  const res = await fetch(`${HEYGEN_BASE}/v2/voices`, {
    headers: heygenHeaders(),
  });
  if (!res.ok) throw new Error(`HeyGen listVoices failed: ${res.status}`);
  const json = await res.json() as { data: { voices: HeygenVoice[] } };
  const voices = json.data?.voices ?? [];
  // Prefer matching language, fall back to all
  const filtered = voices.filter(v => v.language?.toLowerCase().startsWith(language));
  return filtered.length > 0 ? filtered : voices.slice(0, 20);
}

// ─── Create Video ─────────────────────────────────────────────────────────────

export interface CreateVideoParams {
  title: string;
  script: string;
  avatarId: string;
  voiceId: string;
  dimension?: { width: number; height: number };
}

export interface CreateVideoResult {
  videoId: string; // HeyGen's video_id
}

export async function createVideo(params: CreateVideoParams): Promise<CreateVideoResult> {
  const body = {
    title: params.title,
    caption: false,
    dimension: params.dimension ?? { width: 1280, height: 720 },
    video_inputs: [
      {
        character: {
          type: "avatar",
          avatar_id: params.avatarId,
          avatar_style: "normal",
        },
        voice: {
          type: "text",
          input_text: params.script,
          voice_id: params.voiceId,
        },
        background: {
          type: "color",
          value: "#1a1a2e",
        },
      },
    ],
  };

  const res = await fetch(`${HEYGEN_BASE}/v2/video/generate`, {
    method: "POST",
    headers: heygenHeaders(),
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`HeyGen createVideo failed: ${res.status} – ${errText}`);
  }

  const json = await res.json() as { data: { video_id: string } };
  return { videoId: json.data.video_id };
}

// ─── Get Video Status ─────────────────────────────────────────────────────────

export interface VideoStatus {
  videoId: string;
  status: "pending" | "processing" | "completed" | "failed";
  videoUrl?: string;
  thumbnailUrl?: string;
  durationSeconds?: number;
  error?: string;
}

export async function getVideoStatus(heygenVideoId: string): Promise<VideoStatus> {
  const res = await fetch(`${HEYGEN_BASE}/v1/video_status.get?video_id=${heygenVideoId}`, {
    headers: heygenHeaders(),
  });
  if (!res.ok) throw new Error(`HeyGen getVideoStatus failed: ${res.status}`);
  const json = await res.json() as {
    data: {
      video_id: string;
      status: string;
      video_url?: string;
      thumbnail_url?: string;
      duration?: number;
      error?: string;
    }
  };
  const d = json.data;
  const statusMap: Record<string, VideoStatus["status"]> = {
    pending: "pending",
    processing: "processing",
    completed: "completed",
    failed: "failed",
  };
  return {
    videoId: d.video_id,
    status: statusMap[d.status] ?? "processing",
    videoUrl: d.video_url,
    thumbnailUrl: d.thumbnail_url,
    durationSeconds: d.duration ? Math.round(d.duration) : undefined,
    error: d.error,
  };
}
