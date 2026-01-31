import { useEffect, useMemo, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import {
  collection,
  doc,
  limit,
  onSnapshot,
  orderBy,
  query,
  where,
  addDoc,
  serverTimestamp,
  getDocs,
  runTransaction,
  deleteDoc,
  updateDoc,
  writeBatch,
} from "firebase/firestore";
import { auth, db } from "../firebase";
import type { BlogComment, BlogPost } from "../types/blog";
import { BlogRichViewer } from "../blog/BlogRichViewer";
import { SlashLinkPicker } from "../blog/SlashLinkPicker";

import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import LinkExt from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";

type MeDoc = {
  alias: string | null;
  pronouns: string | null;
  photoUrl: string | null;
  roles: string[];
};

type BlogCommentX = BlogComment & {
  contentJson?: any;
  text?: string;
  parentId?: string | null;
};

const EMPTY_DOC = { type: "doc", content: [{ type: "paragraph" }] };

export function BlogPostPage() {
  const nav = useNavigate();
  const navigate = useNavigate();
  const { slug } = useParams();

  const [post, setPost] = useState<BlogPost | null>(null);
  const [postId, setPostId] = useState<string | null>(null);

  const [me, setMe] = useState<MeDoc | null>(null);

  const [comments, setComments] = useState<BlogCommentX[]>([]);
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const currentUid = auth.currentUser?.uid ?? null;

  const [editingId, setEditingId] = useState<string | null>(null);

  function beginEditComment(c: BlogCommentX) {
    if (!commentEditor) return;

    setReplyTo(null);

    const existingJson = c.contentJson;
    if (existingJson) {
      commentEditor.commands.setContent(existingJson);
    } else {
      commentEditor.commands.setContent({
        type: "doc",
        content: [{ type: "paragraph", content: [{ type: "text", text: c.text ?? "" }] }],
      });
    }

    setEditingId(c.id);
  }

  function cancelEdit() {
    if (!commentEditor) return;
    setEditingId(null);
    commentEditor.commands.setContent(EMPTY_DOC);
  }


  const [pickerKind, setPickerKind] = useState<
    "blog" | "calendar" | "forum" | "guide" | null
  >(null);

  const commentEditor = useEditor({
    extensions: [
      StarterKit,
      LinkExt.configure({
        openOnClick: true,
        autolink: false,
        linkOnPaste: true,
      }),
      Placeholder.configure({
        placeholder: "Write a comment…",
      }),
    ],
    content: EMPTY_DOC,
    editorProps: {
      attributes: {
        style:
          "outline:none; min-height: 110px; padding: 10px 12px; border: 1px solid var(--border); border-radius: 10px; background: transparent;",
      },
    },
  });

  useEffect(() => {
    const u = auth.currentUser;
    if (!u) return;

    const unsub = onSnapshot(doc(db, "users", u.uid), (snap) => {
      const data = snap.data() as any;
      setMe({
        alias: data?.alias ?? null,
        pronouns: data?.pronouns ?? null,
        photoUrl: data?.photoUrl ?? null,
        roles: Array.isArray(data?.roles) ? data.roles : [],
      });
    });

    return () => unsub();
  }, []);

  const isStaff =
    (me?.roles ?? []).includes("Admin") ||
    (me?.roles ?? []).includes("Moderator") ||
    (me?.roles ?? []).includes("Officer");

  // Post editing/deleting stays Admin/Moderator (keep your existing intent)
  const canEditPost =
    (me?.roles ?? []).includes("Admin") || (me?.roles ?? []).includes("Moderator");


  useEffect(() => {
    (async () => {
      if (!slug) return;

      const q = query(
        collection(db, "blogPosts"),
        where("slug", "==", slug),
        limit(1)
      );

      const snap = await getDocs(q);

      if (snap.empty) {
        setPost(null);
        setPostId(null);
        return;
      }

      const d = snap.docs[0];
      setPostId(d.id);
      setPost({ id: d.id, ...(d.data() as any) });
    })();
  }, [slug]);

  useEffect(() => {
    if (!postId) return;

    const q = query(
      collection(db, "blogPosts", postId, "comments"),
      orderBy("createdAt", "asc")
    );

    const unsub = onSnapshot(q, (snap) => {
      const rows: BlogCommentX[] = snap.docs.map((d) => ({
        id: d.id,
        ...(d.data() as any),
      }));
      setComments(rows);
    });

    return () => unsub();
  }, [postId]);

  const topLevel = useMemo(
    () => comments.filter((c) => !c.parentId),
    [comments]
  );

  const repliesByParent = useMemo(() => {
    const map = new Map<string, BlogCommentX[]>();
    for (const c of comments) {
      if (!c.parentId) continue;
      const arr = map.get(c.parentId) ?? [];
      arr.push(c);
      map.set(c.parentId, arr);
    }
    return map;
  }, [comments]);

async function postCommentOrSaveEdit() {
  if (!postId) return;

  const u = auth.currentUser;
  if (!u) return;

  if (!me?.alias) {
    window.alert("Please set an Alias in your Profile before commenting.");
    return;
  }

  const json = commentEditor?.getJSON() ?? EMPTY_DOC;
  const text = commentEditor?.getText()?.trim() ?? "";
  if (!text) return;

  setBusy(true);
  try {
    if (editingId) {
      // ✅ Edit existing comment (only allowed for author in UI)
      await updateDoc(doc(db, "blogPosts", postId, "comments", editingId), {
        contentJson: json,
        text,
        editedAt: serverTimestamp(),
      });

      setEditingId(null);
      commentEditor?.commands.setContent(EMPTY_DOC);
      return;
    }

    await addDoc(collection(db, "blogPosts", postId, "comments"), {
      authorUid: u.uid,
      authorAliasSnapshot: me.alias,
      authorPronounsSnapshot: me.pronouns ?? null,
      authorPhotoSnapshot: me.photoUrl ?? null,

      contentJson: json,
      text,

      createdAt: serverTimestamp(),
      parentId: replyTo ?? null,
    });

    commentEditor?.commands.setContent(EMPTY_DOC);
    setReplyTo(null);
  } finally {
    setBusy(false);
  }
}

async function deleteCommentWithReplies(commentId: string) {
  if (!postId) return;

  const u = auth.currentUser;
  if (!u) return;

  const target = comments.find((c) => c.id === commentId);
  if (!target) return;

  const isOwner = target.authorUid === u.uid;
  const canDeleteAny = isStaff; // Admin/Moderator/Officer
  const canDelete = isOwner || canDeleteAny;
  if (!canDelete) return;

  if (!window.confirm("Delete this comment? (Replies will also be removed)")) return;

  const batch = writeBatch(db);

  batch.delete(doc(db, "blogPosts", postId, "comments", commentId));

  const repliesSnap = await getDocs(
    query(collection(db, "blogPosts", postId, "comments"), where("parentId", "==", commentId))
  );

  repliesSnap.forEach((d) => batch.delete(d.ref));

  await batch.commit();

  if (editingId === commentId) cancelEdit();
}


  async function deletePost() {
    if (!postId || !post) return;
    if (!window.confirm("Delete this post? This cannot be undone.")) return;

    await runTransaction(db, async (tx) => {
      tx.delete(doc(db, "blogPosts", postId));
      tx.delete(doc(db, "blogSlugIndex", post.slug));
    });

    nav("/blog", { replace: true });
  }

  if (!post) {
    return (
      <div className="card">
        <div style={{ fontWeight: 900 }}>Post not found.</div>
        <div className="small" style={{ marginTop: 8 }}>
          <Link to="/blog">Back to blog</Link>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: "grid", gap: 14, maxWidth: 980 }}>
      <div className="card">
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: 12,
            flexWrap: "wrap",
            alignItems: "center",
          }}
        >
<div>
  <button
    onClick={() => navigate("/blog")}
  >
    ← Back
  </button>
</div>


{canEditPost ? (

            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => nav(`/blog/edit/${postId}`)}>Edit</button>
              <button onClick={() => void deletePost()}>Delete</button>
            </div>
          ) : null}
        </div>

        <h1 style={{ marginBottom: 6 }}>{post.title}</h1>

        <div className="small">
          {(post.tags ?? []).join(" • ")}{" "}
          {post.createdAt?.toDate?.()
            ? `• ${post.createdAt.toDate().toLocaleString()}`
            : ""}
        </div>

        <div style={{ marginTop: 14 }}>
          {(post as any).contentJson ? (
            <BlogRichViewer json={(post as any).contentJson} />
          ) : (
            <div style={{ whiteSpace: "pre-wrap", lineHeight: 1.5 }}>
              {post.contentText}
            </div>
          )}
        </div>
      </div>

      <div className="card" style={{ display: "grid", gap: 10 }}>
        <h2 style={{ margin: 0 }}>Comments</h2>

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

            const openPicker = (
              kind: "blog" | "calendar" | "forum" | "guide",
              deleteLen: number
            ) => {
              commentEditor
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
          <EditorContent editor={commentEditor} />
        </div>

        {replyTo ? (
          <div className="small">
            Replying <button onClick={() => setReplyTo(null)}>Cancel reply</button>
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


        <div style={{ display: "grid", gap: 12, marginTop: 10 }}>
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

function CommentRow({
  comment,
  onReply,
  isReply,
  currentUid,
  canDeleteAny,
  onEdit,
  onDelete,
}: {
  comment: BlogCommentX;
  onReply: () => void;
  isReply?: boolean;
  currentUid: string | null;
  canDeleteAny: boolean;
  onEdit: (c: BlogCommentX) => void;
  onDelete: (commentId: string) => void;
}) {
  const isOwner = !!currentUid && comment.authorUid === currentUid;

  const canEdit = isOwner; // ✅ edit only your own
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
          {comment.authorPronounsSnapshot ? (
            <div className="small">{comment.authorPronounsSnapshot}</div>
          ) : null}
          <div className="small" style={{ marginLeft: "auto" }}>
            {comment.createdAt?.toDate?.() ? comment.createdAt.toDate().toLocaleString() : ""}
            {(comment as any).editedAt?.toDate?.() ? " • edited" : ""}
          </div>
        </div>

        <div style={{ marginTop: 6 }}>
          {comment.contentJson ? (
            <BlogRichViewer json={comment.contentJson} />
          ) : (
            <div style={{ whiteSpace: "pre-wrap" }}>{comment.text}</div>
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

