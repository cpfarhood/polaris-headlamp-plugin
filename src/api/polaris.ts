import { K8s } from '@kinvolk/headlamp-plugin/lib';
import React from 'react';

// --- Polaris AuditData schema (matches pkg/validator/output.go) ---

type Severity = 'ignore' | 'warning' | 'danger';

interface ResultMessage {
  ID: string;
  Message: string;
  Details: string[];
  Success: boolean;
  Severity: Severity;
  Category: string;
}

type ResultSet = Record<string, ResultMessage>;

interface ContainerResult {
  Name: string;
  Results: ResultSet;
}

interface PodResult {
  Name: string;
  Results: ResultSet;
  ContainerResults: ContainerResult[];
}

export interface Result {
  Name: string;
  Namespace: string;
  Kind: string;
  Results: ResultSet;
  PodResult?: PodResult;
  CreatedTime: string;
}

interface ClusterInfo {
  Version: string;
  Nodes: number;
  Pods: number;
  Namespaces: number;
  Controllers: number;
}

export interface AuditData {
  PolarisOutputVersion: string;
  AuditTime: string;
  SourceType: string;
  SourceName: string;
  DisplayName: string;
  ClusterInfo: ClusterInfo;
  Results: Result[];
  Score: number;
}

// --- Result counting ---

export interface ResultCounts {
  total: number;
  pass: number;
  warning: number;
  danger: number;
}

function countResultSet(rs: ResultSet, counts: ResultCounts): void {
  for (const key of Object.keys(rs)) {
    const msg = rs[key];
    counts.total++;
    if (msg.Success) {
      counts.pass++;
    } else if (msg.Severity === 'warning') {
      counts.warning++;
    } else if (msg.Severity === 'danger') {
      counts.danger++;
    }
  }
}

export function countResults(data: AuditData): ResultCounts {
  const counts: ResultCounts = { total: 0, pass: 0, warning: 0, danger: 0 };
  for (const result of data.Results) {
    countResultSet(result.Results, counts);
    if (result.PodResult) {
      countResultSet(result.PodResult.Results, counts);
      for (const container of result.PodResult.ContainerResults) {
        countResultSet(container.Results, counts);
      }
    }
  }
  return counts;
}

// --- Settings ---

const STORAGE_KEY = 'polaris-plugin-refresh-interval';
const DEFAULT_INTERVAL_SECONDS = 300; // 5 minutes

export function getRefreshInterval(): number {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored !== null) {
    const parsed = parseInt(stored, 10);
    if (!isNaN(parsed) && parsed > 0) {
      return parsed;
    }
  }
  return DEFAULT_INTERVAL_SECONDS;
}

export function setRefreshInterval(seconds: number): void {
  localStorage.setItem(STORAGE_KEY, String(seconds));
}

// --- Data fetching hook ---

interface PolarisDataState {
  data: AuditData | null;
  loading: boolean;
  error: string | null;
}

export function usePolarisData(refreshIntervalSeconds: number): PolarisDataState {
  const [configMap, fetchError] = K8s.ResourceClasses.ConfigMap.useGet(
    'polaris-dashboard',
    'polaris'
  );
  const [cachedData, setCachedData] = React.useState<AuditData | null>(null);
  const [parseError, setParseError] = React.useState<string | null>(null);
  const [lastFetchTime, setLastFetchTime] = React.useState<number>(0);
  const [, setTick] = React.useState(0);

  // Parse ConfigMap data when it arrives
  React.useEffect(() => {
    if (!configMap) {
      return;
    }
    const dataMap = configMap.data as Record<string, string> | undefined;
    const raw = dataMap?.['dashboard.json'];
    if (!raw) {
      setParseError('ConfigMap exists but dashboard.json key is missing.');
      return;
    }
    try {
      const parsed: AuditData = JSON.parse(raw);
      setCachedData(parsed);
      setParseError(null);
      setLastFetchTime(Date.now());
    } catch {
      setParseError('Failed to parse dashboard.json: malformed JSON.');
    }
  }, [configMap]);

  // Periodic refresh via re-render trigger
  React.useEffect(() => {
    if (refreshIntervalSeconds <= 0) {
      return;
    }
    const intervalId = window.setInterval(() => {
      setTick((t) => t + 1);
    }, refreshIntervalSeconds * 1000);
    return () => window.clearInterval(intervalId);
  }, [refreshIntervalSeconds]);

  // Determine error state
  if (fetchError) {
    const status = (fetchError as { status?: number }).status;
    if (status === 403) {
      return {
        data: cachedData,
        loading: false,
        error:
          'Access denied (403). Check that your RBAC permissions allow reading ConfigMaps in the polaris namespace.',
      };
    }
    if (status === 404) {
      return {
        data: cachedData,
        loading: false,
        error:
          'Polaris dashboard ConfigMap not found (404). Ensure Polaris is installed in the polaris namespace.',
      };
    }
    return {
      data: cachedData,
      loading: false,
      error: `Failed to fetch Polaris data: ${String(fetchError)}`,
    };
  }

  if (parseError) {
    return { data: cachedData, loading: false, error: parseError };
  }

  const isLoading = !configMap && !fetchError;

  // Return cached data while loading if we have it
  if (isLoading && cachedData && lastFetchTime > 0) {
    return { data: cachedData, loading: false, error: null };
  }

  return {
    data: cachedData,
    loading: isLoading,
    error: null,
  };
}
