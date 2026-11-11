import * as THREE from 'three';
import type { ActionId } from '../domain/types';

export interface ActionPerformance { id: ActionId; stage: number }
export type MonitorDisplay = (action: ActionPerformance | undefined, now: number, still: boolean) => void;

const editorRows = [
  'const sent = new Set<string>();',
  'export function notify(event) {',
  '  if (sent.has(event.id)) return;',
  '  sent.add(event.id);',
  '  return sendNotification(event);',
  '}',
  '',
  '✓  notifications.test.ts  ·  3 passed',
];

export function makeMonitorDisplay(parent: THREE.Object3D, x: number, z: number): MonitorDisplay | undefined {
  if (typeof document === 'undefined') return;
  const canvas = document.createElement('canvas');
  canvas.width = 480; canvas.height = 288;
  const context = canvas.getContext('2d');
  if (!context) return;
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(.92, .552), new THREE.MeshBasicMaterial({ map: texture, toneMapped: false }));
  screen.position.set(x, 1.56, z + .067);
  parent.add(screen);
  let previous = '';
  let started = 0;
  const draw: MonitorDisplay = (action, now, still) => {
    const id = action?.id;
    const stage = action?.stage ?? 0;
    const state = `${id ?? 'idle'}:${stage}`;
    const priorState = previous.split('@', 1)[0];
    if (state !== priorState) started = now;
    const frame = still ? 16 : Math.max(0, Math.floor((now - started) / 105));
    const key = `${state}@${action ? frame : 0}`;
    if (key === previous) return;
    previous = key;
    context.fillStyle = '#101c2a'; context.fillRect(0, 0, 480, 288);
    context.fillStyle = '#233548'; context.fillRect(0, 0, 480, 46);
    const line = (value: string, left: number, top: number, size = 18, color = '#b7ccde', bold = false) => {
      context.font = `${bold ? 'bold ' : ''}${size}px ui-monospace, SFMono-Regular, Menlo, monospace`;
      context.fillStyle = color; context.fillText(value, left, top);
    };
    for (const [i, color] of ['#f4867c', '#e6b97a', '#78c5a1'].entries()) {
      context.fillStyle = color; context.beginPath(); context.arc(16 + i * 15, 23, 4, 0, 2 * Math.PI); context.fill();
    }
    if (id === 'ai') {
      line('CODEX', 72, 30, 26, '#f3f7fb', true);
      if (stage === 0) {
        line('> Prevent duplicate', 22, 93, 25, '#eaf2ff', true);
        line('  notifications on retry.', 22, 132, 23, '#a9cafa');
        line('  Add a regression test.'.slice(0, 7 + frame * 2), 22, 168, 23, '#a9cafa');
        line('PROMPT', 22, 247, 20, '#aabcf4', true);
        if (frame % 8 < 4) { context.fillStyle = '#9bd8ed'; context.fillRect(120, 229, 12, 22); }
      } else if (stage === 1) {
        line('Thinking…', 92, 110, 35, '#eaf2ff', true);
        line('Reading notifications.ts', 22, 162, 21, '#a9cafa');
        line('Checking retry tests', 22, 196, 21, '#a9cafa');
        for (let index = 0; index < 3; index++) {
          context.fillStyle = index === frame % 3 ? '#9be7d3' : '#386264';
          context.fillRect(24 + index * 21, 92, 12, 12);
        }
        context.fillStyle = '#233d51'; context.fillRect(22, 241, 435, 11);
        context.fillStyle = '#81cbb8'; context.fillRect(22, 241, 80 + Math.min(frame * 13, 355), 11);
      } else {
        line('PATCH READY', 22, 88, 28, '#a0e9bd', true);
        line('+ if (sent.has(event.id)) return;', 22, 132, 20, '#a0e9bd');
        line('+ sent.add(event.id);', 22, 163, 20, '#a0e9bd');
        line('✓ Retry deduplication test', 22, 194, 20, '#a0e9bd');
        line('Review changes', 22, 250, 23, '#c7d8f6', true);
      }
    } else {
      const file = id === 'test' ? 'notifications.test.ts' : id === 'personal' ? 'reading-list.ts' : id === 'overtime' ? 'Saturday Shift' : 'src/notifications.ts';
      line(file, 72, 29, 20, '#e5f1ff');
      const rows = id === 'test' ? ["describe('notify', () => {", "  it('deduplicates retries', ...);", "  it('skips empty lists', ...);", '});', '', stage > 1 ? '✓  3 tests passed' : stage === 1 ? 'FAIL  retry sends twice' : '›  npm test']
        : id === 'personal' ? ['export function saveArticle(url) {', '  readingList.add(url);', '}', '', '✓  Saved to the reading list']
        : id === 'overtime' ? ['SATURDAY  /  10:00–14:00', '', 'Shift rate: 1.5×', '', stage > 0 ? '✓  Shift accepted' : 'Review shift details']
        : id === 'rush' ? ['export function notifyAll(events) {', '  return events.map(toNotification);', '}', '', '// TODO: empty lists and retries']
        : editorRows;
      const visible = action && stage < 2 ? Math.min(rows.length, 4 + Math.floor(frame / 4)) : rows.length;
      rows.slice(0, visible).forEach((row, index) => {
        line(String(index + 1), 12, 77 + index * 24, 14, '#6c8497');
        line(row, 41, 77 + index * 24, 16, ['#be9bee', '#83d0e9', '#a7d9a9', '#e6bc82'][index % 4]);
      });
      context.fillStyle = id === 'rush' ? '#553f36' : '#203e46'; context.fillRect(0, 262, 480, 26);
      line(action ? stage === 2 ? '✓ Saved   ·   Review' : id === 'rush' ? 'HOTFIX   ·   Editing' : 'Editing   ·   main' : 'Ready   ·   main', 12, 280, 14, '#c6e0d2');
    }
    texture.needsUpdate = true;
  };
  draw(undefined, 0, true);
  return draw;
}

export interface RoomPerformanceFrame { center: THREE.Vector3; zoom: number }

export interface RoomPerformance {
  update: (performance: ActionPerformance, now: number, delta: number, still: boolean) => RoomPerformanceFrame | undefined;
  clear: () => void;
}

export interface RoomPerformanceProps {
  player: THREE.Group;
  mode: 'home' | 'office';
  monitor?: MonitorDisplay;
  props: Partial<Record<'pan' | 'steam' | 'meal' | 'plate' | 'cup' | 'sleep' | 'board' | 'utensil', THREE.Group>>;
  colleague?: THREE.Group;
}

type Limbs = ReturnType<typeof limbs>;
const limbNames = ['leftArm', 'rightArm', 'leftElbow', 'rightElbow', 'leftLeg', 'rightLeg', 'leftKnee', 'rightKnee', 'head'] as const;
function limbs(person: THREE.Group) {
  return Object.fromEntries(limbNames.map(key => [key, person.getObjectByName(key)!])) as Record<typeof limbNames[number], THREE.Object3D>;
}

function reset(person: THREE.Group, parts: Limbs) {
  person.rotation.x = 0;
  person.rotation.z = 0;
  for (const limb of Object.values(parts)) limb.rotation.set(0, 0, 0);
  const marker = person.getObjectByName('playerDiamond');
  if (marker) marker.visible = true;
}

function sit(parts: Limbs) {
  parts.leftLeg.rotation.x = parts.rightLeg.rotation.x = -1.55;
  parts.leftKnee.rotation.x = parts.rightKnee.rotation.x = 1.6;
}

function typeAtDesk(parts: Limbs, phase: number, strength: number) {
  for (const [arm, elbow, side] of [[parts.leftArm, parts.leftElbow, 1], [parts.rightArm, parts.rightElbow, -1]] as const) {
    arm.rotation.set(-.45 + Math.sin(phase + side) * .075 * strength, 0, side * .39);
    elbow.rotation.x = -1.11 + Math.sin(phase * 1.46 + side * 2) * .10 * strength;
  }
}

function approachAngle(from: number, to: number, mix: number) {
  return from + Math.atan2(Math.sin(to - from), Math.cos(to - from)) * mix;
}

const v = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
interface Beat { stand: THREE.Vector3; pose: THREE.Vector3; facing: number; kind: 'desk' | 'sleep' | 'cook' | 'eat' | 'rest' | 'talk'; camera: RoomPerformanceFrame }
function beat(stand: THREE.Vector3, pose: THREE.Vector3, facing: number, kind: Beat['kind'], center: THREE.Vector3, zoom: number): Beat {
  return { stand, pose, facing, kind, camera: { center, zoom } };
}

export function createRoomPerformance({ player, mode, monitor, props, colleague }: RoomPerformanceProps): RoomPerformance {
  const home = mode === 'home';
  const parts = limbs(player);
  const colleagueParts = colleague && limbs(colleague);
  const colleagueFacing = colleague?.rotation.y ?? 0;
  const propGroups = Object.values(props);
  const station = home
    ? beat(v(1.92, .33, -2.13), v(1.92, .055, -2.13), Math.PI, 'desk', v(1.91, 1.1, -2.54), 2.32)
    : beat(v(-.21, .33, .32), v(-.21, .055, .32), Math.PI, 'desk', v(-.28, 1.1, -.07), 2.32);
  const kitchen = beat(v(-2.2, .33, -2.34), v(-2.2, .33, -2.34), Math.PI, 'cook', v(-2.34, 1.25, -2.79), 2.1);
  const kitchenSeat = beat(v(-1.34, .33, -2.29), v(-1.34, .17, -2.28), Math.PI, 'eat', v(-1.8, 1.19, -2.75), 2.1);
  const rest = home
    ? beat(v(1.57, .33, 2.12), v(1.77, .44, 2.78), Math.PI, 'rest', v(1.96, 1.12, 2.64), 1.9)
    : beat(v(-3.9, .33, 1.82), v(-3.9, .074, 2.15), 0, 'rest', v(-3.75, 1.04, 2.55), 1.92);
  const beats: Partial<Record<ActionId, Beat>> = home ? {
    breakfast: kitchen, cook: kitchen, personal: station, rest,
    sleep: beat(v(-1.76, .33, 1.91), v(-2.52, 1.18, 2.28), 0, 'sleep', v(-2.9, 1.02, 1.6), 1.9),
  } : {
    focus: station, rush: station, test: station, ai: station, overtime: station, rest, 'lunch-break': rest,
    lunch: beat(v(-3, .33, 1.88), v(-3, .074, 2.15), 0, 'eat', v(-3.1, 1.07, 2.57), 2.1),
    talk: beat(v(2.45, .33, -.29), v(2.45, .33, -.29), 1.98, 'talk', v(2.9, 1.16, -.51), 2.1),
  };
  const step = new THREE.Vector3();
  const origin = new THREE.Vector3();
  const stageOrigin = new THREE.Vector3();
  const route: { point: THREE.Vector3; length: number; start: number }[] = [];
  let routeLength = 0;
  let current: ActionId | undefined;
  let started = 0;
  let duration = 0;
  let lastStage = -1;
  let stageStarted = 0;
  let layStarted = 0;
  let approached = false;

  function prepareRoute(stand: THREE.Vector3) {
    const points: THREE.Vector3[] = [origin];
    // Walk around the coffee table rather than across it when coming from the sofa.
    if (home && origin.x > 1.1 && origin.z > 1.8 && stand.z < .75) points.push(v(.87, .33, origin.z), v(.87, .33, .65));
    else if (home && stand.x > 1.1 && stand.z > 1.8 && origin.z < .75) points.push(v(.87, .33, .65), v(.87, .33, stand.z));
    points.push(stand);
    route.length = 0; routeLength = 0;
    points.slice(1).forEach((point, index) => {
      const length = point.distanceTo(points[index]);
      route.push({ point, length, start: routeLength }); routeLength += length;
    });
  }

  function clear() {
    if (!current) return;
    const previousBeat = home && (current === 'cook' || current === 'breakfast') && lastStage >= 2 ? kitchenSeat : beats[current];
    if (previousBeat) player.position.copy(previousBeat.stand);
    reset(player, parts);
    if (colleague && colleagueParts) { reset(colleague, colleagueParts); colleague.rotation.y = colleagueFacing; colleague.getObjectByName('playerDiamond')!.visible = false; }
    for (const item of propGroups) item.visible = false;
    monitor?.(undefined, 0, true);
    current = undefined;
  }

  return { clear, update(action, now, delta, still) {
    const firstBeat = beats[action.id];
    if (!firstBeat) { clear(); return; }
    const detail = home && (action.id === 'cook' || action.id === 'breakfast') && action.stage >= 2 ? kitchenSeat : firstBeat;
    if (current !== action.id) {
      clear();
      current = action.id;
      started = now;
      origin.copy(player.position);
      prepareRoute(firstBeat.stand);
      duration = Math.min(900, routeLength * 155);
      approached = false;
      lastStage = -1;
    }
    if (action.stage !== lastStage) {
      if (lastStage < 1 && action.stage >= 1) layStarted = now;
      stageStarted = now; lastStage = action.stage; stageOrigin.copy(player.position);
    }
    reset(player, parts);
    const frame = still ? .72 : (now - stageStarted) / 1000;
    const phase = frame * 11;
    const walkProgress = still ? 1 : Math.min(1, (now - started) / Math.max(1, duration));
    if (walkProgress < 1) {
      const traveled = walkProgress * routeLength;
      let index = 0;
      while (index < route.length - 1 && route[index].start + route[index].length < traveled) index++;
      const segment = route[index];
      const start = index ? route[index - 1].point : origin;
      player.position.lerpVectors(start, segment.point, Math.min(1, (traveled - segment.start) / Math.max(segment.length, .001)));
      step.subVectors(segment.point, start);
      player.rotation.y = approachAngle(player.rotation.y, Math.atan2(step.x, step.z), Math.min(1, delta * 14));
      const walk = Math.sin((now - started) / 73) * .53;
      parts.leftLeg.rotation.x = walk; parts.rightLeg.rotation.x = -walk;
      parts.leftArm.rotation.x = -walk; parts.rightArm.rotation.x = walk;
      player.position.y += Math.abs(walk) * .045;
      return detail.camera;
    }
    if (!approached) { approached = true; player.position.copy(detail.stand); }
    const blend = still ? 1 : THREE.MathUtils.smoothstep(now - Math.max(started + duration, stageStarted), 0, 270);
    const sleeping = detail.kind === 'sleep' && action.stage > 0;
    const resting = detail.kind === 'rest' && action.stage > 0 && (action.id !== 'lunch-break' || action.stage < 2);
    const seated = detail.kind === 'desk' || detail.kind === 'eat';
    const pose = sleeping || resting || seated ? detail.pose : detail.stand;
    player.position.lerpVectors(stageStarted > started + duration ? stageOrigin : detail.stand, pose, blend);
    player.rotation.y = approachAngle(player.rotation.y, detail.facing, still ? 1 : Math.min(1, delta * 15));
    for (const item of propGroups) item.visible = false;

    switch (detail.kind) {
      case 'desk': {
        sit(parts);
        const waiting = (action.id === 'ai' || action.id === 'test') && action.stage === 1;
        const reviewing = action.stage >= 2;
        if (waiting) {
          parts.leftArm.rotation.x = -.38; parts.leftElbow.rotation.x = -.58;
          parts.rightArm.rotation.x = -.24; parts.rightElbow.rotation.x = -.46;
          player.rotation.x = -.035;
          parts.head.rotation.x = -.07 + (still ? 0 : Math.sin(frame * 2) * .045);
          parts.head.rotation.y = still ? 0 : Math.sin(frame * 2.3) * .11;
        } else {
          typeAtDesk(parts, phase * (action.id === 'rush' ? 1.6 : 1), still ? 0 : reviewing ? .35 : 1);
          parts.head.rotation.x = .075 + (still ? 0 : Math.sin(frame * 2.8) * .055);
          if (reviewing) parts.head.rotation.y = still ? .12 : Math.sin(frame * 3) * .14;
          player.rotation.x = .055;
        }
        monitor?.(action, now, still);
        break;
      }
      case 'sleep':
        if (!sleeping) break;
        player.rotation.x = -Math.PI / 2 * (still ? 1 : THREE.MathUtils.smoothstep(now - layStarted, 0, 270));
        parts.head.rotation.x = -.1;
        parts.leftArm.rotation.z = .18; parts.rightArm.rotation.z = -.14;
        if (props.sleep) {
          props.sleep.visible = blend > .8;
          props.sleep.position.y = 1.75 + (still ? 0 : Math.sin(frame * 2.2) * .09);
        }
        player.getObjectByName('playerDiamond')!.visible = false;
        break;
      case 'cook': {
        const preparing = action.id === 'cook' && action.stage === 0;
        const plating = action.id === 'breakfast' && action.stage === 1;
        parts.leftArm.rotation.set(-.63, 0, .15); parts.leftElbow.rotation.x = -.74;
        parts.rightArm.rotation.set(-.63 + Math.sin(phase * (preparing ? 1.4 : 1)) * (preparing ? .24 : .13), 0, -.24 + Math.cos(phase) * .18);
        parts.rightElbow.rotation.x = -.85 + Math.cos(phase) * .2;
        parts.head.rotation.x = .26;
        if (props.board) props.board.visible = preparing;
        if (props.utensil) props.utensil.visible = !plating;
        if (props.plate) props.plate.visible = plating;
        if (props.pan) { props.pan.visible = !preparing; props.pan.rotation.y = Math.sin(phase) * .07; }
        if (props.steam && !preparing) {
          props.steam.visible = true;
          props.steam.children.forEach((puff, index) => {
            const progress = (frame * .9 + index / props.steam!.children.length) % 1;
            puff.position.y = progress * .6;
            puff.position.x = Math.sin(progress * 4 + index) * .16;
            puff.scale.setScalar(.65 + progress * .65);
          });
        }
        break;
      }
      case 'eat': {
        sit(parts);
        const eating = home || action.stage === 1;
        const lifting = eating ? (still ? .86 : .5 + .5 * Math.cos(frame * 5.4 - 2)) : 0;
        parts.leftArm.rotation.set(-.59, 0, .23); parts.leftElbow.rotation.x = -.62;
        parts.rightArm.rotation.set(-.56 - lifting * .49, 0, -.13 - lifting * .67);
        parts.rightElbow.rotation.x = -.57 - lifting * 1.01;
        parts.head.rotation.x = .12 + lifting * .13;
        if (props.meal) props.meal.visible = eating;
        if (props.plate) props.plate.visible = true;
        break;
      }
      case 'rest':
        if (!resting) break;
        sit(parts);
        player.rotation.x = home ? -.12 : .065;
        parts.head.rotation.x = (home ? -.12 : .25) + (still ? 0 : Math.sin(frame * 1.8) * .07);
        parts.leftArm.rotation.set(-.31, 0, .1); parts.leftElbow.rotation.x = -.34;
        parts.rightArm.rotation.set(-.38, 0, -.13); parts.rightElbow.rotation.x = home ? -1.04 - (still ? .2 : Math.sin(frame * 3) * .29) : -.26;
        if (action.stage >= 2) {
          const reach = still ? .85 : Math.sin(Math.min(1, frame / .9) * Math.PI);
          parts.leftArm.rotation.set(-1.95 * reach, 0, -.9 * reach);
          parts.rightArm.rotation.set(-1.95 * reach, 0, .9 * reach);
          parts.leftElbow.rotation.x = parts.rightElbow.rotation.x = -.28;
        } else if (props.cup) props.cup.visible = home;
        break;
      case 'talk': {
        const speaking = action.stage === 1;
        const gesture = still ? .55 : Math.sin(phase * .52) * .45;
        parts.rightArm.rotation.set(speaking ? -.67 + gesture * .36 : -.17, 0, speaking ? -.33 : -.1);
        parts.rightElbow.rotation.x = speaking ? -1.03 + gesture : -.2;
        parts.head.rotation.x = .08 + gesture * .12;
        if (colleague && colleagueParts) {
          colleague.rotation.y = -1.16;
          colleagueParts.head.rotation.x = speaking ? gesture * .23 : -.09;
          colleagueParts.rightArm.rotation.x = action.stage === 2 ? -.59 + gesture * .3 : -.08;
          colleagueParts.rightElbow.rotation.x = action.stage === 2 ? -.96 - gesture * .24 : -.14;
        }
        break;
      }
    }
    return detail.camera;
  } };
}
