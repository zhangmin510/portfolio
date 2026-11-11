import type { GameState } from '../domain/types';

type DiscussionTurn = { speaker: 'facilitator' | 'engineer' | 'player'; text: string };

export function getPostmortemDiscussion(game: GameState): readonly DiscussionTurn[] {
  const choices = game.careerChoices ?? [];
  const timeline = choices.includes('618-drill')
    ? '6 月 18 日 23:47，下游服务变慢。压测时设的告警及时响了，订单链路还有余量，但一些通知延迟了。'
    : '优惠入口上线后，访问量超过平日容量。6 月 18 日 23:47，下游服务开始超时，部分用户迟迟收不到订单通知。';
  const mitigation = choices.includes('incident-hotfix')
    ? '我先调了超时参数，再重启服务。延迟短暂回落，重启却又触发一批重复任务。我们清理队列，值班一直持续到凌晨。'
    : '我先关掉非核心推荐，限制重试，也通知了值班同事。订单链路稳定后，我们按顺序补发了积压通知。';

  return [
    { speaker: 'facilitator', text: timeline },
    { speaker: 'engineer', text: '超时后的任务反复重试，缺少重试上限。新任务和旧任务挤在同一个队列里，下游越慢，积压越多。' },
    { speaker: 'player', text: mitigation },
    { speaker: 'facilitator', text: '接下来怎么排？可以给限流和演练定负责人，下个迭代验收。也可以先写简报，恢复原排期，重试治理暂缓。' },
  ];
}
