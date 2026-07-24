/**
 * Challenge string a buyer's wallet signs for a backup ticket (static QR for
 * venues without connectivity). Client-safe: imported by the buyer modal, the
 * issue route, the verify route and the doorman offline verifier so all four
 * reconstruct byte-identical challenges.
 *
 * When a person is bound in, the identity is part of what the signature
 * covers, so the name/birth date the doorman reads come straight from the
 * signed QR and can't be edited on the PDF. Legacy backup tickets (issued
 * before this, no person) sign the bare `passly:backup:<assetId>` and keep
 * verifying.
 */

export interface BackupPerson {
  firstName: string;
  lastName: string;
  birthDate: string; // YYYY-MM-DD
}

/** Collapse surrounding/duplicate whitespace so both signer and verifier agree. */
const norm = (s: string): string => s.trim().replace(/\s+/g, " ");

export function backupChallenge(assetId: string, person?: BackupPerson | null): string {
  if (!person) return `passly:backup:${assetId}`;
  // `|` is safe: the name regex (NAME_RE in the issue route) forbids it.
  return `passly:backup:${assetId}:${norm(person.firstName)}|${norm(person.lastName)}|${person.birthDate}`;
}
