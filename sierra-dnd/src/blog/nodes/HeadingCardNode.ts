import { Node, mergeAttributes } from "@tiptap/core";

export const HeadingCardNode = Node.create({
  name: "headingCard",
  group: "block",
  atom: true,

  addAttributes() {
    return {
      title: { default: "Heading" },
    };
  },

  parseHTML() {
    return [{ tag: "div[data-heading-card]" }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "div",
      mergeAttributes(HTMLAttributes, {
        "data-heading-card": "true",
        style:
          "border:1px solid var(--border); border-radius:2px; padding:14px; background: #17171b; font-weight:900;",
      }),
      ["span", {}, HTMLAttributes.title],
    ];
  },
});
