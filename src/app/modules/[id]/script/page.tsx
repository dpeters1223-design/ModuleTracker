import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getModule } from "@/lib/modules";
import { getFileMeta, getGoogleAccessToken } from "@/lib/google-drive";
import { ScriptPanel, type ScriptInfo } from "../script-panel";

export default async function ModuleScriptPage(props: PageProps<"/modules/[id]/script">) {
  const { id } = await props.params;
  const mod = await getModule(id);
  if (!mod) notFound();

  const scriptLink = await prisma.documentLink.findFirst({
    where: { moduleId: id, type: "script" },
    orderBy: { addedAt: "desc" },
  });

  let script: ScriptInfo | null = null;
  if (scriptLink) {
    // Live "last edited" info from Drive, when this viewer's token can see the file.
    const session = await auth();
    const meta =
      scriptLink.driveFileId && session?.user?.id && session.driveGranted
        ? await getGoogleAccessToken(session.user.id)
            .then((token) => getFileMeta(token, scriptLink.driveFileId!))
            .catch(() => null)
        : null;
    script = {
      id: scriptLink.id,
      url: scriptLink.url,
      label: meta?.name ?? scriptLink.label,
      lastEdited: meta?.modifiedTime ?? null,
      lastEditedBy: meta?.lastModifyingUser?.displayName ?? null,
    };
  }

  return <ScriptPanel moduleId={mod.id} script={script} />;
}
