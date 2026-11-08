export type AreaView = {
  id?: string;
  author: string;
  name: string;
  vnum: string;
  suggestedLevelRange: string;
  rooms: string[];
  mobiles: string[];
  objects: string[];
  shops: string[];
  resets: string[];
  specials: string[];
};

export type AreaResourceListField = keyof Pick<
  AreaView,
  "rooms" | "mobiles" | "objects" | "shops" | "resets" | "specials"
>;

export function areaTotalResources(area: AreaView): number {
  return (
    area.rooms.length +
    area.mobiles.length +
    area.objects.length +
    area.shops.length +
    area.resets.length +
    area.specials.length
  );
}

export function areaHasResource(area: AreaView, type: AreaResourceListField): boolean {
  return area[type].length > 0;
}
