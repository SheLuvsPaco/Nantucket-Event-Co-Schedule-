export function isCountFreePackItem(name: string | null | undefined) {
  return /^(?:stage legs?|turfs?)$/i.test(name?.trim() ?? "");
}

export type PackListGroup<T> = {
  section: string | null;
  items: T[];
};

export function groupPackItemsBySection<T extends { section?: string | null }>(
  items: T[],
): { sectioned: boolean; groups: PackListGroup<T>[] } {
  const sectioned = items.some((item) => Boolean(item.section?.trim()));
  if (!sectioned) {
    return {
      sectioned: false,
      groups: items.length ? [{ section: null, items }] : [],
    };
  }

  const groups = new Map<string, PackListGroup<T>>();
  for (const item of items) {
    const section = item.section?.trim() || null;
    const key = section ?? "__unsectioned__";
    const group = groups.get(key) ?? { section, items: [] };
    group.items.push(item);
    groups.set(key, group);
  }

  return { sectioned: true, groups: [...groups.values()] };
}
