import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch, Redirect } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import { DataProvider } from "./contexts/DataContext";
import { ProfileProvider } from "./contexts/ProfileContext";
import DashboardLayoutSkeleton from "./components/DashboardLayoutSkeleton";
import { useAppAuth } from "./hooks/useAppAuth";

import { lazy, Suspense } from "react";

// Public pages
const Landing = lazy(() => import("./pages/Landing"));
const Login = lazy(() => import("./pages/Login"));
const Register = lazy(() => import("./pages/Register"));
const ForgotPassword = lazy(() => import("./pages/ForgotPassword"));
const ResetPassword = lazy(() => import("./pages/ResetPassword"));

// App pages (protected)
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Clients = lazy(() => import("./pages/Clients"));
const Strategy = lazy(() => import("./pages/Strategy"));
const ContentStudio = lazy(() => import("./pages/ContentStudio"));
const SalesOps = lazy(() => import("./pages/SalesOps"));
const Analytics = lazy(() => import("./pages/Analytics"));
const Campaigns = lazy(() => import("./pages/Campaigns"));
const Settings = lazy(() => import("./pages/Settings"));
const OnboardingWizard = lazy(() => import("./pages/OnboardingWizard"));
const Intelligence = lazy(() => import("./pages/Intelligence"));
const AIWriter = lazy(() => import("./pages/AIWriter"));
const ProfilePage = lazy(() => import("./pages/ProfilePage"));

// Admin pages
const AdminUsers = lazy(() => import("./pages/AdminUsers"));

// ─── Route Guards ─────────────────────────────────────────────────────────────

function AppRoute({ component: Component }: { component: React.ComponentType }) {
  const { user, loading } = useAppAuth();
  if (loading) return <DashboardLayoutSkeleton />;
  if (!user) return <Redirect to="/bejelentkezes" />;
  // If onboarding not done, redirect to onboarding (except if already there)
  if (!user.onboardingCompleted) return <Redirect to="/onboarding" />;
  return <Component />;
}

function OnboardingRoute({ component: Component }: { component: React.ComponentType }) {
  const { user, loading } = useAppAuth();
  if (loading) return <DashboardLayoutSkeleton />;
  if (!user) return <Redirect to="/bejelentkezes" />;
  if (user.onboardingCompleted) return <Redirect to="/iranyitopult" />;
  return <Component />;
}

function AdminRoute({ component: Component }: { component: React.ComponentType }) {
  const { user, loading } = useAppAuth();
  if (loading) return <DashboardLayoutSkeleton />;
  if (!user) return <Redirect to="/bejelentkezes" />;
  if (user.role !== "super_admin") return <Redirect to="/iranyitopult" />;
  return <Component />;
}

// PublicOnlyRoute: only redirects /bejelentkezes away if already logged in.
// /regisztracio is always accessible so landing CTAs work correctly.
function PublicOnlyRoute({ component: Component, allowAuthenticated }: { component: React.ComponentType; allowAuthenticated?: boolean }) {
  const { user, loading } = useAppAuth();
  if (loading) return <DashboardLayoutSkeleton />;
  if (user && !allowAuthenticated) {
    if (!user.onboardingCompleted) return <Redirect to="/onboarding" />;
    return <Redirect to="/iranyitopult" />;
  }
  return <Component />;
}

// ─── Router ───────────────────────────────────────────────────────────────────

function Router() {
  return (
    <Switch>
      {/* Public routes */}
      <Route path="/" component={Landing} />
      <Route path="/bejelentkezes" component={() => <PublicOnlyRoute component={Login} />} />
      <Route path="/regisztracio" component={() => <PublicOnlyRoute component={Register} allowAuthenticated={true} />} />
      <Route path="/elfelejtett-jelszo" component={ForgotPassword} />
      <Route path="/jelszo-visszaallitas" component={ResetPassword} />
      <Route path="/reset-password" component={ResetPassword} />

      {/* Onboarding */}
      <Route path="/onboarding" component={() => <OnboardingRoute component={OnboardingWizard} />} />

      {/* App routes (require login + onboarding) */}
      <Route path="/iranyitopult" component={() => <AppRoute component={Dashboard} />} />
      <Route path="/ugyfelek" component={() => <AdminRoute component={Clients} />} />
      <Route path="/ugyfelek/uj" component={() => <AdminRoute component={Clients} />} />
      <Route path="/strategia" component={() => <AppRoute component={Strategy} />} />
      <Route path="/tartalom-studio" component={() => <AppRoute component={ContentStudio} />} />
      <Route path="/ertekesites" component={() => <AppRoute component={SalesOps} />} />
      <Route path="/analitika" component={() => <AppRoute component={Analytics} />} />
      <Route path="/kampanyok" component={() => <AppRoute component={Campaigns} />} />
      <Route path="/beallitasok" component={() => <AppRoute component={Settings} />} />
      <Route path="/intelligencia" component={() => <AppRoute component={Intelligence} />} />
      <Route path="/ai-iro" component={() => <AppRoute component={AIWriter} />} />
      <Route path="/profil" component={() => <AppRoute component={ProfilePage} />} />

      {/* Admin routes */}
      <Route path="/admin/felhasznalok" component={() => <AdminRoute component={AdminUsers} />} />

      {/* Legacy English URL redirects */}
      <Route path="/login" component={() => <Redirect to="/bejelentkezes" />} />
      <Route path="/dashboard" component={() => <Redirect to="/iranyitopult" />} />
      <Route path="/clients" component={() => <Redirect to="/ugyfelek" />} />
      <Route path="/strategy" component={() => <Redirect to="/strategia" />} />
      <Route path="/content-studio" component={() => <Redirect to="/tartalom-studio" />} />
      <Route path="/sales-ops" component={() => <Redirect to="/ertekesites" />} />
      <Route path="/analytics" component={() => <Redirect to="/analitika" />} />
      <Route path="/campaigns" component={() => <Redirect to="/kampanyok" />} />
      <Route path="/settings" component={() => <Redirect to="/beallitasok" />} />
      <Route path="/leads" component={() => <Redirect to="/ertekesites" />} />
      <Route path="/outbound" component={() => <Redirect to="/ertekesites" />} />
      <Route path="/inbound" component={() => <Redirect to="/ertekesites" />} />
      <Route path="/content" component={() => <Redirect to="/tartalom-studio" />} />
      <Route path="/content-creator" component={() => <Redirect to="/tartalom-studio" />} />
      <Route path="/social-media" component={() => <Redirect to="/tartalom-studio" />} />
      <Route path="/intelligence" component={() => <Redirect to="/intelligencia" />} />
      <Route path="/ai-writer" component={() => <Redirect to="/ai-iro" />} />
      <Route path="/profile" component={() => <Redirect to="/profil" />} />

      <Route path="/404" component={NotFound} />
      <Route component={NotFound} />
    </Switch>
  );
}

// ─── App ──────────────────────────────────────────────────────────────────────

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="dark" switchable={true}>
        <ProfileProvider>
          <DataProvider>
            <TooltipProvider>
              <Toaster />
              <Suspense fallback={<DashboardLayoutSkeleton />}>
                <Router />
              </Suspense>
            </TooltipProvider>
          </DataProvider>
        </ProfileProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
