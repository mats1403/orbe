export type EditorKind = "markdown" | "spreadsheet" | "pdf" | "samsung" | "drawing" | "file";

export type StrokePoint = { x: number; y: number };
export type Stroke = { color: string; width: number; points: StrokePoint[] };

export type OrbeDocument = {
  id: string;
  name: string;
  kind: EditorKind;
  mimeType: string;
  size: string;
  accent: string;
  content?: string;
  sheet?: (string | number | boolean | null)[][];
  annotations?: Stroke[];
  file?: File;
  objectUrl?: string;
  cloudId?: string;
};

export type CloudPage = {
  id: string;
  parent_id: string | null;
  title: string;
  icon: string | null;
  content: Array<{ type: string; data: Record<string, unknown> }>;
  is_favorite: boolean;
  updated_at: string;
};

export type SessionUser = { id: string; email: string };
