export interface ScriptEntry {
  id: string;
  kind: "scene" | "action" | "dialogue";
  text: string;
  speaker?: string;
  panelIds: string[];
}

export interface ScriptInput {
  id: string;
  title: string;
  entries: ScriptEntry[];
}

export interface ProductionScript extends ScriptInput {
  revision: number;
}

export interface ScriptChangeReport {
  scriptId: string;
  beforeRevision: number;
  revision: number;
  titleChanged: boolean;
  reordered: boolean;
  added: string[];
  removed: string[];
  updated: { id: string; fields: ("kind" | "text" | "speaker" | "panelIds")[] }[];
}
