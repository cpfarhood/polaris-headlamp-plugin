import {
  registerPluginSettings,
  registerRoute,
  registerSidebarEntry,
} from '@kinvolk/headlamp-plugin/lib';
import React from 'react';
import { PolarisDataProvider } from './api/PolarisDataContext';
import DashboardView from './components/DashboardView';
import DynamicSidebarRegistrar from './components/DynamicSidebarRegistrar';
import NamespaceDetailView from './components/NamespaceDetailView';
import PolarisSettings from './components/PolarisSettings';

// --- Sidebar entries ---

registerSidebarEntry({
  parent: null,
  name: 'polaris',
  label: 'Polaris',
  url: '/polaris',
  icon: 'mdi:shield-check',
});

registerSidebarEntry({
  parent: 'polaris',
  name: 'polaris-overview',
  label: 'Overview',
  url: '/polaris',
  icon: 'mdi:view-dashboard',
});

registerSidebarEntry({
  parent: 'polaris',
  name: 'polaris-full',
  label: 'Full Audit',
  url: '/polaris/full-audit',
  icon: 'mdi:clipboard-text-search',
});

registerSidebarEntry({
  parent: 'polaris',
  name: 'polaris-namespaces',
  label: 'Namespaces',
  url: '/polaris',
  icon: 'mdi:dns',
});

// --- Routes ---

registerRoute({
  path: '/polaris',
  sidebar: 'polaris',
  name: 'polaris',
  exact: true,
  component: () => (
    <PolarisDataProvider>
      <DynamicSidebarRegistrar />
      <DashboardView includeSkipped={false} />
    </PolarisDataProvider>
  ),
});

registerRoute({
  path: '/polaris/full-audit',
  sidebar: 'polaris-full',
  name: 'polaris-full-audit',
  exact: true,
  component: () => (
    <PolarisDataProvider>
      <DynamicSidebarRegistrar />
      <DashboardView includeSkipped />
    </PolarisDataProvider>
  ),
});

registerRoute({
  path: '/polaris/ns/:namespace',
  sidebar: 'polaris',
  name: 'polaris-namespace',
  exact: true,
  component: () => (
    <PolarisDataProvider>
      <DynamicSidebarRegistrar />
      <NamespaceDetailView />
    </PolarisDataProvider>
  ),
});

registerPluginSettings('headlamp-polaris-plugin', PolarisSettings, true);
