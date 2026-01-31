import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import { HeadingCardNode } from "./nodes/HeadingCardNode";
import { ButtonNode } from "./nodes/ButtonNode";
import { ImageUrlNode } from "./nodes/ImageUrlNode";

export function BlogRichViewer({ json }: { json: any }) {
  const editor = useEditor({
    editable: false,
    extensions: [StarterKit, Link, HeadingCardNode, ButtonNode, ImageUrlNode],
    content: json ?? { type: "doc", content: [{ type: "paragraph" }] },
  });

  if (!editor) return null;
  return <EditorContent editor={editor} />;
}
