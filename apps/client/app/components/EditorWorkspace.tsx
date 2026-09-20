"use client";

import {
  Bold, Check, ChevronLeft, Code2, Download, FileText, Lock, LockOpen,
  PenLine, Plus, Redo2, Save, Settings2, ShieldCheck, Table2, Undo2, X
} from "lucide-react";
import { useEffect, useState } from "react";
import { encryptContent } from "../lib/crypto";
import type { DrawingLayer, OrbeDocument, SecurityConfig, Stroke } from "../lib/types";
import { DEFAULT_LAYER, DrawingToolbar, DrawSettings, LayersPanel, StrokeCanvas, useStrokeHistory } from "./DrawingToolkit";
import { MarkdownVisualEditor } from "./MarkdownVisualEditor";
import { PdfAnnotator } from "./PdfAnnotator";
import { SecureSetupModal } from "./SecureSetupModal";
import { SecureUnlockModal } from "./SecureUnlockModal";

type Props = { document: OrbeDocument; onClose: () => void; onSave: (document: OrbeDocument) => void };
const EMPTY_GRID = Array.from({ length: 30 }, () => Array.from({ length: 12 }, () => "" as string | number | boolean | null));

export function EditorWorkspace({ document, onClose, onSave }: Props) {
  const [draft, setDraft] = useState(document);
  const [saving, setSaving] = useState(false);
  const [activePasscode, setActivePasscode] = useState<string | null>(null);
  const [securityModalOpen, setSecurityModalOpen] = useState(false);
  const [isLocked, setIsLocked] = useState(Boolean(document.security?.isLocked));

  // Desbloqueio bem sucedido
  function handleUnlock(decryptedContent: string, passcode: string) {
    setActivePasscode(passcode);
    setIsLocked(false);
    setDraft((prev) => ({
      ...prev,
      content: decryptedContent,
      security: prev.security ? { ...prev.security, isLocked: false } : undefined,
    }));
  }

  // Bloqueio imediato da nota
  function handleManualLock() {
    setIsLocked(true);
    setActivePasscode(null);
    setDraft((prev) => ({
      ...prev,
      security: prev.security ? { ...prev.security, isLocked: true } : undefined,
    }));
  }

  // Salvar nota
  async function save() {
    setSaving(true);
    const toSave = { ...draft };

    // Se a nota tiver configuração de segurança e temos o passcode ativo, recriptografa
    if (toSave.security && activePasscode && toSave.content) {
      try {
        const encrypted = await encryptContent(toSave.content, activePasscode);
        toSave.security = {
          ...toSave.security,
          salt: encrypted.salt,
          iv: encrypted.iv,
          encryptedPayload: encrypted.encryptedPayload,
          hash: encrypted.hash,
        };
      } catch (err) {
        console.error("Erro ao criptografar ao salvar:", err);
      }
    }

    await Promise.resolve(onSave(toSave));
    window.setTimeout(() => setSaving(false), 350);
  }

  // Fechar respeitando autoLockOnClose
  function handleClose() {
    if (draft.security?.autoLockOnClose) {
      const lockedDoc = {
        ...draft,
        security: { ...draft.security, isLocked: true },
      };
      onSave(lockedDoc);
    }
    onClose();
  }

  // Atualizar configurações de segurança
  function handleSecuritySave(newConfig: SecurityConfig | null, newPasscode?: string) {
    if (!newConfig) {
      // Remoção de segurança
      setDraft((prev) => ({
        ...prev,
        kind: prev.kind === "secure" ? "markdown" : prev.kind,
        accent: prev.kind === "secure" ? "lilac" : prev.accent,
        security: undefined,
      }));
      setActivePasscode(null);
    } else {
      // Nova ou atualizada configuração
      setDraft((prev) => ({
        ...prev,
        kind: "secure",
        accent: "gold",
        security: newConfig,
      }));
      if (newPasscode) {
        setActivePasscode(newPasscode);
      }
    }
  }

  // Se a nota estiver bloqueada, renderiza o modal/tela de desbloqueio
  if (isLocked && draft.security) {
    return (
      <div className="document-editor">
        <SecureUnlockModal
          document={draft}
          onUnlock={handleUnlock}
          onCancel={onClose}
        />
      </div>
    );
  }

  return (
    <div className="document-editor">
      <header className="editor-topbar">
        <div className="editor-identity">
          <button className="icon-button" onClick={handleClose} aria-label="Voltar">
            <ChevronLeft size={20} />
          </button>
          <span className={"editor-kind-icon " + draft.accent}>{iconFor(draft.kind)}</span>
          <span>
            <input
              value={draft.name}
              onChange={(event) => setDraft({ ...draft, name: event.target.value })}
              aria-label="Nome do documento"
            />
            <small>{labelFor(draft.kind)} · {draft.size}</small>
          </span>
        </div>

        <div className="editor-status">
          {draft.security ? (
            <div className="secure-badge-topbar">
              <span className="secure-status-pill">
                <ShieldCheck size={14} />
                <span>Protegida ({draft.security.lockType === "pin" ? "PIN" : "Senha"})</span>
              </span>
              <button
                className="secure-action-btn"
                onClick={handleManualLock}
                title="Bloquear nota agora"
              >
                <Lock size={15} />
                <span>Bloquear</span>
              </button>
              <button
                className="secure-action-btn secondary"
                onClick={() => setSecurityModalOpen(true)}
                title="Configurar senha/PIN"
              >
                <Settings2 size={15} />
              </button>
            </div>
          ) : (
            <button
              className="protect-note-button"
              onClick={() => setSecurityModalOpen(true)}
              title="Adicionar bloqueio por PIN ou Senha"
            >
              <LockOpen size={14} />
              <span>Proteger com PIN</span>
            </button>
          )}

          <span><Check size={13} /> Edição local protegida</span>
          <button className="editor-save-button" onClick={save}>
            <Save size={16} /> {saving ? "Salvando…" : "Salvar"}
          </button>
          <button className="icon-button" onClick={handleClose}>
            <X size={19} />
          </button>
        </div>
      </header>

      <div className="editor-body">
        {(draft.kind === "markdown" || draft.kind === "secure") && (
          <MarkdownVisualEditor
            value={draft.content ?? ""}
            onChange={(content) => setDraft({ ...draft, content })}
          />
        )}
        {draft.kind === "spreadsheet" && (
          <SpreadsheetEditor
            file={draft.file}
            initial={draft.sheet}
            onChange={(sheet) => setDraft({ ...draft, sheet })}
            name={draft.name}
          />
        )}
        {draft.kind === "pdf" && (
          <PdfAnnotator
            document={draft}
            onChange={(annotations) => setDraft({ ...draft, annotations })}
          />
        )}
        {draft.kind === "samsung" && (
          <SamsungEditor
            file={draft.file}
            value={draft.content ?? ""}
            onChange={(content) => setDraft({ ...draft, content })}
          />
        )}
        {draft.kind === "drawing" && (
          <FreeCanvas
            initial={draft.annotations ?? []}
            initialLayers={draft.drawingLayers}
            onChange={(annotations, drawingLayers) =>
              setDraft({ ...draft, annotations, drawingLayers })
            }
          />
        )}
        {draft.kind === "file" && (
          <GenericEditor
            document={draft}
            onChange={(content) => setDraft({ ...draft, content })}
          />
        )}
      </div>

      {securityModalOpen && (
        <SecureSetupModal
          currentContent={draft.content ?? ""}
          initialSecurity={draft.security}
          onSave={handleSecuritySave}
          onClose={() => setSecurityModalOpen(false)}
        />
      )}
    </div>
  );
}

function iconFor(kind: OrbeDocument["kind"]) {
  if (kind === "spreadsheet") return <Table2 size={18} />;
  if (kind === "pdf") return <FileText size={18} />;
  if (kind === "drawing") return <PenLine size={18} />;
  if (kind === "secure") return <Lock size={18} />;
  return <Code2 size={18} />;
}

function labelFor(kind: OrbeDocument["kind"]) {
  return {
    markdown: "Markdown",
    spreadsheet: "Planilha editável",
    pdf: "PDF com camada de anotações",
    samsung: "Samsung Notes",
    drawing: "Quadro livre",
    file: "Arquivo preservado",
    secure: "Nota Segura (Cofre)",
  }[kind];
}

function SpreadsheetEditor({ file, initial, onChange, name }: { file?: File; initial?: OrbeDocument["sheet"]; onChange: (sheet: NonNullable<OrbeDocument["sheet"]>) => void; name: string }) {
  const [sheet, setSheet] = useState<(string | number | boolean | null)[][]>(initial?.length ? initial : EMPTY_GRID);
  const [selected, setSelected] = useState({ row: 0, col: 0 });
  const [loading, setLoading] = useState(Boolean(file && !initial?.length));

  useEffect(() => {
    if (!file || initial?.length) return;
    let active = true;
    import("read-excel-file/browser").then(async ({ readSheet, default: readXlsxFile }) => {
      if (readSheet) {
        return readSheet(file);
      }
      const sheets = await readXlsxFile(file);
      const first = sheets[0];
      if (first && "data" in first && Array.isArray(first.data)) {
        return first.data;
      }
      return (sheets as unknown as Array<unknown[]>);
    }).then((rows: unknown) => {
      if (!active || !Array.isArray(rows)) return;
      const rowList = rows as Array<unknown[]>;
      const width = Math.max(12, rowList[0]?.length ?? 0);
      const normalized = Array.from({ length: Math.max(30, rowList.length) }, (_, row) => Array.from({ length: width }, (_, col) => {
        const value = rowList[row]?.[col];
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
    const data = sheet.map((row) => row.map((value) => ({ value: value == null ? "" : (typeof value === "string" || typeof value === "number" || typeof value === "boolean" ? value : String(value)) })));
    const fileName = name.toLowerCase().endsWith(".xlsx") ? name : name + ".xlsx";
    const result = writeXlsxFile(data);
    if (result && typeof result.toFile === "function") {
      await result.toFile(fileName);
    }
  }

  return <div className="sheet-editor">
    <div className="editor-ribbon sheet-ribbon"><div><button><Undo2 size={15} /></button><button><Redo2 size={15} /></button><span className="ribbon-divider" /><button><Bold size={15} /></button><button>R$</button><button>%</button></div><div><span>{String.fromCharCode(65 + selected.col)}{selected.row + 1}</span><input value={String(sheet[selected.row]?.[selected.col] ?? "")} onChange={(event) => update(selected.row, selected.col, event.target.value)} /></div><button className="export-button" onClick={exportSheet}><Download size={15} /> Exportar .xlsx</button></div>
    {loading ? <div className="editor-loading"><span /> Lendo planilha com segurança…</div> : <div className="sheet-scroll"><table><thead><tr><th className="corner" />{sheet[0]?.map((_, col) => <th key={col}>{columnName(col)}</th>)}</tr></thead><tbody>{sheet.map((row, rowIndex) => <tr key={rowIndex}><th>{rowIndex + 1}</th>{row.map((cell, colIndex) => <td className={selected.row === rowIndex && selected.col === colIndex ? "selected" : ""} key={colIndex} onClick={() => setSelected({ row: rowIndex, col: colIndex })}><input value={String(cell ?? "")} onChange={(event) => update(rowIndex, colIndex, event.target.value)} /></td>)}</tr>)}</tbody></table><button className="add-sheet-row" onClick={addRow}><Plus size={15} /> Nova linha</button></div>}
  </div>;
}
function columnName(index: number) { let name = ""; for (let n = index; n >= 0; n = Math.floor(n / 26) - 1) name = String.fromCharCode(65 + n % 26) + name; return name; }

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

function FreeCanvas({ initial, initialLayers, onChange }: { initial: Stroke[]; initialLayers?: DrawingLayer[]; onChange: (strokes: Stroke[], layers: DrawingLayer[]) => void }) {
  const [layers, setLayers] = useState<DrawingLayer[]>(initialLayers?.length ? initialLayers : [DEFAULT_LAYER]);
  const [activeLayerId, setActiveLayerId] = useState(layers.at(-1)?.id ?? "base");
  const [settings, setSettings] = useState<DrawSettings>({ tool: "pen", color: "#282721", width: 3, opacity: .95 });
  const history = useStrokeHistory(initial, (strokes) => onChange(strokes, layers));
  const activeLayer = layers.find((layer) => layer.id === activeLayerId) ?? layers[0];
  function changeLayers(next: DrawingLayer[]) { setLayers(next); onChange(history.strokes, next); }
  return <div className="free-canvas-shell advanced-canvas">
    <DrawingToolbar settings={settings} onSettings={setSettings} undo={history.undo} redo={history.redo} canUndo={history.canUndo} canRedo={history.canRedo} onClear={() => history.commit(history.strokes.filter((stroke) => (stroke.layerId ?? "base") !== activeLayer.id))} />
    <div className="free-canvas-workspace"><div className="free-canvas"><StrokeCanvas strokes={history.strokes} settings={settings} onCommit={history.commit} layer={activeLayer} layers={layers} /></div><LayersPanel layers={layers} activeId={activeLayerId} onActive={setActiveLayerId} onChange={changeLayers} /></div>
  </div>;
}

function GenericEditor({ document, onChange }: { document: OrbeDocument; onChange: (value: string) => void }) {
  return <div className="generic-editor"><span className="editor-kind-icon sand"><FileText size={22} /></span><h2>{document.name}</h2><p>O arquivo original foi preservado sem conversão. Adicione contexto e relações sem perder o formato de origem.</p><textarea value={document.content ?? ""} onChange={(event) => onChange(event.target.value)} placeholder="Adicione uma descrição, resumo ou observações…" /></div>;
}
