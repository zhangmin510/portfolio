import { describe, expect, it } from 'vitest';
import type { LocationId, TravelMode } from '../domain/types';
import { getTravelPath } from './travelRoutes';

const locations: LocationId[] = ['home', 'office', 'cafe', 'store', 'park', 'makerspace'];
const modes: TravelMode[] = ['drive', 'transit', 'walk'];

describe('city travel routes', () => {
  it('connects all locations along the streets and uses the bridge for river crossings', () => {
    for (const mode of modes) {
      for (const from of locations) {
        for (const to of locations) {
          if (from === to) continue;
          const path = getTravelPath(from, to, mode);
          expect(path[0]).toEqual(getTravelPath(from, from, mode)[0]);
          expect(path.at(-1)).toEqual(getTravelPath(to, to, mode)[0]);

          for (let index = 1; index < path.length; index++) {
            const start = path[index - 1];
            const end = path[index];
            expect(start).not.toEqual(end);
            if (start.z === end.z) {
              const onNorthStreet = start.z >= -6.35 && start.z <= -4.05;
              const onSouthStreet = start.z >= 11.75 && start.z <= 14.05;
              expect(onNorthStreet || onSouthStreet).toBe(true);
            } else {
              expect(start.x).toBe(end.x);
              expect(Math.abs(start.x)).toBeLessThan(2.35);
              expect(start.z * end.z).toBeLessThan(0);
            }
          }
        }
      }
    }
  });

  it('keeps pedestrians away from the vehicle line on the bridge', () => {
    const drive = getTravelPath('home', 'makerspace', 'drive');
    const walk = getTravelPath('home', 'makerspace', 'walk');
    expect(Math.abs(drive[1].x - walk[1].x)).toBeGreaterThan(1);
    expect(walk[1].z).not.toBe(drive[1].z);
  });
});
