import { CRISISNET_MESH_SERVICE_UUID } from '../src/mesh/core/crisisNetBleConstants.js';

describe('crisisNetBleConstants', () => {
  it('matches Android CrisisNetBleDiscovery.SERVICE_UUID', () => {
    expect(CRISISNET_MESH_SERVICE_UUID.toLowerCase()).toBe(
      'c4a2f9e1-8b5c-4d3a-9f2e-0c7d8e9f1a2b',
    );
  });
});
