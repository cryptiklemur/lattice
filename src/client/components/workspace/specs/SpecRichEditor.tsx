import { useEffect, useRef } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import Placeholder from "@tiptap/extension-placeholder";
import {
  Bold, Italic, Strikethrough,
  Heading1, Heading2,
  List, ListOrdered, ListChecks,
  Code2, Link as LinkIcon,
} from "lucide-react";

interface SpecRichEditorProps {
  content: string;
  onChange: (content: string) => void;
  placeholder?: string;
  disabled?: boolean;
}

function tryParseJson(str: string): Record<string, unknown> | null {
  if (!str) return null;
  try {
    const parsed = JSON.parse(str);
    if (typeof parsed === "object" && parsed !== null) return parsed as Record<string, unknown>;
  } catch {
    // not JSON
  }
  return null;
}

function ToolbarButton({ active, onClick, disabled, label, children }: {
  active?: boolean;
  onClick: () => void;
  disabled?: boolean;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      aria-pressed={active}
      className={
        "p-1 rounded transition-colors " +
        (active
          ? "bg-primary/20 text-primary"
          : "text-base-content/40 hover:text-base-content/70 hover:bg-base-content/5") +
        (disabled ? " opacity-30 cursor-not-allowed" : "")
      }
    >
      {children}
    </button>
  );
}

export function SpecRichEditor({ content, onChange, placeholder, disabled }: SpecRichEditorProps) {
  const contentRef = useRef(content);
  contentRef.current = content;

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2] },
        link: false,
      }),
      Link.configure({ openOnClick: true }),
      TaskList,
      TaskItem.configure({ nested: true }),
      Placeholder.configure({ placeholder: placeholder ?? "Write something..." }),
    ],
    editable: !disabled,
    content: tryParseJson(content) ?? (content || ""),
    onUpdate: function ({ editor }) {
      const json = JSON.stringify(editor.getJSON());
      onChange(json);
    },
  });

  useEffect(function () {
    if (!editor) return;
    editor.setEditable(!disabled);
  }, [editor, disabled]);

  useEffect(function () {
    if (!editor || editor.isFocused) return;
    const parsed = tryParseJson(content);
    const currentJson = JSON.stringify(editor.getJSON());
    if (parsed && JSON.stringify(parsed) !== currentJson) {
      editor.commands.setContent(parsed, { emitUpdate: false });
    } else if (!parsed && content !== currentJson) {
      editor.commands.setContent(content || "", { emitUpdate: false });
    }
  }, [content, editor]);

  if (!editor) return null;

  function handleLinkInsert() {
    if (!editor) return;
    const url = window.prompt("Enter a URL (e.g. https://example.com):");
    if (url) {
      editor.chain().focus().setLink({ href: url }).run();
    }
  }

  return (
    <div className="flex flex-col gap-0 border border-base-content/10 rounded-lg overflow-hidden bg-base-100">
      <div className="flex items-center gap-0.5 px-2 py-1.5 border-b border-base-content/10 bg-base-200/50 flex-wrap">
        <ToolbarButton active={editor.isActive("bold")} onClick={function () { editor!.chain().focus().toggleBold().run(); }} disabled={disabled} label="Bold">
          <Bold size={14} />
        </ToolbarButton>
        <ToolbarButton active={editor.isActive("italic")} onClick={function () { editor!.chain().focus().toggleItalic().run(); }} disabled={disabled} label="Italic">
          <Italic size={14} />
        </ToolbarButton>
        <ToolbarButton active={editor.isActive("strike")} onClick={function () { editor!.chain().focus().toggleStrike().run(); }} disabled={disabled} label="Strikethrough">
          <Strikethrough size={14} />
        </ToolbarButton>
        <div className="w-px h-4 bg-base-content/10 mx-1" />
        <ToolbarButton active={editor.isActive("heading", { level: 1 })} onClick={function () { editor!.chain().focus().toggleHeading({ level: 1 }).run(); }} disabled={disabled} label="Heading 1">
          <Heading1 size={14} />
        </ToolbarButton>
        <ToolbarButton active={editor.isActive("heading", { level: 2 })} onClick={function () { editor!.chain().focus().toggleHeading({ level: 2 }).run(); }} disabled={disabled} label="Heading 2">
          <Heading2 size={14} />
        </ToolbarButton>
        <div className="w-px h-4 bg-base-content/10 mx-1" />
        <ToolbarButton active={editor.isActive("bulletList")} onClick={function () { editor!.chain().focus().toggleBulletList().run(); }} disabled={disabled} label="Bullet List">
          <List size={14} />
        </ToolbarButton>
        <ToolbarButton active={editor.isActive("orderedList")} onClick={function () { editor!.chain().focus().toggleOrderedList().run(); }} disabled={disabled} label="Numbered List">
          <ListOrdered size={14} />
        </ToolbarButton>
        <ToolbarButton active={editor.isActive("taskList")} onClick={function () { editor!.chain().focus().toggleTaskList().run(); }} disabled={disabled} label="Task List">
          <ListChecks size={14} />
        </ToolbarButton>
        <div className="w-px h-4 bg-base-content/10 mx-1" />
        <ToolbarButton active={editor.isActive("codeBlock")} onClick={function () { editor!.chain().focus().toggleCodeBlock().run(); }} disabled={disabled} label="Code Block">
          <Code2 size={14} />
        </ToolbarButton>
        <ToolbarButton active={editor.isActive("link")} onClick={handleLinkInsert} disabled={disabled} label="Link">
          <LinkIcon size={14} />
        </ToolbarButton>
      </div>
      <EditorContent
        editor={editor}
        className={[
          "prose prose-sm max-w-none px-4 py-3 min-h-[200px] text-base-content",
          // Editor chrome
          "[&_.tiptap]:outline-none [&_.tiptap]:min-h-[180px]",
          // Placeholder
          "[&_.tiptap_p.is-editor-empty:first-child::before]:text-base-content/30",
          "[&_.tiptap_p.is-editor-empty:first-child::before]:content-[attr(data-placeholder)]",
          "[&_.tiptap_p.is-editor-empty:first-child::before]:float-left",
          "[&_.tiptap_p.is-editor-empty:first-child::before]:h-0",
          "[&_.tiptap_p.is-editor-empty:first-child::before]:pointer-events-none",
          // Headings
          "[&_.tiptap_h1]:text-xl [&_.tiptap_h1]:font-mono [&_.tiptap_h1]:font-bold [&_.tiptap_h1]:text-base-content [&_.tiptap_h1]:mt-6 [&_.tiptap_h1]:mb-3 [&_.tiptap_h1]:border-b [&_.tiptap_h1]:border-base-content/10 [&_.tiptap_h1]:pb-2",
          "[&_.tiptap_h2]:text-base [&_.tiptap_h2]:font-mono [&_.tiptap_h2]:font-semibold [&_.tiptap_h2]:text-base-content/90 [&_.tiptap_h2]:mt-5 [&_.tiptap_h2]:mb-2",
          // Paragraphs
          "[&_.tiptap_p]:text-base-content/80 [&_.tiptap_p]:leading-relaxed [&_.tiptap_p]:mb-3",
          // Links
          "[&_.tiptap_a]:text-primary [&_.tiptap_a]:underline [&_.tiptap_a]:underline-offset-2 [&_.tiptap_a]:decoration-primary/40 hover:[&_.tiptap_a]:decoration-primary",
          // Inline code
          "[&_.tiptap_code]:bg-base-300 [&_.tiptap_code]:px-1.5 [&_.tiptap_code]:py-0.5 [&_.tiptap_code]:rounded [&_.tiptap_code]:text-[0.85em] [&_.tiptap_code]:font-mono [&_.tiptap_code]:text-accent",
          // Code blocks
          "[&_.tiptap_pre]:bg-base-300 [&_.tiptap_pre]:p-4 [&_.tiptap_pre]:rounded-lg [&_.tiptap_pre]:text-[0.85em] [&_.tiptap_pre]:font-mono [&_.tiptap_pre]:overflow-x-auto [&_.tiptap_pre]:my-3",
          "[&_.tiptap_pre_code]:bg-transparent [&_.tiptap_pre_code]:p-0 [&_.tiptap_pre_code]:text-base-content/80",
          // Lists
          "[&_.tiptap_ul]:pl-5 [&_.tiptap_ul]:my-2 [&_.tiptap_ul]:list-disc",
          "[&_.tiptap_ol]:pl-5 [&_.tiptap_ol]:my-2 [&_.tiptap_ol]:list-decimal",
          "[&_.tiptap_li]:text-base-content/80 [&_.tiptap_li]:mb-1 [&_.tiptap_li]:leading-relaxed",
          "[&_.tiptap_li_p]:mb-0",
          // Task lists
          "[&_.tiptap_ul[data-type=taskList]]:list-none [&_.tiptap_ul[data-type=taskList]]:pl-0",
          "[&_.tiptap_ul[data-type=taskList]_li]:flex [&_.tiptap_ul[data-type=taskList]_li]:items-start [&_.tiptap_ul[data-type=taskList]_li]:gap-2",
          "[&_.tiptap_ul[data-type=taskList]_input]:mt-1 [&_.tiptap_ul[data-type=taskList]_input]:accent-primary",
          // Blockquotes
          "[&_.tiptap_blockquote]:border-l-2 [&_.tiptap_blockquote]:border-primary/30 [&_.tiptap_blockquote]:pl-4 [&_.tiptap_blockquote]:ml-0 [&_.tiptap_blockquote]:my-3 [&_.tiptap_blockquote]:text-base-content/60 [&_.tiptap_blockquote]:italic",
          // Horizontal rules
          "[&_.tiptap_hr]:border-base-content/10 [&_.tiptap_hr]:my-6",
          // Strong / emphasis
          "[&_.tiptap_strong]:text-base-content [&_.tiptap_strong]:font-semibold",
          "[&_.tiptap_em]:text-base-content/70",
          // Strikethrough
          "[&_.tiptap_s]:text-base-content/40 [&_.tiptap_s]:line-through",
        ].join(" ")}
      />
    </div>
  );
}
