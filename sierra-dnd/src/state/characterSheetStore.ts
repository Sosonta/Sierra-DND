import { create } from "zustand";
import { auth, db } from "../firebase";
import { onAuthStateChanged } from "firebase/auth";
import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  serverTimestamp,
  setDoc,
  updateDoc,
} from "firebase/firestore";
import type {
  CharacterSheet,
  SheetAttrKey,
  SheetInventoryCategory,
  SheetSkill,
  SheetProficiency,
} from "../types/characterSheet";

function uidOrThrow() {
  const u = auth.currentUser;
  if (!u) throw new Error("Not authenticated");
  return u.uid;
}

function makeId(prefix = "id") {
  return `${prefix}_${Math.random().toString(16).slice(2)}${Date.now().toString(16)}`;
}

const DEFAULT_SHEET: CharacterSheet = {
  portraitUrl: "",

  characterName: "",
  level: 1,
  className: "",
  experience: 0,
  currency: 0,
  maxHp: 0,
currentHp: 0,
proficiencyBonus: 2,



  attributes: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },

  proficiencies: [],
  skills: [],

  inventoryCategories: [
    { id: makeId("cat"), name: "General", items: [] },
  ],
};

type State = {
  loading: boolean;
  data: CharacterSheet | null;

  // internal: unsubscribe handler
  _unsub?: (() => void) | null;

  // lifecycle
  start: () => void;
  stop: () => void;

  // setters
  setPortraitUrl: (url: string) => Promise<void>;
  setCharacterName: (name: string) => Promise<void>;
  setLevel: (n: number) => Promise<void>;
  setClassName: (s: string) => Promise<void>;
  setExperience: (n: number) => Promise<void>;
  setCurrency: (n: number) => Promise<void>;
  setMaxHp: (n: number) => Promise<void>;
setCurrentHp: (n: number) => Promise<void>;
setProficiencyBonus: (n: number) => Promise<void>;



  setAttribute: (key: SheetAttrKey, value: number) => Promise<void>;

  addProficiency: (attr: SheetAttrKey, name: string) => Promise<void>;
  toggleProficiency: (id: string) => Promise<void>;
  setProficiencyName: (id: string, name: string) => Promise<void>;
  deleteProficiency: (id: string) => Promise<void>;

  addSkill: () => Promise<void>;
  updateSkill: (id: string, patch: Partial<SheetSkill>) => Promise<void>;
  updateSkillUsedCount: (id: string, used: number) => Promise<void>;
  deleteSkill: (id: string) => Promise<void>;

  addInventoryCategory: (name: string) => Promise<void>;
  renameInventoryCategory: (categoryId: string, name: string) => Promise<void>;
  deleteInventoryCategory: (categoryId: string) => Promise<void>;

  addInventoryItem: (categoryId: string) => Promise<void>;
  updateInventoryItem: (categoryId: string, itemId: string, quantity: number, name: string) => Promise<void>;
  deleteInventoryItem: (categoryId: string, itemId: string) => Promise<void>;
};

function sheetDocRef(uid: string) {
  // users/{uid}/characterSheet/main
  return doc(db, "users", uid, "characterSheet", "main");
}

async function ensureSheetExists(uid: string) {
  const ref = sheetDocRef(uid);
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    await setDoc(ref, { ...DEFAULT_SHEET, updatedAt: serverTimestamp() }, { merge: true });
  }
}

async function writePatch(patch: Partial<CharacterSheet>) {
  const uid = uidOrThrow();
  const ref = sheetDocRef(uid);

  // updateDoc fails if doc doesn't exist
  await ensureSheetExists(uid);

  await updateDoc(ref, { ...patch, updatedAt: serverTimestamp() } as any);
}

export const useCharacterSheetStore = create<State>((set, get) => ({
  loading: true,
  data: null,
  _unsub: null,

start: () => {
  const existing = get()._unsub;
  if (existing) return;

  // Track both auth + firestore subscriptions
  let unsubFirestore: null | (() => void) = null;
  let unsubAuth: null | (() => void) = null;

  const attachForUser = async (uid: string) => {
    // Clean up any prior firestore listener
    if (unsubFirestore) {
      unsubFirestore();
      unsubFirestore = null;
    }

    const ref = sheetDocRef(uid);

    unsubFirestore = onSnapshot(
      ref,
      async (snap) => {
        if (!snap.exists()) {
          await ensureSheetExists(uid);
          return;
        }
        set({ loading: false, data: snap.data() as any });
      },
      (err) => {
        console.error("[CharacterSheet] snapshot error:", err);
        // IMPORTANT: stop showing "Loading…" forever; show an error-y empty state
        set({ loading: false, data: null });
      }
    );
  };

  // Start in loading while we wait for auth
  set({ loading: true, data: null });

  unsubAuth = onAuthStateChanged(auth, (user) => {
    if (!user) {
      // Signed out or auth not ready
      set({ loading: false, data: null });
      if (unsubFirestore) {
        unsubFirestore();
        unsubFirestore = null;
      }
      return;
    }

    // Signed in -> attach firestore listener
    void attachForUser(user.uid);
  });

  // Store one unsubscribe that cleans up both
  set({
    _unsub: () => {
      if (unsubFirestore) unsubFirestore();
      if (unsubAuth) unsubAuth();
      unsubFirestore = null;
      unsubAuth = null;
    },
  });
},

stop: () => {
  const unsub = get()._unsub;
  if (unsub) unsub();
  set({ _unsub: null, loading: true, data: null });
},

  setPortraitUrl: async (url) => writePatch({ portraitUrl: url }),
  setCharacterName: async (name) => writePatch({ characterName: name }),
  setLevel: async (n) => writePatch({ level: Math.max(0, n | 0) }),
  setClassName: async (s) => writePatch({ className: s }),
  setExperience: async (n) => writePatch({ experience: Math.max(0, n | 0) }),
  setCurrency: async (n) => writePatch({ currency: Math.max(0, n | 0) }),
  setMaxHp: async (n: number) => {
  const uid = auth.currentUser?.uid;
  if (!uid) return;
  const ref = sheetDocRef(uid);
  await updateDoc(ref, { maxHp: n });
},

setCurrentHp: async (n: number) => {
  const uid = auth.currentUser?.uid;
  if (!uid) return;
  const ref = sheetDocRef(uid);
  await updateDoc(ref, { currentHp: n });
},

setProficiencyBonus: async (n: number) => {
  const uid = auth.currentUser?.uid;
  if (!uid) return;
  const ref = sheetDocRef(uid);
  await updateDoc(ref, { proficiencyBonus: n });
},


  setAttribute: async (key, value) => {
    const d = get().data;
    if (!d) return;
    const next = { ...d.attributes, [key]: value | 0 };
    await writePatch({ attributes: next });
  },

  addProficiency: async (attr, name) => {
    const d = get().data;
    if (!d) return;
    const next: SheetProficiency[] = [
      ...d.proficiencies,
      { id: makeId("prof"), attribute: attr, name: name ?? "", proficient: false },
    ];
    await writePatch({ proficiencies: next });
  },

  toggleProficiency: async (id) => {
    const d = get().data;
    if (!d) return;
    const next = d.proficiencies.map((p) => (p.id === id ? { ...p, proficient: !p.proficient } : p));
    await writePatch({ proficiencies: next });
  },

  setProficiencyName: async (id, name) => {
    const d = get().data;
    if (!d) return;
    const next = d.proficiencies.map((p) => (p.id === id ? { ...p, name } : p));
    await writePatch({ proficiencies: next });
  },

  deleteProficiency: async (id) => {
    const d = get().data;
    if (!d) return;
    const next = d.proficiencies.filter((p) => p.id !== id);
    await writePatch({ proficiencies: next });
  },

  addSkill: async () => {
    const d = get().data;
    if (!d) return;
    const next: SheetSkill[] = [
      ...d.skills,
      { id: makeId("skill"), name: "", usesPer: "", usedCount: 0, description: "" },
    ];
    await writePatch({ skills: next });
  },

  updateSkill: async (id, patch) => {
    const d = get().data;
    if (!d) return;
    const next = d.skills.map((s) => (s.id === id ? { ...s, ...patch } : s));
    await writePatch({ skills: next });
  },

  updateSkillUsedCount: async (id, used) => {
    const d = get().data;
    if (!d) return;
    const next = d.skills.map((s) => (s.id === id ? { ...s, usedCount: Math.max(0, used | 0) } : s));
    await writePatch({ skills: next });
  },

  deleteSkill: async (id) => {
    const d = get().data;
    if (!d) return;
    const next = d.skills.filter((s) => s.id !== id);
    await writePatch({ skills: next });
  },

  addInventoryCategory: async (name) => {
    const d = get().data;
    if (!d) return;
    const next: SheetInventoryCategory[] = [
      ...d.inventoryCategories,
      { id: makeId("cat"), name, items: [] },
    ];
    await writePatch({ inventoryCategories: next });
  },

  renameInventoryCategory: async (categoryId, name) => {
    const d = get().data;
    if (!d) return;
    const next = d.inventoryCategories.map((c) => (c.id === categoryId ? { ...c, name } : c));
    await writePatch({ inventoryCategories: next });
  },

  deleteInventoryCategory: async (categoryId) => {
    const d = get().data;
    if (!d) return;
    const next = d.inventoryCategories.filter((c) => c.id !== categoryId);
    await writePatch({ inventoryCategories: next.length ? next : [{ id: makeId("cat"), name: "General", items: [] }] });
  },

  addInventoryItem: async (categoryId) => {
    const d = get().data;
    if (!d) return;
    const next = d.inventoryCategories.map((c) => {
      if (c.id !== categoryId) return c;
      return {
        ...c,
        items: [...c.items, { id: makeId("item"), name: "", quantity: 1 }],
      };
    });
    await writePatch({ inventoryCategories: next });
  },

  updateInventoryItem: async (categoryId, itemId, quantity, name) => {
    const d = get().data;
    if (!d) return;
    const next = d.inventoryCategories.map((c) => {
      if (c.id !== categoryId) return c;
      return {
        ...c,
        items: c.items.map((it) => (it.id === itemId ? { ...it, quantity, name } : it)),
      };
    });
    await writePatch({ inventoryCategories: next });
  },

  deleteInventoryItem: async (categoryId, itemId) => {
    const d = get().data;
    if (!d) return;
    const next = d.inventoryCategories.map((c) => {
      if (c.id !== categoryId) return c;
      return { ...c, items: c.items.filter((it) => it.id !== itemId) };
    });
    await writePatch({ inventoryCategories: next });
  },
}));
