// Rewrites every Task.owner and ModuleAsset.owner value to the team roster's
// canonical "First Last" form, so a name no longer shows up differently from one
// task to the next ("Jay" in one, "Jay Williamson" in another).
//
//   node scripts/normalize-owner-names.mjs             preview only (changes nothing)
//   node scripts/normalize-owner-names.mjs --yes       applies the renames shown
//
// Uses DATABASE_URL from .env.local, same as restore-backup.mjs. Each Owner box is
// split the same way the app matches owners (src/lib/team.ts: ownerParts), each part
// resolved through the roster, and the parts rejoined with ", ". A part that doesn't
// resolve to exactly one person (nobody matches, or more than one does) is left as
// typed and printed separately, so those few can be fixed by hand instead of guessed.
import { config } from "dotenv";
import { PrismaNeon } from "@prisma/adapter-neon";
import { PrismaClient } from "@prisma/client";
import { TEAM, buildOwnerIndex, splitOwnerText } from "../src/lib/team.ts";

config({ path: ".env.local", quiet: true });

const apply = process.argv.includes("--yes");
const prisma = new PrismaClient({ adapter: new PrismaNeon({ connectionString: process.env.DATABASE_URL }) });

try {
  const users = await prisma.user.findMany({ select: { email: true, name: true } });
  const index = buildOwnerIndex(users);
  const fullNameByEmail = new Map(TEAM.map((m) => [m.email.toLowerCase(), m.name]).filter(([, n]) => n));
  for (const u of users) {
    const email = u.email.toLowerCase();
    if (!fullNameByEmail.get(email) && u.name) fullNameByEmail.set(email, u.name);
  }

  /** One owner box's new text, or null if nothing about it needs to change. */
  function rewrite(owner) {
    const parts = splitOwnerText(owner);
    if (!parts.length) return null;
    const unresolved = [];
    const resolved = parts.map((part) => {
      const emails = index.get(part.toLowerCase().replace(/[^\p{L}\p{N}@ ]+/gu, " ").replace(/\s+/g, " ").trim());
      if (emails?.size === 1) {
        const full = fullNameByEmail.get([...emails][0]);
        if (full) return full;
      }
      unresolved.push(part);
      return part;
    });
    const next = resolved.join(", ");
    return { next, changed: next !== owner, unresolved };
  }

  for (const [model, label] of [
    [prisma.task, "Task"],
    [prisma.moduleAsset, "ModuleAsset"],
  ]) {
    const rows = await model.findMany({ where: { owner: { not: null } }, select: { id: true, owner: true } });
    const byOwner = new Map();
    for (const r of rows) {
      if (!byOwner.has(r.owner)) byOwner.set(r.owner, []);
      byOwner.get(r.owner).push(r.id);
    }

    console.log(`\n${label}: ${byOwner.size} distinct owner value(s) across ${rows.length} row(s)`);
    let changes = 0;
    const flagged = [];
    for (const [owner, ids] of byOwner) {
      const result = rewrite(owner);
      if (!result) continue;
      if (result.unresolved.length) flagged.push({ owner, unresolved: result.unresolved, count: ids.length });
      if (!result.changed) continue;
      changes++;
      console.log(`  "${owner}" → "${result.next}"  (${ids.length} row${ids.length === 1 ? "" : "s"})`);
      if (apply) await model.updateMany({ where: { id: { in: ids } }, data: { owner: result.next } });
    }
    if (!changes) console.log("  Nothing to rename.");
    if (flagged.length) {
      console.log(`  Left as typed — no single roster match for:`);
      for (const f of flagged) console.log(`    "${f.owner}" (${f.count} row${f.count === 1 ? "" : "s"}) — unmatched: ${f.unresolved.join(", ")}`);
    }
  }

  console.log(apply ? "\nApplied." : "\nDry run — nothing changed. Re-run with --yes to apply.");
} finally {
  await prisma.$disconnect();
}
