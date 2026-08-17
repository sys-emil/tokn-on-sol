# resale-v1 — der alte C2C-Weiterverkauf (archiviert 2026-08-18)

Dieser Ordner ist **toter Code**. Er wird nicht gebaut und nicht type-geprüft
(`archive` steht in `tsconfig.json` unter `exclude`). Er liegt hier, damit die
Entscheidungen von damals nachvollziehbar bleiben und ein Wiederaufbau nicht bei
null anfängt.

Der letzte Stand mit funktionierendem Feature trägt den Git-Tag **`resale-v1`**.

## Was es war

Ein echter C2C-Sekundärmarkt: Verkäufer A stellte sein Ticket zu einem Preis
zwischen Face-Value und dem Markup-Deckel des Veranstalters ein
(`events.resale_max_markup_pct`, 0–200 %), das cNFT wanderte in die
Operator-Escrow, Käufer B zahlte über eine eigene Stripe-Session, und A bekam
den Erlös als **Passly-Guthaben** (`user_credits`), das er beim nächsten
Ticketkauf einlösen konnte.

Die Gebühr war 8–15 % des Listenpreises, hälftig zwischen Käufer und Verkäufer
geteilt, mit einer Rampe von 1 Prozentpunkt je 5 % Aufpreis
(`fees-resale-block.ts`).

## Warum es ersetzt wurde

Drei Gründe, die alle am selben Punkt hängen — Passly war **Merchant of Record**
einer Transaktion zwischen zwei Privatpersonen:

1. **Haftung.** Bei einem Chargeback auf einen Resale-Charge klemmte
   `add_credit` den Saldo bei 0, wenn der Verkäufer sein Guthaben schon
   ausgegeben hatte. Die Differenz trug die Plattform.
2. **Regulierung.** `user_credits` ist gespeicherter Wert und rückt damit in die
   Nähe von E-Geld (ZAG/BaFin) — eine offene Rechtsfrage, die auch eine
   Haftungsbeschränkung nicht löst.
3. **KYC.** Echtes Geld an einen Fremden auszuzahlen geht nach GwG nicht ohne
   Identifizierung. Guthaben war der Umweg darum herum, und genau der erzeugte
   Punkt 2.

Ersetzt durch **„Rückgabe & Neuverkauf"** (`src/lib/resaleReturn.ts`): A gibt
das Ticket zurück, der Veranstalter verkauft den Platz neu, A wird auf seine
ursprüngliche Zahlungsmethode erstattet. Eine Erstattung ist juristisch keine
Auszahlung an einen Dritten, sondern die Umkehrung einer Zahlung desselben
Menschen — kein KYC, kein gespeicherter Wert, kein Merchant of Record.

Der Preis dafür: **kein Aufpreis mehr.** Man kann niemandem mehr erstatten, als
er gezahlt hat, also nur noch Weiterverkauf zum Originalpreis.

## Ein technischer Fund, der beim Abbau auffiel

Bubblegums `transfer` **löscht die Delegation**. Gemessen an echten Assets:
frisch gemintete Tickets haben den Operator als Delegate, einmal übertragene
haben gar keinen. Da `transferCnft` als `leafDelegate` signiert, kann Passly ein
einmal übertragenes Ticket **nie wieder bewegen**.

Das betraf resale-v1 unmittelbar (der Käufer eines weiterverkauften Tickets
konnte es nie wieder anbieten) und war zugleich ein stiller Fehler im
Gast-Checkout. Wer das Feature je reaktiviert, muss das zuerst lösen — die
`transfer`-Instruktion nimmt keinen neuen Delegate entgegen, und die separate
`delegate`-Instruktion muss vom Besitzer signiert werden.

Genau deshalb überträgt das neue Modell **gar keine Tickets mehr**: das alte wird
widerrufen, das neue frisch gemintet (Kosten: 17.500 Lamport, deutlich unter
einem Cent).

## Was beim Reaktivieren wieder gebraucht würde

- Tabellen `resale_listings`, `user_credits`, `credit_ledger`, `credit_holds`
- SQL-Funktionen `add_credit`, `reserve_credit`, `release_credit`,
  `redeem_credit`, `reserve_resale_listing`, `release_resale_listing`,
  `release_expired_resale_listings`
- Spalte `events.resale_max_markup_pct` (steht noch, ungenutzt)
- Guthaben-Einlösung in `/api/checkout/create` (Hold, Stripe-Coupon,
  `creditHoldId`/`creditAppliedCents` in den Session-Metadaten) und die
  zugehörigen Zweige im Stripe-Webhook
- Die drei Webhook-Handler in `webhook-resale-handlers.ts`
- **Und eine Antwort auf die Delegations- und die ZAG-Frage.**

## Dateien

| Datei | Herkunft |
|---|---|
| `lib/resale.ts` | `src/lib/resale.ts` |
| `fees-resale-block.ts` | Resale-Block aus `src/lib/fees.ts` |
| `webhook-resale-handlers.ts` | `handleResaleCompleted/Refund/Dispute` aus dem Stripe-Webhook |
| `api/resale/*.route.ts` | `src/app/api/resale/{list,cancel,checkout,event}` |
| `api/credit/route.ts` | `src/app/api/credit/route.ts` |
