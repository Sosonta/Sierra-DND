import { useEffect, useMemo, useState } from "react";
import { collection, onSnapshot, orderBy, query } from "firebase/firestore";
import { Link } from "react-router-dom";
import { auth, db } from "../firebase";
import type { BlogPost, BlogTag } from "../types/blog";
import { BLOG_TAGS } from "../types/blog";
import { doc } from "firebase/firestore";


type UserDoc = { roles?: string[] };

export function BlogPage() {
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [roles, setRoles] = useState<string[]>([]);
  const [tag, setTag] = useState<BlogTag | "All">("All");
  const [year, setYear] = useState<number | "All">("All");
  const [month, setMonth] = useState<number | "All">("All");

  useEffect(() => {
    // Subscribe to posts
    const q = query(collection(db, "blogPosts"), orderBy("createdAt", "desc"));
    const unsub = onSnapshot(q, (snap) => {
      const rows: BlogPost[] = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));
      setPosts(rows);
    });
    return () => unsub();
  }, []);

  // Proper roles subscribe:
useEffect(() => {
  const u = auth.currentUser;
  if (!u) return;

  const unsub = onSnapshot(doc(db, "users", u.uid), (snap) => {
    const data = snap.data() as UserDoc | undefined;
    setRoles(Array.isArray(data?.roles) ? data!.roles! : []);
  });
  return () => unsub();
}, []);


  const canCreate = roles.includes("Admin") || roles.includes("Officer") || roles.includes("Moderator");

  const yearsAvailable = useMemo(() => {
    const ys = new Set<number>();
    for (const p of posts) {
      const dt = p.createdAt?.toDate?.();
      if (dt) ys.add(dt.getFullYear());
    }
    return Array.from(ys).sort((a, b) => b - a);
  }, [posts]);

  const filtered = useMemo(() => {
    return posts.filter((p) => {
      if (tag !== "All" && !(p.tags ?? []).includes(tag)) return false;

      const dt = p.createdAt?.toDate?.();
      if (!dt) return true;

      if (year !== "All" && dt.getFullYear() !== year) return false;
      if (month !== "All" && dt.getMonth() + 1 !== month) return false;

      return true;
    });
  }, [posts, tag, year, month]);

  return (
    <div style={{ display: "grid", gap: 14, maxWidth: 980 }}>
      <div className="card" style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div>
          <h1 style={{ margin: 0 }}>Blog</h1>
        </div>

        {canCreate ? (
          <Link
            to="/blog/new"
            style={{
              alignSelf: "center",
              padding: "10px 12px",
              border: "1px solid var(--border)",
              background: "var(--accent)",
              color: "white",
              fontWeight: 800,
              textDecoration: "none",
            }}
          >
            + New Post
          </Link>
        ) : null}
      </div>

      <div className="card" style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
        <label className="small">
          Tag{" "}
          <select value={tag} onChange={(e) => setTag(e.target.value as any)}>
            <option value="All">All</option>
            {BLOG_TAGS.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </label>

        <label className="small">
          Year{" "}
          <select value={year} onChange={(e) => setYear(e.target.value === "All" ? "All" : Number(e.target.value))}>
            <option value="All">All</option>
            {yearsAvailable.map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </label>

        <label className="small">
          Month{" "}
          <select value={month} onChange={(e) => setMonth(e.target.value === "All" ? "All" : Number(e.target.value))}>
            <option value="All">All</option>
            {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
        </label>

        <div className="small" style={{ marginLeft: "auto" }}>
          Showing {filtered.length} post(s)
        </div>
      </div>

      <div style={{ display: "grid", gap: 10 }}>
        {filtered.map((p) => (
          <Link
            key={p.id}
            to={`/blog/${p.slug}`}
            className="card"
            style={{ textDecoration: "none", color: "inherit" }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
              <div style={{ fontWeight: 900, fontSize: 18 }}>{p.title}</div>
              <div className="small">
                {p.createdAt?.toDate?.() ? p.createdAt.toDate().toLocaleString() : ""}
              </div>
            </div>
            <div className="small" style={{ marginTop: 6 }}>
              {(p.tags ?? []).join(" • ")}
            </div>
          </Link>
        ))}
        {filtered.length === 0 ? <div className="small">No posts match your filters.</div> : null}
      </div>
    </div>
  );
}
