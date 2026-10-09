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
];

export function sourceFor(profile: AircraftProfile, id: string) {
  return profile.sources.find((source) => source.id === id);
}
