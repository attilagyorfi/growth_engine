import { trpc } from "@/lib/trpc";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { httpBatchLink } from "@trpc/client";
import { createRoot } from "react-dom/client";
import superjson from "superjson";
import * as Sentry from "@sentry/react";
import App from "./App";
import { LanguageProvider } from "./contexts/LanguageContext";
import { initSentry } from "./lib/sentry";
import "./index.css";

initSentry();

const queryClient = new QueryClient();

queryClient.getQueryCache().subscribe(event => {
  if (event.type === "updated" && event.action.type === "error") {
    console.error("[API Query Error]", event.query.state.error);
  }
});

queryClient.getMutationCache().subscribe(event => {
  if (event.type === "updated" && event.action.type === "error") {
    console.error("[API Mutation Error]", event.mutation.state.error);
  }
});

const trpcClient = trpc.createClient({
  links: [
    httpBatchLink({
      url: "/api/trpc",
      transformer: superjson,
      fetch(input, init) {
        return globalThis.fetch(input, {
          ...(init ?? {}),
          credentials: "include",
        });
      },
    }),
  ],
});

createRoot(document.getElementById("root")!).render(
  <Sentry.ErrorBoundary
    fallback={
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 12, padding: 24, textAlign: "center", background: "var(--qa-bg, #0A0B0F)", color: "var(--qa-fg, #F5F6F8)", fontFamily: "system-ui, sans-serif" }}>
        <p style={{ fontSize: 18, fontWeight: 600 }}>Hoppá, valami hiba történt.</p>
        <p style={{ fontSize: 14, opacity: 0.7 }}>A hibát rögzítettük. Töltsd újra az oldalt, és próbáld meg ismét.</p>
        <button onClick={() => window.location.reload()} style={{ marginTop: 8, padding: "10px 18px", borderRadius: 8, border: "none", background: "var(--qa-accent, #8B5CF6)", color: "#fff", fontWeight: 600, cursor: "pointer" }}>
          Oldal újratöltése
        </button>
      </div>
    }
  >
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>
        <LanguageProvider>
          <App />
        </LanguageProvider>
      </QueryClientProvider>
    </trpc.Provider>
  </Sentry.ErrorBoundary>
);
