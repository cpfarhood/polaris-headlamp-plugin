import {
  HeaderLabel,
  Loader,
  NameValueTable,
  SectionBox,
  SectionHeader,
  StatusLabel,
} from '@kinvolk/headlamp-plugin/lib/CommonComponents';
import React from 'react';
import {
  AuditData,
  computeScore,
  countResults,
  getRefreshInterval,
  ResultCounts,
  setRefreshInterval,
  usePolarisData,
} from '../api/polaris';

const INTERVAL_OPTIONS = [
  { label: '1 minute', value: 60 },
  { label: '5 minutes', value: 300 },
  { label: '10 minutes', value: 600 },
  { label: '30 minutes', value: 1800 },
];

function scoreStatus(score: number): 'success' | 'warning' | 'error' {
  if (score >= 80) return 'success';
  if (score >= 50) return 'warning';
  return 'error';
}

function RefreshSettings(props: { interval: number; onChange: (seconds: number) => void }) {
  return (
    <HeaderLabel
      label="Refresh interval"
      value={INTERVAL_OPTIONS.find(o => o.value === props.interval)?.label ?? ''}
    />
  );
}

function OverviewSection(props: { data: AuditData; counts: ResultCounts }) {
  const score = computeScore(props.counts);
  const status = scoreStatus(score);

  return (
    <>
      <SectionBox title="Score">
        <NameValueTable
          rows={[
            {
              name: 'Cluster Score',
              value: (
                <StatusLabel status={status}>
                  {score}%
                </StatusLabel>
              ),
            },
          ]}
        />
      </SectionBox>
      <SectionBox title="Check Summary">
        <NameValueTable
          rows={[
            { name: 'Total Checks', value: String(props.counts.total) },
            {
              name: 'Pass',
              value: (
                <StatusLabel status="success">
                  {props.counts.pass}
                </StatusLabel>
              ),
            },
            {
              name: 'Warning',
              value: (
                <StatusLabel status="warning">
                  {props.counts.warning}
                </StatusLabel>
              ),
            },
            {
              name: 'Danger',
              value: (
                <StatusLabel status="error">
                  {props.counts.danger}
                </StatusLabel>
              ),
            },
          ]}
        />
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

export default function PolarisView() {
  const [interval, setInterval] = React.useState(getRefreshInterval);

  function handleIntervalChange(seconds: number) {
    setInterval(seconds);
    setRefreshInterval(seconds);
  }

  const { data, loading, error } = usePolarisData(interval);

  if (loading) {
    return <Loader title="Loading Polaris audit data..." />;
  }

  const counts = data ? countResults(data) : null;

  return (
    <>
      <SectionHeader
        title="Polaris"
        actions={[
          <RefreshSettings key="refresh" interval={interval} onChange={handleIntervalChange} />,
        ]}
      />

      {error && (
        <SectionBox title="Error">
          <NameValueTable
            rows={[
              {
                name: 'Status',
                value: (
                  <StatusLabel status="error">
                    {error}
                  </StatusLabel>
                ),
              },
            ]}
          />
        </SectionBox>
      )}

      {data && counts && <OverviewSection data={data} counts={counts} />}

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
