import { useEffect, useMemo, useState } from "react";
import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";
import { Package, ShoppingCart, Search, Sparkles } from "lucide-react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { SchoolCombobox, type SchoolOption } from "@/components/kits/SchoolCombobox";
import { useCart } from "@/contexts/CartContext";
import { toast } from "sonner";

const CATEGORY_LABELS: Record<string, string> = {
  kit_cahiers: "Kit Cahiers",
  kit_livres: "Kit Livres",
  kit_complet_cl: "Kit Complet (Cahiers + Livres)",
  kit_complet_clad: "Kit Complet (Cahiers + Livres + Annales + Dictionnaires)",
};

type Kit = {
  id: string;
  name: string;
  description: string | null;
  grade_level: string;
  school_id: string | null;
  category: string | null;
  image_url: string | null;
  total_price: number | null;
  discount_price: number | null;
  items_count?: number;
};

const formatFCFA = (v: number | null | undefined) =>
  new Intl.NumberFormat("fr-FR").format(Math.round(Number(v) || 0)) + " FCFA";

const KitCoverFallback = ({ kit, schoolName }: { kit: Kit; schoolName?: string }) => (
  <div className="relative flex h-full w-full items-center justify-center overflow-hidden bg-gradient-to-br from-primary via-primary/80 to-accent text-primary-foreground">
    <div className="absolute inset-0 opacity-20 bg-[radial-gradient(circle_at_20%_20%,white,transparent_40%),radial-gradient(circle_at_80%_60%,white,transparent_40%)]" />
    <div className="relative z-10 flex flex-col items-center gap-2 p-4 text-center">
      <Sparkles className="h-8 w-8" />
      <p className="font-display text-lg font-bold leading-tight">
        {CATEGORY_LABELS[kit.category || ""] || "Kit École"}
      </p>
      <p className="text-xs opacity-90">{kit.grade_level}</p>
      {schoolName ? <p className="text-[11px] font-semibold uppercase tracking-wide opacity-90">{schoolName}</p> : null}
    </div>
  </div>
);

const KitsEcole = () => {
  const [school, setSchool] = useState<SchoolOption | null>(null);
  const [level, setLevel] = useState<string | null>(null);
  const [kits, setKits] = useState<Kit[]>([]);
  const [loading, setLoading] = useState(false);
  const { addToCart } = useCart();

  useEffect(() => {
    if (!school) {
      setKits([]);
      setLevel(null);
      return;
    }
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from("smart_kits")
        .select("id,name,description,grade_level,school_id,category,image_url,total_price,discount_price,smart_kit_items(count)")
        .eq("school_id", school.id)
        .eq("is_active", true)
        .eq("status", "published")
        .order("grade_level", { ascending: true });
      const parsed: Kit[] = (data || []).map((k: any) => ({
        ...k,
        items_count: k.smart_kit_items?.[0]?.count ?? 0,
      }));
      setKits(parsed);
      setLoading(false);
    })();
  }, [school]);

  const levels = useMemo(() => Array.from(new Set(kits.map((k) => k.grade_level))).sort(), [kits]);
  const visibleKits = useMemo(() => (level ? kits.filter((k) => k.grade_level === level) : kits), [kits, level]);

  const handleAddKit = async (kit: Kit) => {
    const { data: items } = await supabase
      .from("smart_kit_items")
      .select("product_id,quantity")
      .eq("kit_id", kit.id);
    const withProducts = (items || []).filter((i) => i.product_id);
    if (withProducts.length === 0) {
      toast.error("Ce kit ne contient aucun produit disponible à l'achat.");
      return;
    }
    let ok = 0;
    for (const it of withProducts) {
      try {
        await addToCart(it.product_id as string, it.quantity || 1);
        ok++;
      } catch (e) {
        // continue
      }
    }
    if (ok > 0) toast.success(`Kit ajouté au panier (${ok} produit${ok > 1 ? "s" : ""}).`);
    else toast.error("Impossible d'ajouter le kit au panier.");
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Helmet>
        <title>Kit École — Trouvez le kit officiel de votre établissement | Scoly</title>
        <meta
          name="description"
          content="Recherchez votre établissement scolaire et retrouvez le kit officiel correspondant à votre niveau. Kits cahiers, livres et kits complets."
        />
      </Helmet>
      <Navbar />
      <main id="main-content" className="flex-1">
        <section className="border-b bg-gradient-to-b from-primary/5 via-background to-background">
          <div className="container mx-auto px-4 py-10 md:py-16">
            <div className="max-w-3xl mx-auto text-center space-y-4">
              <Badge variant="secondary" className="mx-auto">Nouveau · Kits officiels par établissement</Badge>
              <h1 className="font-display text-3xl md:text-5xl font-bold tracking-tight">
                Trouvez le Kit École de votre établissement
              </h1>
              <p className="text-muted-foreground text-base md:text-lg">
                Recherchez votre école ou saisissez votre code référent pour accéder aux kits officiels validés.
              </p>
            </div>

            <div className="mt-8 max-w-2xl mx-auto space-y-3">
              <label className="text-sm font-medium flex items-center gap-2">
                <Search className="h-4 w-4" /> Rechercher votre établissement
              </label>
              <SchoolCombobox
                value={school?.id}
                onChange={setSchool}
                placeholder="Entrez le nom de votre établissement ou votre code référent."
              />
              {school && levels.length > 0 && (
                <div className="flex flex-wrap gap-2 pt-2">
                  <Button
                    size="sm"
                    variant={level === null ? "default" : "outline"}
                    onClick={() => setLevel(null)}
                  >
                    Tous les niveaux
                  </Button>
                  {levels.map((lv) => (
                    <Button
                      key={lv}
                      size="sm"
                      variant={level === lv ? "default" : "outline"}
                      onClick={() => setLevel(lv)}
                    >
                      {lv}
                    </Button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </section>

        <section className="container mx-auto px-4 py-10">
          {!school ? (
            <div className="text-center text-muted-foreground py-16">
              <Package className="mx-auto h-10 w-10 mb-3 opacity-40" />
              <p>Sélectionnez votre établissement pour voir les kits disponibles.</p>
            </div>
          ) : loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-80 w-full rounded-xl" />
              ))}
            </div>
          ) : visibleKits.length === 0 ? (
            <div className="text-center text-muted-foreground py-16">
              <p>Aucun kit publié pour cet établissement pour le moment.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {visibleKits.map((kit) => {
                const price = kit.discount_price ?? kit.total_price ?? 0;
                return (
                  <Card key={kit.id} className="group overflow-hidden hover:shadow-lg transition-shadow flex flex-col">
                    <div className="relative aspect-[4/3] w-full bg-muted">
                      {kit.image_url ? (
                        <img
                          src={kit.image_url}
                          alt={kit.name}
                          loading="lazy"
                          className="h-full w-full object-cover group-hover:scale-[1.02] transition-transform"
                        />
                      ) : (
                        <KitCoverFallback kit={kit} schoolName={school?.name} />
                      )}
                      {kit.category && (
                        <Badge className="absolute top-2 left-2 bg-background/95 text-foreground border">
                          {CATEGORY_LABELS[kit.category] || kit.category}
                        </Badge>
                      )}
                    </div>
                    <CardContent className="p-4 flex-1 flex flex-col gap-3">
                      <div className="space-y-1">
                        <h3 className="font-display font-semibold text-lg leading-tight line-clamp-2">
                          {kit.name}
                        </h3>
                        <p className="text-xs text-muted-foreground">
                          {kit.grade_level} · {school?.name}
                        </p>
                      </div>
                      <div className="flex items-center justify-between mt-auto">
                        <div>
                          <div className="text-xs text-muted-foreground">Prix total</div>
                          <div className="font-bold text-primary text-lg">{formatFCFA(price)}</div>
                        </div>
                        <Badge variant="secondary" className="whitespace-nowrap">
                          <Package className="h-3 w-3 mr-1" />
                          {kit.items_count ?? 0} produit{(kit.items_count ?? 0) > 1 ? "s" : ""}
                        </Badge>
                      </div>
                      <div className="flex gap-2 pt-1">
                        <Button asChild variant="outline" size="sm" className="flex-1">
                          <Link to={`/kits-ecole/${kit.id}`}>Voir le détail</Link>
                        </Button>
                        <Button size="sm" className="flex-1" onClick={() => handleAddKit(kit)}>
                          <ShoppingCart className="h-4 w-4 mr-1" /> Ajouter
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </section>
      </main>
      <Footer />
    </div>
  );
};

export default KitsEcole;
