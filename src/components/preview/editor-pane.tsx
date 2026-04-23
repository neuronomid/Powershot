"use client";

import { forwardRef, useEffect, useMemo } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import { Markdown } from "tiptap-markdown";

import type { ExportTheme } from "@/lib/theme/types";
import {
  BASE_SIZE_PT,
  LINE_SPACING_VAL,
  FONT_CSS,
  FONT_GOOGLE_URL,
  PRESET_COLORS,
} from "@/lib/theme/types";

type EditorPaneProps = {
  markdown: string;
  onChange: (markdown: string) => void;
  onFocusChange?: (focused: boolean) => void;
  theme?: ExportTheme;
};

function useEditorTheme(theme?: ExportTheme) {
  const css = useMemo(() => {
    if (!theme) return "";
    const colors = PRESET_COLORS[theme.preset];
    const basePt = BASE_SIZE_PT[theme.baseSize];
    const lineHeight = LINE_SPACING_VAL[theme.lineSpacing];
    const bodyFont = FONT_CSS[theme.bodyFont];
    const headingFont = FONT_CSS[theme.headingFont];

    return `
      .editor-content {
        font-family: ${bodyFont};
        font-size: ${basePt}pt;
        line-height: ${lineHeight};
        color: ${colors.foreground};
        background: ${colors.background};
      }
      .editor-content :is(h1, h2, h3, h4, h5, h6) {
        font-family: ${headingFont};
        color: ${colors.foreground};
      }
      .editor-content a {
        color: ${colors.accent};
      }
      .editor-content blockquote {
        border-left-color: ${colors.accent};
        color: ${colors.foreground};
        opacity: 0.85;
      }
      .editor-content pre,
      .editor-content code {
        background: ${colors.muted};
      }
      .editor-content th,
      .editor-content td {
        border-color: ${colors.foreground}20;
      }
      .editor-content th {
        background: ${colors.muted};
      }
    `;
  }, [theme]);

  useEffect(() => {
    if (!theme) return;
    const urls = [
      FONT_GOOGLE_URL[theme.bodyFont],
      FONT_GOOGLE_URL[theme.headingFont],
    ]
      .filter((u): u is string => Boolean(u))
      .filter((v, i, a) => a.indexOf(v) === i);

    const links: HTMLLinkElement[] = [];
    for (const url of urls) {
      if (document.querySelector(`link[href="${url}"]`)) continue;
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = url;
      document.head.appendChild(link);
      links.push(link);
    }
    return () => {
      for (const link of links) {
        if (link.parentNode) link.parentNode.removeChild(link);
      }
    };
  }, [theme]);

  return css;
}

export const EditorPane = forwardRef<HTMLDivElement, EditorPaneProps>(
  function EditorPane({ markdown, onChange, onFocusChange, theme }, ref) {
    const themeCss = useEditorTheme(theme);

    const editor = useEditor({
      immediatelyRender: false,
      extensions: [
        StarterKit,
        Link.configure({ openOnClick: false }),
        Markdown.configure({
          html: false,
          tightLists: true,
          bulletListMarker: "-",
          transformPastedText: true,
        }),
      ],
      content: markdown,
      editorProps: {
        attributes: {
          class:
            "editor-content max-w-none p-6 focus:outline-none min-h-full text-foreground",
        },
      },
      onUpdate: ({ editor }) => {
        const storage = editor.storage as unknown as {
          markdown: { getMarkdown: () => string };
        };
        const md = storage.markdown.getMarkdown();
        onChange(md);
      },
      onFocus: () => onFocusChange?.(true),
      onBlur: () => onFocusChange?.(false),
    });

    useEffect(() => {
      if (editor && !editor.isDestroyed) {
        const storage = editor.storage as unknown as {
          markdown: { getMarkdown: () => string };
        };
        const current = storage.markdown.getMarkdown();
        if (current !== markdown) {
          editor.commands.setContent(markdown);
        }
      }
    }, [markdown, editor]);

    if (!editor) {
      return (
        <div
          ref={ref}
          className="flex-1 overflow-y-auto rounded-xl border border-border bg-muted/20"
        >
          <div className="space-y-4 p-6">
            <div className="h-8 w-3/4 rounded-lg bg-muted animate-pulse" />
            <div className="space-y-2">
              <div className="h-4 w-full rounded bg-muted animate-pulse" />
              <div className="h-4 w-5/6 rounded bg-muted animate-pulse" />
              <div className="h-4 w-4/6 rounded bg-muted animate-pulse" />
            </div>
            <div className="h-6 w-1/2 rounded-lg bg-muted animate-pulse" />
            <div className="space-y-2">
              <div className="h-4 w-full rounded bg-muted animate-pulse" />
              <div className="h-4 w-3/4 rounded bg-muted animate-pulse" />
            </div>
          </div>
        </div>
      );
    }

    return (
      <div
        ref={ref}
        className="flex-1 overflow-y-auto rounded-xl border border-border bg-background"
      >
        {themeCss && <style>{themeCss}</style>}
        <EditorContent editor={editor} />
      </div>
    );
  },
);
