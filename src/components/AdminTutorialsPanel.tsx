import { useState, useEffect, useRef } from "react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { Plus, Trash2, Video, Image as ImageIcon, Link as LinkIcon, Save, X, Eye, EyeOff, Edit, GripVertical, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { adminSaveTutorial, adminDeleteTutorial, listTutorials, updateTutorialOrder } from "@/lib/tutorials.functions";
import { useI18n } from "@/lib/i18n";
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent } from "@dnd-kit/core";
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy, rectSortingStrategy } from "@dnd-kit/sortable";
import { SortableTutorialCard } from "./SortableTutorialCard";

export function AdminTutorialsPanel() {
  const { t } = useI18n();
  const [tutorials, setTutorials] = useState<any[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);
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
  const [isOrdering, setIsOrdering] = useState(false);

  const saveFn = useServerFn(adminSaveTutorial);
  const deleteFn = useServerFn(adminDeleteTutorial);
  const listFn = useServerFn(listTutorials);
  const updateOrderFn = useServerFn(updateTutorialOrder);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

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
    if (!current.title?.trim()) return toast.error("Título é obrigatório");
    if (!current.description?.trim()) return toast.error("Descrição é obrigatória");
    if (!current.category?.trim()) return toast.error("Categoria é obrigatória");
    if (!current.video_url && !current.youtube_url) return toast.error("É necessário um vídeo (upload ou link)");
    try {
      await saveFn({ data: current });
      toast.success(current.id ? "Tutorial atualizado!" : "Tutorial criado!");
      setIsEditing(false);
      window.scrollTo({ top: 0, behavior: 'smooth' });
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

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldIndex = tutorials.findIndex((t) => t.id === active.id);
      const newIndex = tutorials.findIndex((t) => t.id === over.id);
      
      const newOrder = arrayMove(tutorials, oldIndex, newIndex);
      setTutorials(newOrder);

      // Save to server
      setIsOrdering(true);
      try {
        const orderData = newOrder.map((t, idx) => ({
          id: t.id,
          display_order: idx
        }));
        await updateOrderFn({ data: orderData });
        toast.success("Ordem atualizada!");
      } catch (e: any) {
        toast.error("Erro ao salvar ordem: " + e.message);
        load(); // Revert on error
      } finally {
        setIsOrdering(false);
      }
    }
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>, type: 'video' | 'image') {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validations
    const MAX_VIDEO_SIZE = 100 * 1024 * 1024; // 100MB
    const MAX_IMAGE_SIZE = 5 * 1024 * 1024;   // 5MB
    const allowedVideoTypes = ['video/mp4', 'video/webm', 'video/ogg', 'video/quicktime', 'video/x-matroska'];
    const allowedImageTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml'];

    if (type === 'video') {
      if (!allowedVideoTypes.includes(file.type)) {
        return toast.error("Apenas vídeos MP4, WebM, OGG, MOV ou MKV são permitidos.");
      }
      if (file.size > MAX_VIDEO_SIZE) {
        return toast.error("O vídeo deve ter no máximo 100MB.");
      }
    } else {
      if (!allowedImageTypes.includes(file.type)) {
        return toast.error("Apenas imagens JPEG, PNG, WEBP, GIF ou SVG são permitidas.");
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
    <div className="space-y-6" ref={scrollRef}>
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-xl font-bold tracking-tight text-foreground rgb-text animate-rgb-text">Centro de Treinamento</h3>
          <p className="text-sm text-muted-foreground">Gerencie os vídeos e guias para seus clientes.</p>
        </div>
        <div className="flex gap-2">
          {isOrdering && (
            <div className="flex items-center text-xs font-mono text-primary animate-pulse mr-2">
              <Loader2 className="h-3 w-3 mr-1 animate-spin" /> Salvando ordem...
            </div>
          )}
          {!isEditing && (
            <Button onClick={() => { setIsEditing(true); setCurrent({ title: "", description: "", video_url: "", image_url: "", youtube_url: "", category: "general", is_active: true }); }} className="gap-2">
              <Plus className="h-4 w-4" /> Novo Tutorial
            </Button>
          )}
        </div>
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
                    {uploading ? "Enviando..." : "Selecionar Vídeo"}
                    <input 
                      type="file" 
                      accept="video/mp4,video/webm,video/ogg,video/quicktime,video/x-matroska"
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
                    {uploading ? "Enviando..." : "Selecionar Foto"}
                    <input 
                      type="file" 
                      accept="image/*"
                      onChange={(e) => handleFileUpload(e, 'image')}
                      className="absolute inset-0 opacity-0 cursor-pointer"
                    />
                  </Button>
                </div>
              </div>


            {(current.video_url || current.youtube_url || current.image_url) && (
              <div className="grid gap-4 md:grid-cols-2 mt-4 p-4 rounded-lg bg-black/20 border border-primary/10">
                <div className="space-y-2">
                  <label className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">Preview da Mídia</label>
                  <div className="aspect-video relative rounded-md overflow-hidden bg-black/40 border border-border/50 flex items-center justify-center">
                    {current.youtube_url ? (
                      <iframe 
                        src={`https://www.youtube.com/embed/${current.youtube_url.includes('v=') ? current.youtube_url.split('v=')[1].split('&')[0] : current.youtube_url.split('/').pop()}`}
                        className="w-full h-full"
                        allowFullScreen
                      />
                    ) : current.video_url ? (
                      <video 
                        src={current.video_url} 
                        controls 
                        className="w-full h-full object-contain"
                      />
                    ) : (
                      <div className="text-muted-foreground/30 flex flex-col items-center">
                        <Video className="h-8 w-8 mb-2" />
                        <span className="text-[10px]">Nenhum vídeo selecionado</span>
                      </div>
                    )}
                  </div>
                </div>
                
                <div className="space-y-2">
                  <label className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">Preview da Capa</label>
                  <div className="aspect-video relative rounded-md overflow-hidden bg-black/40 border border-border/50 flex items-center justify-center">
                    {current.image_url ? (
                      <img 
                        src={current.image_url} 
                        alt="Preview" 
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="text-muted-foreground/30 flex flex-col items-center">
                        <ImageIcon className="h-8 w-8 mb-2" />
                        <span className="text-[10px]">Nenhuma capa selecionada</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

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

      <DndContext 
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <SortableContext 
            items={tutorials.map(t => t.id)}
            strategy={rectSortingStrategy}
          >
            {tutorials.map((t) => (
              <SortableTutorialCard 
                key={t.id} 
                t={t} 
                setCurrent={setCurrent} 
                setIsEditing={setIsEditing} 
                handleDelete={handleDelete} 
              />
            ))}
          </SortableContext>

          {loading && [1, 2, 3].map((i) => (
            <div key={i} className="aspect-video rounded-xl bg-muted animate-pulse" />
          ))}

          {!loading && tutorials.length === 0 && (
            <div className="col-span-full py-12 text-center">
              <Video className="h-12 w-12 mx-auto text-muted-foreground/20" />
              <h4 className="mt-4 font-medium text-muted-foreground">Nenhum tutorial encontrado.</h4>
            </div>
          )}
        </div>
      </DndContext>
    </div>
  );
}
