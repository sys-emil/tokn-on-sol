import { cookies } from "next/headers";
import { normalizeLang, translator, type Lang } from "@/lib/i18n";

/**
 * Server-side language resolution. Split from `src/lib/i18n.ts` so client
 * components can import the dictionary without dragging in `next/headers`.
 *
 * Reading the cookie opts a route out of static rendering. That is acceptable
 * here — every buyer page already reads from the database per request — but
 * don't reach for this in a component that must stay static.
 */
export async function getLang(): Promise<Lang> {
  const store = await cookies();
  return normalizeLang(store.get("passly_lang")?.value);
}

/** `const { lang, t } = await getT();` for server components. */
export async function getT(): Promise<{ lang: Lang; t: ReturnType<typeof translator> }> {
  const lang = await getLang();
  return { lang, t: translator(lang) };
}
