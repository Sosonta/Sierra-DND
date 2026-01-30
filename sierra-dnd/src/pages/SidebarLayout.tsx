import { useMemo, useState } from "react";
import { Link, Outlet, useLocation } from "react-router-dom";
import { auth } from "../firebase";
import { logOut } from "../auth";

export function SidebarLayout() {
  const [open, setOpen] = useState(true);
  const loc = useLocation();

  const links = useMemo(() => ([
    { to: "/", label: "Landing" },
    { to: "/blog", label: "Blog" },
    { to: "/calendar", label: "Calendar" },
    { to: "/forum", label: "Forum" },
    { to: "/guides", label: "Helpful Guides" },
    { to: "/profile", label: "Profile" },
  ]), []);

  return (
    <div style={{ display: "flex", minHeight: "100vh" }}>
      <aside
        style={{
          width: open ? 240 : 60,
          borderRight: "1px solid #333",
          padding: 12,
          transition: "width 0.15s ease",
        }}
      >
        <button onClick={() => setOpen(v => !v)} style={{ width: "100%" }}>
          {open ? "Hide" : "Show"}
        </button>

        <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 8 }}>
          {links.map(l => (
            <Link
              key={l.to}
              to={l.to}
              style={{
                textDecoration: "none",
                padding: "8px 10px",
                borderRadius: 8,
                background: loc.pathname === l.to ? "#222" : "transparent",
                color: "inherit"
              }}
              title={l.label}
            >
              {open ? l.label : l.label[0]}
            </Link>
          ))}
        </div>

        <div style={{ marginTop: 16, borderTop: "1px solid #333", paddingTop: 12 }}>
          {auth.currentUser ? (
            <button onClick={() => void logOut()} style={{ width: "100%" }}>
              Log out
            </button>
          ) : null}
        </div>
      </aside>

      <main style={{ flex: 1, padding: 16 }}>
        <Outlet />
      </main>
    </div>
  );
}
