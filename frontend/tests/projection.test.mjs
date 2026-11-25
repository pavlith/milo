import assert from "node:assert/strict";
import test from "node:test";
import { connectProjection } from "../src/lib/modules/projection.ts";

const flush = () => new Promise((resolve) => setImmediate(resolve));

test("snapshot and live events reconcile without rendering duplicate deltas", async () => {
    let complete;
    let receive;
    let value;
    let disposed = false;
    const applied = [];
    const stop = connectProjection(
        () => new Promise((resolve) => (complete = resolve)),
        (handler) => {
            receive = handler;
            return () => (disposed = true);
        },
        (current, delta) => ({ revision: delta.revision, entries: [...current.entries, delta.entry] }),
        (state) => (value = state.value),
        (delta) => applied.push(delta.entry)
    );
    receive({ revision: 2, entry: "two" });
    receive({ revision: 1, entry: "one" });
    complete({ revision: 1, entries: ["one"] });
    await flush();
    receive({ revision: 2, entry: "duplicate" });
    assert.deepEqual(value, { revision: 2, entries: ["one", "two"] });
    assert.deepEqual(applied, ["two"]);
    stop();
    assert.equal(disposed, true);
    receive({ revision: 3, entry: "late" });
    assert.equal(value.revision, 2);
});

test("a missing revision triggers a fresh snapshot", async () => {
    let receive;
    let value;
    const snapshots = [{ revision: 0 }, { revision: 3 }];
    const stop = connectProjection(
        async () => snapshots.shift(),
        (handler) => {
            receive = handler;
            return () => {};
        },
        (_, delta) => delta,
        (state) => (value = state.value)
    );
    await flush();
    receive({ revision: 3 });
    await flush();
    assert.equal(value.revision, 3);
    stop();
});
