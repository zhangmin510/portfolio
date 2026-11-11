import type { LocationId, TravelMode } from '../domain/types';

export interface RoutePoint {
  readonly x: number;
  readonly z: number;
}

type Bank = 'north' | 'south';

// These stops sit on the streets in city.ts, beside each venue's street frontage.
const stops: Record<LocationId, { x: number; bank: Bank }> = {
  home: { x: -13.4, bank: 'north' },
  office: { x: 13.2, bank: 'north' },
  cafe: { x: -9.8, bank: 'south' },
  store: { x: -21, bank: 'south' },
  park: { x: -11.7, bank: 'south' },
  makerspace: { x: 13.8, bank: 'south' },
};

// The two streets connect at the bridge. Vehicles stay clear of the parked
// car on the west side of the approach. Walkers use the outside road edge.
const vehicleLane = { north: -5.2, south: 12.9, bridgeX: 0.35 };
const walkingLane = { north: -5.75, south: 13.65, bridgeX: 1.65 };

export function getTravelPath(from: LocationId, to: LocationId, mode: TravelMode): readonly RoutePoint[] {
  const origin = stops[from];
  const destination = stops[to];
  const lane = mode === 'walk' ? walkingLane : vehicleLane;
  const start = { x: origin.x, z: lane[origin.bank] };
  const finish = { x: destination.x, z: lane[destination.bank] };

  if (from === to) return [start];
  if (origin.bank === destination.bank) return [start, finish];

  return [
    start,
    { x: lane.bridgeX, z: start.z },
    { x: lane.bridgeX, z: finish.z },
    finish,
  ];
}
