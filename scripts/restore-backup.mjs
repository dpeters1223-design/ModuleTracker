// Restores ModuleTracker data from a backup JSON (latest.json or backup-YYYY-MM-DD.json
// from the "ModuleTracker Backups" Drive folder).
//
//   node scripts/restore-backup.mjs <path-to-backup.json>             preview only (changes nothing)
//   node scripts/restore-backup.mjs <path-to-backup.json> --rehearse  run the full restore, verify it,
//                                                                     then roll it back (changes nothing)
//   node scripts/restore-backup.mjs <path-to-backup.json> --yes       replace all data with the backup
//
// Uses DATABASE_URL from .env.local. The restore runs in one transaction: if any
// step fails, nothing changes. Modules, scenes, tasks, document links, versions and
// change orders are REPLACED by the backup's. Users are kept (with their Google
// sign-in connections); users only in the backup are added back without one.
import { config } from "dotenv";
import fs from "fs";
import { PrismaNeon } from "@prisma/adapter-neon";
import { PrismaClient } from "@prisma/client";

config({ path: ".env.local", quiet: true });

const [file, flag] = process.argv.slice(2);
if (!file) {
  console.error("Usage: node scripts/restore-backup.mjs <backup.json> [--yes]");
  process.exit(1);
}
const backup = JSON.parse(fs.readFileSync(file, "utf8"));
if (backup.format !== "moduletracker-backup" || backup.version !== 1) {
  console.error("That file isn't a ModuleTracker backup (format/version mismatch).");
  process.exit(1);
}
const d = backup.data;

const prisma = new PrismaClient({ adapter: new PrismaNeon({ connectionString: process.env.DATABASE_URL }) });
try {
  const current = {
    modules: await prisma.module.count(),
    scenes: await prisma.scene.count(),
    tasks: await prisma.task.count(),
    documentLinks: await prisma.documentLink.count(),
    moduleVersions: await prisma.moduleVersion.count(),
    changeOrders: await prisma.changeOrder.count(),
  };
  console.log(`Backup taken ${backup.exportedAt}`);
  console.log("                 now → after restore");
  for (const [k, v] of Object.entries(backup.counts)) console.log(`  ${k.padEnd(15)} ${String(current[k]).padStart(3)} → ${v}`);

  if (flag !== "--yes" && flag !== "--rehearse") {
    console.log("\nPreview only. Re-run with --rehearse to test it, or --yes to replace the current data.");
    process.exit(0);
  }

  const ROLLBACK = new Error("rehearsal rollback");
  await prisma.$transaction(
    async (tx) => {
      const existing = new Set((await tx.user.findMany({ select: { id: true } })).map((u) => u.id));
      const missing = d.users.filter((u) => !existing.has(u.id));
      if (missing.length) await tx.user.createMany({ data: missing });
      const userIds = new Set([...existing, ...missing.map((u) => u.id)]);

      await tx.changeOrder.deleteMany({});
      await tx.module.deleteMany({}); // cascades scenes, tasks, links, versions

      await tx.module.createMany({ data: d.modules });
      await tx.scene.createMany({ data: d.scenes });
      await tx.task.createMany({ data: d.tasks });
      await tx.moduleVersion.createMany({ data: d.moduleVersions });
      await tx.documentLink.createMany({
        data: d.documentLinks.map((l) => ({ ...l, addedById: userIds.has(l.addedById) ? l.addedById : null })),
      });
      await tx.changeOrder.createMany({ data: d.changeOrders });

      const after = {
        modules: await tx.module.count(),
        scenes: await tx.scene.count(),
        tasks: await tx.task.count(),
        documentLinks: await tx.documentLink.count(),
        moduleVersions: await tx.moduleVersion.count(),
        changeOrders: await tx.changeOrder.count(),
      };
      const mismatch = Object.entries(backup.counts).filter(([k, v]) => after[k] !== v);
      if (mismatch.length) throw new Error(`Restored counts don't match the backup: ${JSON.stringify(mismatch)}`);
      if (flag === "--rehearse") throw ROLLBACK;
    },
    { timeout: 120_000, maxWait: 20_000 }
  ).catch((e) => {
    if (e !== ROLLBACK) throw e;
  });
  console.log(
    flag === "--rehearse"
      ? "\nRehearsal passed: the backup restores cleanly. Rolled back, so nothing changed."
      : "\nRestore complete."
  );
} finally {
  await prisma.$disconnect();
}
