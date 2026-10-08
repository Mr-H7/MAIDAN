export type FridayGateInput = {
  hasSession: boolean;
  sessionStatus: "open" | "locked" | "completed" | null;
  confirmedCount: number;
  teamCount: number;
  publishedTeamCount: number;
  matchCount: number;
};

export type FridayStepId =
  | "session"
  | "confirmations"
  | "lock"
  | "draft"
  | "publish"
  | "fixtures";

export type FridayStep = {
  id: FridayStepId;
  done: boolean;
  current: boolean;
  en: string;
  ar: string;
  actionEn: string;
  actionAr: string;
  href: "/admin" | "/teams" | "/booking";
};

export function fridaySteps(input: FridayGateInput): FridayStep[] {
  const locked = input.sessionStatus === "locked" || input.sessionStatus === "completed";
  const confirmed = input.confirmedCount === 20;
  const drafted = input.teamCount === 4;
  const published = input.publishedTeamCount === 4;
  const scheduled = input.matchCount > 0;
  const stuckLocked =
    input.sessionStatus === "locked" && !confirmed && input.matchCount === 0;
  const flags = [
    input.hasSession,
    confirmed && !stuckLocked,
    locked && confirmed,
    drafted,
    published,
    scheduled,
  ];
  const currentIndex = flags.findIndex((done) => !done);
  const steps: Omit<FridayStep, "done" | "current">[] = [
    {
      id: "session",
      en: "Create this week's Friday session before a roster, teams, or fixtures can exist.",
      ar: "أنشئ جلسة الجمعة لهذا الأسبوع قبل القائمة أو الفرق أو المباريات.",
      actionEn: "Create weekly sessions",
      actionAr: "إنشاء الجلسات الأسبوعية",
      href: "/admin",
    },
    {
      id: "confirmations",
      en: stuckLocked
        ? `The roster is locked with ${input.confirmedCount} confirmed players. Team generation needs exactly 20, and attendance cannot change while the roster stays locked.`
        : `Confirm attendance until exactly 20 players are confirmed. This session has ${input.confirmedCount}.`,
      ar: stuckLocked
        ? `القائمة مغلقة وفيها ${input.confirmedCount} مؤكدين. تكوين الفرق يحتاج ٢٠ بالضبط، ولا يتغير الحضور والقائمة مغلقة.`
        : `أكد الحضور حتى يصل إلى ٢٠ لاعبًا بالضبط. هذه الجلسة فيها ${input.confirmedCount}.`,
      actionEn: stuckLocked ? "Reopen roster" : "Review Friday attendance",
      actionAr: stuckLocked ? "إعادة فتح القائمة" : "مراجعة حضور الجمعة",
      href: "/admin",
    },
    {
      id: "lock",
      en: "Lock the roster only after those 20 confirmations. Locking freezes attendance.",
      ar: "أغلق القائمة بعد تأكيد العشرين. الإغلاق يجمد الحضور.",
      actionEn: "Lock roster",
      actionAr: "إغلاق القائمة",
      href: "/admin",
    },
    {
      id: "draft",
      en: "Generate the 4 × 5 teams and save the draft. Unpublished drafts stay hidden from players.",
      ar: "كوّن فرق ٤ × ٥ واحفظ المسودة. المسودات غير المنشورة مخفية عن اللاعبين.",
      actionEn: "Open team builder",
      actionAr: "فتح تكوين الفرق",
      href: "/teams",
    },
    {
      id: "publish",
      en: "Publish the saved teams. Fixtures can only be created from four published teams.",
      ar: "انشر الفرق المحفوظة. تُجدول المباريات من أربع فرق منشورة فقط.",
      actionEn: "Publish teams",
      actionAr: "نشر الفرق",
      href: "/teams",
    },
    {
      id: "fixtures",
      en: "Generate fixtures from the published teams. The match list stays empty until this step.",
      ar: "جدول المباريات من الفرق المنشورة. يبقى جدول المباريات فارغًا قبل هذه الخطوة.",
      actionEn: "Generate fixtures",
      actionAr: "جدولة المباريات",
      href: "/admin",
    },
  ];
  return steps.map((step, index) => ({
    ...step,
    done: flags[index],
    current: index === currentIndex,
  }));
}

export function currentFridayStep(input: FridayGateInput) {
  return fridaySteps(input).find((step) => step.current) || null;
}

export const matchControlRequirements = {
  en: [
    "You are a group admin.",
    "Four teams are published and fixtures have been generated.",
    "You are assigned as head or assistant referee for that match.",
    "You are not playing on either team in that match.",
    "The match is live. Goals and cards are rejected while it is scheduled, paused, or completed.",
    "A hat-trick green card is added by the server when that group setting is on and a player reaches three goals.",
    "Teammate ratings open only after the match is completed, never for yourself, and only inside the rating window.",
  ],
  ar: [
    "أنت مشرف المجموعة.",
    "نُشرت أربع فرق وجُدولت المباريات.",
    "عُيّنت حكمًا رئيسيًا أو مساعدًا لهذه المباراة.",
    "لست لاعبًا في أحد فريقي هذه المباراة.",
    "المباراة جارية. تُرفض الأهداف والبطاقات وهي مجدولة أو متوقفة أو مكتملة.",
    "يضيف الخادم بطاقة خضراء للهاتريك عندما يكون الإعداد مفعلًا ويصل اللاعب إلى ثلاثة أهداف.",
    "تقييم الزملاء يفتح بعد اكتمال المباراة فقط، ولا يشمل نفسك، وداخل مدة التقييم.",
  ],
};
