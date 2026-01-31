import { Node, mergeAttributes } from "@tiptap/core";

export const ButtonNode = Node.create({
  name: "buttonBlock",
  group: "block",
  atom: true,

  addAttributes() {
    return {
      label: { default: "Button" },
      href: { default: "" },
    };
  },

  parseHTML() {
    return [{ tag: "a[data-button-block]" }];
  },

  renderHTML({ HTMLAttributes }) {
    const href = HTMLAttributes.href || "#";
    const label = HTMLAttributes.label || "Button";

    return [
      "a",
      mergeAttributes(HTMLAttributes, {
        "data-button-block": "true",
        href,
        target: "_blank",
        rel: "noopener noreferrer",
        style:
          "display:inline-block; padding:10px 12px; border-radius:2px; border:1px solid var(--border); background: var(--accent); color:white; font-weight:900; text-decoration:none;",
      }),
      label,
    ];
  },
});
