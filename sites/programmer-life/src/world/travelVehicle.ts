import * as THREE from 'three';
import type { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import type { TravelMode } from '../domain/types';
import { CITY_BRIDGE } from './city';
import { makePerson } from './room';
import type { RoutePoint } from './travelRoutes';

export interface WorldTravel {
  path: readonly RoutePoint[];
  progress: () => number;
  mode: TravelMode;
}

interface TravelSample extends RoutePoint {
  distance: number;
  heading: number;
}

/** Sample by road distance so unequal segments don't change the travel speed. */
export function createTravelSampler(path: readonly RoutePoint[]) {
  const start = path[0] ?? { x: 0, z: 0 };
  const segments = path.slice(1).flatMap((point, index) => {
    const previous = path[index];
    const dx = point.x - previous.x;
    const dz = point.z - previous.z;
    const length = Math.hypot(dx, dz);
    return length > 0 ? [{ previous, dx, dz, length }] : [];
  });
  const total = segments.reduce((distance, segment) => distance + segment.length, 0);
  function positionAt(distance: number) {
    let remaining = distance;
    for (const [index, segment] of segments.entries()) {
      if (remaining < segment.length || index === segments.length - 1) {
        const fraction = remaining / segment.length;
        return {
          x: segment.previous.x + segment.dx * fraction,
          z: segment.previous.z + segment.dz * fraction,
        };
      }
      remaining -= segment.length;
    }
    return start;
  }

  return (progress: number): TravelSample => {
    const distance = total * THREE.MathUtils.clamp(Number.isFinite(progress) ? progress : 0, 0, 1);
    const before = positionAt(Math.max(0, distance - .7));
    const after = positionAt(Math.min(total, distance + .7));
    return {
      ...positionAt(distance),
      distance,
      heading: Math.atan2(after.x - before.x, after.z - before.z),
    };
  };
}

export function travelSurfaceHeight(x: number, z: number) {
  const { halfWidth, halfSpan, approachEnd, deckHeight, streetHeight } = CITY_BRIDGE;
  const distanceFromRiver = Math.abs(z);
  if (Math.abs(x) > halfWidth || distanceFromRiver >= approachEnd) return streetHeight;
  const approach = THREE.MathUtils.clamp((distanceFromRiver - halfSpan) / (approachEnd - halfSpan), 0, 1);
  return THREE.MathUtils.lerp(deckHeight, streetHeight, approach);
}

export interface TravelActor {
  group: THREE.Group;
  axleOffset?: number;
  pose: (distance: number, arrived: boolean, reduceMotion: boolean) => void;
}

export function createTravelActor(mode: TravelMode): TravelActor {
  if (mode === 'walk') {
    const group = makePerson();
    group.name = 'travel-pedestrian';
    const limbs = [['leftLeg', 1], ['rightLeg', -1], ['leftArm', -1], ['rightArm', 1]] as const;
    return {
      group,
      pose: (distance, arrived, reduceMotion) => {
        const stride = arrived || reduceMotion ? 0 : Math.sin(distance * 5.4) * .45;
        for (const [name, direction] of limbs) {
          const limb = group.getObjectByName(name);
          if (limb) limb.rotation.x = stride * direction;
        }
      },
    };
  }

  const bus = mode === 'transit';
  const group = new THREE.Group();
  group.name = bus ? 'travel-bus' : 'travel-car';
  const paint = bus ? '#edbc46' : '#2789aa';
  const trim = '#334348';
  const glass = '#526f7c';
  const halfLength = bus ? 1.76 : 1.37;
  const width = bus ? 1.47 : 1.34;
  const materials = new Map<string, THREE.MeshStandardMaterial>();

  function material(color: string) {
    const cached = materials.get(color);
    if (cached) return cached;
    const created = new THREE.MeshStandardMaterial({ color, roughness: .78 });
    materials.set(color, created);
    return created;
  }

  function box(x: number, y: number, z: number, w: number, h: number, d: number, color: string, parent: THREE.Group = group) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material(color));
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  }

  box(0, .34, 0, width * .98, .21, halfLength * 2, trim);
  box(0, .6, 0, width, .38, halfLength * 2, paint);

  if (bus) {
    box(0, 1.13, -.06, width * .99, .76, 3.28, paint);
    box(0, 1.55, -.06, width * .98, .13, 3.31, '#f1e6c5');
    box(0, 1.22, 1.586, 1.25, .45, .026, glass);
    box(0, 1.22, -1.706, 1.15, .41, .026, glass);
    box(0, 1.2, 1.604, .045, .47, .018, trim);
    for (const side of [-1, 1]) {
      for (const z of [-1.22, -.48, .26, 1.0]) {
        box(side * (width / 2 + .004), 1.22, z, .018, .42, .59, glass);
      }
      box(side * (width / 2 + .006), .87, 0, .019, .11, 3.22, '#4b8462');
    }
  } else {
    // The raised cabin and lower bonnet distinguish the car from the bus.
    const outline = new THREE.Shape();
    outline.moveTo(-.99, .77);
    outline.lineTo(-.57, 1.23);
    outline.lineTo(.36, 1.23);
    outline.lineTo(.77, .77);
    outline.closePath();
    const cabinWidth = 1.12;
    const cabinGeometry = new THREE.ExtrudeGeometry(outline, { depth: cabinWidth, bevelEnabled: false });
    cabinGeometry.rotateY(-Math.PI / 2);
    cabinGeometry.translate(cabinWidth / 2, 0, 0);
    const cabin = new THREE.Mesh(cabinGeometry, material(glass));
    cabin.castShadow = true;
    cabin.receiveShadow = true;
    group.add(cabin);
    box(0, 1.23, -.09, 1.15, .105, 1.03, paint);
    box(0, .8, .99, width * .96, .13, .64, paint);
    box(0, .8, -1.15, width * .96, .11, .42, paint);
    for (const side of [-1, 1]) {
      box(side * .566, 1.0, -.11, .028, .46, .05, trim);
      box(side * .727, .945, .5, .17, .13, .2, paint);
      box(side * .676, .755, -.1, .015, .028, .16, '#c9dce1');
    }
  }

  for (const side of [-1, 1]) {
    box(side * width * .33, .67, halfLength + .012, .23, .16, .027, '#fff0b4');
    box(side * width * .33, .62, -halfLength - .012, .21, .13, .027, '#c74d4f');
  }
  box(0, .48, halfLength + .018, width * .55, .13, .033, trim);
  box(0, .48, -halfLength - .018, .37, .11, .034, '#e8e9dc');

  const wheelRadius = .27;
  const wheels: THREE.Group[] = [];
  for (const side of [-1, 1]) {
    for (const axle of [-1, 1]) {
      const wheel = new THREE.Group();
      wheel.position.set(side * width / 2, wheelRadius, axle * halfLength * .62);
      const tyre = new THREE.Mesh(new THREE.CylinderGeometry(wheelRadius, wheelRadius, .22, 14), material('#283437'));
      tyre.rotation.z = Math.PI / 2;
      tyre.castShadow = true;
      wheel.add(tyre);
      const rim = new THREE.Mesh(new THREE.CylinderGeometry(.139, .139, .032, 10), material('#a6b3af'));
      rim.rotation.z = Math.PI / 2;
      rim.position.x = side * .118;
      wheel.add(rim);
      box(side * .14, 0, 0, .02, .21, .035, trim, wheel);
      group.add(wheel);
      wheels.push(wheel);
    }
  }

  const marker = new THREE.Mesh(new THREE.OctahedronGeometry(.18), material('#79b963'));
  marker.position.y = bus ? 2.04 : 1.8;
  marker.scale.y = 1.35;
  group.add(marker);

  return {
    group,
    axleOffset: halfLength * .62,
    pose: (distance, _arrived, reduceMotion) => {
      for (const wheel of wheels) wheel.rotation.x = reduceMotion ? 0 : distance / wheelRadius;
    },
  };
}

export function createTravelStage(scene: THREE.Scene, camera: THREE.OrthographicCamera, controls: OrbitControls) {
  const actors = new Map<TravelMode, TravelActor>();
  const followOffset = new THREE.Vector3(11, 22, 23);
  const focus = new THREE.Vector3();
  let previousView: { position: THREE.Vector3; target: THREE.Vector3; zoom: number; enabled: boolean; damping: boolean } | null = null;
  let previousPath: WorldTravel['path'] | undefined;
  let samplePath: ReturnType<typeof createTravelSampler> | undefined;
  let active: TravelActor | undefined;

  return (travel: WorldTravel | undefined, delta: number, reduceMotion: boolean) => {
    if (!travel?.path.length) {
      if (active) active.group.visible = false;
      active = undefined;
      if (previousView) {
        camera.position.copy(previousView.position);
        controls.target.copy(previousView.target);
        camera.zoom = previousView.zoom;
        camera.updateProjectionMatrix();
        controls.enabled = previousView.enabled;
        controls.enableDamping = previousView.damping;
        previousView = null;
      }
      return undefined;
    }

    const started = !previousView;
    if (started) {
      previousView = {
        position: camera.position.clone(),
        target: controls.target.clone(),
        zoom: camera.zoom,
        enabled: controls.enabled,
        damping: controls.enableDamping,
      };
      controls.enabled = false;
      controls.enableDamping = false;
    }

    if (previousPath !== travel.path || !samplePath) {
      previousPath = travel.path;
      samplePath = createTravelSampler(travel.path);
    }

    let actor = actors.get(travel.mode);
    if (!actor) {
      actor = createTravelActor(travel.mode);
      actors.set(travel.mode, actor);
      scene.add(actor.group);
    }
    if (active && active !== actor) active.group.visible = false;
    active = actor;

    const progress = travel.progress();
    const { x, z, heading, distance } = samplePath(progress);
    const dx = Math.sin(heading);
    const dz = Math.cos(heading);
    let y = travelSurfaceHeight(x, z);
    let pitch = 0;
    if (actor.axleOffset) {
      const front = travelSurfaceHeight(x + dx * actor.axleOffset, z + dz * actor.axleOffset);
      const rear = travelSurfaceHeight(x - dx * actor.axleOffset, z - dz * actor.axleOffset);
      y = (front + rear) / 2;
      pitch = Math.atan2(rear - front, actor.axleOffset * 2);
    }
    actor.group.position.set(x, y, z);
    actor.group.rotation.set(pitch, heading, 0, 'YXZ');
    actor.group.visible = true;
    actor.pose(distance, progress >= 1, reduceMotion);

    if (!reduceMotion) {
      focus.set(x + dx * .85, y + .45, z + dz * .85);
      const blend = started ? 1 : 1 - Math.exp(-11 * delta);
      controls.target.lerp(focus, blend);
      camera.position.copy(controls.target).add(followOffset);
      if (started) {
        camera.zoom = 2.65;
        camera.updateProjectionMatrix();
      }
    }

    return actor.group;
  };
}
