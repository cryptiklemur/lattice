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
      editor.commands.setContent(parsed);
    } else if (!parsed && content !== currentJson) {
      editor.commands.setContent(content || "");
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
        className="prose prose-sm max-w-none px-3 py-2 min-h-[200px] text-base-content [&_.tiptap]:outline-none [&_.tiptap]:min-h-[180px] [&_.tiptap_p.is-editor-empty:first-child::before]:text-base-content/30 [&_.tiptap_p.is-editor-empty:first-child::before]:content-[attr(data-placeholder)] [&_.tiptap_p.is-editor-empty:first-child::before]:float-left [&_.tiptap_p.is-editor-empty:first-child::before]:h-0 [&_.tiptap_p.is-editor-empty:first-child::before]:pointer-events-none [&_.tiptap_h1]:text-lg [&_.tiptap_h1]:font-mono [&_.tiptap_h1]:font-bold [&_.tiptap_h2]:text-base [&_.tiptap_h2]:font-mono [&_.tiptap_h2]:font-semibold [&_.tiptap_a]:text-primary [&_.tiptap_a]:underline [&_.tiptap_code]:bg-base-300 [&_.tiptap_code]:px-1 [&_.tiptap_code]:rounded [&_.tiptap_pre]:bg-base-300 [&_.tiptap_pre]:p-3 [&_.tiptap_pre]:rounded-lg [&_.tiptap_ul[data-type=taskList]]:list-none [&_.tiptap_ul[data-type=taskList]]:pl-0"
      />
    </div>
  );
}
