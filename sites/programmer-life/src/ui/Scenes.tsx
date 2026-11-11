import { useId } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { LOCATIONS } from '../content/game';
import type { ActionId, LocationId } from '../domain/types';
import '../styles/scenes.css';

type Project = (x: number, y: number, z?: number) => [number, number];
const room: Project = (x, y, z = 0) => [400 + x - y, 155 + (x + y) * .55 - z];
const city: Project = (x, y, z = 0) => [400 + (x - y) * .75, 93 + (x + y) * .38 - z];
const points = (coords: [number, number][]) => coords.map((p) => p.join(',')).join(' ');
const plane = (p: Project, x: number, y: number, w: number, d: number, z = 0) =>
  points([p(x, y, z), p(x + w, y, z), p(x + w, y + d, z), p(x, y + d, z)]);

function Box({ x, y, w, d, h, z = 0, top = '#ead2ac', left = '#d1b58b', right = '#bd9f77', p = room, stroke = '#806b4b', opacity = 1 }: {
  x: number; y: number; w: number; d: number; h: number; z?: number;
  top?: string; left?: string; right?: string; p?: Project; stroke?: string; opacity?: number;
}) {
  return <g stroke={stroke} strokeWidth="1" strokeLinejoin="round" opacity={opacity}>
    <polygon points={points([p(x, y + d, z), p(x + w, y + d, z), p(x + w, y + d, z + h), p(x, y + d, z + h)])} fill={left} />
    <polygon points={points([p(x + w, y, z), p(x + w, y + d, z), p(x + w, y + d, z + h), p(x + w, y, z + h)])} fill={right} />
    <polygon points={plane(p, x, y, w, d, z + h)} fill={top} />
  </g>;
}

function Plant({ x, y, size = 1, p = room }: { x: number; y: number; size?: number; p?: Project }) {
  const [px, py] = p(x, y);
  return <g transform={`translate(${px} ${py}) scale(${size})`} className="scene-plant">
    <ellipse cx="0" cy="1" rx="17" ry="7" fill="#344e3b" opacity=".1" />
    <path d="M-12-20h24l-4 22H-8z" fill="#cf8970" stroke="#ae715a" strokeWidth="1" />
    <ellipse cy="-20" rx="12" ry="5" fill="#e4a58a" />
    <path d="M0-20v-34M0-35l-13-10M0-41l12-9" fill="none" stroke="#587b4d" strokeWidth="2" />
    <ellipse cx="-12" cy="-44" rx="7" ry="14" fill="#718d5b" transform="rotate(-42 -12 -44)" />
    <ellipse cx="12" cy="-48" rx="7" ry="15" fill="#91ab73" transform="rotate(42 12 -48)" />
    <ellipse cx="-1" cy="-59" rx="7" ry="13" fill="#56794b" transform="rotate(-10 -1 -59)" />
    <ellipse cx="-8" cy="-28" rx="6" ry="11" fill="#91ab73" transform="rotate(-52 -8 -28)" />
    <ellipse cx="9" cy="-32" rx="6" ry="11" fill="#6e9157" transform="rotate(50 9 -32)" />
  </g>;
}

function Person({ x, y, shirt = '#b86546', name, seated = false, className = '' }: {
  x: number; y: number; shirt?: string; name?: string; seated?: boolean; className?: string;
}) {
  return <g className={`scene-person ${className}`} style={{ transform: `translate(${x}px, ${y}px)` } as CSSProperties}>
    <ellipse cy="3" rx="17" ry="7" fill="#344e3b" opacity=".15" />
    <g transform={seated ? 'translate(0 6)' : undefined}>
      <path d="M-9-19-10-1h7l4-17M1-18 5 0h7L9-19" fill="#405d61" />
      <path d="M-11-1h10v4h-14zM5 0h10l3 4H5z" fill="#35483b" />
      <path d="M-8-36q8-5 16 0l5 19q-12 6-26 0z" fill={shirt} stroke="#815f48" strokeWidth=".8" />
      <path d="m-9-31-7 13 4 2 8-12m13-4 7 13-4 2-8-12" fill="#e2b18c" stroke="#b58360" strokeWidth=".7" />
      <rect x="-4" y="-43" width="8" height="10" rx="3" fill="#dca780" />
      <ellipse cy="-49" rx="12" ry="14" fill="#e7ba91" stroke="#a98263" strokeWidth=".7" />
      <path d="M-12-49q-4-18 11-19 17 0 14 18l-5-6q-11 4-15-2z" fill="#3d4036" />
      <path d="M-11-51q0-7 6-9m13 10v-7" fill="none" stroke="#3d4036" strokeWidth="4" />
      <circle cx="-4" cy="-48" r="1" fill="#484136" /><circle cx="5" cy="-48" r="1" fill="#484136" />
      <path d="M-2-41q3 2 5-1" fill="none" stroke="#ae775e" strokeWidth="1.2" strokeLinecap="round" />
    </g>
    {name && <g transform="translate(0 -82)" className="scene-name-tag">
      <rect x={-(Math.min(name.length, 8) * 6 + 14)} y="-9" width={Math.min(name.length, 8) * 12 + 28} height="24" rx="12" fill="#fffdf7" stroke="#dedfcd" />
      <circle cx={-(Math.min(name.length, 8) * 6 + 3)} cy="3" r="3" fill="#799563" />
      <text x="5" y="7" textAnchor="middle" fill="#4b5c43" fontSize="11" fontWeight="600">{name.slice(0, 8)}</text>
    </g>}
  </g>;
}

function Hotspot({ x, y, label, active, onSelect, children }: { x: number; y: number; label: string; active: boolean; onSelect: () => void; children?: ReactNode }) {
  const width = label.length * 12 + 35;
  return <g role="button" tabIndex={0} aria-label={label} aria-pressed={active} className={`scene-hotspot ${active ? 'is-active' : ''}`}
    onClick={onSelect} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect(); } }}>
    {children}
    <rect x={x - Math.max(width / 2, 32)} y={y - 22} width={Math.max(width, 64)} height="69" rx="20" fill="transparent" />
    <circle className="hotspot-halo" cx={x} cy={y} r="18" fill="#fffdf7" opacity=".15" />
    <circle className="hotspot-ring" cx={x} cy={y} r="11" fill={active ? '#365341' : '#fffdf7'} stroke={active ? '#365341' : '#86986f'} strokeWidth="1.5" />
    <path d={`M${x - 3.5} ${y}h7M${x} ${y - 3.5}v7`} stroke={active ? '#fffdf7' : '#547143'} strokeWidth="1.5" strokeLinecap="round" />
    <g className="hotspot-label" transform={`translate(${x - width / 2} ${y + 17})`}>
      <rect width={width} height="25" rx="12.5" fill={active ? '#365341' : '#fffdf7'} stroke={active ? '#365341' : '#e3dfd1'} />
      <text x={width / 2} y="17" textAnchor="middle" fill={active ? '#fffdf7' : '#53604b'} fontSize="11.5" fontWeight="600">{label}</text>
    </g>
  </g>;
}

function Window({ night, id }: { night: boolean; id: string }) {
  const corners = [room(0, 34, 47), room(0, 118, 47), room(0, 118, 130), room(0, 34, 130)];
  return <g>
    <polygon points={points(corners)} fill={night ? '#526c78' : '#d2e6df'} stroke="#fefcf4" strokeWidth="8" />
    <clipPath id={id}><polygon points={points(corners)} /></clipPath>
    <g clipPath={`url(#${id})`}>
      <circle cx="322" cy="98" r="19" fill={night ? '#f4e5a7' : '#f7ebc2'} />
      <path d="M264 164v-43l18-10 14 6v32l16-8V98l25-12 17 6v51l12-7v54z" fill={night ? '#385461' : '#9dc4b7'} />
      <path d="M265 163 357 112v79l-92 42" fill={night ? '#2e4c59' : '#78a895'} />
      {[0, 1, 2, 3].map((v) => <path key={v} d={`m${292 + v * 16} ${126 - v * 8}v8`} stroke={night ? '#f1dfaa' : '#d4e6d4'} strokeWidth="5" />)}
    </g>
    <path d={points([room(0, 76, 47), room(0, 76, 130)]).replace(' ', ' L').replace(/^/, 'M')} stroke="#fbfaf0" strokeWidth="5" />
    <path d={points([room(0, 34, 86), room(0, 118, 86)]).replace(' ', ' L').replace(/^/, 'M')} stroke="#fbfaf0" strokeWidth="4" />
    <Box x={-6} y={28} w={11} d={96} h={5} z={42} top="#fffdf4" left="#d5d4b8" right="#d5d4b8" stroke="#c6c9af" />
    <path d="M367 58q-12 34-6 88M274 111q-8 43-2 91" stroke="#e4cfac" strokeWidth="15" fill="none" opacity=".8" />
  </g>;
}

function Monitor({ x, y, p = room, color = '#8ba399' }: { x: number; y: number; p?: Project; color?: string }) {
  return <g>
    <Box x={x + 19} y={y + 3} w={5} d={8} h={15} z={57} top="#737e75" left="#647266" right="#526054" p={p} stroke="#526054" />
    <Box x={x + 11} y={y + 2} w={21} d={13} h={2} z={57} top="#788c7b" left="#5e7160" right="#5e7160" p={p} stroke="#526054" />
    <polygon points={points([p(x, y + 8, 72), p(x + 48, y + 8, 72), p(x + 48, y + 8, 106), p(x, y + 8, 106)])} fill="#354c43" stroke="#263e35" strokeWidth="4" strokeLinejoin="round" />
    <polygon points={points([p(x + 3, y + 8, 76), p(x + 45, y + 8, 76), p(x + 45, y + 8, 102), p(x + 3, y + 8, 102)])} fill={color} />
    {[0, 1, 2].map((v) => <path key={v} d={`M${p(x + 8, y + 8, 96 - v * 6).join(' ')}l${17 + v * 5} ${(17 + v * 5) * .55}`} stroke={v === 1 ? '#e9c48f' : '#d0e2cf'} strokeWidth="2" strokeLinecap="round" />)}
  </g>;
}

function Desk({ x, y, office = false }: { x: number; y: number; office?: boolean }) {
  const w = office ? 132 : 103;
  return <g>
    {[[x + 5, y + 5], [x + w - 9, y + 5], [x + 5, y + 42], [x + w - 9, y + 42]].map(([lx, ly], i) => <Box key={i} x={lx} y={ly} w={5} d={5} h={55} top="#d6bd92" left="#b69a73" right="#a58b66" stroke="#927f61" />)}
    <Box x={x} y={y} w={w} d={51} h={6} z={53} top="#e7cea4" left="#c9aa7b" right="#b99b70" stroke="#ae946f" />
    <Monitor x={x + 29} y={y + 8} />
    {office && <Monitor x={x + 79} y={y + 6} color="#b0bba1" />}
    <polygon points={plane(room, x + 24, y + 35, 45, 10, 60)} fill="#f2f0e0" stroke="#b6b8a2" />
    {[0, 1, 2, 3, 4].map((v) => <path key={v} d={`M${room(x + 29 + v * 7, y + 36, 60).join(' ')}l-7 4`} stroke="#bcc4ae" strokeWidth="1" />)}
    <Box x={x + 83} y={y + 32} w={12} d={11} h={2} z={60} top="#d49b75" left="#ba805f" right="#b47b57" stroke="#b47b57" />
    <ellipse cx={room(x + 12, y + 20, 65)[0]} cy={room(x + 12, y + 20, 65)[1]} rx="7" ry="3" fill="#f4f1df" stroke="#b1a68b" />
    <path d={`M${room(x + 12, y + 20, 65)[0] - 7} ${room(x + 12, y + 20, 65)[1]}v9q7 6 14 0v-9`} fill="#e9eddd" stroke="#b1a68b" />
  </g>;
}

function HomeFurniture() {
  return <>
    <polygon points={plane(room, 78, 98, 109, 116, 1)} fill="#e7a38c" opacity=".67" stroke="#ca8e78" />
    <polygon points={plane(room, 84, 104, 97, 104, 2)} fill="none" stroke="#efd0ad" strokeWidth="3" strokeDasharray="4 3" />
    <Box x={17} y={26} w={40} d={39} h={80} top="#d8e3d5" left="#c5d4c2" right="#aebfae" stroke="#8f9f8b" />
    <path d={`M${room(17, 65, 49).join(' ')}L${room(57, 65, 49).join(' ')}`} stroke="#8f9f8b" />
    <path d={`M${room(49, 66, 59).join(' ')}v13M${room(49, 66, 21).join(' ')}v15`} stroke="#f5f3df" strokeWidth="3" strokeLinecap="round" />
    <polygon points={points([room(23, 65, 61), room(36, 65, 61), room(36, 65, 73), room(23, 65, 73)])} fill="#efcb89" />
    <Box x={18} y={78} w={54} d={25} h={43} top="#ded6be" left="#c5b89b" right="#b4a58b" stroke="#a49679" />
    <Box x={17} y={77} w={57} d={28} h={4} z={43} top="#f8f2dc" left="#e3d8b9" right="#cbbd9e" stroke="#b8ac8b" />
    <ellipse cx={room(42, 88, 48)[0]} cy={room(42, 88, 48)[1]} rx="13" ry="5" fill="#9ca99b" stroke="#7c8b7a" />
    <path d={`M${room(38, 85, 48).join(' ')}v-12q1-4 6-2`} fill="none" stroke="#8b9d8e" strokeWidth="3" />
    <Desk x={139} y={29} />
    <Box x={175} y={92} w={34} d={31} h={26} top="#728f76" left="#6a8468" right="#54725b" stroke="#49674c" />
    <Box x={175} y={115} w={34} d={7} h={35} z={19} top="#88a18a" left="#6b886e" right="#56735a" stroke="#49674c" />
    <Plant x={229} y={20} size={.68} />
    <Box x={20} y={143} w={78} d={98} h={21} top="#e7dfc5" left="#c0a888" right="#ab9676" stroke="#9e8b6f" />
    <Box x={18} y={140} w={82} d={8} h={56} top="#c5a37e" left="#b79570" right="#a58565" stroke="#987c5d" />
    <Box x={20} y={146} w={78} d={94} h={12} z={20} top="#f7edcf" left="#e5d7b7" right="#d6c6a4" stroke="#c1b18c" />
    <Box x={20} y={176} w={79} d={63} h={6} z={32} top="#9ab19c" left="#839d85" right="#728c76" stroke="#728d75" />
    {[37, 59, 81].map((x) => <path key={x} d={`M${room(x, 178, 39).join(' ')}L${room(x, 236, 39).join(' ')}`} stroke="#b3c6aa" strokeWidth="1.4" />)}
    <Box x={27} y={151} w={28} d={21} h={8} z={33} top="#fff6de" left="#eee4c8" right="#d5c7a5" stroke="#d5c7a5" />
    <Box x={60} y={151} w={28} d={21} h={8} z={33} top="#fff6de" left="#eee4c8" right="#d5c7a5" stroke="#d5c7a5" />
    <Box x={113} y={209} w={20} d={24} h={30} top="#d9b98b" left="#c4a06f" right="#b09063" stroke="#a78a5c" />
    <g transform={`translate(${room(124, 220, 32).join(' ')})`}><path d="M0 0v-23" stroke="#8b916f" strokeWidth="2" /><path d="m-9-23 3-14h12l4 14z" fill="#f1dab1" stroke="#b8a47a" /><ellipse cy="1" rx="7" ry="3" fill="#8b916f" /></g>
    <Box x={155} y={173} w={81} d={45} h={24} top="#dbb57e" left="#c99e68" right="#b58d5b" stroke="#a88556" />
    <Box x={155} y={170} w={81} d={10} h={51} top="#e9c697" left="#d6b07a" right="#c7a16b" stroke="#b49261" />
    <Box x={151} y={171} w={11} d={49} h={38} top="#e6bf8b" left="#d1ab74" right="#bb9560" stroke="#b49261" />
    <Box x={231} y={171} w={10} d={49} h={38} top="#e6bf8b" left="#d1ab74" right="#bb9560" stroke="#b49261" />
    <Box x={163} y={181} w={32} d={35} h={6} z={24} top="#efcea0" left="#ddb884" right="#cfa774" stroke="#c8a36e" />
    <Box x={197} y={181} w={32} d={35} h={6} z={24} top="#efcea0" left="#ddb884" right="#cfa774" stroke="#c8a36e" />
    <Box x={166} y={174} w={21} d={10} h={20} z={28} top="#a6b49a" left="#9cab8c" right="#829579" stroke="#829579" />
    <Box x={203} y={175} w={19} d={10} h={19} z={28} top="#d6977f" left="#c88a72" right="#b87b62" stroke="#b87b62" />
    <Box x={131} y={139} w={54} d={25} h={25} top="#e3c59b" left="#caab80" right="#bca075" stroke="#ab9067" />
    <Box x={143} y={143} w={24} d={14} h={2} z={26} top="#eeebce" left="#d4d4b7" right="#d4d4b7" stroke="#aab28f" />
    <Plant x={234} y={238} size={1.05} />
  </>;
}

function OfficeFurniture() {
  return <>
    <polygon points={plane(room, 69, 77, 156, 125, 1)} fill="#d9dfcf" stroke="#c4cdb8" strokeWidth="1" />
    <g>
      <polygon points={points([room(64, 0, 74), room(174, 0, 74), room(174, 0, 143), room(64, 0, 143)])} fill="#f8f8e9" stroke="#a6b29c" strokeWidth="5" />
      {[0, 1, 2].map((v) => <g key={v}>
        <polygon points={points([room(76 + v * 31, 0, 86), room(99 + v * 31, 0, 86), room(99 + v * 31, 0, 111), room(76 + v * 31, 0, 111)])} fill={['#e9c27f', '#c5d5bc', '#e6ac95'][v]} />
        <path d={`M${room(77 + v * 31, 0, 125).join(' ')}l17 9`} stroke="#91a08a" strokeWidth="2" />
      </g>)}
    </g>
    <Box x={18} y={135} w={36} d={82} h={45} top="#d9c2a2" left="#c4ab87" right="#b29874" stroke="#a38e6b" />
    <Box x={17} y={134} w={38} d={85} h={5} z={45} top="#ede4cc" left="#ded0b3" right="#c8b797" stroke="#b6a783" />
    <Box x={23} y={146} w={24} d={19} h={23} z={51} top="#a2b2a0" left="#7c937c" right="#6b846d" stroke="#597660" />
    <polygon points={points([room(24, 165, 55), room(44, 165, 55), room(44, 165, 69), room(24, 165, 69)])} fill="#40594a" />
    <ellipse cx={room(34, 178, 54)[0]} cy={room(34, 178, 54)[1]} rx="7" ry="3" fill="#f5ecd2" stroke="#b9aa88" />
    <path d={`M${room(34, 178, 54)[0] - 6} ${room(34, 178, 54)[1]}v9q6 4 12 0v-9`} fill="#ecddba" stroke="#b9aa88" />
    <Desk x={79} y={83} office />
    <Box x={136} y={151} w={37} d={36} h={30} top="#819b86" left="#6e8d74" right="#54775e" stroke="#4a6b53" />
    <Box x={135} y={179} w={39} d={8} h={40} z={22} top="#94aa92" left="#7f997d" right="#668366" stroke="#4a6b53" />
    <Desk x={149} y={22} />
    <Person x={room(221, 80)[0]} y={room(221, 80)[1]} shirt="#788f8a" name="林工" />
    <Plant x={228} y={225} size={1.15} />
    <Plant x={18} y={23} size={.9} />
    <Box x={88} y={218} w={89} d={16} h={30} top="#ddbc8b" left="#cda779" right="#b89469" stroke="#ad8d60" />
    {[96, 115, 139, 157].map((x, i) => <Box key={x} x={x} y={220} w={11} d={11} h={17 + (i % 2) * 4} z={31} top={['#bdd0b6', '#dba68c', '#a6bbb2', '#e1c28d'][i]} left={['#a7b99a', '#c88d73', '#87a399', '#c6a971'][i]} right="#a89f7e" stroke="#a39878" />)}
  </>;
}

export function RoomScene({ location, name, minute, activeAction, onSelect }: {
  location: 'home' | 'office'; name: string; minute: number; activeAction: ActionId | null; onSelect: (action: ActionId) => void;
}) {
  const rawId = useId().replace(/:/g, '');
  const windowId = `room-window-${rawId}`;
  const titleId = `room-title-${rawId}`;
  const descriptionId = `room-desc-${rawId}`;
  const hour = Math.floor(minute / 60) % 24;
  const night = hour >= 18 || hour < 7;
  const home = location === 'home';
  const anchor = home
    ? activeAction === 'sleep' ? [63, 190] : activeAction === 'personal' ? [185, 125] : activeAction === 'cook' || activeAction === 'breakfast' ? [65, 84] : activeAction === 'rest' ? [188, 220] : [112, 130]
    : activeAction === 'talk' ? [206, 103] : activeAction === 'lunch' ? [67, 179] : activeAction === 'test' ? [147, 61] : [152, 183];
  const avatar = room(anchor[0], anchor[1]);
  return <div className={`room-scene ${night ? 'is-night' : ''}`}>
    <svg className="room-illustration" viewBox="0 0 800 510" role="group" aria-labelledby={`${titleId} ${descriptionId}`}>
      <title id={titleId}>{home ? LOCATIONS.home.name : `${LOCATIONS.office.name}办公室`}</title>
      <desc id={descriptionId}>等距视角的{home ? '温暖小屋，床、书桌、厨房和沙发都可以点击选择活动' : '办公室，电脑、任务白板、同事和茶水间可以点击选择活动'}。</desc>
      <defs>
        <radialGradient id={`ground-${rawId}`}><stop offset="0" stopColor="#d6d5be" stopOpacity=".45" /><stop offset="1" stopColor="#d6d5be" stopOpacity="0" /></radialGradient>
        <linearGradient id={`wall-${rawId}`} x1="0" y1="0" x2="0" y2="1"><stop stopColor={night ? '#dfdbbf' : '#f5edcf'} /><stop offset="1" stopColor={night ? '#c9cfba' : '#e4e5cf'} /></linearGradient>
        <linearGradient id={`light-${rawId}`}><stop stopColor="#ffedbd" stopOpacity=".3" /><stop offset="1" stopColor="#ffedbd" stopOpacity="0" /></linearGradient>
      </defs>
      <ellipse cx="400" cy="365" rx="320" ry="135" fill={`url(#ground-${rawId})`} />
      <Box x={0} y={0} w={250} d={250} h={14} z={-14} top="#deca9c" left="#c3b38e" right="#b4a584" stroke="#b3a27d" />
      <polygon points={points([room(0, 0), room(0, 250), room(0, 250, 150), room(0, 0, 150)])} fill={`url(#wall-${rawId})`} stroke="#c9ccb5" strokeWidth="1.3" />
      <polygon points={points([room(0, 0), room(250, 0), room(250, 0, 150), room(0, 0, 150)])} fill={night ? '#d5dac5' : '#ececd7'} stroke="#c8ceb7" strokeWidth="1.3" />
      <path d={`M${room(0, 250, 150).join(' ')}L${room(0, 0, 150).join(' ')}L${room(250, 0, 150).join(' ')}`} fill="none" stroke="#f9f4dd" strokeWidth="6" strokeLinejoin="round" />
      <path d={`M${room(0, 250, 5).join(' ')}L${room(0, 0, 5).join(' ')}L${room(250, 0, 5).join(' ')}`} fill="none" stroke="#b9b99a" strokeWidth="5" />
      {Array.from({ length: 12 }, (_, i) => <path key={i} d={`M${room((i + 1) * 20, 0, .2).join(' ')}L${room((i + 1) * 20, 250, .2).join(' ')}`} fill="none" stroke="#c2ad81" strokeWidth=".8" opacity=".5" />)}
      {Array.from({ length: 5 }, (_, i) => <path key={i} d={`M${room(0, (i + 1) * 48, .3).join(' ')}L${room(250, (i + 1) * 48, .3).join(' ')}`} fill="none" stroke="#c2ad81" strokeWidth=".6" opacity=".35" />)}
      <Window night={night} id={windowId} />
      {home && <g>
        <polygon points={points([room(150, 0, 89), room(210, 0, 89), room(210, 0, 132), room(150, 0, 132)])} fill="#f8efdc" stroke="#c4a77d" strokeWidth="4" />
        <circle cx={room(180, 0, 113)[0]} cy={room(180, 0, 113)[1]} r="11" fill="#e3bd7b" />
        <path d={`M${room(155, 0, 92).join(' ')}l22-8 29 25`} fill="#91a588" />
        <path d={`M${room(196, 0, 89).join(' ')}l-18-28-17 9`} fill="#738c73" />
        <path d={`M${room(107, 0, 130).join(' ')}v48`} stroke="#a3a184" strokeWidth="1.5" />
        <g transform={`translate(${room(107, 0, 82).join(' ')})`}><path d="M-15 3q15-31 30 0z" fill="#edcc8c" stroke="#c5a66f" /><ellipse cy="3" rx="15" ry="5" fill="#f8e6b7" /></g>
      </g>}
      {!night && <polygon points={plane(room, 16, 123, 90, 76, .8)} fill={`url(#light-${rawId})`} />}
      {home ? <HomeFurniture /> : <OfficeFurniture />}
      <Person x={avatar[0]} y={avatar[1]} name={name} className="is-player" />
      {home ? <>
        <Hotspot x={260} y={254} label="好好睡一觉" active={activeAction === 'sleep'} onSelect={() => onSelect('sleep')} />
        <Hotspot x={548} y={166} label="写个人项目" active={activeAction === 'personal'} onSelect={() => onSelect('personal')} />
        <Hotspot x={390} y={99} label="做点吃的" active={activeAction === 'cook' || activeAction === 'breakfast'} onSelect={() => onSelect('cook')} />
        <Hotspot x={420} y={331} label="休息一下" active={activeAction === 'rest'} onSelect={() => onSelect('rest')} />
      </> : <>
        <Hotspot x={458} y={203} label="开始工作" active={activeAction === 'focus' || activeAction === 'rush' || activeAction === 'ai'} onSelect={() => onSelect('focus')} />
        <Hotspot x={519} y={61} label="测试与评审" active={activeAction === 'test'} onSelect={() => onSelect('test')} />
        <Hotspot x={565} y={235} label="和林工聊聊" active={activeAction === 'talk'} onSelect={() => onSelect('talk')} />
        <Hotspot x={255} y={210} label="吃个午饭" active={activeAction === 'lunch'} onSelect={() => onSelect('lunch')} />
      </>}
      <g className="scene-floor-caption" transform="translate(400 485)">
        <path d="M-104 0h34m140 0h34" stroke="#b8bca5" strokeWidth="1" />
        <text textAnchor="middle" y="4" fill="#869077" fontSize="11" letterSpacing="2">{home ? '一间小屋，无数种可能' : '让想法慢慢成为现实'}</text>
      </g>
    </svg>
  </div>;
}

function Tree({ x, y, scale = 1 }: { x: number; y: number; scale?: number }) {
  const at = city(x, y);
  return <g transform={`translate(${at.join(' ')}) scale(${scale})`}>
    <ellipse cx="4" cy="4" rx="20" ry="8" fill="#657b56" opacity=".15" />
    <path d="M0 0v-34" stroke="#a78961" strokeWidth="5" strokeLinecap="round" />
    <path d="m0-20-9-10m10 4 10-9" stroke="#a78961" strokeWidth="2" strokeLinecap="round" />
    <ellipse cy="-37" rx="19" ry="24" fill="#98b181" /><ellipse cx="-10" cy="-31" rx="13" ry="17" fill="#87a570" /><ellipse cx="10" cy="-39" rx="13" ry="17" fill="#afc296" />
    <path d="m-2-22-2-21m2 10 11-9" stroke="#8fa775" strokeWidth="1" opacity=".7" fill="none" />
  </g>;
}

function Building({ x, y, w, d, h, kind }: { x: number; y: number; w: number; d: number; h: number; kind: Exclude<LocationId, 'park'> }) {
  const palette = { home: ['#edd8b4', '#e3c69e', '#cdb18e'], office: ['#b9cfc2', '#aac1b1', '#88a996'], cafe: ['#eac1a0', '#ddb08e', '#ca977a'], store: ['#f1dbad', '#e4c58f', '#cdad77'], makerspace: ['#c8d1c1', '#b2c0aa', '#93aa92'] }[kind];
  return <g>
    <polygon points={plane(city, x - 9, y - 9, w + 18, d + 18, 1)} fill="#e4dfc9" stroke="#d8d6be" />
    <polygon points={plane(city, x + 8, y + 8, w + 9, d + 12, 1)} fill="#7e8a6e" opacity=".13" />
    <Box x={x} y={y} w={w} d={d} h={h} p={city} top={palette[0]} left={palette[1]} right={palette[2]} stroke="#9a9f82" />
    {kind === 'home' ? <>
      <polygon points={points([city(x - 5, y - 5, h), city(x + w / 2, y - 5, h + 30), city(x + w + 5, y - 5, h), city(x + w + 5, y + d + 5, h), city(x + w / 2, y + d + 5, h + 30), city(x - 5, y + d + 5, h)])} fill="#be8c70" stroke="#a97e60" strokeLinejoin="round" />
      <polygon points={points([city(x + w / 2, y - 5, h + 30), city(x + w + 5, y - 5, h), city(x + w + 5, y + d + 5, h), city(x + w / 2, y + d + 5, h + 30)])} fill="#a9765e" stroke="#97694f" />
      {[0, 1, 2].map((v) => <path key={v} d={`M${city(x - 2 + v * 14, y - 4, h + v * 9).join(' ')}L${city(x - 2 + v * 14, y + d + 3, h + v * 9).join(' ')}`} fill="none" stroke="#d5a184" strokeWidth="1" />)}
    </> : <>
      <Box x={x - 3} y={y - 3} w={w + 6} d={d + 6} h={5} z={h} p={city} top={kind === 'office' ? '#dce5d8' : '#e0d7bb'} left="#b1bba2" right="#9eac94" stroke="#99a48a" />
      {kind === 'office' && <Box x={x + 14} y={y + 11} w={w - 28} d={d - 24} h={7} z={h + 5} p={city} top="#ccd7c4" left="#a9bba6" right="#8fa88f" stroke="#a1b297" />}
    </>}
    {Array.from({ length: kind === 'office' ? 4 : 2 }, (_, row) => [0, 1].map((col) => {
      const z = 17 + row * 24;
      const wx = x + 13 + col * (w - 23) / 2;
      return <g key={`${row}-${col}`}>
        <polygon points={points([city(wx, y + d + .2, z), city(wx + 16, y + d + .2, z), city(wx + 16, y + d + .2, z + 14), city(wx, y + d + .2, z + 14)])} fill="#e8ead2" stroke="#7e9784" strokeWidth="1.5" />
        <path d={`M${city(wx + 8, y + d + .3, z).join(' ')}L${city(wx + 8, y + d + .3, z + 14).join(' ')}`} stroke="#a6b7a0" strokeWidth="1" />
      </g>;
    }))}
    {[0, 1].map((row) => <polygon key={row} points={points([city(x + w + .2, y + 16, 20 + row * 25), city(x + w + .2, y + 35, 20 + row * 25), city(x + w + .2, y + 35, 36 + row * 25), city(x + w + .2, y + 16, 36 + row * 25)])} fill="#b2c8ba" stroke="#7d9481" strokeWidth="1.5" />)}
    {(kind === 'cafe' || kind === 'store') && <>
      <polygon points={points([city(x - 3, y + d - 3, 30), city(x + w + 3, y + d - 3, 30), city(x + w + 3, y + d + 17, 22), city(x - 3, y + d + 17, 22)])} fill={kind === 'cafe' ? '#d98e72' : '#92aa85'} stroke="#aa9272" />
      {[0, 1, 2, 3, 4].map((v) => <polygon key={v} points={points([city(x + v * w / 5, y + d - 3, 30), city(x + v * w / 5 + w / 10, y + d - 3, 30), city(x + v * w / 5 + w / 10, y + d + 17, 22), city(x + v * w / 5, y + d + 17, 22)])} fill="#f4e4c0" />)}
    </>}
    {kind === 'makerspace' && <g transform={`translate(${city(x + 18, y + d, h - 13).join(' ')})`}><circle r="9" fill="#e8cf87" stroke="#b49c60" /><path d="m-4 0 3-3m2 6 3-3" stroke="#7e8d67" strokeWidth="2" strokeLinecap="round" /></g>}
  </g>;
}

const cityPlaces: { id: LocationId; x: number; y: number; w: number; d: number; h: number; label: [number, number] }[] = [
  { id: 'makerspace', x: 142, y: 22, w: 79, d: 62, h: 49, label: [491, 83] },
  { id: 'home', x: 24, y: 107, w: 79, d: 72, h: 57, label: [330, 64] },
  { id: 'office', x: 290, y: 29, w: 80, d: 87, h: 104, label: [597, 91] },
  { id: 'store', x: 25, y: 301, w: 78, d: 65, h: 49, label: [192, 177] },
  { id: 'cafe', x: 305, y: 192, w: 79, d: 66, h: 57, label: [491, 227] },
  { id: 'park', x: 268, y: 290, w: 110, d: 100, h: 0, label: [377, 397] },
];

export function CityScene({ location, onSelect }: { location: LocationId; onSelect: (id: LocationId) => void }) {
  const rawId = useId().replace(/:/g, '');
  const titleId = `city-title-${rawId}`;
  const descriptionId = `city-desc-${rawId}`;
  return <div className="city-scene"><svg className="city-illustration" viewBox="0 0 800 510" role="group" aria-labelledby={`${titleId} ${descriptionId}`}>
    <title id={titleId}>栈城生活地图</title><desc id={descriptionId}>六个可以前往的地点：{cityPlaces.map(place => LOCATIONS[place.id].name).join('、')}。点击建筑查看出行方式。</desc>
    <defs><radialGradient id={`city-shadow-${rawId}`}><stop stopColor="#a7b097" stopOpacity=".28" /><stop offset="1" stopColor="#c9ceb8" stopOpacity="0" /></radialGradient></defs>
    <ellipse cx="400" cy="365" rx="350" ry="115" fill={`url(#city-shadow-${rawId})`} />
    <Box x={-16} y={-16} w={470} d={470} h={13} z={-13} p={city} top="#e5e5cd" left="#c9d0b4" right="#b7c3a4" stroke="#bac4a8" />
    <polygon points={plane(city, -16, 195, 470, 54, 1)} fill="#c0c5b7" />
    <polygon points={plane(city, 226, -16, 49, 470, 1)} fill="#c0c5b7" />
    <path d={`M${city(-10, 221, 1).join(' ')}L${city(450, 221, 1).join(' ')}M${city(250, -10, 1).join(' ')}L${city(250, 450, 1).join(' ')}`} stroke="#f3f1de" strokeWidth="2" strokeDasharray="11 9" />
    {[202, 213, 224, 235].map((v) => <polygon key={v} points={plane(city, 278, v, 28, 5, 1.2)} fill="#f4efda" />)}
    {[234, 245, 256].map((v) => <polygon key={v} points={plane(city, v, 261, 5, 24, 1.2)} fill="#f4efda" />)}
    <polygon points={plane(city, 6, 13, 112, 76, .5)} fill="#d1dac0" stroke="#c1cbb0" />
    <Tree x={31} y={30} scale={.85} /><Tree x={78} y={39} scale={.7} /><Tree x={107} y={82} scale={.9} />
    {cityPlaces.filter((place) => place.id !== 'park').map((place) => <g key={place.id} className="city-building-art" data-location={place.id}>
      <Building {...place} kind={place.id as Exclude<LocationId, 'park'>} />
    </g>)}
    <Tree x={118} y={166} scale={.78} /><Tree x={399} y={55} scale={.95} /><Tree x={410} y={136} scale={.7} />
    <Tree x={30} y={270} scale={.7} /><Tree x={117} y={382} scale={.8} />
    <polygon points={plane(city, 280, 293, 125, 108, 2)} fill="#a7bd8d" stroke="#91a779" strokeWidth="1" />
    <polygon points={plane(city, 286, 299, 113, 96, 2.2)} fill="none" stroke="#c9d5aa" strokeWidth="1.5" />
    <path d={`M${city(342, 299, 3).join(' ')}Q${city(302, 330, 3).join(' ')} ${city(348, 355, 3).join(' ')}T${city(346, 395, 3).join(' ')}`} stroke="#e7d7ae" strokeWidth="12" fill="none" />
    <ellipse cx={city(313, 334)[0]} cy={city(313, 334)[1]} rx="18" ry="8" fill="#9ac2bd" stroke="#82aaa5" />
    <Tree x={300} y={311} scale={.7} /><Tree x={381} y={316} scale={.95} /><Tree x={391} y={375} scale={.8} />
    <Box x={288} y={361} w={37} d={9} h={12} p={city} top="#c5a47c" left="#b19068" right="#a4865f" stroke="#9c805b" />
    <Box x={288} y={360} w={37} d={4} h={15} z={8} p={city} top="#d3b88e" left="#c1a37a" right="#ad9169" stroke="#9c805b" />
    <g transform={`translate(${city(179, 219).join(' ')})`}><ellipse cy="4" rx="13" ry="5" fill="#6e7c66" opacity=".15" /><path d="m-9-5 11-7 12 7v9L3 10-9 3z" fill="#e8bd7d" stroke="#b99b6c" /><path d="m-4-6 7-4 7 4-8 4z" fill="#e8efe2" /><circle cx="-4" cy="5" r="3" fill="#576450" /><circle cx="9" cy="7" r="3" fill="#576450" /></g>
    <g transform={`translate(${city(253, 343).join(' ')})`}><ellipse cy="2" rx="5" ry="2" fill="#65715d" opacity=".2" /><path d="M0 0v-12" stroke="#a46a4f" strokeWidth="5" strokeLinecap="round" /><circle cy="-16" r="4" fill="#deb58a" /><path d="m-2 0-2 5m6-5 2 5" stroke="#587265" strokeWidth="2" /></g>
    {cityPlaces.map((place) => {
      const selected = location === place.id;
      const [x, y] = place.label;
      const placeName = LOCATIONS[place.id].name;
      const width = placeName.length * 13 + 30;
      return <g key={place.id} role="button" tabIndex={0} aria-label={`前往${placeName}`} aria-pressed={selected} className={`city-place ${selected ? 'is-current' : ''}`} onClick={() => onSelect(place.id)} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect(place.id); } }}>
        <polygon className="city-hit-area" points={plane(city, place.x - 6, place.y - 6, place.w + 12, place.d + 12, Math.max(place.h * .5, 10))} fill="transparent" stroke="transparent" strokeWidth="35" />
        <g className="city-place-label" transform={`translate(${x} ${y})`}>
          <path d="M0 13v10" stroke={selected ? '#476749' : '#99a88a'} strokeWidth="1.5" /><circle cy="25" r="3" fill={selected ? '#476749' : '#99a88a'} />
          <rect x={-width / 2} y="-14" width={width} height="29" rx="14.5" fill={selected ? '#3f6047' : '#fffdf4'} stroke={selected ? '#3f6047' : '#d5d8c5'} />
          <text textAnchor="middle" y="5" fill={selected ? '#fffdf4' : '#526448'} fontSize="12" fontWeight="600">{placeName}</text>
          {selected && <g transform="translate(0 -27)"><circle cx="-26" r="2.5" fill="#6b8d5d" /><text x="6" y="3" textAnchor="middle" fill="#5e7e50" fontSize="10" fontWeight="600">你在这里</text></g>}
        </g>
      </g>;
    })}
    <g className="city-compass" transform="translate(719 397)"><circle r="25" fill="#fffdf5" fillOpacity=".6" stroke="#d9ddc9" /><path d="M0-16-6 5l6-3 6 3z" fill="#809675" /><path d="M0 2v15" stroke="#bdc7ad" /><text x="0" y="-31" textAnchor="middle" fontSize="9" fill="#87967b">N</text></g>
    <text x="400" y="476" textAnchor="middle" fill="#8b977d" fontSize="11" letterSpacing="3">不必走很远，也能发现一点新鲜</text>
  </svg>
    <nav className="city-mobile-places" aria-label="栈城地点快捷选择">
      {cityPlaces.map(place => <button key={place.id} type="button" aria-pressed={location === place.id} className={location === place.id ? 'is-current' : ''} onClick={() => onSelect(place.id)}>{LOCATIONS[place.id].name}</button>)}
    </nav>
  </div>;
}
