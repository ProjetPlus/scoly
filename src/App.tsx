import { lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { HelmetProvider } from "react-helmet-async";
import { LanguageProvider } from "@/i18n/LanguageContext";
import { AuthProvider } from "@/contexts/AuthContext";
import { CartProvider } from "@/contexts/CartContext";
import ScrollToTop from "@/components/ScrollToTop";
import ErrorBoundary from "@/components/ErrorBoundary";
import PageLoader from "@/components/PageLoader";
import { SessionSecurityProvider } from "@/components/SessionSecurityProvider";
import RoleGuard from "@/components/RoleGuard";

// Critical path - eager load
import Index from "./pages/Index";

// Lazy-loaded pages for code splitting
const Auth = lazy(() => import("./pages/Auth"));
const Shop = lazy(() => import("./pages/Shop"));
const Cart = lazy(() => import("./pages/Cart"));
const Checkout = lazy(() => import("./pages/Checkout"));
const About = lazy(() => import("./pages/About"));
const Contact = lazy(() => import("./pages/Contact"));
const Account = lazy(() => import("./pages/Account"));
const Admin = lazy(() => import("./pages/Admin"));
const ProductDetail = lazy(() => import("./pages/ProductDetail"));
const Actualites = lazy(() => import("./pages/Actualites"));
const ArticleDetail = lazy(() => import("./pages/ArticleDetail"));
const WriteArticle = lazy(() => import("./pages/WriteArticle"));
const TeamDashboard = lazy(() => import("./pages/TeamDashboard"));
// AuthorDashboard removed
const FAQ = lazy(() => import("./pages/FAQ"));
const ArticlePayment = lazy(() => import("./pages/ArticlePayment"));
const NotFound = lazy(() => import("./pages/NotFound"));
const BootstrapAdmin = lazy(() => import("./pages/BootstrapAdmin"));
const ModeratorDashboard = lazy(() => import("./pages/ModeratorDashboard"));
const VendorDashboard = lazy(() => import("./pages/VendorDashboard"));
const DeliveryDashboard = lazy(() => import("./pages/DeliveryDashboard"));
const Wishlist = lazy(() => import("./pages/Wishlist"));
const MentionsLegales = lazy(() => import("./pages/MentionsLegales"));
const TermsOfUse = lazy(() => import("./pages/TermsOfUse"));
const PrivacyPolicy = lazy(() => import("./pages/PrivacyPolicy"));
const CookiesPolicy = lazy(() => import("./pages/CookiesPolicy"));
const AuthConfirm = lazy(() => import("./pages/AuthConfirm"));
const ResetPassword = lazy(() => import("./pages/ResetPassword"));
const KitsEcole = lazy(() => import("./pages/KitsEcole"));
const Referral = lazy(() => import("./pages/Referral"));
const DeliveryReturns = lazy(() => import("./pages/DeliveryReturns"));
const Unsubscribe = lazy(() => import("./pages/Unsubscribe"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,
      gcTime: 1000 * 60 * 30,
      retry: 2,
      refetchOnWindowFocus: false,
    },
  },
});

const App = () => (
  <ErrorBoundary>
    <HelmetProvider>
      <QueryClientProvider client={queryClient}>
        <LanguageProvider>
          <AuthProvider>
            <SessionSecurityProvider />
            <CartProvider>
              <TooltipProvider>
                <Toaster />
                <Sonner />
                <BrowserRouter>
                  <ScrollToTop />
                  {/* Skip to content - Accessibility */}
                  <a
                    href="#main-content"
                    className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[100] focus:px-4 focus:py-2 focus:bg-primary focus:text-primary-foreground focus:rounded-md focus:outline-none"
                  >
                    Aller au contenu principal
                  </a>
                  <Suspense fallback={<PageLoader />}>
                    <Routes>
                      <Route path="/" element={<Index />} />
                      <Route path="/auth" element={<Auth />} />
                      <Route path="/shop" element={<Shop />} />
                      <Route path="/boutique" element={<Shop />} />
                      <Route path="/shop/product/:id" element={<ProductDetail />} />
                      <Route path="/product/:id" element={<ProductDetail />} />
                      <Route path="/cart" element={<Cart />} />
                      <Route path="/panier" element={<Cart />} />
                      <Route path="/checkout" element={<Checkout />} />
                      <Route path="/about" element={<About />} />
                      <Route path="/a-propos" element={<About />} />
                      <Route path="/contact" element={<Contact />} />
                      <Route path="/account" element={<RoleGuard><Account /></RoleGuard>} />
                      <Route path="/compte" element={<RoleGuard><Account /></RoleGuard>} />
                      <Route path="/admin" element={<RoleGuard allow={["admin"]}><Admin /></RoleGuard>} />
                      <Route path="/actualites" element={<Actualites />} />
                      <Route path="/actualites/write" element={<RoleGuard allow={["admin","moderator","user"]}><WriteArticle /></RoleGuard>} />
                      <Route path="/actualites/edit/:id" element={<RoleGuard allow={["admin","moderator","user"]}><WriteArticle /></RoleGuard>} />
                      <Route path="/actualites/:id" element={<ArticleDetail />} />
                      <Route path="/team" element={<RoleGuard allow={["admin","moderator"]}><TeamDashboard /></RoleGuard>} />
                      
                      <Route path="/faq" element={<FAQ />} />
                      <Route path="/article/pay/:id" element={<RoleGuard><ArticlePayment /></RoleGuard>} />
                      <Route path="/bootstrap-admin" element={<BootstrapAdmin />} />
                      <Route path="/delivery" element={<RoleGuard allow={["delivery","admin"]}><DeliveryDashboard /></RoleGuard>} />
                      <Route path="/moderator" element={<RoleGuard allow={["moderator","admin"]}><ModeratorDashboard /></RoleGuard>} />
                      <Route path="/vendor" element={<RoleGuard allow={["vendor","admin"]}><VendorDashboard /></RoleGuard>} />
                      <Route path="/wishlist" element={<RoleGuard><Wishlist /></RoleGuard>} />
                      <Route path="/mentions-legales" element={<MentionsLegales />} />
                      <Route path="/terms" element={<TermsOfUse />} />
                      <Route path="/privacy" element={<PrivacyPolicy />} />
                      <Route path="/cookies" element={<CookiesPolicy />} />
                      <Route path="/auth/confirm" element={<AuthConfirm />} />
                      <Route path="/auth/reset-password" element={<ResetPassword />} />
                      <Route path="/kits-ecole" element={<KitsEcole />} />
                      <Route path="/parrainage" element={<Referral />} />
                      <Route path="/livraison-retours" element={<DeliveryReturns />} />
                      <Route path="/livraison" element={<DeliveryReturns />} />
                      <Route path="/unsubscribe" element={<Unsubscribe />} />
                      <Route path="*" element={<NotFound />} />
                    </Routes>
                  </Suspense>
                </BrowserRouter>
              </TooltipProvider>
            </CartProvider>
          </AuthProvider>
        </LanguageProvider>
      </QueryClientProvider>
    </HelmetProvider>
  </ErrorBoundary>
);

export default App;
