import type { ChoiceId, LocationId, TraitId, WishId } from '../domain/types';

export const LOCATIONS: Record<LocationId, { name: string; subtitle: string; description: string; icon: string }> = {
  home: { name: '我的小窝', subtitle: '梧桐里 · 合租公寓', description: '房间不大，刚好装得下生活和一点野心。', icon: 'home' },
  office: { name: '字节花园', subtitle: '科技园 · 产品研发部', description: '第一份需求已经在白板上了。先把问题问清楚。', icon: 'office' },
  cafe: { name: '半拍咖啡', subtitle: '街角 · 慢一点也没关系', description: '咖啡、插座，还有终于能专心写下的想法。', icon: 'coffee' },
  store: { name: '好邻便利店', subtitle: '梧桐里 · 24 小时营业', description: '热乎的关东煮，通常比空着肚子想事情有用。', icon: 'store' },
  park: { name: '栈桥公园', subtitle: '河边 · 把屏幕放一会儿', description: '代码可以稍后再看，傍晚的风不会一直等你。', icon: 'leaf' },
  makerspace: { name: '周末造物所', subtitle: '旧厂房 · 小作品也有观众', description: '这里的人都在做一些暂时还不赚钱的好玩东西。', icon: 'code' },
};

export const TRAITS: Record<TraitId, { name: string; description: string }> = {
  focused: { name: '专注', description: '实现效率 +10%，独处时社交需求消耗略快。' },
  outgoing: { name: '外向', description: '聊天与聚会恢复更多社交；独处时更容易觉得无聊。' },
  'night-owl': { name: '夜猫子', description: '18 点后精力消耗更慢，10 点前更容易疲惫。' },
  steady: { name: '求稳', description: '压力增加减缓 30%，实现速度略慢。' },
};

export const WISHES: Record<WishId, { name: string; description: string }> = {
  balance: { name: '好好生活', description: '认真工作，也给吃饭、朋友和休息留下位置。' },
  craft: { name: '写出好代码', description: '弄懂问题，把第一份需求做得可靠一点。' },
  sideproject: { name: '做自己的作品', description: '下班后，为那个一直想做的小工具迈出一步。' },
};

export const EVENT_CHOICES: Array<{ id: ChoiceId; title: string; description: string; effects: string[] }> = [
  {
    id: 'negotiate',
    title: '先做核心流程，把范围说清楚',
    description: '和产品经理确认：这周先交付可用版本，复杂筛选放到下一轮。',
    effects: ['沟通 15 分钟', '项目进度 +6', '职业信用 +5', '压力 −6'],
  },
  {
    id: 'promise',
    title: '都接下来，先快速做出一版',
    description: '保留全部功能。接下来的实现会更快，但维护和验证需要你自己兜住。',
    effects: ['不额外消耗时间', '后续实现效率 +15%', '技术债 +12', '压力 +12'],
  },
  {
    id: 'ask-help',
    title: '请林工一起拆解，再动手',
    description: '多花一些时间结对，把边界条件过一遍，也认识这位新同事。',
    effects: ['结对 45 分钟', '项目进度 +10', '质量 +8', '林工信任 +10'],
  },
];
