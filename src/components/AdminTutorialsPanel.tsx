import { useState, useEffect } from "react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { Plus, Trash2, Video, Image as ImageIcon, Link as LinkIcon, Save, X, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { adminSaveTutorial, adminDeleteTutorial, listTutorials } from "@/lib/tutorials.functions";

import { useI18n } from "@/lib/i18n";
import { Edit } from "lucide-react";

export function AdminTutorialsPanel() {
  const { t } = useI18n();
  const [tutorials, setTutorials] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [current, setCurrent] = useState<any>({
    title: "",
    description: "",
    video_url: "",
    image_url: "",
    youtube_url: "",
    category: "general",
    is_active: true
  });
  const [uploading, setUploading] = useState(false);

  const saveFn = useServerFn(adminSaveTutorial);
  const deleteFn = useServerFn(adminDeleteTutorial);
  const listFn = useServerFn(listTutorials);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);
    try {
      const data = await listFn();
      setTutorials(data);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    if (!current.title) return toast.error("Título é obrigatório");
    if (!current.description) return toast.error("Descrição é obrigatória");
    if (!current.category) return toast.error("Categoria é obrigatória");
    if (!current.video_url && !current.youtube_url) return toast.error("É necessário um vídeo (upload ou link)");
    try {
      await saveFn({ data: current });
      toast.success("Tutorial salvo com sucesso!");
      setIsEditing(false);
      setCurrent({ title: "", description: "", video_url: "", image_url: "", youtube_url: "", category: "general", is_active: true });
      load();
    } catch (e: any) {
      toast.error(e.message);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Tem certeza que deseja excluir este tutorial?")) return;
    try {
      await deleteFn({ data: { id } });
      toast.success("Tutorial excluído");
      load();
    } catch (e: any) {
      toast.error(e.message);
    }
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>, type: 'video' | 'image') {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validations
    const MAX_VIDEO_SIZE = 100 * 1024 * 1024; // 100MB
    const MAX_IMAGE_SIZE = 5 * 1024 * 1024;   // 5MB
    const allowedVideoTypes = ['video/mp4', 'video/webm', 'video/ogg'];
    const allowedImageTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

    if (type === 'video') {
      if (!allowedVideoTypes.includes(file.type)) {
        return toast.error("Apenas vídeos MP4, WebM ou OGG são permitidos.");
      }
      if (file.size > MAX_VIDEO_SIZE) {
        return toast.error("O vídeo deve ter no máximo 100MB.");
      }
    } else {
      if (!allowedImageTypes.includes(file.type)) {
        return toast.error("Apenas imagens JPEG, PNG, WEBP ou GIF são permitidas.");
      }
      if (file.size > MAX_IMAGE_SIZE) {
        return toast.error("A imagem deve ter no máximo 5MB.");
      }
    }

    setUploading(true);
    try {
      const ext = file.name.split('.').pop();
      const path = `tutorials/${Date.now()}.${ext}`;
      
      const { data, error } = await supabase.storage.from('tutorials').upload(path, file);
      if (error) throw error;

      const { data: { publicUrl } } = supabase.storage.from('tutorials').getPublicUrl(path);
      
      setCurrent({ ...current, [type === 'video' ? 'video_url' : 'image_url']: publicUrl });
      toast.success(`${type === 'video' ? 'Vídeo' : 'Capa'} enviado com sucesso!`);
    } catch (e: any) {
      toast.error("Erro no upload: " + e.message);
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-xl font-bold tracking-tight text-foreground">Tutorials Hub</h3>
          <p className="text-sm text-muted-foreground">Gerencie os vídeos e guias para seus clientes.</p>
        </div>
        {!isEditing && (
          <Button onClick={() => setIsEditing(true)} className="gap-2">
            <Plus className="h-4 w-4" /> Novo Tutorial
          </Button>
        )}
      </div>

      {isEditing && (
        <Card className="border-primary/20 bg-card/50 backdrop-blur-sm">
          <CardHeader>
            <CardTitle>{current.id ? 'Editar Tutorial' : 'Novo Tutorial'}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <label className="text-xs font-mono uppercase tracking-widest text-muted-foreground">Título</label>
                <Input 
                  value={current.title} 
                  onChange={(e) => setCurrent({ ...current, title: e.target.value })}
                  placeholder="Ex: Como baixar o Shadow Signer"
                  className="bg-background/50"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-mono uppercase tracking-widest text-muted-foreground">Categoria</label>
                <Input 
                  value={current.category} 
                  onChange={(e) => setCurrent({ ...current, category: e.target.value })}
                  placeholder="general, play-protect, yaarsa"
                  className="bg-background/50"
                />
              </div>
            </div>
            
            <div className="space-y-2">
              <label className="text-xs font-mono uppercase tracking-widest text-muted-foreground">Descrição</label>
              <Textarea 
                value={current.description} 
                onChange={(e) => setCurrent({ ...current, description: e.target.value })}
                placeholder="Explique o que o tutorial ensina..."
                className="min-h-[100px] bg-background/50"
              />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <label className="text-xs font-mono uppercase tracking-widest text-muted-foreground">URL do Vídeo (Direto ou YouTube)</label>
                <div className="flex gap-2">
                  <Video className="h-5 w-5 mt-2 text-muted-foreground" />
                  <Input 
                    value={current.video_url || current.youtube_url} 
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val.includes("youtube.com") || val.includes("youtu.be")) {
                        setCurrent({ ...current, youtube_url: val, video_url: "" });
                      } else {
                        setCurrent({ ...current, video_url: val, youtube_url: "" });
                      }
                    }}
                    placeholder="https://..."
                    className="bg-background/50 text-xs"
                  />
                </div>
              </div>
              
              <div className="space-y-2">
                <label className="text-xs font-mono uppercase tracking-widest text-muted-foreground">URL da Thumbnail</label>
                <div className="flex gap-2">
                  <ImageIcon className="h-5 w-5 mt-2 text-muted-foreground" />
                  <Input 
                    value={current.image_url} 
                    onChange={(e) => setCurrent({ ...current, image_url: e.target.value })}
                    placeholder="https://.../thumb.jpg"
                    className="bg-background/50 text-xs"
                  />
                </div>
              </div>
            </div>
              
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-2">
                  <label className="text-xs font-mono uppercase tracking-widest text-primary font-bold flex justify-between">
                    Upload MP4 <span className="text-[10px] text-muted-foreground opacity-70">Max 100MB</span>
                  </label>
                  <Button variant="outline" className="w-full relative overflow-hidden h-10" disabled={uploading}>
                    <Video className="h-4 w-4 mr-2" />
                    {uploading ? "Sincronizando..." : "Selecionar Vídeo"}
                    <input 
                      type="file" 
                      accept="video/mp4,video/webm,video/ogg"
                      onChange={(e) => handleFileUpload(e, 'video')}
                      className="absolute inset-0 opacity-0 cursor-pointer"
                    />
                  </Button>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-mono uppercase tracking-widest text-primary font-bold flex justify-between">
                    Upload Capa <span className="text-[10px] text-muted-foreground opacity-70">Max 5MB</span>
                  </label>
                  <Button variant="outline" className="w-full relative overflow-hidden h-10" disabled={uploading}>
                    <ImageIcon className="h-4 w-4 mr-2" />
                    {uploading ? "Sincronizando..." : "Selecionar Foto"}
                    <input 
                      type="file" 
                      accept="image/*"
                      onChange={(e) => handleFileUpload(e, 'image')}
                      className="absolute inset-0 opacity-0 cursor-pointer"
                    />
                  </Button>
                </div>
              </div>


            <div className="flex justify-end gap-2 pt-4 border-t border-border/40">
              <Button variant="ghost" onClick={() => { setIsEditing(false); setCurrent({ title: "", description: "", video_url: "", image_url: "", youtube_url: "", category: "general", is_active: true }); }}>
                Cancelar
              </Button>
              <Button onClick={handleSave} className="gap-2 bg-primary hover:bg-primary/90">
                <Save className="h-4 w-4" /> Salvar Tutorial
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {tutorials.map((t) => (
          <Card key={t.id} className="group overflow-hidden border-border/40 bg-card/40 transition-all hover:border-primary/40">
            <div className="relative aspect-video w-full bg-muted overflow-hidden">
              {t.image_url ? (
                <img src={t.image_url} alt={t.title} className="h-full w-full object-cover transition-transform group-hover:scale-105" />
              ) : (
                <div className="flex h-full w-full items-center justify-center">
                  <Video className="h-10 w-10 text-muted-foreground/30" />
                </div>
              )}
              {!t.is_active && (
                <div className="absolute inset-0 bg-background/60 flex items-center justify-center backdrop-blur-[2px]">
                  <span className="text-[10px] font-mono uppercase bg-red-500/20 text-red-500 px-2 py-1 rounded">Desativado</span>
                </div>
              )}
            </div>
            <CardContent className="p-4">
              <div className="flex justify-between items-start gap-2">
                <h4 className="font-bold text-foreground line-clamp-1">{t.title}</h4>
                <div className="flex gap-1">
                  <Button size="icon" variant="ghost" className="h-8 w-8 text-primary hover:text-primary hover:bg-primary/20" onClick={() => { setCurrent(t); setIsEditing(true); window.scrollTo({ top: 0, behavior: 'smooth' }); }}>
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button size="icon" variant="ghost" className="h-8 w-8 text-red-500/70 hover:text-red-500" onClick={() => handleDelete(t.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{t.description}</p>
              <div className="mt-3 flex items-center justify-between text-[10px] font-mono uppercase tracking-widest text-muted-foreground/60">
                <span>{t.category}</span>
                {t.youtube_url && <LinkIcon className="h-3 w-3" />}
              </div>
            </CardContent>
          </Card>
        ))}

        {loading && [1, 2, 3].map((i) => (
          <div key={i} className="aspect-video rounded-xl bg-muted animate-pulse" />
        ))}

        {!loading && tutorials.length === 0 && (
          <div className="col-span-full py-12 text-center">
            <Video className="h-12 w-12 mx-auto text-muted-foreground/20" />
            <h4 className="mt-4 font-medium text-muted-foreground">Nenhum tutorial cadastrado.</h4>
          </div>
        )}
      </div>
    </div>
  );
}
