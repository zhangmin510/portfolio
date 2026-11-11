import { useEffect, useRef } from 'react';
import { LOCATIONS } from '../content/game';
import type { LocationId, TravelMode } from '../domain/types';
import type { RoutePoint } from '../world/travelRoutes';
import { Icon } from './Icon';
import '../styles/travel.css';

export const travelModes = {
  drive: { label: '开车', icon: 'car', moving: '正在开车' },
  transit: { label: '社区巴士', icon: 'bus', moving: '正在乘坐社区巴士' },
  walk: { label: '步行', icon: 'walk', moving: '正在步行' },
} satisfies Record<TravelMode, { label: string; icon: string; moving: string }>;

export function TripStatus({ from, to, mode, progress, onSkip }: {
  from: LocationId;
  to: LocationId;
  mode: TravelMode;
  progress: () => number;
  onSkip: () => void;
}) {
  const meter = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    let frame: number;
    function update() {
      if (meter.current) meter.current.style.transform = `scaleX(${progress()})`;
      frame = requestAnimationFrame(update);
    }
    frame = requestAnimationFrame(update);
    return () => cancelAnimationFrame(frame);
  }, [progress]);

  return <div className="trip-status">
    <div role="status" className="trip-route">
      <Icon name={travelModes[mode].icon} size={23} />
      <div><strong>{travelModes[mode].moving}</strong><span>{LOCATIONS[from].name} → {LOCATIONS[to].name}</span></div>
    </div>
    <div className="trip-progress" aria-hidden="true"><span ref={meter} /></div>
    <button onClick={onSkip}>跳过动画 <Icon name="chevron" size={15} /></button>
  </div>;
}

export function TripFallback({ path, mode, progress }: {
  path: readonly RoutePoint[];
  mode: TravelMode;
  progress: () => number;
}) {
  const road = useRef<SVGPathElement>(null);
  const traveler = useRef<SVGGElement>(null);
  useEffect(() => {
    const line = road.current;
    const marker = traveler.current;
    if (!line || !marker) return;
    const length = line.getTotalLength();
    let frame: number;
    function update() {
      const distance = length * progress();
      const point = line!.getPointAtLength(distance);
      const before = line!.getPointAtLength(Math.max(0, distance - .4));
      const after = line!.getPointAtLength(Math.min(length, distance + .4));
      const angle = Math.atan2(after.y - before.y, after.x - before.x) * 180 / Math.PI;
      marker!.setAttribute('transform', `translate(${point.x} ${point.y}) rotate(${angle})`);
      frame = requestAnimationFrame(update);
    }
    update();
    return () => cancelAnimationFrame(frame);
  }, [path, progress]);

  const start = path[0];
  const end = path[path.length - 1];
  if (!start || !end) return null;
  const xMin = Math.min(...path.map(point => point.x));
  const xMax = Math.max(...path.map(point => point.x));
  const zMin = Math.min(...path.map(point => point.z));
  const zMax = Math.max(...path.map(point => point.z));
  const route = path.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.z}`).join(' ');
  return <svg className="trip-fallback" viewBox={`${xMin - 9} ${zMin - 9} ${xMax - xMin + 18} ${zMax - zMin + 18}`} role="img" aria-label="栈城出行路线动画">
    <path d={route} fill="none" stroke="#d8d4bf" strokeWidth="6" strokeLinejoin="round" strokeLinecap="round" />
    <path ref={road} d={route} fill="none" stroke="#566467" strokeWidth="4.6" strokeLinejoin="round" strokeLinecap="round" />
    <path d={route} fill="none" stroke="#f6edbf" strokeWidth=".18" strokeDasharray=".65 .5" />
    <circle cx={start.x} cy={start.z} r=".7" fill="#fff9e8" />
    <circle cx={end.x} cy={end.z} r=".9" fill="#75ca9b" stroke="#fff9e8" strokeWidth=".2" />
    <g ref={traveler} transform={`translate(${start.x} ${start.z})`}>
      {mode === 'walk' ? <circle r=".7" fill="#ffdb89" stroke="#374644" strokeWidth=".18" /> : <>
        <rect x={mode === 'transit' ? -1.55 : -1.2} y="-.66" width={mode === 'transit' ? 3.1 : 2.4} height="1.32" rx=".32" fill={mode === 'transit' ? '#ffc85d' : '#3ed6a6'} stroke="#263d3d" strokeWidth=".18" />
        <rect x="-.44" y="-.49" width=".9" height=".98" rx=".16" fill="#244955" />
        <path d="M.9 -.43v.2m0 .46v.2" stroke="#fff5ca" strokeWidth=".15" strokeLinecap="round" />
      </>}
    </g>
  </svg>;
}
