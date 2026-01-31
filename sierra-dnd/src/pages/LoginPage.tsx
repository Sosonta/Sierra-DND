import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  setPersistence,
  browserLocalPersistence,
  browserSessionPersistence,
} from "firebase/auth";
import { auth } from "../firebase";
import { signInWithGoogle } from "../auth";

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

type EmailMode = "signin" | "create";

export function LoginPage() {
  const nav = useNavigate();
  const [busy, setBusy] = useState(false);

  // Email/password form state
  const [mode, setMode] = useState<EmailMode>("signin");
  const isCreate = mode === "create";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  // Auth persistence toggle
  const [rememberMe, setRememberMe] = useState(true);

  // Minimal status + error display
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  const trimmedEmail = useMemo(() => email.trim(), [email]);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      if (u) nav("/", { replace: true });
    });
    return () => unsub();
  }, [nav]);

  async function applyPersistence() {
    // Remember Me checked => persistent across browser restarts
    // unchecked => session-only
    await setPersistence(
      auth,
      rememberMe ? browserLocalPersistence : browserSessionPersistence
    );
  }

  async function handleGoogle() {
    setBusy(true);
    setError(null);
    setStatus(null);
    try {
      await applyPersistence();
      await signInWithGoogle();
      nav("/", { replace: true });
    } catch (e: any) {
      setError(e?.message ?? "Failed to sign in with Google.");
    } finally {
      setBusy(false);
    }
  }

  async function handleEmailPassword(e?: FormEvent) {
    e?.preventDefault();
    if (busy) return;

    setError(null);
    setStatus(null);

    if (!trimmedEmail) {
      setError("Please enter an email address.");
      return;
    }
    if (!password) {
      setError("Please enter a password.");
      return;
    }

    setBusy(true);
    try {
      await applyPersistence();

      if (isCreate) {
        await createUserWithEmailAndPassword(auth, trimmedEmail, password);
      } else {
        await signInWithEmailAndPassword(auth, trimmedEmail, password);
      }

      nav("/", { replace: true });
    } catch (err: any) {
      setError(err?.message ?? "Email/password authentication failed.");
    } finally {
      setBusy(false);
    }
  }

  async function handleForgotPassword() {
    if (busy) return;

    setError(null);
    setStatus(null);

    if (!trimmedEmail) {
      setError("Enter your email above first, then click “Forgot password?”");
      return;
    }

    setBusy(true);
    try {
      await sendPasswordResetEmail(auth, trimmedEmail);
      setStatus("Password reset email sent. Check your inbox (and spam folder).");
    } catch (err: any) {
      setError(err?.message ?? "Failed to send password reset email.");
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
        position: "relative",
      }}
    >
      {/* Bottom-right Discord box */}
      <a
        href="https://discord.gg/73HBPHGw"
        target="_blank"
        rel="noreferrer"
        className="card"
        style={{
          position: "fixed",
          right: 16,
          bottom: 16,
          width: 220,
          padding: 12,
          textDecoration: "none",
          border: "1px solid var(--border)",
          background: "rgba(0,0,0,0.15)",
          display: "grid",
          gap: 10,
          cursor: "pointer",
        }}
      >
        <div style={{ fontWeight: 900, color: "var(--text)" }}>
          Join the Discord Server!
        </div>
        <img
          src="https://i.imgur.com/ppajCHq.png"
          alt="Discord Server"
          style={{
            width: "100%",
            height: "auto",
            borderRadius: 8,
            display: "block",
          }}
        />
      </a>

      <div style={{ width: "min(1100px, 100%)", display: "grid", gap: 18 }}>
        {/* Logo + Header */}
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

        {/* Sign-in card */}
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
            <div style={{ fontWeight: 900, fontSize: 18 }}>
              {isCreate ? "Create account" : "Sign in"}
            </div>

            {error ? (
              <div
                className="small"
                style={{
                  color: "var(--danger, #ff6b6b)",
                  border: "1px solid var(--border)",
                  background: "rgba(255,0,0,0.08)",
                  padding: "8px 10px",
                  borderRadius: 8,
                }}
              >
                {error}
              </div>
            ) : null}

            {status ? (
              <div
                className="small"
                style={{
                  color: "var(--text)",
                  border: "1px solid var(--border)",
                  background: "rgba(0,255,0,0.06)",
                  padding: "8px 10px",
                  borderRadius: 8,
                  opacity: 0.9,
                }}
              >
                {status}
              </div>
            ) : null}
          </div>

          <div style={{ display: "grid", gap: 10 }}>
            {/* Google */}
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
                {busy ? "Working…" : "Sign in with Google"}
              </span>
              <span className="small" style={{ opacity: 0.85 }}>
                →
              </span>
            </button>

            {/* Email/Password */}
            <form
              onSubmit={(e) => void handleEmailPassword(e)}
              style={{
                display: "grid",
                gap: 10,
                padding: 12,
                border: "1px solid var(--border)",
                borderRadius: 12,
                background: "rgba(255,255,255,0.02)",
              }}
            >
              <div style={{ display: "grid", gap: 6 }}>
                <label className="small" style={{ opacity: 0.85 }}>
                  Email
                </label>
                <input
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={busy}
                  autoComplete="email"
                  inputMode="email"
                  placeholder="you@example.com"
                  style={{
                    padding: "10px 10px",
                    borderRadius: 10,
                    border: "1px solid var(--border)",
                    background: "transparent",
                    color: "var(--text)",
                    outline: "none",
                  }}
                />
              </div>

              <div style={{ display: "grid", gap: 6 }}>
                <label className="small" style={{ opacity: 0.85 }}>
                  Password
                </label>
                <input
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={busy}
                  type="password"
                  autoComplete={isCreate ? "new-password" : "current-password"}
                  placeholder="••••••••"
                  style={{
                    padding: "10px 10px",
                    borderRadius: 10,
                    border: "1px solid var(--border)",
                    background: "transparent",
                    color: "var(--text)",
                    outline: "none",
                  }}
                />
              </div>

              {/* Remember me + Forgot password row */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 12,
                }}
              >
                <label
                  className="small"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    opacity: 0.85,
                    cursor: busy ? "not-allowed" : "pointer",
                    userSelect: "none",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    disabled={busy}
                    onChange={(e) => setRememberMe(e.target.checked)}
                  />
                  Remember me
                </label>

                <button
                  type="button"
                  disabled={busy || isCreate}
                  onClick={() => void handleForgotPassword()}
                  className="small"
                  style={{
                    border: "none",
                    background: "transparent",
                    color: "var(--accent)",
                    cursor: busy || isCreate ? "not-allowed" : "pointer",
                    padding: 0,
                    textDecoration: "underline",
                    opacity: isCreate ? 0.45 : 0.9,
                  }}
                  title={
                    isCreate
                      ? "Switch to Sign in to use password reset."
                      : "Send a password reset email."
                  }
                >
                  Forgot password?
                </button>
              </div>

              <button
                className="card"
                type="submit"
                disabled={busy}
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
                  {busy
                    ? "Working…"
                    : isCreate
                    ? "Create account"
                    : "Sign in with Email"}
                </span>
                <span className="small" style={{ opacity: 0.85 }}>
                  →
                </span>
              </button>

              {/* Mode switch */}
              <div
                className="small"
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  gap: 10,
                  opacity: 0.8,
                }}
              >
                {isCreate ? (
                  <>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => {
                        setMode("signin");
                        setError(null);
                        setStatus(null);
                      }}
                      style={{
                        border: "none",
                        background: "transparent",
                        color: "var(--accent)",
                        cursor: busy ? "not-allowed" : "pointer",
                        padding: 0,
                        textDecoration: "underline",
                      }}
                    >
                      Sign in
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => {
                        setMode("create");
                        setError(null);
                        setStatus(null);
                      }}
                      style={{
                        border: "none",
                        background: "transparent",
                        color: "var(--accent)",
                        cursor: busy ? "not-allowed" : "pointer",
                        padding: 0,
                        textDecoration: "underline",
                      }}
                    >
                      Create account
                    </button>
                  </>
                )}
              </div>
            </form>

          </div>
        </div>
      </div>
    </div>
  );
}
