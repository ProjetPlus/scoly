import { useEffect, useState } from "react";
import { Plus, Trash2, Pencil, Package, Save, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SchoolCombobox, type SchoolOption } from "@/components/kits/SchoolCombobox";

const CATEGORIES = [
  { value: "kit_cahiers", label: "Kit Cahiers" },
  { value: "kit_livres", label: "Kit Livres" },
  { value: "kit_complet_cl", label: "Kit Complet (Cahiers + Livres)" },
  { value: "kit_complet_clad", label: "Kit Complet (Cahiers + Livres + Annales + Dictionnaires)" },
];

type KitItem = { item_name: string; quantity: number; estimated_price: number };
type Kit = {
  id: string;
  name: string;
  category: string | null;
  grade_level: string;
  school_id: string | null;
  image_url: string | null;
  total_price: number | null;
  status: string;
  is_active: boolean;
  options: string | null;
  description: string | null;
  school?: { name: string; code: string | null } | null;
};

const emptyForm = {
  id: "" as string | undefined,
  name: "",
  category: "",
  grade_level: "",
  school_id: "",
  school: null as SchoolOption | null,
  image_url: "",
  description: "",
  options: "",
  total_price: 0,
  status: "published",
  is_active: true,
  items: [] as KitItem[],
};

const SchoolKitsManagement = () => {
  const [kits, setKits] = useState<Kit[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ ...emptyForm });

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("smart_kits")
      .select("*, school:schools(name, code)")
      .order("created_at", { ascending: false });
    if (error) toast.error("Erreur de chargement");
    setKits((data as any) || []);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const openCreate = () => {
    setForm({ ...emptyForm, items: [] });
    setOpen(true);
  };

  const openEdit = async (kit: Kit) => {
    const { data: items } = await supabase
      .from("smart_kit_items")
      .select("item_name,quantity,estimated_price")
      .eq("kit_id", kit.id)
      .order("sort_order", { ascending: true });
    let schoolOpt: SchoolOption | null = null;
    if (kit.school_id) {
      const { data: s } = await supabase
        .from("schools")
        .select("id,name,code,logo_url,city")
        .eq("id", kit.school_id)
        .maybeSingle();
      if (s) schoolOpt = s as SchoolOption;
    }
    setForm({
      id: kit.id,
      name: kit.name,
      category: kit.category || "",
      grade_level: kit.grade_level,
      school_id: kit.school_id || "",
      school: schoolOpt,
      image_url: kit.image_url || "",
      description: kit.description || "",
      options: kit.options || "",
      total_price: kit.total_price || 0,
      status: kit.status,
      is_active: kit.is_active,
      items: (items as KitItem[]) || [],
    });
    setOpen(true);
  };

  const addItem = () =>
    setForm((f) => ({ ...f, items: [...f.items, { item_name: "", quantity: 1, estimated_price: 0 }] }));
  const removeItem = (idx: number) =>
    setForm((f) => ({ ...f, items: f.items.filter((_, i) => i !== idx) }));
  const updateItem = (idx: number, patch: Partial<KitItem>) =>
    setForm((f) => ({
      ...f,
      items: f.items.map((it, i) => (i === idx ? { ...it, ...patch } : it)),
    }));

  const computedTotal = form.items.reduce((s, i) => s + (Number(i.estimated_price) || 0) * (Number(i.quantity) || 0), 0);

  const save = async () => {
    if (!form.name || !form.category || !form.grade_level || !form.school_id) {
      toast.error("Nom, catégorie, niveau et établissement sont obligatoires.");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        name: form.name,
        category: form.category,
        grade_level: form.grade_level,
        school_id: form.school_id,
        image_url: form.image_url || null,
        description: form.description || null,
        options: form.options || null,
        total_price: computedTotal || form.total_price || 0,
        status: form.status,
        is_active: form.is_active,
      };
      let kitId = form.id;
      if (kitId) {
        const { error } = await supabase.from("smart_kits").update(payload).eq("id", kitId);
        if (error) throw error;
        await supabase.from("smart_kit_items").delete().eq("kit_id", kitId);
      } else {
        const { data, error } = await supabase
          .from("smart_kits")
          .insert(payload)
          .select("id")
          .single();
        if (error) throw error;
        kitId = data.id;
      }
      if (form.items.length > 0 && kitId) {
        const rows = form.items
          .filter((i) => i.item_name.trim())
          .map((i, idx) => ({
            kit_id: kitId!,
            item_name: i.item_name,
            quantity: Number(i.quantity) || 1,
            estimated_price: Number(i.estimated_price) || 0,
            sort_order: idx,
          }));
        if (rows.length > 0) {
          const { error } = await supabase.from("smart_kit_items").insert(rows);
          if (error) throw error;
        }
      }
      toast.success("Kit École enregistré.");
      setOpen(false);
      await load();
    } catch (e: any) {
      toast.error(e.message || "Erreur lors de l'enregistrement");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: string) => {
    if (!confirm("Supprimer ce kit ?")) return;
    const { error } = await supabase.from("smart_kits").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Kit supprimé");
    load();
  };

  const catLabel = (c: string | null) => CATEGORIES.find((x) => x.value === c)?.label || "—";

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" /> Kits École
            </CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              Créez et gérez les kits officiels rattachés à chaque établissement partenaire.
            </p>
          </div>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button onClick={openCreate}>
                <Plus className="h-4 w-4 mr-2" /> Nouveau Kit École
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{form.id ? "Modifier le Kit École" : "Créer un Kit École"}</DialogTitle>
              </DialogHeader>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Catégorie du kit *</Label>
                  <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Choisir une catégorie" />
                    </SelectTrigger>
                    <SelectContent>
                      {CATEGORIES.map((c) => (
                        <SelectItem key={c.value} value={c.value}>
                          {c.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Niveau scolaire *</Label>
                  <Input
                    value={form.grade_level}
                    onChange={(e) => setForm({ ...form, grade_level: e.target.value })}
                    placeholder="Ex : 6e, CE2, Terminale D…"
                  />
                </div>
                <div className="md:col-span-2 space-y-2">
                  <Label>Nom du kit *</Label>
                  <Input
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder="Ex : Kit Rentrée 6e — Lycée Sainte-Marie"
                  />
                </div>
                <div className="md:col-span-2 space-y-2">
                  <Label>Établissement partenaire *</Label>
                  <SchoolCombobox
                    adminMode
                    value={form.school_id}
                    onChange={(s) =>
                      setForm({
                        ...form,
                        school_id: s?.id || "",
                        school: s,
                      })
                    }
                    placeholder="Rechercher un établissement validé…"
                  />
                  <p className="text-xs text-muted-foreground">
                    Seuls les établissements validés depuis le module Référents apparaissent ici.
                  </p>
                </div>
                <div className="md:col-span-2 space-y-2">
                  <Label>Image de couverture (URL)</Label>
                  <Input
                    value={form.image_url}
                    onChange={(e) => setForm({ ...form, image_url: e.target.value })}
                    placeholder="https://… (laissez vide pour une couverture générée automatiquement)"
                  />
                </div>
                <div className="md:col-span-2 space-y-2">
                  <Label>Description</Label>
                  <Textarea
                    rows={2}
                    value={form.description}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                  />
                </div>
                <div className="md:col-span-2 space-y-2">
                  <Label>Options supplémentaires</Label>
                  <Textarea
                    rows={2}
                    value={form.options}
                    onChange={(e) => setForm({ ...form, options: e.target.value })}
                    placeholder="Ex : livraison à domicile, personnalisation nom élève…"
                  />
                </div>

                <div className="md:col-span-2">
                  <div className="flex items-center justify-between mb-2">
                    <Label>Composition du kit</Label>
                    <Button size="sm" variant="outline" onClick={addItem}>
                      <Plus className="h-3 w-3 mr-1" /> Ajouter un article
                    </Button>
                  </div>
                  <div className="space-y-2">
                    {form.items.length === 0 && (
                      <p className="text-xs text-muted-foreground">Ajoutez au moins un article à la composition.</p>
                    )}
                    {form.items.map((it, idx) => (
                      <div key={idx} className="grid grid-cols-12 gap-2 items-center">
                        <Input
                          className="col-span-6"
                          value={it.item_name}
                          onChange={(e) => updateItem(idx, { item_name: e.target.value })}
                          placeholder="Nom de l'article"
                        />
                        <Input
                          className="col-span-2"
                          type="number"
                          min={1}
                          value={it.quantity}
                          onChange={(e) => updateItem(idx, { quantity: Number(e.target.value) })}
                        />
                        <Input
                          className="col-span-3"
                          type="number"
                          min={0}
                          value={it.estimated_price}
                          onChange={(e) => updateItem(idx, { estimated_price: Number(e.target.value) })}
                          placeholder="Prix"
                        />
                        <Button
                          size="icon"
                          variant="ghost"
                          className="col-span-1"
                          onClick={() => removeItem(idx)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="md:col-span-2 flex items-center justify-between p-3 rounded-lg bg-muted/40">
                  <span className="text-sm">Prix total calculé</span>
                  <span className="font-bold text-primary">
                    {new Intl.NumberFormat("fr-FR").format(computedTotal)} FCFA
                  </span>
                </div>
                <div className="space-y-2">
                  <Label>Statut</Label>
                  <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="draft">Brouillon</SelectItem>
                      <SelectItem value="published">Publié</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setOpen(false)}>
                  <X className="h-4 w-4 mr-1" /> Annuler
                </Button>
                <Button onClick={save} disabled={saving}>
                  <Save className="h-4 w-4 mr-1" /> {saving ? "Enregistrement…" : "Enregistrer"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground">Chargement…</p>
          ) : kits.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aucun Kit École pour le moment.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left border-b">
                    <th className="p-2">Nom</th>
                    <th className="p-2">Catégorie</th>
                    <th className="p-2">Niveau</th>
                    <th className="p-2">Établissement</th>
                    <th className="p-2">Prix</th>
                    <th className="p-2">Statut</th>
                    <th className="p-2 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {kits.map((k) => (
                    <tr key={k.id} className="border-b hover:bg-muted/30">
                      <td className="p-2 font-medium">{k.name}</td>
                      <td className="p-2"><Badge variant="secondary">{catLabel(k.category)}</Badge></td>
                      <td className="p-2">{k.grade_level}</td>
                      <td className="p-2">
                        {k.school?.name || <span className="text-muted-foreground">—</span>}
                        {k.school?.code && <span className="text-xs text-muted-foreground"> · {k.school.code}</span>}
                      </td>
                      <td className="p-2 whitespace-nowrap">
                        {new Intl.NumberFormat("fr-FR").format(k.total_price || 0)} FCFA
                      </td>
                      <td className="p-2">
                        <Badge variant={k.status === "published" ? "default" : "outline"}>{k.status}</Badge>
                      </td>
                      <td className="p-2 text-right">
                        <Button size="icon" variant="ghost" onClick={() => openEdit(k)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button size="icon" variant="ghost" onClick={() => remove(k.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default SchoolKitsManagement;
