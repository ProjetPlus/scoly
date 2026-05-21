# Plan de refonte Scoly — 4 vagues

Spec énorme (~10 modules). Je livre par vagues cohérentes plutôt qu'en un seul coup cassé. Chaque vague est testable indépendamment.

## Vague 1 — Fondations (ce message)

**Backend**
- Vérifier sync Supabase (linter + RLS audit) — pas de migration destructrice
- Créer bucket `product-sources` (temporaire, auto-purge) et `kit-uploads`

**Module 5 — Nettoyage UI**
- Retirer "Ressources" du menu public (Navbar)
- Retirer onglets "Ressources IA" et "Écoles IA" du dashboard admin Education IA
- Menu conditionnel : public vs dashboard

**Module 2 (squelette) — IA Produits bulk**
- Edge function `bulk-create-products` (Gemini 2.5 Pro multimodal via Lovable AI Gateway)
- UI Admin > Produits > bouton "Import IA (dossier)" avec drag-drop multi-fichiers
- Extraction : nom, description, catégorie, caractéristiques, prix estimé
- Création produits en draft, éditables après

## Vague 2 — IA Kits + Page publique

**Module 3 — Admin Kit IA**
- Edge function `generate-kit-from-docs` (lit PDF/Word/PPTX/images, extrait fournitures, match produits existants)
- UI dans Education IA > "Générer Kit Scolaire" avec upload

**Module 4 — Page /kit refonte**
- 100% publique (pas d'auth)
- Mode "Acheter un kit" : sélection classe + série, liste kits existants, ajout panier
- Mode "Composer mon kit" : upload doc → IA → résultat éditable
- Modification kit : remplacement produit par filtres (catégorie/matière/série/classe)

## Vague 3 — Auth, Rôles, Emails

**Module 6 — Users & Rôles**
- Edge function `create-internal-user` (admin crée user + assigne rôle)
- UI Admin > Utilisateurs > "Créer utilisateur interne"
- Redirection post-login selon rôle (admin/vendeur/livreur/modérateur)

**Module 7 — Emails**
- Auto-confirm signup client (désactiver email confirm Supabase côté config)
- Email automatique création user admin (mdp temp `@Scoly001` + lien reset)
- Templates branded Scoly via Brevo (prioritaire) avec fallback Resend
- Emails système : inscription, reset, création admin, changement mdp

## Vague 4 — Polish & Dashboard

**Module 5 (suite)**
- Réorganisation menu dashboard admin en groupes logiques
- Menu public masqué dans dashboard

**Module 8**
- Vérification globale : aucun bouton inactif, aucune page orpheline

---

## Détails techniques

**IA Gateway** : `https://ai.gateway.lovable.dev/v1`, model `google/gemini-2.5-pro` (multimodal natif pour PDF/images/manuscrits)

**Stockage fichiers** : bucket `product-sources` temporaire, suppression après traitement réussi

**Format réponse IA** : structured output via `Output.object` avec schéma Zod

**Sécurité** : toutes les edge functions IA vérifient `has_role(auth.uid(), 'admin')` avant traitement

---

Je commence la **Vague 1** dès approbation. Les vagues 2-4 suivront sans nouvelle approbation, sauf si vous voulez réorienter.
