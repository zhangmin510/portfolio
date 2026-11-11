import * as THREE from 'three';
import { LOCATIONS } from '../content/game';
import type { LocationId } from '../domain/types';
import { makePerson, type WorldModel } from './room';

export const CITY_BRIDGE = {
  halfWidth: 2.35,
  halfSpan: 3.2,
  approachEnd: 4.7,
  deckHeight: .66,
  streetHeight: .095,
} as const;

const SITE: Record<LocationId, { x: number; z: number; height: number }> = {
  home: { x: -14, z: -10, height: 7.3 },
  office: { x: 13, z: -10.5, height: 11.2 },
  cafe: { x: -9.8, z: 7.2, height: 5.1 },
  store: { x: -21, z: 6.4, height: 4.4 },
  park: { x: -10.5, z: 16, height: 2.7 },
  makerspace: { x: 13.8, z: 7.3, height: 6.6 },
};

const PLAYER_ENTRANCES: Record<LocationId, readonly [number, number, number]> = {
  home: [-13.6, .30, -6.34],
  office: [13.25, .30, -6.15],
  cafe: [-9.8, .165, 11.35],
  store: [-21, -.03, 10.68],
  park: [-11.7, .18, 16.42],
  makerspace: [13.8, .24, 11.35],
};

export function getCityPlayerPosition(locationId: LocationId) {
  return new THREE.Vector3(...PLAYER_ENTRANCES[locationId]);
}

/** All geometry is original and built locally; no city assets or textures are fetched. */
class CityBuilder {
  readonly root = new THREE.Group();
  private readonly cube = new THREE.BoxGeometry(1, 1, 1);
  private readonly sphere = new THREE.IcosahedronGeometry(1, 0);
  private readonly cylinder = new THREE.CylinderGeometry(1, 1, 1, 8);
  private readonly materials = new Map<string, THREE.MeshStandardMaterial>();

  material(color: string, options: THREE.MeshStandardMaterialParameters = {}) {
    const key = `${color}:${JSON.stringify(options)}`;
    let material = this.materials.get(key);
    if (!material) {
      material = new THREE.MeshStandardMaterial({ color, roughness: .86, metalness: 0, ...options });
      this.materials.set(key, material);
    }
    return material;
  }

  box(parent: THREE.Group, x: number, y: number, z: number, width: number, height: number, depth: number, color: string, shadow = true) {
    const mesh = new THREE.Mesh(this.cube, this.material(color));
    mesh.position.set(x, y, z);
    mesh.scale.set(width, height, depth);
    mesh.castShadow = shadow;
    mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  }

  round(parent: THREE.Group, x: number, y: number, z: number, radius: number, height: number, color: string) {
    const mesh = new THREE.Mesh(this.cylinder, this.material(color));
    mesh.position.set(x, y, z);
    mesh.scale.set(radius, height, radius);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  }

  tree(x: number, z: number, size = 1, color = '#477b45') {
    this.round(this.root, x, size * .9, z, .16 * size, 1.8 * size, '#8b7250');
    for (const [dx, dy, dz, scale] of [[0, 2.6, 0, 1.25], [-.55, 2.1, .15, .86], [.55, 2.2, -.1, .94]]) {
      const crown = new THREE.Mesh(this.sphere, this.material(color, { flatShading: true }));
      crown.position.set(x + dx * size, dy * size, z + dz * size);
      crown.scale.setScalar(scale * size);
      crown.rotation.set(.2, x + z, .1);
      crown.castShadow = true;
      this.root.add(crown);
    }
  }

  bench(x: number, z: number, angle = 0) {
    const bench = new THREE.Group();
    bench.position.set(x, .1, z);
    bench.rotation.y = angle;
    this.root.add(bench);
    this.box(bench, 0, .53, 0, 1.8, .14, .54, '#a77b4e');
    this.box(bench, 0, .96, -.26, 1.8, .58, .1, '#b58b58');
    this.box(bench, -.64, .26, 0, .1, .52, .4, '#4b6154');
    this.box(bench, .64, .26, 0, .1, .52, .4, '#4b6154');
  }

  lamp(x: number, z: number) {
    this.round(this.root, x, 1.95, z, .055, 3.9, '#5a675c');
    this.box(this.root, x + .28, 3.9, z, .65, .08, .12, '#5a675c');
    this.box(this.root, x + .5, 3.85, z, .5, .1, .27, '#ece7cd', false);
    this.box(this.root, x, .11, z, .34, .2, .34, '#7f8879');
  }

  sign(parent: THREE.Group, text: string, x: number, y: number, z: number, width: number, height: number, background = '#f7f4e8', color = '#3d5947') {
    const canvas = document.createElement('canvas');
    canvas.width = 768;
    canvas.height = 192;
    const context = canvas.getContext('2d');
    if (!context) return;
    context.fillStyle = background;
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = color;
    context.font = '600 63px "PingFang SC", "Microsoft YaHei", sans-serif';
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillText(text, canvas.width / 2, canvas.height / 2 + 4, canvas.width - 70);
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(width, height), new THREE.MeshStandardMaterial({ map: texture, roughness: .8 }));
    sign.position.set(x, y, z);
    parent.add(sign);
    return sign;
  }

  roof(parent: THREE.Group, x: number, y: number, z: number, width: number, depth: number, rise: number, color: string) {
    const triangle = new THREE.Shape();
    triangle.moveTo(-width / 2, 0);
    triangle.lineTo(width / 2, 0);
    triangle.lineTo(0, rise);
    triangle.closePath();
    const geometry = new THREE.ExtrudeGeometry(triangle, { depth, bevelEnabled: false, curveSegments: 1 });
    const mesh = new THREE.Mesh(geometry, this.material(color));
    mesh.position.set(x, y, z - depth / 2);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    parent.add(mesh);
  }

  windows(parent: THREE.Group, width: number, depth: number, floors: number, columns: number, color = '#93b8bd', startY = 1.5) {
    for (let floor = 0; floor < floors; floor++) {
      for (let col = 0; col < columns; col++) {
        const x = -width / 2 + .7 + col * (width - 1.4) / Math.max(1, columns - 1);
        const y = startY + floor * 1.32;
        this.box(parent, x, y, depth / 2 + .035, .7, .9, .06, color, false);
      }
      for (let col = 0; col < 3; col++) {
        this.box(parent, width / 2 + .035, startY + floor * 1.32, -.4 * depth + col * depth * .39, .06, .9, .72, color, false);
      }
    }
  }

  car(x: number, z: number, color: string, angle = 0, bus = false) {
    const car = new THREE.Group();
    car.position.set(x, .1, z);
    car.rotation.y = angle;
    this.root.add(car);
    const length = bus ? 3.7 : 2.4;
    this.box(car, 0, .59, 0, 1.15, .62, length, color);
    this.box(car, 0, bus ? 1.12 : .94, -.08, 1.05, bus ? .6 : .48, bus ? length * .84 : 1.3, bus ? color : '#7c9b9a');
    this.box(car, 0, bus ? 1.12 : .96, length * .36, .9, .38, .035, '#a3c2c8', false);
    if (bus) for (let i = 0; i < 4; i++) this.box(car, .58, 1.17, -1.25 + i * .72, .04, .4, .48, '#7898a0', false);
    for (const side of [-1, 1]) for (const axle of [-1, 1]) {
      const wheel = this.round(car, side * .57, .33, axle * length * .3, .26, .16, '#3d4946');
      wheel.rotation.z = Math.PI / 2;
    }
  }

  building(id: LocationId) {
    const group = new THREE.Group();
    group.name = `location:${id}`;
    group.userData.locationId = id;
    group.position.set(SITE[id].x, 0, SITE[id].z);
    this.root.add(group);
    return group;
  }
}

export function createCityModel(locationId: LocationId): WorldModel {
  const city = new CityBuilder();
  const root = city.root;
  root.name = 'stack-town';

  // The terrain continues outside the playable neighbourhood, so the town is a place,
  // rather than a floating diorama. Raised pavements catch the directional sunlight.
  city.box(root, 0, -.28, 0, 400, .5, 300, '#88a26e', false);
  const northRoad = -5.2;
  const southRoad = 12.9;
  for (const z of [northRoad, southRoad]) {
    city.box(root, 0, .01, z, 76, .12, 2.3, '#747a78', false);
    city.box(root, 0, .085, z - 1.5, 76, .16, .65, '#b8bdb0', false);
    city.box(root, 0, .085, z + 1.5, 76, .16, .65, '#b8bdb0', false);
  }
  // Split the north/south street at the canal. Only the raised bridge crosses water.
  for (const z of [-19, 19]) {
    city.box(root, 0, .015, z, 4.8, .13, 29, '#747a78', false);
    for (const x of [-3.05, 3.05]) city.box(root, x, .09, z, .8, .17, 28, '#b8bdb0', false);
  }
  for (let i = -7; i <= 7; i++) {
    if (Math.abs(i) < 1) continue;
    for (const z of [northRoad, southRoad]) city.box(root, i * 4.1, .085, z, 1.65, .015, .11, '#d8ddd4', false);
    if (Math.abs(i * 3.8) > 5.2) city.box(root, 0, .09, i * 3.8, .11, .015, 1.4, '#d8ddd4', false);
  }
  for (let i = -2; i <= 2; i++) {
    city.box(root, i * .7, .1, northRoad - 2, .35, .02, 1.1, '#e3dfc7', false);
    city.box(root, i * .7, .1, southRoad + 2, .35, .02, 1.1, '#e3dfc7', false);
  }

  // The canal bisects the town: home/office on the north bank, street life south.
  city.box(root, 0, -.025, 0, 400, .18, 6.4, '#4f8fae', false);
  city.box(root, 0, .13, -3.6, 100, .3, .7, '#b3b9ab', false);
  city.box(root, 0, .13, 3.6, 100, .3, .7, '#b3b9ab', false);
  for (let i = -12; i <= 12; i++) {
    if (Math.abs(i * 2.8) < 3) continue;
    city.box(root, i * 2.8, .56, -3.84, .09, .82, .09, '#82948a', false);
    city.box(root, i * 2.8, .56, 3.84, .09, .82, .09, '#82948a', false);
  }
  for (const z of [-3.84, 3.84]) for (const x of [-19, 19]) city.box(root, x, .92, z, 32, .07, .07, '#82948a', false);
  const bridge = CITY_BRIDGE;
  const span = bridge.halfSpan * 2;
  const rampRun = bridge.approachEnd - bridge.halfSpan;
  const rampRise = bridge.deckHeight - bridge.streetHeight;
  const rampLength = Math.hypot(rampRun, rampRise);
  const rampAngle = Math.atan2(rampRise, rampRun);
  const rampTop = (bridge.deckHeight + bridge.streetHeight) / 2;
  city.box(root, 0, .38, 0, 5.3, .45, span, '#aab2aa');
  city.box(root, 0, bridge.deckHeight - .02, 0, bridge.halfWidth * 2, .04, span, '#7b8380', false);
  for (const x of [-2.5, 2.5]) {
    city.box(root, x, 1.05, 0, .15, .8, span, '#c7c9b7');
    city.box(root, x, 1.48, 0, .22, .12, span, '#d9dbc8');
  }
  for (const direction of [-1, 1]) {
    const rampZ = direction * (bridge.halfSpan + rampRun / 2);
    const tilt = direction * rampAngle;
    const support = city.box(root, 0, rampTop - .18, rampZ, 5.3, .32, rampLength, '#aab2aa');
    support.rotation.x = tilt;
    const surface = city.box(root, 0, rampTop - Math.cos(tilt) * .02, rampZ - Math.sin(tilt) * .02, bridge.halfWidth * 2, .04, rampLength, '#7b8380', false);
    surface.rotation.x = tilt;
    for (const x of [-2.5, 2.5]) {
      const barrier = city.box(root, x, rampTop + .38, rampZ + Math.sin(tilt) * .38, .15, .8, rampLength, '#c7c9b7');
      barrier.rotation.x = tilt;
    }
  }
  for (const z of [-2.5, -.75, .75, 2.5]) city.box(root, 0, .675, z, .11, .015, .8, '#d8ddd4', false);
  for (let i = 0; i < 11; i++) city.box(root, -30 + i * 6, .08, -1.2 + (i % 3) * .65, 2.5, .025, .06, '#76aac4', false);
  const riverName = city.sign(root, 'STACK RIVER', 14, .105, 0, 10, 1.4, '#4f8fae', '#b1cdd9');
  riverName?.rotation.set(-Math.PI / 2, 0, 0);

  // Home: three storeys of warm plaster, visible balconies and rooftop life.
  const home = city.building('home');
  city.box(home, 0, .15, 0, 8.2, .3, 8.1, '#c6c6ad');
  city.box(home, 0, 3.1, 0, 6.4, 6.0, 5.8, '#d6c2a1');
  city.windows(home, 6.4, 5.8, 3, 4, '#7eacae', 1.25);
  city.box(home, 0, 6.25, 0, 6.9, .32, 6.3, '#e6d8bb');
  city.box(home, 0, 6.6, 0, 3.8, .45, 3, '#b7bf9d');
  city.box(home, -.5, 1.0, 2.97, 1.0, 1.8, .1, '#6f8a80', false);
  city.box(home, -.5, .28, 3.45, 1.8, .25, .75, '#c7b99c');
  for (const floor of [2.25, 3.65, 4.98]) {
    city.box(home, .8, floor, 3.3, 2.8, .13, 1.05, '#d5d7bf');
    city.box(home, .8, floor + .4, 3.78, 2.8, .65, .05, '#8a9c8e');
  }
  city.sign(home, '梧桐里 302', -.5, .98, 3.04, 1.6, .4);
  city.round(home, 1.8, 6.65, -1.1, .54, .55, '#9eac98');
  city.box(home, -2.1, 6.49, -.8, .55, .28, 1.5, '#b77d60');

  // Office: a clean glass-and-concrete volume, rather than an undifferentiated cube.
  const office = city.building('office');
  city.box(office, 0, .15, 0, 10.8, .3, 9.5, '#c7cbb9');
  city.box(office, 0, 4.8, 0, 7.7, 9.3, 6.7, '#b9c9c6');
  city.box(office, 0, 4.8, 3.39, 6.8, 8.0, .12, '#789da4', false);
  city.box(office, 3.91, 4.8, 0, .12, 8.0, 5.8, '#6b939a', false);
  for (let floor = 0; floor < 6; floor++) city.box(office, 0, .9 + floor * 1.4, 3.49, 7.1, .12, .12, '#c5d0c7', false);
  for (let col = 0; col < 5; col++) city.box(office, -3.2 + col * 1.6, 4.7, 3.5, .1, 7.9, .12, '#c5d0c7', false);
  city.box(office, 0, 9.64, 0, 8.1, .35, 7.05, '#dbe0d4');
  city.box(office, .25, 1.3, 3.67, 1.65, 2.35, .08, '#3f7079', false);
  city.box(office, .25, 2.62, 4.12, 4.3, .14, 1.25, '#cdd7ca');
  city.sign(office, 'STACK · 字节花园', 0, 8.65, 3.6, 5.1, .62, '#496c64', '#fffaf0');
  city.box(office, -2.5, .6, 4.0, 1.2, .9, .8, '#7d9b64');
  city.box(office, 3.0, .6, 4.0, 1.2, .9, .8, '#7d9b64');

  const cafe = city.building('cafe');
  city.box(cafe, 0, .12, 0, 7.4, .24, 6.8, '#c8c6ad');
  city.box(cafe, 0, 1.65, 0, 6.4, 3.2, 4.6, '#d7a06f');
  city.roof(cafe, 0, 3.24, 0, 6.95, 5.15, 1.25, '#a87458');
  city.box(cafe, -1.6, 1.55, 2.34, 2.3, 1.7, .08, '#709b98', false);
  city.box(cafe, 1.3, 1.2, 2.35, 1.1, 2.25, .09, '#5a8077', false);
  city.box(cafe, 0, 2.48, 2.93, 6.4, .2, 1.3, '#658970');
  for (const x of [-2.9, 2.9]) city.round(cafe, x, 1.2, 3.43, .045, 2.4, '#738b70');
  city.sign(cafe, 'HALF BEAT · 半拍', 0, 2.88, 2.4, 4.7, .52, '#efe2be', '#5c7457');
  for (const x of [-2, 1.8]) {
    city.round(cafe, x, .72, 4.1, .5, .1, '#d9c7a1');
    city.round(cafe, x, .37, 4.1, .07, .65, '#6d7966');
    for (const dx of [-.65, .65]) city.box(cafe, x + dx, .45, 4.1, .45, .15, .45, '#738c6c');
  }

  const store = city.building('store');
  city.box(store, 0, .12, 0, 6.1, .24, 6.0, '#c4c3ab');
  city.box(store, 0, 1.75, 0, 5.1, 3.4, 4.2, '#ece1c5');
  city.box(store, 0, 3.5, 0, 5.5, .28, 4.6, '#b87c66');
  city.box(store, -1.0, 1.3, 2.14, 1.8, 2.0, .06, '#87aaa5', false);
  city.box(store, 1.0, 1.3, 2.14, 1.4, 2.0, .06, '#5d8b89', false);
  city.sign(store, '好邻 24H', 0, 2.88, 2.2, 4.65, .7, '#b05f4e', '#fff6dd');
  for (let i = 0; i < 6; i++) city.box(store, -2.15 + i * .86, 2.3, 2.8, .84, .15, 1.25, i % 2 ? '#f2e6c8' : '#bc6f59');
  for (const x of [-1.7, -.75]) {
    city.box(store, x, .35, 2.75, .7, .5, .7, '#a8a66b');
    city.box(store, x, .65, 2.75, .5, .14, .5, '#90a24f');
  }

  const makers = city.building('makerspace');
  city.box(makers, 0, .12, 0, 10.7, .24, 8.8, '#c7c6ae');
  city.box(makers, 0, 2.2, 0, 9.2, 4.3, 6.7, '#bd9b64');
  city.roof(makers, -2.3, 4.36, 0, 4.9, 7.2, 1.35, '#9b8070');
  city.roof(makers, 2.3, 4.36, 0, 4.9, 7.2, 1.35, '#a89079');
  city.box(makers, 0, 1.5, 3.4, 2.2, 2.8, .09, '#64796d', false);
  for (const x of [-3.3, 3.3]) city.box(makers, x, 2.45, 3.4, 1.45, 1.55, .07, '#86a9a2', false);
  city.sign(makers, '周末造物所', 0, 3.55, 3.48, 4.7, .67, '#4f6858', '#fff3d1');
  city.round(makers, 3.3, 5.5, -2.0, .31, 3.4, '#a3876b');
  city.box(makers, -3.9, .5, 4.15, .8, .8, .8, '#b07d4f');
  city.box(makers, -2.9, .4, 4.15, .8, .6, .8, '#c19a64');

  const park = city.building('park');
  city.box(park, 0, .06, .7, 15.4, .12, 4.6, '#6f985b', false);
  city.box(park, 0, .14, .5, 15.4, .08, 1.0, '#b7b9a0', false);
  city.box(park, -1.2, .14, 1.1, 1.0, .08, 3.8, '#b7b9a0', false);
  city.box(park, -3.1, .135, -.45, 4.8, .08, .9, '#b7b9a0', false);
  city.box(park, -5, .135, -.02, .9, .08, 1.76, '#b7b9a0', false);
  city.round(park, 3.8, .3, -.85, 1.15, .4, '#b5c3ac');
  city.round(park, 3.8, .53, -.85, .93, .08, '#7aabb5');
  city.round(park, 3.8, 1.0, -.85, .12, .95, '#b6c9b7');
  for (const [x, z] of [[-16, 14.7], [-7, 14.5], [-16, 17.2]]) city.tree(x, z, .85, '#407b3c');
  city.bench(-11.3, 17.2);
  city.bench(-5.6, 17.2);
  city.bench(-16.5, 15.2, Math.PI / 2);

  // Neighbourhood depth: modest homes, a corner block and irregularly spaced trees.
  for (const [x, z, height, color] of [[-25, -15, 3.5, '#c9ba99'], [-3, -22, 4.1, '#d8c3a2'], [23, -19, 5.8, '#bbc6b0'], [27, 5, 4.1, '#c3b69a']] as const) {
    const neighbour = new THREE.Group();
    neighbour.position.set(x, 0, z);
    root.add(neighbour);
    city.box(neighbour, 0, height / 2, 0, 4.6, height, 4.8, color);
    city.box(neighbour, 0, height + .16, 0, 5, .32, 5.2, '#bcc2a6');
    city.windows(neighbour, 4.6, 4.8, 2, 3, '#89a8a0', 1.15);
  }
  for (const [x, z, size] of [[-25, -7.5, 1.1], [-21, -17, 1.1], [-8, -17, .9], [-23, 16.2, .85], [-4.3, -12, .78], [-4.3, 7.5, .75], [4.3, -7.2, .8], [4.3, 8, .85], [22.5, -7.7, 1.0], [23.5, 16.2, 1.1], [6.3, -19.5, .9], [20, 14.8, .65], [-22, 18, .75], [20, 17.2, .78], [-24, 29, 1.0], [-12, 30, .9], [9, 30, 1.1], [23, 29, .9]]) city.tree(x, z, size);
  for (const [x, z] of [[-5.0, -3.7], [5, -3.7], [-18, 11.5], [18, 11.5], [3.25, 15], [-3.25, -17]]) city.lamp(x, z);
  city.car(-17, northRoad, '#e1b855', Math.PI / 2, true);
  city.car(8.4, 15.2, '#c67b61', -Math.PI / 2);
  city.car(1.2, -13, '#e6e2ca');
  city.car(-1.25, 11, '#7b9d9d', Math.PI);
  city.box(root, -5.7, .7, 3.9, .5, 1.2, .5, '#668573');
  city.box(root, -5.7, 1.4, 3.9, .62, .18, .62, '#839a70');

  const player = makePerson();
  player.name = 'city-player';
  player.position.copy(getCityPlayerPosition(locationId));
  root.add(player);

  return {
    group: root,
    player,
    hotspots: (Object.entries(SITE) as [LocationId, typeof SITE[LocationId]][]).map(([id, site]) => ({
      id,
      kind: 'location',
      label: LOCATIONS[id].name,
      position: new THREE.Vector3(site.x, site.height, site.z),
    })),
  };
}
