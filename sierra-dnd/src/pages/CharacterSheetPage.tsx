import React, { useEffect, useMemo, useRef, useState } from "react";
import FEATURES_JSON from "../main/data/Features.json"; // adjust path if needed

import { useCharacterSheetStore } from "../state/characterSheetStore";
import type { SheetAttrKey } from "../types/characterSheet";

type FeatureEntry = {
  Class?: string;
  Prerequisites?: string;
  Title?: string;
  Frequency?: string;
  Target?: string;
  Trigger?: string;
  Effect?: string;
};

const ATTR_LABELS: Record<SheetAttrKey, string> = {
  str: "Strength",
  dex: "Dexterity",
  con: "Constitution",
  int: "Intelligence",
  wis: "Wisdom",
  cha: "Charisma",
};

function calcModifier(stat: number): string {
  const mod = Math.floor((stat - 10) / 2);
  return mod >= 0 ? `+${mod}` : `${mod}`;
}

function calcModNumber(stat: number): number {
  return Math.floor((stat - 10) / 2);
}

function fmtSigned(n: number): string {
  return n >= 0 ? `+${n}` : `${n}`;
}

type RollerResult = {
  skillName: string;
  attr: SheetAttrKey;
  die: number;
  bonus: number;
  total: number;
  isNat1: boolean;
  isNat20: boolean;
};


function formatFeatureDescription(trigger?: string, effect?: string): string {
  const t = (trigger ?? "").trim();
  const e = (effect ?? "").trim();
  if (!t && !e) return "";
  if (t && e) return `Trigger:\n${t}\n\nEffect:\n${e}`;
  if (t) return `Trigger:\n${t}`;
  return `Effect:\n${e}`;
}

export const CharacterSheetPage: React.FC = () => {
  const {
    loading,
    data,
    start,
    stop,

    setPortraitUrl,
    setCharacterName,
    setLevel,
    setClassName,
    setExperience,
    setCurrency,
    setMaxHp,
setCurrentHp,
setProficiencyBonus,


    setAttribute,

    addProficiency,
    toggleProficiency,
    setProficiencyName,
    deleteProficiency,

    addSkill,
    updateSkill,
    updateSkillUsedCount,
    deleteSkill,

    addInventoryCategory,
    renameInventoryCategory,
    deleteInventoryCategory,
    addInventoryItem,
    updateInventoryItem,
    deleteInventoryItem,
  } = useCharacterSheetStore();

  useEffect(() => {
    start();
    return () => stop();
  }, [start, stop]);

  // ----- Features dataset (from Features.json) -----
  const allFeatures: FeatureEntry[] = useMemo(() => {
    const raw = FEATURES_JSON as unknown as FeatureEntry[] | { default?: FeatureEntry[] };
    const list = Array.isArray(raw) ? raw : Array.isArray(raw?.default) ? raw.default! : [];
    return list
      .map((f) => ({
        Class: f.Class ?? "",
        Prerequisites: f.Prerequisites ?? "",
        Title: f.Title ?? "",
        Frequency: f.Frequency ?? "",
        Target: f.Target ?? "",
        Trigger: f.Trigger ?? "",
        Effect: f.Effect ?? "",
      }))
      .filter((f) => String(f.Title ?? "").trim().length > 0)
      .sort((a, b) => String(a.Title).localeCompare(String(b.Title)));
  }, []);

  const featureClasses: string[] = useMemo(() => {
    const set = new Set<string>();
    for (const f of allFeatures) {
      const c = String(f.Class ?? "").trim();
      if (c) set.add(c);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [allFeatures]);

  // ----- Inventory tab state -----
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [portraitEditing, setPortraitEditing] = useState(false);
const [portraitDraft, setPortraitDraft] = useState("");


  // ----- Context menus + modals (same pattern you had) -----
  const menuRef = useRef<HTMLDivElement | null>(null);
  const [invTabMenu, setInvTabMenu] = useState<{ open: boolean; x: number; y: number; categoryId: string | null }>(
    { open: false, x: 0, y: 0, categoryId: null }
  );

  const [renameOpen, setRenameOpen] = useState(false);
  const [renameCategoryId, setRenameCategoryId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");

  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleteCategoryId, setDeleteCategoryId] = useState<string | null>(null);

  // ----- Skills: autocomplete + picker modal -----
  const [skillSuggest, setSkillSuggest] = useState<{
    open: boolean;
    skillId: string | null;
    query: string;
    index: number;
  }>({ open: false, skillId: null, query: "", index: 0 });

  const [skillPickerOpen, setSkillPickerOpen] = useState(false);
  const [skillPickerSkillId, setSkillPickerSkillId] = useState<string | null>(null);
  const [skillPickerClass, setSkillPickerClass] = useState<string>("All");
  const [skillPickerSearch, setSkillPickerSearch] = useState<string>("");

  useEffect(() => {
  if (!data) return;
  setPortraitDraft(data.portraitUrl ?? "");
}, [data?.portraitUrl]);

  // Ensure inventory category selected
  useEffect(() => {
    if (data && !selectedCategoryId && data.inventoryCategories.length > 0) {
      setSelectedCategoryId(data.inventoryCategories[0].id);
    }
  }, [data, selectedCategoryId]);

  // Close menus/modals on outside click + ESC
  useEffect(() => {
    const onMouseDown = (e: MouseEvent) => {
      if (invTabMenu.open) {
        if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
          setInvTabMenu({ open: false, x: 0, y: 0, categoryId: null });
        }
      }
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setInvTabMenu({ open: false, x: 0, y: 0, categoryId: null });
        setRenameOpen(false);
        setDeleteConfirmOpen(false);
        setSkillSuggest({ open: false, skillId: null, query: "", index: 0 });
        setSkillPickerOpen(false);
      }
    };

    window.addEventListener("mousedown", onMouseDown);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("mousedown", onMouseDown);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [invTabMenu.open]);

  const categoryTabs = data?.inventoryCategories ?? [];
  const currentCategory =
    data && selectedCategoryId ? data.inventoryCategories.find((c) => c.id === selectedCategoryId) || null : null;

  const openInventoryTabMenu = (e: React.MouseEvent, categoryId: string) => {
    e.preventDefault();
    setInvTabMenu({ open: true, x: e.clientX, y: e.clientY, categoryId });
  };

  const openRenameModal = (categoryId: string) => {
    if (!data) return;
    const current = data.inventoryCategories.find((c) => c.id === categoryId);
    if (!current) return;
    setRenameCategoryId(categoryId);
    setRenameValue(current.name ?? "");
    setRenameOpen(true);
  };

  const submitRename = async () => {
    if (!renameCategoryId) return;
    const trimmed = renameValue.trim();
    if (!trimmed) return;
    await renameInventoryCategory(renameCategoryId, trimmed);
    setRenameOpen(false);
    setRenameCategoryId(null);
    setRenameValue("");
  };

  const openDeleteConfirm = (categoryId: string) => {
    setDeleteCategoryId(categoryId);
    setDeleteConfirmOpen(true);
  };

  const confirmDelete = async () => {
    if (!deleteCategoryId) return;
    const idToDelete = deleteCategoryId;
    setDeleteConfirmOpen(false);
    setDeleteCategoryId(null);

    await deleteInventoryCategory(idToDelete);
    if (selectedCategoryId === idToDelete) setSelectedCategoryId(null);
  };

  const cancelDelete = () => {
    setDeleteConfirmOpen(false);
    setDeleteCategoryId(null);
  };

const ProficiencyBubble: React.FC<{
  checked: boolean;
  onToggle: () => void;
  title?: string;
}> = ({ checked, onToggle, title }) => {
  return (
    <span
      role="checkbox"
      aria-checked={checked}
      tabIndex={0}
      title={title}
      onClick={onToggle}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onToggle();
        }
      }}
      style={{
        width: 14,
        height: 14,
        borderRadius: 999,
        border: "1px solid var(--border)",
        background: checked ? "var(--accent)" : "transparent",
        display: "inline-block",
        cursor: "pointer",
        flex: "0 0 auto",
      }}
    />
  );
};


  const renderUsesBubbles = (usesPer?: string, usedCount?: number, onChange?: (n: number) => void) => {
    if (!usesPer) return null;
    const match = usesPer.match(/(\d+)/);
    if (!match) return null;
    const max = parseInt(match[1], 10);
    if (!max || max <= 0) return null;

    const used = usedCount ?? 0;

    return (
      <div style={{ display: "flex", gap: 4, marginBottom: 4 }}>
        {Array.from({ length: max }).map((_, i) => {
          const filled = i < used;
          return (
            <span
              key={i}
              onClick={() => onChange && onChange(i + 1 === used ? 0 : i + 1)}
              style={{
                width: 14,
                height: 14,
                borderRadius: 999,
                border: "1px solid var(--border)",
                background: filled ? "var(--accent)" : "transparent",
                display: "inline-block",
                cursor: "pointer",
              }}
            />
          );
        })}
      </div>
    );
  };

  const applyFeatureToSkill = async (skillId: string, f: FeatureEntry) => {
    const name = String(f.Title ?? "").trim();
    const freq = String(f.Frequency ?? "").trim();
    const desc = formatFeatureDescription(f.Trigger, f.Effect);

    await updateSkill(skillId, {
      name: name || "New Skill",
      usesPer: freq || "",
      description: desc || "",
    });

    setSkillSuggest({ open: false, skillId: null, query: "", index: 0 });
  };

  const getSuggestions = (query: string) => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return allFeatures.filter((f) => String(f.Title ?? "").toLowerCase().includes(q)).slice(0, 8);
  };

  const openSkillPicker = (skillId: string) => {
    setSkillPickerSkillId(skillId);
    setSkillPickerClass("All");
    setSkillPickerSearch("");
    setSkillPickerOpen(true);
  };

  const filteredPickerFeatures = useMemo(() => {
    const q = skillPickerSearch.trim().toLowerCase();
    return allFeatures.filter((f) => {
      const c = String(f.Class ?? "").trim();
      const title = String(f.Title ?? "");
      if (skillPickerClass !== "All" && c !== skillPickerClass) return false;
      if (q && !title.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [allFeatures, skillPickerClass, skillPickerSearch]);

    // =========================
  // Skill Roller (LOCAL ONLY)
  // =========================
  const [rollerOpen, setRollerOpen] = useState(false);
  const [rollerResult, setRollerResult] = useState<RollerResult | null>(null);
  const [diceAnimating, setDiceAnimating] = useState(false);

  // NOTE: data may be null on initial render; keep hooks stable.
  const profBonus = data?.proficiencyBonus ?? 0;

  const profsByAttr = useMemo(() => {
    const out: Record<SheetAttrKey, { id: string; name: string; proficient: boolean }[]> = {
      str: [],
      dex: [],
      con: [],
      int: [],
      wis: [],
      cha: [],
    };

    if (!data) return out;

    for (const p of data.proficiencies ?? []) {
      const name = String(p.name ?? "").trim();
      if (!name) continue;
      out[p.attribute].push({ id: p.id, name, proficient: !!p.proficient });
    }

    (Object.keys(out) as SheetAttrKey[]).forEach((k) => {
      out[k].sort((a, b) => a.name.localeCompare(b.name));
    });

    return out;
  }, [data?.proficiencies]);

  const rollForProficiency = (attr: SheetAttrKey, skillName: string, isProficient: boolean) => {
    if (!data) return;

    const stat = data.attributes?.[attr] ?? 0;
    const mod = calcModNumber(stat);
    const bonus = mod + (isProficient ? profBonus : 0);

    const die = Math.floor(Math.random() * 20) + 1;
    const total = die + bonus;

    setRollerResult({
      skillName,
      attr,
      die,
      bonus,
      total,
      isNat1: die === 1,
      isNat20: die === 20,
    });

    setDiceAnimating(true);
    window.setTimeout(() => setDiceAnimating(false), 420);
  };

if (loading) {
  return (
    <div className="card">
      <h2 style={{ marginTop: 0 }}>Character Sheet</h2>
      <p className="small">Loading…</p>
    </div>
  );
}

if (!data) {
  return (
    <div className="card">
      <h2 style={{ marginTop: 0 }}>Character Sheet</h2>
      <p className="small">
        No sheet data loaded. Check Firestore rules/permissions and console for snapshot errors.
      </p>
    </div>
  );
}

  const deleteTargetName =
    deleteConfirmOpen && deleteCategoryId
      ? data.inventoryCategories.find((c) => c.id === deleteCategoryId)?.name ?? "this category"
      : null;
      

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* TOP ROW */}
      <div style={{ display: "flex", gap: 16 }}>
        {/* Portrait + Name */}
        <div className="card" style={{ width: 280, display: "flex", flexDirection: "column", gap: 8 }}>
<div
  onClick={() => setPortraitEditing(true)}
  title="Click to edit portrait URL"
  style={{
    width: "100%",
    aspectRatio: "3 / 4",
    borderRadius: 2,
    border: "1px solid var(--border)",
    background: "rgba(0,0,0,0.25)",
    overflow: "hidden",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
    position: "relative",
  }}
>
  {data.portraitUrl ? (
    <img
      src={data.portraitUrl}
      alt="Portrait"
      style={{ width: "100%", height: "100%", objectFit: "cover" }}
      onError={(e) => {
        (e.currentTarget as HTMLImageElement).style.display = "none";
      }}
    />
  ) : (
    <span className="small" style={{ opacity: 0.9 }}>
      Click to set portrait
    </span>
  )}

  {/* subtle hover hint */}
  <div
    style={{
      position: "absolute",
      inset: 0,
      background: "linear-gradient(to top, rgba(0,0,0,0.45), transparent 55%)",
      opacity: 0,
      transition: "opacity 120ms ease",
      pointerEvents: "none",
    }}
    className="portrait-hover-overlay"
  />
  <div
    style={{
      position: "absolute",
      left: 8,
      bottom: 8,
      fontSize: 12,
      padding: "6px 8px",
      borderRadius: 2,
      border: "1px solid rgba(255,255,255,0.2)",
      background: "rgba(0,0,0,0.35)",
      opacity: 0,
      transition: "opacity 120ms ease",
      pointerEvents: "none",
    }}
    className="portrait-hover-label"
  >
    Edit
  </div>
</div>

{/* inline editor */}
{portraitEditing && (
  <div
    style={{
      borderRadius: 2,
      border: "1px solid var(--border)",
      background: "color-mix(in srgb, var(--panel) 85%, transparent)",
      padding: 8,
      display: "flex",
      flexDirection: "column",
      gap: 6,
    }}
  >
    <div className="small" style={{ opacity: 0.9 }}>
      Portrait Image URL
    </div>
    <input
      value={portraitDraft}
      onChange={(e) => setPortraitDraft(e.target.value)}
      placeholder="https://…"
      autoFocus
      onKeyDown={(e) => {
        if (e.key === "Escape") setPortraitEditing(false);
        if (e.key === "Enter") {
          void setPortraitUrl(portraitDraft.trim());
          setPortraitEditing(false);
        }
      }}
    />
    <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
      <button onClick={() => setPortraitEditing(false)}>Cancel</button>
      <button
        onClick={() => {
          void setPortraitUrl(portraitDraft.trim());
          setPortraitEditing(false);
        }}
        disabled={!portraitDraft.trim()}
      >
        Save
      </button>
    </div>
  </div>
)}


          <label className="small">Character Name</label>
          <input value={data.characterName} onChange={(e) => void setCharacterName(e.target.value)} />
          <label className="small">Proficiency</label>
<input
  type="number"
  value={data.proficiencyBonus ?? 0}
  onChange={(e) =>
    void setProficiencyBonus(
      Number.isNaN(parseInt(e.target.value, 10)) ? 0 : parseInt(e.target.value, 10)
    )
  }
/>

        </div>
        {/* Attributes */}
        <div className="card" style={{ flex: 1 }}>
          <h3 style={{ marginTop: 0 }}>Attributes</h3>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 12 }}>
            {(Object.keys(ATTR_LABELS) as SheetAttrKey[]).map((key) => {
              const stat = data.attributes[key];
              const profs = data.proficiencies.filter((p) => p.attribute === key);

              return (
                <div
                  key={key}
                  style={{
                    borderRadius: 2,
                    border: "1px solid var(--border)",
                    padding: 8,
                    display: "flex",
                    flexDirection: "column",
                    gap: 6,
                    background: "color-mix(in srgb, var(--panel) 80%, transparent)",
                  }}
                >
                  <div style={{ fontSize: 13, fontWeight: 800 }}>{ATTR_LABELS[key]}</div>

                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <input
                      type="number"
                      style={{ width: 70 }}
                      value={stat}
                      onChange={(e) =>
                        void setAttribute(key, Number.isNaN(parseInt(e.target.value, 10)) ? 0 : parseInt(e.target.value, 10))
                      }
                    />
                    <div
                      style={{
                        fontSize: 13,
                        padding: "6px 10px",
                        borderRadius: 2,
                        border: "1px solid var(--border)",
                      }}
                    >
                      {calcModifier(stat)}
                    </div>
                  </div>

                  {/* Proficiencies */}
                  <div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                      <span className="small">Proficiencies</span>
                      <button onClick={() => void addProficiency(key, "")} style={{ padding: "4px 10px" }}>
                        +
                      </button>
                    </div>

                    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                      {profs.map((p) => (
                        <div key={p.id} style={{ display: "flex", gap: 6, alignItems: "center" }}>
                          <ProficiencyBubble
  checked={!!p.proficient}
  onToggle={() => void toggleProficiency(p.id)}
  title={p.proficient ? "Proficient" : "Not proficient"}
/>

<input
  style={{
    flex: 1,
    padding: "4px 8px",
    fontSize: 12,
    lineHeight: 1.2,
    height: 30,
  }}
  placeholder="Proficiency name"
  value={p.name}
  onChange={(e) => void setProficiencyName(p.id, e.target.value)}
/>

<button
  onClick={() => void deleteProficiency(p.id)}
  title="Delete proficiency"
  style={{
    padding: 0,
    width: 30,
    height: 30,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 14,
    lineHeight: 1,
  }}
>
  ×
</button>

                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Summary */}
        <div className="card" style={{ width: 260 }}>
          <h3 style={{ marginTop: 0 }}>Summary</h3>

          <label className="small">Level</label>
          <input
            type="number"
            value={data.level}
            onChange={(e) => void setLevel(Number.isNaN(parseInt(e.target.value, 10)) ? 1 : parseInt(e.target.value, 10))}
          />

          <div style={{ height: 10 }} />

          <label className="small">Class</label>
          <input value={data.className} onChange={(e) => void setClassName(e.target.value)} />

          <div style={{ height: 10 }} />

          <label className="small">Experience</label>
          <input
            type="number"
            value={data.experience}
            onChange={(e) =>
              void setExperience(Number.isNaN(parseInt(e.target.value, 10)) ? 0 : parseInt(e.target.value, 10))
            }
          />

          <div style={{ height: 10 }} />

          <label className="small">Currency</label>
          <input
            type="number"
            value={data.currency}
            onChange={(e) =>
              void setCurrency(Number.isNaN(parseInt(e.target.value, 10)) ? 0 : parseInt(e.target.value, 10))
            }
          />

<div style={{ height: 10 }} />

<label className="small">Max HP</label>
<input
  type="number"
  value={data.maxHp ?? 0}
  onChange={(e) =>
    void setMaxHp(Number.isNaN(parseInt(e.target.value, 10)) ? 0 : parseInt(e.target.value, 10))
  }
/>

<div style={{ height: 10 }} />

<label className="small">Current HP</label>
<input
  type="number"
  value={data.currentHp ?? 0}
  onChange={(e) =>
    void setCurrentHp(Number.isNaN(parseInt(e.target.value, 10)) ? 0 : parseInt(e.target.value, 10))
  }
/>

        </div>
      </div>

      {/* FEATURES / SKILLS */}
      <div className="card">
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
          <h3 style={{ margin: 0 }}>Features</h3>
          <button onClick={() => void addSkill()}>+</button>
        </div>

        {data.skills.length === 0 ? (
          <div className="small">Add a feature to track feats or other abilities.</div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 10 }}>
            {data.skills.map((s) => {
              const suggestOpen = skillSuggest.open && skillSuggest.skillId === s.id;
              const suggestions = suggestOpen ? getSuggestions(skillSuggest.query) : [];

              return (
                <div
                  key={s.id}
                  style={{
                    borderRadius: 2,
                    border: "1px solid var(--border)",
                    padding: 10,
                    display: "flex",
                    flexDirection: "column",
                    gap: 8,
                    background: "color-mix(in srgb, var(--panel) 80%, transparent)",
                  }}
                >
                  {/* name row */}
                  <div style={{ position: "relative" }}>
                    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                      <input
                        style={{ flex: 1 }}
                        placeholder="Feature Name — right-click for picker"
                        value={s.name}
                        onChange={(e) => {
                          const v = e.target.value;
                          void updateSkill(s.id, { name: v });
                          setSkillSuggest({ open: true, skillId: s.id, query: v, index: 0 });
                        }}
                        onFocus={() => setSkillSuggest({ open: true, skillId: s.id, query: s.name ?? "", index: 0 })}
                        onBlur={() => {
                          window.setTimeout(() => {
                            setSkillSuggest((prev) =>
                              prev.skillId === s.id ? { open: false, skillId: null, query: "", index: 0 } : prev
                            );
                          }, 120);
                        }}
                        onContextMenu={(e) => {
                          e.preventDefault();
                          openSkillPicker(s.id);
                        }}
                        onKeyDown={async (e) => {
                          if (!suggestOpen) return;
                          if (e.key === "ArrowDown") {
                            e.preventDefault();
                            setSkillSuggest((prev) => ({
                              ...prev,
                              index: Math.min(prev.index + 1, Math.max(0, suggestions.length - 1)),
                            }));
                          } else if (e.key === "ArrowUp") {
                            e.preventDefault();
                            setSkillSuggest((prev) => ({ ...prev, index: Math.max(prev.index - 1, 0) }));
                          } else if (e.key === "Enter") {
                            if (suggestions.length > 0) {
                              e.preventDefault();
                              const pick = suggestions[Math.min(skillSuggest.index, suggestions.length - 1)];
                              await applyFeatureToSkill(s.id, pick);
                            }
                          } else if (e.key === "Escape") {
                            setSkillSuggest({ open: false, skillId: null, query: "", index: 0 });
                          }
                        }}
                        title="Type to autocomplete from Features.json. Right-click to open the full picker."
                      />

                      <button onClick={() => openSkillPicker(s.id)} title="Open feature picker" style={{ padding: "10px 12px" }}>
                        ⋯
                      </button>

                      <button onClick={() => void deleteSkill(s.id)} title="Delete skill" style={{ padding: "10px 12px" }}>
                        ×
                      </button>
                    </div>

                    {suggestOpen && suggestions.length > 0 && (
                      <div
                        style={{
                          position: "absolute",
                          left: 0,
                          right: 0,
                          top: "100%",
                          marginTop: 8,
                          background: "var(--panel)",
                          border: "1px solid var(--border)",
                          borderRadius: 2,
                          overflow: "hidden",
                          zIndex: 50,
                          boxShadow: "0 10px 30px rgba(0,0,0,0.35)",
                        }}
                      >
                        {suggestions.map((f, idx) => {
                          const active = idx === skillSuggest.index;
                          return (
                            <button
                              key={`${f.Class}-${f.Title}-${idx}`}
                              onMouseDown={(ev) => ev.preventDefault()}
                              onClick={() => void applyFeatureToSkill(s.id, f)}
                              style={{
                                width: "100%",
                                textAlign: "left",
                                border: "none",
                                borderBottom: "1px solid var(--border)",
                                background: active ? "color-mix(in srgb, var(--accent) 18%, transparent)" : "transparent",
                                padding: "10px 12px",
                              }}
                              title={String(f.Prerequisites ?? "").trim() || undefined}
                            >
                              <div style={{ fontWeight: 900 }}>{f.Title}</div>
                              <div className="small">
                                {f.Class}
                                {f.Frequency ? ` • ${f.Frequency}` : ""}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  <label className="small">Frequency</label>
                  <input
                    placeholder="Checks appear based on first numerical value."
                    value={s.usesPer ?? ""}
                    onChange={(e) => void updateSkill(s.id, { usesPer: e.target.value })}
                  />

                  {renderUsesBubbles(s.usesPer, s.usedCount ?? 0, (n) => void updateSkillUsedCount(s.id, n))}

                  <label className="small">Description</label>
                  <textarea
                    style={{ minHeight: 92, resize: "vertical" }}
                    placeholder={"Trigger:\n\n\nEffect:\n"}
                    value={s.description ?? ""}
                    onChange={(e) => void updateSkill(s.id, { description: e.target.value })}
                  />
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* INVENTORY */}
      <div className="card">
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
          <h3 style={{ margin: 0 }}>Inventory</h3>
          <button
            onClick={() => {
              const baseName = `Category ${categoryTabs.length + 1}`;
              void addInventoryCategory(baseName);
            }}
          >
            + Add Category
          </button>
        </div>

        {/* tabs */}
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 12 }}>
          {categoryTabs.map((c) => {
            const selected = c.id === selectedCategoryId;
            return (
              <button
                key={c.id}
                onClick={() => setSelectedCategoryId(c.id)}
                onContextMenu={(e) => openInventoryTabMenu(e, c.id)}
                title="Right-click for options"
                style={{
                  padding: "8px 12px",
                  borderColor: selected ? "var(--accent)" : "var(--border)",
                  background: selected ? "color-mix(in srgb, var(--accent) 18%, transparent)" : "transparent",
                }}
              >
                {c.name}
              </button>
            );
          })}
        </div>

        {currentCategory ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <button style={{ alignSelf: "flex-start" }} onClick={() => void addInventoryItem(currentCategory.id)}>
              + Add Item
            </button>

            {currentCategory.items.length === 0 ? (
              <div className="small">No items in this category yet.</div>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 10 }}>
                {currentCategory.items.map((item) => (
                  <div
                    key={item.id}
                    style={{
                      borderRadius: 2,
                      border: "1px solid var(--border)",
                      padding: 10,
                      display: "flex",
                      gap: 8,
                      alignItems: "center",
                      background: "color-mix(in srgb, var(--panel) 80%, transparent)",
                    }}
                  >
                    <input
                      type="number"
                      style={{ width: 90 }}
                      value={item.quantity}
                      onChange={(e) =>
                        void updateInventoryItem(
                          currentCategory.id,
                          item.id,
                          Number.isNaN(parseInt(e.target.value, 10)) ? 0 : parseInt(e.target.value, 10),
                          item.name
                        )
                      }
                    />
                    <input
                      style={{ flex: 1 }}
                      value={item.name}
                      onChange={(e) => void updateInventoryItem(currentCategory.id, item.id, item.quantity, e.target.value)}
                    />
                    <button onClick={() => void deleteInventoryItem(currentCategory.id, item.id)} title="Delete item">
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="small">No category selected.</div>
        )}
      </div>

      {/* Inventory tab context menu */}
      {invTabMenu.open && (
        <div
          ref={menuRef}
          style={{
            position: "fixed",
            left: invTabMenu.x,
            top: invTabMenu.y,
            zIndex: 9999,
            background: "var(--panel)",
            border: "1px solid var(--border)",
            borderRadius: 2,
            overflow: "hidden",
            boxShadow: "0 10px 30px rgba(0,0,0,0.35)",
          }}
        >
          <button
            style={{ width: "100%", textAlign: "left", border: "none", padding: "10px 12px" }}
            onClick={() => {
              const id = invTabMenu.categoryId!;
              setInvTabMenu({ open: false, x: 0, y: 0, categoryId: null });
              openRenameModal(id);
            }}
          >
            Rename
          </button>
          <button
            style={{
              width: "100%",
              textAlign: "left",
              border: "none",
              padding: "10px 12px",
              color: "#ef4444",
            }}
            onClick={() => {
              const id = invTabMenu.categoryId!;
              setInvTabMenu({ open: false, x: 0, y: 0, categoryId: null });
              openDeleteConfirm(id);
            }}
          >
            Delete
          </button>
        </div>
      )}

      {/* Rename modal */}
      {renameOpen && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.55)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 9999,
          }}
          onMouseDown={() => setRenameOpen(false)}
        >
          <div className="card" style={{ width: 440 }} onMouseDown={(e) => e.stopPropagation()}>
            <div style={{ fontWeight: 900, marginBottom: 10 }}>Rename Inventory Category</div>

            <input
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              placeholder="Name"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Escape") setRenameOpen(false);
                if (e.key === "Enter") void submitRename();
              }}
            />

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 12 }}>
              <button onClick={() => setRenameOpen(false)}>Cancel</button>
              <button onClick={() => void submitRename()} disabled={!renameValue.trim()}>
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirm modal */}
      {deleteConfirmOpen && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.55)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 9999,
          }}
          onMouseDown={cancelDelete}
        >
          <div className="card" style={{ width: 520 }} onMouseDown={(e) => e.stopPropagation()}>
            <div style={{ fontWeight: 900, marginBottom: 10 }}>Delete Inventory Category</div>

            <div className="small" style={{ lineHeight: 1.4 }}>
              Are you sure you want to delete <b>{deleteTargetName ?? "this category"}</b>? This action cannot be undone.
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 12 }}>
              <button onClick={cancelDelete}>Cancel</button>
              <button onClick={() => void confirmDelete()} style={{ borderColor: "rgba(220, 38, 38, 0.6)" }}>
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Skill Picker Modal */}
      {skillPickerOpen && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.55)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 9999,
          }}
          onMouseDown={() => setSkillPickerOpen(false)}
        >
          <div className="card" style={{ width: 820, height: 680, display: "flex", flexDirection: "column", gap: 10 }} onMouseDown={(e) => e.stopPropagation()}>
            <div style={{ fontWeight: 900 }}>Pick a Feature</div>

            <div style={{ display: "flex", gap: 8 }}>
              <select value={skillPickerClass} onChange={(e) => setSkillPickerClass(e.target.value)} style={{ width: 260 }}>
                <option value="All">All Classes</option>
                {featureClasses.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>

              <input
                value={skillPickerSearch}
                onChange={(e) => setSkillPickerSearch(e.target.value)}
                placeholder="Search title…"
                style={{ flex: 1 }}
                autoFocus
              />
            </div>

            <div
              style={{
                flex: 1,
                minHeight: 0,
                overflow: "auto",
                background: "var(--panel-2)",
                border: "1px solid var(--border)",
                borderRadius: 2,
                padding: 10,
              }}
            >
              {filteredPickerFeatures.length === 0 ? (
                <div className="small" style={{ padding: 12 }}>
                  No matches.
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {filteredPickerFeatures.slice(0, 250).map((f, idx) => {
                    const prereq = String(f.Prerequisites ?? "").trim();
                    const freq = String(f.Frequency ?? "").trim();
                    const trig = String(f.Trigger ?? "").trim();
                    const eff = String(f.Effect ?? "").trim();

                    const descriptionParts: string[] = [];
                    if (trig) descriptionParts.push(`Trigger: ${trig}`);
                    if (eff) descriptionParts.push(`Effect: ${eff}`);
                    const description = descriptionParts.join("  •  ");

                    return (
                      <button
                        key={`${f.Class}-${f.Title}-${idx}`}
                        onClick={async () => {
                          if (!skillPickerSkillId) return;
                          await applyFeatureToSkill(skillPickerSkillId, f);
                          setSkillPickerOpen(false);
                          setSkillPickerSkillId(null);
                        }}
                        title={prereq || undefined}
                        style={{
                          textAlign: "left",
                          background: "var(--panel)",
                          border: "1px solid var(--border)",
                          borderRadius: 2,
                          padding: 12,
                        }}
                      >
                        <div style={{ fontWeight: 900 }}>{f.Title}</div>
                        <div className="small" style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                          <span>{f.Class}</span>
                          <span>{prereq}</span>
                        </div>
                        {freq ? <div className="small" style={{ marginTop: 6 }}>Frequency: {freq}</div> : null}
                        {description ? <div className="small" style={{ marginTop: 6, opacity: 0.9 }}>{description}</div> : null}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
              <button onClick={() => setSkillPickerOpen(false)}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* =========================
          Skill Roller Toggle + Panel
          ========================= */}
      <style>{`
        @keyframes diceShake {
          0%   { transform: translate(0, 0) rotate(0deg); }
          15%  { transform: translate(-2px, 1px) rotate(-6deg); }
          30%  { transform: translate(3px, -2px) rotate(7deg); }
          45%  { transform: translate(-3px, -1px) rotate(-8deg); }
          60%  { transform: translate(2px, 2px) rotate(6deg); }
          75%  { transform: translate(-1px, 2px) rotate(-4deg); }
          100% { transform: translate(0, 0) rotate(0deg); }
        }

.portrait-hover-overlay,
.portrait-hover-label {
  opacity: 0;
}
div:hover > .portrait-hover-overlay,
div:hover > .portrait-hover-label {
  opacity: 1;
}
      `}</style>

      {/* Floating toggle button (bottom-right) */}
      <button
        onClick={() => setRollerOpen((v) => !v)}
        title="Skill Roller"
        style={{
          position: "fixed",
          right: 16,
          bottom: 16,
          zIndex: 9998,
          width: 44,
          height: 44,
          borderRadius: 2,
          border: "1px solid var(--border)",
          background: "color-mix(in srgb, var(--panel) 80%, transparent)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 18,
        }}
      >
        ⬡
      </button>

      {/* Fixed-size roller panel */}
      {rollerOpen && (
        <div
          style={{
            position: "fixed",
            right: 16,
            bottom: 70,
            zIndex: 9999,
            width: 420,
            height: 560,
            borderRadius: 2,
            border: "1px solid var(--border)",
            background: "var(--panel)",
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
          }}
        >
          {/* Sticky header */}
          <div
            style={{
              position: "sticky",
              top: 0,
              zIndex: 2,
              padding: 12,
              borderBottom: "1px solid var(--border)",
              background: "var(--panel)",
              display: "flex",
              gap: 10,
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
              <div
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 8,
                  border: "1px solid var(--border)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  background: "color-mix(in srgb, var(--panel-2) 80%, transparent)",
                  animation: diceAnimating ? "diceShake 420ms ease-in-out" : "none",
                  userSelect: "none",
                }}
                title="Click a skill below to roll"
              >
                ⬡
              </div>

              <div style={{ display: "flex", flexDirection: "column", lineHeight: 1.15 }}>
                <div style={{ fontWeight: 900 }}>Check Roller</div>
              </div>
            </div>

            <button onClick={() => setRollerOpen(false)} title="Close" style={{ padding: "8px 10px" }}>
              ×
            </button>
          </div>

          {/* Result bar (stays near top, inside header area visually) */}
          <div
            style={{
              padding: "10px 12px",
              borderBottom: "1px solid var(--border)",
              background: "color-mix(in srgb, var(--panel) 85%, transparent)",
              minHeight: 54,
              display: "flex",
              alignItems: "center",
              gap: 10,
            }}
          >
            {rollerResult ? (
              <>
                <div style={{ fontWeight: 900 }}>
                  {rollerResult.skillName}
                </div>
                <div className="small" style={{ opacity: 0.9 }}>
                  <b>{rollerResult.die}</b> {rollerResult.isNat1 ? "— Natural 1" : rollerResult.isNat20 ? "— Natural 20" : ""}
                  {"  "}<b>{fmtSigned(rollerResult.bonus)}</b> = <b>{rollerResult.total}</b>
                </div>
              </>
            ) : (
              <div className="small">Click a skill to roll.</div>
            )}
          </div>

          {/* Scroll area for blocks */}
          <div
            style={{
              flex: 1,
              minHeight: 0,
              overflow: "auto",
              padding: 12,
              background: "var(--panel-2)",
            }}
          >
            {(["str","dex","con","int","wis","cha"] as SheetAttrKey[]).map((attr) => {
              const stat = data.attributes[attr] ?? 0;
              const mod = calcModNumber(stat);
              const list = profsByAttr[attr] ?? [];

              return (
                <div
                  key={attr}
                  style={{
                    border: "1px solid var(--border)",
                    borderRadius: 2,
                    background: "var(--panel)",
                    marginBottom: 10,
                    overflow: "hidden",
                  }}
                >
                  {/* Attribute header */}
                  <div
                    style={{
                      padding: "10px 12px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      borderBottom: "1px solid var(--border)",
                      background: "color-mix(in srgb, var(--accent) 12%, var(--panel) 88%)",

                    }}
                  >
<div style={{ fontWeight: 900, color: "var(--accent)" }}>
  {ATTR_LABELS[attr]}
  <span
    className="small"
    style={{
      marginLeft: 8,
      opacity: 0.95,
      color: "var(--text)", // keep the mod readable in both themes
    }}
  >
    {fmtSigned(mod)}
  </span>
</div>

                    <div className="small" style={{ opacity: 0.85 }}>
                    </div>
                  </div>

                  {/* Blocks */}
                  {list.length === 0 ? (
                    <div className="small" style={{ padding: 10, opacity: 0.85 }}>
                    </div>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column" }}>
                      {list.map((p) => {
                        const bonus = mod + (p.proficient ? profBonus : 0);
                        return (
                          <button
                            key={p.id}
                            onClick={() => rollForProficiency(attr, p.name, p.proficient)}
                            style={{
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "space-between",
                              gap: 10,
                              width: "100%",
                              textAlign: "left",
                              padding: "10px 12px",
                              border: "none",
                              borderBottom: "1px solid var(--border)",
                              background: "transparent",
                              cursor: "pointer",
                            }}
                            title="Roll 1d20 + bonus"
                          >
                            <div style={{ display: "flex", flexDirection: "column", lineHeight: 1.15 }}>
                              <div style={{ fontWeight: 900 }}>{p.name}</div>
                            </div>

                            <div
                              style={{
                                fontWeight: 900,
                                border: "1px solid var(--border)",
                                borderRadius: 2,
                                padding: "6px 10px",
                                background: "color-mix(in srgb, var(--panel) 85%, transparent)",
                                minWidth: 64,
                                textAlign: "center",
                              }}
                            >
                              {fmtSigned(bonus)}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

    </div>
  );
};
