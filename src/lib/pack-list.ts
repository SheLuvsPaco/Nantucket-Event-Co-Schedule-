export function isCountFreePackItem(name: string | null | undefined) {
  return /^(?:stage legs?|turfs?)$/i.test(name?.trim() ?? "");
}
