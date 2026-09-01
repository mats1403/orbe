export type EditorKind = "markdown" | "spreadsheet" | "pdf" | "samsung" | "drawing" | "file" | "secure";

export type SecurityConfig = {
  isLocked: boolean;
  lockType: "pin" | "password";
  salt: string;
  iv: string;
  encryptedPayload: string;
  hash?: string;
  hint?: string;
  autoLockOnClose?: boolean;
};

export type StrokePoint = { x: number; y: number };
export type DrawTool = "pencil" | "pen" | "marker" | "highlighter";
export type Stroke = { id?: string; color: string; width: number; opacity?: number; tool?: DrawTool; page?: number; layerId?: string; points: StrokePoint[] };
export type DrawingLayer = { id: string; name: string; visible: boolean; locked: boolean; opacity: number };

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
  drawingLayers?: DrawingLayer[];
  file?: File;
  objectUrl?: string;
  cloudId?: string;
  security?: SecurityConfig;
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

export type SessionUser = { id: string; email: string; display_name?: string; role?: "admin" | "user" };
