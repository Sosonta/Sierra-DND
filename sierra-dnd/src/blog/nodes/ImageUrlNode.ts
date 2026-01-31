import { Node, mergeAttributes } from "@tiptap/core";
import { ReactNodeViewRenderer } from "@tiptap/react";
import { ImageUrlNodeView } from "./ImageUrlNodeView";

export const ImageUrlNode = Node.create({
  name: "imageUrl",
  group: "block",
  atom: true,

  addAttributes() {
    return {
      src: { default: "" },
      alt: { default: "" },

      // store width in px (easy + predictable)
      width: { default: 600 },
    };
  },

  parseHTML() {
    return [
      {
        tag: "img[data-image-url]",
        getAttrs: (el) => {
          const img = el as HTMLImageElement;
          const wAttr = img.getAttribute("data-width");
          const width = wAttr ? Number(wAttr) : undefined;

          return {
            src: img.getAttribute("src") ?? "",
            alt: img.getAttribute("alt") ?? "",
            width: Number.isFinite(width) ? width : 600,
          };
        },
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    // When rendering static HTML (e.g. blog post viewer), we still apply width + keep ratio.
    const w = Number(HTMLAttributes.width) || 600;

    return [
      "div",
      { style: "margin: 10px 0;" },
      [
        "img",
        mergeAttributes(HTMLAttributes, {
          "data-image-url": "true",
          "data-width": String(w),
          src: HTMLAttributes.src,
          alt: HTMLAttributes.alt || "",
          style:
            `display:block; width:${w}px; max-width:100%; height:auto;` +
            ` border-radius:14px; border:1px solid var(--border);`,
        }),
      ],
    ];
  },

  // ✅ interactive resizing lives here
  addNodeView() {
    return ReactNodeViewRenderer(ImageUrlNodeView);
  },
});
