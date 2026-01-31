import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { auth, db } from "../firebase";
import { doc, onSnapshot } from "firebase/firestore";

export function RequireRole({ role, children }: { role: string; children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [ok, setOk] = useState(false);

  useEffect(() => {
    const u = auth.currentUser;
    if (!u) {
      setOk(false);
      setReady(true);
      return;
    }

    const ref = doc(db, "users", u.uid);
    const unsub = onSnapshot(ref, (snap) => {
      const roles = (snap.data() as any)?.roles;
      const has = Array.isArray(roles) && roles.includes(role);
      setOk(has);
      setReady(true);
    });

    return () => unsub();
  }, [role]);

  if (!ready) return <div>Loading…</div>;
  if (!ok) return <Navigate to="/" replace />;
  return <>{children}</>;
}
