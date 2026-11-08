import type { GameBuildView } from "./GameBuildView";

export type GameIntegrityView = {
  contentHash: string;
  build: GameBuildView;
};
