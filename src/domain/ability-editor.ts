import { jsonPointer, type JsonEditorRules, type JsonFieldRule } from "./json-editor";

type AbilityJsonField = {
  key: string;
  label: string;
  rules: JsonEditorRules;
};

const objectRule: JsonFieldRule = { type: "object", nullable: true };
const classMapRule: JsonFieldRule = { ...objectRule, propertyType: "number", propertyInteger: true };
const classMapRules: JsonEditorRules = { "": classMapRule };
const payloadField: AbilityJsonField = { key: "payload", label: "Payload", rules: { "": objectRule } };

export const commandJsonFields: readonly AbilityJsonField[] = [payloadField];
export const skillJsonFields: readonly AbilityJsonField[] = [
  { key: "ratingByClass", label: "Rating by class", rules: classMapRules },
  { key: "levelByClass", label: "Level by class", rules: classMapRules },
  { key: "fightPlan", label: "Fight plan", rules: { "": objectRule } },
  payloadField,
];

export const commandJsonRules: JsonEditorRules = {
  "/payload": objectRule,
  "/lambdas": { type: "array", itemType: "string", nullable: true },
};
export const skillJsonRules: JsonEditorRules = Object.fromEntries(
  skillJsonFields.map(({ key, rules }) => [jsonPointer("", key), rules[""]]),
);
