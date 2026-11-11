import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import type { ActionId, LocationId } from '../domain/types';
import { createRoomModel } from '../world/room';
import type { WorldHotspot, WorldModel } from '../world/room';
import { createCityModel } from '../world/city';
import { createTravelStage } from '../world/travelVehicle';
import type { WorldTravel } from '../world/travelVehicle';
import { CityScene, RoomScene } from './Scenes';
import '../styles/world.css';

export type { WorldTravel } from '../world/travelVehicle';

export interface WorldSceneProps {
  mode: 'home' | 'office' | 'city';
  name: string;
  minute: number;
  locationId: LocationId;
  activity: ActionId | null;
  revision: number;
  onAction: (id: ActionId) => void;
  onLocation: (id: LocationId) => void;
  cameraCommand?: { kind: 'reset' | 'rotate' | 'zoom-in' | 'zoom-out'; nonce: number };
  reduceMotion?: boolean;
  onReady?: (ready: boolean) => void;
  showNames?: boolean;
  travel?: WorldTravel;
  travelFallback?: ReactNode;
  onTravelPresented?: (path: WorldTravel['path']) => void;
}

type CameraRig = { camera: THREE.OrthographicCamera; controls: OrbitControls; reset: () => void };

const actionGlyph: Partial<Record<ActionId, string>> = { sleep: '🛏️', personal: '💻', cook: '🍳', breakfast: '🍳', rest: '🛋️', focus: '💻', test: '📋', talk: '💬', lunch: '🍜' };
const locationGlyph: Record<LocationId, string> = { home: '🏠', office: '🏢', cafe: '☕', store: '🛒', park: '🌳', makerspace: '💡' };
const actionLabel: Partial<Record<ActionId, string>> = {
  sleep: '好好睡一觉', personal: '写个人项目', cook: '做点吃的', focus: '开始工作',
  test: '测试与评审', talk: '和林工聊聊', lunch: '吃个午饭', rest: '休息一下',
};

function setCityPlayerTarget(model: WorldModel, location: LocationId, target: THREE.Vector3) {
  const place = model.hotspots.find(item => item.id === location);
  if (!place || !model.player) return;
  target.set(place.position.x, model.player.position.y, place.position.z + (location === 'park' ? 0 : 4.6));
}

function disposeWorld(scene: THREE.Scene) {
  const geometries = new Set<THREE.BufferGeometry>();
  const materials = new Set<THREE.Material>();
  scene.traverse(object => {
    if (object instanceof THREE.Mesh) {
      geometries.add(object.geometry);
      (Array.isArray(object.material) ? object.material : [object.material]).forEach(value => materials.add(value));
    }
  });
  geometries.forEach(value => value.dispose());
  materials.forEach(value => {
    for (const property of Object.values(value)) if (property instanceof THREE.Texture) property.dispose();
    value.dispose();
  });
}

export function WorldScene(props: WorldSceneProps) {
  const { mode, cameraCommand, locationId, activity, revision } = props;
  const container = useRef<HTMLDivElement>(null);
  const labels = useRef<(HTMLButtonElement | null)[]>([]);
  const playerLabel = useRef<HTMLDivElement>(null);
  const rig = useRef<CameraRig | null>(null);
  const modelRef = useRef<WorldModel | null>(null);
  const latest = useRef(props);
  latest.current = props;
  const [hotspots, setHotspots] = useState<WorldHotspot[]>([]);
  const [fallback, setFallback] = useState(false);
  const target = useRef(new THREE.Vector3());
  const lighting = useRef<{ sun: THREE.DirectionalLight; hemi: THREE.HemisphereLight; scene: THREE.Scene } | null>(null);
  const lastActivityRevision = useRef(-1);
  const presentedTravelPaths = useRef(new WeakSet<WorldTravel['path']>());

  useEffect(() => {
    const host = container.current;
    if (!host) return;
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
    } catch {
      setFallback(true); latest.current.onReady?.(false); return;
    }
    let frame = 0;
    let contextLost = false;
    setFallback(false);
    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#a3b889');
    const camera = new THREE.OrthographicCamera(-15, 15, 10, -10, .1, 220);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true; controls.dampingFactor = .085;
    controls.screenSpacePanning = false; controls.enablePan = true;
    controls.minPolarAngle = .25; controls.maxPolarAngle = Math.PI / 2 - .14;
    controls.minZoom = mode === 'city' ? .55 : .65;
    controls.maxZoom = mode === 'city' ? 3.3 : 2.5;
    controls.rotateSpeed = .55; controls.panSpeed = .75; controls.zoomSpeed = .75;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.6));
    renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = .95;
    renderer.domElement.className = 'world-canvas';
    renderer.domElement.setAttribute('aria-label', mode === 'city' ? '可旋转缩放的栈城三维地图' : mode === 'home' ? '可旋转缩放的三维住处' : '可旋转缩放的三维办公室');
    renderer.domElement.setAttribute('role', 'img');
    host.prepend(renderer.domElement);

    const hemi = new THREE.HemisphereLight('#edf3f3', '#81916f', 1.75); scene.add(hemi);
    const sun = new THREE.DirectionalLight('#fffaf0', 2.8);
    sun.position.set(-18, 32, 16); sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048); sun.shadow.normalBias = .045; sun.shadow.bias = -.00015;
    const shadowBounds = mode === 'city' ? 42 : 18;
    Object.assign(sun.shadow.camera, { left: -shadowBounds, right: shadowBounds, top: shadowBounds, bottom: -shadowBounds, near: .5, far: 110 });
    sun.shadow.camera.updateProjectionMatrix(); sun.shadow.radius = 2;
    scene.add(sun);
    lighting.current = { sun, hemi, scene };
    const model = mode === 'city' ? createCityModel(latest.current.locationId) : createRoomModel(mode, latest.current.name);
    modelRef.current = model; scene.add(model.group);
    const travelStage = mode === 'city' ? createTravelStage(scene, camera, controls) : null;
    lastActivityRevision.current = latest.current.revision;
    setHotspots(model.hotspots);
    if (model.player) target.current.copy(model.player.position);

    function resize() {
      if (contextLost) return;
      const width = host!.clientWidth; const height = host!.clientHeight;
      if (!width || !height) return;
      const aspect = width / height;
      const baseHeight = mode === 'city' ? (aspect < .8 ? 67 : 48) : Math.max(14, 12.8 / aspect);
      camera.left = -baseHeight * aspect / 2; camera.right = baseHeight * aspect / 2;
      camera.top = baseHeight / 2; camera.bottom = -baseHeight / 2;
      camera.updateProjectionMatrix(); renderer.setSize(width, height, false);
    }
    const reset = () => {
      controls.target.set(0, mode === 'city' ? 0 : .8, mode === 'city' ? 2 : .3);
      camera.position.set(mode === 'city' ? 4 : 16, mode === 'city' ? 54 : 21, mode === 'city' ? 44 : 23);
      camera.zoom = 1; camera.updateProjectionMatrix(); controls.update();
    };
    reset(); resize();
    rig.current = { camera, controls, reset };
    const observer = new ResizeObserver(resize); observer.observe(host);
    const raycaster = new THREE.Raycaster(); const pointer = new THREE.Vector2();
    let downX = 0; let downY = 0; let pointerDown = false;
    function pickStart(event: PointerEvent) {
      if (latest.current.travel) return;
      downX = event.clientX; downY = event.clientY; pointerDown = true;
    }
    function pickEnd(event: PointerEvent) {
      if (latest.current.travel || !pointerDown || Math.hypot(event.clientX - downX, event.clientY - downY) > 7) { pointerDown = false; return; }
      pointerDown = false;
      const bounds = renderer.domElement.getBoundingClientRect();
      pointer.set((event.clientX - bounds.left) / bounds.width * 2 - 1, -(event.clientY - bounds.top) / bounds.height * 2 + 1);
      raycaster.setFromCamera(pointer, camera);
      const hit = raycaster.intersectObject(model.group, true)[0];
      if (!hit) return;
      let object: THREE.Object3D | null = hit.object;
      while (object && !object.userData.locationId && !object.userData.actionId) object = object.parent;
      if (object?.userData.locationId) { latest.current.onLocation(object.userData.locationId as LocationId); return; }
      if (object?.userData.actionId) { latest.current.onAction(object.userData.actionId as ActionId); return; }
      const near = model.hotspots.map(item => ({ item, distance: Math.hypot(hit.point.x - item.position.x, hit.point.z - item.position.z) })).sort((a, b) => a.distance - b.distance)[0];
      if (near && near.distance < (mode === 'city' ? 3.8 : 1.45)) {
        if (near.item.kind === 'location') latest.current.onLocation(near.item.id as LocationId);
        else latest.current.onAction(near.item.id as ActionId);
      }
    }
    renderer.domElement.addEventListener('pointerdown', pickStart);
    renderer.domElement.addEventListener('pointerup', pickEnd);

    function activateFallback() {
      if (contextLost) return;
      contextLost = true;
      cancelAnimationFrame(frame);
      observer.disconnect();
      renderer.domElement.style.display = 'none';
      rig.current = null;
      setFallback(true);
      latest.current.onReady?.(false);
    }

    function handleContextLoss(event: Event) {
      event.preventDefault();
      activateFallback();
    }
    renderer.domElement.addEventListener('webglcontextlost', handleContextLoss);

    let last = performance.now(); let ready = false;
    const projected = new THREE.Vector3();
    const playerPosition = new THREE.Vector3();
    const backWall = model.group.getObjectByName('cutaway-back-wall');
    const leftWall = model.group.getObjectByName('cutaway-left-wall');
    let wasTraveling = false;
    function animate(now: number) {
      if (contextLost) return;
      frame = requestAnimationFrame(animate);
      const elapsed = Math.max(0, (now - last) / 1000);
      const delta = Math.min(elapsed, .05);
      last = now;
      const { travel, reduceMotion, travelFallback } = latest.current;
      if (travel && reduceMotion && travelFallback) return;
      const traveler = travelStage?.(travel, elapsed, Boolean(reduceMotion));
      controls.update();
      camera.updateMatrixWorld();
      if (backWall) backWall.visible = camera.position.z >= controls.target.z;
      if (leftWall) leftWall.visible = camera.position.x >= controls.target.x;
      if (model.player) model.player.visible = !traveler;
      if (model.player && !traveler) {
        if (wasTraveling) {
          setCityPlayerTarget(model, latest.current.locationId, target.current);
          model.player.position.copy(target.current);
        }
        const distance = model.player.position.distanceTo(target.current);
        const moving = distance > .025;
        if (latest.current.reduceMotion) model.player.position.copy(target.current);
        else if (moving) {
          const step = target.current.clone().sub(model.player.position); step.y = 0;
          if (step.length() > .025) { model.player.rotation.y = Math.atan2(step.x, step.z); step.normalize().multiplyScalar(Math.min(distance, delta * 2.2)); model.player.position.add(step); }
        }
        const phase = now / 140;
        for (const [name, sign] of [['leftLeg', 1], ['rightLeg', -1], ['leftArm', -1], ['rightArm', 1]] as const) {
          const limb = model.player.getObjectByName(name);
          if (limb) limb.rotation.x = moving && !latest.current.reduceMotion ? Math.sin(phase) * .4 * sign : 0;
        }
        const diamond = model.player.getObjectByName('playerDiamond') ?? model.player.getObjectByName('player-marker');
        if (diamond && !latest.current.reduceMotion) diamond.rotation.y = now / 1500;
      }
      wasTraveling = Boolean(traveler);
      const displayedPlayer = traveler ?? model.player;
      if (displayedPlayer) {
        displayedPlayer.getWorldPosition(playerPosition);
        playerPosition.y += traveler && latest.current.travel?.mode !== 'walk' ? 2.38 : 2.6;
        projected.copy(playerPosition).project(camera);
        const tag = playerLabel.current;
        if (tag) { tag.style.transform = `translate(${(projected.x * .5 + .5) * host!.clientWidth}px,${(-projected.y * .5 + .5) * host!.clientHeight}px) translate(-50%,-100%)`; tag.style.visibility = projected.z > 1 || Math.abs(projected.x) > 1.05 || Math.abs(projected.y) > 1.05 ? 'hidden' : 'visible'; }
      }
      model.hotspots.forEach((item, index) => {
        const element = labels.current[index]; if (!element) return;
        projected.copy(item.position).project(camera);
        element.style.transform = `translate(${(projected.x * .5 + .5) * host!.clientWidth}px,${(-projected.y * .5 + .5) * host!.clientHeight}px) translate(-50%,-100%)`;
        element.style.visibility = projected.z > 1 || Math.abs(projected.x) > 1.03 || Math.abs(projected.y) > 1.03 ? 'hidden' : 'visible';
      });
      renderer.render(scene, camera);
      if (renderer.getContext().isContextLost()) {
        activateFallback();
        return;
      }
      if (!ready) { ready = true; latest.current.onReady?.(true); }
      if (traveler && travel && !presentedTravelPaths.current.has(travel.path)) {
        presentedTravelPaths.current.add(travel.path);
        latest.current.onTravelPresented?.(travel.path);
      }
    }
    frame = requestAnimationFrame(animate);
    return () => {
      cancelAnimationFrame(frame); observer.disconnect();
      renderer.domElement.removeEventListener('pointerdown', pickStart); renderer.domElement.removeEventListener('pointerup', pickEnd);
      renderer.domElement.removeEventListener('webglcontextlost', handleContextLoss);
      controls.dispose(); disposeWorld(scene); renderer.dispose(); renderer.forceContextLoss();
      renderer.domElement.remove(); rig.current = null; modelRef.current = null; lighting.current = null;
    };
  }, [mode]);

  useEffect(() => {
    const current = lighting.current; if (!current) return;
    const hour = Math.floor(props.minute / 60) % 24;
    const night = hour >= 19 || hour < 6;
    current.scene.background = new THREE.Color(night ? '#82968b' : '#a3b889');
    current.sun.color.set(night ? '#bbd1df' : '#fffaf0'); current.sun.intensity = night ? .9 : 2.8;
    current.hemi.intensity = night ? 1.35 : 1.75;
  }, [props.minute, mode]);

  useEffect(() => {
    const model = modelRef.current; if (!model?.player || lastActivityRevision.current === revision) return;
    lastActivityRevision.current = revision;
    if (mode === 'city') {
      setCityPlayerTarget(model, locationId, target.current);
    } else if (activity && model.anchors?.[activity]) target.current.copy(model.anchors[activity]!);
  }, [revision, activity, mode, locationId]);

  useEffect(() => {
    const current = rig.current; if (!current || !cameraCommand || latest.current.travel) return;
    if (cameraCommand.kind === 'reset') current.reset();
    else if (cameraCommand.kind === 'zoom-in' || cameraCommand.kind === 'zoom-out') {
      const factor = cameraCommand.kind === 'zoom-in' ? 1.2 : 1 / 1.2;
      current.camera.zoom = THREE.MathUtils.clamp(current.camera.zoom * factor, current.controls.minZoom, current.controls.maxZoom); current.camera.updateProjectionMatrix();
    } else {
      const offset = current.camera.position.clone().sub(current.controls.target);
      offset.applyAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI / 4); current.camera.position.copy(current.controls.target).add(offset);
    }
    current.controls.update();
  }, [cameraCommand]);

  const showTravelFallback = Boolean(props.travel && props.travelFallback && (fallback || props.reduceMotion));
  const sceneAttributes = {
    ref: container,
    className: `world-scene world-scene-${mode} ${props.showNames ? 'has-place-names' : ''}`,
    'data-renderer': fallback || showTravelFallback ? 'svg' : 'webgl',
    'data-travel-mode': props.travel?.mode,
  };

  if (showTravelFallback) return <div {...sceneAttributes}>{props.travelFallback}</div>;

  if (fallback) {
    return <div {...sceneAttributes}>
      <div className="world-fallback" inert={Boolean(props.travel)}>
        <div className="world-fallback-message">当前浏览器未启用三维加速，已切换简化视图。所有生活行动仍可操作。</div>
        {mode === 'city' ? <CityScene location={locationId} onSelect={props.onLocation} /> : (
          <RoomScene location={mode} name={props.name} minute={props.minute} activeAction={null} onSelect={props.onAction} />
        )}
      </div>
    </div>;
  }

  return <div {...sceneAttributes}>
    {!props.travel && <div className="world-hotspot-layer" aria-label={mode === 'city' ? '城市地点' : '房间物件'}>
      {hotspots.map((hotspot, index) => {
        const isLocation = hotspot.kind === 'location';
        const isCurrent = isLocation && hotspot.id === locationId;
        const label = isLocation ? `前往${hotspot.label}` : actionLabel[hotspot.id as ActionId] ?? hotspot.label;
        const glyph = isLocation ? locationGlyph[hotspot.id as LocationId] : actionGlyph[hotspot.id as ActionId] ?? '·';
        return <button
          key={`${hotspot.kind}:${hotspot.id}`}
          ref={element => { labels.current[index] = element; }}
          className={`world-hotspot ${isCurrent ? 'is-current' : ''}`}
          aria-label={label}
          onClick={() => isLocation ? props.onLocation(hotspot.id as LocationId) : props.onAction(hotspot.id as ActionId)}
        >
          <span className="world-hotspot-glyph">{glyph}</span>
          <span>{hotspot.label}</span>
          {isCurrent && <i />}
        </button>;
      })}
    </div>}
    <div className="world-player-label" ref={playerLabel}><span />{props.name}</div>
  </div>;
}
