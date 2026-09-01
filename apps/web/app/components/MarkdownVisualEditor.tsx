"use client";

import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { Markdown } from "@tiptap/markdown";
import { Bold, Code2, Heading1, Heading2, Italic, List, ListOrdered, Quote, Redo2, Undo2 } from "lucide-react";
import { useEffect, useState } from "react";

export function MarkdownVisualEditor({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const [sourceOpen, setSourceOpen] = useState(false);
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [StarterKit, Markdown],
    content: value,
    contentType: "markdown",
    editorProps: { attributes: { class: "visual-markdown-content", spellcheck: "true" } },
    onUpdate: ({ editor }) => onChange(editor.getMarkdown()),
  });

  useEffect(() => {
    if (editor && !editor.isFocused && editor.getMarkdown() !== value) {
      editor.commands.setContent(value, { contentType: "markdown", emitUpdate: false });
    }
  }, [editor, value]);

  if (!editor) return <div className="editor-loading"><span /> Preparando editor…</div>;
  const action = (active: boolean, label: string, icon: React.ReactNode, run: () => void) => (
    <button className={active ? "active" : ""} title={label} aria-label={label} onClick={run}>{icon}</button>
  );

  return <div className="markdown-editor visual-markdown-editor">
    <div className="editor-ribbon">
      <div className="format-tools">
        {action(false, "Desfazer", <Undo2 size={16} />, () => editor.chain().focus().undo().run())}
        {action(false, "Refazer", <Redo2 size={16} />, () => editor.chain().focus().redo().run())}
        <span className="ribbon-divider" />
        {action(editor.isActive("bold"), "Negrito", <Bold size={16} />, () => editor.chain().focus().toggleBold().run())}
        {action(editor.isActive("italic"), "Itálico", <Italic size={16} />, () => editor.chain().focus().toggleItalic().run())}
        {action(editor.isActive("heading", { level: 1 }), "Título 1", <Heading1 size={16} />, () => editor.chain().focus().toggleHeading({ level: 1 }).run())}
        {action(editor.isActive("heading", { level: 2 }), "Título 2", <Heading2 size={16} />, () => editor.chain().focus().toggleHeading({ level: 2 }).run())}
        {action(editor.isActive("bulletList"), "Lista", <List size={16} />, () => editor.chain().focus().toggleBulletList().run())}
        {action(editor.isActive("orderedList"), "Lista numerada", <ListOrdered size={16} />, () => editor.chain().focus().toggleOrderedList().run())}
        {action(editor.isActive("blockquote"), "Citação", <Quote size={16} />, () => editor.chain().focus().toggleBlockquote().run())}
        {action(editor.isActive("code"), "Código", <Code2 size={16} />, () => editor.chain().focus().toggleCode().run())}
      </div>
      <button className={"source-toggle " + (sourceOpen ? "active" : "")} onClick={() => setSourceOpen(!sourceOpen)}><Code2 size={14} /> Markdown bruto</button>
    </div>
    <div className="visual-markdown-scroll"><EditorContent editor={editor} /></div>
    {sourceOpen && <div className="markdown-source-drawer"><header><strong>Markdown bruto</strong><small>Ferramenta secundária para ajustes precisos</small></header><textarea value={value} onChange={(event) => { onChange(event.target.value); editor.commands.setContent(event.target.value, { contentType: "markdown", emitUpdate: false }); }} /></div>}
  </div>;
}
