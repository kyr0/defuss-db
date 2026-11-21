"""Differential check of the proposed contract. Independent of defuss-db.

A dense grid represents each effective millisecond by a labeled cell. A second
model stores sorted change boundaries implicitly in a map. An independent scan
of all accepted interval assertions reconstructs the value at a past revision.
Small scalar payloads isolate interval and transaction semantics.
"""
from bisect import bisect_right
from copy import deepcopy
import json
from random import Random

HORIZON = 16
IDS = 3
SEED = 20261118
TRIALS = 48
TRANSACTIONS = 48


class Dense:
    def __init__(self):
        self.cells = [[(None, 0) for _ in range(HORIZON)] for _ in range(IDS)]

    def value(self, doc, at):
        return self.cells[doc][at][0]

    def write(self, doc, at, until, kind, amount, tag):
        cells = self.cells[doc]
        old, segment = cells[at]
        end = at + 1
        while end < HORIZON and cells[end][1] == segment:
            end += 1
        if until is not None and until > end:
            return 'range', None
        if kind == 'insert' and old is not None:
            return 'duplicate', None
        if kind in ('patch', 'delete') and old is None:
            return 'absent', None
        end = end if until is None else until
        value = None if kind == 'delete' else old + amount if kind == 'patch' else amount
        for i in range(at, end):
            cells[i] = value, tag
        return 'ok', (doc, at, end, value)


class Boundaries:
    def __init__(self):
        self.rows = [{0: None} for _ in range(IDS)]

    def value(self, doc, at):
        rows = self.rows[doc]
        keys = sorted(rows)
        return rows[keys[bisect_right(keys, at) - 1]]

    def write(self, doc, at, until, kind, amount, _tag):
        rows = self.rows[doc]
        keys = sorted(rows)
        right = bisect_right(keys, at)
        old = rows[keys[right - 1]]
        next_start = keys[right] if right < len(keys) else HORIZON
        if until is not None and until > next_start:
            return 'range', None
        if kind == 'insert' and old is not None:
            return 'duplicate', None
        if kind in ('patch', 'delete') and old is None:
            return 'absent', None
        stop = next_start if until is None else until
        if stop < next_start:
            rows[stop] = old
        if kind == 'patch':
            value = old + amount
        elif kind == 'delete':
            value = None
        else:
            value = amount
        rows[at] = value
        return 'ok', (doc, at, stop, value)


def audit_value(assertions, doc, at, as_of):
    for revision, row_id, start, end, value in reversed(assertions):
        if revision <= as_of and row_id == doc and start <= at < end:
            return value
    return None


def main():
    rng = Random(SEED)
    staged_checks = audit_checks = total_commits = total_rollbacks = 0
    reasons = dict(range=0, duplicate=0, absent=0, ok=0)
    for _ in range(TRIALS):
        dense = Dense()
        boundaries = Boundaries()
        snapshots = [deepcopy(dense)]
        log = []
        for sequence in range(1, TRANSACTIONS + 1):
            d = deepcopy(dense)
            b = deepcopy(boundaries)
            staged = []
            rejected = False
            for ordinal in range(rng.randint(1, 3)):
                doc = rng.randrange(IDS)
                at = rng.randrange(HORIZON)
                until = rng.randint(at + 1, HORIZON) if rng.randrange(4) == 0 else None
                args = (doc, at, until, rng.choice(('put', 'patch', 'delete', 'insert')),
                        rng.randrange(1, 5), 4 * sequence + ordinal)
                result, record = d.write(*args)
                assert (result, record) == b.write(*args)
                reasons[result] += 1
                if result in ('duplicate', 'range'):
                    rejected = True
                    break
                if record is not None:
                    staged.append(record)
                for k in range(IDS):
                    for t in range(HORIZON):
                        assert d.value(k, t) == b.value(k, t)
                        staged_checks += 1
            if rejected or rng.randrange(9) == 0:
                total_rollbacks += 1
            elif staged:
                revision = len(snapshots)
                dense, boundaries = d, b
                snapshots.append(deepcopy(dense))
                log.extend((revision, *record) for record in staged)
                total_commits += 1
        for revision, snapshot in enumerate(snapshots):
            for k in range(IDS):
                for t in range(HORIZON):
                    assert snapshot.value(k, t) == audit_value(log, k, t, revision)
                    audit_checks += 1
    print(json.dumps(dict(seed=SEED, trials=TRIALS, attemptedTransactions=TRIALS * TRANSACTIONS,
                          committedNonemptyTransactions=total_commits, rolledBackTransactions=total_rollbacks,
                          stagingCellComparisons=staged_checks, recordedCutoffCellComparisons=audit_checks,
                          checkedOperationOutcomes=reasons), indent=2))


if __name__ == '__main__':
    main()
