import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { createMeetingRoom, meetingSeats, meetingSpeakers, meetingTimeline, meetingTimelineIndex } from '../world/meetingRoom';
import type { MeetingBoard, MeetingSpeaker } from '../world/meetingRoom';
import '../styles/postmortem-meeting.css';

export type { MeetingSpeaker } from '../world/meetingRoom';

export interface PostmortemMeetingProps {
  stage: number;
  speaker: MeetingSpeaker;
  speakerName: string;
  playerName: string;
  reduceMotion?: boolean;
  participantNames?: Partial<Record<MeetingSpeaker, string>>;
  boardTitle?: string;
  boardRows?: readonly string[];
}

const illustratedSeats: Record<MeetingSpeaker, [number, number]> = {
  lead: [277, 188],
  engineer: [382, 185],
  product: [187, 237],
  player: [395, 285],
};

function IllustratedParticipant({ id, active }: { id: MeetingSpeaker; active: boolean }) {
  const [x, y] = illustratedSeats[id];
  const { shirt, skin } = meetingSeats[id];
  return <g transform={`translate(${x} ${y})`}>
    <ellipse cy="1" rx="24" ry="8" fill="#465a47" opacity=".16" />
    <path d="M-19-35h36v35h-36z" fill="#729085" />
    <path d="M-15-5v16m30-16v16" stroke="#4e665d" strokeWidth="3" />
    <path d="M-10-7-9 3h7l2-10m1 0 3 10h8L10-7" fill="#455e64" />
    <rect x="-13" y="-38" width="26" height="33" rx="8" fill={shirt} />
    <path d={active ? 'M-10-31-20-19-29-31m40 3 12 13' : 'M-10-31-20-17m31-12 11 14'} fill="none" stroke={skin} strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
    <ellipse cy="-47" rx="12" ry="14" fill={skin} />
    <path d="M-12-46q-4-16 9-16 17-3 16 16l-6-7q-8 5-15-1z" fill="#39483f" />
    <circle cx="-3.7" cy="-47" r="1.1" fill="#343d37" /><circle cx="5.5" cy="-47" r="1.1" fill="#343d37" />
    <ellipse cx="1" cy="-41" rx="2.45" ry={active ? '2.12' : '.85'} fill="#8c5b48" />
    {active && <g fill="none" stroke="#298264" strokeWidth="2" strokeLinecap="round">
      <path d="M16-49q4 3 0 6m5-10q8 6 0 13" />
      <ellipse cy="7" rx="26" ry="9" stroke="#4f9d78" />
    </g>}
  </g>;
}

function MeetingIllustration({ speaker, stage, board }: Pick<PostmortemMeetingProps, 'speaker' | 'stage'> & { board: MeetingBoard }) {
  const activeTimeline = meetingTimelineIndex(stage, board.rows.length);
  const column = 214 / board.rows.length;
  return <svg className="postmortem-illustration" viewBox="0 0 660 345" aria-hidden="true" focusable="false">
    <ellipse cx="343" cy="276" rx="236" ry="54" fill="#8e9e8a" opacity=".17" />
    <path d="M87 201 309 112 573 209 337 327 87 218Z" fill="#a69e84" />
    <path d="M87 201 309 112 573 209 337 310Z" fill="#d9c4a1" stroke="#c5af8d" />
    <path d="M87 201V95L309 9v103z" fill="#d6e1d3" stroke="#bbc9b7" />
    <path d="M309 112V9l264 97v103z" fill="#e7eee0" stroke="#c8d3c2" />
    <path d="M87 95 309 9l264 97" fill="none" stroke="#f6f5e8" strokeWidth="5" strokeLinejoin="round" />
    <path d="m100 194 209-83 249 92" fill="none" stroke="#aeb9a5" strokeWidth="5" />
    <path d="M105 119 255 61v64l-150 58z" fill="#a2c9ca" stroke="#eff4e5" strokeWidth="6" />
    <path d="m111 154 28-13v-18l21-9v22l22-8v-29l29-11v22l36-14v26l-136 52z" fill="#86aead" />
    <path d="M182 91v60m-73 0 143-57" fill="none" stroke="#eff4e5" strokeWidth="4" />
    <g transform="translate(323 25) skewY(20)">
      <rect x="-4" y="-4" width="227" height="83" rx="4" fill="#81978b" />
      <rect width="219" height="75" rx="2" fill="#f7faee" />
      <text x="10" y="21" fontSize="15" fontWeight="700" fill="#2c594d">{board.title}</text>
      <path d={`M18 34h${column * (board.rows.length - 1)}`} stroke="#c3d2c6" strokeWidth="2" />
      {board.rows.map((step, index) => <g key={`${index}-${step}`}>
        <circle cx={18 + index * column} cy="34" r={activeTimeline === index ? 4.7 : 3.1} fill={activeTimeline === index ? '#468369' : '#aec1b4'} />
        <rect x={5 + index * column} y="44" width={column - 5} height="21" rx="4" fill={activeTimeline === index ? '#d4e9d8' : '#e5ebe0'} />
        <text x={5 + index * column + (column - 5) / 2} y="58" fontSize={Math.min(10.2, (column - 11) / Math.max(1, step.length))} textAnchor="middle" fill="#385a50">{step}</text>
      </g>)}
    </g>
    <path d="M149 228 330 145l175 61-177 86z" fill="#a8b8a4" stroke="#93aa97" />
    <path d="M168 228 330 154l155 55-157 76z" fill="#b7c6b1" />
    <IllustratedParticipant id="lead" active={speaker === 'lead'} />
    <IllustratedParticipant id="engineer" active={speaker === 'engineer'} />
    <IllustratedParticipant id="product" active={speaker === 'product'} />
    <path d="M209 207v27m121 21v29m133-85v23m-18 4v22" stroke="#596c62" strokeWidth="7" strokeLinecap="round" />
    <path d="M207 200 338 145l129 54v10l-135 61-125-57z" fill="#a77d58" />
    <path d="M207 200 338 145l129 54-135 59z" fill="#c9a577" stroke="#b69168" />
    <path d="m221 200 117-49 113 48-119 52z" fill="none" stroke="#d9b68c" />
    <path d="m286 202 25-12 26 10-27 12z" fill="#f4efda" stroke="#d7cbad" />
    <path d="m288 198 25-12 26 10-27 12z" fill="#fbf7e6" />
    <path d="m299 198 13-6 14 5m-22 4 12-6 10 4" fill="none" stroke="#9eaa92" strokeWidth=".9" />
    <path d="m362 181 27 10-20 9-24-10z" fill="#5a736a" />
    <path d="m345 175 28-11 16 27-27-10z" fill="#36554f" />
    <path d="m349 176 23-9 10 19-18-7z" fill="#82a6a0" />
    <path d="m401 217 23-9 18 7-23 9z" fill="#d6e3cf" />
    <path d="m259 193 8-3-1 13q-4 4-7 0z" fill="#e6c484" /><ellipse cx="263" cy="192" rx="4.6" ry="2.2" fill="#806c51" />
    <IllustratedParticipant id="player" active={speaker === 'player'} />
    <g transform="translate(518 244)">
      <ellipse rx="16" ry="6" fill="#465a47" opacity=".17" />
      <path d="M-11-19h22L7 1H-7z" fill="#ba8465" />
      <ellipse cy="-19" rx="11" ry="4" fill="#cf9a77" />
      <path d="M0-19v-41m0 24-13-12m13 4 10-10" stroke="#5e855c" strokeWidth="2" />
      <ellipse cx="-12" cy="-45" rx="6" ry="12" fill="#81a572" transform="rotate(-42 -12 -45)" />
      <ellipse cx="9" cy="-49" rx="6" ry="13" fill="#90ae79" transform="rotate(42 9 -49)" />
      <ellipse cx="-1" cy="-58" rx="6" ry="12" fill="#648e63" transform="rotate(-12 -1 -58)" />
    </g>
  </svg>;
}

export function PostmortemMeeting(props: PostmortemMeetingProps) {
  const { speaker, stage, speakerName, playerName, participantNames, reduceMotion, boardTitle, boardRows } = props;
  const host = useRef<HTMLDivElement>(null);
  const speakerBadge = useRef<HTMLSpanElement>(null);
  const redraw = useRef<(() => void) | null>(null);
  const board = useMemo<MeetingBoard>(() => ({
    title: boardTitle ?? '故障时间线',
    rows: boardRows?.length ? boardRows.slice(0, 4) : meetingTimeline,
    tag: boardTitle || boardRows ? undefined : '618',
  }), [boardTitle, boardRows]);
  const latest = useRef({ speaker, stage, reduceMotion, board });
  latest.current = { speaker, stage, reduceMotion, board };
  const [painted, setPainted] = useState(false);
  const names = meetingSpeakers.map(id => participantNames?.[id] ?? (id === 'player' ? playerName : meetingSeats[id].name));

  useEffect(() => {
    const mount = host.current;
    if (!mount) return;
    const canvas = document.createElement('canvas');
    let renderer: THREE.WebGLRenderer;
    try {
      const context = canvas.getContext('webgl2', { alpha: true, antialias: true, powerPreference: 'low-power' });
      if (!context) return;
      renderer = new THREE.WebGLRenderer({ canvas, context, alpha: true, antialias: true });
    } catch {
      return;
    }

    const model = createMeetingRoom();
    const scene = new THREE.Scene();
    scene.add(model.group);
    scene.add(new THREE.HemisphereLight('#f0f7ed', '#a3ad98', 1.68));
    const sun = new THREE.DirectionalLight('#fff1dc', 2.65);
    sun.position.set(-3.5, 8.5, 6.5);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    sun.shadow.normalBias = .022;
    Object.assign(sun.shadow.camera, { left: -8, right: 8, top: 7, bottom: -7, near: .5, far: 25 });
    scene.add(sun);

    const camera = new THREE.OrthographicCamera(-9, 9, 4, -4, .1, 65);
    camera.position.set(6.5, 8.35, 13.4);
    camera.lookAt(0, 1.57, -.23);
    camera.updateMatrixWorld();
    renderer.setClearColor('#e5ebe0', 0);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.65));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = .98;
    mount.append(canvas);

    const position = new THREE.Vector3();
    const motionPreference = window.matchMedia('(prefers-reduced-motion: reduce)');
    let frame = 0;
    let width = 0;
    let height = 0;
    let contextLost = false;
    let visible = false;
    let lastStage = -1;
    let lastSpeaker: MeetingSpeaker | null = null;
    let turnStarted = 0;

    function draw(now: number) {
      if (contextLost || !width || !height) return;
      const current = latest.current;
      const animate = !current.reduceMotion && !motionPreference.matches;
      if (current.stage !== lastStage || current.speaker !== lastSpeaker) {
        lastStage = current.stage;
        lastSpeaker = current.speaker;
        turnStarted = now;
      }
      model.pose(current.speaker, current.stage, (now - turnStarted) / 1000, animate, current.board);
      if (speakerBadge.current) {
        model.speakerPosition(current.speaker, position).project(camera);
        const x = Math.max(12, Math.min(88, (position.x + 1) * 50));
        const y = Math.max(13, Math.min(85, (1 - position.y) * 50));
        speakerBadge.current.style.setProperty('--meeting-speaker-x', `${x}%`);
        speakerBadge.current.style.setProperty('--meeting-speaker-y', `${y}%`);
      }
      renderer.render(scene, camera);
      if (!visible) {
        visible = true;
        setPainted(true);
      }
      if (animate) frame = requestAnimationFrame(draw);
    }

    function requestDraw() {
      cancelAnimationFrame(frame);
      if (!contextLost) frame = requestAnimationFrame(draw);
    }

    function resize() {
      if (!mount || contextLost) return;
      width = mount.clientWidth;
      height = mount.clientHeight;
      if (!width || !height) return;
      const aspect = width / height;
      const vertical = Math.max(7.55, 13.4 / aspect);
      camera.left = -vertical * aspect / 2;
      camera.right = vertical * aspect / 2;
      camera.top = vertical / 2;
      camera.bottom = -vertical / 2;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height, false);
      requestDraw();
    }

    function loseContext(event: Event) {
      event.preventDefault();
      contextLost = true;
      visible = false;
      cancelAnimationFrame(frame);
      setPainted(false);
    }

    function restoreContext() {
      contextLost = false;
      resize();
    }

    const observer = new ResizeObserver(resize);
    observer.observe(mount);
    canvas.addEventListener('webglcontextlost', loseContext);
    canvas.addEventListener('webglcontextrestored', restoreContext);
    motionPreference.addEventListener('change', requestDraw);
    redraw.current = requestDraw;
    resize();

    return () => {
      redraw.current = null;
      cancelAnimationFrame(frame);
      observer.disconnect();
      canvas.removeEventListener('webglcontextlost', loseContext);
      canvas.removeEventListener('webglcontextrestored', restoreContext);
      motionPreference.removeEventListener('change', requestDraw);
      model.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
      canvas.remove();
    };
  }, []);

  useEffect(() => { redraw.current?.(); }, [speaker, stage, reduceMotion, board]);

  return <figure
    className="postmortem-meeting"
    data-meeting-renderer={painted ? 'webgl' : 'svg'}
    data-meeting-speaker={speaker}
    data-meeting-stage={stage}
    role="img"
    aria-label={`${names.join('、')}围桌开会。白板记录${board.rows.join('、')}。${speakerName}正在发言。`}
  >
    <div className="postmortem-meeting-canvas" ref={host} aria-hidden="true" />
    {!painted && <MeetingIllustration speaker={speaker} stage={stage} board={board} />}
    <span className="postmortem-speaker" ref={speakerBadge} aria-hidden="true"><i />{speakerName}发言中</span>
  </figure>;
}
