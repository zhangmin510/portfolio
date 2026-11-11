import * as THREE from 'three';
import { ACTION_SCENES } from '../content/actionScenes';
import type { ActionId, LocationId } from '../domain/types';
import { getCityPlayerPosition } from './city';
import { makePerson } from './room';
import { createTravelSampler } from './travelVehicle';

type Performance = { id: ActionId; stage: number };
type OutdoorLocation = 'cafe' | 'store' | 'park' | 'makerspace';

const outdoorActions: Partial<Record<LocationId, readonly ActionId[]>> = {
  cafe: ['coffee', 'personal', 'rest'],
  store: ['groceries', 'lunch', 'rest'],
  park: ['walk', 'midweek-walk', 'rest'],
  makerspace: ['meetup', 'personal', 'rest'],
};

const parkLoop = createTravelSampler([
  { x: -11.7, z: 16.42 },
  { x: -15.5, z: 16.42 },
  { x: -15.5, z: 15.55 },
  { x: -11.7, z: 15.55 },
  { x: -11.7, z: 16.42 },
]);

const parkBenchApproach = createTravelSampler([
  { x: -11.7, z: 16.42 },
  { x: -9.92, z: 16.42 },
  { x: -9.92, z: 17.68 },
  { x: -11.3, z: 17.32 },
]);

function rig(group: THREE.Group) {
  const joint = (name: string) => group.getObjectByName(name)!;
  return {
    group,
    leftLeg: joint('leftLeg'),
    rightLeg: joint('rightLeg'),
    leftKnee: joint('leftKnee'),
    rightKnee: joint('rightKnee'),
    leftArm: joint('leftArm'),
    rightArm: joint('rightArm'),
    leftElbow: joint('leftElbow'),
    rightElbow: joint('rightElbow'),
    head: joint('head'),
  };
}

type Rig = ReturnType<typeof rig>;

function resetPose(actor: Rig) {
  const { leftLeg, rightLeg, leftKnee, rightKnee, leftArm, rightArm, leftElbow, rightElbow, head } = actor;
  for (const joint of [leftLeg, rightLeg, leftKnee, rightKnee, leftArm, rightArm, leftElbow, rightElbow, head]) joint.rotation.set(0, 0, 0);
}

function walkPose(actor: Rig, distance: number, strength: number, reduceMotion: boolean) {
  const stride = reduceMotion ? 0 : Math.sin(distance * 7.5) * strength;
  actor.leftLeg.rotation.x = stride * .46;
  actor.rightLeg.rotation.x = -stride * .46;
  actor.leftKnee.rotation.x = Math.max(0, -stride) * .37;
  actor.rightKnee.rotation.x = Math.max(0, stride) * .37;
  actor.leftArm.rotation.x = -stride * .31;
  actor.rightArm.rotation.x = stride * .31;
  actor.group.position.y += reduceMotion ? 0 : Math.abs(stride) * .025;
}

function sit(actor: Rig, amount: number, seatHeight: number) {
  actor.group.position.y = THREE.MathUtils.lerp(actor.group.position.y, seatHeight - .72, amount);
  actor.leftLeg.rotation.x = -1.45 * amount;
  actor.rightLeg.rotation.x = -1.45 * amount;
  actor.leftKnee.rotation.x = 1.4 * amount;
  actor.rightKnee.rotation.x = 1.4 * amount;
}

function approach(actor: Rig, from: THREE.Vector3, target: THREE.Vector3, heading: number, time: number, reduceMotion: boolean) {
  const progress = THREE.MathUtils.smoothstep(time, 0, .77);
  actor.group.position.lerpVectors(from, target, progress);
  const walkingHeading = Math.atan2(target.x - from.x, target.z - from.z);
  const turn = THREE.MathUtils.smoothstep(time, .56, .95);
  const turnDelta = Math.atan2(Math.sin(heading - walkingHeading), Math.cos(heading - walkingHeading));
  actor.group.rotation.y = walkingHeading + turnDelta * turn;
  walkPose(actor, from.distanceTo(target) * progress, 1 - turn, reduceMotion);
}

function makeProps(root: THREE.Group) {
  const cube = new THREE.BoxGeometry(1, 1, 1);
  const round = new THREE.CylinderGeometry(1, 1, 1, 12);
  const materials = new Map<string, THREE.MeshStandardMaterial>();
  function shape(parent: THREE.Group, geometry: THREE.BufferGeometry, color: string, x: number, y: number, z: number, sx: number, sy: number, sz: number) {
    let material = materials.get(color);
    if (!material) {
      material = new THREE.MeshStandardMaterial({ color, roughness: .72 });
      materials.set(color, material);
    }
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(x, y, z);
    mesh.scale.set(sx, sy, sz);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  }
  const box = (parent: THREE.Group, color: string, x: number, y: number, z: number, w: number, h: number, d: number) =>
    shape(parent, cube, color, x, y, z, w, h, d);
  const cylinder = (parent: THREE.Group, color: string, x: number, y: number, z: number, r: number, h: number) =>
    shape(parent, round, color, x, y, z, r, h, r);

  function prop(name: string, x: number, y: number, z: number) {
    const group = new THREE.Group();
    group.name = name;
    group.visible = false;
    group.position.set(x, y, z);
    root.add(group);
    return group;
  }

  function person(name: string, shirt: string) {
    const person = makePerson(shirt, '#c79773');
    person.name = name;
    person.visible = false;
    person.getObjectByName('playerDiamond')!.visible = false;
    root.add(person);
    return rig(person);
  }

  function seat(name: string, x: number, y: number, z: number) {
    const stool = prop(name, x, y, z);
    box(stool, '#b78b60', 0, .45, 0, .59, .12, .54);
    for (const dx of [-.2, .2]) {
      box(stool, '#56756b', dx, .2, 0, .08, .4, .45);
    }
    return stool;
  }

  function laptop(name: string, x: number, y: number, z: number, heading: number) {
    const laptop = prop(name, x, y, z);
    laptop.rotation.y = heading;
    box(laptop, '#526761', 0, .03, 0, .43, .045, .31);
    box(laptop, '#a3b3ab', 0, .055, -.025, .33, .012, .15);
    const lid = new THREE.Group();
    lid.position.set(0, .05, .15);
    lid.rotation.x = .14;
    laptop.add(lid);
    box(lid, '#536962', 0, .158, 0, .43, .32, .04);
    box(lid, '#203d45', 0, .161, -.024, .376, .27, .014);
    const lines = ['#7ac1a6', '#d6bf76', '#89a9c8', '#7ac1a6'].map((color, index) =>
      box(lid, color, index % 2 ? -.022 : -.05, .24 - index * .052, -.033, .21 - index * .025, .015, .005));
    return { laptop, lid, lines };
  }

  const cup = prop('cafe-coffee-cup', -11.54, .865, 11.48);
  const mug = cylinder(cup, '#edf2db', 0, 0, 0, .102, .18);
  cylinder(cup, '#aa7555', 0, .091, 0, .082, .018);
  const handle = new THREE.Mesh(new THREE.TorusGeometry(.053, .018, 6, 12), mug.material);
  handle.position.set(.101, 0, 0);
  cup.add(handle);
  const cafeLaptop = laptop('cafe-laptop', -11.77, .77, 11.3, -Math.PI / 2);

  const counter = prop('store-counter', -20.05, 0, 9.78);
  box(counter, '#a8866b', 0, .48, 0, 1.47, .95, .48);
  box(counter, '#e5d3b0', 0, .978, 0, 1.57, .1, .62);
  box(counter, '#53736a', .47, 1.09, -.12, .34, .12, .2);
  box(counter, '#9ec0a9', .47, 1.17, -.16, .25, .04, .085);
  const bag = prop('store-grocery-bag', -20.27, 1.028, 9.95);
  box(bag, '#c48b4a', 0, .16, 0, .27, .32, .18);
  box(bag, '#ddb273', 0, .332, 0, .286, .048, .193);
  shape(bag, new THREE.ConeGeometry(1, 1, 3), '#ece1c2', -.071, .386, .02, .082, .105, .082);
  box(bag, '#486a57', -.071, .361, .044, .067, .04, .09);
  cylinder(bag, '#d9b16f', .076, .367, .029, .059, .073);
  cylinder(bag, '#eae7d0', .076, .404, .029, .065, .018);
  for (const x of [-.085, .085]) box(bag, '#b88148', x, .391, -.045, .022, .115, .018);
  box(bag, '#b88148', 0, .449, -.045, .19, .025, .018);
  const bowl = prop('store-noodle-bowl', -20.06, 1.028, 9.99);
  cylinder(bowl, '#f0e5c9', 0, .065, 0, .186, .13);
  cylinder(bowl, '#cca45e', 0, .133, 0, .156, .026);
  for (const x of [-.08, .02, .1]) box(bowl, '#81995c', x, .151, x * .3, .053, .027, .042);
  box(bowl, '#af8051', -.045, .177, .019, .29, .016, .017).rotation.y = .36;
  const seller = person('store-cashier', '#779475');
  seller.group.position.set(-20.05, .24, 9.12);
  const storeSeat = seat('store-stool', -21.85, -.03, 10.57);

  const workbench = prop('makerspace-workbench', 15.5, .24, 11.04);
  box(workbench, '#a9754e', 0, .82, 0, 1.55, .1, .63);
  for (const x of [-.58, .58]) box(workbench, '#52716a', x, .39, 0, .1, .8, .55);
  const demo = laptop('makerspace-demo-laptop', 15.49, 1.11, 11.09, Math.PI);
  const demoPhone = prop('makerspace-demo-phone', 15.9, 1.11, 11.19);
  box(demoPhone, '#314d4b', 0, .035, 0, .15, .035, .26);
  box(demoPhone, '#80b5a1', 0, .057, 0, .12, .01, .224);
  const demoList = box(demoPhone, '#e6efcd', 0, .066, .022, .084, .005, .12);
  for (const z of [-.006, .029, .064]) box(demoPhone, '#52817d', -.007, .071, z, .055, .005, .008);
  const makersSeat = seat('makerspace-stool', 12.21, .24, 11.12);
  const maker = person('makerspace-visitor', '#6f829f');
  maker.group.position.set(16.47, .24, 11.54);
  maker.group.rotation.y = -1.85;

  const parkFriend = person('park-friend', '#6f829f');
  const stageProps = [cup, cafeLaptop.laptop, counter, bag, bowl, seller.group, storeSeat,
    workbench, demo.laptop, demoPhone, maker.group, makersSeat, parkFriend.group];
  return { stageProps, cup, cafeLaptop, counter, bag, bowl, seller, storeSeat, workbench, demo, demoPhone, demoList, maker, makersSeat, parkFriend };
}

const cafeSeat = new THREE.Vector3(-11.15, .165, 11.3);
const storeCounter = new THREE.Vector3(-20.11, -.03, 10.38);
const storeStool = new THREE.Vector3(-21.85, -.03, 10.57);
const makersBench = new THREE.Vector3(15.29, .24, 11.57);
const makersStool = new THREE.Vector3(12.21, .24, 11.12);
const coffeeOnTable = new THREE.Vector3(-11.54, .865, 11.48);
const bagOnCounter = new THREE.Vector3(-20.27, 1.028, 9.95);
const bowlOnCounter = new THREE.Vector3(-20.06, 1.028, 9.99);

export function createCityPerformance(group: THREE.Group, player: THREE.Group) {
  const actor = rig(player);
  const props = makeProps(group);
  const handPosition = new THREE.Vector3();
  let activeId: ActionId | undefined;
  let activeStage = -1;
  let activeLocation: LocationId | undefined;
  let stageElapsed = 0;
  let lastFrame = 0;

  function hold(prop: THREE.Group, origin: THREE.Vector3, blend: number, height: number, tilt = 0) {
    actor.rightElbow.localToWorld(handPosition.set(0, -.31, .055));
    group.worldToLocal(handPosition);
    handPosition.y += height;
    prop.position.lerpVectors(origin, handPosition, blend);
    prop.rotation.set(tilt * blend, actor.group.rotation.y * blend, 0);
  }

  function typeAt(laptop: typeof props.cafeLaptop, stage: number, time: number, motion: boolean, seated: boolean) {
    laptop.laptop.visible = true;
    laptop.lid.rotation.x = .14 - (stage === 0 ? (1 - THREE.MathUtils.smoothstep(time, .57, .94)) * 1.72 : 0);
    for (const [index, line] of laptop.lines.entries()) line.visible = stage !== 1 || time >= index * .21;
    if (stage === 0) return;
    const typing = stage === 1 && motion ? Math.sin(time * Math.PI * 13) * .13 : 0;
    actor.head.rotation.x = .19;
    actor.leftArm.rotation.x = -.7 + typing;
    actor.rightArm.rotation.x = -.73 - typing;
    actor.leftArm.rotation.z = .17;
    actor.rightArm.rotation.z = -.17;
    actor.leftElbow.rotation.x = (seated ? -.81 : -.47) - typing;
    actor.rightElbow.rotation.x = (seated ? -.85 : -.51) + typing;
  }

  function restPose(stage: number, time: number, motion: boolean) {
    if (stage === 0) return;
    actor.head.rotation.x = stage === 1 ? .16 : -.09;
    const stretch = stage === 2 ? (motion ? Math.sin(time * Math.PI) : .56) : 0;
    actor.leftArm.rotation.z = -.86 * stretch;
    actor.rightArm.rotation.z = .86 * stretch;
    actor.leftArm.rotation.x = -.48 * stretch;
    actor.rightArm.rotation.x = -.48 * stretch;
  }

  return (performance: Performance | undefined, locationId: LocationId, elapsedMs: number, reduceMotion: boolean) => {
    if (!performance || !outdoorActions[locationId]?.includes(performance.id) || !ACTION_SCENES[performance.id][performance.stage]) {
      if (activeId) {
        resetPose(actor);
        actor.group.position.copy(getCityPlayerPosition(locationId));
        actor.group.rotation.y = 0;
        for (const prop of props.stageProps) prop.visible = false;
        activeId = undefined;
      }
      return false;
    }

    const { id, stage } = performance;
    const steps = ACTION_SCENES[id];
    if (activeId !== id || activeStage !== stage || activeLocation !== locationId) {
      stageElapsed = 0;
      activeId = id;
      activeStage = stage;
      activeLocation = locationId;
    } else {
      stageElapsed += THREE.MathUtils.clamp(elapsedMs - lastFrame, 0, 100);
    }
    lastFrame = elapsedMs;
    const time = reduceMotion ? (stage === 0 ? .89 : .63) : Math.min(1, stageElapsed / steps[stage].milliseconds);
    const motion = !reduceMotion;
    const location = locationId as OutdoorLocation;
    const entrance = getCityPlayerPosition(location);
    resetPose(actor);
    for (const prop of props.stageProps) prop.visible = false;

    if (location === 'park') {
      if (id === 'rest') {
        const route = parkBenchApproach(stage === 0 ? THREE.MathUtils.smoothstep(time, 0, .78) : 1);
        actor.group.position.set(route.x, .12, route.z);
        actor.group.rotation.y = stage === 0 && time < .73 ? route.heading : 0;
        if (stage === 0) walkPose(actor, route.distance, 1 - THREE.MathUtils.smoothstep(time, .66, .84), reduceMotion);
        sit(actor, stage === 0 ? THREE.MathUtils.smoothstep(time, .76, 1) : 1, .7);
        restPose(stage, time, motion);
        return true;
      }
      const total = steps.reduce((sum, step) => sum + step.milliseconds, 0);
      const before = steps.slice(0, stage).reduce((sum, step) => sum + step.milliseconds, 0);
      const progress = (before + time * steps[stage].milliseconds) / total;
      const route = parkLoop(progress);
      actor.group.position.set(route.x, .18, route.z);
      actor.group.rotation.y = route.heading;
      walkPose(actor, route.distance, 1, reduceMotion);
      if (id === 'midweek-walk') {
        const companion = props.parkFriend;
        const follower = parkLoop((progress + .108) % 1);
        resetPose(companion);
        companion.group.visible = true;
        companion.group.position.set(follower.x, .18, follower.z);
        companion.group.rotation.y = follower.heading;
        walkPose(companion, follower.distance, stage === 2 ? .5 : 1, reduceMotion);
        if (stage === 1) {
          actor.head.rotation.y = -.18;
          companion.head.rotation.y = .25;
          companion.rightArm.rotation.x = -.43 - (motion ? .16 * Math.sin(time * Math.PI * 4) : 0);
          companion.rightElbow.rotation.x = -.62;
        } else if (stage === 2) {
          companion.head.rotation.y = -.36;
          companion.rightArm.rotation.x = -1.21;
          companion.rightElbow.rotation.x = -.91;
          companion.rightElbow.rotation.z = motion ? Math.sin(time * Math.PI * 7) * .29 : .18;
        }
      }
      return true;
    }

    const target = location === 'cafe' ? cafeSeat
      : location === 'store' ? id === 'rest' ? storeStool : storeCounter
      : id === 'rest' ? makersStool : makersBench;
    const heading = location === 'cafe' ? -Math.PI / 2
      : location === 'store' ? id === 'rest' ? .25 : Math.PI - .1
      : id === 'rest' ? .32 : Math.PI - .29;
    if (stage === 0) {
      approach(actor, entrance, target, heading, time, reduceMotion);
    } else {
      actor.group.position.copy(target);
      actor.group.rotation.y = heading;
    }

    if (location === 'cafe') {
      sit(actor, stage === 0 ? THREE.MathUtils.smoothstep(time, .72, 1) : 1, .525);
      if (id === 'personal') typeAt(props.cafeLaptop, stage, time, motion, true);
      if (id === 'rest') restPose(stage, time, motion);
      if (id === 'coffee') {
        props.cup.visible = true;
        const pickUp = stage === 1 ? THREE.MathUtils.smoothstep(time, .04, .31)
          : stage === 2 ? 1 - THREE.MathUtils.smoothstep(time, .02, .51) : 0;
        const sip = stage === 1 ? THREE.MathUtils.smoothstep(time, .29, .65)
          : stage === 2 ? 1 - THREE.MathUtils.smoothstep(time, 0, .29) : 0;
        actor.rightArm.rotation.x += -.71 * pickUp - .35 * sip;
        actor.rightArm.rotation.z -= .24 * pickUp + .36 * sip;
        actor.rightElbow.rotation.x = -.77 * pickUp - .43 * sip;
        actor.rightElbow.rotation.z = -.5 * sip;
        actor.head.rotation.x = .1 * sip;
        if (stage === 2) actor.head.rotation.y = -.45 * THREE.MathUtils.smoothstep(time, .48, .94);
        hold(props.cup, coffeeOnTable, pickUp, .035, -.19 * sip);
      }
      return true;
    }

    if (id === 'rest') {
      (location === 'store' ? props.storeSeat : props.makersSeat).visible = true;
      sit(actor, stage === 0 ? THREE.MathUtils.smoothstep(time, .73, 1) : 1, target.y + .51);
      restPose(stage, time, motion);
      return true;
    }

    if (location === 'store') {
      const { counter, bag, bowl, seller } = props;
      counter.visible = true;
      seller.group.visible = true;
      resetPose(seller);
      if (id === 'groceries') {
        bag.visible = true;
        const pickup = stage === 1 ? THREE.MathUtils.smoothstep(time, .38, .68) : stage === 2 ? 1 : 0;
        const reach = stage === 1 ? Math.sin(time * Math.PI) : 0;
        seller.leftArm.rotation.x = -.84 * reach;
        seller.leftElbow.rotation.x = -.55 * reach;
        if (stage === 1) {
          actor.rightArm.rotation.x = -1.02 * reach;
          actor.rightElbow.rotation.x = -.54 * reach;
          actor.head.rotation.x = .18 * reach;
        }
        if (stage === 2) {
          const out = THREE.MathUtils.smoothstep(time, .18, 1);
          actor.group.position.lerpVectors(target, entrance, out);
          actor.group.rotation.y = THREE.MathUtils.lerp(heading, Math.atan2(entrance.x - target.x, entrance.z - target.z) + Math.PI * 2, THREE.MathUtils.smoothstep(time, 0, .26));
          walkPose(actor, target.distanceTo(entrance) * out, 1 - THREE.MathUtils.smoothstep(time, .8, 1), reduceMotion);
        }
        hold(bag, bagOnCounter, pickup, -.41, -.06);
      } else {
        bowl.visible = true;
        const bites = stage === 1 ? THREE.MathUtils.smoothstep(time, .08, .32)
          : stage === 2 ? 1 - THREE.MathUtils.smoothstep(time, .01, .7) : 0;
        actor.rightArm.rotation.x += -1.04 * bites;
        actor.rightArm.rotation.z -= .36 * bites;
        actor.rightElbow.rotation.x = -1.12 * bites;
        actor.leftArm.rotation.x += -.79 * bites;
        actor.leftElbow.rotation.x = -.69 * bites;
        actor.head.rotation.x = bites * (.24 + (motion ? Math.sin(time * Math.PI * 6) * .07 : 0));
        hold(bowl, bowlOnCounter, bites, -.045, -.13 * bites);
      }
      return true;
    }

    props.workbench.visible = true;
    typeAt(props.demo, stage, time, motion, false);
    if (id === 'meetup') {
      const { maker, demoPhone, demoList } = props;
      maker.group.visible = true;
      resetPose(maker);
      demoPhone.visible = true;
      demoList.visible = stage === 2 || (stage === 1 && time > .46);
      if (stage === 1) {
        actor.rightArm.rotation.x = -.91;
        actor.rightArm.rotation.z = -.17;
        actor.rightElbow.rotation.x = -.56 - (motion ? Math.sin(time * Math.PI * 5) * .17 : 0);
        maker.head.rotation.x = .24;
      } else if (stage === 2) {
        actor.head.rotation.y = -.63;
        maker.head.rotation.y = .22;
        maker.rightArm.rotation.x = -.68;
        maker.rightElbow.rotation.x = -.69 + (motion ? Math.sin(time * Math.PI * 4) * .2 : 0);
      }
    }
    return true;
  };
}
