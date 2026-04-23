"use client";

import { forwardRef } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import { Markdown } from "tiptap-markdown";
import { useEffect } from "react";

type EditorPaneProps = {
  markdown: string;
  onChange: (markdown: string) => void;
  onFocusChange?: (focused: boolean) => void;
};

export const EditorPane = forwardRef<HTMLDivElement, EditorPaneProps>(
  function EditorPane({ markdown, onChange, onFocusChange }, ref) {
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
        <EditorContent editor={editor} />
      </div>
    );
  },
);
