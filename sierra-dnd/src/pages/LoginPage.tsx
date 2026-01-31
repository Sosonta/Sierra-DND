import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "../firebase";
import { signInWithGoogle, signInWithMicrosoft } from "../auth";

import logoPng from "../assets/logo.png";

function LogoMark({ size = 250 }: { size?: number }) {
  return (
    <div
      aria-hidden
      style={{
        width: size,
        height: size,
        background: "var(--accent)",
        WebkitMaskImage: `url(${logoPng})`,
        maskImage: `url(${logoPng})`,
        WebkitMaskRepeat: "no-repeat",
        maskRepeat: "no-repeat",
        WebkitMaskPosition: "center",
        maskPosition: "center",
        WebkitMaskSize: "contain",
        maskSize: "contain",
      }}
    />
  );
}

export function LoginPage() {
  const nav = useNavigate();
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      if (u) nav("/", { replace: true });
    });
    return () => unsub();
  }, [nav]);

  async function handleGoogle() {
    setBusy(true);
    try {
      await signInWithGoogle();
      nav("/", { replace: true });
    } finally {
      setBusy(false);
    }
  }

  async function handleMicrosoft() {
    setBusy(true);
    try {
      await signInWithMicrosoft();
      nav("/", { replace: true });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      style={{
        minHeight: "calc(100vh - 32px)",
        display: "grid",
        placeItems: "center",
        padding: "24px 14px",
      }}
    >
      <div style={{ width: "min(1100px, 100%)", display: "grid", gap: 18 }}>
        {/* Logo + Header (match LandingPage) */}
        <div style={{ display: "grid", justifyItems: "center", gap: 14 }}>
          <LogoMark />
          <div
            style={{
              fontSize: 54,
              fontWeight: 900,
              letterSpacing: 0.4,
              color: "var(--accent)",
              lineHeight: 1,
              textAlign: "center",
            }}
          >
            Sierra D&amp;D
          </div>
        </div>

        {/* Sign-in card (replaces the two update boxes) */}
        <div
          className="card"
          style={{
            width: "min(520px, 100%)",
            margin: "0 auto",
            padding: 14,
            display: "grid",
            gap: 12,
          }}
        >
          <div style={{ display: "grid", gap: 6 }}>
            <div style={{ fontWeight: 900, fontSize: 18 }}>Sign in</div>
          </div>

          <div style={{ display: "grid", gap: 10 }}>
            <button
              className="card"
              disabled={busy}
              onClick={() => void handleGoogle()}
              style={{
                textAlign: "left",
                padding: "12px 12px",
                border: "1px solid var(--border)",
                background: "rgba(255,255,255,0.02)",
                cursor: busy ? "not-allowed" : "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 12,
              }}
            >
              <span style={{ fontWeight: 900 }}>
                {busy ? "Signing in…" : "Sign in with Google"}
              </span>
              <span className="small" style={{ opacity: 0.85 }}>
                →
              </span>
            </button>

            <button
              className="card"
              disabled={busy}
              onClick={() => void handleMicrosoft()}
              style={{
                textAlign: "left",
                padding: "12px 12px",
                border: "1px solid var(--border)",
                background: "rgba(255,255,255,0.02)",
                cursor: busy ? "not-allowed" : "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 12,
              }}
            >
              <span style={{ fontWeight: 900 }}>
                {busy ? "Signing in…" : "Sign in with Outlook"}
              </span>
              <span className="small" style={{ opacity: 0.85 }}>
                →
              </span>
            </button>

          </div>
        </div>
      </div>
    </div>
  );
}
