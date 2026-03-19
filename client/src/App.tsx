import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch, Redirect } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import { DataProvider } from "./contexts/DataContext";
import { ProfileProvider } from "./contexts/ProfileContext";
import Dashboard from "./pages/Dashboard";
import Clients from "./pages/Clients";
import Strategy from "./pages/Strategy";
import ContentStudio from "./pages/ContentStudio";
import SalesOps from "./pages/SalesOps";
import Analytics from "./pages/Analytics";
import Settings from "./pages/Settings";
import Login from "./pages/Login";
import OnboardingWizard from "./pages/OnboardingWizard";
import Intelligence from "./pages/Intelligence";
import AIWriter from "./pages/AIWriter";
import ProfilePage from "./pages/ProfilePage";
// Legacy pages kept for backward compatibility
import Leads from "./pages/Leads";
import Outbound from "./pages/Outbound";
import Inbound from "./pages/Inbound";
import Content from "./pages/Content";
import ContentCreator from "./pages/ContentCreator";
import SocialMedia from "./pages/SocialMedia";
import { useAuth } from "./_core/hooks/useAuth";
import DashboardLayoutSkeleton from "./components/DashboardLayoutSkeleton";

function ProtectedRoute({ component: Component }: { component: React.ComponentType }) {
  const { isAuthenticated, loading } = useAuth();
  if (loading) return <DashboardLayoutSkeleton />;
  if (!isAuthenticated) return <Redirect to="/login" />;
  return <Component />;
}

function Router() {
  return (
    <Switch>
      <Route path="/login" component={Login} />
      {/* Main 7-item navigation */}
      <Route path="/" component={() => <ProtectedRoute component={Dashboard} />} />
      <Route path="/clients" component={() => <ProtectedRoute component={Clients} />} />
      <Route path="/clients/new" component={() => <ProtectedRoute component={Clients} />} />
      <Route path="/strategy" component={() => <ProtectedRoute component={Strategy} />} />
      <Route path="/content-studio" component={() => <ProtectedRoute component={ContentStudio} />} />
      <Route path="/sales-ops" component={() => <ProtectedRoute component={SalesOps} />} />
      <Route path="/analytics" component={() => <ProtectedRoute component={Analytics} />} />
      <Route path="/settings" component={() => <ProtectedRoute component={Settings} />} />
      {/* Sub-flows */}
      <Route path="/onboarding" component={() => <ProtectedRoute component={OnboardingWizard} />} />
      <Route path="/intelligence" component={() => <ProtectedRoute component={Intelligence} />} />
      <Route path="/ai-writer" component={() => <ProtectedRoute component={AIWriter} />} />
      <Route path="/profile" component={() => <ProtectedRoute component={ProfilePage} />} />
      {/* Legacy redirects */}
      <Route path="/leads" component={() => <Redirect to="/sales-ops" />} />
      <Route path="/outbound" component={() => <Redirect to="/sales-ops" />} />
      <Route path="/inbound" component={() => <Redirect to="/sales-ops" />} />
      <Route path="/content" component={() => <Redirect to="/content-studio" />} />
      <Route path="/content-creator" component={() => <Redirect to="/content-studio" />} />
      <Route path="/social-media" component={() => <Redirect to="/content-studio" />} />
      <Route path="/404" component={NotFound} />
      <Route component={NotFound} />
    </Switch>
  );
}

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
