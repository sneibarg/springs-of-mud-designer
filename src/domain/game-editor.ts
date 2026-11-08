import { jsonPointer, type JsonEditorRules } from "./json-editor";

// Shape hints from the Java GameDataView. Table contents remain data-driven.
export const gameEditorRules: JsonEditorRules = {
  ...Object.fromEntries([
    ["version", "Version"], ["enums", "Enums"], ["attributeBonuses", "Attribute Bonuses"],
    ["classes", "Classes"], ["races", "Races"], ["pcRaces", "PC Races"], ["wiznetTable", "Wiznet Table"],
    ["groups", "Groups"], ["titles", "Titles"], ["itemTable", "Item Table"], ["combat", "Combat"],
    ["weapons", "Weapons"], ["attacks", "Attacks"], ["liquids", "Liquids"],
    ["groupRewards", "Group Rewards"], ["clans", "Clans"], ["integrity", "Integrity"],
  ].map(([key, label]) => [jsonPointer("", key), { type: "object", nullable: true, label }])),
  "/kind": { type: "string", nullable: true },
  "/status": { type: "string", nullable: true },
  "/version/family": { type: "string", nullable: true },
  "/version/lineage": { type: "array", itemType: "string", nullable: true },
  "/version/semver": { type: "string", nullable: true },
  "/version/createdAt": { type: "string", nullable: true },
  "/version/notes": { type: "string", nullable: true },
  "/integrity/contentHash": { type: "string", nullable: true },
  "/integrity/build": { type: "object", nullable: true },
  "/integrity/build/source": { type: "string", nullable: true },
  "/integrity/build/toolVersion": { type: "string", nullable: true },
  "/integrity/build/extra": { type: "object", nullable: true },
  "/denyList": { type: "array", itemType: "string", nullable: true, label: "Deny List" },
};
