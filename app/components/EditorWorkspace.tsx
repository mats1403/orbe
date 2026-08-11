"use client";

import {
  Bold, Check, ChevronLeft, Code2, Download, FileText, Highlighter, Italic,
  List, Minus, PenLine, Plus, Redo2, Save, Table2, Trash2, Undo2, X,
} from "lucide-react";
import { PointerEvent, useEffect, useRef, useState } from "react";
import type { OrbeDocument, Stroke } from "../lib/types";

type Props = { document: OrbeDocument; onClose: () => void; onSave: (document: OrbeDocument) => void };
const EMPTY_GRID = Array.from({ length: 30 }, () => Array.from({ length: 12 }, () => "" as string | number | boolean | null));

export function EditorWorkspace({ document, onClose, onSave }: Props) {
  const [draft, setDraft] = useState(document);
  const [saving, setSaving] = useState(false);
  async function save() {
    setSaving(true);
    await Promise.resolve(onSave(draft));
    window.setTimeout(() => setSaving(false), 350);
  }
  return <div className="document-editor">
    <header className="editor-topbar">
      <div className="editor-identity">
        <button className="icon-button" onClick={onClose} aria-label="Voltar"><ChevronLeft size={20} /></button>
        <span className={"editor-kind-icon " + draft.accent}>{iconFor(draft.kind)}</span>
        <span><input value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} aria-label="Nome do documento" /><small>{labelFor(draft.kind)} · {draft.size}</small></span>
      </div>
      <div className="editor-status"><span><Check size={13} /> Edição local protegida</span><button className="editor-save-button" onClick={save}><Save size={16} /> {saving ? "Salvando…" : "Salvar"}</button><button className="icon-button" onClick={onClose}><X size={19} /></button></div>
    </header>
    <div className="editor-body">
      {draft.kind === "markdown" && <MarkdownEditor value={draft.content ?? ""} onChange={(content) => setDraft({ ...draft, content })} />}
      {draft.kind === "spreadsheet" && <SpreadsheetEditor file={draft.file} initial={draft.sheet} onChange={(sheet) => setDraft({ ...draft, sheet })} name={draft.name} />}
      {draft.kind === "pdf" && <PdfEditor document={draft} onChange={(annotations) => setDraft({ ...draft, annotations })} />}
      {draft.kind === "samsung" && <SamsungEditor file={draft.file} value={draft.content ?? ""} onChange={(content) => setDraft({ ...draft, content })} />}
      {draft.kind === "drawing" && <FreeCanvas initial={draft.annotations ?? []} onChange={(annotations) => setDraft({ ...draft, annotations })} />}
      {draft.kind === "file" && <GenericEditor document={draft} onChange={(content) => setDraft({ ...draft, content })} />}
    </div>
  </div>;
}

function iconFor(kind: OrbeDocument["kind"]) {
  if (kind === "spreadsheet") return <Table2 size={18} />;
  if (kind === "pdf") return <FileText size={18} />;
  if (kind === "drawing") return <PenLine size={18} />;
  return <Code2 size={18} />;
}
function labelFor(kind: OrbeDocument["kind"]) {
  return { markdown: "Markdown", spreadsheet: "Planilha editável", pdf: "PDF com camada de anotações", samsung: "Samsung Notes", drawing: "Quadro livre", file: "Arquivo preservado" }[kind];
}

function MarkdownEditor({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const [mode, setMode] = useState<"split" | "write" | "preview">("split");
  const textarea = useRef<HTMLTextAreaElement>(null);
  function wrap(before: string, after = before) {
    const input = textarea.current;
    if (!input) return;
    const start = input.selectionStart, end = input.selectionEnd;
    onChange(value.slice(0, start) + before + value.slice(start, end) + after + value.slice(end));
    requestAnimationFrame(() => { input.focus(); input.setSelectionRange(start + before.length, end + before.length); });
  }
  return <div className="markdown-editor">
    <div className="editor-ribbon">
      <div className="format-tools">
        <button onClick={() => wrap("**")} title="Negrito"><Bold size={16} /></button>
        <button onClick={() => wrap("_")} title="Itálico"><Italic size={16} /></button>
        <button onClick={() => wrap("## ", "")} title="Título">H2</button>
        <button onClick={() => wrap("- ", "")} title="Lista"><List size={16} /></button>
        <button onClick={() => wrap(String.fromCharCode(96))} title="Código"><Code2 size={16} /></button>
      </div>
      <div className="mode-tabs">{(["write", "split", "preview"] as const).map((item) => <button className={mode === item ? "active" : ""} key={item} onClick={() => setMode(item)}>{item === "write" ? "Escrever" : item === "split" ? "Dividir" : "Visualizar"}</button>)}</div>
    </div>
    <div className={"markdown-panes mode-" + mode}>
      {mode !== "preview" && <textarea ref={textarea} value={value} onChange={(event) => onChange(event.target.value)} spellCheck placeholder="Comece a escrever em Markdown…" />}
      {mode !== "write" && <div className="markdown-preview">{renderMarkdown(value)}</div>}
    </div>
  </div>;
}

function renderMarkdown(markdown: string) {
  return markdown.split("\n").map((line, index) => {
    const key = index + "-" + line;
    if (line.startsWith("### ")) return <h3 key={key}>{inline(line.slice(4))}</h3>;
    if (line.startsWith("## ")) return <h2 key={key}>{inline(line.slice(3))}</h2>;
    if (line.startsWith("# ")) return <h1 key={key}>{inline(line.slice(2))}</h1>;
    if (line.startsWith("- [ ] ")) return <label className="md-check" key={key}><input type="checkbox" readOnly />{inline(line.slice(6))}</label>;
    if (line.startsWith("- [x] ")) return <label className="md-check" key={key}><input type="checkbox" checked readOnly />{inline(line.slice(6))}</label>;
    if (line.startsWith("- ")) return <div className="md-list" key={key}>• {inline(line.slice(2))}</div>;
    if (line.startsWith("> ")) return <blockquote key={key}>{inline(line.slice(2))}</blockquote>;
    if (!line.trim()) return <div className="md-space" key={key} />;
    return <p key={key}>{inline(line)}</p>;
  });
}
function inline(text: string) {
  const parts = text.split(/(\*\*[^*]+\*\*|_[^_]+_)/g);
  return parts.map((part, i) => part.startsWith("**") ? <strong key={i}>{part.slice(2, -2)}</strong> : part.startsWith("_") ? <em key={i}>{part.slice(1, -1)}</em> : part);
}

function SpreadsheetEditor({ file, initial, onChange, name }: { file?: File; initial?: OrbeDocument["sheet"]; onChange: (sheet: NonNullable<OrbeDocument["sheet"]>) => void; name: string }) {
  const [sheet, setSheet] = useState<(string | number | boolean | null)[][]>(initial?.length ? initial : EMPTY_GRID);
  const [selected, setSelected] = useState({ row: 0, col: 0 });
  const [loading, setLoading] = useState(Boolean(file && !initial?.length));

  useEffect(() => {
    if (!file || initial?.length) return;
    let active = true;
    import("read-excel-file/browser").then(({ default: readXlsxFile }) => readXlsxFile(file)).then((rows) => {
      if (!active) return;
      const width = Math.max(12, rows[0]?.length ?? 0);
      const normalized = Array.from({ length: Math.max(30, rows.length) }, (_, row) => Array.from({ length: width }, (_, col) => {
        const value = rows[row]?.[col];
        return typeof value === "string" || typeof value === "number" || typeof value === "boolean" ? value : value == null ? "" : String(value);
      }));
      setSheet(normalized); onChange(normalized); setLoading(false);
    }).catch(() => setLoading(false));
    return () => { active = false; };
  }, [file, initial, onChange]);

  function update(row: number, col: number, value: string) {
    const next = sheet.map((line) => [...line]);
    next[row][col] = value;
    setSheet(next); onChange(next);
  }
  function addRow() { const next = [...sheet, Array.from({ length: sheet[0]?.length ?? 12 }, () => "")]; setSheet(next); onChange(next); }
  async function exportSheet() {
    const { default: writeXlsxFile } = await import("write-excel-file/browser");
    await writeXlsxFile(sheet.map((row) => row.map((value) => ({ value: value ?? "" }))), { fileName: name.toLowerCase().endsWith(".xlsx") ? name : name + ".xlsx" });
  }

  return <div className="sheet-editor">
    <div className="editor-ribbon sheet-ribbon"><div><button><Undo2 size={15} /></button><button><Redo2 size={15} /></button><span className="ribbon-divider" /><button><Bold size={15} /></button><button>R$</button><button>%</button></div><div><span>{String.fromCharCode(65 + selected.col)}{selected.row + 1}</span><input value={String(sheet[selected.row]?.[selected.col] ?? "")} onChange={(event) => update(selected.row, selected.col, event.target.value)} /></div><button className="export-button" onClick={exportSheet}><Download size={15} /> Exportar .xlsx</button></div>
    {loading ? <div className="editor-loading"><span /> Lendo planilha com segurança…</div> : <div className="sheet-scroll"><table><thead><tr><th className="corner" />{sheet[0]?.map((_, col) => <th key={col}>{columnName(col)}</th>)}</tr></thead><tbody>{sheet.map((row, rowIndex) => <tr key={rowIndex}><th>{rowIndex + 1}</th>{row.map((cell, colIndex) => <td className={selected.row === rowIndex && selected.col === colIndex ? "selected" : ""} key={colIndex} onClick={() => setSelected({ row: rowIndex, col: colIndex })}><input value={String(cell ?? "")} onChange={(event) => update(rowIndex, colIndex, event.target.value)} /></td>)}</tr>)}</tbody></table><button className="add-sheet-row" onClick={addRow}><Plus size={15} /> Nova linha</button></div>}
  </div>;
}
function columnName(index: number) { let name = ""; for (let n = index; n >= 0; n = Math.floor(n / 26) - 1) name = String.fromCharCode(65 + n % 26) + name; return name; }

function PdfEditor({ document, onChange }: { document: OrbeDocument; onChange: (strokes: Stroke[]) => void }) {
  const [annotating, setAnnotating] = useState(true);
  return <div className="pdf-editor">
    <div className="editor-ribbon"><div className="format-tools"><button className={annotating ? "active" : ""} onClick={() => setAnnotating(true)}><PenLine size={16} /> Anotar</button><button onClick={() => setAnnotating(false)}><FileText size={16} /> Navegar</button></div><span className="pdf-hint">As anotações ficam em uma camada separada; o original nunca é alterado.</span></div>
    <div className="pdf-stage">{document.objectUrl ? <iframe src={document.objectUrl + "#toolbar=0"} title={document.name} /> : <div className="pdf-empty">Prévia indisponível</div>}{annotating && <AnnotationCanvas initial={document.annotations ?? []} onChange={onChange} />}</div>
  </div>;
}

function AnnotationCanvas({ initial, onChange }: { initial: Stroke[]; onChange: (strokes: Stroke[]) => void }) {
  const [strokes, setStrokes] = useState(initial);
  const [color, setColor] = useState("#d15f48");
  const active = useRef<Stroke | null>(null);
  function start(event: PointerEvent<HTMLDivElement>) { const rect = event.currentTarget.getBoundingClientRect(); active.current = { color, width: color === "#e6c84f" ? 14 : 3, points: [{ x: (event.clientX - rect.left) / rect.width * 100, y: (event.clientY - rect.top) / rect.height * 100 }] }; event.currentTarget.setPointerCapture(event.pointerId); }
  function move(event: PointerEvent<HTMLDivElement>) { if (!active.current) return; const rect = event.currentTarget.getBoundingClientRect(); active.current.points.push({ x: (event.clientX - rect.left) / rect.width * 100, y: (event.clientY - rect.top) / rect.height * 100 }); setStrokes([...strokes.filter((item) => item !== active.current), active.current]); }
  function end() { if (!active.current) return; const next = [...strokes.filter((item) => item !== active.current), active.current]; active.current = null; setStrokes(next); onChange(next); }
  return <div className="annotation-layer" onPointerDown={start} onPointerMove={move} onPointerUp={end} onPointerCancel={end}>
    <svg viewBox="0 0 100 100" preserveAspectRatio="none">{strokes.map((stroke, index) => <polyline key={index} points={stroke.points.map((p) => p.x + "," + p.y).join(" ")} fill="none" stroke={stroke.color} strokeWidth={stroke.width / 10} strokeLinecap="round" strokeLinejoin="round" opacity={stroke.color === "#e6c84f" ? .35 : .9} />)}</svg>
    <div className="annotation-tools" onPointerDown={(event) => event.stopPropagation()}><button className={color === "#d15f48" ? "selected" : ""} onClick={() => setColor("#d15f48")}><PenLine size={16} /></button><button className={color === "#e6c84f" ? "selected" : ""} onClick={() => setColor("#e6c84f")}><Highlighter size={16} /></button><button onClick={() => { setStrokes([]); onChange([]); }}><Trash2 size={16} /></button></div>
  </div>;
}

function SamsungEditor({ file, value, onChange }: { file?: File; value: string; onChange: (value: string) => void }) {
  const [status, setStatus] = useState(file ? "Analisando pacote do Samsung Notes…" : "Conteúdo importado");
  useEffect(() => {
    if (!file || value) return;
    let active = true;
    import("jszip").then(({ default: JSZip }) => JSZip.loadAsync(file)).then(async (zip) => {
      const candidates = Object.values(zip.files).filter((entry) => !entry.dir && /\.(txt|xml|html|json)$/i.test(entry.name)).slice(0, 30);
      const chunks = await Promise.all(candidates.map((entry) => entry.async("string").catch(() => "")));
      const clean = chunks.join("\n\n").replace(/<[^>]*>/g, " ").replace(/\s{3,}/g, "\n\n").trim();
      if (!active) return;
      if (clean) { onChange(clean); setStatus(candidates.length + " partes recuperadas do pacote"); }
      else { onChange("O arquivo original foi preservado. Este pacote não expôs texto editável; você pode escrever uma transcrição aqui ou importar a exportação em PDF/Word do Samsung Notes."); setStatus("Original preservado · transcrição manual disponível"); }
    }).catch(() => { if (active) { onChange("O arquivo original foi preservado. Para obter máxima fidelidade, exporte esta nota pelo Samsung Notes como PDF ou Word e importe novamente."); setStatus("Pacote proprietário preservado"); } });
    return () => { active = false; };
  }, [file, value, onChange]);
  return <div className="samsung-editor"><div className="import-summary"><span className="editor-kind-icon blue"><FileText size={18} /></span><span><strong>Importação não destrutiva</strong><small>{status}</small></span></div><textarea value={value} onChange={(event) => onChange(event.target.value)} placeholder="O texto recuperado aparecerá aqui…" /></div>;
}

function FreeCanvas({ initial, onChange }: { initial: Stroke[]; onChange: (strokes: Stroke[]) => void }) {
  const [strokes, setStrokes] = useState(initial);
  const [color, setColor] = useState("#26251f");
  const [width, setWidth] = useState(3);
  const active = useRef<Stroke | null>(null);
  function start(event: PointerEvent<HTMLDivElement>) { const rect = event.currentTarget.getBoundingClientRect(); active.current = { color, width, points: [{ x: (event.clientX - rect.left) / rect.width * 100, y: (event.clientY - rect.top) / rect.height * 100 }] }; event.currentTarget.setPointerCapture(event.pointerId); }
  function move(event: PointerEvent<HTMLDivElement>) { if (!active.current) return; const rect = event.currentTarget.getBoundingClientRect(); active.current.points.push({ x: (event.clientX - rect.left) / rect.width * 100, y: (event.clientY - rect.top) / rect.height * 100 }); setStrokes([...strokes.filter((item) => item !== active.current), active.current]); }
  function end() { if (!active.current) return; const next = [...strokes.filter((item) => item !== active.current), active.current]; active.current = null; setStrokes(next); onChange(next); }
  return <div className="free-canvas-shell"><div className="canvas-editor-tools">{["#26251f", "#7164ad", "#d15f48", "#2c8869"].map((item) => <button key={item} className={"color-dot " + (color === item ? "selected" : "")} style={{ background: item }} onClick={() => setColor(item)} />)}<Minus size={15} />{[2, 5, 9].map((item) => <button className={width === item ? "active" : ""} key={item} onClick={() => setWidth(item)}>{item}</button>)}<button onClick={() => { setStrokes([]); onChange([]); }}><Trash2 size={15} /></button></div><div className="free-canvas" onPointerDown={start} onPointerMove={move} onPointerUp={end} onPointerCancel={end}><svg viewBox="0 0 100 100" preserveAspectRatio="none">{strokes.map((stroke, index) => <polyline key={index} points={stroke.points.map((p) => p.x + "," + p.y).join(" ")} fill="none" stroke={stroke.color} strokeWidth={stroke.width / 10} strokeLinecap="round" strokeLinejoin="round" />)}</svg></div></div>;
}

function GenericEditor({ document, onChange }: { document: OrbeDocument; onChange: (value: string) => void }) {
  return <div className="generic-editor"><span className="editor-kind-icon sand"><FileText size={22} /></span><h2>{document.name}</h2><p>O arquivo original foi preservado sem conversão. Adicione contexto e relações sem perder o formato de origem.</p><textarea value={document.content ?? ""} onChange={(event) => onChange(event.target.value)} placeholder="Adicione uma descrição, resumo ou observações…" /></div>;
}
