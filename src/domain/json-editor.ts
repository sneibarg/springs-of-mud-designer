import type { EditableValue } from "../types/common";

export type JsonValueType = "string" | "number" | "boolean" | "null" | "object" | "array";
export const jsonValueTypes: readonly JsonValueType[] = ["string", "number", "boolean", "null", "object", "array"];
export type JsonEditorIssue = { path: string; message: string };
export type JsonEditorState =
  | { status: "valid"; dirty: boolean; value: EditableValue }
  | { status: "invalid"; dirty: boolean; issues: readonly JsonEditorIssue[] };
export type JsonFieldRule = {
  type: JsonValueType;
  itemType?: JsonValueType;
  propertyType?: JsonValueType;
  nullable?: boolean;
  integer?: boolean;
  stringFormat?: "json-object";
  itemStringFormat?: "json-object";
  label?: string;
  itemLabel?: string;
  editor?: "code";
  itemEditor?: "code";
};
export type JsonEditorRules = Readonly<Record<string, JsonFieldRule>>;
export type JsonEditorOptions = { requireObject?: boolean; readOnlyPaths?: readonly string[]; rules?: JsonEditorRules };

// IDs and buffers belong to the editor, and never to the JSON document.
export type JsonEditorNode = {
  id: number;
  key: string;
  type: JsonValueType;
  scalar: string | number | boolean | null;
  text: string;
  children: JsonEditorNode[];
  expanded: boolean;
  multiline: boolean;
  error: string;
};
let nextNodeId = 0;

export function jsonValueType(value: EditableValue): JsonValueType {
  return value === null ? "null" : Array.isArray(value) ? "array" : typeof value as Exclude<JsonValueType, "null" | "array">;
}

export function isJsonValue(value: unknown, ancestors = new Set<object>()): value is EditableValue {
  if (value === null || typeof value === "string" || typeof value === "boolean") return true;
  if (typeof value === "number") return Number.isFinite(value);
  if (typeof value !== "object" || ancestors.has(value)) return false;
  if (!Array.isArray(value) && Object.getPrototypeOf(value) !== Object.prototype && Object.getPrototypeOf(value) !== null) return false;
  ancestors.add(value);
  const valid = Array.isArray(value)
    ? Array.from(value).every((entry) => isJsonValue(entry, ancestors))
    : Object.values(value).every((entry) => isJsonValue(entry, ancestors));
  ancestors.delete(value);
  return valid;
}

export function parseJsonObjectString(text: string): { [key: string]: EditableValue } {
  const value: unknown = JSON.parse(text);
  if (!isJsonValue(value) || value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Enter a JSON object for this entry.");
  }
  return value;
}

function jsonObjectStringIssue(value: string, path: string): JsonEditorIssue[] {
  try {
    parseJsonObjectString(value);
    return [];
  } catch (error) {
    return [{ path, message: error instanceof Error ? error.message : "Enter a JSON object for this entry." }];
  }
}

export function jsonPointer(parent: string, key: string | number): string {
  return `${parent}/${String(key).replace(/~/g, "~0").replace(/\//g, "~1")}`;
}

export function createJsonNode(value: EditableValue, key = "", depth = 0): JsonEditorNode {
  const type = jsonValueType(value);
  return {
    id: nextNodeId++, key, type,
    scalar: typeof value === "object" ? null : value,
    text: type === "number" || type === "string" ? String(value) : "",
    children: Array.isArray(value) ? value.map((entry) => createJsonNode(entry, "", depth + 1))
      : value !== null && typeof value === "object" ? Object.entries(value).map(([name, entry]) => createJsonNode(entry, name, depth + 1)) : [],
    expanded: depth === 0,
    multiline: type === "string" && ((typeof value === "string" && value.includes("\n")) || /description|text|notes|message/i.test(key)),
    error: "",
  };
}

export function jsonNodeValue(node: JsonEditorNode): EditableValue {
  if (node.type === "array") return node.children.map(jsonNodeValue);
  if (node.type === "object") return Object.fromEntries(node.children.map((child) => [child.key, jsonNodeValue(child)]));
  return node.scalar;
}

export function emptyJsonValue(type: JsonValueType): EditableValue {
  switch (type) {
    case "array": return [];
    case "object": return {};
    case "string": return "";
    case "number": return 0;
    case "boolean": return false;
    case "null": return null;
  }
}

export function setJsonNodeType(node: JsonEditorNode, type: JsonValueType): void {
  const replacement = createJsonNode(emptyJsonValue(type), node.key);
  Object.assign(node, replacement, { id: node.id });
}

export function updateJsonScalar(node: JsonEditorNode, text: string): void {
  node.text = text;
  node.error = "";
  if (node.type === "string") node.scalar = text;
  if (node.type === "number") {
    if (!/^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?$/.test(text) || !Number.isFinite(Number(text))) {
      node.error = "Enter a complete, finite JSON number.";
    } else node.scalar = Number(text);
  }
}

export function nodeIssues(node: JsonEditorNode, path = ""): JsonEditorIssue[] {
  return [
    ...(node.error ? [{ path, message: node.error }] : []),
    ...node.children.flatMap((child, index) => nodeIssues(child, jsonPointer(path, node.type === "array" ? index : child.key))),
  ];
}

export function pathIsReadOnly(path: string, paths: readonly string[] = []): boolean {
  return paths.some((locked) => path === locked || path.startsWith(`${locked}/`));
}

export function pathContainsReadOnly(path: string, paths: readonly string[] = []): boolean {
  return pathIsReadOnly(path, paths) || paths.some((locked) => locked.startsWith(`${path}/`));
}

function valueAtPointer(value: EditableValue, pointer: string): unknown {
  let current: unknown = value;
  if (!pointer) return current;
  for (const token of pointer.slice(1).split("/")) {
    const key = token.replace(/~1/g, "/").replace(/~0/g, "~");
    if (!current || typeof current !== "object" || !Object.prototype.hasOwnProperty.call(current, key)) return undefined;
    current = (current as Record<string, unknown>)[key];
  }
  return current;
}

export function validateJsonValue(value: EditableValue, baseline: EditableValue, options: JsonEditorOptions): JsonEditorIssue[] {
  const issues: JsonEditorIssue[] = [];
  if (options.requireObject && jsonValueType(value) !== "object") issues.push({ path: "", message: "This document must be a JSON object." });
  for (const path of options.readOnlyPaths ?? []) {
    if (JSON.stringify(valueAtPointer(value, path)) !== JSON.stringify(valueAtPointer(baseline, path))) {
      issues.push({ path, message: "This field is read-only. Restore its original value." });
    }
  }
  for (const [path, rule] of Object.entries(options.rules ?? {})) {
    const entry = valueAtPointer(value, path);
    if (entry === undefined || (entry === null && rule.nullable)) continue;
    if (!isJsonValue(entry) || jsonValueType(entry) !== rule.type) {
      issues.push({ path, message: `Expected ${rule.type}${rule.nullable ? " or null" : ""}.` });
    } else if (rule.integer && !Number.isInteger(entry)) {
      issues.push({ path, message: "Enter a whole number." });
    } else if (rule.stringFormat && typeof entry === "string") {
      issues.push(...jsonObjectStringIssue(entry, path));
    } else if (rule.itemType && Array.isArray(entry)) {
      entry.forEach((item, index) => {
        if (jsonValueType(item) !== rule.itemType) issues.push({ path: jsonPointer(path, index), message: `Expected ${rule.itemType}.` });
        else if (rule.itemStringFormat && typeof item === "string") issues.push(...jsonObjectStringIssue(item, jsonPointer(path, index)));
      });
    } else if (rule.propertyType && entry !== null && typeof entry === "object" && !Array.isArray(entry)) {
      for (const [key, item] of Object.entries(entry)) {
        if (jsonValueType(item) !== rule.propertyType) issues.push({ path: jsonPointer(path, key), message: `Expected ${rule.propertyType}.` });
      }
    }
  }
  return issues;
}
