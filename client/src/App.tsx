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

// Public pages
import Landing from "./pages/Landing";
import Login from "./pages/Login";
import Register from "./pages/Register";
import ForgotPassword from "./pages/ForgotPassword";

// App pages (protected)
import Dashboard from "./pages/Dashboard";
import Clients from "./pages/Clients";
import Strategy from "./pages/Strategy";
import ContentStudio from "./pages/ContentStudio";
import SalesOps from "./pages/SalesOps";
import Analytics from "./pages/Analytics";
import Settings from "./pages/Settings";
import OnboardingWizard from "./pages/OnboardingWizard";
import Intelligence from "./pages/Intelligence";
import AIWriter from "./pages/AIWriter";
import ProfilePage from "./pages/ProfilePage";

// Admin pages
import AdminUsers from "./pages/AdminUsers";

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

function PublicOnlyRoute({ component: Component }: { component: React.ComponentType }) {
  const { user, loading } = useAppAuth();
  if (loading) return <DashboardLayoutSkeleton />;
  if (user) {
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
      <Route path="/regisztracio" component={() => <PublicOnlyRoute component={Register} />} />
      <Route path="/elfelejtett-jelszo" component={ForgotPassword} />

      {/* Onboarding */}
      <Route path="/onboarding" component={() => <OnboardingRoute component={OnboardingWizard} />} />

      {/* App routes (require login + onboarding) */}
      <Route path="/iranyitopult" component={() => <AppRoute component={Dashboard} />} />
      <Route path="/ugyfelek" component={() => <AppRoute component={Clients} />} />
      <Route path="/ugyfelek/uj" component={() => <AppRoute component={Clients} />} />
      <Route path="/strategia" component={() => <AppRoute component={Strategy} />} />
      <Route path="/tartalom-studio" component={() => <AppRoute component={ContentStudio} />} />
      <Route path="/ertekesites" component={() => <AppRoute component={SalesOps} />} />
      <Route path="/analitika" component={() => <AppRoute component={Analytics} />} />
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
      <ThemeProvider defaultTheme="dark">
        <ProfileProvider>
          <DataProvider>
            <TooltipProvider>
              <Toaster />
              <Router />
            </TooltipProvider>
          </DataProvider>
        </ProfileProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
