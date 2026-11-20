export const groups = [
  {
    id: "desk",
    name: "桌面办公",
    en: "Workspace",
    summary: "在书桌上开视频会，也能把一台电视变成店里的菜单屏。",
    cases: [
      {
        id: "meeting",
        title: "用 iPhone 开一场视频会",
        teaser: "显示器没有摄像头时，桌边的 iPhone 可以同时接管画面和收音。",
        kit: "Mac mini、iPhone XR 或更新机型、手机支架、会议应用",
        steps: [
          { title: "配好两台设备", text: "Mac 使用 macOS 13 或更高版本，iPhone 使用 iOS 16 或更高版本。两端登录同一个已启用双重认证的 Apple 账户，打开 Wi-Fi 和蓝牙。" },
          { title: "把手机固定在屏幕上方", text: "锁定 iPhone，横向放稳，让后置摄像头朝向自己。在会议应用的摄像头菜单中选 iPhone，再到麦克风菜单中选一次。" },
          { title: "打一通测试电话", text: "让对方看画面是否拍全上半身，再读一句正常音量的话。如果会议较长，可以把 iPhone 接上电源。" },
        ],
        result: "对方能看见你，也能听清你的声音，同一台 Mac 上仍可打开会议资料。",
        limit: "使用期间解锁或拿走手机会中断画面，桌面上需要给支架留出固定位置。",
        sources: [
          { name: "Apple · 连续互通相机", url: "https://support.apple.com/zh-cn/102546" },
        ],
      },
      {
        id: "menu",
        title: "让咖啡店菜单循环播放",
        teaser: "烘焙品每天更换，店员可以在一份 Keynote 文件里改好当天的菜单。",
        kit: "Mac mini、HDMI 电视或显示器、Keynote 讲演",
        steps: [
          { title: "按电视比例做三页", text: "用 HDMI 接上店内电视。按电视的宽高比新建演示文稿，给咖啡、今日烘焙和营业时间各做一页，把价格放在品名旁边。" },
          { title: "设定自动翻页", text: "在“文稿”边栏将演示文稿类型设为“自行播放”，调整每页的停留时间，勾选“打开时自动播放”和“循环幻灯片放映”。" },
          { title: "走到柜台对面试看", text: "从第一页播放，站在顾客点单的位置读价格。等到末页自动回到首页，再试着更新一项售罄商品并重新播放。" },
        ],
        result: "电视可以反复展示当天菜单，次日只需编辑这份演示文稿。",
        limit: "循环只在演示播放期间生效。按营业时间调整主机和电视的休眠设置。",
        sources: [
          { name: "Apple · Keynote 自行播放与循环", url: "https://support.apple.com/zh-cn/guide/keynote/tane722d1655/mac" },
        ],
      },
    ],
  },
  {
    id: "studio",
    name: "影音创作",
    en: "Studio",
    summary: "把手机里的旅行素材剪成短片，也能在书桌边录完一期播客。",
    cases: [
      {
        id: "film",
        title: "剪一支 90 秒旅行短片",
        teaser: "两部手机拍了一路，回家后把零散的 4K 素材剪成一段可以分享的行程。",
        kit: "Final Cut Pro、两部手机的素材、有足够余量的工作盘",
        steps: [
          { title: "把原片收进工作盘", text: "按拍摄日期与设备分文件夹，复制原片后在 Final Cut Pro 新建资源库和项目。先挑好出发、途中和抵达三个段落。" },
          { title: "用较小的代理剪辑", text: "导入时勾选“创建代理媒体”，选择 50% 帧大小。在检视器“显示”菜单切到“首选代理”，用这些副本挑镜头、剪节奏。" },
          { title: "用原始画质导出", text: "接好存放原片的磁盘，切回“优化/原始”再共享为视频文件。另开播放器，看一遍片头与片尾，核对画面和同期声。" },
        ],
        result: "一份可播放的旅行短片，以及之后还能继续调整的剪辑工程。",
        limit: "代理会额外占用磁盘空间，最终导出时仍需能访问对应的原始或优化媒体。",
        sources: [
          { name: "Apple · 创建与使用代理媒体", url: "https://support.apple.com/zh-cn/guide/final-cut-pro/verb8e5f6fd/mac" },
          { name: "Apple · 资源库储存位置", url: "https://support.apple.com/zh-cn/guide/final-cut-pro/ver7db6ffe77/mac" },
        ],
      },
      {
        id: "podcast",
        title: "在书桌录一期单人播客",
        teaser: "把读书笔记讲成五分钟音频，留下可以修改的工程和能发给朋友的成片。",
        kit: "GarageBand（库乐队）、USB 麦克风、耳机",
        steps: [
          { title: "录十秒试听", text: "接入麦克风和耳机，新建空项目，添加“麦克风或线路”音轨，选对输入设备。关闭节拍器，按 R 录一段正常音量的开场。" },
          { title: "分段录完正文", text: "戴耳机听回试录，调整输入音量，避免大声说话时失真。把开场、正文和结尾分段录制，剪掉长停顿与重读部分。" },
          { title: "导出并完整回听", text: "保存工程，选“共享 → 将乐曲导出到磁盘”，格式选 MP3。打开导出文件，听一遍开头、段落衔接和结尾。" },
        ],
        result: "一个适合分发的 MP3 文件和一个可重新剪辑的人声音轨工程。",
        limit: "房间回声与麦克风距离会直接影响声音质量。正式录音前先听一段样音。",
        sources: [
          { name: "Apple · Mac 版库乐队使用手册", url: "https://support.apple.com/zh-cn/guide/garageband/welcome/mac" },
          { name: "Apple · 库乐队导出 MP3", url: "https://support.apple.com/zh-cn/120493" },
        ],
      },
    ],
  },
  {
    id: "dev",
    name: "软件开发",
    en: "Development",
    summary: "一台开发机上可以逐个验证 iPhone 界面，也能独立运行网站和数据库。",
    cases: [
      {
        id: "expense",
        title: "测试一个 iPhone 记账 App",
        teaser: "同一笔午餐支出，在小屏和大屏上能否顺利录入、完整显示？",
        kit: "Xcode、iOS 17 或更新版本的模拟器运行时、iExpense 示例工程",
        steps: [
          { title: "打开可运行的例程", text: "从作者的 Hacking with Swift 仓库下载源码。在 SwiftUI/project7 目录中打开 iExpense.xcodeproj，选择一个已安装的 iPhone 模拟器。" },
          { title: "在小屏记一笔账", text: "点 Xcode 的运行按钮。进入 App 后点加号，填入 Lunch、Personal 和 12.50，保存后核对列表里的金额。停止并再次运行，查看记录是否保留。" },
          { title: "换大屏重复操作", text: "在 Xcode 的运行目标中换一种屏幕尺寸，再录入同样的支出。两台模拟器各自保存数据，截下两张图，比较金额、标签和按钮的位置。" },
        ],
        result: "两种屏幕尺寸下的记账流程截图，以及一条可以重复执行的回归测试。",
        limit: "模拟器能检查交互与布局。相机、真实触感和整机性能仍要在对应真机上验证。",
        sources: [
          { name: "Paul Hudson · iExpense 源码", url: "https://github.com/twostraws/HackingWithSwift/tree/main/SwiftUI/project7" },
          { name: "Apple · 在模拟器和真机运行 App", url: "https://developer.apple.com/documentation/xcode/running-your-app-on-simulated-or-physical-devices" },
        ],
      },
      {
        id: "compose",
        title: "在本机预览 WordPress 网站",
        teaser: "先在 Mac 上给网站换主题、试写文章，随时查看修改后的版式。",
        kit: "Docker Desktop、Docker Compose、浏览器",
        steps: [
          { title: "准备站点和数据库", text: "启动 Docker Desktop。在空文件夹内把 Docker 官方 WordPress 快速入门里的完整配置保存为 compose.yaml，保留站点文件和 MariaDB 的两个命名卷。" },
          { title: "只在本机启动预览", text: "把 wordpress 服务的端口映射 80:80 改为“127.0.0.1:8080:80”（在 YAML 中使用英文引号）。在该目录运行 docker compose up -d，等数据库初始化。" },
          { title: "检验内容能否保留", text: "浏览器打开 http://localhost:8080，完成安装并写一篇测试文章。依次执行 docker compose stop 和 docker compose start，再次打开文章。" },
        ],
        result: "浏览器里有一个独立的预览站，网站和数据库可一起启停。",
        limit: "首次拉取镜像需要联网，8080 端口须可用。带 --volumes 的清理操作会移除保存数据的卷。",
        sources: [
          { name: "Docker · WordPress 与 Compose 快速入门", url: "https://github.com/docker/awesome-compose/tree/master/official-documentation-samples/wordpress" },
          { name: "Docker · Compose 命令说明", url: "https://docs.docker.com/compose/support-and-feedback/faq/" },
        ],
      },
    ],
  },
  {
    id: "ai",
    name: "本地 AI",
    en: "Local AI",
    summary: "下载模型后，让 Mac 在本机处理会议文字和录音。",
    cases: [
      {
        id: "minutes",
        title: "从会议记录里提取待办",
        teaser: "散会后先找出谁答应了什么，再回到原句确认负责人和期限。",
        kit: "macOS 14 或更高版本、Ollama、本地文字记录",
        steps: [
          { title: "下载本地文字模型", text: "安装并打开 Ollama，在终端运行 ollama run qwen3:4b。首次运行会下载约 2.5 GB 的模型文件，完成后出现对话提示符。" },
          { title: "给它一段有歧义的记录", text: "例如输入“周五前小林发报价单。访谈时间还要再定。”，再要求“逐条列出行动、负责人、期限和引用原句。没有提到的字段写待确认”。" },
          { title: "对照原文确认", text: "检查模型是否把报价单归给小林、保留周五这个期限，并把访谈负责人和日期留待确认。再用同样的方法分段处理自己的记录。" },
        ],
        result: "一份附有原句的待办草稿，可以逐项核实后交给相关同事。",
        limit: "2.5 GB 是模型下载大小。推理还占用内存，较长的记录需要分段，并人工核对指代和日期。",
        sources: [
          { name: "Ollama · macOS 要求", url: "https://docs.ollama.com/macos" },
          { name: "Ollama · Qwen3 4B 模型", url: "https://ollama.com/library/qwen3:4b" },
        ],
      },
      {
        id: "subtitles",
        title: "给口述访谈配中文字幕",
        teaser: "把家人的口述录音转成带时间码的字幕，剪片时可以直接对照原声。",
        kit: "MacWhisper、本地多语言转写模型、一段中文 M4A 或 MP4",
        steps: [
          { title: "选用本地模型", text: "打开 MacWhisper，下载支持中文的本地模型。在转写选项中选这个模型，语言设为中文，先用一段清晰的短录音试跑。" },
          { title: "拖入录音并校对", text: "把音频或视频文件拖进窗口。生成文字后按片段回听，先校正人名、地名和数字，再调整影响阅读的断句。" },
          { title: "导出带时间码的字幕", text: "将转写结果导出为 SRT，和原视频放在一起。用支持外部字幕的播放器同时打开，检查开头和结尾的对白是否对齐。" },
        ],
        result: "一份带起止时间码的中文字幕文件，可交给剪辑师或在播放器里加载。",
        limit: "设备离线处理的前提是已下载并选用本地模型。重叠说话和环境噪声会影响识别。",
        sources: [
          { name: "MacWhisper · 本地转写与字幕导出", url: "https://www.macwhisper.com/" },
          { name: "MacWhisper · 格式与模型说明", url: "https://goodsnooze.gumroad.com/l/macwhisper" },
        ],
      },
    ],
  },
  {
    id: "home",
    name: "家庭服务",
    en: "Home Server",
    summary: "把固定在家中的主机接入局域网，让其他电脑和客厅电视都能使用。",
    cases: [
      {
        id: "backup",
        title: "给家里的 MacBook 自动备份",
        teaser: "家人回到同一个 Wi-Fi，就能把笔记本备份到 Mac mini 连接的硬盘。",
        kit: "Mac mini、专用外置备份盘、同一局域网中的 MacBook",
        steps: [
          { title: "共享一个备份目录", text: "把备份盘接到 mini。在“系统设置 → 通用 → 共享”打开“文件共享”，添加盘中的专用文件夹，给备份使用的账户读写权限。" },
          { title: "将它设为备份目的位置", text: "按住 Control 点按该目录，在“高级选项”勾选“共享为时间机器备份目的位置”。回到 MacBook 的“时间机器”设置，添加这块网络备份磁盘。" },
          { title: "亲手恢复一份文件", text: "在 MacBook 建一份测试文档，立即备份并等待完成。把测试文件移到别处，进入时间机器，从刚才的备份中恢复它，再打开核对内容。" },
        ],
        result: "一条可自动执行的网络备份路径，还有一次自己验证过的文件恢复流程。",
        limit: "备份期间主机、外置盘和网络都须可访问。Apple 建议参与网络备份的两台 Mac 均使用 macOS 11 或更高版本。",
        sources: [
          { name: "Apple · 可用的时间机器备份磁盘", url: "https://support.apple.com/zh-cn/102423" },
          { name: "Apple · Mac 文件共享设置", url: "https://support.apple.com/zh-hans/guide/mac-help/mh17131/mac" },
        ],
      },
      {
        id: "cinema",
        title: "在电视点播家庭录像",
        teaser: "把历年的旅行和生日录像放在一处，家人用电视遥控器就能点开。",
        kit: "Jellyfin Server、存放录像的磁盘、支持 Jellyfin 客户端的电视或机顶盒",
        steps: [
          { title: "把年份变成目录", text: "在媒体盘内按年份或活动整理自制录像。在 mini 安装并启动 macOS 版 Jellyfin，打开设置向导，创建管理员账户。" },
          { title: "为家人建立媒体库", text: "在向导里添加媒体库，选择家庭录像对应的内容类型，指向刚整理好的目录。扫描后在网页端打开一段，确认声音和画面正常。" },
          { title: "在客厅试播", text: "让电视客户端与 Mac 连到同一家庭网络，选择发现的服务器或输入 mini 的局域网地址和 Jellyfin 端口。播放一段影片，再拖到片尾试听。" },
        ],
        result: "电视上有一个按活动或年份整理、可以搜索和播放的家庭视频库。",
        limit: "观看时 mini 和媒体盘要在线。能否直接播放取决于客户端对视频、音轨、容器和字幕的支持。",
        sources: [
          { name: "Jellyfin · 配置媒体服务器", url: "https://jellyfin.org/docs/general/quick-start/" },
          { name: "Jellyfin · 客户端格式兼容", url: "https://jellyfin.org/docs/general/clients/codec-support/" },
        ],
      },
    ],
  },
  {
    id: "auto",
    name: "效率自动化",
    en: "Automation",
    summary: "用系统自带工具一次处理整批文件，跳过逐张改图、逐份命名的重复工作。",
    cases: [
      {
        id: "resize",
        title: "一批商品图统一到 1200 像素宽",
        teaser: "上架前给一组横向商品图缩尺寸，同时保留原图交给印刷或设计。",
        kit: "macOS 自带的“预览”、一组宽度大于 1200 像素的横向图片",
        steps: [
          { title: "复制图片到交付文件夹", text: "在访达里建“商品图-网页”，把图片复制进去。选中这些副本，用“预览”在同一窗口打开它们，显示缩略图边栏。" },
          { title: "选中整组缩略图", text: "点边栏中的一个缩略图后按 Command-A，选“工具 → 调整大小”。单位选像素，勾选“比例缩放”和“重新采样图像”，宽度填 1200。" },
          { title: "核对实际像素", text: "确认尺寸并保存。打开交付目录中的几张图，在“预览”的检查器核对宽度，放大观察商品标签上的小字是否仍然可读。" },
        ],
        result: "一个装有统一宽度图片的交付文件夹，每张图仍保持原始宽高比。",
        limit: "固定的是宽度，图片高度随比例变化。小于目标宽度的图先移出，以免被放大。",
        sources: [
          { name: "Apple · 预览批量调整图像尺寸", url: "https://support.apple.com/zh-cn/guide/preview/prvw2015/mac" },
        ],
      },
      {
        id: "rename",
        title: "给活动照片统一编号",
        teaser: "把散乱的相机编号换成活动名和连续序号，排版时可以直接报文件名。",
        kit: "macOS 访达、准备交付的一组照片副本",
        steps: [
          { title: "整理交付顺序", text: "把要交付的照片副本放入同一目录，在访达的列表视图中排好顺序。先用三张图试做，确认编号与预期对应。" },
          { title: "一次设定全部名称", text: "选中照片，按住 Control 点按并选择“重新命名”。在弹出菜单选“格式”，名称格式选名称加索引，索引放在名称之后。" },
          { title: "检查编号再交付", text: "自定义格式填“春日市集-”，起始数字填 1。预览示例后执行，按名称排序核对首尾文件、张数和扩展名。" },
        ],
        result: "交付文件可按“春日市集-1.jpg”这样的统一名称引用和检索。",
        limit: "对交付副本执行批量改名。剪辑工程或图库若通过原文件名查找素材，改动源文件会影响关联。",
        sources: [
          { name: "Apple · 在访达给多个项目重新命名", url: "https://support.apple.com/zh-cn/guide/mac-help/mchlp1144/27/mac/27" },
        ],
      },
    ],
  },
];
