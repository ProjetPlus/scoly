import { useEffect, useRef, useState } from "react";
import { Upload, Wand2, RefreshCw, ShoppingCart, X, Plus, Save, Send, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useCart } from "@/contexts/CartContext";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

const KIT_LEVELS = [
  { value: "CP1", cycle: "Primaire" }, { value: "CP2", cycle: "Primaire" },
  { value: "CE1", cycle: "Primaire" }, { value: "CE2", cycle: "Primaire" },
  { value: "CM1", cycle: "Primaire" }, { value: "CM2", cycle: "Primaire" },
  { value: "6ème", cycle: "Collège" }, { value: "5ème", cycle: "Collège" },
  { value: "4ème", cycle: "Collège" }, { value: "3ème", cycle: "Collège" },
  { value: "2nde", cycle: "Lycée" }, { value: "1ère", cycle: "Lycée" },
  { value: "Terminale", cycle: "Lycée" },
];
const KIT_SERIES = [
  { value: "A", label: "Série A (Lettres)" },
  { value: "C", label: "Série C (Sciences)" },
  { value: "D", label: "Série D (Sciences naturelles)" },
];


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

const MAX_FILES = 100;
const MAX_BYTES = 10 * 1024 * 1024;

interface CatalogProduct {
  id: string;
  name_fr: string;
  price: number;
  stock: number | null;
  is_active: boolean | null;
}

const emptyItem = (): KitItem => ({
  item_name: "",
  quantity: 1,
  is_required: true,
  estimated_price: 0,
  product_id: null,
  category_hint: "",
});

const KitComposer = () => {
  const [files, setFiles] = useState<File[]>([]);
  const [level, setLevel] = useState("");
  const [series, setSeries] = useState("");
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedKitId, setSavedKitId] = useState<string | null>(null);
  const [kit, setKit] = useState<GeneratedKit | null>(null);
  const [products, setProducts] = useState<CatalogProduct[]>([]);
  const [productSearch, setProductSearch] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const { addToCart } = useCart();
  const { isAdmin, user } = useAuth();

  const showSeries = ["2nde", "1ère", "Terminale"].includes(level);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("products")
        .select("id, name_fr, price, stock, is_active")
        .eq("is_active", true)
        .order("name_fr")
        .limit(1000);
      setProducts(data || []);
    })();
  }, []);

  const filteredProducts = products.filter((product) =>
    product.name_fr.toLowerCase().includes(productSearch.toLowerCase().trim())
  );

  const kitTotal = (items: KitItem[]) => items.reduce((s, i) => s + (i.estimated_price || 0) * (i.quantity || 1), 0);

  const startManualKit = () => {
    const selectedLevel = level || "CP1";
    setLevel(selectedLevel);
    setKit({
      kit_name: `Kit ${selectedLevel}`,
      grade_level: selectedLevel,
      series: series || null,
      description: "Kit composé manuellement par l'administration.",
      estimated_price: 0,
      items: [emptyItem()],
    });
  };

  const onPick = (list: FileList | null) => {
    if (!list) return;
    const arr = Array.from(list).slice(0, MAX_FILES);
    const bad = arr.find((f) => f.size > MAX_BYTES);
    if (bad) { toast.error(`${bad.name} dépasse 10 Mo`); return; }
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

  const addItem = () => {
    if (!kit) return;
    const items = [...kit.items, emptyItem()];
    setKit({ ...kit, items, estimated_price: kitTotal(items) });
  };

  const selectProduct = (idx: number, productId: string) => {
    const product = products.find((p) => p.id === productId);
    if (!product) return updateItem(idx, { product_id: null });
    updateItem(idx, { product_id: product.id, item_name: product.name_fr, estimated_price: product.price });
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
      const total = kitTotal(kit.items);
      let kitId = savedKitId;
      let kitProductId: string | null = null;
      if (publish) {
        const { data: existingKit } = kitId
          ? await supabase.from("smart_kits").select("product_id").eq("id", kitId).maybeSingle()
          : { data: null } as any;
        kitProductId = existingKit?.product_id || null;
        const productPayload = {
          name_fr: kit.kit_name,
          name_en: kit.kit_name,
          name_de: kit.kit_name,
          name_es: kit.kit_name,
          description_fr: kit.description,
          price: total,
          stock: 999,
          is_active: true,
          product_type: "school_supply",
          metadata: { source: "smart_kit", grade_level: kit.grade_level, series: kit.series },
        };
        if (kitProductId) {
          const { error } = await supabase.from("products").update(productPayload).eq("id", kitProductId);
          if (error) throw error;
        } else {
          const { data, error } = await supabase.from("products").insert(productPayload).select("id").single();
          if (error) throw error;
          kitProductId = data.id;
        }
      }
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
            status: publish ? "published" : "draft",
            published_at: publish ? new Date().toISOString() : null,
            product_id: kitProductId,
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
            status: publish ? "published" : "draft",
            published_at: publish ? new Date().toISOString() : null,
            created_by: user?.id || null,
            product_id: kitProductId,
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
        estimated_price: it.estimated_price || 0,
        category_hint: it.category_hint || null,
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
            <p className="text-xs text-muted-foreground mt-1">PDF, JPG, PNG · jusqu'à {MAX_FILES} fichiers · 10 Mo chacun</p>
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

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4">
            <div>
              <Label className="text-xs">Niveau / Classe *</Label>
              <Select value={level} onValueChange={(v) => { setLevel(v); if (!["2nde","1ère","Terminale"].includes(v)) setSeries(""); }}>
                <SelectTrigger><SelectValue placeholder="Sélectionner un niveau" /></SelectTrigger>
                <SelectContent>
                  {["Primaire","Collège","Lycée"].map((cycle) => (
                    <div key={cycle}>
                      <div className="px-2 py-1 text-[10px] font-bold uppercase text-muted-foreground">{cycle}</div>
                      {KIT_LEVELS.filter((l) => l.cycle === cycle).map((l) => (
                        <SelectItem key={l.value} value={l.value}>{l.value}</SelectItem>
                      ))}
                    </div>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Série {showSeries ? "*" : "(lycée uniquement)"}</Label>
              <Select value={series} onValueChange={setSeries} disabled={!showSeries}>
                <SelectTrigger><SelectValue placeholder={showSeries ? "Sélectionner une série" : "—"} /></SelectTrigger>
                <SelectContent>
                  {KIT_SERIES.map((s) => (
                    <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-4">
            <Button onClick={generate} disabled={generating || files.length === 0} className="gap-2">
              {generating ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />}
              {generating ? "Analyse en cours..." : "Générer depuis fichiers"}
            </Button>
            {isAdmin && (
              <Button type="button" variant="outline" onClick={startManualKit} className="gap-2">
                <Plus className="w-4 h-4" /> Composer manuellement
              </Button>
            )}
          </div>
        </>
      )}

      {kit && (
        <div className="space-y-4">
          <div className="bg-primary/5 border border-primary/20 rounded-xl p-4">
            <h4 className="font-bold text-lg">{kit.kit_name}</h4>
            <p className="text-xs text-muted-foreground">{kit.grade_level} {kit.series ? `· Série ${kit.series}` : ""}</p>
            <Badge className="mt-2">{kit.estimated_price.toLocaleString("fr-FR")} FCFA estimé</Badge>
          </div>

          <div className="relative">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input value={productSearch} onChange={(e) => setProductSearch(e.target.value)} placeholder="Chercher dans les produits disponibles" className="pl-9 h-9" />
          </div>

          <div className="space-y-2 max-h-96 overflow-y-auto">
            {kit.items.map((it, idx) => (
              <div key={idx} className="grid grid-cols-1 lg:grid-cols-[1fr_1fr_72px_112px_40px] gap-2 bg-muted/30 rounded-lg p-2">
                <Select value={it.product_id || "manual"} onValueChange={(value) => selectProduct(idx, value === "manual" ? "" : value)}>
                  <SelectTrigger className="h-9"><SelectValue placeholder="Produit catalogue" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="manual">Hors catalogue / manuel</SelectItem>
                    {filteredProducts.slice(0, 80).map((product) => (
                      <SelectItem key={product.id} value={product.id}>{product.name_fr} · {product.price.toLocaleString("fr-FR")} FCFA</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input value={it.item_name} onChange={(e) => updateItem(idx, { item_name: e.target.value, product_id: null })} placeholder="Ex: bic bleu, cahier 100 pages" className="h-9" />
                <Input type="number" min={1} value={it.quantity} onChange={(e) => updateItem(idx, { quantity: Number(e.target.value) || 1 })} className="h-9" />
                <Input type="number" min={0} value={it.estimated_price} onChange={(e) => updateItem(idx, { estimated_price: Number(e.target.value) || 0 })} className="h-9" />
                {it.product_id ? <Badge variant="secondary" className="text-[10px]">Catalogue</Badge> : <Badge variant="outline" className="text-[10px]">Hors catalogue</Badge>}
                <Button size="icon" variant="ghost" aria-label="Retirer l'article" onClick={() => removeItem(idx)}><X className="w-4 h-4" /></Button>
              </div>
            ))}
          </div>

          <Button type="button" variant="outline" onClick={addItem} className="w-full gap-2">
            <Plus className="w-4 h-4" /> Ajouter une ligne
          </Button>

          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => { setKit(null); setFiles([]); setSavedKitId(null); }} className="flex-1 min-w-[140px]">Recommencer</Button>
            <Button onClick={addAll} className="flex-1 min-w-[160px] gap-2"><ShoppingCart className="w-4 h-4" /> Ajouter au panier</Button>
            {isAdmin && (
              <>
                <Button variant="secondary" disabled={saving} onClick={() => saveKit(false)} className="flex-1 min-w-[160px] gap-2">
                  <Save className="w-4 h-4" /> {saving ? "..." : "Enregistrer brouillon"}
                </Button>
                <Button variant="default" disabled={saving} onClick={() => saveKit(true)} className="flex-1 min-w-[160px] gap-2">
                  <Send className="w-4 h-4" /> {saving ? "..." : "Publier au catalogue"}
                </Button>
              </>
            )}
          </div>

        </div>
      )}
    </div>
  );
};

export default KitComposer;
