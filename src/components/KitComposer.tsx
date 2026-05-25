import { useRef, useState } from "react";
import { Upload, Wand2, RefreshCw, ShoppingCart, X, Sparkles, Save, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useCart } from "@/contexts/CartContext";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";


interface KitItem {
  item_name: string;
  quantity: number;
  is_required: boolean;
  estimated_price: number;
  product_id: string | null;
  category_hint?: string | null;
}
interface GeneratedKit {
  kit_name: string;
  grade_level: string | null;
  series: string | null;
  description: string;
  estimated_price: number;
  items: KitItem[];
}

const MAX_FILES = 10;
const MAX_BYTES = 10 * 1024 * 1024;

const KitComposer = () => {
  const [files, setFiles] = useState<File[]>([]);
  const [level, setLevel] = useState("");
  const [series, setSeries] = useState("");
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedKitId, setSavedKitId] = useState<string | null>(null);
  const [kit, setKit] = useState<GeneratedKit | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const { addToCart } = useCart();
  const { isAdmin } = useAuth();


  const onPick = (list: FileList | null) => {
    if (!list) return;
    const arr = Array.from(list).slice(0, MAX_FILES);
    const bad = arr.find((f) => f.size > MAX_BYTES);
    if (bad) { toast.error(`${bad.name} dépasse 8 Mo`); return; }
    setFiles(arr);
  };

  const toBase64 = (f: File) => new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(",")[1] || "");
    r.onerror = reject;
    r.readAsDataURL(f);
  });

  const generate = async () => {
    if (files.length === 0) { toast.error("Ajoutez au moins un document"); return; }
    setGenerating(true);
    try {
      const payload = await Promise.all(files.map(async (f) => ({
        name: f.name, mime: f.type || "application/octet-stream", dataBase64: await toBase64(f),
      })));
      const { data, error } = await supabase.functions.invoke("generate-kit-from-docs", {
        body: { files: payload, level, series },
      });
      if (error) throw error;
      setKit(data as GeneratedKit);
      toast.success("Kit généré !");
    } catch (e: any) {
      toast.error(e.message || "Erreur de génération");
    } finally {
      setGenerating(false);
    }
  };

  const updateItem = (idx: number, patch: Partial<KitItem>) => {
    if (!kit) return;
    const items = [...kit.items];
    items[idx] = { ...items[idx], ...patch };
    setKit({ ...kit, items, estimated_price: items.reduce((s, i) => s + i.estimated_price * i.quantity, 0) });
  };
  const removeItem = (idx: number) => {
    if (!kit) return;
    const items = kit.items.filter((_, i) => i !== idx);
    setKit({ ...kit, items, estimated_price: items.reduce((s, i) => s + i.estimated_price * i.quantity, 0) });
  };

  const addAll = async () => {
    if (!kit) return;
    let added = 0;
    for (const it of kit.items) {
      if (it.product_id) {
        try { await addToCart(it.product_id, it.quantity || 1); added++; } catch { /* skip */ }
      }
    }
    if (added > 0) toast.success(`${added} article(s) ajouté(s) au panier`);
    else toast.info("Aucun article du kit n'est encore au catalogue. Notre équipe sera notifiée.");
  };

  const saveKit = async (publish: boolean) => {
    if (!kit) return;
    setSaving(true);
    try {
      const total = kit.items.reduce((s, i) => s + (i.estimated_price || 0) * (i.quantity || 1), 0);
      let kitId = savedKitId;
      if (kitId) {
        const { error } = await supabase
          .from("smart_kits")
          .update({
            name: kit.kit_name,
            grade_level: kit.grade_level,
            series: kit.series,
            description: kit.description,
            total_price: total,
            is_active: publish,
          })
          .eq("id", kitId);
        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from("smart_kits")
          .insert({
            name: kit.kit_name,
            grade_level: kit.grade_level,
            series: kit.series,
            description: kit.description,
            total_price: total,
            is_active: publish,
          })
          .select("id")
          .single();
        if (error) throw error;
        kitId = data.id;
        setSavedKitId(kitId);
      }

      // Replace items
      await supabase.from("smart_kit_items").delete().eq("kit_id", kitId);
      const itemRows = kit.items.map((it, idx) => ({
        kit_id: kitId,
        product_id: it.product_id,
        item_name: it.item_name,
        quantity: it.quantity || 1,
        is_required: it.is_required ?? true,
        sort_order: idx,
      }));
      if (itemRows.length > 0) {
        const { error: itemsErr } = await supabase.from("smart_kit_items").insert(itemRows);
        if (itemsErr) throw itemsErr;
      }
      toast.success(publish ? "Kit publié au catalogue 🎉" : "Brouillon enregistré");
    } catch (e: any) {
      toast.error(e.message || "Échec de l'enregistrement");
    } finally {
      setSaving(false);
    }
  };


  return (
    <div className="bg-card border border-border rounded-2xl p-6 md:p-8 shadow-sm">
      <div className="flex items-center gap-2 mb-2">
        <Wand2 className="text-primary" />
        <h3 className="text-xl font-display font-bold">Composer mon kit avec l'IA</h3>
      </div>
      <p className="text-sm text-muted-foreground mb-6">
        Uploadez la liste officielle de votre école (PDF, photo, scan). L'IA détecte tous les articles, propose les prix, vous éditez.
      </p>

      {!kit && (
        <>
          <div
            onClick={() => inputRef.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => { e.preventDefault(); onPick(e.dataTransfer.files); }}
            className="border-2 border-dashed border-border rounded-xl p-8 text-center cursor-pointer hover:border-primary hover:bg-primary/5 transition"
          >
            <Upload className="w-10 h-10 mx-auto text-muted-foreground mb-2" />
            <p className="text-sm font-medium">Déposez vos fichiers ou cliquez</p>
            <p className="text-xs text-muted-foreground mt-1">PDF, JPG, PNG · max {MAX_FILES} fichiers · 8 Mo chacun</p>
            <input
              ref={inputRef} type="file" multiple accept="image/*,application/pdf"
              className="hidden" onChange={(e) => onPick(e.target.files)}
            />
          </div>

          {files.length > 0 && (
            <div className="mt-4 space-y-1">
              {files.map((f, i) => (
                <div key={i} className="flex items-center justify-between text-xs bg-muted/40 rounded px-3 py-2">
                  <span className="truncate">{f.name}</span>
                  <span className="text-muted-foreground">{(f.size / 1024).toFixed(0)} Ko</span>
                </div>
              ))}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3 mt-4">
            <Input placeholder="Niveau (ex: CP1, 6ème)" value={level} onChange={(e) => setLevel(e.target.value)} />
            <Input placeholder="Série (A, C, D — optionnel)" value={series} onChange={(e) => setSeries(e.target.value)} />
          </div>

          <Button onClick={generate} disabled={generating || files.length === 0} className="w-full mt-4 gap-2">
            {generating ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            {generating ? "L'IA travaille..." : "Générer mon kit"}
          </Button>
        </>
      )}

      {kit && (
        <div className="space-y-4">
          <div className="bg-primary/5 border border-primary/20 rounded-xl p-4">
            <h4 className="font-bold text-lg">{kit.kit_name}</h4>
            <p className="text-xs text-muted-foreground">{kit.grade_level} {kit.series ? `· Série ${kit.series}` : ""}</p>
            <Badge className="mt-2">{kit.estimated_price.toLocaleString("fr-FR")} FCFA estimé</Badge>
          </div>

          <div className="space-y-2 max-h-96 overflow-y-auto">
            {kit.items.map((it, idx) => (
              <div key={idx} className="flex items-center gap-2 bg-muted/30 rounded-lg p-2">
                <Input value={it.item_name} onChange={(e) => updateItem(idx, { item_name: e.target.value })} className="flex-1 h-9" />
                <Input type="number" min={1} value={it.quantity} onChange={(e) => updateItem(idx, { quantity: Number(e.target.value) || 1 })} className="w-16 h-9" />
                <Input type="number" min={0} value={it.estimated_price} onChange={(e) => updateItem(idx, { estimated_price: Number(e.target.value) || 0 })} className="w-24 h-9" />
                {it.product_id ? <Badge variant="secondary" className="text-[10px]">Catalogue</Badge> : <Badge variant="outline" className="text-[10px]">Hors catalogue</Badge>}
                <Button size="icon" variant="ghost" onClick={() => removeItem(idx)}><X className="w-4 h-4" /></Button>
              </div>
            ))}
          </div>

          <div className="flex gap-2">
            <Button variant="outline" onClick={() => { setKit(null); setFiles([]); }} className="flex-1">Recommencer</Button>
            <Button onClick={addAll} className="flex-1 gap-2"><ShoppingCart className="w-4 h-4" /> Tout ajouter au panier</Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default KitComposer;
