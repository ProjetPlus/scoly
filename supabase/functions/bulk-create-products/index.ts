// @ts-nocheck
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;

const EXTRACT_TOOL = {
  type: "function",
  function: {
    name: "extract_products",
    description:
      "Extrait des produits scolaires/bureautiques depuis les documents/images fournis.",
    parameters: {
      type: "object",
      properties: {
        products: {
          type: "array",
          items: {
            type: "object",
            properties: {
              name_fr: { type: "string", description: "Nom du produit en français" },
              description_fr: { type: "string" },
              category_hint: {
                type: "string",
                description:
                  "Catégorie suggérée: primaire, secondaire, universitaire, bureautique, librairie",
              },
              characteristics: {
                type: "array",
                items: { type: "string" },
                description: "Caractéristiques principales (marque, taille, etc.)",
              },
              estimated_price_fcfa: {
                type: "number",
                description: "Prix estimé en FCFA (Côte d'Ivoire)",
              },
            },
            required: ["name_fr", "description_fr", "estimated_price_fcfa"],
            additionalProperties: false,
          },
        },
      },
      required: ["products"],
      additionalProperties: false,
    },
  },
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const userClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const {
      data: { user },
    } = await userClient.auth.getUser();

    if (!user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: isAdmin } = await supabase.rpc("has_role", {
      _user_id: user.id,
      _role: "admin",
    });
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { files } = await req.json(); // [{ name, mime, dataBase64 }]
    if (!Array.isArray(files) || files.length === 0) {
      return new Response(JSON.stringify({ error: "No files" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Build multimodal content for Gemini via Lovable AI Gateway
    const content: any[] = [
      {
        type: "text",
        text:
          "Analyse ces fichiers (catalogues, photos, listes) et extrais tous les produits scolaires/bureautiques identifiables. Pour chacun : nom en français, description courte, catégorie suggérée, caractéristiques, prix estimé en FCFA (marché ivoirien). Utilise l'outil extract_products.",
      },
    ];

    for (const f of files.slice(0, 10)) {
      if (f.mime?.startsWith("image/")) {
        content.push({
          type: "image_url",
          image_url: { url: `data:${f.mime};base64,${f.dataBase64}` },
        });
      } else {
        // PDFs and docs as file
        content.push({
          type: "image_url",
          image_url: { url: `data:${f.mime};base64,${f.dataBase64}` },
        });
      }
    }

    const aiResp = await fetch(
      "https://ai.gateway.lovable.dev/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-pro",
          messages: [
            {
              role: "system",
              content:
                "Tu es un expert e-commerce scolaire ivoirien. Tu extrais des fiches produits structurées.",
            },
            { role: "user", content },
          ],
          tools: [EXTRACT_TOOL],
          tool_choice: { type: "function", function: { name: "extract_products" } },
        }),
      }
    );

    if (!aiResp.ok) {
      const t = await aiResp.text();
      console.error("AI error", aiResp.status, t);
      if (aiResp.status === 429) {
        return new Response(
          JSON.stringify({ error: "Limite IA atteinte, réessayez plus tard." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (aiResp.status === 402) {
        return new Response(
          JSON.stringify({ error: "Crédits IA épuisés. Rechargez votre workspace." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      return new Response(JSON.stringify({ error: "AI gateway error" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const ai = await aiResp.json();
    const toolCall = ai.choices?.[0]?.message?.tool_calls?.[0];
    const args = toolCall?.function?.arguments
      ? JSON.parse(toolCall.function.arguments)
      : { products: [] };

    const extracted = Array.isArray(args.products) ? args.products : [];

    // ─── Déduplication ───
    const norm = (s: string) => (s || "").toLowerCase().normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();

    const cleanText = (value: unknown, fallback = "") => {
      const text = typeof value === "string" ? value.trim() : "";
      return text || fallback;
    };

    const clampName = (value: unknown, fallback: string) =>
      cleanText(value, fallback).slice(0, 255);

    // 1. Dédup intra-batch (même nom normalisé)
    const seen = new Set<string>();
    const uniqueExtracted = extracted.filter((p: any) => {
      const k = norm(p.name_fr);
      if (!k || seen.has(k)) return false;
      seen.add(k);
      return true;
    });

    // 2. Dédup contre la base existante
    const { data: existing } = await supabase.from("products").select("id, name_fr").limit(5000);
    const existingKeys = new Set((existing || []).map((p: any) => norm(p.name_fr)));
    const toInsert = uniqueExtracted.filter((p: any) => !existingKeys.has(norm(p.name_fr)));
    const skipped = extracted.length - toInsert.length;

    const rows = toInsert.map((p: any) => {
      const baseName = clampName(p.name_fr, "Produit scolaire");
      const baseDescription = cleanText(p.description_fr);

      return {
        name_fr: baseName,
        name_en: clampName(p.name_en, baseName),
        name_de: clampName(p.name_de, baseName),
        name_es: clampName(p.name_es, baseName),
        description_fr: baseDescription,
        description_en: cleanText(p.description_en, baseDescription),
        description_de: cleanText(p.description_de, baseDescription),
        description_es: cleanText(p.description_es, baseDescription),
        price: Number(p.estimated_price_fcfa) || 0,
        stock: 0,
        is_active: false,
        metadata: {
          ai_generated: true,
          characteristics: Array.isArray(p.characteristics) ? p.characteristics : [],
          category_hint: p.category_hint || null,
        },
      };
    });

    let inserted: any[] = [];
    if (rows.length > 0) {
      const { data, error } = await supabase.from("products").insert(rows).select("id, name_fr");
      if (error) {
        console.error("Insert error", error);
        return new Response(JSON.stringify({ error: error.message, extracted }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      inserted = data || [];
    }

    return new Response(
      JSON.stringify({ success: true, count: inserted.length, skipped, products: inserted }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("bulk-create-products error", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
