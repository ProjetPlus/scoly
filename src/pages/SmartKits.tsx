import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { Package, GraduationCap, ShoppingCart, BookOpen, Calculator, Pencil, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import SEOHead from "@/components/SEOHead";
import { useLanguage } from "@/i18n/LanguageContext";
import { useCart } from "@/contexts/CartContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { motion } from "framer-motion";

import { toast } from "sonner";

const LEVELS = [
  { value: "CP1", label: "CP1", cycle: "Primaire" },
  { value: "CP2", label: "CP2", cycle: "Primaire" },
  { value: "CE1", label: "CE1", cycle: "Primaire" },
  { value: "CE2", label: "CE2", cycle: "Primaire" },
  { value: "CM1", label: "CM1", cycle: "Primaire" },
  { value: "CM2", label: "CM2", cycle: "Primaire" },
  { value: "6ème", label: "6ème", cycle: "Collège" },
  { value: "5ème", label: "5ème", cycle: "Collège" },
  { value: "4ème", label: "4ème", cycle: "Collège" },
  { value: "3ème", label: "3ème", cycle: "Collège" },
  { value: "2nde", label: "2nde", cycle: "Lycée" },
  { value: "1ère", label: "1ère", cycle: "Lycée" },
  { value: "Terminale", label: "Terminale", cycle: "Lycée" },
];

const SERIES = [
  { value: "A", label: "Série A (Lettres)" },
  { value: "C", label: "Série C (Sciences)" },
  { value: "D", label: "Série D (Sciences naturelles)" },
];

const PAGE_SIZE = 12;


const SmartKits = () => {
  const { t } = useLanguage();
  const { addToCart } = useCart();
  const [searchParams, setSearchParams] = useSearchParams();

  const selectedLevel = searchParams.get("level") || "all";
  const selectedSeries = searchParams.get("series") || "all";
  const urlSearch = searchParams.get("search") || "";
  const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
  const [searchInput, setSearchInput] = useState(urlSearch);
  const [debouncedSearch, setDebouncedSearch] = useState(urlSearch);

  const showSeries = ["2nde", "1ère", "Terminale"].includes(selectedLevel);

  const updateParam = (patch: Record<string, string | null>) => {
    const next = new URLSearchParams(searchParams);
    Object.entries(patch).forEach(([k, v]) => {
      if (!v || v === "all" || v === "") next.delete(k);
      else next.set(k, v);
    });
    // Reset page when filters change (except when only page changes)
    if (!("page" in patch)) next.delete("page");
    setSearchParams(next, { replace: true });
  };

  // Debounce search input → URL
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchInput), 350);
    return () => clearTimeout(t);
  }, [searchInput]);
  useEffect(() => {
    if (debouncedSearch !== urlSearch) updateParam({ search: debouncedSearch || null });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch]);

  // Server-side filtered + paginated kits
  const { data: kitsResult, isLoading, isFetching } = useQuery({
    queryKey: ["smart-kits", selectedLevel, selectedSeries, debouncedSearch, page],
    queryFn: async () => {
      const from = (page - 1) * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;
      let q = supabase
        .from("smart_kits")
        .select("*, smart_kit_items(*, products(*))", { count: "exact" })
        .eq("is_active", true);
      if (selectedLevel !== "all") q = q.eq("grade_level", selectedLevel);
      if (showSeries && selectedSeries !== "all") q = q.eq("series", selectedSeries);
      if (debouncedSearch.trim()) {
        const s = debouncedSearch.trim().replace(/[%_]/g, "");
        q = q.or(`name.ilike.%${s}%,description.ilike.%${s}%`);
      }
      const { data, error, count } = await q
        .order("created_at", { ascending: false })
        .range(from, to);
      if (error) throw error;
      return { rows: data || [], count: count || 0 };
    },
    placeholderData: keepPreviousData,
  });

  const kits = kitsResult?.rows || [];
  const totalCount = kitsResult?.count || 0;
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const paginatedKits = kits;




  // Fallback: products matching education_level when no kits
  const { data: suggestedProducts = [] } = useQuery({
    queryKey: ["suggested-products", selectedLevel],
    queryFn: async () => {
      if (selectedLevel === "all") return [];
      const { data, error } = await supabase
        .from("products")
        .select("*")
        .eq("is_active", true)
        .eq("education_level", selectedLevel)
        .limit(20);
      if (error) throw error;
      return data || [];
    },
    enabled: selectedLevel !== "all" && kits.length === 0 && !isLoading,
  });


  const handleAddKitToCart = async (kit: any) => {
    const items = kit.smart_kit_items || [];
    let added = 0;
    for (const item of items) {
      if (item.products && item.products.is_active) {
        try {
          await addToCart(item.product_id, item.quantity || 1);
          added++;
        } catch (e) {
          // skip
        }
      }
    }
    if (added > 0) {
      toast.success(`${added} article(s) ajouté(s) au panier !`);
    } else {
      toast.error("Impossible d'ajouter les articles. Connectez-vous d'abord.");
    }
  };

  const totalKitPrice = (kit: any) => {
    return (kit.smart_kit_items || []).reduce((sum: number, item: any) => {
      return sum + (item.products?.price || 0) * (item.quantity || 1);
    }, 0);
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat("fr-FR").format(price) + " " + t.common.currency;
  };

  return (
    <main className="min-h-screen bg-background">
      <SEOHead
          title="Kits Scolaires — Scoly"
          description="Achetez des kits scolaires prêts à commander par classe et série avec livraison en Côte d'Ivoire."
      />
      <Navbar />

      {/* Hero */}
      <section className="pt-24 pb-16" style={{ background: "var(--gradient-hero)" }}>
        <div className="container mx-auto px-4 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <h1 className="text-4xl md:text-5xl font-display font-bold text-primary-foreground mb-4">
              Kits Scolaires
              <span className="block text-secondary">Prêts à commander</span>
            </h1>
            <p className="text-lg text-primary-foreground/80 max-w-2xl mx-auto mb-8">
              Sélectionnez la classe, comparez les kits et ajoutez les fournitures au panier comme au marché, mais en ligne.
            </p>
          </motion.div>
        </div>
      </section>

      <section className="py-16">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto bg-card rounded-2xl border border-border p-6 md:p-8 -mt-24 relative z-10 shadow-lg">
            <h2 className="text-xl font-display font-bold text-foreground mb-6 flex items-center gap-2">
              <GraduationCap className="w-6 h-6 text-primary" />
              Trouvez votre kit
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="md:col-span-3">
                <label className="text-sm font-medium text-foreground mb-2 block">
                  Rechercher
                </label>
                <div className="relative">
                  <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Rechercher un kit, une matière, un article…"
                    value={searchInput}
                    onChange={(e) => setSearchInput(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>

              <div>
                <label className="text-sm font-medium text-foreground mb-2 block">
                  Niveau / Classe
                </label>
                <Select value={selectedLevel} onValueChange={(v) => updateParam({ level: v, series: null })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Tous les niveaux" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tous les niveaux</SelectItem>
                    {Object.entries(
                      LEVELS.reduce((acc, l) => {
                        (acc[l.cycle] = acc[l.cycle] || []).push(l);
                        return acc;
                      }, {} as Record<string, typeof LEVELS>)
                    ).map(([cycle, levels]) => (
                      <div key={cycle}>
                        <div className="px-2 py-1 text-xs font-bold text-muted-foreground">{cycle}</div>
                        {levels.map((l) => (
                          <SelectItem key={l.value} value={l.value}>
                            {l.label}
                          </SelectItem>
                        ))}
                      </div>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {showSeries && (
                <div>
                  <label className="text-sm font-medium text-foreground mb-2 block">
                    Série
                  </label>
                  <Select value={selectedSeries} onValueChange={(v) => updateParam({ series: v })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Toutes séries" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Toutes séries</SelectItem>
                      {SERIES.map((s) => (
                        <SelectItem key={s.value} value={s.value}>
                          {s.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
          </div>

          {/* Results — always shown */}
          <div className="mt-12">
            {isLoading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto">
                {[...Array(2)].map((_, i) => (
                  <div key={i} className="bg-card rounded-xl border border-border p-6 animate-pulse">
                    <div className="h-6 bg-muted rounded w-3/4 mb-4" />
                    <div className="space-y-2">
                      {[...Array(5)].map((_, j) => (
                        <div key={j} className="h-4 bg-muted rounded w-full" />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ) : kits.length > 0 ? (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto">
                  {paginatedKits.map((kit: any) => (
                  <motion.div
                    key={kit.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-card rounded-xl border border-border overflow-hidden"
                  >
                    <div className="p-6">
                      <div className="flex items-start justify-between mb-4 gap-3">
                        <div className="min-w-0">
                          <h3 className="text-lg font-bold text-foreground truncate">{kit.name}</h3>
                          <div className="flex flex-wrap gap-1.5 mt-1">
                            {kit.grade_level && <Badge variant="outline" className="text-[10px]">{kit.grade_level}</Badge>}
                            {kit.series && <Badge variant="outline" className="text-[10px]">Série {kit.series}</Badge>}
                          </div>
                          {kit.description && (
                            <p className="text-sm text-muted-foreground mt-2 line-clamp-2">{kit.description}</p>
                          )}
                        </div>
                        <Badge variant="secondary" className="shrink-0">
                          {(kit.smart_kit_items || []).length} articles
                        </Badge>
                      </div>

                      <div className="space-y-2 mb-6 max-h-48 overflow-y-auto">
                        {(kit.smart_kit_items || []).map((item: any, idx: number) => (
                          <div key={idx} className="flex items-center justify-between text-sm py-1 border-b border-border/50 last:border-0">
                            <span className="text-foreground flex items-center gap-2 min-w-0">
                              <BookOpen className="w-3 h-3 text-muted-foreground shrink-0" />
                              <span className="truncate">{item.products?.name_fr || item.item_name || "Produit"}</span>
                              {item.quantity > 1 && <Badge variant="outline" className="text-xs shrink-0">x{item.quantity}</Badge>}
                            </span>
                            <span className="text-muted-foreground shrink-0 ml-2">
                              {item.products ? formatPrice((item.products.price || 0) * (item.quantity || 1)) : "—"}
                            </span>
                          </div>
                        ))}
                      </div>

                      <div className="flex items-center justify-between pt-4 border-t border-border gap-2">
                        <div>
                          <p className="text-xs text-muted-foreground">Total</p>
                          <p className="text-xl font-bold text-primary">{formatPrice(totalKitPrice(kit))}</p>
                        </div>
                        <Button variant="hero" onClick={() => handleAddKitToCart(kit)}>
                          <ShoppingCart className="w-4 h-4 mr-1" />
                          Ajouter au panier
                        </Button>
                      </div>
                    </div>
                  </motion.div>
                  ))}
                </div>

                {totalPages > 1 && (
                  <div className="flex items-center justify-center gap-2 mt-8">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={page <= 1}
                      onClick={() => updateParam({ page: String(Math.max(1, page - 1)) })}
                    >
                      Précédent
                    </Button>
                    <span className="text-sm text-muted-foreground px-3">
                      Page {page} / {totalPages} · {totalCount} kits
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={page >= totalPages}
                      onClick={() => updateParam({ page: String(Math.min(totalPages, page + 1)) })}
                    >
                      Suivant
                    </Button>
                  </div>
                )}
              </>
            ) : suggestedProducts.length > 0 ? (
              <div className="max-w-4xl mx-auto">
                <h3 className="text-lg font-bold text-foreground mb-4 flex items-center gap-2">
                  Suggestions pour {LEVELS.find((l) => l.value === selectedLevel)?.label}
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {suggestedProducts.map((product: any) => (
                    <div key={product.id} className="bg-card rounded-xl border border-border p-4">
                      <h4 className="text-sm font-medium text-foreground mb-2 line-clamp-2">{product.name_fr}</h4>
                      <p className="text-primary font-bold">{formatPrice(product.price)}</p>
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full mt-2"
                        onClick={() => addToCart(product.id, 1)}
                      >
                        <ShoppingCart className="w-3 h-3 mr-1" /> Ajouter
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="text-center py-12">
                <Package className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-bold text-foreground mb-2">
                  Aucun kit ne correspond à votre recherche
                </h3>
                <p className="text-muted-foreground">
                  Essayez d'élargir les filtres ou consultez le catalogue complet.
                </p>
              </div>
            )}
          </div>

        </div>
      </section>
      {/* Benefits */}
      <section className="py-16 bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-4xl mx-auto">
            {[
              { icon: Calculator, title: "Économisez jusqu'à 20%", desc: "Les kits sont moins chers que l'achat article par article" },
              { icon: Pencil, title: "Rien n'est oublié", desc: "Chaque kit est vérifié par des enseignants" },
              { icon: Package, title: "Livraison gratuite", desc: "Partout en Côte d'Ivoire, pour tout kit commandé" },
            ].map((item, i) => (
              <div key={i} className="text-center">
                <div className="w-14 h-14 rounded-xl bg-primary/10 flex items-center justify-center mx-auto mb-3">
                  <item.icon className="w-7 h-7 text-primary" />
                </div>
                <h3 className="font-bold text-foreground mb-1">{item.title}</h3>
                <p className="text-sm text-muted-foreground">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <Footer />
    </main>
  );
};

export default SmartKits;
