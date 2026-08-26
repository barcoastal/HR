import { nameKeys, normalizeEmail, normalizePhone } from "./normalize";
import { refKey, type DetectedGroup, type ExistingEmployeeLite, type GroupReason, type MemberRef, type RowLite } from "./types";

type Node = { ref: MemberRef; rowNumber: number; email: string; phone: string; names: string[] };

const REASON_ORDER: GroupReason[] = ["email", "phone", "name"];

export function groupKey(members: MemberRef[]): string {
  return members.map(refKey).sort().join("|");
}

/** Order-independent key for a pair of employee ids — the shape stored in DuplicateDismissal. */
export function pairKey(a: string, b: string): string {
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}

export type DetectOptions = {
  /** Link existing employees with each other too (system-wide scan). Off for imports. */
  pairEmployees?: boolean;
  /** `pairKey`s of employee pairs the team has dismissed — never linked directly. */
  dismissedPairs?: Set<string>;
};

export function isStrongGroup(reasons: GroupReason[]): boolean {
  return reasons.includes("email") || reasons.includes("phone");
}

class UnionFind {
  private parent = new Map<string, string>();
  find(x: string): string {
    if (!this.parent.has(x)) this.parent.set(x, x);
    let root = x;
    while (this.parent.get(root) !== root) root = this.parent.get(root)!;
    let cur = x;
    while (this.parent.get(cur) !== root) { const next = this.parent.get(cur)!; this.parent.set(cur, root); cur = next; }
    return root;
  }
  union(a: string, b: string) { this.parent.set(this.find(a), this.find(b)); }
}

/**
 * Cluster file rows with each other and with existing employees when they share a
 * normalized email, a phone number, or a name. By default existing employees never
 * pair with each other directly — only rows introduce links; `pairEmployees` turns
 * employee↔employee links on (minus `dismissedPairs`) for the system-wide scan.
 */
export function detectDuplicates(rows: RowLite[], employees: ExistingEmployeeLite[], opts: DetectOptions = {}): DetectedGroup[] {
  const pairEmployees = opts.pairEmployees ?? false;
  const dismissed = opts.dismissedPairs ?? new Set<string>();
  const nodes: Node[] = [];
  for (const r of rows) {
    nodes.push({
      ref: { kind: "row", id: r.id },
      rowNumber: r.rowNumber,
      email: normalizeEmail(r.data.email),
      phone: normalizePhone(r.data.phone),
      names: nameKeys(r.data.firstName, r.data.lastName, r.data.preferredName),
    });
  }
  for (const e of employees) {
    nodes.push({
      ref: { kind: "employee", id: e.id },
      rowNumber: Number.MAX_SAFE_INTEGER,
      email: normalizeEmail(e.email),
      phone: normalizePhone(e.phone),
      names: nameKeys(e.firstName, e.lastName, e.preferredName),
    });
  }

  const byKey = new Map<string, Node[]>();
  const add = (reason: GroupReason, key: string, node: Node) => {
    if (!key) return;
    const k = `${reason}:${key}`;
    const arr = byKey.get(k) ?? [];
    arr.push(node);
    byKey.set(k, arr);
  };
  for (const n of nodes) {
    add("email", n.email, n);
    add("phone", n.phone, n);
    for (const nk of n.names) add("name", nk, n);
  }

  const uf = new UnionFind();
  const linked = new Set<string>();
  const pairReasons: { a: Node; reason: GroupReason }[] = [];
  for (const [k, bucket] of byKey) {
    if (bucket.length < 2) continue;
    const reason = k.split(":")[0] as GroupReason;
    for (let i = 0; i < bucket.length; i++) {
      for (let j = i + 1; j < bucket.length; j++) {
        const a = bucket[i], b = bucket[j];
        if (a.ref.kind === "employee" && b.ref.kind === "employee") {
          if (!pairEmployees || dismissed.has(pairKey(a.ref.id, b.ref.id))) continue;
        }
        uf.union(refKey(a.ref), refKey(b.ref));
        linked.add(refKey(a.ref));
        linked.add(refKey(b.ref));
        pairReasons.push({ a, reason });
      }
    }
  }

  const membersByRoot = new Map<string, Node[]>();
  for (const n of nodes) {
    const key = refKey(n.ref);
    if (!linked.has(key)) continue;
    const root = uf.find(key);
    const arr = membersByRoot.get(root) ?? [];
    arr.push(n);
    membersByRoot.set(root, arr);
  }
  const reasonsByRoot = new Map<string, Set<GroupReason>>();
  for (const p of pairReasons) {
    const root = uf.find(refKey(p.a.ref));
    const set = reasonsByRoot.get(root) ?? new Set<GroupReason>();
    set.add(p.reason);
    reasonsByRoot.set(root, set);
  }

  const rowNumberById = new Map(rows.map((r) => [r.id, r.rowNumber]));
  const groups: DetectedGroup[] = [];
  for (const [root, members] of membersByRoot) {
    if (members.length < 2) continue;
    const sorted = [...members].sort((a, b) => {
      if (a.ref.kind !== b.ref.kind) return a.ref.kind === "row" ? -1 : 1;
      if (a.rowNumber !== b.rowNumber) return a.rowNumber - b.rowNumber;
      return a.ref.id.localeCompare(b.ref.id);
    });
    const reasons = REASON_ORDER.filter((r) => reasonsByRoot.get(root)?.has(r));
    groups.push({ key: groupKey(sorted.map((m) => m.ref)), reasons, members: sorted.map((m) => m.ref) });
  }

  const minRow = (g: DetectedGroup) => {
    const first = g.members.find((m) => m.kind === "row");
    return first ? rowNumberById.get(first.id) ?? 0 : Number.MAX_SAFE_INTEGER;
  };
  groups.sort((a, b) => {
    const sa = isStrongGroup(a.reasons) ? 0 : 1;
    const sb = isStrongGroup(b.reasons) ? 0 : 1;
    if (sa !== sb) return sa - sb;
    if (minRow(a) !== minRow(b)) return minRow(a) - minRow(b);
    return a.key.localeCompare(b.key);
  });
  return groups;
}
