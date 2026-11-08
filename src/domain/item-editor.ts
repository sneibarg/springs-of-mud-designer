import { emptyEditableResourceDrafts } from "./constants";
import { jsonPointer, jsonValueType, type JsonEditorRules } from "./json-editor";

// ItemView in the Java persistence API has int scalars and List<String> fields.
// Keep reusable JSON controls generic; these rules belong to the Items adapter.
export const itemEditorRules: JsonEditorRules = Object.fromEntries(
  Object.entries(emptyEditableResourceDrafts["items"])
    .filter((entry): entry is [string, Exclude<typeof entry[1], undefined>] => entry[1] !== undefined)
    .map(([key, value]) => {
      const type = jsonValueType(value);
      return [jsonPointer("", key), {
        type,
        ...(type === "array" ? { itemType: "string" as const } : {}),
        ...(type === "number" ? { integer: true } : { nullable: true }),
      }];
    }),
);
