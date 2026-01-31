import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  collection,
  doc,
  getDoc,
  runTransaction,
  serverTimestamp,
  Timestamp,
} from "firebase/firestore";
import { auth, db } from "../firebase";
import { BLOG_TAGS, type BlogTag } from "../types/blog";
import { slugifyTitle } from "../blog/blogUtils";
import { BlogRichEditor } from "../blog/BlogRichEditor";
import { SlashLinkPicker } from "../blog/SlashLinkPicker";
import type { Editor } from "@tiptap/core";


type UserDoc = {
  alias: string | null;
  pronouns: string | null;
  photoUrl: string | null;
  roles: string[];
};

const EMPTY_DOC = { type: "doc", content: [{ type: "paragraph" }] };

function BubbleToggle({
  checked,
  onToggle,
  title,
}: {
  checked: boolean;
  onToggle: () => void;
  title?: string;
}) {
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
}

function toLocalInputValue(d: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours()
  )}:${pad(d.getMinutes())}`;
}

function fromLocalInputValue(v: string) {
  return new Date(v);
}

export function BlogEditorPage({ mode }: { mode: "new" | "edit" }) {
  const nav = useNavigate();
  const { postId } = useParams();

  const [me, setMe] = useState<UserDoc | null>(null);
  const [loading, setLoading] = useState(mode === "edit");
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  const [title, setTitle] = useState("");
  const [tags, setTags] = useState<BlogTag[]>([]);

  // JSON draft (only saved when user presses Save)
  const [contentJson, setContentJson] = useState<any>(EMPTY_DOC);
  const [editor, setEditor] = useState<Editor | null>(null);

  // Slash picker
  const [pickerKind, setPickerKind] = useState<
    "blog" | "calendar" | "forum" | "guide" | null
  >(null);

  // ---- Blog → Calendar integration ----
  const [createEvent, setCreateEvent] = useState(false);
  const [eventStart, setEventStart] = useState<string>("");
  const [eventEnd, setEventEnd] = useState<string>("");

  const [linkedEventId, setLinkedEventId] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const u = auth.currentUser;
      if (!u) return;

      const snap = await getDoc(doc(db, "users", u.uid));
      const data: any = snap.data() ?? {};
      setMe({
        alias: data.alias ?? null,
        pronouns: data.pronouns ?? null,
        photoUrl: data.photoUrl ?? null,
        roles: Array.isArray(data.roles) ? data.roles : [],
      });
    })();
  }, []);

  const canCreate = useMemo(() => {
    const r = me?.roles ?? [];
    return r.includes("Admin") || r.includes("Officer") || r.includes("Moderator");
  }, [me]);

  const canEdit = useMemo(() => {
    const r = me?.roles ?? [];
    return r.includes("Admin") || r.includes("Moderator");
  }, [me]);

  useEffect(() => {
    if (mode !== "edit") return;
    if (!postId) return;

    (async () => {
      setLoading(true);
      setStatus(null);
      try {
        const snap = await getDoc(doc(db, "blogPosts", postId));
        if (!snap.exists()) {
          setStatus("Post not found.");
          return;
        }
        const p: any = snap.data();
        setTitle(p.title ?? "");
        setTags(Array.isArray(p.tags) ? p.tags : []);

        if (p.contentJson) {
          setContentJson(p.contentJson);
        } else {
          const txt = String(p.contentText ?? "").trim();
          setContentJson(
            txt
              ? {
                  type: "doc",
                  content: [
                    {
                      type: "paragraph",
                      content: [{ type: "text", text: txt }],
                    },
                  ],
                }
              : EMPTY_DOC
          );
        }

        const le = p.linkedEventId ?? null;
        setLinkedEventId(le);

        if (le) {
          setCreateEvent(true);
          if (p.eventStartAt?.toDate) setEventStart(toLocalInputValue(p.eventStartAt.toDate()));
          if (p.eventEndAt?.toDate) setEventEnd(toLocalInputValue(p.eventEndAt.toDate()));
        }
      } catch (e: any) {
        console.error(e);
        setStatus(e?.message ?? String(e));
      } finally {
        setLoading(false);
      }
    })();
  }, [mode, postId]);

  function toggleTag(t: BlogTag) {
    setTags((prev) => (prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]));
  }

  async function save() {
    const u = auth.currentUser;
    if (!u) return;

    setStatus(null);

    if (!me?.alias) {
      setStatus("Set your Alias in Profile before publishing.");
      return;
    }

    if (mode === "new" && !canCreate) {
      setStatus("You do not have permission to create blog posts.");
      return;
    }
    if (mode === "edit" && !canEdit) {
      setStatus("You do not have permission to edit blog posts.");
      return;
    }

    const t = title.trim();
    if (t.length < 3) {
      setStatus("Title must be at least 3 characters.");
      return;
    }

    const slug = slugifyTitle(t);
    if (!slug) {
      setStatus("Title produced an invalid slug. Try a different title.");
      return;
    }

    const jsonToSave = editor?.getJSON() ?? contentJson ?? EMPTY_DOC;
    const textToSave = editor?.getText()?.trim() ?? "";

    const wantsEvent = createEvent;
    const startDate = wantsEvent ? (eventStart.trim() ? fromLocalInputValue(eventStart) : null) : null;
    const endDate = wantsEvent ? (eventEnd.trim() ? fromLocalInputValue(eventEnd) : null) : null;

    if (wantsEvent && !startDate) {
      setStatus("If 'Create Event' is enabled, you must pick a Start date/time.");
      return;
    }

    setSaving(true);
    try {
      if (mode === "new") {
        await runTransaction(db, async (tx) => {
          const slugRef = doc(db, "blogSlugIndex", slug);
          const slugSnap = await tx.get(slugRef);
          if (slugSnap.exists()) {
            throw new Error("That title is already taken. Change the title slightly.");
          }

          const newPostRef = doc(collection(db, "blogPosts"));

          let newEventRef: any = null;
          if (wantsEvent && startDate) {
            newEventRef = doc(collection(db, "events"));
          }

          tx.set(slugRef, { postId: newPostRef.id, createdAt: serverTimestamp() });

          tx.set(newPostRef, {
            title: t,
            slug,
            tags,

            contentJson: jsonToSave,
            contentText: textToSave,

            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
            authorUid: u.uid,
            authorAliasSnapshot: me.alias,
            authorPronounsSnapshot: me.pronouns ?? null,
            authorPhotoSnapshot: me.photoUrl ?? null,

            linkedEventId: newEventRef ? newEventRef.id : null,
            eventStartAt: newEventRef ? Timestamp.fromDate(startDate!) : null,
            eventEndAt: newEventRef && endDate ? Timestamp.fromDate(endDate) : null,
          });

          if (newEventRef) {
            tx.set(newEventRef, {
              title: t,
              startAt: Timestamp.fromDate(startDate!),
              endAt: endDate ? Timestamp.fromDate(endDate) : null,
              imageUrl: null,
              linkedBlogPostId: newPostRef.id,
              linkedBlogSlug: slug,
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            });
          }
        });

        nav(`/blog/${slug}`, { replace: true });
      } else {
        if (!postId) throw new Error("Missing postId.");

        await runTransaction(db, async (tx) => {
          const postRef = doc(db, "blogPosts", postId);
          const postSnap = await tx.get(postRef);
          if (!postSnap.exists()) throw new Error("Post not found.");

          const prev: any = postSnap.data();
          const oldSlug = prev.slug as string | null;
          const prevLinkedEventId = (prev.linkedEventId ?? null) as string | null;

          if (oldSlug !== slug) {
            const newSlugRef = doc(db, "blogSlugIndex", slug);
            const newSlugSnap = await tx.get(newSlugRef);
            if (newSlugSnap.exists()) {
              throw new Error("That title is already taken. Change the title slightly.");
            }
            tx.set(newSlugRef, { postId, createdAt: serverTimestamp() });
            if (oldSlug) tx.delete(doc(db, "blogSlugIndex", oldSlug));
          }

          let finalEventId: string | null = prevLinkedEventId;

          // Turning off just unlinks (doesn't delete the event; delete from Calendar if desired)
          if (!wantsEvent && prevLinkedEventId) {
            finalEventId = null;
          }

          // Turning on with no existing event → create one
          let createdEventRef: any = null;
          if (wantsEvent && startDate && !prevLinkedEventId) {
            createdEventRef = doc(collection(db, "events"));
            finalEventId = createdEventRef.id;
          }

          tx.update(postRef, {
            title: t,
            slug,
            tags,

            contentJson: jsonToSave,
            contentText: textToSave,

            updatedAt: serverTimestamp(),

            linkedEventId: wantsEvent ? finalEventId : null,
            eventStartAt: wantsEvent && startDate ? Timestamp.fromDate(startDate) : null,
            eventEndAt: wantsEvent && endDate ? Timestamp.fromDate(endDate) : null,
          });

          if (wantsEvent && startDate && prevLinkedEventId) {
            const evRef = doc(db, "events", prevLinkedEventId);
            tx.update(evRef, {
              title: t,
              startAt: Timestamp.fromDate(startDate),
              endAt: endDate ? Timestamp.fromDate(endDate) : null,
              linkedBlogPostId: postId,
              linkedBlogSlug: slug,
              updatedAt: serverTimestamp(),
            });
          }

          if (createdEventRef) {
            tx.set(createdEventRef, {
              title: t,
              startAt: Timestamp.fromDate(startDate!),
              endAt: endDate ? Timestamp.fromDate(endDate) : null,
              imageUrl: null,
              linkedBlogPostId: postId,
              linkedBlogSlug: slug,
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            });
          }

          if (wantsEvent && prevLinkedEventId && oldSlug !== slug) {
            const evRef = doc(db, "events", prevLinkedEventId);
            tx.update(evRef, { linkedBlogSlug: slug, title: t, updatedAt: serverTimestamp() });
          }
        });

        nav(`/blog/${slug}`, { replace: true });
      }
    } catch (e: any) {
      console.error(e);
      setStatus(e?.message ?? String(e));
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="card">Loading…</div>;

  return (
    <div style={{ display: "grid", gap: 14, maxWidth: 980 }}>
<div className="card">
  <div
    style={{
      display: "flex",
      alignItems: "center",
      gap: 12,
      flexWrap: "wrap",
    }}
  >
    <button type="button" onClick={() => nav("/blog")}>
      Cancel
    </button>

    <h1 style={{ margin: 0 }}>
      {mode === "new" ? "New Blog Post" : "Edit Blog Post"}
    </h1>
  </div>

  {status ? <div className="small">{status}</div> : null}
</div>


      <div className="card" style={{ display: "grid", gap: 10 }}>
        <label style={{ display: "grid", gap: 6 }}>
          <span className="small">Title</span>
          <input value={title} onChange={(e) => setTitle(e.target.value)} />
        </label>

        {/* Create Event toggle */}
        <div className="card" style={{ padding: 12, display: "grid", gap: 10 }}>
<label style={{ display: "flex", gap: 10, alignItems: "center" }}>
  <BubbleToggle
    checked={createEvent}
    onToggle={() => {
      const on = !createEvent;
      setCreateEvent(on);
      if (on && !eventStart) setEventStart(toLocalInputValue(new Date()));
    }}
    title={createEvent ? "Enabled" : "Disabled"}
  />
  <div>
    <div style={{ fontWeight: 900 }}>Create Event</div>
    <div className="small">
      Adds a matching Calendar event. Editing the event
      on the Calendar will also update this blog post’s event time.
    </div>
  </div>
</label>


          {createEvent ? (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <label style={{ display: "grid", gap: 6 }}>
                <span className="small">Start</span>
                <input
                  type="datetime-local"
                  value={eventStart}
                  onChange={(e) => setEventStart(e.target.value)}
                />
              </label>
              <label style={{ display: "grid", gap: 6 }}>
                <span className="small">End (optional)</span>
                <input
                  type="datetime-local"
                  value={eventEnd}
                  onChange={(e) => setEventEnd(e.target.value)}
                />
              </label>
            </div>
          ) : linkedEventId ? (
            <div className="small">
              This post is currently linked to an event. Turning this off will unlink (the event
              stays on the calendar unless you delete it there).
            </div>
          ) : null}
        </div>

        <div style={{ display: "grid", gap: 8 }}>
          <div className="small">Tags</div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            {BLOG_TAGS.map((tg) => (
              <button
                key={tg}
                type="button"
                onClick={() => toggleTag(tg)}
                style={{
                  padding: "8px 10px",
                  borderRadius: 2,
                  border: "1px solid var(--border)",
                  background: tags.includes(tg) ? "rgb(26, 26, 26)" : "transparent",
                  color: "var(--text)",
                  cursor: "pointer",
                }}
              >
                {tg}
              </button>
            ))}
          </div>
        </div>

        {/* TipTap content + slash picker */}
        <div
          onKeyDown={(e) => {
            if (!editor) return;
            if (e.key !== " " && e.key !== "Enter" && e.key !== "Tab") return;

            const { from } = editor.state.selection;
            const lookback = 32;
            const textBefore = editor.state.doc.textBetween(
              Math.max(0, from - lookback),
              from,
              " "
            );

            const token = (textBefore.split(/\s/).pop() ?? "").trim();

            const openPicker = (
              kind: "blog" | "calendar" | "forum" | "guide",
              deleteLen: number
            ) => {
              editor
                .chain()
                .focus()
                .deleteRange({ from: from - deleteLen, to: from })
                .run();
              setPickerKind(kind);
            };

            if (token === "/blog") return openPicker("blog", 5);
            if (token === "/calendar") return openPicker("calendar", 9);
            if (token === "/forum") return openPicker("forum", 5);
            if (token === "/guide") return openPicker("guide", 5);
          }}
        >
          <div className="small" style={{ marginBottom: 6 }}>
            Content
          </div>

          <BlogRichEditor
            initialJson={contentJson}
            onEditorReady={(ed) => setEditor(ed)}
          />
        </div>

        <button
          onClick={() => void save()}
          disabled={saving}
          style={{
            width: 160,
            padding: "10px 12px",
            borderRadius: 2,
            border: "1px solid var(--border)",
            background: "var(--accent)",
            color: "white",
            fontWeight: 900,
            cursor: "pointer",
          }}
        >
          {saving ? "Saving…" : "Save"}
        </button>
      </div>

      {pickerKind ? (
        <SlashLinkPicker
          kind={pickerKind}
          onClose={() => setPickerKind(null)}
          onPick={(label, href) => {
            if (!editor) return;

            editor
              .chain()
              .focus()
              .insertContent([
                {
                  type: "text",
                  text: label,
                  marks: [{ type: "link", attrs: { href } }],
                },
                { type: "text", text: " " },
              ])
              .run();

            setPickerKind(null);
          }}
        />
      ) : null}
    </div>
  );
}
