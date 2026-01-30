import { onAuthStateChanged } from "firebase/auth";
import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { auth } from "../firebase";

export function RequireAuth({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [signedIn, setSignedIn] = useState(false);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setSignedIn(!!u);
      setReady(true);
    });
    return () => unsub();
  }, []);

  if (!ready) return <div>Loading…</div>;
  if (!signedIn) return <Navigate to="/login" replace />;
  return <>{children}</>;
}
