import { auth, db } from "./firebase";
import {
  GoogleAuthProvider,
  OAuthProvider,
  signInWithPopup,
  signOut,
} from "firebase/auth";
import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";

export type ClubRole = "Player" | "DM" | "Officer" | "Moderator" | "Admin";

export async function signInWithGoogle() {
  const provider = new GoogleAuthProvider();
  const cred = await signInWithPopup(auth, provider);
  await ensureUserDoc(cred.user.uid, cred.user.displayName ?? null, cred.user.photoURL ?? null);
}

export async function signInWithMicrosoft() {
  // Microsoft provider via OIDC in Firebase Auth
  const provider = new OAuthProvider("microsoft.com");
  const cred = await signInWithPopup(auth, provider);
  await ensureUserDoc(cred.user.uid, cred.user.displayName ?? null, cred.user.photoURL ?? null);
}

export async function logOut() {
  await signOut(auth);
}

async function ensureUserDoc(uid: string, displayName: string | null, photoUrl: string | null) {
  const ref = doc(db, "users", uid);
  const snap = await getDoc(ref);

  if (!snap.exists()) {
    // default role is Player; you can manually add Admin to yourself in Firestore console once
    await setDoc(ref, {
      roles: ["Player"] as ClubRole[],
      alias: null,
      pronouns: null,
      photoUrl: photoUrl,
      theme: "dark",        // local preference; can be changed later
      accentColor: "#7c3aed", // default vibrant accent
      createdAt: serverTimestamp(),
      lastSeenAt: serverTimestamp(),
      displayNameSnapshot: displayName,
    });
  } else {
    // Keep writes minimal: only update lastSeenAt occasionally later.
    // For now, do nothing to avoid extra writes.
  }
}
