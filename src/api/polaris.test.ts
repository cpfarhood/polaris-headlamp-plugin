import { describe, expect, it, vi } from 'vitest';

vi.mock('@kinvolk/headlamp-plugin/lib', () => ({
  ApiProxy: { request: vi.fn() },
}));

import {
  AuditData,
  computeScore,
  countResults,
  countResultsForItems,
  filterResultsByNamespace,
  getNamespaces,
  Result,
  ResultCounts,
} from './polaris';

// --- Fixtures ---

function makeResult(overrides: Partial<Result> = {}): Result {
  return {
    Name: 'my-deploy',
    Namespace: 'default',
    Kind: 'Deployment',
    Results: {},
    CreatedTime: '2025-01-01T00:00:00Z',
    ...overrides,
  };
}

function makeAuditData(results: Result[]): AuditData {
  return {
    PolarisOutputVersion: '1.0',
    AuditTime: '2025-01-01T00:00:00Z',
    SourceType: 'Cluster',
    SourceName: 'test',
    DisplayName: 'test',
    ClusterInfo: { Version: '1.28', Nodes: 3, Pods: 10, Namespaces: 2, Controllers: 5 },
    Results: results,
  };
}

// --- computeScore ---

describe('computeScore', () => {
  it('returns 0 when total is 0', () => {
    const counts: ResultCounts = { total: 0, pass: 0, warning: 0, danger: 0, skipped: 0 };
    expect(computeScore(counts)).toBe(0);
  });

  it('returns 100 when all checks pass', () => {
    const counts: ResultCounts = { total: 10, pass: 10, warning: 0, danger: 0, skipped: 0 };
    expect(computeScore(counts)).toBe(100);
  });

  it('rounds to nearest integer', () => {
    const counts: ResultCounts = { total: 3, pass: 1, warning: 1, danger: 1, skipped: 0 };
    expect(computeScore(counts)).toBe(33);
  });

  it('includes skipped in total denominator', () => {
    const counts: ResultCounts = { total: 10, pass: 5, warning: 2, danger: 1, skipped: 2 };
    expect(computeScore(counts)).toBe(50);
  });
});

// --- countResults / countResultsForItems ---

describe('countResults', () => {
  it('returns zero counts for empty results', () => {
    const data = makeAuditData([]);
    const counts = countResults(data);
    expect(counts).toEqual({ total: 0, pass: 0, warning: 0, danger: 0, skipped: 0 });
  });

  it('counts top-level result set entries', () => {
    const result = makeResult({
      Results: {
        check1: {
          ID: 'check1',
          Message: 'ok',
          Details: [],
          Success: true,
          Severity: 'warning',
          Category: 'Security',
        },
        check2: {
          ID: 'check2',
          Message: 'bad',
          Details: [],
          Success: false,
          Severity: 'danger',
          Category: 'Security',
        },
      },
    });
    const counts = countResults(makeAuditData([result]));
    expect(counts.total).toBe(2);
    expect(counts.pass).toBe(1);
    expect(counts.danger).toBe(1);
    expect(counts.warning).toBe(0);
    expect(counts.skipped).toBe(0);
  });

  it('counts skipped (severity=ignore, success=false) entries', () => {
    const result = makeResult({
      Results: {
        skipped1: {
          ID: 'skipped1',
          Message: 'skipped',
          Details: [],
          Success: false,
          Severity: 'ignore',
          Category: 'Security',
        },
      },
    });
    const counts = countResults(makeAuditData([result]));
    expect(counts.total).toBe(1);
    expect(counts.skipped).toBe(1);
    expect(counts.pass).toBe(0);
  });

  it('counts PodResult and ContainerResults', () => {
    const result = makeResult({
      Results: {
        top: {
          ID: 'top',
          Message: 'ok',
          Details: [],
          Success: true,
          Severity: 'warning',
          Category: 'Reliability',
        },
      },
      PodResult: {
        Name: 'pod-1',
        Results: {
          podCheck: {
            ID: 'podCheck',
            Message: 'warn',
            Details: [],
            Success: false,
            Severity: 'warning',
            Category: 'Reliability',
          },
        },
        ContainerResults: [
          {
            Name: 'container-1',
            Results: {
              containerCheck: {
                ID: 'containerCheck',
                Message: 'danger',
                Details: [],
                Success: false,
                Severity: 'danger',
                Category: 'Security',
              },
            },
          },
        ],
      },
    });
    const counts = countResults(makeAuditData([result]));
    expect(counts.total).toBe(3);
    expect(counts.pass).toBe(1);
    expect(counts.warning).toBe(1);
    expect(counts.danger).toBe(1);
  });

  it('aggregates across multiple results', () => {
    const r1 = makeResult({
      Name: 'deploy-a',
      Results: {
        c1: {
          ID: 'c1',
          Message: '',
          Details: [],
          Success: true,
          Severity: 'warning',
          Category: 'X',
        },
      },
    });
    const r2 = makeResult({
      Name: 'deploy-b',
      Results: {
        c2: {
          ID: 'c2',
          Message: '',
          Details: [],
          Success: false,
          Severity: 'warning',
          Category: 'X',
        },
      },
    });
    const counts = countResults(makeAuditData([r1, r2]));
    expect(counts.total).toBe(2);
    expect(counts.pass).toBe(1);
    expect(counts.warning).toBe(1);
  });
});

describe('countResultsForItems', () => {
  it('works on a subset of results', () => {
    const results: Result[] = [
      makeResult({
        Results: {
          a: {
            ID: 'a',
            Message: '',
            Details: [],
            Success: false,
            Severity: 'danger',
            Category: 'X',
          },
        },
      }),
    ];
    const counts = countResultsForItems(results);
    expect(counts.danger).toBe(1);
    expect(counts.total).toBe(1);
  });
});

// --- getNamespaces ---

describe('getNamespaces', () => {
  it('returns empty array for no results', () => {
    expect(getNamespaces(makeAuditData([]))).toEqual([]);
  });

  it('returns sorted unique namespaces', () => {
    const data = makeAuditData([
      makeResult({ Namespace: 'beta' }),
      makeResult({ Namespace: 'alpha' }),
      makeResult({ Namespace: 'beta' }),
      makeResult({ Namespace: 'gamma' }),
    ]);
    expect(getNamespaces(data)).toEqual(['alpha', 'beta', 'gamma']);
  });
});

// --- filterResultsByNamespace ---

describe('filterResultsByNamespace', () => {
  it('returns only results matching the namespace', () => {
    const data = makeAuditData([
      makeResult({ Name: 'a', Namespace: 'ns1' }),
      makeResult({ Name: 'b', Namespace: 'ns2' }),
      makeResult({ Name: 'c', Namespace: 'ns1' }),
    ]);
    const filtered = filterResultsByNamespace(data, 'ns1');
    expect(filtered).toHaveLength(2);
    expect(filtered.map(r => r.Name)).toEqual(['a', 'c']);
  });

  it('returns empty array for non-existent namespace', () => {
    const data = makeAuditData([makeResult({ Namespace: 'ns1' })]);
    expect(filterResultsByNamespace(data, 'ns-missing')).toEqual([]);
  });
});
