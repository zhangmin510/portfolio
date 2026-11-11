import * as THREE from 'three';
import type { ActionId, LocationId } from '../domain/types';

export interface WorldHotspot {
  id: ActionId | LocationId;
  position: THREE.Vector3;
  label: string;
  kind: 'action' | 'location';
}

export interface WorldModel {
  group: THREE.Group;
  hotspots: WorldHotspot[];
  player?: THREE.Group;
  anchors?: Partial<Record<ActionId, THREE.Vector3>>;
}

const materials = new Map<string, THREE.MeshStandardMaterial>();
function material(color: string) {
  if (!materials.has(color)) materials.set(color, new THREE.MeshStandardMaterial({ color, roughness: .85, flatShading: true }));
  // Each world owns its material copies, so disposing one scene cannot break another.
  return materials.get(color)!.clone();
}

function box(parent: THREE.Object3D, x: number, y: number, z: number, w: number, h: number, d: number, color: string) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material(color));
  mesh.position.set(x, y, z); mesh.castShadow = true; mesh.receiveShadow = true; parent.add(mesh); return mesh;
}

function cylinder(parent: THREE.Object3D, x: number, y: number, z: number, radius: number, height: number, color: string, sides = 12) {
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius * .85, height, sides), material(color));
  mesh.position.set(x, y, z); mesh.castShadow = true; mesh.receiveShadow = true; parent.add(mesh); return mesh;
}

function plant(parent: THREE.Object3D, x: number, z: number, scale = 1) {
  const root = new THREE.Group(); root.position.set(x, .3, z); root.scale.setScalar(scale); parent.add(root);
  cylinder(root, 0, .25, 0, .26, .5, '#bf7451');
  cylinder(root, 0, .7, 0, .035, .8, '#597348', 6);
  for (let i = 0; i < 6; i++) {
    const leaf = new THREE.Mesh(new THREE.SphereGeometry(.22, 5, 4), material(i % 2 ? '#648c4c' : '#82a35e'));
    const angle = i * 2.3; leaf.position.set(Math.sin(angle) * .2, .7 + i * .07, Math.cos(angle) * .2);
    leaf.scale.set(.6, 1.8, .8); leaf.rotation.z = Math.sin(angle) * .65; leaf.rotation.x = Math.cos(angle) * .65; leaf.castShadow = true; root.add(leaf);
  }
}

function tree(parent: THREE.Object3D, x: number, z: number, scale = 1) {
  const root = new THREE.Group(); root.position.set(x, 0, z); root.scale.setScalar(scale); parent.add(root);
  cylinder(root, 0, .9, 0, .15, 1.8, '#866344', 6);
  const crown = new THREE.Mesh(new THREE.IcosahedronGeometry(1.05, 0), material('#77a85d'));
  crown.position.y = 2.1; crown.scale.set(1, 1.3, 1); crown.castShadow = true; root.add(crown);
  const crown2 = new THREE.Mesh(new THREE.IcosahedronGeometry(.75, 0), material('#94b96d'));
  crown2.position.set(.55, 1.8, .15); crown2.castShadow = true; root.add(crown2);
}

function outside(parent: THREE.Group, office: boolean) {
  box(parent, 0, -.14, 0, 90, .2, 90, '#a5bd83');
  box(parent, 0, -.015, 8, 90, .07, 4.4, '#777f7d');
  box(parent, 0, .01, 5.4, 90, .12, .9, '#d3d5c7');
  box(parent, 0, .01, 10.7, 90, .12, .9, '#d3d5c7');
  for (let x = -43; x < 44; x += 3) box(parent, x, .035, 8, 1.4, .015, .1, '#f2e3ab');
  box(parent, 4, .05, 4.6, 2, .12, 2, '#d6d8c6');
  const backgroundBuildings = [[-13, -10, 5, 4, '#c8bca5'], [12, -13, 6, office ? 8 : 5, '#d5c9ac'], [-23, -15, 6, 5.5, '#c6cfbe'], [25, -10, 6, 7, '#cbd3c3']];
  for (const [x, z, width, height, color] of backgroundBuildings) {
    box(parent, Number(x), Number(height) / 2, Number(z), Number(width), Number(height), 4, String(color));
    box(parent, Number(x), Number(height) + .2, Number(z), Number(width) + .4, .4, 4.4, '#768b73');
    for (let row = 1; row < Number(height) - .3; row += 1.4) for (let col = -1; col < 2; col++) box(parent, Number(x) + col * 1.45, row, Number(z) + 2.03, .75, .7, .05, '#84a7a4');
  }
  [[-8, 2, 1.2], [9, 3, .95], [-10, -7, 1.1], [8, -7, 1.5], [18, 3, 1.2], [-20, 3, 1.5], [14, -20, 1.7], [-30, -3, 1.3]].forEach(([x, z, s]) => tree(parent, x, z, s));
  // A parked car keeps the cutaway apartment connected to an ordinary street.
  box(parent, -8, .48, 8, 2.9, .65, 1.4, '#d9b36c');
  box(parent, -8, .98, 8, 1.5, .55, 1.25, '#acc6c7');
  for (const x of [-8.9, -7.1]) for (const z of [7.3, 8.7]) { const wheel = cylinder(parent, x, .3, z, .3, .15, '#3e4945'); wheel.rotation.x = Math.PI / 2; }
}

function monitor(parent: THREE.Object3D, x: number, z: number, side = false) {
  box(parent, x, 1.03, z, .33, .04, .25, '#4e5e60');
  box(parent, x, 1.22, z, .06, .4, .06, '#58676a');
  const screen = box(parent, x, 1.56, z, 1.02, .66, .08, '#33484b');
  const glass = box(parent, x, 1.56, z + .046, .9, .54, .02, '#426e75');
  if (side) { screen.rotation.y = .18; glass.rotation.y = .18; }
  for (let i = 0; i < 5; i++) box(parent, x - .22 + (i % 2) * .05, 1.73 - i * .08, z + .061, .36 + (i % 3) * .08, .018, .007, i % 3 ? '#99c7b4' : '#e7c78d');
}

function desk(parent: THREE.Object3D, x: number, z: number, wide = false) {
  const width = wide ? 3 : 2.5;
  box(parent, x, .95, z, width, .13, 1.05, '#c49b6e');
  for (const lx of [-width / 2 + .1, width / 2 - .1]) for (const lz of [-.36, .36]) box(parent, x + lx, .49, z + lz, .1, .92, .1, '#657168');
  monitor(parent, x - .23, z - .23);
  if (wide) monitor(parent, x + .83, z - .22, true);
  box(parent, x - .3, 1.034, z + .28, .8, .035, .25, '#e9e9d8');
  for (let i = 0; i < 8; i++) box(parent, x - .63 + i * .095, 1.055, z + .28, .008, .005, .2, '#a8afa0');
  box(parent, x + .43, 1.03, z + .3, .28, .02, .32, '#9a805e');
  cylinder(parent, x + .47, 1.08, z + .29, .065, .08, '#d7ddd1');
  cylinder(parent, x - .95, 1.13, z + .22, .09, .22, '#e5b67a');
  const chair = new THREE.Group(); chair.position.set(x, 0, z + 1.05); parent.add(chair);
  cylinder(chair, 0, .3, 0, .06, .5, '#4d5f58');
  box(chair, 0, .58, 0, .65, .13, .64, '#618680');
  box(chair, 0, .99, .3, .66, .75, .12, '#72938b');
  for (let i = 0; i < 5; i++) { const spoke = box(chair, Math.sin(i * 1.256) * .2, .09, Math.cos(i * 1.256) * .2, .08, .06, .5, '#53655d'); spoke.rotation.y = i * 1.256; }
}

export function makePerson(shirt = '#cf7750', skin = '#d3a078') {
  const group = new THREE.Group();
  // Limb pivots are named so the renderer can animate a short walk without a rig asset.
  for (const [name, x] of [['leftLeg', -.115], ['rightLeg', .115]] as const) {
    const limb = new THREE.Group(); limb.name = name; limb.position.set(x, .72, 0); group.add(limb);
    box(limb, 0, -.28, 0, .18, .56, .22, '#425d6a');
    box(limb, 0, -.61, .05, .21, .12, .35, '#394643');
  }
  box(group, 0, 1.02, 0, .52, .63, .29, shirt);
  box(group, 0, 1.37, .005, .16, .16, .16, skin);
  for (const [name, x] of [['leftArm', -.34], ['rightArm', .34]] as const) {
    const limb = new THREE.Group(); limb.name = name; limb.position.set(x, 1.23, 0); group.add(limb);
    box(limb, 0, -.1, 0, .17, .26, .23, shirt);
    box(limb, 0, -.36, 0, .14, .31, .16, skin);
    box(limb, 0, -.54, .01, .15, .12, .17, skin);
  }
  box(group, 0, 1.6, .01, .38, .45, .36, skin);
  box(group, 0, 1.83, -.015, .41, .17, .4, '#3b3930');
  box(group, -.17, 1.68, -.03, .08, .26, .32, '#3b3930');
  box(group, .17, 1.68, -.08, .08, .26, .22, '#3b3930');
  for (const x of [-.09, .09]) box(group, x, 1.64, .198, .035, .045, .012, '#33382e');
  box(group, 0, 1.51, .198, .09, .017, .012, '#9c6752');
  const diamond = new THREE.Mesh(new THREE.OctahedronGeometry(.13), new THREE.MeshStandardMaterial({ color: '#61bc6a', emissive: '#317748', emissiveIntensity: .24, roughness: .7, flatShading: true }));
  diamond.position.y = 2.2; diamond.scale.y = 1.6; diamond.name = 'playerDiamond'; group.add(diamond);
  return group;
}

function windowPane(parent: THREE.Group, x: number, z: number, side = false) {
  const group = new THREE.Group(); group.position.set(x, 1.91, z); if (side) group.rotation.y = Math.PI / 2; parent.add(group);
  box(group, 0, 0, 0, 2.1, 1.48, .1, '#e7eddb');
  box(group, 0, 0, .065, 1.93, 1.3, .055, '#9ac3c4');
  box(group, 0, 0, .11, .055, 1.4, .04, '#f9f7e8');
  box(group, 0, 0, .11, 2, .055, .04, '#f9f7e8');
  box(group, 0, -.8, .06, 2.25, .1, .35, '#e4e6d3');
}

export function createRoomModel(mode: 'home' | 'office', _name: string): WorldModel {
  const group = new THREE.Group(); const home = mode === 'home'; outside(group, !home);
  box(group, 0, .08, 0, 10.5, .28, 8.7, '#b8b5a2');
  box(group, 0, .25, 0, 10.3, .1, 8.5, '#b89360');
  for (let i = 0; i < 24; i++) for (let j = 0; j < 4; j++) {
    const x = -4.95 + i * .43; const z = -3.2 + j * 2.12 + (i % 2 ? .5 : 0);
    const plank = box(group, x, .31, Math.min(z, 3.7), .414, .025, Math.min(2.08, 4.1 - z + 1.04), ['#c5a16e', '#caa976', '#bd9864', '#d0ae7b'][(i + j) % 4]);
    plank.castShadow = false;
  }
  const backWall = new THREE.Group(); backWall.name = 'cutaway-back-wall'; group.add(backWall);
  const leftWall = new THREE.Group(); leftWall.name = 'cutaway-left-wall'; group.add(leftWall);
  box(backWall, 0, 1.9, -4.25, 10.5, 3.3, .18, '#e9e7d6');
  box(leftWall, -5.2, 1.9, 0, .18, 3.3, 8.7, '#e0e4d4');
  box(backWall, 0, .42, -4.13, 10.35, .18, .06, '#b2b7a3');
  box(leftWall, -5.08, .42, 0, .06, .18, 8.5, '#b2b7a3');
  box(backWall, 0, 3.6, -4.25, 10.65, .11, .27, '#f6f4e6');
  box(leftWall, -5.2, 3.6, 0, .27, .11, 8.8, '#f0f1e2');
  windowPane(backWall, 1.7, -4.11);
  windowPane(leftWall, -5.08, .1, true);
  // A visible front door and pavement suggest the rest of the building beyond the cutaway.
  box(backWall, -4.05, 1.42, -4.1, 1.1, 2.25, .08, '#9b805c');
  cylinder(backWall, -3.7, 1.35, -4.02, .045, .03, '#d9c184').rotation.x = Math.PI / 2;

  const hotspots: WorldHotspot[] = [];
  const anchors: Partial<Record<ActionId, THREE.Vector3>> = {};
  if (home) {
    // Bed, linen, two pillows and bedside lamp.
    box(group, -3.08, .54, 1.75, 2.3, .42, 3.4, '#a58258');
    box(group, -3.08, .82, 1.75, 2.23, .2, 3.3, '#f5ecd9');
    box(group, -3.08, .98, .04, 2.4, 1.05, .18, '#b18a5e');
    box(group, -3.08, .96, 2.15, 2.26, .12, 2.23, '#6d9a80');
    for (let i = 0; i < 6; i++) box(group, -4.05 + i * .39, 1.026, 2.15, .022, .009, 2.2, '#8cb299');
    for (const x of [-3.63, -2.53]) box(group, x, 1.01, .58, .86, .18, .62, '#fff7e7');
    box(group, -1.59, .63, .5, .55, .67, .55, '#b79262');
    cylinder(group, -1.59, 1.08, .5, .14, .05, '#777c5e');
    cylinder(group, -1.59, 1.37, .5, .035, .55, '#7b8062');
    const shade = new THREE.Mesh(new THREE.ConeGeometry(.28, .35, 12, 1, true), material('#ebc993')); shade.position.set(-1.59, 1.65, .5); group.add(shade);
    // Kitchen at the back of the apartment.
    box(group, -2.1, .8, -3.35, 1.8, 1, 1.08, '#c7ccb8');
    box(group, -2.1, 1.34, -3.35, 1.95, .12, 1.16, '#f0ecdc');
    cylinder(group, -2.43, 1.414, -3.35, .28, .02, '#596c67');
    cylinder(group, -1.76, 1.414, -3.35, .22, .02, '#485e58');
    box(group, -3.35, 1.37, -3.52, .9, 2.12, 1.13, '#dce2d6');
    box(group, -3.35, 1.88, -2.945, .86, .035, .015, '#9eafa2');
    box(group, -3.03, 1.5, -2.93, .045, .33, .06, '#83978c');
    box(group, -3.03, 2.13, -2.93, .045, .19, .06, '#83978c');
    // Work corner.
    desk(group, 2.03, -2.85);
    box(group, 4.3, 1.4, -3.55, .85, 2.2, .7, '#b79567');
    for (const y of [.5, 1.1, 1.7, 2.35]) box(group, 4.3, y, -3.5, .9, .08, .8, '#b39162');
    for (let i = 0; i < 6; i++) box(group, 3.98 + i * .115, 1.38 + (i % 2) * .04, -3.33, .08, .46 + (i % 2) * .08, .3, ['#6d9389', '#cd9168', '#e0c38c'][i % 3]);
    // Living corner: substantial couch, table, rug and plants.
    box(group, 2.45, .34, 1.9, 3.4, .025, 2.5, '#e8bd94');
    box(group, 2.45, .36, 1.9, 3.1, .02, 2.2, '#dbac88');
    box(group, 2.45, .72, 2.88, 2.85, .57, 1, '#bb815d');
    box(group, 2.45, 1.12, 3.3, 2.85, .9, .23, '#cf946c');
    for (const x of [1.08, 3.82]) box(group, x, .97, 2.88, .2, .92, 1.13, '#c58b64');
    for (const x of [1.75, 3.1]) box(group, x, 1.01, 2.78, 1.24, .18, .75, '#dcaa7c');
    box(group, 1.69, 1.3, 3.09, .5, .5, .17, '#8eaa89').rotation.z = .08;
    box(group, 3.04, 1.29, 3.09, .46, .46, .17, '#d7bb80').rotation.z = -.12;
    box(group, 2.4, .75, 1.4, 1.5, .15, .85, '#c29a6c');
    for (const x of [1.82, 2.98]) for (const z of [1.1, 1.7]) box(group, x, .53, z, .07, .38, .07, '#9d7d55');
    box(group, 2.2, .847, 1.43, .52, .035, .36, '#e2e5ce');
    plant(group, 4.48, 2.4); plant(group, -4.3, -1.3, .75);
    hotspots.push(
      { kind: 'action', id: 'sleep', label: '床 · 休息', position: new THREE.Vector3(-3.1, 1.5, 1.9) },
      { kind: 'action', id: 'personal', label: '电脑 · 小项目', position: new THREE.Vector3(2.05, 2.14, -2.85) },
      { kind: 'action', id: 'cook', label: '厨房 · 吃点东西', position: new THREE.Vector3(-2.45, 2.7, -3.25) },
      { kind: 'action', id: 'rest', label: '沙发 · 放空', position: new THREE.Vector3(2.5, 1.8, 2.9) },
    );
    anchors.sleep = new THREE.Vector3(-1.6, .33, 1.9); anchors.personal = new THREE.Vector3(2.1, .33, -1.5); anchors.cook = new THREE.Vector3(-2.1, .33, -1.95); anchors.breakfast = anchors.cook; anchors.rest = new THREE.Vector3(2.45, .33, 1.9);
  } else {
    box(group, .7, .338, .05, 6.7, .025, 4.45, '#b4c0ad');
    desk(group, -.1, -.4, true); desk(group, 3.23, -2.7);
    // A whiteboard with a few tangible, low-poly sticky notes.
    box(group, -1.6, 2.07, -4.08, 3.3, 1.48, .1, '#a4b3a4');
    box(group, -1.6, 2.07, -3.995, 3.1, 1.28, .025, '#f5f6e9');
    for (let col = 0; col < 3; col++) for (let row = 0; row < 2; row++) box(group, -2.58 + col * .95, 2.23 - row * .38, -3.96, .42, .28, .02, ['#ddb268', '#9bbda6', '#dba18a'][col]);
    for (let i = 0; i < 3; i++) box(group, -2.48 + i * .97, 2.6, -3.96, .6, .025, .02, '#708e7b');
    // Tea point and lunch table.
    box(group, -4.45, .88, .7, 1, 1.15, 2.2, '#bda27e');
    box(group, -4.45, 1.48, .7, 1.06, .08, 2.3, '#e9e8d8');
    box(group, -4.45, 1.79, .15, .48, .55, .55, '#5e7d73');
    box(group, -4.45, 1.81, .44, .32, .25, .03, '#2c4b45');
    for (const z of [1.18, 1.5]) cylinder(group, -4.45, 1.61, z, .09, .22, '#e1c59b');
    box(group, -3.5, .88, 3.06, 2.0, .13, 1.02, '#cfad7b');
    for (const x of [-4.27, -2.73]) for (const z of [2.73, 3.4]) box(group, x, .57, z, .1, .57, .1, '#8e987f');
    for (const x of [-3.9, -3]) { box(group, x, .61, 2.15, .58, .1, .56, '#8da995'); box(group, x, .85, 1.94, .6, .6, .1, '#a0b8a0'); }
    plant(group, 4.5, 3.1, 1.2); plant(group, -4.4, -2.7, .85);
    const colleague = makePerson('#638c8d', '#c79370'); colleague.position.set(3.44, .33, -.72); colleague.rotation.y = -.6; colleague.getObjectByName('playerDiamond')!.visible = false; group.add(colleague);
    hotspots.push(
      { kind: 'action', id: 'focus', label: '工位 · 开始工作', position: new THREE.Vector3(-.2, 2.2, -.5) },
      { kind: 'action', id: 'test', label: '白板 · 测试评审', position: new THREE.Vector3(-1.6, 3.07, -3.9) },
      { kind: 'action', id: 'talk', label: '林工 · 聊一聊', position: new THREE.Vector3(3.5, 2.55, -.75) },
      { kind: 'action', id: 'lunch', label: '茶水间 · 吃午饭', position: new THREE.Vector3(-4, 2.15, 1.4) },
    );
    anchors.focus = new THREE.Vector3(-.05, .33, 1.1); anchors.rush = anchors.focus; anchors.ai = anchors.focus; anchors.test = new THREE.Vector3(-1.5, .33, -2.75); anchors.talk = new THREE.Vector3(2.43, .33, -.33); anchors.lunch = new THREE.Vector3(-2.9, .33, 2.12); anchors.rest = new THREE.Vector3(1.5, .33, 2.5);
  }
  const player = makePerson(); player.position.set(.05, .33, 2.3); group.add(player);
  return { group, hotspots, player, anchors };
}
