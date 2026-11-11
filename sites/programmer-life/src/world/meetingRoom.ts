import * as THREE from 'three';
import { makePerson } from './room';

export type MeetingSpeaker = 'lead' | 'engineer' | 'product' | 'player';

export const meetingSeats = {
  lead: { name: '主持人', shirt: '#647e70', skin: '#d4a57d', x: -1.6, z: -1.67, yaw: .19 },
  engineer: { name: '林工', shirt: '#57868d', skin: '#c79370', x: 1.28, z: -1.67, yaw: -.12 },
  product: { name: '林可', shirt: '#be735b', skin: '#dfaf89', x: -3.13, z: .31, yaw: Math.PI / 2 },
  player: { name: '你', shirt: '#c69a5b', skin: '#d3a078', x: 1.05, z: 1.72, yaw: 2.67 },
} satisfies Record<MeetingSpeaker, { name: string; shirt: string; skin: string; x: number; z: number; yaw: number }>;

export const meetingSpeakers = Object.keys(meetingSeats) as MeetingSpeaker[];
export const meetingTimeline = ['告警响起', '重试积压', '服务恢复', '落实改进'] as const;

export type MeetingBoard = { title: string; rows: readonly string[]; tag?: string };

export function meetingTimelineIndex(stage: number, length: number) {
  return Math.max(0, Math.min(length - 1, Math.floor(stage)));
}

type SeatActor = {
  person: THREE.Group;
  yaw: number;
  leftArm: THREE.Object3D;
  rightArm: THREE.Object3D;
  mouth: THREE.Mesh;
  ring: THREE.Mesh;
};

export function createMeetingRoom() {
  const group = new THREE.Group();
  group.name = 'postmortem-meeting-room';
  const cube = new THREE.BoxGeometry(1, 1, 1);
  const tube = new THREE.CylinderGeometry(1, 1, 1, 14);
  const leaf = new THREE.IcosahedronGeometry(1, 0);
  const materials = new Map<string, THREE.MeshStandardMaterial>();

  function material(color: string) {
    const existing = materials.get(color);
    if (existing) return existing;
    const next = new THREE.MeshStandardMaterial({ color, roughness: .83 });
    materials.set(color, next);
    return next;
  }

  function box(parent: THREE.Object3D, x: number, y: number, z: number, width: number, height: number, depth: number, color: string) {
    const mesh = new THREE.Mesh(cube, material(color));
    mesh.position.set(x, y, z);
    mesh.scale.set(width, height, depth);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  }

  function cylinder(parent: THREE.Object3D, x: number, y: number, z: number, radius: number, height: number, color: string) {
    const mesh = new THREE.Mesh(tube, material(color));
    mesh.position.set(x, y, z);
    mesh.scale.set(radius, height, radius);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  }

  box(group, 0, -.04, 0, 10.7, .38, 6.85, '#b8ae94');
  box(group, 0, .17, 0, 10.58, .08, 6.73, '#d4bd99');
  for (let row = 0; row < 9; row++) {
    const z = -2.94 + row * .735;
    const color = ['#dcc6a3', '#d3b994', '#d9c19a'][row % 3];
    box(group, 0, .218, z, 10.55, .012, .726, color).castShadow = false;
    for (const x of [-2.8 + (row % 2) * 1.05, 1.2 + (row % 2) * 1.05]) {
      box(group, x, .228, z, .012, .008, .71, '#c2a782').castShadow = false;
    }
  }

  box(group, 0, 1.9, -3.31, 10.7, 3.38, .16, '#e3e9dc');
  box(group, -5.28, 1.9, 0, .17, 3.38, 6.85, '#d4dfd1');
  box(group, 0, .33, -3.21, 10.53, .2, .12, '#a4ad9b');
  box(group, -5.17, .33, 0, .1, .2, 6.65, '#a4ad9b');
  box(group, 0, 3.62, -3.31, 10.8, .1, .25, '#f8f7ec');
  box(group, -5.28, 3.62, 0, .25, .1, 6.96, '#f0f4e9');

  // The window and the visible section of hallway frame the cutaway.
  const window = new THREE.Group();
  window.position.set(-5.13, 2.22, -.95);
  window.rotation.y = Math.PI / 2;
  group.add(window);
  box(window, 0, 0, 0, 2.85, 1.59, .12, '#f5f3e7');
  box(window, 0, 0, .076, 2.61, 1.35, .043, '#9ec4c7');
  for (const [x, width, height] of [[-.99, .41, .46], [-.52, .52, .66], [.47, .43, .33], [.94, .42, .57]]) {
    box(window, x, -.65 + height / 2, .102, width, height, .018, '#7da4a6').castShadow = false;
  }
  box(window, 0, 0, .132, .067, 1.45, .05, '#f0f3e5');
  box(window, 0, -.09, .132, 2.7, .065, .05, '#f0f3e5');
  box(window, 0, -.815, .11, 2.93, .088, .29, '#e5e9dc');
  box(group, 4.3, 1.43, -3.19, 1.19, 2.42, .13, '#929f90');
  box(group, 4.3, 1.48, -3.10, 1.05, 2.25, .087, '#9eb6ab');
  box(group, 4.3, 1.99, -3.046, .77, 1.02, .021, '#b6d2ce');
  box(group, 4.64, 1.18, -3.013, .14, .061, .054, '#f2e1b6');

  // The same timeline remains on the board as the conversation advances.
  box(group, -.25, 2.49, -3.17, 6.91, 1.84, .12, '#788c80');
  const board = document.createElement('canvas');
  board.width = 1024;
  board.height = 256;
  const context = board.getContext('2d');
  const boardTexture = context ? new THREE.CanvasTexture(board) : null;
  if (boardTexture) boardTexture.colorSpace = THREE.SRGBColorSpace;
  const boardFace = new THREE.Mesh(
    new THREE.PlaneGeometry(6.7, 1.65),
    new THREE.MeshBasicMaterial({ color: boardTexture ? '#ffffff' : '#f7faf0', map: boardTexture }),
  );
  boardFace.position.set(-.25, 2.49, -3.101);
  group.add(boardFace);
  box(group, -.25, 1.554, -3.03, 6.93, .067, .27, '#a5ada1');
  for (const [index, color] of ['#547e71', '#b06e58', '#36555d'].entries()) {
    box(group, 1.42 + index * .31, 1.6, -3.019, .25, .045, .042, color);
  }

  let paintedStage = -1;
  let paintedContent: MeetingBoard | undefined;
  function drawBoard(stage: number, content: MeetingBoard) {
    if (!context || !boardTexture || (stage === paintedStage && content === paintedContent)) return;
    paintedStage = stage;
    paintedContent = content;
    context.fillStyle = '#f4f7ed';
    context.fillRect(0, 0, board.width, board.height);
    context.fillStyle = '#2e5149';
    context.font = '700 51px system-ui, sans-serif';
    context.fillText(content.title, 32, 65, content.tag ? 815 : 960);
    if (content.tag) {
      context.fillStyle = '#536d66';
      context.font = '600 36px system-ui, sans-serif';
      context.textAlign = 'right';
      context.fillText(content.tag, 988, 62);
      context.textAlign = 'left';
    }
    const column = 960 / content.rows.length;
    context.fillStyle = '#bccfc3';
    context.fillRect(65, 121, column * (content.rows.length - 1), 6);
    for (const [index, label] of content.rows.entries()) {
      const x = 41 + index * column;
      const active = index === stage;
      context.fillStyle = active ? '#468369' : '#aec1b4';
      context.beginPath();
      context.arc(x + 24, 124, active ? 12 : 9, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = active ? '#d4e9d8' : '#e5ebe0';
      context.fillRect(x - 9, 151, column - 20, 70);
      context.fillStyle = active ? '#2f654e' : '#476158';
      context.font = '650 38px system-ui, sans-serif';
      context.fillText(label, x + 10, 199, column - 49);
    }
    boardTexture.needsUpdate = true;
  }

  // Conference table, chairs and material from the meeting.
  box(group, .01, .236, .02, 7.59, .022, 4.55, '#a8b7a6').castShadow = false;
  box(group, .01, .249, .02, 7.27, .022, 4.25, '#b6c4b1').castShadow = false;
  const table = new THREE.Shape();
  const w = 2.68;
  const d = 1.04;
  const r = .27;
  table.moveTo(-w + r, -d);
  table.lineTo(w - r, -d);
  table.quadraticCurveTo(w, -d, w, -d + r);
  table.lineTo(w, d - r);
  table.quadraticCurveTo(w, d, w - r, d);
  table.lineTo(-w + r, d);
  table.quadraticCurveTo(-w, d, -w, d - r);
  table.lineTo(-w, -d + r);
  table.quadraticCurveTo(-w, -d, -w + r, -d);
  const top = new THREE.Mesh(new THREE.ExtrudeGeometry(table, {
    depth: .12, bevelEnabled: true, bevelThickness: .043, bevelSize: .052, bevelSegments: 2, curveSegments: 4,
  }), material('#c29a6e'));
  top.rotation.x = -Math.PI / 2;
  top.position.set(0, 1.14, .08);
  top.castShadow = true;
  top.receiveShadow = true;
  group.add(top);
  for (const x of [-2.13, 2.13]) {
    box(group, x, .7, .08, .18, .89, 1.55, '#5d6b63');
    box(group, x, .269, .08, .27, .07, 1.72, '#58655d');
  }

  for (const [x, z, color] of [[-1.65, -.6, '#f0e9d8'], [-2.04, .4, '#e4b98a'], [1.22, .71, '#b6cabc']] as const) {
    const note = box(group, x, 1.328, z, .53, .02, .36, color);
    note.rotation.y = x * .12;
    for (const offset of [-.075, 0, .075]) {
      box(group, x, 1.341, z + offset, .29, .004, .014, '#7b9382');
    }
  }
  box(group, .08, 1.32, .09, .81, .031, .47, '#ece5d3').rotation.y = -.17;
  box(group, .12, 1.344, .12, .72, .021, .39, '#f6f0de').rotation.y = -.2;
  box(group, 1.36, 1.34, -.6, .87, .038, .55, '#536763');
  const laptop = new THREE.Group();
  laptop.position.set(1.36, 1.58, -.35);
  laptop.rotation.x = -.21;
  group.add(laptop);
  box(laptop, 0, 0, 0, .87, .49, .058, '#3d5453');
  box(laptop, 0, 0, -.035, .77, .38, .013, '#72989b');
  for (const [x, z, color] of [[-1, -.43, '#e3c48d'], [-2.33, -.06, '#d6e4cf'], [1.99, .55, '#d0ad87']] as const) {
    cylinder(group, x, 1.398, z, .08, .184, color);
    cylinder(group, x, 1.492, z, .068, .012, '#5f4e3b');
    box(group, x + .088, 1.4, z, .065, .065, .042, color);
  }

  const plant = new THREE.Group();
  plant.position.set(4.26, .22, 2.2);
  group.add(plant);
  cylinder(plant, 0, .23, 0, .28, .46, '#ae795f');
  cylinder(plant, 0, .48, 0, .3, .07, '#c18a69');
  cylinder(plant, 0, .78, 0, .037, .62, '#557f5c');
  for (let index = 0; index < 6; index++) {
    const angle = index * 2.399;
    const sprig = new THREE.Mesh(leaf, material(index % 2 ? '#81a171' : '#567f62'));
    sprig.position.set(Math.sin(angle) * .22, .81 + index * .08, Math.cos(angle) * .22);
    sprig.scale.set(.13, .3, .15);
    sprig.rotation.z = Math.sin(angle) * .62;
    sprig.rotation.x = Math.cos(angle) * .62;
    sprig.castShadow = true;
    plant.add(sprig);
  }

  const speakingRing = new THREE.RingGeometry(.54, .65, 40);
  const ringPaint = new THREE.MeshBasicMaterial({ color: '#62c895', side: THREE.DoubleSide });
  const actors = {} as Record<MeetingSpeaker, SeatActor>;

  for (const id of meetingSpeakers) {
    const { x, z, yaw, shirt, skin } = meetingSeats[id];
    const seat = new THREE.Group();
    seat.position.set(x, .23, z);
    seat.rotation.y = yaw;
    group.add(seat);
    box(seat, 0, .46, -.062, .68, .11, .65, '#577069');
    box(seat, 0, .752, -.369, .68, .64, .105, '#6f9081');
    for (const legX of [-.26, .26]) {
      for (const legZ of [-.31, .15]) box(seat, legX, .225, legZ, .058, .43, .058, '#516760');
    }

    const person = makePerson(shirt, skin);
    person.position.set(0, -.06, 0);
    person.getObjectByName('playerDiamond')!.visible = false;
    person.getObjectByName('leftLeg')!.visible = false;
    person.getObjectByName('rightLeg')!.visible = false;
    for (const legX of [-.116, .116]) {
      box(person, legX, .611, .18, .18, .2, .45, '#425d6a');
      box(person, legX, .365, .372, .17, .43, .18, '#425d6a');
      box(person, legX, .107, .42, .198, .1, .29, '#394643');
    }
    const mouth = box(person, 0, 1.509, .21, .078, .024, .016, '#734c41');
    mouth.castShadow = false;
    seat.add(person);

    const ring = new THREE.Mesh(speakingRing, ringPaint);
    ring.position.set(0, .038, 0);
    ring.rotation.x = -Math.PI / 2;
    seat.add(ring);
    actors[id] = {
      person, yaw, mouth, ring,
      leftArm: person.getObjectByName('leftArm')!,
      rightArm: person.getObjectByName('rightArm')!,
    };
  }

  function pose(speaker: MeetingSpeaker, stage: number, elapsed: number, animate: boolean, boardContent: MeetingBoard) {
    drawBoard(meetingTimelineIndex(stage, boardContent.rows.length), boardContent);
    for (const id of meetingSpeakers) {
      const actor = actors[id];
      const speaking = speaker === id;
      const beat = animate && speaking ? Math.sin(elapsed * 7.1) : 0;
      const syllable = animate && speaking ? Math.abs(Math.sin(elapsed * 11.5)) : 0;
      actor.ring.visible = speaking;
      actor.ring.scale.setScalar(1 + beat * .055);
      actor.person.position.y = -.06 + beat * .025;
      actor.person.rotation.z = beat * .052;
      actor.person.rotation.y = speaking ? (id === 'player' ? -.28 : actor.yaw < 1 ? -.13 : .12) + beat * .075 : 0;
      actor.leftArm.rotation.set(speaking ? -1.78 + beat * .33 : -1.31, 0, speaking ? -.37 : -.13);
      actor.rightArm.rotation.set(speaking ? -1.53 - beat * .19 : -1.28, 0, .15);
      actor.mouth.scale.y = speaking ? .047 + syllable * .058 : .017;
    }
  }

  function speakerPosition(speaker: MeetingSpeaker, target: THREE.Vector3) {
    const { x, z } = meetingSeats[speaker];
    return target.set(x, 2.21, z);
  }

  function dispose() {
    const geometries = new Set<THREE.BufferGeometry>();
    const roomMaterials = new Set<THREE.Material>();
    group.traverse(object => {
      if (!(object instanceof THREE.Mesh)) return;
      geometries.add(object.geometry);
      const values = Array.isArray(object.material) ? object.material : [object.material];
      values.forEach(value => roomMaterials.add(value));
    });
    geometries.forEach(geometry => geometry.dispose());
    roomMaterials.forEach(value => value.dispose());
    boardTexture?.dispose();
  }

  return { group, pose, speakerPosition, dispose };
}
