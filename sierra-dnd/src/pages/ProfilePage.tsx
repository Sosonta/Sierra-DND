import { useEffect, useMemo, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { doc, onSnapshot, runTransaction, serverTimestamp, updateDoc } from "firebase/firestore";
import { auth, db } from "../firebase";
import { applyAccent, applyTheme, saveLocalPrefs, type ThemeMode } from "../theme";

type UserDoc = {
  alias: string | null;
  pronouns: string | null;
  roles: string[];
  photoUrl: string | null;
  theme: ThemeMode;
  accentColor: string;
  displayNameSnapshot: string | null;
};

function normalizeAlias(input: string) {
  const trimmed = input.trim();

  // keep it simple + predictable for uniqueness:
  // letters/numbers/spaces/_- allowed; collapse multiple spaces
  const cleaned = trimmed.replace(/\s+/g, " ");
  const valid = /^[A-Za-z0-9 _-]{3,24}$/.test(cleaned);
  return { cleaned, valid };
}

function toAliasKey(alias: string) {
  return alias.trim().toLowerCase();
}

export function ProfilePage() {
  const [uid, setUid] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);

  const [userDoc, setUserDoc] = useState<UserDoc | null>(null);
  const [loading, setLoading] = useState(true);

  // editable form state (no writes until Save)
  const [aliasDraft, setAliasDraft] = useState("");
  const [pronounsDraft, setPronounsDraft] = useState("");
  const [themeDraft, setThemeDraft] = useState<ThemeMode>("dark");
const [accentDraft, setAccentDraft] = useState("#ffffff");

  const [savingPrefs, setSavingPrefs] = useState(false);
  const [savingAlias, setSavingAlias] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUid(u?.uid ?? null);
      setEmail(u?.email ?? null);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!uid) return;

    setLoading(true);
    const ref = doc(db, "users", uid);
    const unsub = onSnapshot(ref, (snap) => {
      const data = snap.data() as any;
      const next: UserDoc = {
        alias: data?.alias ?? null,
        pronouns: data?.pronouns ?? null,
        roles: Array.isArray(data?.roles) ? data.roles : [],
        photoUrl: data?.photoUrl ?? null,
        theme: (data?.theme === "light" ? "light" : "dark"),
        accentColor: typeof data?.accentColor === "string" ? data.accentColor : "#ffffff",
        displayNameSnapshot: data?.displayNameSnapshot ?? null,
      };

      setUserDoc(next);

      // initialize drafts once, or when remote changes and drafts are empty
      setAliasDraft((prev) => prev || (next.alias ?? ""));
      setPronounsDraft((prev) => prev || (next.pronouns ?? ""));
      setThemeDraft(next.theme);
      setAccentDraft(next.accentColor);

      // apply locally immediately
      applyTheme(next.theme);
      applyAccent(next.accentColor);
      saveLocalPrefs({ theme: next.theme, accentColor: next.accentColor });

      setLoading(false);
    });

    return () => unsub();
  }, [uid]);

  const rolesLabel = useMemo(() => {
    const r = userDoc?.roles ?? [];
    return r.length ? r.join(", ") : "Player";
  }, [userDoc]);

  async function savePreferences() {
    if (!uid || !userDoc) return;

    setSavingPrefs(true);
    setStatus(null);
    try {
      // apply locally instantly
      applyTheme(themeDraft);
      applyAccent(accentDraft);
      saveLocalPrefs({ theme: themeDraft, accentColor: accentDraft });

      // 1 write to update preferences + pronouns
      await updateDoc(doc(db, "users", uid), {
        pronouns: pronounsDraft.trim() ? pronounsDraft.trim() : null,
        theme: themeDraft,
        accentColor: accentDraft,
        // optional: lastSeenAt could be updated here, but that’s extra writes; skip for now
      });

      setStatus("Saved preferences.");
    } catch (e: any) {
      console.error(e);
      setStatus(`Error saving preferences: ${e?.message ?? String(e)}`);
    } finally {
      setSavingPrefs(false);
    }
  }

  async function saveAlias() {
    if (!uid || !userDoc) return;

    setStatus(null);

    const { cleaned, valid } = normalizeAlias(aliasDraft);
    if (!valid) {
      setStatus("Alias must be 3–24 chars and only use letters, numbers, spaces, _ or -.");
      return;
    }

    const newKey = toAliasKey(cleaned);
    const currentAlias = userDoc.alias;
    const currentKey = currentAlias ? toAliasKey(currentAlias) : null;

    if (currentKey === newKey) {
      setStatus("Alias unchanged.");
      return;
    }

    setSavingAlias(true);
    try {
      await runTransaction(db, async (tx) => {
        const userRef = doc(db, "users", uid);
        const newAliasRef = doc(db, "aliasIndex", newKey);

        // If new alias is already taken by someone else -> reject
        const newAliasSnap = await tx.get(newAliasRef);
        if (newAliasSnap.exists()) {
          const takenBy = newAliasSnap.data()?.uid;
          if (takenBy && takenBy !== uid) {
            throw new Error("That alias is already taken.");
          }
        }

        // If user currently has an alias, free it
        if (currentKey) {
          const oldAliasRef = doc(db, "aliasIndex", currentKey);
          const oldSnap = await tx.get(oldAliasRef);

          // Only delete if owned by us (safety)
          if (oldSnap.exists() && oldSnap.data()?.uid === uid) {
            tx.delete(oldAliasRef);
          }
        }

        // Claim new alias
        if (!newAliasSnap.exists()) {
          tx.set(newAliasRef, { uid, createdAt: serverTimestamp() });
        }

        // Update user doc alias
        tx.update(userRef, { alias: cleaned });
      });

      setStatus("Alias saved.");
    } catch (e: any) {
      console.error(e);
      setStatus(`Error saving alias: ${e?.message ?? String(e)}`);
    } finally {
      setSavingAlias(false);
    }
  }

  if (loading || !userDoc) {
    return <div className="card">Loading profile…</div>;
  }

  return (
    <div style={{ display: "grid", gap: 14, maxWidth: 760 }}>
      <div className="card" style={{ display: "flex", gap: 14, alignItems: "center" }}>
        <div
          style={{
            width: 56,
            height: 56,
            borderRadius: "50%",
            overflow: "hidden",
            border: "1px solid var(--border)",
            background: "#000",
            flex: "0 0 auto",
          }}
          title="Profile picture (from your login provider)"
        >
          {userDoc.photoUrl ? (
            <img
              src={userDoc.photoUrl}
              alt="avatar"
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
            />
          ) : null}
        </div>

        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 18, fontWeight: 700 }}>
            {userDoc.alias ?? userDoc.displayNameSnapshot ?? "Unnamed"}
            {userDoc.pronouns ? (
              <span className="small" style={{ marginLeft: 10 }}>
                {userDoc.pronouns}
              </span>
            ) : null}
          </div>
          <div className="small">{email ?? "No email"}</div>
          <div className="small">Roles: {rolesLabel}</div>
        </div>
      </div>

      <div className="card" style={{ display: "grid", gap: 10 }}>
        <h2 style={{ margin: 0 }}>Alias</h2>
        <div className="small">
          Your alias is shown on posts, comments, RSVPs, and forum activity.
        </div>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          <input
            value={aliasDraft}
            onChange={(e) => setAliasDraft(e.target.value)}
            placeholder="Choose an alias"
            style={{
              padding: "10px 12px",
              borderRadius: 2,
              border: "1px solid var(--border)",
              background: "transparent",
              color: "var(--text)",
              minWidth: 260,
            }}
          />
          <button
            onClick={() => void saveAlias()}
            disabled={savingAlias}
            style={{
              padding: "10px 12px",
              border: "1px solid var(--border)",
              background: "var(--accent)",
              color: "white",
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            {savingAlias ? "Saving…" : "Save Alias"}
          </button>
        </div>
      </div>

      <div className="card" style={{ display: "grid", gap: 10 }}>
        <h2 style={{ margin: 0 }}>Preferences</h2>

        <label style={{ display: "grid", gap: 6 }}>
          <span className="small">Pronouns (optional)</span>
          <input
            value={pronounsDraft}
            onChange={(e) => setPronounsDraft(e.target.value)}
            placeholder="e.g., he/him, she/her, they/them"
            style={{
              padding: "10px 12px",
              borderRadius: 2,
              border: "1px solid var(--border)",
              background: "transparent",
              color: "var(--text)",
            }}
          />
        </label>

        <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
          <label style={{ display: "grid", gap: 6 }}>
            <span className="small">Theme</span>
            <select
              value={themeDraft}
              onChange={(e) => {
                const v = e.target.value === "light" ? "light" : "dark";
                setThemeDraft(v);
                applyTheme(v);
                saveLocalPrefs({ theme: v, accentColor: accentDraft });
              }}
            >
              <option value="dark">Dark</option>
              <option value="light">Light</option>
            </select>
          </label>

          <label style={{ display: "grid", gap: 6 }}>
            <span className="small">Accent color</span>
            <input
              type="color"
              value={accentDraft}
              onChange={(e) => {
                setAccentDraft(e.target.value);
                applyAccent(e.target.value);
                saveLocalPrefs({ theme: themeDraft, accentColor: e.target.value });
              }}
              style={{ width: 64, height: 42, padding: 0, border: "none", background: "transparent" }}
            />
          </label>
        </div>

        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <button
            onClick={() => void savePreferences()}
            disabled={savingPrefs}
            style={{
              padding: "10px 12px",
              borderRadius: 2,
              border: "1px solid var(--border)",
              background: "transparent",
              color: "var(--text)",
              cursor: "pointer",
              fontWeight: 700,
            }}
          >
            {savingPrefs ? "Saving…" : "Save Preferences"}
          </button>

          {status ? <span className="small">{status}</span> : null}
        </div>
      </div>
    </div>
  );
}
