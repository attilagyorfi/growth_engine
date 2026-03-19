import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch, Redirect } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import { DataProvider } from "./contexts/DataContext";
import { ProfileProvider } from "./contexts/ProfileContext";
import Dashboard from "./pages/Dashboard";
import Leads from "./pages/Leads";
import Outbound from "./pages/Outbound";
import Inbound from "./pages/Inbound";
import Content from "./pages/Content";
import ContentCreator from "./pages/ContentCreator";
import Strategy from "./pages/Strategy";
import SocialMedia from "./pages/SocialMedia";
import Analytics from "./pages/Analytics";
import ProfilePage from "./pages/ProfilePage";
import Login from "./pages/Login";
import OnboardingWizard from "./pages/OnboardingWizard";
import Intelligence from "./pages/Intelligence";
import AIWriter from "./pages/AIWriter";
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
      <Route path="/" component={() => <ProtectedRoute component={Dashboard} />} />
      <Route path="/leads" component={() => <ProtectedRoute component={Leads} />} />
      <Route path="/outbound" component={() => <ProtectedRoute component={Outbound} />} />
      <Route path="/inbound" component={() => <ProtectedRoute component={Inbound} />} />
      <Route path="/content" component={() => <ProtectedRoute component={Content} />} />
      <Route path="/content-creator" component={() => <ProtectedRoute component={ContentCreator} />} />
      <Route path="/strategy" component={() => <ProtectedRoute component={Strategy} />} />
      <Route path="/social-media" component={() => <ProtectedRoute component={SocialMedia} />} />
      <Route path="/analytics" component={() => <ProtectedRoute component={Analytics} />} />
      <Route path="/profile" component={() => <ProtectedRoute component={ProfilePage} />} />
      <Route path="/onboarding" component={() => <ProtectedRoute component={OnboardingWizard} />} />
      <Route path="/intelligence" component={() => <ProtectedRoute component={Intelligence} />} />
      <Route path="/ai-writer" component={() => <ProtectedRoute component={AIWriter} />} />
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
