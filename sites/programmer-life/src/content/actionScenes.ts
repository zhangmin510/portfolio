import type { ActionId } from '../domain/types';

export interface ActionStep {
  label: string;
  milliseconds: number;
  screen?: string;
  dialogue?: { speaker: string; text: string };
}

const step = (label: string, milliseconds = 1400, screen?: string): ActionStep => ({ label, milliseconds, screen });
const say = (label: string, milliseconds: number, speaker: string, text: string): ActionStep => ({ label, milliseconds, dialogue: { speaker, text } });

export const ACTION_SCENES = {
  breakfast: [step('到厨房打蛋、开火', 1700), step('把煎蛋和牛奶端上桌'), step('坐下来吃早餐', 1200)],
  cook: [step('到料理台洗菜、备料', 1700), step('翻炒，盛出一盘热菜'), step('端碗吃饭', 1200)],
  rest: [step('离开手头的事', 1700), step('坐下来歇一会儿'), step('伸个懒腰', 1000)],
  sleep: [step('走到床边', 1700), step('关灯，躺下休息'), step('窗外渐渐天亮', 1100)],
  personal: [step('坐到桌前，打开稍后阅读项目', 1800, 'reading-list.ts'), step('敲下保存文章的逻辑', 1600, 'export function saveArticle(url) {\n  readingList.add(url);\n}'), step('保存并查看预览', 1200, '✓ 文章已加入稍后阅读')],
  focus: [step('走到工位，打开通知模块', 1900, 'src/notifications.ts'), step('敲下代码，逐条校验通知', 1900, 'const pending = events.filter(isUnread);\nreturn deduplicate(pending);'), step('保存改动，运行本地检查', 1450, '✓ notifications.test.ts\n✓ 重复通知用例通过')],
  rush: [step('打开待交付的改动', 1800, 'src/notifications.ts'), step('快速写完主流程', 1700, 'return events.map(toNotification);'), step('提交草稿，记下待补测试', 1250, 'TODO: 验证空列表与重复事件')],
  test: [step('打开差异和测试文件', 1800, 'notifications.test.ts'), step('运行测试，查看失败用例', 1700, 'FAIL 重试后不应发送重复通知'), step('补上边界检查，重新跑测试', 1350, '✓ 首次发送\n✓ 重试去重\n✓ 空列表')],
  ai: [step('输入任务，发给 Codex', 2000, '给通知接口补上重试去重，并添加测试。'), step('等待 Codex 回复', 2300, '正在读取通知模块和测试文件…'), step('收到补丁，查看差异并核对测试', 2100, '+ if (sent.has(event.id)) return;\n+ sent.add(event.id);\n✓ 新增重试去重用例')],
  talk: [step('走到林工桌旁', 1700), say('说明卡住的地方', 1850, '你', '同一条通知重试两次，有时会出现两个红点。'), say('听林工指给你看', 2200, '林工', '先看事件编号。要是两次用的是同一个编号，测试就能把它复现出来。')],
  overtime: [step('打开周末值班表', 1600), step('确认接班'), step('查看值班说明', 1000)],
  lunch: [step('在餐桌旁坐下', 1600), step('捧碗吃面'), step('放下碗，收拾餐桌', 1000)],
  'lunch-break': [step('离开工位', 1600), step('靠着椅背闭眼休息'), step('起身，准备下午的工作', 1000)],
  coffee: [step('走到半拍咖啡的窗边桌', 1600), say('端起热咖啡，慢慢喝一口', 1750, '店员', '刚做好的，小心杯口烫。'), step('放下杯子，看一会儿街景', 1200)],
  walk: [step('走上栈桥公园的步道', 1600), step('沿河走到树旁', 1650), step('转身往回走', 1350)],
  'midweek-walk': [step('在步道上碰到阿遥', 1600), say('一起沿河走', 2150, '阿遥', '你那个稍后阅读工具，要是能离线看就好了。地铁上老是没信号。'), step('走到树边道别', 1300)],
  groceries: [step('到便利店挑饭团和汤', 1600), say('拿到收银台结账', 1650, '店员', '饭团给你热好了，汤单独放，别洒在袋子里。'), step('拎着晚餐出门', 1100)],
  meetup: [step('走到造物所的展台', 1600), step('给阿遥演示怎么存一篇文章', 1650), say('听反馈，记下一个改动', 2350, '阿遥', '存进去很顺。要是能在列表上直接标成已读，我就愿意每天用。')],
} satisfies Record<ActionId, readonly [ActionStep, ActionStep, ActionStep]>;
