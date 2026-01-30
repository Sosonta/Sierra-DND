import { signInWithGoogle, signInWithMicrosoft } from "../auth";

export function LoginPage() {
  return (
    <div style={{ maxWidth: 420 }}>
      <h1>Sign in</h1>
      <p>Use your school or personal account.</p>

      <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
        <button onClick={() => void signInWithGoogle()}>Sign in with Google</button>
        <button onClick={() => void signInWithMicrosoft()}>Sign in with Microsoft</button>
      </div>
    </div>
  );
}
