import { useCallback, useEffect, useState } from "react";
import { Layout } from "./components/Layout";
import { Toast, type ToastState } from "./components/ui/Toast";
import { Dashboard } from "./pages/Dashboard";
import { Explore } from "./pages/Explore";
import { Collection } from "./pages/Collection";
import { useAppStore } from "./store/useAppStore";

export function App() {
  const view = useAppStore((state) => state.view);
  const [toast, setToast] = useState<ToastState>(null);

  const showToast = useCallback((next: ToastState) => {
    setToast(next);
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timeout = window.setTimeout(() => setToast(null), 3500);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  return (
    <Layout>
      {view === "dashboard" && <Dashboard />}
      {view === "explore" && <Explore onToast={showToast} />}
      {view === "collection" && <Collection onToast={showToast} />}
      {view === "trades" && <Collection tradeOnly onToast={showToast} />}
      <Toast toast={toast} onClose={() => setToast(null)} />
    </Layout>
  );
}
