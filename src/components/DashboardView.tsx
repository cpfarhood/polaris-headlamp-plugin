import {
  Loader,
  NameValueTable,
  SectionBox,
  SectionHeader,
  StatusLabel,
} from '@kinvolk/headlamp-plugin/lib/CommonComponents';
import React from 'react';
import { AuditData, countResults, ResultCounts } from '../api/polaris';
import { usePolarisDataContext } from '../api/PolarisDataContext';

function scoreStatus(score: number): 'success' | 'warning' | 'error' {
  if (score >= 80) return 'success';
  if (score >= 50) return 'warning';
  return 'error';
}

function OverviewSection(props: {
  data: AuditData;
  counts: ResultCounts;
  includeSkipped: boolean;
}) {
  const { counts, includeSkipped } = props;

  const displayTotal = includeSkipped ? counts.total : counts.total - counts.skipped;
  const displayPass = counts.pass;
  const score = displayTotal === 0 ? 0 : Math.round((displayPass / displayTotal) * 100);
  const status = scoreStatus(score);

  const summaryRows: { name: string; value: React.ReactNode }[] = [
    { name: 'Total Checks', value: String(displayTotal) },
    {
      name: 'Pass',
      value: <StatusLabel status="success">{counts.pass}</StatusLabel>,
    },
    {
      name: 'Warning',
      value: <StatusLabel status="warning">{counts.warning}</StatusLabel>,
    },
    {
      name: 'Danger',
      value: <StatusLabel status="error">{counts.danger}</StatusLabel>,
    },
  ];

  if (includeSkipped) {
    summaryRows.push({
      name: 'Skipped',
      value: <StatusLabel status="">{counts.skipped}</StatusLabel>,
    });
  }

  return (
    <>
      <SectionBox title="Score">
        <NameValueTable
          rows={[
            {
              name: 'Cluster Score',
              value: <StatusLabel status={status}>{score}%</StatusLabel>,
            },
          ]}
        />
      </SectionBox>
      <SectionBox title="Check Summary">
        <NameValueTable rows={summaryRows} />
      </SectionBox>
      <SectionBox title="Cluster Info">
        <NameValueTable
          rows={[
            { name: 'Nodes', value: String(props.data.ClusterInfo.Nodes) },
            { name: 'Pods', value: String(props.data.ClusterInfo.Pods) },
            { name: 'Namespaces', value: String(props.data.ClusterInfo.Namespaces) },
            { name: 'Controllers', value: String(props.data.ClusterInfo.Controllers) },
          ]}
        />
      </SectionBox>
    </>
  );
}

export default function DashboardView(props: { includeSkipped: boolean }) {
  const { data, loading, error } = usePolarisDataContext();
  const title = props.includeSkipped ? 'Polaris — Full Audit' : 'Polaris — Overview';

  if (loading) {
    return <Loader title="Loading Polaris audit data..." />;
  }

  const counts = data ? countResults(data) : null;

  return (
    <>
      <SectionHeader title={title} />

      {error && (
        <SectionBox title="Error">
          <NameValueTable
            rows={[
              {
                name: 'Status',
                value: <StatusLabel status="error">{error}</StatusLabel>,
              },
            ]}
          />
        </SectionBox>
      )}

      {data && counts && (
        <OverviewSection data={data} counts={counts} includeSkipped={props.includeSkipped} />
      )}

      {!data && !error && (
        <SectionBox title="No Data">
          <NameValueTable
            rows={[
              {
                name: 'Status',
                value: 'No Polaris audit results found.',
              },
            ]}
          />
        </SectionBox>
      )}
    </>
  );
}
