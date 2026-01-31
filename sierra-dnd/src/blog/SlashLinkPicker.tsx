import { useEffect, useMemo, useState } from "react";
import { collection, getDocs, limit, orderBy, query } from "firebase/firestore";
import { db } from "../firebase";

type Kind = "blog" | "forum" | "calendar" | "guide";

// Vite base URL: "/" on localhost, "/Sierra-DND/" on GitHub Pages
const BASE_URL = (import.meta as any).env.BASE_URL ?? "/";

// Make sure we end with exactly one trailing slash
function normalizeBase(base: string) {
  if (!base) return "/";
  return base.endsWith("/") ? base : base + "/";
}
const BASE = normalizeBase(BASE_URL);

// Build an app-internal absolute path that respects BASE
function appHref(pathNoLeadingSlash: string) {
  // pathNoLeadingSlash: "blog/slug" or "calendar?event=ID"
  return `${BASE}${pathNoLeadingSlash}`;
}

export function SlashLinkPicker({
  kind,
  onPick,
  onClose,
}: {
  kind: Kind;
  onPick: (label: string, href: string) => void;
  onClose: () => void;
}) {
  const [items, setItems] = useState<{ label: string; href: string }[]>([]);
  const [search, setSearch] = useState("");

  useEffect(() => {
    (async () => {
      if (kind === "blog") {
        const q = query(collection(db, "blogPosts"), orderBy("createdAt", "desc"), limit(50));
        const snap = await getDocs(q);
        setItems(
          snap.docs
            .map((d) => {
              const data: any = d.data();
              const slug = data.slug;
              if (!slug) return null;
              return { label: data.title ?? d.id, href: appHref(`blog/${slug}`) };
            })
            .filter(Boolean) as any
        );
        return;
      }

      if (kind === "calendar") {
        const q = query(collection(db, "events"), orderBy("startAt", "desc"), limit(50));
        const snap = await getDocs(q);
        setItems(
          snap.docs.map((d) => {
            const data: any = d.data();
            const title = data.title ?? "Untitled Event";
            return { label: title, href: appHref(`calendar?event=${d.id}`) };
          })
        );
        return;
      }

      if (kind === "forum") {
        const q = query(collection(db, "forumTopics"), orderBy("createdAt", "desc"), limit(50));
        const snap = await getDocs(q);
        setItems(
          snap.docs.map((d) => {
            const data: any = d.data();
            const title = data.title ?? "Untitled Topic";
            return { label: title, href: appHref(`forum?topic=${d.id}`) };
          })
        );
        return;
      }

      if (kind === "guide") {
        const q = query(collection(db, "guideItems"), orderBy("createdAt", "desc"), limit(50));
        const snap = await getDocs(q);
        setItems(
          snap.docs.map((d) => {
            const data: any = d.data();
            const title = data.title ?? "Guide";
            return { label: title, href: appHref(`guides?item=${d.id}`) };
          })
        );
        return;
      }

      setItems([]);
    })();
  }, [kind]);

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    if (!s) return items;
    return items.filter((i) => i.label.toLowerCase().includes(s));
  }, [items, search]);

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.55)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 50,
      }}
      onMouseDown={onClose}
    >
      <div
        className="card"
        style={{ width: 560, maxHeight: 520, overflow: "auto" }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
          <div style={{ fontWeight: 900 }}>Insert link: /{kind}</div>
          <button onClick={onClose}>Close</button>
        </div>

        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Type to filter…"
          style={{
            width: "100%",
            marginTop: 12,
            padding: "10px 12px",
            borderRadius: 2,
            border: "1px solid var(--border)",
            background: "transparent",
            color: "var(--text)",
          }}
          autoFocus
        />

        <div style={{ marginTop: 12, display: "grid", gap: 8 }}>
          {filtered.map((it) => (
            <button
              key={it.href}
              onClick={() => onPick(it.label, it.href)}
              style={{
                textAlign: "left",
                padding: "10px 12px",
                borderRadius: 2,
                border: "1px solid var(--border)",
                background: "transparent",
                color: "var(--text)",
                cursor: "pointer",
              }}
            >
              <div style={{ fontWeight: 800 }}>{it.label}</div>
            </button>
          ))}
          {filtered.length === 0 ? <div className="small">No results.</div> : null}
        </div>
      </div>
    </div>
  );
}
