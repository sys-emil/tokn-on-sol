/**
 * Eine kleine Attrappe des Supabase-Clients fuer Tests des Geldwegs.
 *
 * Der echte Client wird als fluent Builder benutzt
 * (`from(t).update(x).eq(...).is(...).select()` und am Ende `await`). Die
 * Attrappe zeichnet jeden Aufruf auf und beantwortet ihn aus einem
 * Skript: pro Tabelle eine Funktion, die Operation, Nutzlast und Filter
 * bekommt und `{ data, error }` liefert. `rpc` ebenso. Nichts hier kennt SQL —
 * getestet wird, **was** der Code an die Datenbank schickt und wie er auf
 * ihre Antworten reagiert, nicht die Datenbank selbst.
 */

export interface Call {
  table: string;
  op: "select" | "insert" | "update" | "upsert" | "delete";
  payload?: unknown;
  filters: { kind: string; args: unknown[] }[];
  options?: unknown;
}

export interface RpcCall {
  name: string;
  args: unknown;
}

type Answer = { data?: unknown; error?: { code?: string; message: string } | null; count?: number | null };
type TableHandler = (call: Call) => Answer | undefined;
type RpcHandler = (name: string, args: unknown) => Answer | undefined;

export interface FakeDb {
  from: (table: string) => Builder;
  rpc: (name: string, args?: unknown) => PromiseLike<Answer>;
  calls: Call[];
  rpcCalls: RpcCall[];
  auth: { getUser: (token: string) => Promise<{ data: { user: unknown }; error: null }> };
}

class Builder implements PromiseLike<Answer> {
  private call: Call;
  private wantSingle = false;
  constructor(private db: FakeDbImpl, table: string) {
    this.call = { table, op: "select", filters: [] };
  }
  select(_cols?: string, options?: unknown) {
    if (this.call.op === "select") this.call.options = options;
    // `.insert(...).select()` keeps the write op; a bare select is a read.
    return this;
  }
  insert(payload: unknown) { this.call.op = "insert"; this.call.payload = payload; return this; }
  update(payload: unknown) { this.call.op = "update"; this.call.payload = payload; return this; }
  upsert(payload: unknown, options?: unknown) { this.call.op = "upsert"; this.call.payload = payload; this.call.options = options; return this; }
  delete() { this.call.op = "delete"; return this; }
  eq(...args: unknown[]) { this.call.filters.push({ kind: "eq", args }); return this; }
  neq(...args: unknown[]) { this.call.filters.push({ kind: "neq", args }); return this; }
  is(...args: unknown[]) { this.call.filters.push({ kind: "is", args }); return this; }
  in(...args: unknown[]) { this.call.filters.push({ kind: "in", args }); return this; }
  not(...args: unknown[]) { this.call.filters.push({ kind: "not", args }); return this; }
  or(...args: unknown[]) { this.call.filters.push({ kind: "or", args }); return this; }
  gte(...args: unknown[]) { this.call.filters.push({ kind: "gte", args }); return this; }
  lte(...args: unknown[]) { this.call.filters.push({ kind: "lte", args }); return this; }
  lt(...args: unknown[]) { this.call.filters.push({ kind: "lt", args }); return this; }
  gt(...args: unknown[]) { this.call.filters.push({ kind: "gt", args }); return this; }
  ilike(...args: unknown[]) { this.call.filters.push({ kind: "ilike", args }); return this; }
  order() { return this; }
  limit() { return this; }
  maybeSingle() { this.wantSingle = true; return this; }
  single() { this.wantSingle = true; return this; }
  then<R1 = Answer, R2 = never>(
    onfulfilled?: ((value: Answer) => R1 | PromiseLike<R1>) | null,
    onrejected?: ((reason: unknown) => R2 | PromiseLike<R2>) | null,
  ): PromiseLike<R1 | R2> {
    this.db.calls.push(this.call);
    const handler = this.db.tables[this.call.table];
    const answer = handler?.(this.call) ?? { data: this.wantSingle ? null : [], error: null };
    const normalized: Answer = { data: answer.data ?? (this.wantSingle ? null : []), error: answer.error ?? null, count: answer.count ?? null };
    return Promise.resolve(normalized).then(onfulfilled, onrejected);
  }
}

class FakeDbImpl implements FakeDb {
  calls: Call[] = [];
  rpcCalls: RpcCall[] = [];
  auth = { getUser: async () => ({ data: { user: null }, error: null }) };
  constructor(public tables: Record<string, TableHandler>, private rpcHandler: RpcHandler = () => undefined) {}
  from(table: string): Builder { return new Builder(this, table); }
  rpc(name: string, args?: unknown): PromiseLike<Answer> {
    this.rpcCalls.push({ name, args });
    const answer = this.rpcHandler(name, args) ?? { data: null, error: null };
    return Promise.resolve({ data: answer.data ?? null, error: answer.error ?? null });
  }
}

export function fakeDb(tables: Record<string, TableHandler>, rpc?: RpcHandler): FakeDb {
  return new FakeDbImpl(tables, rpc);
}

/** Filter-Wert eines Aufrufs, z. B. `eqValue(call, "id")`. */
export function eqValue(call: Call, column: string): unknown {
  return call.filters.find((f) => f.kind === "eq" && f.args[0] === column)?.args[1];
}
