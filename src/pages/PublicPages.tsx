import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { useApp } from "../context/AppContext";

export function PublicShell({ children }: { children: ReactNode }) {
  const { language, toggleLanguage } = useApp();
  const ar = language === "ar";
  return (
    <div className="public-shell">
      <header className="topbar">
        <div className="topbar-inner">
          <Link to="/" className="brand">
            <img src="/brand/mark.png" alt="MAIDAN" />
            <span>
              MAIDAN <span className="muted">| ميدان</span>
            </span>
          </Link>
          <div className="top-actions">
            <button
              className="group-switch"
              type="button"
              onClick={toggleLanguage}
              aria-label={ar ? "Switch to English" : "التبديل إلى العربية"}
            >
              {ar ? "English" : "العربية"}
            </button>
            <Link className="group-switch" to="/auth">
              {ar ? "تسجيل الدخول" : "Sign in"}
            </Link>
          </div>
        </div>
      </header>
      <main className="content public-main">{children}</main>
      <footer className="public-footer">
        <LegalLinks />
      </footer>
    </div>
  );
}

export function LegalLinks() {
  const { language } = useApp();
  const ar = language === "ar";
  return (
    <nav className="legal-links" aria-label={ar ? "معلومات ميدان" : "MAIDAN information"}>
      <Link to="/">{ar ? "عن ميدان" : "About"}</Link>
      <Link to="/privacy">{ar ? "سياسة الخصوصية" : "Privacy Policy"}</Link>
      <Link to="/terms">{ar ? "شروط الخدمة" : "Terms of Service"}</Link>
    </nav>
  );
}

export function PublicHome() {
  const { language } = useApp();
  const ar = language === "ar";
  return (
    <PublicShell>
      <div className="page-stack">
        <img
          className="auth-logo"
          src="/brand/maidan-logo.png"
          alt="MAIDAN | ميدان"
        />
        <div>
          <span className="eyebrow">MAIDAN | ميدان</span>
          <h1 className="page-title">
            {ar
              ? "ميدان لمجموعتك الكروية"
              : "MAIDAN for your football group"}
          </h1>
          <p className="muted">
            {ar
              ? "ميدان تطبيق خاص لتنظيم مجموعة واحدة: حضور كرة الجمعة، مقرأة الثلاثاء، تكوين الفرق، ونتائج المباراة. ليس دوريًا عامًا ولا يسجّل الزائر نفسه في مجموعة دون دعوة."
              : "MAIDAN is a private app for one community group: Friday football attendance, the Tuesday Maqraa, team selection, and match results. It is not a public league, and a visitor does not join a group without an invitation."}
          </p>
        </div>
        <div className="grid-two">
          <article className="card">
            <h2 className="section-title">
              {ar ? "ماذا يفعل ميدان" : "What MAIDAN does"}
            </h2>
            <ul className="gate-list">
              <li>
                {ar
                  ? "يسجّل الأعضاء حضور الجمعة أو اعتذارهم."
                  : "Members confirm or decline Friday attendance."}
              </li>
              <li>
                {ar
                  ? "يساعد المشرف على إغلاق القائمة وتكوين الفرق بعد اكتمال العدد."
                  : "An admin locks the roster and builds teams after the required number is confirmed."}
              </li>
              <li>
                {ar
                  ? "يسجّل الحكم الأهداف والبطاقات أثناء المباراة."
                  : "An assigned referee records goals and cards during a match."}
              </li>
            </ul>
          </article>
          <article className="card">
            <h2 className="section-title">
              {ar ? "كيف تدخل" : "How you enter"}
            </h2>
            <p>
              {ar
                ? "أنشئ حسابًا بالبريد أو بـ Google، ثم استخدم رمز الدعوة الذي يرسله مشرف مجموعتك. الدعوة تضيفك لاعبًا ولا تمنحك صلاحية مشرف."
                : "Create an account with email or Google, then use the invite code from your group admin. An invitation adds you as a player and does not make you an admin."}
            </p>
            <Link to="/auth">
              <span className="pill blue">
                {ar ? "الدخول إلى ميدان" : "Enter MAIDAN"}
              </span>
            </Link>
          </article>
        </div>
      </div>
    </PublicShell>
  );
}

export function PrivacyPage() {
  const { language } = useApp();
  const ar = language === "ar";
  return (
    <PublicShell>
      <article className="page-stack legal">
        <div>
          <span className="eyebrow">{ar ? "الخصوصية" : "Privacy"}</span>
          <h1 className="page-title">
            {ar ? "سياسة الخصوصية" : "Privacy Policy"}
          </h1>
          <p className="muted">
            {ar
              ? "تسري هذه السياسة على تطبيق ميدان المنشور على https://maidan-cyan.vercel.app. آخر تحديث: ٨ أكتوبر ٢٠٢٦."
              : "This policy applies to the MAIDAN application published at https://maidan-cyan.vercel.app. Last updated 8 October 2026."}
          </p>
        </div>
        <section>
          <h2>{ar ? "ما الذي نجمعه" : "What we collect"}</h2>
          <p>
            {ar
              ? "عند إنشاء حساب بالبريد، نحفظ اسمك وبريدك، وتُدار كلمة المرور داخل Supabase Auth ولا يراها تطبيق ميدان. إذا اخترت Google، يستلم ميدان الاسم والبريد اللذين تشاركهما شاشة موافقة Google. لا نستلم كلمة مرور Google، ولا يُوضع سر عميل Google في التطبيق."
              : "If you create an email account, we store your name and email. Your password is handled by Supabase Auth and is not read by the MAIDAN application. If you choose Google, MAIDAN receives the name and email you share on Google's consent screen. We do not receive your Google password, and the Google client secret is not placed in the application."}
          </p>
          <p>
            {ar
              ? "بعد الانضمام إلى مجموعة قد نحفظ مركزك المفضل، تقييمك لنفسك، حالة الحضور، الفريق، وأحداث المباراة مثل الأهداف والبطاقات، وتقييمات الزملاء، ودورك في المجموعة."
              : "After you join a group we may store your preferred position, self rating, attendance status, team, match events such as goals and cards, teammate ratings, and your role in the group."}
          </p>
        </section>
        <section>
          <h2>{ar ? "لماذا نستخدمه" : "Why we use it"}</h2>
          <p>
            {ar
              ? "لتشغيل مجموعة ميدان فقط: الدخول، الدعوة، الحضور، الفرق، والمباراة. لا نبيع هذه البيانات ولا نستخدمها للإعلان."
              : "To operate the MAIDAN group only: sign-in, invitations, attendance, teams, and matches. We do not sell this data and we do not use it for advertising."}
          </p>
        </section>
        <section>
          <h2>{ar ? "من يراه" : "Who can see it"}</h2>
          <p>
            {ar
              ? "أعضاء مجموعتك يرون ما تعرضه شاشات المجموعة، مثل الأسماء في القائمة والأحداث المنشورة. المشرف يرى أدوات الحضور والدعوة. مجموعات أخرى لا ترى بيانات مجموعتك."
              : "Members of your group see what the group screens show, such as names on a roster and published match events. An admin sees the attendance and invitation tools. Other groups cannot see your group's data."}
          </p>
        </section>
        <section>
          <h2>{ar ? "أين يُحفظ ومدة بقائه" : "Where it is kept"}</h2>
          <p>
            {ar
              ? "تُحفظ الحسابات وبيانات المجموعة لدى Supabase طوال وجود الحساب والعضوية. حذف الحساب أو إزالتك من المجموعة يوقف وصولك. بعض سجلات المباراة قد تبقى لدى المجموعة لأنها سجل مشترك."
              : "Accounts and group data are stored by Supabase for as long as the account and membership exist. Deleting an account or removing you from the group stops your access. Some match records may remain with the group because they are a shared record."}
          </p>
        </section>
        <section>
          <h2>{ar ? "التواصل" : "Contact"}</h2>
          <p>
            {ar
              ? "لسؤال عن حسابك داخل مجموعة، راسل مشرف تلك المجموعة. لا يملك هذا التطبيق عنوان بريد خصوصية منفصلًا بعد."
              : "For a question about your account inside a group, contact that group's admin. This application does not yet have a separate privacy email address."}
          </p>
        </section>
      </article>
    </PublicShell>
  );
}

export function TermsPage() {
  const { language } = useApp();
  const ar = language === "ar";
  return (
    <PublicShell>
      <article className="page-stack legal">
        <div>
          <span className="eyebrow">{ar ? "الشروط" : "Terms"}</span>
          <h1 className="page-title">
            {ar ? "شروط الخدمة" : "Terms of Service"}
          </h1>
          <p className="muted">
            {ar
              ? "باستخدام https://maidan-cyan.vercel.app فإنك توافق على هذه الشروط. آخر تحديث: ٨ أكتوبر ٢٠٢٦."
              : "By using https://maidan-cyan.vercel.app you agree to these terms. Last updated 8 October 2026."}
          </p>
        </div>
        <section>
          <h2>{ar ? "الخدمة" : "The service"}</h2>
          <p>
            {ar
              ? "ميدان أداة خاصة لمجموعة كروية ومجتمعية. الدخول بحساب Google أو بالبريد ينشئ حساب ميدان خاصًا بك. لا يضعك ذلك وحده في مجموعة، ولا يغيّر صلاحية حساب موجود."
              : "MAIDAN is a private tool for a football and community group. Signing in with Google or email creates your own MAIDAN account. That alone does not place you in a group and does not change the role of an existing account."}
          </p>
        </section>
        <section>
          <h2>{ar ? "العضوية" : "Membership"}</h2>
          <p>
            {ar
              ? "الانضمام يتم بدعوة المشرف أو بإضافته لبريدك. رمز الدعوة يمنحك دور لاعب فقط. إذا كنت عضوًا من قبل، تبقى صلاحيتك كما هي."
              : "You join when an admin invites you or adds your email. An invite code grants the player role only. If you were already a member, your existing role stays as it is."}
          </p>
        </section>
        <section>
          <h2>{ar ? "استخدامك" : "Your use"}</h2>
          <p>
            {ar
              ? "استخدم حسابك أنت فقط. لا تسجّل حضورًا أو أحداث مباراة نيابة عن شخص آخر إلا إذا كانت صلاحية المشرف أو الحكم المخصصة لذلك تسمح بهذا داخل التطبيق."
              : "Use only your own account. Do not record attendance or match events for someone else unless the admin or referee permission in the app is specifically for that action."}
          </p>
        </section>
        <section>
          <h2>{ar ? "التوفر" : "Availability"}</h2>
          <p>
            {ar
              ? "قد يتوقف التسجيل مؤقتًا إذا وصل إرسال البريد إلى حده، أو إذا كان دخول Google في وضع الاختبار لدى Google. استمرار الخدمة غير مضمون، ويمكن أن تتغير الشاشات."
              : "Registration may pause if email sending reaches its limit, or while Google sign-in remains in Google's testing mode. Continued availability is not guaranteed, and the screens may change."}
          </p>
        </section>
      </article>
    </PublicShell>
  );
}
