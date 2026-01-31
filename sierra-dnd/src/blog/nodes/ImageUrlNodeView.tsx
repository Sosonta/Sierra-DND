import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { NodeViewWrapper, type NodeViewProps } from "@tiptap/react";

const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));

export function ImageUrlNodeView(props: NodeViewProps) {
  const { node, editor, selected, updateAttributes } = props;

  const src = node.attrs.src as string;
  const alt = (node.attrs.alt as string) || "";
  const width = Number(node.attrs.width) || 600;

  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const [maxWidth, setMaxWidth] = useState<number>(1200);

  // Track container width so we can clamp resize to editor column
  useEffect(() => {
    const el = wrapperRef.current?.parentElement; // NodeViewWrapper parent inside editor
    if (!el) return;

    const ro = new ResizeObserver(() => {
      // A little padding so we don’t overflow borders
      setMaxWidth(Math.max(240, Math.floor(el.clientWidth)));
    });

    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const onMouseDownHandle = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();

      // Ensure node becomes selected/focused
      editor.commands.focus();

      const startX = e.clientX;
      const startWidth = width;

      const onMove = (ev: MouseEvent) => {
        const dx = ev.clientX - startX;
        const next = clamp(startWidth + dx, 120, maxWidth);
        updateAttributes({ width: next });
      };

      const onUp = () => {
        window.removeEventListener("mousemove", onMove);
        window.removeEventListener("mouseup", onUp);
      };

      window.addEventListener("mousemove", onMove);
      window.addEventListener("mouseup", onUp);
    },
    [editor, maxWidth, updateAttributes, width]
  );

  const border = selected ? "2px solid rgba(124,58,237,0.75)" : "1px solid var(--border)";

  return (
    <NodeViewWrapper
      ref={wrapperRef}
      data-image-wrapper="true"
      style={{
        margin: "10px 0",
        position: "relative",
        width: `${clamp(width, 120, maxWidth)}px`,
        maxWidth: "100%",
      }}
    >
      <img
        src={src}
        alt={alt}
        draggable={false}
        style={{
          display: "block",
          width: "100%",
          height: "auto", // ✅ keeps aspect ratio
          borderRadius: 14,
          border,
          userSelect: "none",
        }}
      />

      {/* Resize handle */}
      <div
        onMouseDown={onMouseDownHandle}
        title="Drag to resize"
        style={{
          position: "absolute",
          right: 6,
          bottom: 6,
          width: 14,
          height: 14,
          borderRadius: 2,
          border: "1px solid var(--border)",
          background: "rgba(0,0,0,0.35)",
          cursor: "nwse-resize",
        }}
      />
    </NodeViewWrapper>
  );
}
