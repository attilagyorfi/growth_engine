import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useProfile } from "@/contexts/ProfileContext";
import DashboardLayout from "@/components/DashboardLayout";
import UpgradePrompt from "@/components/UpgradePrompt";
import { useSubscription } from "@/hooks/useSubscription";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Plus, Target, Zap, Calendar, BarChart2, Loader2, Trash2, Edit2, ChevronRight, Megaphone } from "lucide-react";
import { EmptyState } from "@/components/EmptyState";

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  draft: { label: "Vázlat", color: "bg-gray-100 text-gray-700" },
  active: { label: "Aktív", color: "bg-green-100 text-green-700" },
  paused: { label: "Szüneteltetve", color: "bg-yellow-100 text-yellow-700" },
  completed: { label: "Befejezett", color: "bg-blue-100 text-blue-700" },
  archived: { label: "Archivált", color: "bg-gray-100 text-gray-500" },
};

const CHANNELS = ["LinkedIn", "Facebook", "Instagram", "Email", "TikTok", "Google Ads", "YouTube", "Blog"];

export default function Campaigns() {
  const { activeProfile } = useProfile();
  const utils = trpc.useUtils();
  const subscription = useSubscription();

  const [showCreate, setShowCreate] = useState(false);
  const [selectedCampaign, setSelectedCampaign] = useState<string | null>(null);
  const [generatingBrief, setGeneratingBrief] = useState(false);
  const [form, setForm] = useState({
    title: "",
    objective: "",
    targetAudience: "",
    channels: [] as string[],
    budget: "",
    startDate: "",
    endDate: "",
    status: "draft" as const,
  });

  const { data: campaigns = [], isLoading } = trpc.campaigns.list.useQuery(
    { profileId: activeProfile.id },
    { enabled: !!activeProfile.id }
  );

  const { data: selectedCampaignData } = trpc.campaigns.get.useQuery(
    { id: selectedCampaign! },
    { enabled: !!selectedCampaign }
  );

  const { data: intelligence } = trpc.intelligence.get.useQuery(
    { profileId: activeProfile.id },
    { enabled: !!activeProfile.id }
  );

  const upsertMutation = trpc.campaigns.upsert.useMutation({
    onSuccess: () => {
      utils.campaigns.list.invalidate({ profileId: activeProfile.id });
      setShowCreate(false);
      resetForm();
      toast.success("Kampány mentve");
    },
  });

  const deleteMutation = trpc.campaigns.delete.useMutation({
    onSuccess: () => {
      utils.campaigns.list.invalidate({ profileId: activeProfile.id });
      setSelectedCampaign(null);
      toast.success("Kampány törölve");
    },
  });

  const generateBriefMutation = trpc.campaigns.generateBrief.useMutation({
    onSuccess: (brief) => {
      toast.success("Brief generálva! Az AI elkészítette a kampány briefet.");
      // Save campaign with generated brief
      upsertMutation.mutate({
        ...form,
        profileId: activeProfile.id,
        brief,
      });
    },
    onError: () => {
      setGeneratingBrief(false);
      toast.error("Nem sikerült a brief generálása.");
    },
  });

  const [generatingContent, setGeneratingContent] = useState(false);

  const generateContentMutation = trpc.campaigns.generateContentFromBrief.useMutation({
    onSuccess: (result) => {
      setGeneratingContent(false);
      toast.success(`${result.created} tartalom létrehozva a Content Studio-ban!`);
    },
    onError: () => {
      setGeneratingContent(false);
      toast.error("Nem sikerült a tartalmak generálása.");
    },
  });

  function handleGenerateContent(campaign: typeof selectedCampaignData) {
    if (!campaign?.brief) {
      toast.error("Először generálj kampány briefet!");
      return;
    }
    setGeneratingContent(true);
    generateContentMutation.mutate({
      profileId: activeProfile.id,
      campaignId: campaign.id,
      campaignTitle: campaign.title,
      brief: campaign.brief,
    });
  }

  function resetForm() {
    setForm({ title: "", objective: "", targetAudience: "", channels: [], budget: "", startDate: "", endDate: "", status: "draft" });
  }

  function toggleChannel(ch: string) {
    setForm(f => ({
      ...f,
      channels: f.channels.includes(ch) ? f.channels.filter(c => c !== ch) : [...f.channels, ch],
    }));
  }

  function handleSubmit(withBrief = false) {
    if (!form.title.trim()) {
      toast.error("Adj meg egy kampánynevet!");
      return;
    }
    if (withBrief) {
      setGeneratingBrief(true);
      generateBriefMutation.mutate({
        profileId: activeProfile.id,
        campaignTitle: form.title,
        objective: form.objective,
        targetAudience: form.targetAudience,
        channels: form.channels,
        intelligenceData: intelligence ?? undefined,
      });
    } else {
      upsertMutation.mutate({ ...form, profileId: activeProfile.id });
    }
  }

  const activeCampaigns = campaigns.filter(c => c.status === "active");
  const draftCampaigns = campaigns.filter(c => c.status === "draft");

  // Feature gate: Campaigns requires Pro plan or above
  if (!subscription.canUseCampaigns) {
    return (
      <DashboardLayout>
        <div className="p-6">
          <UpgradePrompt
            feature="Kampány Builder"
            requiredPlan="pro"
            description="A Kampány Builder Pro csomagtól érhető el. Hozz létre AI-alapú marketing kampányokat, automatikusan generálj tartalmakat és kövesd nyomon a kampány teljesítményét."
          />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Kampányok</h1>
            <p className="text-muted-foreground text-sm mt-1">Tervezd meg és kövesd nyomon marketing kampányaidat</p>
          </div>
          <Button onClick={() => setShowCreate(true)} className="gap-2">
            <Plus className="w-4 h-4" />
            Új kampány
          </Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: "Összes kampány", value: campaigns.length, icon: Megaphone, color: "text-blue-600" },
            { label: "Aktív", value: activeCampaigns.length, icon: Zap, color: "text-green-600" },
            { label: "Vázlat", value: draftCampaigns.length, icon: Edit2, color: "text-yellow-600" },
            { label: "Befejezett", value: campaigns.filter(c => c.status === "completed").length, icon: BarChart2, color: "text-purple-600" },
          ].map(stat => (
            <Card key={stat.label}>
              <CardContent className="p-4 flex items-center gap-3">
                <stat.icon className={`w-8 h-8 ${stat.color}`} />
                <div>
                  <div className="text-2xl font-bold">{stat.value}</div>
                  <div className="text-xs text-muted-foreground">{stat.label}</div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Campaign List */}
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : campaigns.length === 0 ? (
          <Card>
            <CardContent>
              <EmptyState
                icon={<Megaphone className="w-12 h-12" />}
                title="Még nincs kampányod"
                description="Hozd létre az első kampányodat – az AI segít összeállítani a briefet és a tartalmat."
                action={
                  <Button onClick={() => setShowCreate(true)} className="gap-2">
                    <Plus className="w-4 h-4" />
                    Első kampány létrehozása
                  </Button>
                }
              />
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4">
            {campaigns.map(campaign => {
              const status = STATUS_LABELS[campaign.status ?? "draft"];
              return (
                <Card
                  key={campaign.id}
                  className="cursor-pointer hover:shadow-md transition-shadow"
                  onClick={() => setSelectedCampaign(campaign.id)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                          <Target className="w-5 h-5 text-primary" />
                        </div>
                        <div>
                          <div className="font-semibold">{campaign.title}</div>
                          <div className="text-sm text-muted-foreground">
                            {campaign.objective || "Nincs megadva célkitűzés"}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        {campaign.channels && Array.isArray(campaign.channels) && (campaign.channels as string[]).length > 0 && (
                          <div className="hidden md:flex gap-1">
                            {(campaign.channels as string[]).slice(0, 3).map(ch => (
                              <Badge key={ch} variant="outline" className="text-xs">{ch}</Badge>
                            ))}
                            {(campaign.channels as string[]).length > 3 && (
                              <Badge variant="outline" className="text-xs">+{(campaign.channels as string[]).length - 3}</Badge>
                            )}
                          </div>
                        )}
                        <span className={`text-xs px-2 py-1 rounded-full font-medium ${status.color}`}>
                          {status.label}
                        </span>
                        <ChevronRight className="w-4 h-4 text-muted-foreground" />
                      </div>
                    </div>
                    {campaign.brief && (
                      <div className="mt-3 pt-3 border-t grid grid-cols-3 gap-4 text-sm">
                        <div>
                          <span className="text-muted-foreground">Hook:</span>
                          <p className="truncate">{(campaign.brief as any).hook}</p>
                        </div>
                        <div>
                          <span className="text-muted-foreground">CTA:</span>
                          <p className="truncate">{(campaign.brief as any).cta}</p>
                        </div>
                        <div>
                          <span className="text-muted-foreground">KPI-k:</span>
                          <p className="truncate">{((campaign.brief as any).kpis ?? []).length} db</p>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Create Campaign Dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Új kampány létrehozása</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label>Kampány neve *</Label>
              <Input
                placeholder="pl. Q2 LinkedIn Lead Generation"
                value={form.title}
                onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
              />
            </div>
            <div>
              <Label>Célkitűzés</Label>
              <Textarea
                placeholder="Mit szeretnél elérni ezzel a kampánnyal?"
                value={form.objective}
                onChange={e => setForm(f => ({ ...f, objective: e.target.value }))}
                rows={2}
              />
            </div>
            <div>
              <Label>Célközönség</Label>
              <Input
                placeholder="pl. KKV tulajdonosok, 30-50 év, B2B"
                value={form.targetAudience}
                onChange={e => setForm(f => ({ ...f, targetAudience: e.target.value }))}
              />
            </div>
            <div>
              <Label>Csatornák</Label>
              <div className="flex flex-wrap gap-2 mt-1">
                {CHANNELS.map(ch => (
                  <button
                    key={ch}
                    type="button"
                    onClick={() => toggleChannel(ch)}
                    className={`px-3 py-1 rounded-full text-sm border transition-colors ${
                      form.channels.includes(ch)
                        ? "bg-primary text-primary-foreground border-primary"
                        : "border-border hover:border-primary"
                    }`}
                  >
                    {ch}
                  </button>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Kezdés dátuma</Label>
                <Input type="date" value={form.startDate} onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))} />
              </div>
              <div>
                <Label>Befejezés dátuma</Label>
                <Input type="date" value={form.endDate} onChange={e => setForm(f => ({ ...f, endDate: e.target.value }))} />
              </div>
            </div>
            <div>
              <Label>Státusz</Label>
              <Select value={form.status} onValueChange={v => setForm(f => ({ ...f, status: v as any }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="draft">Vázlat</SelectItem>
                  <SelectItem value="active">Aktív</SelectItem>
                  <SelectItem value="paused">Szüneteltetve</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowCreate(false)}>Mégse</Button>
            <Button
              variant="outline"
              onClick={() => handleSubmit(false)}
              disabled={upsertMutation.isPending}
            >
              Mentés brief nélkül
            </Button>
            <Button
              onClick={() => handleSubmit(true)}
              disabled={generatingBrief || generateBriefMutation.isPending}
              className="gap-2"
            >
              {(generatingBrief || generateBriefMutation.isPending) ? (
                <><Loader2 className="w-4 h-4 animate-spin" />AI Brief generálása...</>
              ) : (
                <><Zap className="w-4 h-4" />AI Brief generálása</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Campaign Detail Dialog */}
      <Dialog open={!!selectedCampaign} onOpenChange={() => setSelectedCampaign(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          {selectedCampaignData && (
            <>
              <DialogHeader>
                <div className="flex items-center justify-between">
                  <DialogTitle>{selectedCampaignData.title}</DialogTitle>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-destructive hover:text-destructive"
                    onClick={() => deleteMutation.mutate({ id: selectedCampaignData.id })}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </DialogHeader>
              <Tabs defaultValue="overview">
                <TabsList>
                  <TabsTrigger value="overview">Áttekintés</TabsTrigger>
                  <TabsTrigger value="brief">AI Brief</TabsTrigger>
                  <TabsTrigger value="assets">Eszközök</TabsTrigger>
                </TabsList>
                <TabsContent value="overview" className="space-y-4 pt-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-muted-foreground">Célkitűzés</Label>
                      <p className="mt-1">{selectedCampaignData.objective || "—"}</p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">Célközönség</Label>
                      <p className="mt-1">{selectedCampaignData.targetAudience || "—"}</p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">Csatornák</Label>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {(selectedCampaignData.channels as string[] ?? []).map(ch => (
                          <Badge key={ch} variant="outline">{ch}</Badge>
                        ))}
                      </div>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">Státusz</Label>
                      <div className="mt-1">
                        <span className={`text-xs px-2 py-1 rounded-full font-medium ${STATUS_LABELS[selectedCampaignData.status ?? "draft"]?.color}`}>
                          {STATUS_LABELS[selectedCampaignData.status ?? "draft"]?.label}
                        </span>
                      </div>
                    </div>
                  </div>
                </TabsContent>
                <TabsContent value="brief" className="pt-4">
                  {selectedCampaignData.brief ? (
                    <div className="space-y-4">
                      {[
                        { label: "Hook (Figyelem felkeltő)", key: "hook" },
                        { label: "Fő üzenet", key: "mainMessage" },
                        { label: "CTA (Cselekvésre ösztönzés)", key: "cta" },
                      ].map(({ label, key }) => (
                        <div key={key} className="p-3 bg-muted/50 rounded-lg">
                          <div className="text-xs font-medium text-muted-foreground uppercase mb-1">{label}</div>
                          <p>{(selectedCampaignData.brief as any)[key]}</p>
                        </div>
                      ))}
                      {(selectedCampaignData.brief as any).contentIdeas?.length > 0 && (
                        <div>
                          <div className="text-sm font-semibold mb-2">Tartalom ötletek</div>
                          <div className="space-y-2">
                            {(selectedCampaignData.brief as any).contentIdeas.map((idea: any, i: number) => (
                              <div key={i} className="flex items-center gap-3 p-2 border rounded">
                                <div className="flex-1 text-sm">{idea.title}</div>
                                <Badge variant="outline">{idea.platform}</Badge>
                                <Badge variant="secondary">{idea.format}</Badge>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      {(selectedCampaignData.brief as any).kpis?.length > 0 && (
                        <div>
                          <div className="text-sm font-semibold mb-2">KPI-k</div>
                          <div className="grid grid-cols-2 gap-2">
                            {(selectedCampaignData.brief as any).kpis.map((kpi: any, i: number) => (
                              <div key={i} className="p-2 border rounded text-sm">
                                <span className="text-muted-foreground">{kpi.label}:</span> <span className="font-medium">{kpi.target}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      <div className="mt-4 pt-4 border-t">
                        <Button
                          onClick={() => handleGenerateContent(selectedCampaignData)}
                          disabled={generatingContent || generateContentMutation.isPending}
                          className="w-full"
                          variant="default"
                        >
                          {(generatingContent || generateContentMutation.isPending) ? (
                            <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Tartalmak generálása...(max 5 db)</>
                          ) : (
                            <><Zap className="w-4 h-4 mr-2" />⚡ Tartalmak automatikus létrehozása a Content Studio-ban</>
                          )}
                        </Button>
                        <p className="text-xs text-muted-foreground mt-2 text-center">Az AI a brief alapján létrehozza a tartalmakat – ezek a Content Studio-ban lesznek elérhetők</p>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      <Zap className="w-8 h-8 mx-auto mb-2" />
                      <p>Ehhez a kampányhoz még nincs AI brief generálva.</p>
                      <p className="text-xs mt-1">Először hozz létre egy kampányt és generálj briefet!</p>
                    </div>
                  )}
                </TabsContent>
                <TabsContent value="assets" className="pt-4">
                  <div className="text-center py-8 text-muted-foreground">
                    <BarChart2 className="w-8 h-8 mx-auto mb-2" />
                    <p>Kampány eszközök hamarosan elérhetők.</p>
                  </div>
                </TabsContent>
              </Tabs>
            </>
          )}
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
