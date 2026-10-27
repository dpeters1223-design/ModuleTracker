import "server-only";
import { emailList } from "@/lib/activity";
import { appUrl, slackEscape, slackIds, slackMention } from "@/lib/slack";

/**
 * Who may formally sign a module off: SIGNOFF_USERS, a comma-separated email list.
 * Unset means nobody can — sign-off is deliberate, so it is never granted by default.
 */
export const signOffUsers = () => emailList(process.env.SIGNOFF_USERS);

export const canSignOff = (email: string | null | undefined) =>
  Boolean(email) && signOffUsers().includes(email!.toLowerCase());

/**
 * The Slack post announcing a sign-off, @-mentioning everyone in SIGNOFF_NOTIFY so
 * the people the sign-off reports to are actually notified, rather than relying on
 * them happening to read the channel.
 */
export function signOffMessage(title: string, by: string, moduleId: string): string {
  const ids = slackIds();
  const mentions = emailList(process.env.SIGNOFF_NOTIFY)
    .map((email) => slackMention(email, ids))
    .filter((m): m is string => Boolean(m));
  return (
    `:white_check_mark: *${slackEscape(title)}* has been signed off by ${slackEscape(by)}` +
    `${mentions.length ? ` · ${mentions.join(" ")}` : ""}\n` +
    `The module is complete, and stays editable — anything further goes in as a change order. ` +
    `<${appUrl(`/modules/${moduleId}`)}|Open the module>`
  );
}
