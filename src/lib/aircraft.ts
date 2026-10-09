export type AircraftDomain = '民用' | '军用' | '实验';
export type Evidence = '试飞实测' | '官方公布' | '厂家指标' | '研制目标' | '未公开';
export type AircraftSource = {
  id: string;
  name: string;
  title: string;
  url: string;
  published?: string;
};
export type AircraftProfile = {
  id: string;
  name: string;
  subtitle: string;
  domain: AircraftDomain;
  maker: string;
  stage: string;
  checkedAt: string;
  aliases?: string[];
  summary: string;
  latest: { title: string; date: string; eventDate: string; summary: string; source: string };
  specs: { label: string; value: string; evidence: Evidence; note: string; source: string }[];
  design: { title: string; text: string; source: string }[];
  questions: string[];
  timeline: { date: string; title: string; text: string; source: string }[];
  sources: AircraftSource[];
};

// Editorial snapshots of verified public sources. These are not live ingestion records.
export const aircraftProfiles: AircraftProfile[] = [
  {
    id: 'x-59',
    name: 'X-59',
    subtitle: '把超声速飞行的声音，变轻一点。',
    domain: '实验',
    maker: 'NASA / Lockheed Martin',
    stage: '飞行包线扩展',
    checkedAt: '2026-10-08',
    summary:
      'Quesst 项目的低声爆研究飞机。通过公开的试飞记录，追踪设计目标怎样一步步走向飞行验证。',
    latest: {
      title: '一周六次试飞，达到 Mach 1.53',
      date: '2026-10-02',
      eventDate: '2026-09-22 至 2026-09-25',
      summary:
        'NASA 报告这一周完成六次飞行，累计试飞达到 38 次，期间达到 Mach 1.53。随后进入计划维护。',
      source: 'nasa-week',
    },
    specs: [
      {
        label: '本次公布的最高速度',
        value: 'Mach 1.53',
        evidence: '试飞实测',
        note: '2026 年 9 月该周试飞达到的速度，不代表认证极限。',
        source: 'nasa-week',
      },
      {
        label: '典型任务巡航速度',
        value: 'Mach 1.4',
        evidence: '官方公布',
        note: 'NASA 描述的任务巡航条件，与上面的试飞纪录分开看。',
        source: 'nasa-week',
      },
      {
        label: '累计试飞',
        value: '38 次',
        evidence: '官方公布',
        note: '截至该篇 10 月 2 日报道的累计数量。',
        source: 'nasa-week',
      },
      {
        label: '社区低声爆效果',
        value: '待后续验证',
        evidence: '官方公布',
        note: 'Quesst 还将通过社区飞越研究公众对声音的反应。',
        source: 'nasa-week',
      },
    ],
    design: [
      {
        title: '先建立飞行包线，再验证任务效果',
        text: '飞行包线扩展是在不同速度、高度和机动条件下检查飞机表现。达到一个速度纪录，与完成社区声学研究，是不同的验证环节。',
        source: 'nasa-week',
      },
      {
        title: '低声爆是研究目标',
        text: 'Quesst 将研究人们对较轻声响的反应，并把数据提供给监管机构。档案会继续分别追踪飞行能力验证和声音效果验证。',
        source: 'nasa-week',
      },
    ],
    questions: [
      '为什么一次速度纪录不能代表整个飞行包线已经验证？',
      '在模拟里改变机鼻和机身的形状，可以观察哪些变化？',
    ],
    timeline: [
      {
        date: '2026-09-22 至 09-25',
        title: '一周六次试飞',
        text: '达到新的试飞速度纪录；官方报道发表于 10 月 2 日。',
        source: 'nasa-week',
      },
      {
        date: '2026-06-05',
        title: '首次超声速飞行',
        text: 'NASA 公布 X-59 首次超过音速，约达到 Mach 1.1。',
        source: 'nasa-supersonic',
      },
    ],
    sources: [
      {
        id: 'nasa-week',
        name: 'NASA',
        title: 'X-59 Completes Record Six Flights in One Week',
        published: '2026-10-02',
        url: 'https://www.nasa.gov/blogs/quesst/2026/10/02/nasas-x-59-completes-record-six-flights-in-one-week/',
      },
      {
        id: 'nasa-supersonic',
        name: 'NASA',
        title: 'X-59 Aircraft Flies Supersonic for First Time',
        published: '2026-06-05',
        url: 'https://www.nasa.gov/aeronautics/x-59-first-supersonic-flight/',
      },
    ],
  },
  {
    id: 'a350f',
    name: 'A350F',
    subtitle: '一架新货机，如何重新安排空间与重量？',
    domain: '民用',
    maker: 'Airbus',
    stage: '首飞后试飞',
    checkedAt: '2026-10-08',
    summary:
      '基于 A350 平台的新型货机。把机体尺寸、货舱设计和试飞进展放在一起，理解一款货机的工程取舍。',
    latest: {
      title: '完成首飞，进入试飞阶段',
      date: '2026-09-29',
      eventDate: '2026-09-29',
      summary:
        'Airbus 公布首架 A350F 试验机 MSN 700 完成首飞，用时 4 小时 10 分钟，达到 25,000 英尺。',
      source: 'airbus-first',
    },
    specs: [
      {
        label: '机身长度',
        value: '70.80 m',
        evidence: '厂家指标',
        note: 'Airbus 产品页公布的几何尺寸。',
        source: 'airbus-product',
      },
      {
        label: '翼展',
        value: '64.75 m',
        evidence: '厂家指标',
        note: '几何翼展。',
        source: 'airbus-product',
      },
      {
        label: '机高',
        value: '17.08 m',
        evidence: '厂家指标',
        note: '产品页公布的机高。',
        source: 'airbus-product',
      },
      {
        label: '载荷能力',
        value: '111 t',
        evidence: '厂家指标',
        note: '厂家公布能力，不是这次首飞的实际载荷。',
        source: 'airbus-product',
      },
      {
        label: '发动机',
        value: 'Trent XWB-97',
        evidence: '官方公布',
        note: 'Airbus 首飞公告列出的发动机型号。',
        source: 'airbus-first',
      },
      {
        label: '主货舱门宽度',
        value: '4.3 m',
        evidence: '厂家指标',
        note: 'Airbus 项目页公布，门体使用碳纤维复合材料。',
        source: 'airbus-journey',
      },
    ],
    design: [
      {
        title: '客机平台，货运设计',
        text: 'A350F 延续 A350 平台，同时针对货运设置主货舱门和货舱系统。研究时可以关注货物装卸、机体开口与结构之间的关系。',
        source: 'airbus-product',
      },
      {
        title: '从首飞走向完整试飞',
        text: '首飞主要检查基本适航、飞行品质与系统表现。Airbus 表示随后展开超过九个月的试飞计划；这仍是计划，不是已经完成的认证。',
        source: 'airbus-first',
      },
    ],
    questions: [
      '机身上开一个更大的货舱门，为什么会带来结构设计问题？',
      '载荷、航程和机体重量为什么需要一起比较？',
    ],
    timeline: [
      {
        date: '2026-09-29',
        title: '首架试验机完成首飞',
        text: 'MSN 700 首飞；后续试飞与认证结果另行追踪。',
        source: 'airbus-first',
      },
    ],
    sources: [
      {
        id: 'airbus-first',
        name: 'Airbus',
        title: 'A350F freighter successfully performs its maiden flight',
        published: '2026-09-29',
        url: 'https://www.airbus.com/en/newsroom/press-releases/2026-09-airbus-a350f-freighter-successfully-performs-its-maiden-flight',
      },
      {
        id: 'airbus-product',
        name: 'Airbus',
        title: 'A350F product specifications',
        url: 'https://www.aircraft.airbus.com/en/aircraft/freighters/a350f',
      },
      {
        id: 'airbus-journey',
        name: 'Airbus',
        title: 'A350F journey',
        url: 'https://www.airbus.com/en/products-services/commercial-aircraft/freighter/a350f-freighter-journey',
      },
    ],
  },
  {
    id: 'fa-xx',
    name: 'F/A-XX',
    subtitle: '新一代舰载机，先从公开的信息读起。',
    domain: '军用',
    maker: 'Boeing',
    stage: '研制项目',
    checkedAt: '2026-10-08',
    summary:
      '美国海军下一代舰载战斗机项目。当前公开资料能够说明项目定位；具体性能与最终构型仍需后续公开信息。',
    latest: {
      title: 'Boeing 公布获选承担 F/A-XX 项目',
      date: '2026-09-29',
      eventDate: '2026-09-29',
      summary: 'Boeing 官方公告称获选设计、制造并交付 F/A-XX，用于接替 F/A-18 Super Hornet。',
      source: 'boeing-announcement',
    },
    specs: [
      {
        label: '项目定位',
        value: '下一代舰载战斗机',
        evidence: '官方公布',
        note: '公告称其为第六代平台；这不是可直接比较性能的统一技术指标。',
        source: 'boeing-announcement',
      },
      {
        label: '长度 / 翼展',
        value: '未公开',
        evidence: '未公开',
        note: '本次官方公告没有提供。',
        source: 'boeing-announcement',
      },
      {
        label: '发动机 / 推力',
        value: '未公开',
        evidence: '未公开',
        note: '本次官方公告没有提供。',
        source: 'boeing-announcement',
      },
      {
        label: '速度 / 航程',
        value: '未公开',
        evidence: '未公开',
        note: '本次官方公告没有提供。',
        source: 'boeing-announcement',
      },
      {
        label: '最终外形',
        value: '尚不能确认',
        evidence: '未公开',
        note: '公告配图标为艺术渲染图，不能当作最终生产构型。',
        source: 'boeing-announcement',
      },
    ],
    design: [
      {
        title: '把项目定位和工程参数分开',
        text: '公告明确了下一代舰载平台的定位，并提到开放任务系统架构。具体技术与项目细节仍受保密限制。',
        source: 'boeing-announcement',
      },
      {
        title: '一张概念图能说明多少？',
        text: '官方把配图标为艺术渲染图。它可以帮助认识项目，但不足以确定实际气动布局、结构尺寸或性能。',
        source: 'boeing-announcement',
      },
    ],
    questions: [
      '舰载机设计为什么要考虑低速飞行、起降载荷与机上空间？',
      '面对概念图，可以怎样区分视觉观察与有证据的技术结论？',
    ],
    timeline: [
      {
        date: '2026-09-29',
        title: '项目获选公告',
        text: 'Boeing 发布合同消息；本篇没有公布首飞或服役日期。',
        source: 'boeing-announcement',
      },
    ],
    sources: [
      {
        id: 'boeing-announcement',
        name: 'Boeing',
        title: 'U.S. Navy Selects Boeing for F/A-XX Program',
        published: '2026-09-29',
        url: 'https://investors.boeing.com/investors/news/press-release-details/2026/U-S--Navy-Selects-Boeing-for-FA-XX-Program/default.aspx',
      },
    ],
  },
  {
    id: 'b-21',
    name: 'B-21 Raider',
    subtitle: '从试飞到生产，追踪一架新飞机的成长。',
    domain: '军用',
    maker: 'Northrop Grumman',
    stage: '试飞 / 低速初始生产',
    checkedAt: '2026-10-09',
    aliases: ['B-21', 'B21'],
    summary:
      'B-21 是正在试飞的隐身轰炸机。这个档案沿着公开的工程节点追踪它：设计审查、测试机加入、机组配置与总装线扩建；参数只记录可核对的官方信息。',
    latest: {
      title: '新总装线动工，扩大生产能力',
      date: '2026-10-08',
      eventDate: '2026-09-29',
      summary:
        '美国空军公告披露，Plant 42 的新总装线于 9 月 29 日动工。扩产协议提出年产能增加 25%；公告同时确认飞机仍在试飞，并预计 2027 年在 Ellsworth 基地接收飞机。',
      source: 'usaf-production',
    },
    specs: [
      {
        label: '机型定位',
        value: '隐身轰炸机',
        evidence: '官方公布',
        note: '官方事实表描述的项目定位；具体性能仍需以公开测试结果为准。',
        source: 'usaf-facts',
      },
      {
        label: '机组配置',
        value: '2 名飞行员',
        evidence: '官方公布',
        note: '2026 年 7 月 9 日公布的配置，不从座舱照片推测人数。',
        source: 'usaf-crew',
      },
      {
        label: '第二架测试机',
        value: '2025.09.11 抵达 Edwards',
        evidence: '官方公布',
        note: '这是有来源的试飞节点，不代表截至今天的全部测试机数量。',
        source: 'usaf-second',
      },
      {
        label: '生产状态',
        value: '低速初始生产',
        evidence: '官方公布',
        note: '2025 年 9 月公告确认试飞、地面测试与低速初始生产同时推进。',
        source: 'usaf-second',
      },
      {
        label: '年产能提升',
        value: '+25%（扩产计划）',
        evidence: '研制目标',
        note: '这是扩产协议的产能目标，不是已完成交付的增长率；公告没有给出每年架数基线。',
        source: 'usaf-production',
      },
      {
        label: '首个接收基地 / 时间',
        value: 'Ellsworth / 预计 2027 年',
        evidence: '研制目标',
        note: '采用 2026 年 10 月公告的最新计划；飞机抵达基地不等同于已形成作战能力。',
        source: 'usaf-production',
      },
      {
        label: '尺寸与重量',
        value: '所核对资料未公开',
        evidence: '未公开',
        note: '本档案引用的官方事实表未列出翼展、机长或重量，不使用图片比例推算值填充。',
        source: 'usaf-facts',
      },
      {
        label: '速度、航程与发动机参数',
        value: '所核对资料未公开',
        evidence: '未公开',
        note: '引用的官方事实表没有这些定量指标，不能将设计定位当成实测性能。',
        source: 'usaf-facts',
      },
    ],
    design: [
      {
        title: '开放系统架构：给未来升级留出接口',
        text: '官方事实表将降低集成风险、支持后续现代化列为开放系统架构的设计目的。可以研究模块与接口怎样影响升级成本，但公开资料不足以确认内部实现细节。',
        source: 'usaf-facts',
      },
      {
        title: '多机测试也在检验维护体系',
        text: '第二架测试机的加入让维护人员能够同时处理多架飞机，验证工具、技术资料与保障流程。试飞项目除了验证飞行表现，也需要验证一架飞机怎样被持续维护。',
        source: 'usaf-second',
      },
      {
        title: '机组数量也是系统设计的结果',
        text: '官方在分析飞机能力之后确定两名飞行员的配置。由此可以讨论任务时长、工作负荷与自动化的关系；公告没有披露具体人机界面，不能据此推断自动化水平。',
        source: 'usaf-crew',
      },
      {
        title: '工厂扩建与飞机验证是两条进度线',
        text: '新总装线的建设服务于产能扩张，而飞机仍在试飞。持续跟踪时，应分别记录设施进度、生产能力和实际交付，避免把一项计划当成另一项成果。',
        source: 'usaf-production',
      },
    ],
    questions: [
      '试飞、地面测试和低速初始生产为什么可能同时进行？',
      '开放系统架构怎样帮助一架飞机在长期使用中升级？',
      '在只有公开照片和概述的情况下，哪些设计判断有证据，哪些只能作为问题？',
      '产能增长、交付增长与飞机抵达基地，分别需要什么证据才能确认？',
    ],
    timeline: [
      {
        date: '2015-10-27',
        title: '工程与制造研制合同授予',
        text: '美国空军将 B-21 工程与制造研制合同授予 Northrop Grumman。',
        source: 'usaf-facts',
      },
      {
        date: '2018',
        title: '完成关键设计审查',
        text: '官方事实表记录了针对设计成熟度、稳定性与风险的项目级审查；没有列出具体日期。',
        source: 'usaf-facts',
      },
      {
        date: '2025-09-11',
        title: '第二架试飞飞机加入',
        text: '第二架测试机抵达 Edwards，扩展测试和维护训练能力。',
        source: 'usaf-second',
      },
      {
        date: '2026-07-09',
        title: '公布双飞行员配置',
        text: '美国空军发布正式机组配置，并介绍相关飞行员转训安排。',
        source: 'usaf-crew',
      },
      {
        date: '2026-09-29',
        title: '新总装线动工',
        text: 'Plant 42 扩建动工；消息于 10 月 8 日发布。事件日和报道日分开记录。',
        source: 'usaf-production',
      },
      {
        date: '2027（计划）',
        title: '预计在 Ellsworth 接收飞机',
        text: '这是 2026 年 10 月公告的预期节点，需继续核对实际抵达进展。',
        source: 'usaf-production',
      },
    ],
    sources: [
      {
        id: 'usaf-production',
        name: '美国空军',
        title: 'DAF, Northrop Grumman break ground on B-21 production facility',
        published: '2026-10-08',
        url: 'https://www.af.mil/News/Article-Display/Article/4621692/daf-northrop-grumman-break-ground-on-b-21-production-facility/',
      },
      {
        id: 'usaf-crew',
        name: '美国空军',
        title: 'Air Force announces B-21 Raider crew complement',
        published: '2026-07-09',
        url: 'https://www.afrc.af.mil/News/Article/4538932/air-force-announces-b-21-raider-crew-complement/',
      },
      {
        id: 'usaf-second',
        name: '美国空军',
        title: 'US Air Force announces arrival of second B-21 test aircraft at Edwards AFB',
        published: '2025-09-11',
        url: 'https://www.af.mil/News/Article-Display/Article/4301502/us-air-force-announces-arrival-of-second-b-21-test-aircraft-at-edwards-afb/',
      },
      {
        id: 'usaf-facts',
        name: '美国空军事实表',
        title: 'B-21 Raider',
        url: 'https://www.af.mil/About-Us/Fact-Sheets/Display/Article/2682973/b-21-raider/',
      },
    ],
  },
  {
    id: 'joby-evtol',
    name: 'Joby eVTOL',
    subtitle: '垂直起飞，再让机翼接过升力。',
    domain: '民用',
    maker: 'Joby Aviation',
    stage: '认证试飞 / 空域融合演示',
    checkedAt: '2026-10-09',
    aliases: ['Joby electric air taxi', 'JAS4-1', 'Joby S4'],
    summary:
      'Joby 的纯电垂直起降飞行器使用倾转螺旋桨，在垂直飞行与机翼承载巡航之间转换。沿着认证试飞、城市演示与推进系统设计，研究一种不同于传统飞机的飞行方式。',
    latest: {
      title: '在得州开展真实航线与空域融合演示',
      date: '2026-09-10',
      eventDate: '2026-09-10 起（公告安排）',
      summary:
        'Joby 宣布在 Dallas–Fort Worth 地区开展 eIPP 飞行活动，安排包含机场与城市节点的航线。公告仍将飞机描述为处于 FAA 型号认证阶段；演示活动不代表已取得型号合格证或所有计划航线已飞完。',
      source: 'joby-texas',
    },
    specs: [
      {
        label: '飞行器类型',
        value: '纯电垂直起降 / powered-lift',
        evidence: '厂家指标',
        note: '采用厂家技术页的类型说明；这是有人驾驶的电动空中出租车设计。',
        source: 'joby-technology',
      },
      {
        label: '座位配置',
        value: '1 名飞行员 + 4 名乘客',
        evidence: '厂家指标',
        note: '技术页公布的配置，不代表认证过程已经完成。',
        source: 'joby-technology',
      },
      {
        label: '推进系统',
        value: '6 组倾转电动螺旋桨',
        evidence: '厂家指标',
        note: '每组 5 片桨叶；这是厂家公开的构型说明。',
        source: 'joby-technology',
      },
      {
        label: '供能与飞控',
        value: '4 组电池 / 三重冗余飞控计算机',
        evidence: '厂家指标',
        note: '厂家描述的架构；配置数量本身不能证明任何故障情况下都安全。',
        source: 'joby-technology',
      },
      {
        label: '公布速度指标',
        value: '最高 200 mph（约 322 km/h）',
        evidence: '厂家指标',
        note: '技术页标为 up to；换算按 1 mile = 1.609344 km，不作为本次试飞实测速度。',
        source: 'joby-technology',
      },
      {
        label: '巡航声音指标',
        value: '45 dBA / 距离 500 m',
        evidence: '厂家指标',
        note: '技术页给出的巡航声音与测量距离；不能套用到起降阶段或不同距离。',
        source: 'joby-technology',
      },
      {
        label: '认证测试飞机',
        value: 'N547JX / 2026.03 开始飞行测试',
        evidence: '厂家指标',
        note: '3 月 11 日公告称首架 FAA-conforming 飞机开始由 Joby 飞行员测试；不能据此称 FAA 已批准商用。',
        source: 'joby-conforming',
      },
    ],
    design: [
      {
        title: '同一组螺旋桨，两种飞行任务',
        text: '厂家技术页展示螺旋桨从垂直方向转向水平方向：起降时提供向上的推力，巡航时推动机翼承载飞行。值得研究的是转换过程中的升力分配与控制，而不只是能否垂直起飞。',
        source: 'joby-technology',
      },
      {
        title: '声音指标需要带着条件读',
        text: '技术页分别给出巡航与着陆的声音、测量距离。噪声会随飞行阶段和观察位置变化；单个 dBA 数字无法完整描述居民实际听到的声音。',
        source: 'joby-technology',
      },
      {
        title: '符合设计的测试机，和拿到认证有多远？',
        text: '3 月公告说明 N547JX 按获批设计与测试计划制造，并先由公司飞行员测试；当时 FAA 飞行员的 TIA 测试仍是后续安排。要把制造符合性、飞行验证与最终型号认证分开追踪。',
        source: 'joby-conforming',
      },
      {
        title: '飞起来以后，还要接入空域',
        text: '得州公告把机场、城市节点与空域融合列为演示重点。飞行器性能之外，航线、起降点和空域运行也需要验证；新闻中的活动安排不能自动变成完成记录。',
        source: 'joby-texas',
      },
    ],
    questions: [
      '从悬停过渡到机翼承载飞行，升力与控制任务怎样变化？',
      '比较不同飞行器的声音时，为什么要对齐距离、飞行阶段和测量方法？',
      '分布式电推进的多组电机与电池，怎样形成需要验证的故障场景？',
      '厂家试飞、FAA 认证测试和城市演示，分别回答什么问题？',
    ],
    timeline: [
      {
        date: '2024-03-08',
        title: 'JAS4-1 专门适航标准发布',
        text: 'FAA 发布该型号的专门适航标准。这确定认证所用要求，并不等同已经颁发型号合格证。',
        source: 'faa-criteria',
      },
      {
        date: '2026-03-11（公告）',
        title: '首架 FAA-conforming 飞机开始测试',
        text: 'Joby 公布 N547JX 开始飞行测试，进入飞机层面的认证验证工作。公告未单独列出精确首飞时刻。',
        source: 'joby-conforming',
      },
      {
        date: '2026-09-10',
        title: '得州 eIPP 演示开始',
        text: '厂家宣布启动 Dallas–Fort Worth 飞行活动；9 月 10–14 日的航线安排仍受天气等条件影响。',
        source: 'joby-texas',
      },
    ],
    sources: [
      {
        id: 'joby-texas',
        name: 'Joby Aviation',
        title: 'Joby Launches eIPP Flights in Texas',
        published: '2026-09-10',
        url: 'https://ir.jobyaviation.com/news-events/press-releases/detail/191/joby-launches-eipp-flights-in-texas',
      },
      {
        id: 'joby-conforming',
        name: 'Joby Aviation',
        title: 'Joby’s First FAA-Conforming Aircraft Takes Flight',
        published: '2026-03-11',
        url: 'https://www.jobyaviation.com/news/joby-s-first-faa-conforming-aircraft-takes-flight',
      },
      {
        id: 'joby-technology',
        name: 'Joby 技术页',
        title: 'Technology / Joby Aircraft Specifications',
        url: 'https://www.jobyaviation.com/technology',
      },
      {
        id: 'faa-criteria',
        name: 'FAA / Federal Register',
        title: 'Special Class Airworthiness Criteria for the Joby Model JAS4-1 Powered-Lift',
        published: '2024-03-08',
        url: 'https://www.federalregister.gov/documents/2024/03/08/2024-04690/airworthiness-criteria-special-class-airworthiness-criteria-for-the-joby-aero-inc-model-jas4-1',
      },
    ],
  },
];

export function sourceFor(profile: AircraftProfile, id: string) {
  return profile.sources.find((source) => source.id === id);
}
