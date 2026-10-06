/**
 * The team, for working out whose task is whose. A task's Owner box is free text
 * ("Tom", "Thomas Pennell", "Jay, Dave", "Tom, Ksenia, Prof Valla"), so each person is
 * listed with every name they go by. Names from people's Google accounts are added
 * automatically (see buildOwnerIndex), so a new teammate matches once they've signed in.
 * Edit this list when people join or leave, or to add a nickname.
 */
export const TEAM: { email: string; name: string; aliases: string[] }[] = [
  { email: "dpp49@cornell.edu", name: "David Peters", aliases: ["David", "Dave", "Dave P", "David P", "Dave Peters"] },
  { email: "jgw226@cornell.edu", name: "Jay Williamson", aliases: ["Jay", "Jay W"] },
  { email: "tjp83@cornell.edu", name: "Tom Pennell", aliases: ["Tom", "Thomas", "Tom P", "Thomas Pennell"] },
  { email: "kbi4@cornell.edu", name: "Ksenia Ionova", aliases: ["Ksenia"] },
  { email: "bkl46@cornell.edu", name: "Becky Lane", aliases: ["Becky"] },
  { email: "sm2868@cornell.edu", name: "Suryash Malviya", aliases: ["Suryash"] },
  { email: "mlh355@cornell.edu", name: "Maggie Huggins", aliases: ["Maggie"] },
  { email: "kc359@cornell.edu", name: "", aliases: [] },
];

/** Lowercase, punctuation dropped, single spaces: "Prof. Valla" → "prof valla". */
const norm = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^\p{L}\p{N}@ ]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();

/** The people named in an Owner box: "Tom, Ksenia & Jay" → ["tom", "ksenia", "jay"]. */
export function ownerParts(owner: string | null | undefined): string[] {
  return (owner ?? "")
    .split(/,|&|\/|\+|;|\band\b/i)
    .map(norm)
    .filter(Boolean);
}

/** name → the emails it could mean. A name that fits more than one person is ambiguous. */
export type OwnerIndex = Map<string, Set<string>>;

/**
 * Every name each person goes by: roster names and nicknames, their NetID and email,
 * and their Google account name (full name and first name).
 */
export function buildOwnerIndex(users: { email: string; name: string | null }[]): OwnerIndex {
  const index: OwnerIndex = new Map();
  const add = (name: string | null | undefined, email: string) => {
    const key = norm(name ?? "");
    if (!key) return;
    if (!index.has(key)) index.set(key, new Set());
    index.get(key)!.add(email.toLowerCase());
  };
  const people = new Map<string, string[]>();
  for (const m of TEAM) people.set(m.email, [m.name, ...m.aliases]);
  for (const u of users) people.set(u.email.toLowerCase(), [...(people.get(u.email.toLowerCase()) ?? []), u.name ?? ""]);
  for (const [email, names] of people) {
    add(email, email);
    add(email.split("@")[0], email);
    for (const n of names) {
      add(n, email);
      add(n.split(" ")[0], email); // first name
    }
  }
  return index;
}

/** Whether a task with this Owner box is this person's (they're one of its owners, unambiguously). */
export function isOwnedBy(owner: string | null | undefined, email: string, index: OwnerIndex): boolean {
  const me = email.toLowerCase();
  return ownerParts(owner).some((part) => {
    const emails = index.get(part);
    return emails?.size === 1 && emails.has(me);
  });
}

/** Names to suggest in the Owner box: the roster's full names. */
export const teamNames = () => TEAM.map((m) => m.name).filter(Boolean);
