import { useMemo, useState } from "react";
import { Link, Outlet, useLocation } from "react-router-dom";
import { auth } from "../firebase";
import { logOut } from "../auth";
import logo from "../assets/logo.png";


export function SidebarLayout() {
  const loc = useLocation();

  const links = useMemo(
    () => [
    { to: "/", label: "Home", className: "nav-landing" },
      { to: "/blog", label: "Blog" },
      { to: "/calendar", label: "Calendar" },
      { to: "/profile", label: "Profile" },
      { to: "/admin/users", label: "Admin" },
    ],
    []
  );

  const SIDEBAR_W = 240;
  const TAB_W = 44;

  const [open, setOpen] = useState(true);

  // When closed, we slide left but keep TAB_W visible
  const closedOffset = SIDEBAR_W - TAB_W;

  return (
    <div style={{ minHeight: "100vh" }}>
      <aside
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          height: "100vh",
          width: SIDEBAR_W,
          background: "var(--sidebar)",
          borderRight: "1px solid var(--border)",
          transform: open ? "translateX(0)" : `translateX(-${closedOffset}px)`,
          transition: "transform 200ms ease",
          zIndex: 1000,
          overflow: "visible", // IMPORTANT so the tab can stick out
        }}
      >

        {/* Inner scrollable content (prevents cropping) */}
        <div
          style={{
            height: "100%",
            overflowY: "auto",
            overflowX: "hidden",
            padding: 12,
            display: "flex",
            flexDirection: "column",
            gap: 12,
          }}
        >
{/* App Branding */}
<div
  style={{
    display: "flex",
    alignItems: "center",
    gap: 10,
    paddingBottom: 10,
    marginBottom: 6,
    borderBottom: "1px solid var(--border)",
  }}
>
<div
  aria-hidden
  style={{
    width: 64,
    height: 64,
    background: "var(--accent)",
    WebkitMaskImage: `url(${logo})`,
    maskImage: `url(${logo})`,
    WebkitMaskRepeat: "no-repeat",
    maskRepeat: "no-repeat",
    WebkitMaskPosition: "center",
    maskPosition: "center",
    WebkitMaskSize: "contain",
    maskSize: "contain",
    flex: "0 0 auto",
  }}
/>

  <div
    style={{
      fontSize: 24,
      fontWeight: 800,
      letterSpacing: 0.3,
      color: "var(--accent)",
    }}
  >
    Sierra D&D
  </div>
</div>

          <div style={{ marginTop: 0, display: "flex", flexDirection: "column", gap: 8 }}>
            {links.map((l) => {
              const active = loc.pathname === l.to;
              return (
                <Link
                  key={l.to}
                  to={l.to}
                  style={{
                    display: "block",
                    textDecoration: "none",
                    padding: "10px 10px",
                    borderRadius: 2,
                    border: "1px solid var(--border)",
                    background: active ? "var(--accent)" : "var(--sidebar-item)",
                    color: active ? "#fff" : "var(--text)",
                  }}
                  title={l.label}
                >
                  {l.label}
                </Link>
              );
            })}
          </div>

          <div style={{ marginTop: "auto", borderTop: "1px solid var(--border)", paddingTop: 12 }}>
            {auth.currentUser ? (
              <button
                onClick={() => void logOut()}
                style={{
                  width: "100%",
                  borderRadius: 2,
                  border: "1px solid var(--border)",
                  background: "var(--sidebar-item)",
                  color: "var(--text)",
                  padding: "10px 12px",
                  cursor: "pointer",
                }}
              >
                Log out
              </button>
            ) : null}
          </div>
        </div>
      </aside>

      <main
        style={{
          minHeight: "100vh",
          marginLeft: open ? SIDEBAR_W : TAB_W, // keeps content visible
          transition: "margin-left 200ms ease",
          padding: 16,
        }}
      >
        <Outlet />
      </main>
    </div>
  );
}
