import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  Timestamp,
  updateDoc,
  where,
  writeBatch,
} from "firebase/firestore";
import { auth, db } from "../firebase";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import LinkExt from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import { SlashLinkPicker } from "../blog/SlashLinkPicker";
import { BlogRichViewer } from "../blog/BlogRichViewer";

/** =========================
 * Types
 * ========================= */
type EventDoc = {
  id: string;
  title: string;
  startAt: any;
  endAt: any | null;
  imageUrl: string | null;
  linkedBlogPostId: string | null;
  linkedBlogSlug: string | null;
};

type BlogPick = { id: string; title: string; slug: string; tags?: string[]; createdAt?: any; contentText?: string };

type MeDoc = { roles: string[]; alias: string | null; pronouns: string | null; photoUrl: string | null };

type EventComment = {
  id: string;
  authorUid: string;
  authorAliasSnapshot: string;
  authorPronounsSnapshot: string | null;
  authorPhotoSnapshot: string | null;
  text: string;
  createdAt: any;
  parentId: string | null;
};

function isTimestampLike(x: any) {
  return !!x && typeof x.toDate === "function";
}

function dateKey(d: Date) {
  // local yyyy-mm-dd
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function startOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
}

function addDays(d: Date, n: number) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

function sameMonth(a: Date, y: number, m0: number) {
  return a.getFullYear() === y && a.getMonth() === m0;
}

function toLocalInputValue(d: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(
    d.getMinutes()
  )}`;
}

function fromLocalInputValue(v: string) {
  return new Date(v);
}

function monthName(m0: number) {
  return ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"][m0] ?? String(m0 + 1);
}

function dayName(i: number) {
  return ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"][i] ?? "";
}

function clamp(n: number, a: number, b: number) {
  return Math.max(a, Math.min(b, n));
}

function useQueryParam(name: string) {
  const loc = useLocation();
  return useMemo(() => new URLSearchParams(loc.search).get(name), [loc.search, name]);
}

/** =========================
 * Calendar Page
 * ========================= */
export function CalendarPage() {
    const nav = useNavigate();
    const CELL_HEIGHT = 170; // <-- change this number to resize boxes
  const eventParam = useQueryParam("event");
  const today = useMemo(() => new Date(), []);
  const [year, setYear] = useState<number>(today.getFullYear());
  const [month0, setMonth0] = useState<number>(today.getMonth());

  const [events, setEvents] = useState<EventDoc[]>([]);
  const [me, setMe] = useState<MeDoc | null>(null);

  const isStaff = (me?.roles ?? []).some((r) => r === "Admin" || r === "Officer" || r === "Moderator");

  // selected event for DETAILS modal (anyone can open)
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);

  // editor modal (staff only)
  const [editEventId, setEditEventId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  // drag state (staff only)
  const dragRef = useRef<{ eventId: string; fromKey: string } | null>(null);
  const [dragOverKey, setDragOverKey] = useState<string | null>(null);

useEffect(() => {
  if (!eventParam) return;
  if (!events.length) return;

  const ev = events.find((e) => e.id === eventParam);
  if (!ev) return;

  const dt = ev.startAt?.toDate?.() ? ev.startAt.toDate() : null;
  if (!dt) return;

  // Jump calendar to the event's month/year
  setYear(dt.getFullYear());
  setMonth0(dt.getMonth());

  // Open the details modal for that event
  setSelectedEventId(ev.id);

  // Keep the URL stable so refresh keeps working
  nav(`/calendar?event=${ev.id}`, { replace: true });
}, [eventParam, events, nav]);


  // Load me (roles + alias info)
  useEffect(() => {
    const u = auth.currentUser;
    if (!u) return;

    const unsub = onSnapshot(doc(db, "users", u.uid), (snap) => {
      const data: any = snap.data() ?? {};
      setMe({
        roles: Array.isArray(data.roles) ? data.roles : [],
        alias: data.alias ?? null,
        pronouns: data.pronouns ?? null,
        photoUrl: data.photoUrl ?? null,
      });
    });

    return () => unsub();
  }, []);

  // Subscribe to all events (small club site; simplest). Later we can range-query by month.
  useEffect(() => {
    const q = query(collection(db, "events"), orderBy("startAt", "asc"));
    const unsub = onSnapshot(q, (snap) => {
      setEvents(snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })));
    });
    return () => unsub();
  }, []);

  // Year tabs: show a reasonable window based on events and current year
  const yearTabs = useMemo(() => {
    const ys = new Set<number>([today.getFullYear()]);
    for (const ev of events) {
      const dt = ev.startAt?.toDate?.();
      if (dt) ys.add(dt.getFullYear());
    }
    const arr = Array.from(ys).sort((a, b) => b - a);
    // Keep it not too huge: show up to 6 years around data
    if (arr.length > 6) return arr.slice(0, 6);
    return arr;
  }, [events, today]);

  // Build month grid: 6 rows * 7 columns starting from the Sunday before the 1st
  const gridDays = useMemo(() => {
    const first = new Date(year, month0, 1);
    const dow = first.getDay(); // 0 Sun
    const start = addDays(first, -dow);
    const cells = Array.from({ length: 42 }, (_, i) => addDays(start, i));
    return cells;
  }, [year, month0]);

  // Group events by day key
  const eventsByDay = useMemo(() => {
    const map = new Map<string, EventDoc[]>();
    for (const ev of events) {
      const dt = ev.startAt?.toDate?.();
      if (!dt) continue;
      const key = dateKey(dt);
      const arr = map.get(key) ?? [];
      arr.push(ev);
      map.set(key, arr);
    }
    // Sort within each day by time
    for (const [k, arr] of map.entries()) {
      arr.sort((a, b) => {
        const ad = a.startAt?.toDate?.()?.getTime?.() ?? 0;
        const bd = b.startAt?.toDate?.()?.getTime?.() ?? 0;
        return ad - bd;
      });
      map.set(k, arr);
    }
    return map;
  }, [events]);

  async function staffMoveEventToDay(eventId: string, targetDay: Date) {
    // Update only on drop. Keep time-of-day the same.
    const ev = events.find((e) => e.id === eventId);
    if (!ev) return;
    const cur = ev.startAt?.toDate?.();
    if (!cur) return;

    const newStart = new Date(targetDay.getFullYear(), targetDay.getMonth(), targetDay.getDate(), cur.getHours(), cur.getMinutes(), 0, 0);

    // EndAt: preserve duration if present
    let newEnd: Date | null = null;
    const end = ev.endAt?.toDate?.();
    if (end) {
      const durMs = end.getTime() - cur.getTime();
      newEnd = new Date(newStart.getTime() + durMs);
    }

    await runTransaction(db, async (tx) => {
      const evRef = doc(db, "events", eventId);
      tx.update(evRef, {
        startAt: Timestamp.fromDate(newStart),
        endAt: newEnd ? Timestamp.fromDate(newEnd) : null,
        updatedAt: serverTimestamp(),
      });

      // Blog sync if linked
      if (ev.linkedBlogPostId) {
        const blogRef = doc(db, "blogPosts", ev.linkedBlogPostId);
        tx.update(blogRef, {
          eventStartAt: Timestamp.fromDate(newStart),
          eventEndAt: newEnd ? Timestamp.fromDate(newEnd) : null,
        });
      }
    });
  }

  return (
    <div style={{ display: "grid", gap: 14, maxWidth: 1500 }}>
      {/* Header */}
      <div className="card" style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
        <div>
          <h1 style={{ margin: 0 }}>Calendar</h1>
        </div>

        {isStaff ? (
          <button
            onClick={() => {
              setCreating(true);
              setEditEventId(null);
            }}
            style={{
              padding: "10px 12px",
              border: "1px solid var(--border)",
              background: "var(--accent)",
              color: "white",
              fontWeight: 900,
              cursor: "pointer",
            }}
          >
            + New Event
          </button>
        ) : null}
      </div>

      {/* Tier 1: Year tabs */}
      <div className="card" style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        <div className="small" style={{ fontWeight: 800, opacity: 0.9 }}>Year</div>
        {yearTabs.map((y) => (
          <button
            key={y}
            onClick={() => setYear(y)}
            style={{
              padding: "8px 10px",
              borderRadius: 2,
              border: "1px solid var(--border)",
              background: y === year ? "var(--accent)" : "transparent",
              color: y === year ? "white" : "var(--text)",
              fontWeight: 900,
              cursor: "pointer",
            }}
          >
            {y}
          </button>
        ))}
        <div style={{ marginLeft: "auto" }} className="small">
          {monthName(month0)} {year}
        </div>
      </div>

      {/* Tier 2: Month tabs */}
      <div className="card" style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        <div className="small" style={{ fontWeight: 800, opacity: 0.9 }}>Month</div>
        {Array.from({ length: 12 }, (_, i) => i).map((m) => (
          <button
            key={m}
            onClick={() => setMonth0(m)}
            style={{
              padding: "8px 10px",
              borderRadius: 2,
              border: "1px solid var(--border)",
              background: m === month0 ? "var(--accent)" : "transparent",
              color: m === month0 ? "white" : "var(--text)",
              fontWeight: 900,
              cursor: "pointer",
            }}
          >
            {monthName(m)}
          </button>
        ))}
      </div>

      {/* Day-of-week header */}
      <div className="card" style={{ padding: 10 }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 10 }}>
          {Array.from({ length: 7 }, (_, i) => (
            <div key={i} className="small" style={{ fontWeight: 900, opacity: 0.85 }}>
              {dayName(i)}
            </div>
          ))}
        </div>

        {/* Grid 6 rows */}
<div
  style={{
    display: "grid",
    gridTemplateColumns: "repeat(7, 1fr)",
    // ✅ Force every week row to be the same fixed height
    gridAutoRows: `${CELL_HEIGHT}px`,
    gap: 10,
    marginTop: 10,
    // Optional: makes it easier to handle overflow in grid children
    alignItems: "stretch",
  }}
>

          {gridDays.map((d, idx) => {
            const inMonth = sameMonth(d, year, month0);
            const key = dateKey(d);
            const dayEvents = eventsByDay.get(key) ?? [];
            const isToday = key === dateKey(today);

            const isDragOver = dragOverKey === key;

            return (
              <div
                key={idx}
                onDragOver={(e) => {
                  if (!isStaff) return;
                  e.preventDefault();
                  setDragOverKey(key);
                }}
                onDragLeave={() => {
                  if (!isStaff) return;
                  setDragOverKey((cur) => (cur === key ? null : cur));
                }}
                onDrop={async (e) => {
                  if (!isStaff) return;
                  e.preventDefault();
                  const payload = dragRef.current;
                  dragRef.current = null;
                  setDragOverKey(null);
                  if (!payload) return;
                  if (payload.fromKey === key) return;
                  await staffMoveEventToDay(payload.eventId, d);
                }}
style={{
  height: "100%",          // ✅ fill the grid row height (CELL_HEIGHT)
  minHeight: 0,            // ✅ critical for scrollable children in CSS grid
  borderRadius: 14,
  border: "1px solid var(--border)",
  background: isDragOver ? "rgba(255,255,255,0.04)" : "transparent",
  opacity: inMonth ? 1 : 0.55,
  padding: 10,
  display: "grid",
  gridTemplateRows: "auto 1fr",
  gap: 8,
  overflow: "hidden",      // ✅ prevents the cell itself from growing
}}

              >
                {/* Day number */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div
                    style={{
                      fontWeight: 900,
                      width: 30,
                      height: 30,
                      borderRadius: 2,
                      display: "grid",
                      placeItems: "center",
                      border: isToday ? "1px solid var(--accent)" : "1px solid transparent",
                      color: isToday ? "var(--accent)" : "var(--text)",
                    }}
                    title={d.toDateString()}
                  >
                    {d.getDate()}
                  </div>
                  {dayEvents.length ? <div className="small">{dayEvents.length}</div> : null}
                </div>

{/* Events in cell (scrollable; cell height does NOT expand) */}
<div
  style={{
    minHeight: 0,          // ✅ critical: allows this region to shrink and scroll
    overflowY: "auto",
    paddingRight: 4,
    display: "grid",
    gap: 8,
    alignContent: "start",
    overscrollBehavior: "contain",
  }}
>

  {dayEvents.map((ev) => (
    <EventBlock
      key={ev.id}
      ev={ev}
      isStaff={isStaff}
      onClick={() => setSelectedEventId(ev.id)}
      onRightClickStaff={() => {
        if (!isStaff) return;
        setCreating(false);
        setEditEventId(ev.id);
      }}
      onDragStart={() => {
        if (!isStaff) return;
        dragRef.current = { eventId: ev.id, fromKey: key };
      }}
    />
  ))}
</div>

              </div>
            );
          })}
        </div>
      </div>

      {/* DETAILS MODAL (anyone) */}
{selectedEventId ? (
  <EventDetailsModal
    eventId={selectedEventId}
    me={me}
    isStaff={isStaff}
    onClose={() => {
      setSelectedEventId(null);
      nav("/calendar", { replace: true });
    }}
  />
) : null}


      {/* EDITOR MODAL (staff only) */}
      {(creating || editEventId) ? (
        <EventEditorModal
          isStaff={isStaff}
          eventId={creating ? null : editEventId}
          onClose={() => {
            setCreating(false);
            setEditEventId(null);
          }}
        />
      ) : null}
    </div>
  );
}

/** =========================
 * Event Block (in calendar cell)
 * ========================= */
function EventBlock({
  ev,
  isStaff,
  onClick,
  onRightClickStaff,
  onDragStart,
}: {
  ev: EventDoc;
  isStaff: boolean;
  onClick: () => void;
  onRightClickStaff: () => void;
  onDragStart: () => void;
}) {
  const timeText = ev.startAt?.toDate?.()
    ? ev.startAt.toDate().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    : "";

  return (
    <div
      draggable={isStaff}
      onDragStart={(e) => {
        if (!isStaff) return;
        e.dataTransfer.effectAllowed = "move";
        onDragStart();
      }}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      onContextMenu={(e) => {
        if (!isStaff) return;
        e.preventDefault();
        e.stopPropagation();
        onRightClickStaff();
      }}
      style={{
        borderRadius: 12,
        border: "1px solid var(--border)",
        cursor: "pointer",
        background: "rgba(255,255,255,0.02)",
        padding: 8,

        display: "grid",
        gridTemplateColumns: ev.imageUrl ? "44px 1fr" : "1fr",
        gap: 10,
        alignItems: "center",
      }}
      title={ev.title}
    >
      {/* Small icon frame (left of title/time) */}
      {ev.imageUrl ? (
        <div
          style={{
            width: 44,
            height: 44,
            borderRadius: 12,
            border: "1px solid var(--border)",
            background: "rgba(0,0,0,0.15)",
            overflow: "hidden",
            display: "grid",
            placeItems: "center",
            flex: "0 0 auto",
          }}
        >
          <img
            src={ev.imageUrl}
            alt=""
            style={{
              width: "100%",
              height: "100%",
              objectFit: "contain", // keep aspect ratio, no crop
              display: "block",
            }}
            onError={(e) => {
              // Hide the icon frame entirely if the URL is bad
              const img = e.currentTarget as HTMLImageElement;
              const frame = img.parentElement as HTMLDivElement | null;
              if (frame) frame.style.display = "none";
            }}
          />
        </div>
      ) : null}

      {/* Text */}
      <div style={{ display: "grid", gap: 4, minWidth: 0 }}>
        <div
          style={{
            fontWeight: 900,
            fontSize: 13,
            lineHeight: 1.1,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {ev.title}
        </div>
        <div className="small" style={{ opacity: 0.9 }}>
          {timeText}
        </div>
      </div>
    </div>
  );
}


/** =========================
 * Event Details Modal (click event)
 * - RSVP toggle
 * - Comments w/ replies
 * - Blog preview if linked
 * ========================= */
function EventDetailsModal({
  eventId,
  me,
  isStaff,
  onClose,
}: {
  eventId: string;
  me: MeDoc | null;
  isStaff: boolean;
  onClose: () => void;
}) {
  const [ev, setEv] = useState<EventDoc | null>(null);
  const [loading, setLoading] = useState(true);

  // RSVP
  const [rsvpOn, setRsvpOn] = useState(false);
  const [rsvpList, setRsvpList] = useState<{ uid: string; alias: string }[]>([]);
  const [rsvpBusy, setRsvpBusy] = useState(false);

  // Blog preview
  const [blog, setBlog] = useState<BlogPick | null>(null);

  // Comments
  const [comments, setComments] = useState<EventComment[]>([]);
const [pickerKind, setPickerKind] = useState<"blog" | "calendar" | "forum" | "guide" | null>(null);
  const currentUid = auth.currentUser?.uid ?? null;

  // Editing state
  const [editingId, setEditingId] = useState<string | null>(null);

  function beginEditComment(c: EventComment) {
    if (!commentEditor) return;

    // Clear reply mode when editing
    setReplyTo(null);

    // Load existing content into the editor
    const existingJson = (c as any).contentJson;
    if (existingJson) {
      commentEditor.commands.setContent(existingJson);
    } else {
      // fallback if older comment only has text
      commentEditor.commands.setContent({
        type: "doc",
        content: [{ type: "paragraph", content: [{ type: "text", text: (c as any).text ?? "" }] }],
      });
    }

    setEditingId(c.id);
  }

  function cancelEdit() {
    if (!commentEditor) return;
    setEditingId(null);
    commentEditor.commands.setContent({ type: "doc", content: [{ type: "paragraph" }] });
  }


const commentEditor = useEditor({
  extensions: [
    StarterKit,
    LinkExt.configure({ openOnClick: true, linkOnPaste: true }),
    Placeholder.configure({ placeholder: "Write a comment…" }),
  ],
  content: { type: "doc", content: [{ type: "paragraph" }] },
  editorProps: {
    attributes: {
      style:
        "outline:none; min-height: 110px; padding: 10px 12px; border: 1px solid var(--border); border-radius: 10px; background: transparent;",
    },
  },
});

  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const unsub = onSnapshot(doc(db, "events", eventId), (snap) => {
      if (!snap.exists()) {
        setEv(null);
        setLoading(false);
        return;
      }
      setEv({ id: snap.id, ...(snap.data() as any) });
      setLoading(false);
    });
    return () => unsub();
  }, [eventId]);

  // Load blog preview if linked
  useEffect(() => {
    (async () => {
      setBlog(null);
      const cur = ev;
      if (!cur?.linkedBlogPostId) return;
      const snap = await getDoc(doc(db, "blogPosts", cur.linkedBlogPostId));
      if (!snap.exists()) return;
      const data: any = snap.data();
      setBlog({
        id: snap.id,
        title: data.title ?? snap.id,
        slug: data.slug ?? "",
        tags: data.tags ?? [],
        createdAt: data.createdAt,
        contentText: data.contentText ?? "",
      });
    })();
  }, [ev?.linkedBlogPostId]); // eslint-disable-line react-hooks/exhaustive-deps

  // RSVP subscribe
  useEffect(() => {
    const u = auth.currentUser;
    if (!u) return;

    const unsubMine = onSnapshot(doc(db, "events", eventId, "rsvps", u.uid), (snap) => {
      setRsvpOn(snap.exists());
    });

    const q = query(collection(db, "events", eventId, "rsvps"), orderBy("createdAt", "asc"));
    const unsubList = onSnapshot(q, (snap) => {
      const rows = snap.docs.map((d) => {
        const data: any = d.data();
        return { uid: d.id, alias: data.aliasSnapshot ?? "Unknown" };
      });
      setRsvpList(rows);
    });

    return () => {
      unsubMine();
      unsubList();
    };
  }, [eventId]);

  // Comments subscribe
  useEffect(() => {
    const q = query(collection(db, "events", eventId, "comments"), orderBy("createdAt", "asc"));
    const unsub = onSnapshot(q, (snap) => {
      setComments(snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })));
    });
    return () => unsub();
  }, [eventId]);

  const topLevel = useMemo(() => comments.filter((c) => !c.parentId), [comments]);
  const repliesByParent = useMemo(() => {
    const m = new Map<string, EventComment[]>();
    for (const c of comments) {
      if (!c.parentId) continue;
      const arr = m.get(c.parentId) ?? [];
      arr.push(c);
      m.set(c.parentId, arr);
    }
    return m;
  }, [comments]);

  function insertLinkIntoCommentEditor(href: string, label: string) {
  if (!commentEditor) return;

  commentEditor
    .chain()
    .focus()
    .insertContent([
      {
        type: "text",
        text: label,
        marks: [{ type: "link", attrs: { href } }],
      },
      { type: "text", text: " " }, // trailing space feels natural
    ])
    .run();
}

  async function toggleRsvp(next: boolean) {
    const u = auth.currentUser;
    if (!u) return;
    if (!me?.alias) {
      window.alert("Please set an Alias in your Profile before RSVPing.");
      return;
    }

    setRsvpBusy(true);
    try {
      if (next) {
        await runTransaction(db, async (tx) => {
          tx.set(doc(db, "events", eventId, "rsvps", u.uid), {
            uid: u.uid,
            aliasSnapshot: me.alias,
            createdAt: serverTimestamp(),
          });
        });
      } else {
        await deleteDoc(doc(db, "events", eventId, "rsvps", u.uid));
      }
    } finally {
      setRsvpBusy(false);
    }
  }

async function postCommentOrSaveEdit() {
  const u = auth.currentUser;
  if (!u) return;

  if (!me?.alias) {
    window.alert("Please set an Alias in your Profile before commenting.");
    return;
  }

  if (!commentEditor) return;

  const plain = commentEditor.getText().trim();
  if (!plain) return;

  const contentJson = commentEditor.getJSON();

  setBusy(true);
  try {
    if (editingId) {
      // ✅ Edit existing comment (only allowed for author in UI)
      await updateDoc(doc(db, "events", eventId, "comments", editingId), {
        contentJson,
        text: plain,
        editedAt: serverTimestamp(),
      });

      // Reset editing mode
      setEditingId(null);
      commentEditor.commands.setContent({ type: "doc", content: [{ type: "paragraph" }] });
      return;
    }

    // ✅ New comment or reply
    await addDoc(collection(db, "events", eventId, "comments"), {
      authorUid: u.uid,
      authorAliasSnapshot: me.alias,
      authorPronounsSnapshot: me.pronouns ?? null,
      authorPhotoSnapshot: me.photoUrl ?? null,

      contentJson,
      text: plain,

      createdAt: serverTimestamp(),
      parentId: replyTo ?? null,
    });

    commentEditor.commands.setContent({ type: "doc", content: [{ type: "paragraph" }] });
    setReplyTo(null);
  } finally {
    setBusy(false);
  }
}

async function deleteCommentWithReplies(commentId: string) {
  const u = auth.currentUser;
  if (!u) return;

  // Find the comment so we can check ownership in UI logic
  const target = comments.find((c) => c.id === commentId);
  if (!target) return;

  const isOwner = target.authorUid === u.uid;
  const canDeleteAny = isStaff; // Admin/Officer/Moderator
  const canDelete = isOwner || canDeleteAny;

  if (!canDelete) return;

  if (!window.confirm("Delete this comment? (Replies will also be removed)")) return;

  // Batch delete: the comment + any direct replies
  const batch = writeBatch(db);

  batch.delete(doc(db, "events", eventId, "comments", commentId));

  // delete direct replies (parentId == commentId)
  const repliesSnap = await getDocs(
    query(collection(db, "events", eventId, "comments"), where("parentId", "==", commentId))
  );

  repliesSnap.forEach((d) => batch.delete(d.ref));

  await batch.commit();

  // If we were editing this comment, cancel editing
  if (editingId === commentId) cancelEdit();
}



  if (loading) return null;

  if (!ev) {
    return (
      <ModalShell onClose={onClose} title="Event not found">
        <div className="small">This event may have been deleted.</div>
      </ModalShell>
    );
  }

  const dt = ev.startAt?.toDate?.() ?? null;

  return (
    <ModalShell onClose={onClose} title="Event">
      <div style={{ display: "grid", gap: 12 }}>
        <div className="card" style={{ padding: 12 }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
            <div style={{ fontWeight: 900, fontSize: 20 }}>{ev.title}</div>
            <div className="small">{dt ? dt.toLocaleString() : ""}</div>
          </div>


          {ev.linkedBlogSlug ? (
            <div className="small" style={{ marginTop: 10 }}>
              Linked blog: <Link to={`/blog/${ev.linkedBlogSlug}`}>{ev.linkedBlogSlug}</Link>
            </div>
          ) : null}
        </div>

        {/* Blog preview (simple, no huge rendering) */}
        {blog && blog.slug ? (
          <div className="card" style={{ padding: 12 }}>
            <div style={{ fontWeight: 900, marginBottom: 6 }}>Blog Preview</div>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
              <div style={{ fontWeight: 900 }}>{blog.title}</div>
              <Link to={`/blog/${blog.slug}`} className="small">Open post</Link>
            </div>
            <div className="small" style={{ marginTop: 6 }}>
              {(blog.tags ?? []).join(" • ")}
            </div>
            {blog.contentText ? (
              <div className="small" style={{ marginTop: 10, opacity: 0.9 }}>
                {blog.contentText.slice(0, 220)}{blog.contentText.length > 220 ? "…" : ""}
              </div>
            ) : null}
          </div>
        ) : null}

        {/* RSVP */}
        <div className="card" style={{ padding: 12 }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
            <div style={{ fontWeight: 900 }}>RSVP</div>
            <label style={{ display: "flex", gap: 10, alignItems: "center" }}>
              <span className="small">{rsvpOn ? "RSVP" : "RSVP"}</span>
              <input
                type="checkbox"
                checked={rsvpOn}
                disabled={rsvpBusy}
                onChange={(e) => void toggleRsvp(e.target.checked)}
              />
            </label>
          </div>

          <div className="small" style={{ marginTop: 10 }}>
            {rsvpList.length ? "Attendees:" : "No RSVPs yet."}
          </div>

          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 8 }}>
            {rsvpList.map((r) => (
              <span
                key={r.uid}
                style={{
                  padding: "6px 10px",
                  borderRadius: 999,
                  border: "1px solid var(--border)",
                  background: "rgba(255,255,255,0.03)",
                  fontSize: 13,
                  fontWeight: 800,
                }}
              >
                {r.alias}
              </span>
            ))}
          </div>
        </div>

        {/* Comments */}
        <div className="card" style={{ padding: 12, display: "grid", gap: 10 }}>
          <div style={{ fontWeight: 900 }}>Comments</div>

<div
  onKeyDown={(e) => {
    if (!commentEditor) return;
    if (e.key !== " " && e.key !== "Enter" && e.key !== "Tab") return;

    const { from } = commentEditor.state.selection;

    const lookback = 32;
    const textBefore = commentEditor.state.doc.textBetween(
      Math.max(0, from - lookback),
      from,
      " "
    );

    const token = (textBefore.split(/\s/).pop() ?? "").trim();

    const openPicker = (kind: "blog" | "calendar" | "forum" | "guide", deleteLen: number) => {
      commentEditor.chain().focus().deleteRange({ from: from - deleteLen, to: from }).run();
      setPickerKind(kind);
    };

    if (token === "/blog") return openPicker("blog", 5);
    if (token === "/calendar") return openPicker("calendar", 9);
    if (token === "/forum") return openPicker("forum", 5);
    if (token === "/guide") return openPicker("guide", 5);
  }}
>
  <EditorContent editor={commentEditor} />
</div>


          {replyTo ? (
            <div className="small">
              Replying…{" "}
              <button onClick={() => setReplyTo(null)}>Cancel reply</button>
            </div>
          ) : null}

{editingId ? (
  <div className="small" style={{ display: "flex", gap: 10, alignItems: "center" }}>
    Editing comment…
    <button onClick={cancelEdit} disabled={busy}>
      Cancel edit
    </button>
  </div>
) : null}

<button
  onClick={() => void postCommentOrSaveEdit()}
  disabled={busy}
  style={{
    padding: "10px 12px",
    borderRadius: 2,
    border: "1px solid var(--border)",
    background: "var(--accent)",
    color: "white",
    fontWeight: 800,
    cursor: "pointer",
    width: 160,
  }}
>
  {busy ? (editingId ? "Saving…" : "Posting…") : (editingId ? "Save" : "Post")}
</button>


          <div style={{ display: "grid", gap: 12, marginTop: 8 }}>
            {topLevel.map((c) => (
              <div key={c.id} style={{ borderTop: "1px solid var(--border)", paddingTop: 10 }}>
<CommentRow
  comment={c}
  onReply={() => setReplyTo(c.id)}
  currentUid={currentUid}
  canDeleteAny={isStaff}
  onEdit={beginEditComment}
  onDelete={(id) => void deleteCommentWithReplies(id)}
/>

                {(repliesByParent.get(c.id) ?? []).map((r) => (
                  <div key={r.id} style={{ marginLeft: 24, marginTop: 10 }}>
<CommentRow
  comment={r}
  onReply={() => setReplyTo(c.id)}
  isReply
  currentUid={currentUid}
  canDeleteAny={isStaff}
  onEdit={beginEditComment}
  onDelete={(id) => void deleteCommentWithReplies(id)}
/>

                  </div>
                ))}
              </div>
            ))}
            {topLevel.length === 0 ? <div className="small">No comments yet.</div> : null}
          </div>
        </div>

        {pickerKind ? (
  <SlashLinkPicker
    kind={pickerKind}
    onClose={() => setPickerKind(null)}
    onPick={(label, href) => {
      if (!commentEditor) return;

      commentEditor
        .chain()
        .focus()
        .insertContent([
          { type: "text", text: label, marks: [{ type: "link", attrs: { href } }] },
          { type: "text", text: " " },
        ])
        .run();

      setPickerKind(null);
    }}
  />
) : null}
      </div>
    </ModalShell>
  );
}

function CommentRow({
  comment,
  onReply,
  isReply,
  currentUid,
  canDeleteAny,
  onEdit,
  onDelete,
}: {
  comment: EventComment;
  onReply: () => void;
  isReply?: boolean;
  currentUid: string | null;
  canDeleteAny: boolean;
  onEdit: (c: EventComment) => void;
  onDelete: (commentId: string) => void;
}) {
  const isOwner = !!currentUid && comment.authorUid === currentUid;

  const canEdit = isOwner; // ✅ everyone (including staff) can only edit their own
  const canDelete = isOwner || canDeleteAny; // ✅ staff can delete any

  return (
    <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
      <div
        style={{
          width: isReply ? 28 : 34,
          height: isReply ? 28 : 34,
          borderRadius: "50%",
          overflow: "hidden",
          border: "1px solid var(--border)",
          background: "#000",
          flex: "0 0 auto",
          marginTop: 2,
        }}
      >
        {comment.authorPhotoSnapshot ? (
          <img
            src={comment.authorPhotoSnapshot}
            alt="avatar"
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
          />
        ) : null}
      </div>

      <div style={{ flex: 1 }}>
        <div style={{ display: "flex", gap: 10, alignItems: "baseline", flexWrap: "wrap" }}>
          <div style={{ fontWeight: 800 }}>{comment.authorAliasSnapshot}</div>
          {comment.authorPronounsSnapshot ? <div className="small">{comment.authorPronounsSnapshot}</div> : null}
          <div className="small" style={{ marginLeft: "auto" }}>
            {comment.createdAt?.toDate?.() ? comment.createdAt.toDate().toLocaleString() : ""}
            {(comment as any).editedAt?.toDate?.() ? " • edited" : ""}
          </div>
        </div>

        <div style={{ marginTop: 6 }}>
          {(comment as any).contentJson ? (
            <BlogRichViewer json={(comment as any).contentJson} />
          ) : (
            <div style={{ whiteSpace: "pre-wrap" }}>{(comment as any).text}</div>
          )}
        </div>

        <div style={{ display: "flex", gap: 10, marginTop: 8, flexWrap: "wrap" }}>
          {!isReply ? (
            <button onClick={onReply}>
              Reply
            </button>
          ) : null}

          {canEdit ? (
            <button onClick={() => onEdit(comment)}>
              Edit
            </button>
          ) : null}

          {canDelete ? (
            <button onClick={() => onDelete(comment.id)}>
              Delete
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}


/** =========================
 * Event Editor Modal (staff-only via right click or +New)
 * - includes blog autocomplete
 * - Save writes once
 * - Delete button
 * ========================= */
function EventEditorModal({
  isStaff,
  eventId,
  onClose,
}: {
  isStaff: boolean;
  eventId: string | null;
  onClose: () => void;
}) {
  const [loading, setLoading] = useState(!!eventId);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  const [title, setTitle] = useState("");
  const [startAt, setStartAt] = useState(toLocalInputValue(new Date()));
  const [endAt, setEndAt] = useState<string>("");
  const [imageUrl, setImageUrl] = useState("");

  const [blogQuery, setBlogQuery] = useState("");
  const [blogPicks, setBlogPicks] = useState<BlogPick[]>([]);
  const [blogOpen, setBlogOpen] = useState(false);
  const [linkedBlogPostId, setLinkedBlogPostId] = useState<string | null>(null);
  const [linkedBlogSlug, setLinkedBlogSlug] = useState<string | null>(null);

  // Load recent posts for dropdown
  useEffect(() => {
    (async () => {
      const q = query(collection(db, "blogPosts"), orderBy("createdAt", "desc"), limit(50));
      const snap = await getDocs(q);
      const rows = snap.docs
        .map((d) => {
          const data: any = d.data();
          return { id: d.id, title: data.title ?? d.id, slug: data.slug ?? "", tags: data.tags ?? [] };
        })
        .filter((p) => !!p.slug);
      setBlogPicks(rows);
    })();
  }, []);

  const filteredBlogPicks = useMemo(() => {
    const s = blogQuery.trim().toLowerCase();
    if (!s) return blogPicks;
    return blogPicks.filter((p) => p.title.toLowerCase().includes(s) || p.slug.toLowerCase().includes(s));
  }, [blogQuery, blogPicks]);

  // Load event
  useEffect(() => {
    if (!eventId) return;

    (async () => {
      setLoading(true);
      setStatus(null);
      try {
        const snap = await getDoc(doc(db, "events", eventId));
        if (!snap.exists()) {
          setStatus("Event not found.");
          return;
        }
        const ev: any = snap.data();
        setTitle(ev.title ?? "");
        if (ev.startAt?.toDate) setStartAt(toLocalInputValue(ev.startAt.toDate()));
        if (ev.endAt?.toDate) setEndAt(toLocalInputValue(ev.endAt.toDate()));
        setImageUrl(ev.imageUrl ?? "");

        setLinkedBlogSlug(ev.linkedBlogSlug ?? null);
        setLinkedBlogPostId(ev.linkedBlogPostId ?? null);
        setBlogQuery(ev.linkedBlogSlug ?? "");
      } catch (e: any) {
        console.error(e);
        setStatus(e?.message ?? String(e));
      } finally {
        setLoading(false);
      }
    })();
  }, [eventId]);

  async function resolveBlogFromFreeText(text: string): Promise<{ postId: string; slug: string } | null> {
    const raw = text.trim();
    if (!raw) return null;
    const cleaned = raw.replace(/^\/blog\//, "").replace(/^blog\//, "");

    // slug
    let snap = await getDocs(query(collection(db, "blogPosts"), where("slug", "==", cleaned), limit(1)));
    if (!snap.empty) {
      const d = snap.docs[0];
      const data: any = d.data();
      return { postId: d.id, slug: data.slug };
    }

    // exact title
    snap = await getDocs(query(collection(db, "blogPosts"), where("title", "==", raw), limit(1)));
    if (!snap.empty) {
      const d = snap.docs[0];
      const data: any = d.data();
      return { postId: d.id, slug: data.slug };
    }

    return null;
  }

  async function save() {
    if (!isStaff) return;

    const t = title.trim();
    if (t.length < 3) {
      setStatus("Title must be at least 3 characters.");
      return;
    }

    const startDate = fromLocalInputValue(startAt);
    const endDate = endAt.trim() ? fromLocalInputValue(endAt) : null;

    setSaving(true);
    setStatus(null);

    try {
      let finalBlogPostId = linkedBlogPostId;
      let finalBlogSlug = linkedBlogSlug;

      if (blogQuery.trim()) {
        const resolved = await resolveBlogFromFreeText(blogQuery);
        if (!resolved) throw new Error("Linked blog not found. Select from the dropdown or type exact Title/Slug.");
        finalBlogPostId = resolved.postId;
        finalBlogSlug = resolved.slug;

        setLinkedBlogPostId(resolved.postId);
        setLinkedBlogSlug(resolved.slug);
        setBlogQuery(resolved.slug);
      } else {
        finalBlogPostId = null;
        finalBlogSlug = null;
        setLinkedBlogPostId(null);
        setLinkedBlogSlug(null);
      }

      await runTransaction(db, async (tx) => {
        let ref;

        if (eventId) {
          ref = doc(db, "events", eventId);
          tx.update(ref, {
            title: t,
            startAt: Timestamp.fromDate(startDate),
            endAt: endDate ? Timestamp.fromDate(endDate) : null,
            imageUrl: imageUrl.trim() ? imageUrl.trim() : null,
            linkedBlogPostId: finalBlogPostId,
            linkedBlogSlug: finalBlogSlug,
            updatedAt: serverTimestamp(),
          });
        } else {
          ref = doc(collection(db, "events"));
          tx.set(ref, {
            title: t,
            startAt: Timestamp.fromDate(startDate),
            endAt: endDate ? Timestamp.fromDate(endDate) : null,
            imageUrl: imageUrl.trim() ? imageUrl.trim() : null,
            linkedBlogPostId: finalBlogPostId,
            linkedBlogSlug: finalBlogSlug,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        }

        if (finalBlogPostId) {
          const blogRef = doc(db, "blogPosts", finalBlogPostId);
          tx.update(blogRef, {
            linkedEventId: ref.id,
            eventStartAt: Timestamp.fromDate(startDate),
            eventEndAt: endDate ? Timestamp.fromDate(endDate) : null,
          });
        }
      });

      onClose();
    } catch (e: any) {
      console.error(e);
      setStatus(e?.message ?? String(e));
    } finally {
      setSaving(false);
    }
  }

  async function deleteEvent() {
    if (!eventId) return;
    if (!isStaff) return;
    if (!window.confirm("Delete this event?")) return;
    await deleteDoc(doc(db, "events", eventId));
    onClose();
  }

  if (!isStaff) return null;
  if (loading) return null;

  return (
    <ModalShell onClose={onClose} title={eventId ? "Edit Event" : "New Event"}>
      {status ? <div className="small">{status}</div> : null}

      <div style={{ display: "grid", gap: 10 }}>
        <label style={{ display: "grid", gap: 6 }}>
          <span className="small">Title</span>
          <input value={title} onChange={(e) => setTitle(e.target.value)} />
        </label>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <label style={{ display: "grid", gap: 6 }}>
            <span className="small">Start</span>
            <input type="datetime-local" value={startAt} onChange={(e) => setStartAt(e.target.value)} />
          </label>
          <label style={{ display: "grid", gap: 6 }}>
            <span className="small">End (optional)</span>
            <input type="datetime-local" value={endAt} onChange={(e) => setEndAt(e.target.value)} />
          </label>
        </div>

        <label style={{ display: "grid", gap: 6 }}>
          <span className="small">Image URL (optional)</span>
          <input value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} placeholder="https://…" />
        </label>

        {/* Blog link autocomplete */}
        <div style={{ display: "grid", gap: 6, position: "relative" }}>
          <span className="small">Linked Blog Post (optional)</span>
          <input
            value={blogQuery}
            onChange={(e) => {
              setBlogQuery(e.target.value);
              setBlogOpen(true);
              setLinkedBlogPostId(null);
              setLinkedBlogSlug(null);
            }}
            onFocus={() => setBlogOpen(true)}
            placeholder='Type title or slug…'
          />

          {blogOpen ? (
            <div
              style={{
                position: "absolute",
                top: 58,
                left: 0,
                right: 0,
                background: "var(--card, #111)",
                border: "1px solid var(--border)",
                borderRadius: 12,
                overflow: "hidden",
                zIndex: 60,
                maxHeight: 260,
                overflowY: "auto",
              }}
            >
              {filteredBlogPicks.slice(0, 20).map((p) => (
                <button
                  key={p.id}
                  onClick={() => {
                    setBlogQuery(p.title);
                    setLinkedBlogPostId(p.id);
                    setLinkedBlogSlug(p.slug);
                    setBlogOpen(false);
                    setStatus(null);
                  }}
                  style={{
                    width: "100%",
                    textAlign: "left",
                    padding: "10px 12px",
                    background: "transparent",
                    color: "var(--text)",
                    border: "none",
                    cursor: "pointer",
                    borderBottom: "1px solid var(--border)",
                  }}
                >
                  <div style={{ fontWeight: 800 }}>{p.title}</div>
                  <div className="small">/blog/{p.slug}</div>
                </button>
              ))}
              {filteredBlogPicks.length === 0 ? <div className="small" style={{ padding: 10 }}>No matches.</div> : null}
            </div>
          ) : null}

          {linkedBlogSlug ? (
            <div className="small">
              Selected: /blog/{linkedBlogSlug}{" "}
              <button
                style={{ marginLeft: 10 }}
                onClick={() => {
                  setBlogQuery("");
                  setLinkedBlogPostId(null);
                  setLinkedBlogSlug(null);
                  setBlogOpen(false);
                }}
              >
                Clear
              </button>
            </div>
          ) : null}
        </div>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
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

          {eventId ? (
            <button onClick={() => void deleteEvent()} style={{ padding: "10px 12px", borderRadius: 2 }}>
              Delete
            </button>
          ) : null}
        </div>
      </div>

      {blogOpen ? (
        <div onMouseDown={() => setBlogOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 59 }} />
      ) : null}
    </ModalShell>
  );
}

/** =========================
 * Generic Modal Shell
 * ========================= */
function ModalShell({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.55)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 70,
        padding: 14,
      }}
      onMouseDown={onClose}
    >
      <div
        className="card"
        style={{ width: 900, maxWidth: "95vw", maxHeight: "90vh", overflow: "auto", padding: 12 }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center" }}>
          <div style={{ fontWeight: 900 }}>{title}</div>
          <button onClick={onClose}>Close</button>
        </div>

        <div style={{ marginTop: 12 }}>{children}</div>
      </div>
    </div>
  );
}
