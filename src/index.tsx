import {
  registerRoute,
  registerSidebarEntry,
} from '@kinvolk/headlamp-plugin/lib';
import React from 'react';
import PolarisView from './components/PolarisView';

registerSidebarEntry({
  parent: null,
  name: 'polaris',
  label: 'Polaris',
  url: '/polaris',
  icon: 'mdi:shield-check',
});

registerRoute({
  path: '/polaris',
  sidebar: 'polaris',
  name: 'polaris',
  exact: true,
  component: () => <PolarisView />,
});
