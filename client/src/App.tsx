import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import { DataProvider } from "./contexts/DataContext";
import Dashboard from "./pages/Dashboard";
import Leads from "./pages/Leads";
import Outbound from "./pages/Outbound";
import Inbound from "./pages/Inbound";
import Content from "./pages/Content";
import ContentCreator from "./pages/ContentCreator";
import Strategy from "./pages/Strategy";
import SocialMedia from "./pages/SocialMedia";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Dashboard} />
      <Route path="/leads" component={Leads} />
      <Route path="/outbound" component={Outbound} />
      <Route path="/inbound" component={Inbound} />
      <Route path="/content" component={Content} />
      <Route path="/content-creator" component={ContentCreator} />
      <Route path="/strategy" component={Strategy} />
      <Route path="/social-media" component={SocialMedia} />
      <Route path="/404" component={NotFound} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="dark">
        <DataProvider>
          <TooltipProvider>
            <Toaster />
            <Router />
          </TooltipProvider>
        </DataProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
