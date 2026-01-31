import { useEffect } from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import type { Editor } from "@tiptap/core";

import { HeadingCardNode } from "./nodes/HeadingCardNode";
import { ButtonNode } from "./nodes/ButtonNode";
import { ImageUrlNode } from "./nodes/ImageUrlNode";

type Props = {
  initialJson: any;
  onEditorReady?: (editor: Editor) => void;
};

const EMPTY_DOC = { type: "doc", content: [{ type: "paragraph" }] };

export function BlogRichEditor({ initialJson, onEditorReady }: Props) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        bulletList: { keepMarks: true, keepAttributes: false },
        orderedList: { keepMarks: true, keepAttributes: false },
      }),

      // ✅ Custom nodes MUST be separate extensions (NOT inside StarterKit.configure)
      HeadingCardNode,
      ButtonNode,
      ImageUrlNode,

      Link.configure({
        openOnClick: true,
        autolink: false,
        linkOnPaste: true,
      }),

      Placeholder.configure({
        placeholder: "Write your post…",
      }),
    ],
    content: initialJson ?? EMPTY_DOC,
    editorProps: {
      attributes: {
        style:
          "outline:none; min-height: 320px; padding: 12px; border: 1px solid var(--border); border-radius: 12px; background: transparent;",
      },
    },
  });

  useEffect(() => {
    if (editor && onEditorReady) onEditorReady(editor);
  }, [editor, onEditorReady]);

  if (!editor) return <div className="small">Loading editor…</div>;

  return (
    <div>
      <Toolbar editor={editor} />
      <div style={{ marginTop: 10 }}>
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}

function Toolbar({ editor }: { editor: Editor }) {
  const btn = (active: boolean) => ({
    padding: "8px 10px",
    borderRadius: 2,
    border: "1px solid var(--border)",
    background: active ? "rgba(124,58,237,0.25)" : "transparent",
    color: "var(--text)",
    cursor: "pointer",
    fontWeight: 700 as const,
  });

  return (
    <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
      <button style={btn(editor.isActive("bold"))} onClick={() => editor.chain().focus().toggleBold().run()}>
        Bold
      </button>

      <button style={btn(editor.isActive("italic"))} onClick={() => editor.chain().focus().toggleItalic().run()}>
        Italic
      </button>

      <button
        style={btn(editor.isActive("heading", { level: 2 }))}
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
      >
        H2
      </button>

      <button style={btn(editor.isActive("bulletList"))} onClick={() => editor.chain().focus().toggleBulletList().run()}>
        Bullets
      </button>

      <button style={btn(editor.isActive("orderedList"))} onClick={() => editor.chain().focus().toggleOrderedList().run()}>
        Numbered
      </button>

      <button
        style={btn(!!editor.getAttributes("link")?.href)}
        onClick={() => {
          const url = window.prompt("Link URL:");
          if (!url) return;
          editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
        }}
      >
        Link
      </button>

      <button style={btn(false)} onClick={() => editor.chain().focus().unsetLink().run()}>
        Unlink
      </button>

      {/* ✅ Custom block insert buttons belong in the toolbar */}
      <button
        style={btn(false)}
        onClick={() => {
          const title = window.prompt("Heading card title:", "Heading");
          if (!title) return;
          editor.chain().focus().insertContent({ type: "headingCard", attrs: { title } }).run();
        }}
      >
        Heading Card
      </button>

      <button
        style={btn(false)}
        onClick={() => {
          const label = window.prompt("Button label:", "RSVP Here");
          if (!label) return;
          const href = window.prompt("Button link URL:", "https://");
          if (!href) return;
          editor.chain().focus().insertContent({ type: "buttonBlock", attrs: { label, href } }).run();
        }}
      >
        Button
      </button>

      <button
        style={btn(false)}
        onClick={() => {
          const src = window.prompt("Image/GIF URL:", "https://");
          if (!src) return;
          editor.chain().focus().insertContent({ type: "imageUrl", attrs: { src, alt: "" } }).run();
        }}
      >
        Image URL
      </button>
    </div>
  );
}
