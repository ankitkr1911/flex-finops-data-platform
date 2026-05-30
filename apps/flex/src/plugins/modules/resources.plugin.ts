import { consumeRows, definePlugin } from '../definePlugin';

export const resourcesPlugin = definePlugin({
  manifest: {
    id: 'flex.resources',
    name: 'Resources',
    version: '1.0.0',
    description: 'Allocation vs utilization by team (published to dhub-rpt)',
    route: '/resources',
    category: 'org',
    capabilities: { consume: true, produce: true, events: false },
    datasets: [
      {
        name: 'allocation_matrix',
        description: 'Resource pools with allocated vs used',
        schema: ['id', 'name', 'team', 'allocated', 'used', 'unit', 'trend'],
        direction: 'bidirectional',
      },
    ],
  },
  consume: (state, dataset) =>
    consumeRows(resourcesPlugin.manifest, state, dataset, () => state.resourceAllocations),
});
