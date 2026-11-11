export type MeetingType = "定方向" | "定基调" | "定节奏" | "抓落实" | "释预期";

export type TimelineItem = {
  year: number;
  month: string;
  title: string;
  type: MeetingType;
  theme: string;
  signal: string;
  change: string;
  evidence: string;
  source: string;
  url: string;
};

export const meetingMap = [
  { name: "党代会", rhythm: "五年一次", type: "定方向", output: "报告、中央委员会", horizon: "5年以上", watch: "新增词、词频跃升、战略排序" },
  { name: "中央全会", rhythm: "通常每年至少一次", type: "定方向", output: "决定、规划建议", horizon: "3—5年", watch: "必须 / 推进 / 加快后的宾语" },
  { name: "中央经济工作会议", rhythm: "每年12月", type: "定基调", output: "新华社通稿", horizon: "下一年度", watch: "形势判断、财政货币取向、重点任务" },
  { name: "全国两会", rhythm: "每年3月", type: "定基调", output: "政府、计划、预算报告", horizon: "当年度", watch: "任务排序、量化指标、资金投向" },
  { name: "中央政治局会议", rhythm: "通常每月", type: "定节奏", output: "会议通稿", horizon: "季度 / 半年度", watch: "4月、7月、12月及非常规加会" },
  { name: "中央财经委 / 深改委", rhythm: "不定期", type: "定节奏", output: "审议意见与方案", horizon: "专题中期", watch: "审议通过、牵头部门、公开文件时差" },
  { name: "国务院常务会议", rhythm: "通常每月2—3次", type: "抓落实", output: "方案、条例草案、部署", horizon: "近期执行", watch: "怎么做、何时做、文件何时印发" },
  { name: "国新办 / 部委发布会", rhythm: "高频", type: "释预期", output: "问答、吹风、数据", horizon: "即时", watch: "同一议题反复强调与口径细化" }
] as const;

export const timeline: TimelineItem[] = [
  {
    year: 2013, month: "11月", title: "十八届三中全会",
    type: "定方向", theme: "全面深化改革", signal: "通过改革决定，形成系统施工图",
    change: "改革从单项推进转向全面、系统、协同推进。",
    evidence: "此后各领域配套改革按任务分工持续展开。",
    source: "中国政府网", url: "https://www.gov.cn/jrzg/2013-11/15/content_2528179.htm"
  },
  {
    year: 2015, month: "12月", title: "中央城市工作会议",
    type: "定方向", theme: "城市发展", signal: "时隔37年再次召开中央城市工作会议",
    change: "城市工作从增量扩张转向更强调规律、质量与治理。",
    evidence: "城市规划、建设、治理相关政策形成长期框架。",
    source: "中国政府网", url: "https://www.gov.cn/xinwen/2015-12/22/content_5026592.htm"
  },
  {
    year: 2017, month: "10月", title: "党的十九大",
    type: "定方向", theme: "发展阶段", signal: "社会主要矛盾表述发生变化",
    change: "政策目标从高速增长进一步转向高质量发展与更平衡充分发展。",
    evidence: "高质量发展成为后续规划与宏观政策的重要主线。",
    source: "中国政府网", url: "https://www.gov.cn/zhuanti/2017-10/27/content_5234876.htm"
  },
  {
    year: 2020, month: "12月", title: "中央经济工作会议",
    type: "定基调", theme: "平台经济与竞争政策", signal: "强化反垄断和防止资本无序扩张",
    change: "平台经济政策关注点从鼓励创新扩展到规范发展与公平竞争。",
    evidence: "此后反垄断、平台规则与常态化监管政策持续完善。",
    source: "中国政府网", url: "https://www.gov.cn/xinwen/2020-12/18/content_5571002.htm"
  },
  {
    year: 2021, month: "5—7月", title: "中央深改委审议至“双减”文件公布",
    type: "定节奏", theme: "教育治理", signal: "审议通过后约两个月公开正式文件",
    change: "校外培训从局部规范转向系统治理。",
    evidence: "政策进入全面落地阶段，并形成部门与地方配套。",
    source: "中国政府网", url: "https://www.gov.cn/zhengce/2021-07/24/content_5627132.htm"
  },
  {
    year: 2022, month: "10月", title: "党的二十大",
    type: "定方向", theme: "发展与安全", signal: "安全相关表述显著增强",
    change: "产业、科技、供应链与风险治理更突出自主可控和统筹发展安全。",
    evidence: "科技自立自强、现代化产业体系与韧性安全成为政策高频主题。",
    source: "中国政府网", url: "https://www.gov.cn/xinwen/2022-10/25/content_5721685.htm"
  },
  {
    year: 2023, month: "10月", title: "中央金融工作会议",
    type: "定方向", theme: "金融强监管与服务实体", signal: "全面加强监管、防范风险，金融资源向战略领域倾斜",
    change: "金融政策更突出政治性、人民性、功能性与穿透式监管。",
    evidence: "科技金融、绿色金融、普惠金融、养老金融、数字金融持续深化。",
    source: "中国政府网", url: "https://www.gov.cn/yaowen/liebiao/202310/content_6912992.htm"
  },
  {
    year: 2024, month: "7月", title: "二十届三中全会",
    type: "定方向", theme: "进一步全面深化改革", signal: "提出300多项重要改革举措",
    change: "改革进入以中国式现代化为牵引、更加系统集成的新阶段。",
    evidence: "明确到2029年完成决定提出的改革任务。",
    source: "中国政府网", url: "https://www.gov.cn/yaowen/liebiao/202407/content_6963409.htm"
  },
  {
    year: 2024, month: "9月", title: "中央政治局经济会议",
    type: "定节奏", theme: "增量政策", signal: "非常规时点再次研究经济工作",
    change: "稳增长政策节奏加快，增量政策集中推出。",
    evidence: "财政、地产、资本市场等稳预期工具随后密集落地。",
    source: "中国政府网", url: "https://www.gov.cn/yaowen/liebiao/202409/content_6976686.htm"
  },
  {
    year: 2025, month: "7月", title: "中央城市工作会议",
    type: "定方向", theme: "城市更新", signal: "时隔十年再次召开",
    change: "城市发展更加重视存量提质、韧性安全与精细治理。",
    evidence: "城市更新、地下管网、完整社区等政策持续获得配套。",
    source: "中国政府网", url: "https://www.gov.cn/yaowen/liebiao/202507/content_7032528.htm"
  },
  {
    year: 2025, month: "12月", title: "中央经济工作会议",
    type: "定基调", theme: "提质增效", signal: "从“以进促稳”转向更强调“提质增效”",
    change: "宏观政策在扩总量的同时，更关注存量优化、质量与效益。",
    evidence: "财政保持更加积极、货币保持适度宽松，资源配置更看重有效性。",
    source: "中国政府网", url: "https://www.gov.cn/yaowen/liebiao/202512/content_7049448.htm"
  },
  {
    year: 2026, month: "4月", title: "中央政治局经济会议",
    type: "定节奏", theme: "六张网与扩大内需", signal: "围绕一季度数据校准全年政策节奏",
    change: "基础设施从传统项目扩展到水网、电网、算力网、通信网、地下管网和物流网。",
    evidence: "后续国常会与部门文件持续推进相关规划建设。",
    source: "新华网", url: "https://www.news.cn/politics/leaders/20260428/002222d43f9e47d2947142a92e84a026/c.html"
  },
  {
    year: 2026, month: "7月", title: "中央政治局经济会议",
    type: "定节奏", theme: "下半年经济工作", signal: "加大逆周期调节力度，加力扩大内需、优化供给",
    change: "政策更加重视内需主导、供需协同与新动能培育。",
    evidence: "“六张网”、人工智能+、统一大市场等任务继续细化。",
    source: "新华网", url: "https://www.news.cn/20260730/13ecbfd4cd9b455281a0649232b98ad0/c.html"
  },
  {
    year: 2026, month: "9月", title: "国务院常务会议",
    type: "抓落实", theme: "民生、产业与法治", signal: "部署医疗康复护理扩容，研究体育赛事发展，审议条例草案",
    change: "十五五开局任务进入部门执行、规则建设和服务扩容阶段。",
    evidence: "会议决定将相关修正案草案提请全国人大常委会审议。",
    source: "中国政府网", url: "https://www.gov.cn/yaowen/liebiao/202609/content_7081464.htm"
  }
];

export const framework = [
  { step: "01", title: "定位会议", question: "谁在开、解决什么层级的问题？", output: "会议层级 + 决策半径", detail: "先区分定方向、定基调、定节奏、抓落实、释预期，避免把所有通稿当成同等强度信号。" },
  { step: "02", title: "找增量", question: "与上一次相比，哪里变了？", output: "新增词 + 词频 + 排序 + 指标", detail: "对同类会议做版本比较：新增代表新方向，频次跃升代表优先级上升，排序前移代表资源倾斜。" },
  { step: "03", title: "判阶段", question: "政策离落地还有多远？", output: "研究 → 支持 → 加快 → 全面实施", detail: "动词只能作为第一层证据；必须与时间表、任务清单和责任主体组合判断。" },
  { step: "04", title: "验执行", question: "谁负责、怎么做、钱从哪里来？", output: "牵头部委 + 施工图 + 财政金融", detail: "缺少责任部门、细化措施或资源配套时，只能标记为方向信号，不能直接判断为政策兑现。" },
  { step: "05", title: "建链条", question: "上层会议如何传导到具体政策？", output: "会议 → 文件 → 部委 → 地方 → 数据", detail: "把每条政策放进传导链，记录每一站的时间差、口径变化和执行证据。" },
  { step: "06", title: "设反证", question: "哪些事实会推翻当前判断？", output: "滞后、降调、预算缺口、执行偏差", detail: "持续检查政策是否延迟、措辞是否降级、资金是否缺位、地方执行是否偏离。" }
];

export const verbLadder = [
  { level: 1, label: "研究 / 探索", stage: "议题形成", action: "建立观察清单，不做落地判断" },
  { level: 2, label: "鼓励 / 支持 / 引导", stage: "方向明确", action: "观察试点、地方弹性与参与主体" },
  { level: 3, label: "推动 / 促进 / 加快", stage: "实质推进", action: "跟踪牵头部门、时间表和配套政策" },
  { level: 4, label: "提速加力 / 确保", stage: "加速攻坚", action: "验证资金、指标、考核与执行频率" },
  { level: 5, label: "全面开展 / 常态化推进", stage: "全面实施", action: "转向效果评估与政策副作用监测" }
];

export const sourceCards = [
  {
    title: "如何理解和看懂中国的党政会议体系（上）",
    note: "用于搭建“党代会—中央全会—中央经济工作会议—全国两会”的方向与年度基调框架。",
    href: "https://cubox.pro/web/card/7501164804422241225"
  },
  {
    title: "如何理解和看懂中国的党政会议体系（下）",
    note: "用于搭建“政治局—议事协调机构—国常会—发布会”的政策节奏与落地链条。",
    href: "https://cubox.pro/web/card/7501164908113822475"
  }
];
