import type { GameState } from './types';

export interface CareerMetrics {
  stability: number;
  credit: number;
  pressure: number;
}

export interface CareerOption {
  id: string;
  title: string;
  description: string;
  effects: string[];
}

export interface CareerEvent {
  id: string;
  title: string;
  date: string;
  description: string;
  options: CareerOption[];
}

interface CareerProgress {
  current: CareerEvent | null;
  history: { event: CareerEvent; option: CareerOption; result: string }[];
  metrics: CareerMetrics;
  rating: string | null;
  graduated: boolean;
}

interface CareerDecision {
  option: CareerOption;
  delta: CareerMetrics;
  result: string;
}

type CareerChapter = Omit<CareerEvent, 'options'> & { decisions: CareerDecision[] };

interface CareerContext {
  metrics: CareerMetrics;
  choices: string[];
  rating: string | null;
}

const METRIC_LABELS: Record<keyof CareerMetrics, string> = { stability: '稳定性', credit: '职业信用', pressure: '压力' };
const GRADUATION_CHOICES = new Set(['graduation-job', 'graduation-independent', 'graduation-rest']);

function bounded(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function decision(id: string, title: string, description: string, delta: CareerMetrics, result: string): CareerDecision {
  const effects = (Object.keys(METRIC_LABELS) as (keyof CareerMetrics)[])
    .filter(metric => delta[metric] !== 0)
    .map(metric => `${METRIC_LABELS[metric]} ${delta[metric] > 0 ? '+' : '−'}${Math.abs(delta[metric])}`);
  return { option: { id, title, description, effects }, delta, result };
}

function baseMetrics(summary: GameState['summary']): CareerMetrics {
  if (!summary) return { stability: 46, credit: 45, pressure: 18 };
  return {
    stability: bounded(Math.max(42, 46 + summary.quality * 0.4 - summary.debt * 0.4)),
    credit: bounded(Math.max(45, 45 + summary.workMinutes / 60 + summary.progress * 0.1)),
    pressure: bounded(Math.max(12, 18 + summary.debt * 0.3 - summary.quality * 0.18 - (summary.tags.includes('生活也有进度') ? 3 : 0))),
  };
}

function performanceRating({ stability, credit, pressure }: CareerMetrics) {
  const score = stability * 0.55 + credit * 0.45 - pressure * 0.25;
  if (score >= 77) return 'A · 超出预期';
  if (score >= 49) return 'B · 符合预期';
  return 'C · 需要改进';
}

const CHAPTERS: ((context: CareerContext) => CareerChapter)[] = [
  () => ({
    id: 'launch', title: '首次项目上线', date: '5 月 23 日',
    description: '入职几周后，消息提醒已经通过验收。林可希望今天让所有用户用上，林工建议先验证回滚。你负责这次发布。',
    decisions: [
      decision('launch-canary', '从小流量开始', '先开放给 5% 的用户，盯住错误率，再逐步扩大。',
        { stability: 16, credit: 6, pressure: 4 }, '灰度时发现一处旧客户端兼容问题，补上后再扩大流量。整次发布顺利结束。'),
      decision('launch-wide', '今天一次发全量', '赶上产品公告，先把功能交给所有用户。',
        { stability: -10, credit: 9, pressure: 11 }, '功能准时上线，旧客户端却收到重复提醒。你当晚补了兼容逻辑，回滚演练被推到了下一周。'),
    ],
  }),
  ({ choices }) => ({
    id: '618', title: '618 大促', date: '6 月 18 日',
    description: choices.includes('launch-wide')
      ? '上次发布留下的回滚演练还没做。618 流量预估翻三倍，运营希望再加一个优惠入口，准备时间只够优先处理一件事。'
      : '上次灰度让团队有了监控看板。618 流量预估翻三倍，运营希望再加一个优惠入口，准备时间只够优先处理一件事。',
    decisions: [
      decision('618-drill', '先完成压测和扩容', '确认容量上限，把降级和回滚演练一遍。',
        { stability: 12, credit: 7, pressure: 8 }, '容量调整完成，告警阈值有了依据。团队也确认了哪些非核心功能可以暂时关掉。'),
      decision('618-feature', '先把优惠入口做完', '抓住运营窗口，沿用平日的容量与回滚流程。',
        { stability: -11, credit: 8, pressure: 16 }, '优惠入口顺利开张，访问量很快超过平日容量。你开始盯着延迟曲线等这一波流量过去。'),
    ],
  }),
  ({ choices }) => ({
    id: 'incident', title: '紧急线上事故', date: '6 月 18 日 · 23:47',
    description: choices.includes('618-drill')
      ? '大促快结束时，下游服务变慢，通知任务开始重试。压测时布好的告警及时响了，主链路还有余量。'
      : '大促快结束时，下游服务变慢，积压任务反复重试。优惠入口还能打开，但部分用户的订单通知迟迟不到。',
    decisions: [
      decision('incident-degrade', '先降级，保住订单链路', '关掉非核心推荐，限制重试，把用户影响告知值班同事。',
        { stability: 15, credit: 7, pressure: 7 }, '主链路恢复稳定，团队按顺序补发积压通知。事故记录里留下了重试风暴的触发条件。'),
      decision('incident-hotfix', '现场改超时参数并重启', '尽快恢复通知，省下切换方案的时间。',
        { stability: -13, credit: 2, pressure: 15 }, '延迟短暂回落，重启又触发了一批重复任务。你们临时清理队列，值班一直持续到凌晨。'),
    ],
  }),
  ({ choices }) => ({
    id: 'postmortem', title: '事故复盘', date: '6 月 20 日',
    description: choices.includes('incident-hotfix')
      ? '日志显示，紧急重启触发了第二次重试。会议上需要解释这条因果链，并决定要不要挪出下个迭代修它。'
      : '团队根据降级前后的指标，还原了重试堆积的时间线。会议上需要确定修复优先级和验收方式。',
    decisions: [
      decision('review-owner', '为修复项定人、定时间', '记录用户影响，为重试限流和演练分配责任人，下个迭代验收。',
        { stability: 14, credit: 7, pressure: -8 }, '重试上限和监控补齐。下次演练复现了同样的下游超时，这次积压没有再扩大。'),
      decision('review-brief', '写简报，恢复原排期', '留下事故结论，暂缓重试治理，尽快把团队还给既定需求。',
        { stability: -4, credit: 1, pressure: -12 }, '团队回到了原排期，短期压力缓和。重试治理没有排期，仍可能在下一次高峰出问题。'),
    ],
  }),
  ({ choices, metrics }) => {
    const retryFixed = choices.includes('review-owner');
    const readyForFullLaunch = retryFixed && metrics.stability >= 70;
    return {
      id: '1111', title: '双十一大促', date: '11 月 11 日',
      description: retryFixed
        ? '618 的重试治理已验收。双十一当天，运营想把新的个性化推荐一起上线，团队在发布窗口前等你的决定。'
        : '618 的重试治理还没排上。双十一当天，运营想把新的个性化推荐一起上线，团队在发布窗口前等你的决定。',
      decisions: [
        decision('1111-canary', '冻结变更，分批放量', '保留回滚窗口，让值班同事先用演练脚本检查主链路。',
          { stability: 13, credit: 11, pressure: 6 }, retryFixed
            ? '高峰期出现了熟悉的下游超时，重试上限把它控制住了。推荐功能分批上线，订单服务平稳度过高峰。'
            : '演练重现了积压。你们在高峰前限制重试并关闭非核心入口，订单没有受影响。'),
        decision('1111-full', '同时上线新的推荐功能', '争取让活动流量用上新功能，团队按全量方案值守。',
          readyForFullLaunch ? { stability: -4, credit: 16, pressure: 18 } : { stability: -15, credit: -9, pressure: 18 },
          readyForFullLaunch
            ? '新功能用上了活动流量，已有的重试保护撑过了峰值。团队多守了两个小时才确认稳定。'
            : '推荐服务的超时拖慢了页面。值班组回滚变更，活动期间的新功能交付取消。'),
      ],
    };
  },
  ({ choices }) => ({
    id: 'year-review', title: '年终总结', date: '12 月 23 日',
    description: choices.includes('review-owner')
      ? '从第一次发布到两场大促，工单里既有交付记录，也有一次修完并验收的事故治理。经理请你提交年度总结。'
      : '从第一次发布到两场大促，工单里既有交付记录，也有尚未关闭的治理项。经理请你提交年度总结。',
    decisions: [
      decision('year-evidence', '把交付、问题和改进都写清楚', '补上指标和责任范围，注明还需要资源的事项。',
        { stability: 0, credit: 12, pressure: -4 }, '经理能从总结查到交付和复盘的证据，也知道哪些治理项需要团队一起安排。'),
      decision('year-delivery', '只整理交付清单', '按时提交上线内容与版本记录，把余下时间还给自己。',
        { stability: 0, credit: 5, pressure: -8 }, '总结清楚列了上线事项。阅读的人还需要找你确认，哪些结果由你推动，哪些问题尚待处理。'),
    ],
  }),
  ({ metrics }) => {
    const rating = performanceRating(metrics);
    return {
      id: 'performance', title: '绩效公布', date: '次年 1 月 12 日',
      description: `绩效系统给出「${rating}」。上季度，主管说评估看交付质量和约定的值班表现。面谈时他又说「别的同事半夜都在线，你按时下班，说明投入不够。」你问哪次响应影响了交付，他只回了一句「先反省自己的态度」。`,
      decisions: [
        decision('rating-plan', '请主管写下标准和实例', '带上交付与值班记录，问清哪项约定没有完成，以及下季度按什么衡量。',
          { stability: 0, credit: 4, pressure: -5 }, `已公布的绩效为「${rating}」。主管没有指出哪次承诺落空，只说会再整理标准。你把面谈内容和待确认的问题发给了他。`),
        decision('rating-peer', '找林工核对值班记录', '先向信任的同事确认，哪些时段本来就有响应约定。',
          { stability: 0, credit: 2, pressure: -8 }, `已公布的绩效为「${rating}」。林工和你核对了记录，值班表上的响应都已完成。他愿意在下次明确值班安排时一起参加。`),
        decision('rating-reflect', '按约定下线，明天再谈', '记下主管的原话和你想问的问题，保留今晚的安排。',
          { stability: 0, credit: 0, pressure: -11 }, `已公布的绩效为「${rating}」。你按值班表完成交接，照原计划出去散步，准备明天再谈具体标准。`),
      ],
    };
  },
  ({ rating }) => ({
    id: 'party', title: '公司年会', date: '次年 1 月 26 日',
    description: `年会前，年度绩效「${rating ?? '已公布'}」已经确认。你在桌边遇到了林可和林工。两场大促结束后，大家终于能坐下吃一顿不用盯告警的饭。`,
    decisions: [
      decision('party-connect', '和同事坐一桌', '谢谢那几次一起值班的人，也听听大家过年后的打算。',
        { stability: 0, credit: 3, pressure: -6 }, '你们聊起那个差点错过的告警，笑过之后，约好明年轮流负责发布。'),
      decision('party-rest', '吃完饭就早点回家', '和大家道别，把这一年最后一个晚上留给自己。',
        { stability: 0, credit: 0, pressure: -14 }, '回家的路上，你没有打开工作群。到家后，把明年想继续做的三件事写了下来。'),
    ],
  }),
  ({ choices, metrics, rating }) => {
    const role = metrics.credit >= 75
      ? '整合通知服务时，林工请你带一个小项目，或者选一块需要长期治理的技术问题。'
      : '林工愿意陪你复盘去年的交付。你可以和他一起带小项目，也可以先治理通知服务。';
    const boundary = choices.includes('rating-plan')
      ? '你拿出上次面谈的记录，请主管把验收和响应要求写进项目说明。'
      : choices.includes('rating-peer')
        ? '林工和你一起把值班范围列进了新项目的计划。'
        : '你接任务前先确认了值班轮换，把自己的晚间安排也留了出来。';
    return {
      id: 'year-two-role', title: '第二年的职责选择', date: '第 2 年 · 8 月 8 日',
      description: `首年绩效是「${rating}」。${role}${boundary}`,
      decisions: [
        decision('year-two-lead', '带一个小项目', '负责拆任务、协调依赖和交接，陪一位新同事走完第一次发布。',
          { stability: 4, credit: 13, pressure: 12 }, '你带着新人完成了第一次发布。项目时间多花了一周，下一次值班时已有人能独立处理常见告警。'),
        decision('year-two-depth', '深入做一项技术治理', '完善限流、可观测性和演练脚本，为通知服务建立可重复的测试。',
          { stability: 15, credit: 7, pressure: 3 }, '你把事故里的关键情形写进自动化演练。接下来几个月，团队更早发现了同类风险。'),
      ],
    };
  },
  ({ choices }) => ({
    id: 'year-three-transition', title: '组织调整与交接', date: '第 3 年 · 10 月 17 日',
    description: choices.includes('year-two-lead')
      ? '部门宣布合并业务，现有团队将在年底撤销。你带过的同事会进入合并后的团队，当前项目需要交接，也需要留时间安排自己的下一步。'
      : '部门宣布合并业务，现有团队将在年底撤销。你维护的通知服务会转交平台组，手头的演练和治理经验也能整理成作品。',
    decisions: [
      decision('year-three-handoff', '把系统交到接手人手里', '留出两周结对交接，讲清告警、回滚和仍待治理的风险。',
        { stability: 11, credit: 9, pressure: 8 }, '接手人独立跑完演练，值班名单完成切换。经理愿意为你的交接工作提供推荐。'),
      decision('year-three-prepare', '确认基本交接，准备下一站', '整理必要文档和联系人，然后腾出时间更新作品与简历。',
        { stability: -4, credit: 2, pressure: -11 }, '关键系统有了接手人，部分后续改进交给新团队排期。你整理出能带走的项目经验和一段空闲时间。'),
    ],
  }),
  ({ choices, metrics }) => {
    const hasReferral = choices.includes('year-three-handoff') && metrics.credit >= 75;
    const direction = choices.includes('year-two-lead') ? '项目交付和协作' : '系统稳定性';
    return {
      id: 'graduation', title: '从字节花园毕业', date: '第 3 年 · 12 月 20 日',
      description: hasReferral
        ? '今天是团队最后一个工作日，组织调整后原岗位结束。交接已经验收，经理也愿意为你引荐新机会。你准备把下一段时间交给什么？'
        : '今天是团队最后一个工作日，组织调整后原岗位结束。你关掉值班通知，整理好工作成果和联系人，准备决定下一段时间做什么。',
      decisions: [
        decision('graduation-job', '找下一份工程师工作', '带上做过的项目和事故治理经验，选择想申请的团队。',
          { stability: 0, credit: 4, pressure: 4 }, hasReferral
            ? `你收到了经理引荐的面试邀请，打算重点聊这几年做过的${direction}。在字节花园的工作到此结束。`
            : `你把${direction}写进简历，发出了第一批申请。在字节花园的工作到此结束。`),
        decision('graduation-independent', '试做一段独立开发', '选一个小问题做成产品，先给自己定一个月的试做期。',
          { stability: 0, credit: 0, pressure: 6 }, '你写下产品的第一个可验证目标，约了两位朋友试玩。明天的日程由你自己安排。'),
        decision('graduation-rest', '休息一阵再决定', '给自己留一段空档，重新找回作息，再考虑接下来想做的工作。',
          { stability: 0, credit: 0, pressure: -18 }, '你交还了门禁卡。明天先睡够，再到常去的公园走一圈。下一份工作可以晚一点决定。'),
      ],
    };
  },
];

export const CAREER_EVENT_COUNT = CHAPTERS.length;

export function hasGraduated(state: Pick<GameState, 'careerChoices'>): boolean {
  const choices = state.careerChoices;
  return choices?.length === CAREER_EVENT_COUNT && GRADUATION_CHOICES.has(choices[CAREER_EVENT_COUNT - 1]);
}

function showEvent({ decisions, ...event }: CareerChapter): CareerEvent {
  return { ...event, options: decisions.map(item => item.option) };
}

/** Replay the fixed sequence from the first-day summary so later daily actions cannot change past outcomes. */
export function getCareer(state: GameState): CareerProgress {
  const metrics = baseMetrics(state.firstDaySummary ?? state.summary);
  const history: CareerProgress['history'] = [];
  const context: CareerContext = { metrics, choices: [], rating: null };
  for (const [index, choice] of (state.careerChoices ?? []).entries()) {
    const buildChapter = CHAPTERS[index];
    const chapter = buildChapter?.(context);
    const picked = chapter?.decisions.find(item => item.option.id === choice);
    if (!chapter || !picked) throw new Error('职业事件选择顺序不正确。');
    if (chapter.id === 'performance') context.rating = performanceRating(metrics);
    for (const metric of Object.keys(METRIC_LABELS) as (keyof CareerMetrics)[]) {
      metrics[metric] = bounded(metrics[metric] + picked.delta[metric]);
    }
    context.choices.push(choice);
    history.push({ event: showEvent(chapter), option: picked.option, result: picked.result });
  }
  const nextChapter = state.phase === 'complete' && state.summary ? CHAPTERS[history.length]?.(context) : null;
  return { current: nextChapter ? showEvent(nextChapter) : null, history, metrics, rating: context.rating, graduated: hasGraduated(state) };
}
