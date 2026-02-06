import { Loader, SectionBox, SectionHeader } from '@kinvolk/headlamp-plugin/lib/CommonComponents';
import React from 'react';
import {
  AuditData,
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

function RefreshSettings(props: { interval: number; onChange: (seconds: number) => void }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
      <label htmlFor="polaris-refresh-interval">Refresh interval:</label>
      <select
        id="polaris-refresh-interval"
        value={props.interval}
        onChange={e => props.onChange(Number(e.target.value))}
      >
        {INTERVAL_OPTIONS.map(opt => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}

function StatCard(props: { label: string; value: number; color?: string }) {
  return (
    <div
      style={{
        padding: '16px 24px',
        textAlign: 'center',
        minWidth: '120px',
      }}
    >
      <div
        style={{
          fontSize: '2rem',
          fontWeight: 'bold',
          color: props.color,
        }}
      >
        {props.value}
      </div>
      <div style={{ fontSize: '0.875rem', opacity: 0.8 }}>{props.label}</div>
    </div>
  );
}

function ScoreBadge(props: { score: number }) {
  const color = props.score >= 80 ? '#4caf50' : props.score >= 50 ? '#ff9800' : '#f44336';
  return (
    <div style={{ textAlign: 'center', marginBottom: '16px' }}>
      <div style={{ fontSize: '3rem', fontWeight: 'bold', color }}>{props.score}%</div>
      <div style={{ fontSize: '0.875rem', opacity: 0.8 }}>Cluster Score</div>
    </div>
  );
}

function OverviewSection(props: { data: AuditData; counts: ResultCounts }) {
  return (
    <>
      <SectionBox title="Score">
        <ScoreBadge score={props.data.Score} />
      </SectionBox>
      <SectionBox title="Check Summary">
        <div
          style={{
            display: 'flex',
            justifyContent: 'center',
            flexWrap: 'wrap',
            gap: '16px',
          }}
        >
          <StatCard label="Total" value={props.counts.total} />
          <StatCard label="Pass" value={props.counts.pass} color="#4caf50" />
          <StatCard label="Warning" value={props.counts.warning} color="#ff9800" />
          <StatCard label="Danger" value={props.counts.danger} color="#f44336" />
        </div>
      </SectionBox>
      <SectionBox title="Cluster Info">
        <div
          style={{
            display: 'flex',
            justifyContent: 'center',
            flexWrap: 'wrap',
            gap: '16px',
          }}
        >
          <StatCard label="Nodes" value={props.data.ClusterInfo.Nodes} />
          <StatCard label="Pods" value={props.data.ClusterInfo.Pods} />
          <StatCard label="Namespaces" value={props.data.ClusterInfo.Namespaces} />
          <StatCard label="Controllers" value={props.data.ClusterInfo.Controllers} />
        </div>
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
          <div style={{ padding: '16px', color: '#f44336' }}>{error}</div>
        </SectionBox>
      )}

      {data && counts && <OverviewSection data={data} counts={counts} />}

      {!data && !error && (
        <SectionBox title="No Data">
          <div style={{ padding: '16px' }}>No Polaris audit results found.</div>
        </SectionBox>
      )}
    </>
  );
}
