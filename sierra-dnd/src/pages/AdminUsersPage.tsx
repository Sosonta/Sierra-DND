import { useEffect, useMemo, useState } from "react";
import { collection, getDocs, limit, orderBy, query, updateDoc, doc } from "firebase/firestore";
import { db } from "../firebase";

type ClubRole = "Player" | "DM" | "Officer" | "Moderator" | "Admin";

type UserRow = {
  id: string; // uid
  alias: string | null;
  pronouns: string | null;
  roles: ClubRole[];
  displayNameSnapshot: string | null;
  photoUrl: string | null;
};

const ROLE_OPTIONS: ClubRole[] = ["DM", "Officer", "Moderator", "Admin"];

function norm(s: string) {
  return s.trim().toLowerCase();
}

export function AdminUsersPage() {
  const [allUsers, setAllUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState("");
  const [selectedUid, setSelectedUid] = useState<string | null>(null);

  const [draftRoles, setDraftRoles] = useState<Set<ClubRole>>(new Set());
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      setStatus(null);
      try {
        // Simple first version: fetch latest N users.
        // For a club this is fine. Later we can do paginated loading.
        const q = query(collection(db, "users"), orderBy("createdAt", "desc"), limit(200));
        const snap = await getDocs(q);
        const rows: UserRow[] = snap.docs.map(d => {
          const data: any = d.data();
          return {
            id: d.id,
            alias: data?.alias ?? null,
            pronouns: data?.pronouns ?? null,
            roles: Array.isArray(data?.roles) ? data.roles : ["Player"],
            displayNameSnapshot: data?.displayNameSnapshot ?? null,
            photoUrl: data?.photoUrl ?? null,
          };
        });
        setAllUsers(rows);
      } catch (e: any) {
        console.error(e);
        setStatus(`Error loading users: ${e?.message ?? String(e)}`);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const filtered = useMemo(() => {
    const s = norm(search);
    if (!s) return allUsers;

    return allUsers.filter(u => {
      const hay = [
        u.alias ?? "",
        u.displayNameSnapshot ?? "",
        u.id,
        (u.roles ?? []).join(" "),
      ].join(" ").toLowerCase();

      return hay.includes(s);
    });
  }, [allUsers, search]);

  const selectedUser = useMemo(
    () => allUsers.find(u => u.id === selectedUid) ?? null,
    [allUsers, selectedUid]
  );

  useEffect(() => {
    if (!selectedUser) return;
    setDraftRoles(new Set(selectedUser.roles ?? ["Player"]));
  }, [selectedUser]);

  function toggleRole(r: ClubRole) {
    setDraftRoles(prev => {
      const next = new Set(prev);
      if (next.has(r)) next.delete(r);
      else next.add(r);
      // keep Player present
      next.add("Player");
      return next;
    });
  }

  async function saveRoles() {
    if (!selectedUser) return;
    setSaving(true);
    setStatus(null);

    try {
      const rolesArr = Array.from(draftRoles);

      // Always enforce Player
      if (!rolesArr.includes("Player")) rolesArr.push("Player");

      await updateDoc(doc(db, "users", selectedUser.id), {
        roles: rolesArr,
      });

      // Update local cache (no refetch required)
      setAllUsers(prev =>
        prev.map(u => (u.id === selectedUser.id ? { ...u, roles: rolesArr as ClubRole[] } : u))
      );

      setStatus("Roles saved.");
    } catch (e: any) {
      console.error(e);
      setStatus(`Error saving roles: ${e?.message ?? String(e)}`);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ display: "grid", gap: 14, maxWidth: 980 }}>
      <div className="card">
        <h1 style={{ marginTop: 0 }}>Admin: Users & Roles</h1>
        <p className="small" style={{ marginTop: 6 }}>
          Search and assign roles. Changes are saved only when you click “Save Roles”.
        </p>
        {status ? <div className="small">{status}</div> : null}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        <div className="card">
          <h2 style={{ marginTop: 0 }}>Users</h2>

          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search alias, name, uid, role…"
            style={{
              width: "100%",
              padding: "10px 12px",
              borderRadius: 2,
              border: "1px solid var(--border)",
              background: "transparent",
              color: "var(--text)",
              marginBottom: 12,
            }}
          />

          {loading ? (
            <div className="small">Loading…</div>
          ) : (
            <div style={{ display: "grid", gap: 8, maxHeight: 420, overflow: "auto" }}>
              {filtered.map(u => {
                const label = u.alias ?? u.displayNameSnapshot ?? u.id.slice(0, 10) + "…";
                const roleStr = (u.roles ?? []).join(", ");
                const active = u.id === selectedUid;

                return (
                  <button
                    key={u.id}
                    onClick={() => setSelectedUid(u.id)}
                    style={{
                      textAlign: "left",
                      padding: "10px 12px",
                      borderRadius: 2,
                      border: `1px solid ${active ? "var(--accent)" : "var(--border)"}`,
                      background: active ? "rgb(26, 26, 26)" : "transparent",
                      color: "var(--text)",
                      cursor: "pointer",
                    }}
                    title={u.id}
                  >
                    <div style={{ fontWeight: 700 }}>{label}</div>
                    <div className="small">{roleStr}</div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className="card">
          <h2 style={{ marginTop: 0 }}>Role editor</h2>

          {!selectedUser ? (
            <div className="small">Select a user on the left.</div>
          ) : (
            <>
              <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                <div
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: "50%",
                    overflow: "hidden",
                    border: "1px solid var(--border)",
                    background: "#000",
                  }}
                >
                  {selectedUser.photoUrl ? (
                    <img
                      src={selectedUser.photoUrl}
                      alt="avatar"
                      style={{ width: "100%", height: "100%", objectFit: "cover" }}
                    />
                  ) : null}
                </div>

                <div>
                  <div style={{ fontWeight: 800 }}>
                    {selectedUser.alias ?? selectedUser.displayNameSnapshot ?? "Unnamed"}
                    {selectedUser.pronouns ? (
                      <span className="small" style={{ marginLeft: 10 }}>
                        {selectedUser.pronouns}
                      </span>
                    ) : null}
                  </div>
                  <div className="small" title={selectedUser.id}>
                    UID: {selectedUser.id}
                  </div>
                </div>
              </div>

              <div style={{ marginTop: 14, display: "grid", gap: 10 }}>
                <div className="small">Player is always included. Check additional roles:</div>

                <div style={{ display: "grid", gap: 8 }}>
                  {ROLE_OPTIONS.map(r => (
                    <label key={r} style={{ display: "flex", gap: 10, alignItems: "center" }}>
                      <input
                        type="checkbox"
                        checked={draftRoles.has(r)}
                        onChange={() => toggleRole(r)}
                      />
                      <span>{r}</span>
                    </label>
                  ))}
                </div>

                <button
                  onClick={() => void saveRoles()}
                  disabled={saving}
                  style={{
                    marginTop: 10,
                    padding: "10px 12px",
                    borderRadius: 2,
                    border: "1px solid var(--border)",
                    background: "var(--accent)",
                    color: "white",
                    fontWeight: 800,
                    cursor: "pointer",
                  }}
                >
                  {saving ? "Saving…" : "Save Roles"}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
