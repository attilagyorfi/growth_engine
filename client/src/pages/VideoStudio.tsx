import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import {
  Video, Sparkles, Clock, CheckCircle2, XCircle, Loader2,
  Play, Lock, Crown, RefreshCw, Film
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

// ─── Pro Gate Banner ──────────────────────────────────────────────────────────
function ProGateBanner() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6 text-center px-4">
      <div className="w-20 h-20 rounded-full bg-purple-500/10 flex items-center justify-center">
        <Crown className="w-10 h-10 text-purple-400" />
      </div>
      <div>
        <h2 className="text-2xl font-bold text-white mb-2">AI Videókészítő</h2>
        <p className="text-slate-400 max-w-md">
          Az AI avatar videókészítő funkció <strong className="text-purple-400">Pro</strong> és{" "}
          <strong className="text-purple-400">Agency</strong> csomagban érhető el.
          Készíts professzionális marketing videókat percek alatt, valódi forgatás nélkül.
        </p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-2xl w-full text-left">
        {[
          { icon: "🎭", title: "AI Avatar", desc: "Válassz több tucat professzionális avatar közül" },
          { icon: "🎙️", title: "Magyar hang", desc: "Természetes szövegfelolvasás magyar nyelven" },
          { icon: "📅", title: "5 videó/hó", desc: "Pro csomagban havonta 5 videó, Agency-ben korlátlan" },
        ].map(f => (
          <div key={f.title} className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
            <div className="text-2xl mb-2">{f.icon}</div>
            <div className="font-semibold text-white text-sm">{f.title}</div>
            <div className="text-slate-400 text-xs mt-1">{f.desc}</div>
          </div>
        ))}
      </div>
      <Button className="bg-purple-600 hover:bg-purple-700 text-white gap-2" size="lg">
        <Crown className="w-4 h-4" />
        Váltás Pro csomagra
      </Button>
    </div>
  );
}

// ─── Video Status Badge ───────────────────────────────────────────────────────
function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; className: string; icon: React.ReactNode }> = {
    pending: { label: "Várakozik", className: "bg-yellow-500/20 text-yellow-300 border-yellow-500/30", icon: <Clock className="w-3 h-3" /> },
    processing: { label: "Generálás...", className: "bg-blue-500/20 text-blue-300 border-blue-500/30", icon: <Loader2 className="w-3 h-3 animate-spin" /> },
    completed: { label: "Kész", className: "bg-green-500/20 text-green-300 border-green-500/30", icon: <CheckCircle2 className="w-3 h-3" /> },
    failed: { label: "Hiba", className: "bg-red-500/20 text-red-300 border-red-500/30", icon: <XCircle className="w-3 h-3" /> },
  };
  const s = map[status] ?? map.pending;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${s.className}`}>
      {s.icon}{s.label}
    </span>
  );
}

// ─── Create Video Modal ───────────────────────────────────────────────────────
function CreateVideoModal({ open, onClose, onCreated }: {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [title, setTitle] = useState("");
  const [script, setScript] = useState("");
  const [avatarId, setAvatarId] = useState("default");
  const [voiceId, setVoiceId] = useState("default");

  const { data: avatarData } = trpc.heygen.listAvatars.useQuery(undefined, { enabled: open });
  const { data: voiceData } = trpc.heygen.listVoices.useQuery({ language: "hu" }, { enabled: open });
  const { data: enabledData } = trpc.heygen.isEnabled.useQuery(undefined, { enabled: open });

  const createMutation = trpc.heygen.createVideo.useMutation({
    onSuccess: (data) => {
      if (data.demoMode) {
        toast.success("Videó mentve (demo mód)", { description: "Az API kulcs megadása után a videó ténylegesen el fog készülni." });
      } else {
        toast.success("Videó generálás elindítva!", { description: "A videó elkészítése 2-5 percet vesz igénybe." });
      }
      onCreated();
      onClose();
      setTitle(""); setScript(""); setAvatarId("default"); setVoiceId("default");
    },
    onError: (err) => toast.error("Hiba", { description: err.message }),
  });

  const isDemoMode = !enabledData?.enabled;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="bg-slate-900 border-slate-700 text-white max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Film className="w-5 h-5 text-purple-400" />
            Új AI videó készítése
          </DialogTitle>
          <DialogDescription className="text-slate-400">
            {isDemoMode
              ? "Demo mód – a videó adatai mentésre kerülnek, de a generálás csak API kulcs megadása után indul el."
              : "Válassz avatart és hangot, írd meg a szkriptet, és az AI elkészíti a videót."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          <div>
            <Label className="text-slate-300">Videó címe</Label>
            <Input
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="pl. Bemutatkozó videó – Q2 2026"
              className="bg-slate-800 border-slate-600 text-white mt-1"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-slate-300">Avatar</Label>
              <Select value={avatarId} onValueChange={setAvatarId}>
                <SelectTrigger className="bg-slate-800 border-slate-600 text-white mt-1">
                  <SelectValue placeholder="Válassz avatart" />
                </SelectTrigger>
                <SelectContent className="bg-slate-800 border-slate-700">
                  {isDemoMode || !avatarData?.avatars.length ? (
                    <SelectItem value="default">Alapértelmezett avatar</SelectItem>
                  ) : (
                    avatarData.avatars.slice(0, 20).map(a => (
                      <SelectItem key={a.avatar_id} value={a.avatar_id}>{a.avatar_name}</SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-slate-300">Hang</Label>
              <Select value={voiceId} onValueChange={setVoiceId}>
                <SelectTrigger className="bg-slate-800 border-slate-600 text-white mt-1">
                  <SelectValue placeholder="Válassz hangot" />
                </SelectTrigger>
                <SelectContent className="bg-slate-800 border-slate-700">
                  {isDemoMode || !voiceData?.voices.length ? (
                    <SelectItem value="default">Magyar hang</SelectItem>
                  ) : (
                    voiceData.voices.slice(0, 20).map(v => (
                      <SelectItem key={v.voice_id} value={v.voice_id}>{v.name} ({v.gender})</SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label className="text-slate-300">Szkript (amit az avatar felolvas)</Label>
            <Textarea
              value={script}
              onChange={e => setScript(e.target.value)}
              placeholder="Írj ide 30-120 másodpercnyi szöveget. Az avatar ezt fogja felolvasni természetes hangon..."
              className="bg-slate-800 border-slate-600 text-white mt-1 min-h-[140px] resize-none"
              maxLength={5000}
            />
            <div className="text-xs text-slate-500 mt-1 text-right">{script.length}/5000 karakter</div>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button variant="outline" onClick={onClose} className="border-slate-600 text-slate-300">
              Mégse
            </Button>
            <Button
              onClick={() => createMutation.mutate({ title, script, avatarId, voiceId })}
              disabled={!title.trim() || script.length < 10 || createMutation.isPending}
              className="bg-purple-600 hover:bg-purple-700 text-white gap-2"
            >
              {createMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              {isDemoMode ? "Mentés (demo)" : "Videó generálása"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main VideoStudio Page ────────────────────────────────────────────────────
export default function VideoStudio() {
  const [createOpen, setCreateOpen] = useState(false);
  const { data: enabledData, isLoading: enabledLoading } = trpc.heygen.isEnabled.useQuery();
  const { data: quotaData } = trpc.heygen.quotaStatus.useQuery();
  const { data: videosData, isLoading: videosLoading, refetch } = trpc.heygen.list.useQuery();

  // Auto-refresh if any video is still processing
  useEffect(() => {
    const hasProcessing = videosData?.videos.some(v => v.status === "processing" || v.status === "pending");
    if (!hasProcessing) return;
    const timer = setInterval(() => refetch(), 10_000);
    return () => clearInterval(timer);
  }, [videosData, refetch]);

  if (enabledLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-purple-400" />
      </div>
    );
  }

  if (!enabledData?.hasAccess) {
    return <ProGateBanner />;
  }

  const isDemoMode = !enabledData?.enabled;
  const videos = videosData?.videos ?? [];

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Video className="w-6 h-6 text-purple-400" />
            AI Videókészítő
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            Készíts professzionális marketing videókat AI avatarral, forgatás nélkül
          </p>
        </div>
        <div className="flex items-center gap-3">
          {quotaData && !quotaData.unlimited && !quotaData.noAccess && (
            <div className="text-sm text-slate-400 bg-slate-800 px-3 py-1.5 rounded-lg border border-slate-700">
              <span className="text-white font-medium">{quotaData.used}</span>/{quotaData.limit} videó felhasználva
            </div>
          )}
          {quotaData?.unlimited && (
            <Badge className="bg-purple-500/20 text-purple-300 border-purple-500/30">Korlátlan</Badge>
          )}
          <Button
            onClick={() => setCreateOpen(true)}
            disabled={quotaData?.noAccess || (quotaData?.remaining === 0)}
            className="bg-purple-600 hover:bg-purple-700 text-white gap-2"
          >
            <Sparkles className="w-4 h-4" />
            Új videó
          </Button>
        </div>
      </div>

      {/* Demo mode banner */}
      {isDemoMode && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 flex items-start gap-3">
          <Lock className="w-5 h-5 text-amber-400 mt-0.5 flex-shrink-0" />
          <div>
            <div className="text-amber-300 font-medium text-sm">Demo mód – HeyGen API kulcs szükséges</div>
            <div className="text-amber-400/70 text-xs mt-1">
              A videók adatai mentésre kerülnek, de a tényleges generálás a HeyGen API kulcs megadása után indul el.
              A kulcsot a Beállítások → Integrációk menüpontban adhatod meg.
            </div>
          </div>
        </div>
      )}

      {/* Video list */}
      {videosLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="bg-slate-800/50 rounded-xl h-48 animate-pulse border border-slate-700" />
          ))}
        </div>
      ) : videos.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 gap-4 text-center">
          <div className="w-16 h-16 rounded-full bg-slate-800 flex items-center justify-center">
            <Film className="w-8 h-8 text-slate-500" />
          </div>
          <div>
            <div className="text-white font-medium">Még nincs videód</div>
            <div className="text-slate-400 text-sm mt-1">Kattints az „Új videó" gombra az első AI videó elkészítéséhez</div>
          </div>
          <Button onClick={() => setCreateOpen(true)} className="bg-purple-600 hover:bg-purple-700 text-white gap-2 mt-2">
            <Sparkles className="w-4 h-4" />
            Első videó elkészítése
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {videos.map(video => (
            <Card key={video.id} className="bg-slate-800/50 border-slate-700 text-white overflow-hidden">
              {/* Thumbnail / placeholder */}
              <div className="aspect-video bg-slate-900 relative flex items-center justify-center">
                {video.thumbnailUrl ? (
                  <img src={video.thumbnailUrl} alt={video.title} className="w-full h-full object-cover" />
                ) : (
                  <div className="flex flex-col items-center gap-2 text-slate-600">
                    <Film className="w-10 h-10" />
                    <span className="text-xs">
                      {video.status === "processing" ? "Generálás folyamatban..." : "Előnézet nem elérhető"}
                    </span>
                  </div>
                )}
                {video.status === "completed" && video.videoUrl && (
                  <a
                    href={video.videoUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 hover:opacity-100 transition-opacity"
                  >
                    <div className="w-12 h-12 rounded-full bg-white/20 backdrop-blur flex items-center justify-center">
                      <Play className="w-6 h-6 text-white ml-1" />
                    </div>
                  </a>
                )}
                {video.status === "processing" && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                    <Loader2 className="w-8 h-8 text-purple-400 animate-spin" />
                  </div>
                )}
              </div>
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="font-medium text-sm truncate">{video.title}</div>
                    <div className="text-slate-400 text-xs mt-0.5">
                      {new Date(video.createdAt).toLocaleDateString("hu-HU")}
                      {video.durationSeconds && ` · ${video.durationSeconds}s`}
                    </div>
                  </div>
                  <StatusBadge status={video.status} />
                </div>
                {video.errorMessage && (
                  <div className="mt-2 text-xs text-red-400 bg-red-500/10 rounded p-2">{video.errorMessage}</div>
                )}
                {video.status === "completed" && video.videoUrl && (
                  <a
                    href={video.videoUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-3 flex items-center gap-1.5 text-xs text-purple-400 hover:text-purple-300 transition-colors"
                  >
                    <Play className="w-3 h-3" />
                    Videó megtekintése
                  </a>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Refresh button if processing */}
      {videos.some(v => v.status === "processing" || v.status === "pending") && (
        <div className="flex justify-center">
          <Button variant="outline" onClick={() => refetch()} className="border-slate-600 text-slate-300 gap-2">
            <RefreshCw className="w-4 h-4" />
            Státusz frissítése
          </Button>
        </div>
      )}

      <CreateVideoModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={() => refetch()}
      />
    </div>
  );
}
