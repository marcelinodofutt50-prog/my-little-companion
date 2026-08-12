import { useState, useEffect, useRef } from "react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { Plus, Trash2, Video, Image as ImageIcon, Link as LinkIcon, Save, X, Eye, EyeOff, Edit, GripVertical, Loader2 } from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { adminSaveTutorial, adminDeleteTutorial, listTutorials, updateTutorialOrder } from "@/lib/tutorials.functions";
import { createTutorialUploadUrl } from "@/lib/tutorial-upload.functions";
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
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isOrdering, setIsOrdering] = useState(false);
  const [isDraggingOver, setIsDraggingOver] = useState(false);

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

  const handleSave = async (retryCount = 0) => {
    if (!current.title?.trim() || current.title.trim().length < 3) return toast.error("Título é obrigatório (mín. 3 caracteres)");
    if (!current.description?.trim() || current.description.trim().length < 5) return toast.error("Descrição é obrigatória (mín. 5 caracteres)");
    if (!current.category?.trim() || current.category.trim().length < 2) return toast.error("Categoria é obrigatória (mín. 2 caracteres)");
    if (!current.video_url && !current.youtube_url) return toast.error("É necessário um vídeo (upload ou link)");

    const clean = (v: any) => (typeof v === "string" && v.trim() !== "" ? v.trim() : null);
    const youtube = clean(current.youtube_url);
    if (youtube && !/^https?:\/\//i.test(youtube)) {
      return toast.error("O link do YouTube precisa começar com https://");
    }

    const payload: Record<string, any> = {
      title: current.title.trim(),
      description: current.description.trim(),
      category: current.category.trim(),
      video_url: clean(current.video_url),
      image_url: clean(current.image_url),
      youtube_url: youtube,
      is_active: current.is_active !== false,
    };
    if (current.id) payload.id = current.id;
    if (typeof current.display_order === "number") payload.display_order = current.display_order;

    setLoading(true);
    try {
      await saveFn({ data: payload });
      toast.success(current.id ? "Tutorial atualizado!" : "Tutorial criado!");
      setIsEditing(false);
      window.scrollTo({ top: 0, behavior: 'smooth' });
      setCurrent({ title: "", description: "", video_url: "", image_url: "", youtube_url: "", category: "general", is_active: true });
      load();

    } catch (e: any) {
      console.error(`Save attempt ${retryCount + 1} failed:`, e);
      
      const MAX_RETRIES = 3;
      const isNetworkError = !navigator.onLine || e.message?.includes('fetch') || e.message?.includes('network');
      const isSchemaError = e.message?.includes('PGRST108') || e.message?.includes('schema cache');

      if (retryCount < MAX_RETRIES && (isNetworkError || isSchemaError)) {
        const delay = Math.pow(2, retryCount + 1) * 1000;
        toast.info(`Falha na publicação. Retentando em ${delay/1000}s...`);
        
        await new Promise(resolve => setTimeout(resolve, delay));
        return handleSave(retryCount + 1);
      }
      
      toast.error("Erro ao salvar tutorial: " + e.message);
    } finally {
      setLoading(false);
    }
  };

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

  const handleFileUpload = async (file: File, type: 'video' | 'image', retryCount = 0) => {
    if (!file) return;

    // Validations
    const MAX_VIDEO_SIZE = 500 * 1024 * 1024; // 500MB
    const MAX_IMAGE_SIZE = 10 * 1024 * 1024;   // 10MB
    const allowedVideoTypes = ['video/mp4', 'video/webm', 'video/ogg', 'video/quicktime', 'video/x-matroska'];
    const allowedImageTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml'];

    if (type === 'video') {
      if (!allowedVideoTypes.includes(file.type)) {
        return toast.error("Apenas vídeos MP4, WebM, OGG, MOV ou MKV são permitidos.");
      }
      if (file.size > MAX_VIDEO_SIZE) {
        return toast.error("O vídeo deve ter no máximo 500MB.");
      }
    } else {
      if (!allowedImageTypes.includes(file.type)) {
        return toast.error("Apenas imagens JPEG, PNG, WEBP, GIF ou SVG são permitidas.");
      }
      if (file.size > MAX_IMAGE_SIZE) {
        return toast.error("A imagem deve ter no máximo 10MB.");
      }
    }

    setUploading(true);
    setUploadProgress(0);
    
    // Progress simulation with decay
    const progressInterval = setInterval(() => {
      setUploadProgress(prev => {
        if (prev >= 98) return 98;
        const increment = Math.max(0.1, (100 - prev) / 30);
        return parseFloat((prev + increment).toFixed(1));
      });
    }, 300);

    try {
      // URL assinada gerada no servidor: independe das policies de storage.
      const signed = await createTutorialUploadUrl({
        data: { filename: file.name, kind: type },
      });

      const { error } = await supabase.storage
        .from('tutorials')
        .uploadToSignedUrl(signed.path, signed.token, file, {
          contentType: file.type || undefined,
        });

      if (error) throw error;

      const publicUrl = signed.publicUrl;
      
      clearInterval(progressInterval);
      setUploadProgress(100);
      
      setCurrent((prev: any) => ({ ...prev, [type === 'video' ? 'video_url' : 'image_url']: publicUrl }));
      toast.success(`${type === 'video' ? 'Vídeo' : 'Capa'} enviado com sucesso!`);
    } catch (e: any) {
      clearInterval(progressInterval);
      console.error(`Upload attempt ${retryCount + 1} failed:`, e);
      
      const MAX_RETRIES = 3;
      if (retryCount < MAX_RETRIES) {
        // Exponential backoff: 2s, 4s, 8s...
        const delay = Math.pow(2, retryCount + 1) * 1000;
        toast.info(`Falha no upload. Tentativa ${retryCount + 1}/${MAX_RETRIES} em ${delay/1000}s...`);
        
        await new Promise(resolve => setTimeout(resolve, delay));
        return handleFileUpload(file, type, retryCount + 1);
      }
      
      toast.error("Erro crítico no upload: " + e.message);
    } finally {
      if (retryCount === 0 || !uploading) {
        setTimeout(() => {
          setUploading(false);
          setUploadProgress(0);
        }, 800);
      }
    }
  };

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingOver(true);
  };

  const onDragLeave = () => {
    setIsDraggingOver(false);
  };

  const onDrop = async (e: React.DragEvent, type: 'video' | 'image') => {
    e.preventDefault();
    setIsDraggingOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      await handleFileUpload(file, type);
    }
  };

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
        <Card className="border-primary/20 bg-card backdrop-blur-sm overflow-hidden relative">
          {uploading && (
            <div className="absolute inset-0 z-50 bg-background/80 backdrop-blur-sm flex flex-col items-center justify-center space-y-4 animate-in fade-in duration-300">
              <div className="w-64 space-y-2">
                <div className="flex justify-between text-[10px] font-mono uppercase tracking-widest text-primary">
                  <span>Enviando arquivo...</span>
                  <span>{uploadProgress}%</span>
                </div>
                <div className="h-1.5 w-full bg-primary/10 rounded-full overflow-hidden">
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: `${uploadProgress}%` }}
                    className="h-full bg-primary shadow-[0_0_10px_rgba(59,130,246,0.5)]" 
                  />
                </div>
              </div>
              <p className="text-[9px] font-mono text-muted-foreground uppercase animate-pulse">
                Não feche esta janela
              </p>
            </div>
          )}
          
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
                  placeholder="Ex: Como baixar o Bypass Play Protect"
                  className="bg-card"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-mono uppercase tracking-widest text-muted-foreground">Categoria</label>
                <Input 
                  value={current.category} 
                  onChange={(e) => setCurrent({ ...current, category: e.target.value })}
                  placeholder="general, play-protect, yaarsa"
                  className="bg-card"
                />
              </div>
            </div>
            
            <div className="space-y-2">
              <label className="text-xs font-mono uppercase tracking-widest text-muted-foreground">Descrição</label>
              <Textarea 
                value={current.description} 
                onChange={(e) => setCurrent({ ...current, description: e.target.value })}
                placeholder="Explique o que o tutorial ensina..."
                className="min-h-[100px] bg-card"
              />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-xs font-mono uppercase tracking-widest text-primary font-bold flex justify-between">
                    Mídia do Tutorial
                    <span className="text-[10px] text-muted-foreground opacity-70">Max 500MB (MP4)</span>
                  </label>
                  
                  <div 
                    onDragOver={onDragOver}
                    onDragLeave={onDragLeave}
                    onDrop={(e) => onDrop(e, 'video')}
                    className={cn(
                      "relative border-2 border-dashed rounded-xl p-8 transition-all duration-300 flex flex-col items-center justify-center gap-3 group",
                      isDraggingOver ? "border-primary bg-primary/5 scale-[0.98]" : "border-primary/20 bg-card hover:border-primary/40",
                      current.video_url && "border-emerald-500/40 bg-emerald-500/5"
                    )}
                  >
                    <Video className={cn(
                      "h-8 w-8 transition-colors duration-300",
                      isDraggingOver ? "text-primary" : "text-muted-foreground group-hover:text-primary/60",
                      current.video_url && "text-emerald-500"
                    )} />
                    
                    <div className="text-center">
                      <p className="text-[10px] font-mono uppercase tracking-widest text-foreground/80">
                        {current.video_url ? "Vídeo Carregado" : "Arraste o vídeo aqui"}
                      </p>
                      <p className="text-[9px] text-muted-foreground mt-1">
                        ou clique para selecionar
                      </p>
                    </div>

                    <input 
                      type="file" 
                      accept="video/mp4,video/webm,video/ogg,video/quicktime,video/x-matroska"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleFileUpload(file, 'video');
                      }}
                      className="absolute inset-0 opacity-0 cursor-pointer"
                      disabled={uploading}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-mono uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                    <LinkIcon className="h-3 w-3" /> Link do YouTube (Opcional)
                  </label>
                  <Input 
                    value={current.youtube_url} 
                    onChange={(e) => setCurrent({ ...current, youtube_url: e.target.value, video_url: "" })}
                    placeholder="https://youtube.com/watch?v=..."
                    className="bg-card text-xs font-mono"
                  />
                </div>
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-xs font-mono uppercase tracking-widest text-primary font-bold flex justify-between">
                    Capa do Vídeo
                    <span className="text-[10px] text-muted-foreground opacity-70">Max 10MB</span>
                  </label>
                  
                  <div 
                    onDragOver={onDragOver}
                    onDragLeave={onDragLeave}
                    onDrop={(e) => onDrop(e, 'image')}
                    className={cn(
                      "relative border-2 border-dashed rounded-xl p-8 transition-all duration-300 flex flex-col items-center justify-center gap-3 group",
                      isDraggingOver ? "border-primary bg-primary/5 scale-[0.98]" : "border-primary/20 bg-card hover:border-primary/40",
                      current.image_url && "border-emerald-500/40 bg-emerald-500/5"
                    )}
                  >
                    <ImageIcon className={cn(
                      "h-8 w-8 transition-colors duration-300",
                      isDraggingOver ? "text-primary" : "text-muted-foreground group-hover:text-primary/60",
                      current.image_url && "text-emerald-500"
                    )} />
                    
                    <div className="text-center">
                      <p className="text-[10px] font-mono uppercase tracking-widest text-foreground/80">
                        {current.image_url ? "Capa Carregada" : "Arraste a capa aqui"}
                      </p>
                      <p className="text-[9px] text-muted-foreground mt-1">
                        ou clique para selecionar
                      </p>
                    </div>

                    <input 
                      type="file" 
                      accept="image/*"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleFileUpload(file, 'image');
                      }}
                      className="absolute inset-0 opacity-0 cursor-pointer"
                      disabled={uploading}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-mono uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                    <LinkIcon className="h-3 w-3" /> Link da Thumbnail (Opcional)
                  </label>
                  <Input 
                    value={current.image_url} 
                    onChange={(e) => setCurrent({ ...current, image_url: e.target.value })}
                    placeholder="https://.../thumb.jpg"
                    className="bg-background/50 text-xs font-mono"
                  />
                </div>
              </div>
            </div>

            {(current.video_url || current.youtube_url || current.image_url) && (
              <div className="grid gap-4 md:grid-cols-2 mt-4 p-4 rounded-lg bg-muted/30 border border-primary/10 animate-in zoom-in-95 duration-300">
                <div className="space-y-2">
                  <label className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">Preview da Mídia</label>
                  <div className="aspect-video relative rounded-md overflow-hidden bg-black/40 border border-border/50 flex items-center justify-center group">
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
                    { (current.video_url || current.youtube_url) && (
                      <Button 
                        variant="destructive" 
                        size="icon" 
                        className="absolute top-2 right-2 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={() => setCurrent({ ...current, video_url: "", youtube_url: "" })}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                </div>
                
                <div className="space-y-2">
                  <label className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">Preview da Capa</label>
                  <div className="aspect-video relative rounded-md overflow-hidden bg-black/40 border border-border/50 flex items-center justify-center group">
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
                    { current.image_url && (
                      <Button 
                        variant="destructive" 
                        size="icon" 
                        className="absolute top-2 right-2 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={() => setCurrent({ ...current, image_url: "" })}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-4 border-t border-border/40">
              <Button variant="ghost" onClick={() => { setIsEditing(false); setCurrent({ title: "", description: "", video_url: "", image_url: "", youtube_url: "", category: "general", is_active: true }); }}>
                Cancelar
              </Button>
              <Button onClick={() => handleSave()} className="gap-2 bg-primary hover:bg-primary/90 shadow-lg shadow-primary/20">
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
