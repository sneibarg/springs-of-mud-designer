export type FeatureStatus = "Ready" | "Drafting" | "Needs API" | "Planned";
export type FeatureKind =
    | "skills"
    | "spells"
    | "settings"
    | "game"
    | "areas"
    | "rooms"
    | "mobiles"
    | "items"
    | "shops"
    | "resets"
    | "specials"
    | "classes"
    | "races"
    | "commands"
    | "helps"
    | "socials"
    | "notes"
    | "communication";

export type ApiResource = {
    kind: FeatureKind;
    label: string;
    endpoint: string;
    fields: string[];
    icon: string;
    status: FeatureStatus;
    summary: string;
};

export type DesignerDraft = {
    name: string;
    kind: FeatureKind;
    areaId: string;
    target: string;
    level: number;
    notes: string;
};

export type WorkQueueItem = {
    id: string;
    title: string;
    area: string;
    resource: FeatureKind;
    status: FeatureStatus;
    owner: string;
};

export type ApiHealth = {
    state: "checking" | "online" | "offline";
    detail: string;
};

export type EditableValue =
    | string
    | number
    | boolean
    | null
    | EditableValue[]
    | { [key: string]: EditableValue };
