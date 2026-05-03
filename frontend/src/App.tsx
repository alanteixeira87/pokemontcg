import { useCallback, useEffect, useState } from "react";
import { Layout } from "./components/Layout";
import { Toast, type ToastState } from "./components/ui/Toast";
import { Dashboard } from "./pages/Dashboard";
import { Explore } from "./pages/Explore";
import { Collection } from "./pages/Collection";
import { useAppStore } from "./store/useAppStore";
import { AuthPage } from "./pages/AuthPage";
import { TradeMarket } from "./pages/TradeMarket";
import type { View } from "./store/useAppStore";

const validViews: View[] = ["dashboard", "explore", "collection", "trades"];

function viewFromHash(): View | null {
  const value = window.location.hash.replace(/^#\/?/, "");
  return validViews.includes(value as View) ? value as View : null;
}

export function App() {
  const view = useAppStore((state) => state.view);
  const setView = useAppStore((state) => state.setView);
  const token = useAppStore((state) => state.token);
  const theme = useAppStore((state) => state.theme);
  const [toast, setToast] = useState<ToastState>(null);

  const showToast = useCallback((next: ToastState) => {
    setToast(next);
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timeout = window.setTimeout(() => setToast(null), 3500);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
    document.body.classList.toggle("dark", theme === "dark");
  }, [theme]);

  useEffect(() => {
    const syncViewFromHash = () => {
      const nextView = viewFromHash();
      if (nextView && nextView !== useAppStore.getState().view) {
        setView(nextView);
      }
    };

    syncViewFromHash();
    window.addEventListener("hashchange", syncViewFromHash);
    return () => window.removeEventListener("hashchange", syncViewFromHash);
  }, [setView]);

  if (!token) {
    return (
      <>
        <AuthPage onToast={showToast} />
        <Toast toast={toast} onClose={() => setToast(null)} />
      </>
    );
  }

  return (
    <Layout>
      {view === "dashboard" && <Dashboard />}
      {view === "explore" && <Explore onToast={showToast} />}
      {view === "collection" && <Collection onToast={showToast} />}
      {view === "trades" && <TradeMarket onToast={showToast} />}
      <Toast toast={toast} onClose={() => setToast(null)} />
    </Layout>
  );
}
