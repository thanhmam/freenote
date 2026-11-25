import { useCallback, useEffect, useState } from "react";
import { api } from "./api.js";
import { store, usePages, navigate } from "./store.js";
import Sidebar from "./Sidebar.jsx";
import PageView from "./PageView.jsx";
import SearchModal from "./SearchModal.jsx";
import { t } from "./i18n.js";

const routeId = () => (window.location.hash.match(/^#\/p\/([\w-]+)/) || [])[1] || null;

export default function App() {
  const { pages, byId } = usePages();
  const [currentId, setCurrentId] = useState(routeId);
  const [loaded, setLoaded] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(() => localStorage.getItem("sidebar") !== "0");
  const [theme, setTheme] = useState(
    () => localStorage.getItem("theme") || (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light")
  );

  const refresh = useCallback(async () => store.setPages(await api.list()), []);

  useEffect(() => {
    refresh().then(() => setLoaded(true));
    const onHash = () => setCurrentId(routeId());
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, [refresh]);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem("theme", theme);
  }, [theme]);

  useEffect(() => localStorage.setItem("sidebar", sidebarOpen ? "1" : "0"), [sidebarOpen]);

  // open first page if none selected / selected page vanished
  useEffect(() => {
    if (!loaded) return;
    if (!currentId || !byId[currentId]) {
      const first = pages.find((p) => !p.parent_id && !p.is_template);
      if (first && first.id !== currentId) navigate(first.id);
    }
  }, [loaded, currentId, byId, pages]);

  const createPage = useCallback(
    async (parent_id = null) => {
      const p = await api.create({ parent_id });
      await refresh();
      navigate(p.id);
      return p;
    },
    [refresh]
  );

  useEffect(() => {
    const onKey = (e) => {
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setSearchOpen((v) => !v);
      } else if (mod && e.key === "\\") {
        e.preventDefault();
        setSidebarOpen((v) => !v);
      } else if (mod && e.altKey && e.key.toLowerCase() === "n") {
        e.preventDefault();
        createPage(null);
      } else if (e.key === "Escape") setSearchOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [createPage]);

  return (
    <div className={`app ${sidebarOpen ? "" : "sidebar-hidden"}`}>
      {sidebarOpen && (
        <Sidebar
          currentId={currentId}
          refresh={refresh}
          createPage={createPage}
          openSearch={() => setSearchOpen(true)}
          theme={theme}
          toggleTheme={() => setTheme((t) => (t === "dark" ? "light" : "dark"))}
          collapse={() => setSidebarOpen(false)}
        />
      )}
      <main className="main">
        {currentId && byId[currentId] ? (
          <PageView
            key={currentId}
            id={currentId}
            theme={theme}
            refresh={refresh}
            createPage={createPage}
            sidebarOpen={sidebarOpen}
            openSidebar={() => setSidebarOpen(true)}
          />
        ) : (
          loaded && (
            <div className="empty">
              {!sidebarOpen && (
                <button className="icon-btn floating-toggle" onClick={() => setSidebarOpen(true)}>☰</button>
              )}
              <p>{t("No pages yet.")}</p>
              <button className="btn" onClick={() => createPage(null)}>{t("+ New page")}</button>
            </div>
          )
        )}
      </main>
      {searchOpen && <SearchModal onClose={() => setSearchOpen(false)} />}
    </div>
  );
}
