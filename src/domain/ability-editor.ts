import { jsonPointer, type JsonEditorRules, type JsonFieldRule } from "./json-editor";

type AbilityJsonField = {
  key: string;
  label: string;
  rules: JsonEditorRules & { readonly "": JsonFieldRule };
};

const objectRule: JsonFieldRule = { type: "object", nullable: true };
const classMapRule: JsonFieldRule = { ...objectRule, propertyType: "number", propertyInteger: true };
const classMapRules = { "": classMapRule };
const payloadField: AbilityJsonField = { key: "payload", label: "Payload", rules: { "": objectRule } };

const classMapFields: readonly AbilityJsonField[] = [
  { key: "ratingByClass", label: "Rating by class", rules: classMapRules },
  { key: "levelByClass", label: "Level by class", rules: classMapRules },
];

export const commandJsonFields: readonly AbilityJsonField[] = [payloadField];
export const skillJsonFields: readonly AbilityJsonField[] = [
  ...classMapFields,
  { key: "fightPlan", label: "Fight plan", rules: { "": objectRule } },
  payloadField,
];
export const spellJsonFields: readonly AbilityJsonField[] = [
  ...classMapFields,
  payloadField,
  { key: "affectData", label: "Affect data", rules: {
    "": { type: "array", itemType: "object", itemLabel: "Affect", nullable: true },
  } },
  { key: "lambdas", label: "Lambdas", rules: {
    "": { type: "array", itemType: "string", itemLabel: "Lambda", itemEditor: "code", nullable: true },
  } },
];

export const commandJsonRules: JsonEditorRules = {
  "/payload": objectRule,
  "/lambdas": { type: "array", itemType: "string", nullable: true },
};
export const skillJsonRules: JsonEditorRules = Object.fromEntries(
  skillJsonFields.map(({ key, rules }) => [jsonPointer("", key), rules[""]]),
);
export const spellJsonRules: JsonEditorRules = Object.fromEntries(
  spellJsonFields.map(({ key, rules }) => [jsonPointer("", key), rules[""]]),
);
