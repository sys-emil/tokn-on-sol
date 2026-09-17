# Mail-Vorlagen ausserhalb des Codes

Alle Mails, die Passly selbst verschickt, entstehen aus `src/lib/mailLayout.ts`.
Die eine Ausnahme ist der **Anmeldecode**: den schickt Supabase Auth
(`signInWithOtp`), und seine Vorlage liegt im Supabase-Dashboard, nicht im Repo.

`supabase-login-code.html` ist diese Vorlage, mit `renderMail` aus demselben
Layout erzeugt, damit sie im Postfach neben der Kaufbestaetigung nicht wie
ein anderer Absender aussieht. Aendert sich das Layout, hier neu erzeugen und
im Dashboard neu einfuegen.

Einfuegen: Supabase → Projekt getpassly → Authentication → Emails → Templates →
**Magic Link** (die Vorlage, die `signInWithOtp` benutzt; `{{ .Token }}` darin
macht aus dem Link den 6-stelligen Code). Betreff: `Dein Anmeldecode für Passly`.
Platzhalter: `{{ .Token }}` (Code), `{{ .Email }}` (Empfaenger).
