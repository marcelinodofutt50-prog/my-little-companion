import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Trash2, Video, Link as LinkIcon, Edit, GripVertical } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

interface SortableTutorialCardProps {
  t: any;
  setCurrent: (t: any) => void;
  setIsEditing: (val: boolean) => void;
  handleDelete: (id: string) => void;
}

export function SortableTutorialCard({ t, setCurrent, setIsEditing, handleDelete }: SortableTutorialCardProps) {
  const thumbnailUrl = t.preview_url || t.image_url;
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id: t.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : undefined,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} className="h-full">
      <Card className="group relative h-full overflow-hidden border-border/40 bg-card/40 transition-all hover:border-primary/40">
        {/* Drag Handle */}
        <div 
          {...attributes} 
          {...listeners}
          className="absolute left-2 top-2 z-20 cursor-grab active:cursor-grabbing p-1.5 rounded bg-background/80 opacity-0 group-hover:opacity-100 transition-opacity backdrop-blur-sm border border-border/50"
        >
          <GripVertical className="h-4 w-4 text-muted-foreground" />
        </div>

        <div className="relative aspect-video w-full bg-muted overflow-hidden">
          {thumbnailUrl ? (
            <img src={thumbnailUrl} alt={t.title} className="h-full w-full object-cover transition-transform group-hover:scale-105" />
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
              <Button 
                size="icon" 
                variant="ghost" 
                className="h-8 w-8 text-primary hover:text-primary hover:bg-primary/20" 
                onClick={() => { setCurrent(t); setIsEditing(true); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
              >
                <Edit className="h-4 w-4" />
              </Button>
              <Button 
                size="icon" 
                variant="ghost" 
                className="h-8 w-8 text-red-500/70 hover:text-red-500" 
                onClick={() => handleDelete(t.id)}
              >
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
    </div>
  );
}
