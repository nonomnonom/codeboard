import type { Panel, StoryboardDocument } from "../model/types.js";
export type Header = Omit<StoryboardDocument, "panels" | "components" | "changes" | "studio">;
export type PanelInfo = Omit<Panel, "layers" | "motion">;
export type SaveOptions = {
  expectedVersion?: number;
  overwrite?: boolean;
  assetRoot?: string;
  readAsset?: (id: string) => Buffer | undefined;
};
export type VersionRecord = {
  id: string;
  position: number;
  info: string;
  hash: string;
};
export interface SavedRevision {
  studioHash?: string;
  name: string;
  createdAt: string;
  version: number;
  documentHash: string;
  changesHash: string;
  panels: VersionRecord[];
  components: VersionRecord[];
  assets: {
    id: string;
    hash: string;
  }[];
}
