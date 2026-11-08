import { jsonPointer, type JsonEditorRules, type JsonFieldRule } from "./json-editor";

// These field types follow the Java area-resource persistence contracts.
function stringRules(fields: readonly string[]): [string, JsonFieldRule][] {
  return fields.map((field) => [jsonPointer("", field), { type: "string", nullable: field !== "areaId" && field !== "name" }]);
}
function integerRules(fields: readonly string[]): [string, JsonFieldRule][] {
  return fields.map((field) => [jsonPointer("", field), { type: "number", integer: true }]);
}

export const mobileEditorRules: JsonEditorRules = Object.fromEntries([
  ...stringRules([
    "areaId", "vnum", "name", "shortDescription", "longDescription", "description", "race", "alignment", "group",
    "damType", "hitDice", "manaDice", "damageDice", "armorClass", "startPos", "defaultPos", "sex", "size", "material", "flags",
  ]),
  ...integerRules(["level", "hitroll", "gold", "silver"]),
  ["/statusFlags", { type: "object", nullable: true }],
]);

export const roomEditorRules: JsonEditorRules = Object.fromEntries([
  ...stringRules(["areaId", "vnum", "name", "description", "extraDescription"]),
  ...integerRules(["spawnTimer", "spawnTime", "teleDelay", "roomFlags", "sectorType"]),
  ["/pvp", { type: "boolean" }],
  ["/spawn", { type: "boolean" }],
  // Edit exit contents as objects while keeping the List<String> wire format.
  ["/exits", { type: "array", itemType: "string", itemStringFormat: "json-object", nullable: true }],
  ["/mobiles", { type: "object", propertyType: "string", nullable: true }],
]);

export const specialEditorRules: JsonEditorRules = Object.fromEntries([
  ...stringRules(["areaId", "mobVnum", "comment"]),
  ["/name", { type: "string", nullable: true }],
  ["/specialFunction", {
    type: "array", itemType: "string", nullable: true,
    label: "Special Function", itemLabel: "Lambda", itemEditor: "code",
  }],
]);
