// Run in an npm consumer with the v5.1.0 release tarball and defuss-dbsonl@0.6.0 installed.
// The probe creates one temporary directory and removes it after closing its database handles.
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir, platform, arch } from "node:os";
import { join } from "node:path";
import { openMemory } from "defuss-db";
import { openDirectory } from "defuss-db/server";
import { createMemoryBackend, openDbsonl } from "defuss-dbsonl";

const results = {
  runtime: process.version,
  platform: platform() + "-" + arch(),
};
const dir = await mkdtemp(join(tmpdir(), "defuss-temporal-research-"));
let disk, pinned, restored;
try {
  disk = await openDirectory(dir);
  const docs = disk.collection("plans");
  const date = new Date("2026-01-01T00:00:00.000Z");
  await docs.put({
    id: "P",
    price: 10,
    $trackHistory: "application data",
    $historic: date,
  });
  pinned = await disk.snapshot();
  await docs.update("P", { price: 30 });
  await disk.compact();
  await disk.collect();
  assert.equal((await pinned.collection("plans").get("P")).price, 10);
  const live = await docs.get("P");
  assert.equal(live.price, 30);
  assert.equal(live.$trackHistory, "application data");
  assert.equal(live.$historic.getTime(), date.getTime());
  results.pinnedDuringCompaction = {
    oldPrice: 10,
    currentPrice: 30,
    dollarFieldsRoundTrip: true,
  };
  const backup = await disk.export();
  await pinned.close();
  assert.throws(() => pinned.collection("plans"), { code: "CLOSED" });
  await disk.collect();
  await disk.close();
  disk = await openDirectory(dir);
  assert.equal((await disk.collection("plans").get("P")).price, 30);
  restored = await openMemory();
  await restored.import(backup);
  const restoredCollection = restored.collection("plans");
  assert.equal(await restoredCollection.count(), 1);
  assert.equal((await restoredCollection.get("P")).price, 30);
  results.afterReopenAndLogicalRestore = {
    reopenedPrice: 30,
    restoredPrice: 30,
    restoredDocuments: 1,
  };
} finally {
  await pinned?.close();
  await restored?.close();
  await disk?.close();
  await rm(dir, { recursive: true, force: true });
}

// Observe both omitted candidates and changed corpus statistics on the unmodified search engine.
const searchDb = await openMemory();
let priorSearch;
try {
  const docs = searchDb.collection("guides");
  await docs.insertMany([
    { id: "kept", body: "amber" },
    { id: "removed", body: "amber amber amber" },
  ]);
  await docs.createSearchIndex({
    name: "words",
    kind: "lexical",
    text: {
      analyzer: "unicode",
      ranking: "relevance",
      fields: { body: { path: "body" } },
    },
  });
  priorSearch = await searchDb.snapshot();
  await docs.delete("removed");
  await docs.insertMany(
    Array.from({ length: 6 }, (_, i) => ({ id: "later" + i, body: "ochre" })),
  );
  const then = (
    await priorSearch
      .collection("guides")
      .search("words", "amber", { limit: 10 })
  ).hits;
  const now = (await docs.search("words", "amber", { limit: 10 })).hits;
  assert(
    then.some((hit) => hit.id === "removed") &&
      !now.some((hit) => hit.id === "removed"),
  );
  const before = then.find((hit) => hit.id === "kept").score,
    after = now.find((hit) => hit.id === "kept").score;
  assert(Number.isFinite(before) && Number.isFinite(after) && before !== after);
  results.lexicalCorpusChange = {
    priorIds: then.map((hit) => hit.id),
    currentIds: now.map((hit) => hit.id),
    survivingId: "kept",
    priorScore: before,
    currentScore: after,
  };
} finally {
  await priorSearch?.close();
  await searchDb.close();
}

function latch() {
  let release;
  const ready = new Promise((resolve) => {
    release = resolve;
  });
  return { ready, release };
}
const raw = await openDbsonl(createMemoryBackend(), "history-probe", {
  create: true,
});
try {
  await raw.put("seed", "initial");
  const started = latch(),
    resume = latch();
  const delayed = raw.transaction(async (tx) => {
    const basis = tx.revision;
    await tx.get("A");
    started.release();
    await resume.ready;
    tx.put("A", "ordered after B");
    return basis;
  });
  await started.ready;
  const other = await raw.put("B", "disjoint");
  resume.release();
  const committed = await delayed;
  const actual = (await raw.get("A")).revision;
  assert(
    actual === committed.revision &&
      other.revision === committed.result + 1 &&
      actual > other.revision,
  );
  results.disjointCommit = {
    callbackBasis: committed.result,
    interveningRevision: other.revision,
    committedRevision: actual,
  };

  const scanned = latch(),
    continueScan = latch();
  const rangeWrite = raw.transaction(async (tx) => {
    for await (const row of tx.scan({ gte: "A", lt: "B", limit: 1 })) {
      assert.equal(row.key, "A");
    }
    scanned.release();
    await continueScan.ready;
    tx.put("A", "range write");
  });
  const rejected = assert.rejects(rangeWrite, { code: "CONFLICT" });
  await scanned.ready;
  await raw.put("Z", "outside the scanned range");
  continueScan.release();
  await rejected;
  assert.equal((await raw.get("A")).value, "ordered after B");
  results.rangeReadConflict = {
    interveningKeyOutsideRange: true,
    error: "CONFLICT",
  };
  await raw.compact();
  assert.equal((await raw.get("A")).revision, actual);
  results.compactedLiveKeyRetainsAssignedRevision = true;

  // A candidate key layout, exercised against the public forward-only scan.
  // Convert each operand before subtraction. The difference can exceed Number.MAX_SAFE_INTEGER.
  const maxDate = 8640000000000000n;
  const descending = (date) =>
    (maxDate - BigInt(date.getTime())).toString(16).padStart(16, "0");
  const prefix = "time:doc!";
  const exclusiveEnd = 'time:doc"';
  const boundaries = [
    -8640000000000000, -8639999999999999, -20, 0, 10, 90, 8639999999999999,
    8640000000000000,
  ];
  for (const ms of boundaries)
    await raw.put(prefix + descending(new Date(ms)), { value: ms });
  const dates = new Set([
    ...boundaries,
    -8639999999999998,
    -21,
    -19,
    -1,
    1,
    9,
    11,
    89,
    91,
    8639999999999998,
  ]);
  const reader = await raw.beginRead();
  try {
    for (const ms of dates) {
      const found = [];
      for await (const row of reader.scan({
        gte: prefix + descending(new Date(ms)),
        lt: exclusiveEnd,
        limit: 1,
      }))
        found.push(row.value.value);
      assert.deepEqual(found, [boundaries.filter((b) => b <= ms).at(-1)]);
    }
  } finally {
    await reader.close();
  }
  results.descendingDatePredecessor = {
    boundaryCount: boundaries.length,
    verifiedInstants: dates.size,
    includesBothDateExtremes: true,
  };
} finally {
  await raw.close();
}
console.log(JSON.stringify(results, null, 2));
