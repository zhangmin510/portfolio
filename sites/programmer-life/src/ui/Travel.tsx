import { useEffect, useRef } from 'react';
import { LOCATIONS } from '../content/game';
import type { LocationId, TravelMode } from '../domain/types';
import { CITY_BRIDGE } from '../world/city';
import type { RoutePoint } from '../world/travelRoutes';
import { createTravelSampler } from '../world/travelVehicle';
import { Icon } from './Icon';
import '../styles/travel.css';

export const travelModes = {
  drive: { label: '开车', icon: 'car', moving: '正在开车' },
  transit: { label: '社区巴士', icon: 'bus', moving: '正在乘坐社区巴士' },
  walk: { label: '步行', icon: 'walk', moving: '正在步行' },
} satisfies Record<TravelMode, { label: string; icon: string; moving: string }>;

export function TripStatus({ from, to, mode, progress, onSkip, onPauseAutoplay }: {
  from: LocationId;
  to: LocationId;
  mode: TravelMode;
  progress: () => number;
  onSkip: () => void;
  onPauseAutoplay?: () => void;
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
    <div className="trip-controls">
      {onPauseAutoplay && <button type="button" onClick={onPauseAutoplay}><Icon name="pause" size={15} />暂停自动玩耍</button>}
      <button type="button" onClick={onSkip}>跳过动画 <Icon name="chevron" size={15} /></button>
    </div>
  </div>;
}

export function TripFallback({ path, mode, progress, onPresented }: {
  path: readonly RoutePoint[];
  mode: TravelMode;
  progress: () => number;
  onPresented: (path: readonly RoutePoint[]) => void;
}) {
  const traveler = useRef<SVGGElement>(null);
  const presentedPath = useRef<readonly RoutePoint[] | null>(null);
  useEffect(() => {
    const marker = traveler.current;
    if (!marker) return;
    const sample = createTravelSampler(path);
    const update = () => {
      const { x, z, heading } = sample(progress());
      const angle = 90 - heading * 180 / Math.PI;
      marker.setAttribute('transform', `translate(${x} ${z}) rotate(${angle})`);
      frame = requestAnimationFrame(update);
      if (presentedPath.current !== path) {
        presentedPath.current = path;
        onPresented(path);
      }
    };
    let frame = requestAnimationFrame(update);
    return () => cancelAnimationFrame(frame);
  }, [path, progress, onPresented]);

  const start = path[0];
  const end = path[path.length - 1];
  if (!start || !end) return null;
  const { halfWidth, halfSpan, approachEnd } = CITY_BRIDGE;
  const left = Math.min(...path.map(point => point.x)) - 8;
  const right = Math.max(...path.map(point => point.x)) + 8;
  const north = Math.min(...path.map(point => point.z));
  const south = Math.max(...path.map(point => point.z));
  const width = right - left;
  const crossesRiver = north < -halfSpan && south > halfSpan;
  const riverLabel = Math.abs(left) > Math.abs(right) ? left + width * .18 : right - width * .18;
  const streets = [north, ...(south > north ? [south] : [])].map(z => `M${left} ${z}H${right}`).join(' ');
  const route = path.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.z}`).join(' ');
  const halfVehicle = mode === 'transit' ? 1.75 : 1.5;
  return <svg className="trip-fallback" viewBox={`${left} ${north - 7} ${width} ${south - north + 19}`} role="img" aria-label={crossesRiver ? '出行路线经过栈河上的桥' : '栈城出行路线'}>
    {crossesRiver && <g>
      <rect x={left} y={-halfSpan} width={width} height={halfSpan * 2} fill="#549db7" />
      <path d={`M${left} ${-halfSpan}H${right}M${left} ${halfSpan}H${right}`} fill="none" stroke="#d6d8b8" strokeWidth=".43" />
      {Array.from({ length: Math.floor(width / 5) }, (_, index) => (
        <path key={index} d={`M${left + 1.5 + index * 5} ${index % 2 === 0 ? -1.62 : 1.64}h2.05`} stroke="#90c3d3" strokeWidth=".15" strokeLinecap="round" />
      ))}
      <text x={riverLabel} y=".48" fill="#f3fcff" fontSize="1.25" fontWeight="650" textAnchor="middle" letterSpacing=".16">栈河</text>
      <path d={`M0 ${north}V${-approachEnd}M0 ${approachEnd}V${south}`} fill="none" stroke="#626e69" strokeWidth={halfWidth * 2} />
    </g>}
    <path d={streets} fill="none" stroke="#d3d4bb" strokeWidth="3.4" />
    <path d={streets} fill="none" stroke="#626e69" strokeWidth="2.5" />
    {crossesRiver && <g>
      <rect x={-halfWidth} y={-approachEnd} width={halfWidth * 2} height={approachEnd * 2} fill="#79847a" />
      <rect x={-halfWidth} y={-halfSpan} width={halfWidth * 2} height={halfSpan * 2} fill="#65726f" />
      <path d={`M${-halfWidth} ${-approachEnd}V${approachEnd}M${halfWidth} ${-approachEnd}V${approachEnd}`} fill="none" stroke="#e7e7cc" strokeWidth=".33" />
      <path d={`M${-halfWidth} ${-halfSpan}H${halfWidth}M${-halfWidth} ${halfSpan}H${halfWidth}`} fill="none" stroke="#a8b1a2" strokeWidth=".18" />
    </g>}
    <path d={route} fill="none" stroke="#fff2ba" strokeWidth=".22" strokeDasharray=".65 .48" strokeLinejoin="round" strokeLinecap="round" />
    <circle cx={start.x} cy={start.z} r=".57" fill="#fff9e8" />
    <circle cx={end.x} cy={end.z} r=".77" fill="#75ca9b" stroke="#fff9e8" strokeWidth=".22" />
    <g className="trip-fallback-traveler" ref={traveler} transform={`translate(${start.x} ${start.z})`}>
      {mode === 'walk' ? <circle r=".77" fill="#ffc857" stroke="#fff8d7" strokeWidth=".24" /> : <>
        <ellipse cy=".23" rx={halfVehicle + .27} ry=".99" fill="#263d3d" opacity=".32" />
        {[-.91, .89].map(x => <g key={x} fill="#263d3d">
          <rect x={x - .28} y="-.91" width=".56" height=".45" rx=".13" />
          <rect x={x - .28} y=".46" width=".56" height=".45" rx=".13" />
        </g>)}
        <rect x={-halfVehicle} y="-.76" width={halfVehicle * 2} height="1.52" rx=".38" fill={mode === 'transit' ? '#f9b75f' : '#40d8a4'} stroke="#fff8d7" strokeWidth=".24" />
        <path d="M-.68-.53H.39L.79-.34V.34L.39.53H-.68L-.86.29V-.29Z" fill="#294752" />
        <path d="M.34-.34H.54M.34.34H.54" stroke="#81b8be" strokeWidth=".13" strokeLinecap="round" />
        <path d={`M${halfVehicle - .28} -.51v.22m0 .58v.22`} stroke="#fffae0" strokeWidth=".19" strokeLinecap="round" />
      </>}
    </g>
  </svg>;
}
