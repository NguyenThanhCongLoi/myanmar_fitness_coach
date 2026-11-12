'use client';
import { useEffect, useState } from 'react';
import { AlertTriangle, BarChart3, Download, Lightbulb } from 'lucide-react';

// Internal owner dashboard (Vietnamese default, English optional). Server restricts data to ADMIN_EMAILS.
// Improvement-oriented: do users like the app, where they spend time, what they use, skip or struggle with.
type Count = { exercise: string; count: number; users: number };
type Insights = {
  days: number; from: string; to: string; retentionDays: number;
  totals: { users: number; newUsers: number; activeToday: number; active7: number; active30: number; workouts: number; events: number };
  series: { day: string; activeUsers: number; events: number; signups: number; workouts: number }[];
  features: { name: string; count: number; users: number }[];
  funnel: { step: string; users: number }[];
  retention: { day: number; eligible: number; returned: number; rate: number | null }[];
  devices: { mobile: number; desktop: number }; locales: Record<string, number>;
  engagement: { mau: number; avgDau: number; stickiness: number | null; activeDaysPerUser: number; opensPerUser: number; minutesPerActiveDay: number | null };
  satisfaction: { responses: number; average: number | null; distribution: number[]; favorites: Record<string, number> };
  screens: { screen: string; minutes: number; share: number | null; avgVisitSec: number; users: number }[];
  workouts: { started: number; completed: number; completionRate: number | null; avgMinutes: number | null; perActiveUserWeek: number; modes: Record<string, number>; difficulty: Record<string, number>;
    painReports: number; feedbackCount: number; medianHoursToFirst: number | null; topExercises: Count[]; skipped: Count[]; replaced: Count[] };
  adoption: { name: string; users: number; share: number | null }[];
  cohorts: { week: string; size: number; weeks: (number | null)[] }[];
  habits: { achievements: Record<string, number>; notificationsSent: number; notificationsRead: number };
  growth: { day: string; users: number }[];
  people: { email: string; joined: string; lastActive: string | null; activeDays: number; workouts: number; rating: number | null; language: string | null; device: string | null }[];
};
type Lang = 'vi' | 'en';
const T = {
  vi: {
    title: 'Thống kê sử dụng', intro: 'Chỉ số để hiểu người dùng và cải thiện app. Không có nội dung riêng tư (tin nhắn, bữa ăn, ghi chú, ảnh). Dữ liệu giữ {n} ngày; người dùng có thể tắt thống kê trong Hồ sơ.',
    days: '{n} ngày', csv: 'Xuất CSV', loading: 'Đang tải…', signIn: 'Hãy đăng nhập Mingalar Fit trước, rồi mở lại /admin.', denied: 'Tài khoản này không có quyền xem trang quản trị.', failed: 'Không tải được dữ liệu ({s}).',
    attention: 'Điểm cần chú ý', allGood: 'Chưa có điểm bất thường. Cần thêm dữ liệu để kết luận chắc chắn.',
    overview: 'Tổng quan', totalUsers: 'Tổng người dùng', newUsers: 'Người dùng mới ({n} ngày)', activeToday: 'Hoạt động hôm nay', active7: 'Hoạt động 7 ngày', active30: 'Hoạt động 30 ngày (MAU)',
    stickiness: 'Độ gắn bó (DAU/MAU)', stickinessHint: 'Tỉ lệ người dùng của tháng quay lại mỗi ngày. Khoảng 20% thường được xem là tốt.', growth: 'Tổng người dùng theo ngày', dau: 'Người dùng hoạt động mỗi ngày',
    like: 'Người dùng có thích app không?', avgRating: 'Điểm hài lòng trung bình', responses: '{n} lượt đánh giá', back7: 'Quay lại sau 7 ngày', activeDaysUser: 'Số ngày hoạt động / người', opensUser: 'Lần mở app / người',
    ratingDist: 'Phân bố điểm đánh giá (1 = không thích, 5 = rất thích)', favTitle: 'Phần người dùng thích nhất', noRatings: 'Chưa có đánh giá. Câu hỏi hiện sau buổi tập thứ 2 của mỗi người.',
    cohorts: 'Giữ chân theo tuần đăng ký', cohortHint: '% người trong nhóm còn quay lại ở tuần 1–4 sau khi đăng ký.', week: 'Tuần đăng ký', size: 'Số người', wk: 'T{n}',
    time: 'Thời gian dùng ở mỗi màn hình', timeHint: 'Tổng thời gian người dùng ở lại từng màn hình. Phần dùng lâu thường là phần có giá trị nhất.', minPerDay: 'Phút / ngày hoạt động',
    screen: 'Màn hình', minutes: 'Phút', share: 'Tỉ lệ', avgVisit: 'TB mỗi lần', users: 'Người dùng', times: 'Lượt', noTime: 'Chưa có dữ liệu thời gian (ghi từ bản cập nhật này).',
    training: 'Tập luyện', started: 'Buổi bắt đầu', completed: 'Buổi hoàn thành', completionRate: 'Tỉ lệ hoàn thành', avgMinutes: 'Thời lượng TB (phút)', perWeek: 'Buổi / người / tuần', toFirst: 'Thời gian tới buổi đầu (giờ, trung vị)',
    workoutsDay: 'Buổi tập hoàn thành mỗi ngày', modes: 'Chế độ tập', difficulty: 'Cảm nhận độ khó sau buổi tập', pain: 'Báo đau: {a} / {b} phản hồi',
    topEx: 'Bài được tập nhiều nhất', skippedEx: 'Bài hay bị bỏ qua', replacedEx: 'Bài hay bị thay thế', exercise: 'Bài tập', none: 'Chưa có dữ liệu.',
    features: 'Mức độ dùng từng tính năng', adoptionHint: '% người dùng hoạt động đã dùng tính năng ít nhất 1 lần. Dưới khoảng 5% là dấu hiệu tính năng chưa đúng nhu cầu hoặc khó tìm.', allEvents: 'Tất cả hành động',
    funnel: 'Phễu kích hoạt', funnelHint: 'Người đăng ký trong {n} ngày qua.', retention: 'Quay lại sau N ngày', habits: 'Thói quen và thông báo', notif: 'Thông báo đã gửi {a}, đã đọc {b}', badges: 'Huy hiệu đạt được',
    audience: 'Thiết bị và ngôn ngữ', people: 'Danh sách người dùng', peopleHint: 'Email đã che bớt; không có tên hay nội dung riêng tư.', email: 'Email', joined: 'Đăng ký', last: 'Hoạt động cuối', activeDays: 'Ngày HĐ', rating: 'Điểm', lang: 'Ngôn ngữ', device: 'Thiết bị',
    hLowRating: 'Điểm hài lòng trung bình chỉ {v}/5. Xem phần "thích nhất" và các bài bị bỏ qua để tìm nguyên nhân.', hCompletion: 'Chỉ {v}% buổi tập được hoàn thành. Có thể buổi quá dài hoặc quá khó.',
    hFeature: '"{f}" chỉ {v}% người dùng sử dụng — cân nhắc làm nổi bật hơn hoặc xem lại.', hSkip: '"{e}" bị bỏ qua {v} lần — xem lại hướng dẫn hoặc thay bài dễ hơn.', hPain: '{v}% phản hồi sau tập có báo đau — rà soát độ khó và hướng dẫn an toàn.',
    hRetention: 'Chỉ {v}% người dùng quay lại sau 7 ngày — cần nhắc nhở và lý do quay lại.', hTime: 'Người dùng ở lâu nhất tại "{s}" ({v}% thời gian).',
  },
  en: {
    title: 'Usage analytics', intro: 'Metrics to understand users and improve the app. No private content (messages, meals, notes, photos). Kept {n} days; users can opt out in Profile.',
    days: '{n} days', csv: 'Export CSV', loading: 'Loading…', signIn: 'Please sign in to Mingalar Fit first, then reopen /admin.', denied: 'This account is not allowed to view admin analytics.', failed: 'Could not load analytics ({s}).',
    attention: 'What needs attention', allGood: 'Nothing unusual yet. More data is needed for firm conclusions.',
    overview: 'Overview', totalUsers: 'Total users', newUsers: 'New users ({n}d)', activeToday: 'Active today', active7: 'Active 7 days', active30: 'Active 30 days (MAU)',
    stickiness: 'Stickiness (DAU/MAU)', stickinessHint: 'Share of monthly users who come back on a typical day. Around 20% is commonly seen as good.', growth: 'Total users by day', dau: 'Daily active users',
    like: 'Do users like the app?', avgRating: 'Average satisfaction', responses: '{n} ratings', back7: 'Came back after 7 days', activeDaysUser: 'Active days per user', opensUser: 'App opens per user',
    ratingDist: 'Rating distribution (1 = not at all, 5 = love it)', favTitle: 'What users like most', noRatings: 'No ratings yet. The question appears after each user\'s 2nd workout.',
    cohorts: 'Retention by signup week', cohortHint: '% of each signup cohort active in week 1–4 after signing up.', week: 'Signup week', size: 'Users', wk: 'W{n}',
    time: 'Time spent per screen', timeHint: 'Total time users stay on each screen. Where they spend time is usually where the value is.', minPerDay: 'Minutes per active day',
    screen: 'Screen', minutes: 'Minutes', share: 'Share', avgVisit: 'Avg visit', users: 'Users', times: 'Times', noTime: 'No time data yet (recorded from this update on).',
    training: 'Training', started: 'Workouts started', completed: 'Workouts completed', completionRate: 'Completion rate', avgMinutes: 'Avg duration (min)', perWeek: 'Workouts / user / week', toFirst: 'Time to first workout (h, median)',
    workoutsDay: 'Workouts completed per day', modes: 'Workout modes', difficulty: 'Perceived difficulty after workouts', pain: 'Pain reported: {a} of {b} feedback',
    topEx: 'Most trained exercises', skippedEx: 'Most skipped exercises', replacedEx: 'Most replaced exercises', exercise: 'Exercise', none: 'No data yet.',
    features: 'Feature adoption', adoptionHint: '% of active users who used a feature at least once. Below ~5% suggests it misses the need or is hard to find.', allEvents: 'All actions',
    funnel: 'Activation funnel', funnelHint: 'Users who signed up in the last {n} days.', retention: 'Came back after N days', habits: 'Habits and notifications', notif: 'Notifications sent {a}, read {b}', badges: 'Badges earned',
    audience: 'Devices and language', people: 'Users', peopleHint: 'Masked email; no names or private content.', email: 'Email', joined: 'Joined', last: 'Last active', activeDays: 'Active days', rating: 'Rating', lang: 'Language', device: 'Device',
    hLowRating: 'Average satisfaction is only {v}/5. Check "liked most" and skipped exercises for causes.', hCompletion: 'Only {v}% of workouts are completed. Sessions may be too long or too hard.',
    hFeature: '"{f}" is used by only {v}% of users — consider making it more visible or rethinking it.', hSkip: '"{e}" was skipped {v} times — review the guidance or offer an easier option.', hPain: '{v}% of post-workout feedback reports pain — review difficulty and safety cues.',
    hRetention: 'Only {v}% of users come back after 7 days — reminders and reasons to return are needed.', hTime: 'Users spend the most time on "{s}" ({v}% of time).',
  },
};
const NAMES: Record<Lang, Record<string, string>> = {
  vi: { app_open: 'Mở app', screen_view: 'Xem màn hình', screen_time: 'Thời gian màn hình', app_rating: 'Đánh giá app', workout_started: 'Bắt đầu buổi tập', set_logged: 'Ghi set', workout_completed: 'Hoàn thành buổi tập',
    coach_message: 'Hỏi AI coach', food_logged: 'Ghi bữa ăn', food_ai_parsed: 'AI đọc bữa ăn', activity_logged: 'Ghi cardio', readiness_saved: 'Check-in thể trạng', body_logged: 'Ghi cân nặng', body_profile_saved: 'Lưu thông tin cơ thể',
    exercise_opened: 'Mở bài tập', voice_play: 'Nghe giọng đọc', weekly_report_ai: 'Báo cáo tuần AI', feedback_given: 'Phản hồi sau tập', workout_action: 'Bỏ qua / thay / tạm dừng', profile_saved: 'Lưu hồ sơ',
    language_changed: 'Lưu ngôn ngữ', language_switched: 'Đổi ngôn ngữ', theme_changed: 'Đổi giao diện', share_clicked: 'Chia sẻ buổi tập', photo_added: 'Thêm ảnh tiến bộ', plan_created: 'Tạo kế hoạch', plan_approved: 'Duyệt kế hoạch AI',
    coach_memory_saved: 'Lưu ghi nhớ coach', sets_ai_parsed: 'AI đọc set', favorite_toggled: 'Yêu thích bài tập',
    home: 'Trang chủ', train: 'Tập luyện', exercises: 'Thư viện bài tập', progress: 'Tiến bộ', coach: 'AI coach', profile: 'Hồ sơ', workout: 'Đang tập', achievements: 'Thành tích', inbox: 'Hộp thư', credits: 'Nguồn tham khảo', plans: 'Kế hoạch',
    free: 'Free Workout', follow: 'Follow Along', plan: 'Theo kế hoạch', signed_up: 'Đăng ký', onboarded: 'Hoàn thành hồ sơ', started_workout: 'Bắt đầu tập', completed_1: 'Hoàn thành 1 buổi', completed_3: 'Hoàn thành 3 buổi',
    workouts: 'Bài tập', voice: 'Giọng đọc', ai_coach: 'AI coach', nutrition: 'Dinh dưỡng', design: 'Giao diện', too_easy: 'Quá dễ', easy: 'Dễ', right: 'Vừa sức', hard: 'Khó', too_hard: 'Quá khó', mobile: 'Điện thoại', desktop: 'Máy tính', 'my-MM': 'Myanmar', en: 'Tiếng Anh' },
  en: { app_open: 'App opened', screen_view: 'Screen viewed', screen_time: 'Screen time', app_rating: 'App rating', workout_started: 'Workout started', set_logged: 'Set logged', workout_completed: 'Workout completed',
    coach_message: 'AI coach message', food_logged: 'Food logged', food_ai_parsed: 'Meal read by AI', activity_logged: 'Cardio logged', readiness_saved: 'Readiness check-in', body_logged: 'Weight logged', body_profile_saved: 'Body details saved',
    exercise_opened: 'Exercise opened', voice_play: 'Voice played', weekly_report_ai: 'Weekly AI review', feedback_given: 'Workout feedback', workout_action: 'Skip / replace / pause', profile_saved: 'Profile saved',
    language_changed: 'Language saved', language_switched: 'Language switched', theme_changed: 'Theme changed', share_clicked: 'Workout shared', photo_added: 'Progress photo added', plan_created: 'Plan created', plan_approved: 'AI plan approved',
    coach_memory_saved: 'Coach memory saved', sets_ai_parsed: 'Sets read by AI', favorite_toggled: 'Favorite toggled',
    home: 'Home', train: 'Train', exercises: 'Exercise library', progress: 'Progress', coach: 'AI coach', profile: 'Profile', workout: 'In workout', achievements: 'Achievements', inbox: 'Inbox', credits: 'Credits', plans: 'Plans',
    free: 'Free Workout', follow: 'Follow Along', plan: 'From plan', signed_up: 'Signed up', onboarded: 'Finished onboarding', started_workout: 'Started a workout', completed_1: 'Completed 1 workout', completed_3: 'Completed 3 workouts',
    workouts: 'Workouts', voice: 'Voice coach', ai_coach: 'AI coach', nutrition: 'Nutrition', design: 'Look and feel', too_easy: 'Too easy', easy: 'Easy', right: 'About right', hard: 'Hard', too_hard: 'Too hard', mobile: 'Phone', desktop: 'Computer', 'my-MM': 'Myanmar', en: 'English' },
};
const INK = 'var(--chart-ink, #2f6b52)';
// Wide tables scroll inside their panel instead of widening the page on phones.
const SCROLL = { overflowX: 'auto', maxWidth: '100%' } as const;
const fill = (s: string, v: Record<string, string | number>) => s.replace(/\{(\w+)\}/g, (_, k) => String(v[k] ?? ''));

function Bars({ data, label, maxLabel }: { data: { key: string; label: string; value: number }[]; label: string; maxLabel: string }) {
  const max = Math.max(1, ...data.map(d => d.value)), w = 100 / Math.max(1, data.length);
  return <figure className="chart admin-chart" aria-label={label}><figcaption>{label}</figcaption>
    <svg viewBox="0 0 100 60" preserveAspectRatio="none" role="img" aria-label={label}>
      <line x1="0" x2="100" y1="55" y2="55" stroke="var(--line)" strokeWidth="0.3"/>
      {data.map((d, i) => { const h = d.value ? Math.max(1.2, d.value / max * 50) : 0; return <g key={d.key}><title>{`${d.label}: ${d.value}`}</title>
        <rect x={i * w + w * 0.18} y={55 - h} width={w * 0.64} height={h} rx="0.6" fill={INK}/><rect x={i * w} y="0" width={w} height="60" fill="transparent"/></g>; })}
    </svg>
    <div className="admin-axis"><span>{data[0]?.label}</span><span>{maxLabel} {max}</span><span>{data.at(-1)?.label}</span></div>
  </figure>;
}
function HBars({ rows, unit = '' }: { rows: { label: string; value: number; note?: string }[]; unit?: string }) {
  const max = Math.max(1, ...rows.map(r => r.value));
  return <div className="muscle-bars">{rows.map(r => <div key={r.label} className="muscle-bar" title={`${r.label}: ${r.value}${unit}`}><span className="mb-label">{r.label}</span>
    <span className="mb-track"><span className="mb-fill" style={{ width: `${r.value / max * 100}%` }}/></span><span className="mb-value">{r.value}{unit}{r.note ? ` · ${r.note}` : ''}</span></div>)}</div>;
}
const Tile = ({ v, l, hint }: { v: string | number; l: string; hint?: string }) => <div className="stat-tile" title={hint}><strong>{v}</strong><small>{l}</small></div>;

export function AdminView() {
  const [lang, setLang] = useState<Lang>('vi');
  useEffect(() => { try { const v = localStorage.getItem('mingalar-admin-lang'); if (v === 'en' || v === 'vi') setLang(v); } catch { /* optional */ } }, []);
  const t = T[lang], n = (k: string) => NAMES[lang][k] ?? k;
  const [days, setDays] = useState(30); const [s, setS] = useState<Insights | null>(null); const [error, setError] = useState('');
  useEffect(() => { setS(null); setError(''); fetch(`/api/admin/analytics?days=${days}`, { cache: 'no-store' }).then(async r => {
    if (r.status === 401) throw new Error('signIn'); if (r.status === 403) throw new Error('denied'); if (!r.ok) throw new Error(String(r.status)); setS(await r.json()); }).catch(e => setError(e.message)); }, [days]);
  const errText = error === 'signIn' ? t.signIn : error === 'denied' ? t.denied : error ? fill(t.failed, { s: error }) : '';
  const setL = (l: Lang) => { setLang(l); try { localStorage.setItem('mingalar-admin-lang', l); } catch { /* optional */ } };
  // Rule-based hints from the numbers (only when there is enough data to say something).
  const hints: string[] = [];
  if (s) {
    if (s.satisfaction.responses >= 3 && (s.satisfaction.average ?? 5) < 3.5) hints.push(fill(t.hLowRating, { v: s.satisfaction.average! }));
    if (s.workouts.started >= 5 && (s.workouts.completionRate ?? 100) < 60) hints.push(fill(t.hCompletion, { v: s.workouts.completionRate! }));
    const r7 = s.retention.find(r => r.day === 7); if (r7 && r7.eligible >= 5 && (r7.rate ?? 100) < 25) hints.push(fill(t.hRetention, { v: r7.rate! }));
    if (s.workouts.feedbackCount >= 5 && s.workouts.painReports / s.workouts.feedbackCount > 0.1) hints.push(fill(t.hPain, { v: Math.round(s.workouts.painReports / s.workouts.feedbackCount * 100) }));
    if (s.workouts.skipped[0]?.count >= 3) hints.push(fill(t.hSkip, { e: s.workouts.skipped[0].exercise, v: s.workouts.skipped[0].count }));
    if (s.totals.active30 >= 10) s.adoption.filter(a => (a.share ?? 0) < 5).slice(0, 2).forEach(a => hints.push(fill(t.hFeature, { f: n(a.name), v: a.share ?? 0 })));
    if (s.screens[0]) hints.push(fill(t.hTime, { s: n(s.screens[0].screen), v: s.screens[0].share ?? 0 }));
  }
  const r7 = s?.retention.find(r => r.day === 7);
  return <section className="admin-view" style={{ minWidth: 0, maxWidth: '100%', overflowX: 'clip' }}>
    <div className="page-heading"><span className="overline"><BarChart3 size={14}/> Admin</span><h1>{t.title}</h1><p>{fill(t.intro, { n: s?.retentionDays ?? 90 })}</p></div>
    <div className="admin-toolbar">
      <div className="seg-switch">{[7, 30, 90].map(d => <button key={d} type="button" className={days === d ? 'selected' : ''} aria-pressed={days === d} onClick={() => setDays(d)}>{fill(t.days, { n: d })}</button>)}</div>
      <div className="admin-toolbar-right">
        <div className="seg-switch" aria-label="Language">{(['vi', 'en'] as const).map(l => <button key={l} type="button" className={lang === l ? 'selected' : ''} aria-pressed={lang === l} onClick={() => setL(l)}>{l === 'vi' ? 'Tiếng Việt' : 'English'}</button>)}</div>
        <a className="button secondary" href={`/api/admin/analytics.csv?days=${days}`}><Download size={16}/>{t.csv}</a>
      </div>
    </div>
    {errText && <p className="error-text" role="alert">{errText}</p>}
    {!s && !error && <div className="admin-skeleton" aria-label={t.loading}>{[0, 1, 2, 3].map(i => <span key={i} className="sk"/>)}</div>}
    {s && <>
      <section className="panel admin-hints"><h2><Lightbulb size={18}/> {t.attention}</h2>
        {hints.length ? <ul>{hints.map(h => <li key={h}><AlertTriangle size={15}/> {h}</li>)}</ul> : <p className="muted">{t.allGood}</p>}</section>

      <h2 className="admin-section">{t.overview}</h2>
      <div className="admin-kpis">
        <Tile v={s.totals.users} l={t.totalUsers}/><Tile v={s.totals.newUsers} l={fill(t.newUsers, { n: s.days })}/><Tile v={s.totals.activeToday} l={t.activeToday}/>
        <Tile v={s.totals.active7} l={t.active7}/><Tile v={s.engagement.mau} l={t.active30}/><Tile v={s.engagement.stickiness === null ? '—' : `${s.engagement.stickiness}%`} l={t.stickiness} hint={t.stickinessHint}/>
      </div>
      <div className="chart-grid">
        <section className="panel"><Bars label={t.growth} maxLabel="max" data={s.growth.map(d => ({ key: d.day, label: d.day.slice(5), value: d.users }))}/></section>
        <section className="panel"><Bars label={t.dau} maxLabel="max" data={s.series.map(d => ({ key: d.day, label: d.day.slice(5), value: d.activeUsers }))}/></section>
      </div>

      <h2 className="admin-section">{t.like}</h2>
      <div className="admin-kpis">
        <Tile v={s.satisfaction.average === null ? '—' : `${s.satisfaction.average}/5`} l={`${t.avgRating} · ${fill(t.responses, { n: s.satisfaction.responses })}`}/>
        <Tile v={r7?.rate === null || r7?.rate === undefined ? '—' : `${r7.rate}%`} l={t.back7}/>
        <Tile v={s.engagement.activeDaysPerUser} l={t.activeDaysUser}/><Tile v={s.engagement.opensPerUser} l={t.opensUser}/>
      </div>
      <div className="chart-grid">
        <section className="panel"><h3>{t.ratingDist}</h3>{s.satisfaction.responses ? <HBars rows={s.satisfaction.distribution.map((v, i) => ({ label: `${i + 1} ★`, value: v }))}/> : <p className="muted">{t.noRatings}</p>}
          {Object.keys(s.satisfaction.favorites).length > 0 && <><h3>{t.favTitle}</h3><HBars rows={Object.entries(s.satisfaction.favorites).sort((a, b) => b[1] - a[1]).map(([k, v]) => ({ label: n(k), value: v }))}/></>}</section>
        <section className="panel"><h3>{t.cohorts}</h3><p className="muted small">{t.cohortHint}</p>
          {s.cohorts.length ? <div className="table-scroll" style={SCROLL}><table className="admin-table cohort-table"><thead><tr><th>{t.week}</th><th>{t.size}</th>{[1, 2, 3, 4].map(k => <th key={k}>{fill(t.wk, { n: k })}</th>)}</tr></thead>
            <tbody>{s.cohorts.map(c => <tr key={c.week}><td>{c.week}</td><td>{c.size}</td>{c.weeks.map((v, i) => <td key={i} style={v === null ? undefined : { background: `color-mix(in srgb, #2f6b52 ${Math.round(v * 0.6)}%, transparent)` }}>{v === null ? '·' : `${v}%`}</td>)}</tr>)}</tbody></table></div> : <p className="muted">{t.none}</p>}</section>
      </div>

      <h2 className="admin-section">{t.time}</h2>
      <section className="panel"><p className="muted small">{t.timeHint}{s.engagement.minutesPerActiveDay !== null ? ` · ${t.minPerDay}: ${s.engagement.minutesPerActiveDay}` : ''}</p>
        {s.screens.length ? <><HBars rows={s.screens.map(x => ({ label: n(x.screen), value: x.minutes, note: x.share === null ? '' : `${x.share}%` }))} unit=" min"/>
          <div className="table-scroll" style={SCROLL}><table className="admin-table"><thead><tr><th>{t.screen}</th><th>{t.minutes}</th><th>{t.share}</th><th>{t.avgVisit}</th><th>{t.users}</th></tr></thead>
            <tbody>{s.screens.map(x => <tr key={x.screen}><td>{n(x.screen)}</td><td>{x.minutes}</td><td>{x.share ?? '—'}%</td><td>{x.avgVisitSec}s</td><td>{x.users}</td></tr>)}</tbody></table></div></> : <p className="muted">{t.noTime}</p>}</section>

      <h2 className="admin-section">{t.training}</h2>
      <div className="admin-kpis">
        <Tile v={s.workouts.started} l={t.started}/><Tile v={s.workouts.completed} l={t.completed}/><Tile v={s.workouts.completionRate === null ? '—' : `${s.workouts.completionRate}%`} l={t.completionRate}/>
        <Tile v={s.workouts.avgMinutes ?? '—'} l={t.avgMinutes}/><Tile v={s.workouts.perActiveUserWeek} l={t.perWeek}/><Tile v={s.workouts.medianHoursToFirst ?? '—'} l={t.toFirst}/>
      </div>
      <div className="chart-grid">
        <section className="panel"><Bars label={t.workoutsDay} maxLabel="max" data={s.series.map(d => ({ key: d.day, label: d.day.slice(5), value: d.workouts }))}/></section>
        <section className="panel"><h3>{t.modes}</h3>{Object.keys(s.workouts.modes).length ? <HBars rows={Object.entries(s.workouts.modes).map(([k, v]) => ({ label: n(k), value: v }))}/> : <p className="muted">{t.none}</p>}
          <h3>{t.difficulty}</h3>{Object.keys(s.workouts.difficulty).length ? <HBars rows={Object.entries(s.workouts.difficulty).map(([k, v]) => ({ label: n(k), value: v }))}/> : <p className="muted">{t.none}</p>}
          <p className="muted small">{fill(t.pain, { a: s.workouts.painReports, b: s.workouts.feedbackCount })}</p></section>
      </div>
      <div className="admin-three">
        {([[t.topEx, s.workouts.topExercises], [t.skippedEx, s.workouts.skipped], [t.replacedEx, s.workouts.replaced]] as [string, Count[]][]).map(([title, rows]) =>
          <section key={title} className="panel"><h3>{title}</h3>{rows.length ? <table className="admin-table"><thead><tr><th>{t.exercise}</th><th>{t.times}</th><th>{t.users}</th></tr></thead>
            <tbody>{rows.map(r => <tr key={r.exercise}><td>{r.exercise}</td><td>{r.count}</td><td>{r.users}</td></tr>)}</tbody></table> : <p className="muted">{t.none}</p>}</section>)}
      </div>

      <h2 className="admin-section">{t.features}</h2>
      <div className="chart-grid">
        <section className="panel"><p className="muted small">{t.adoptionHint}</p><HBars rows={s.adoption.map(a => ({ label: n(a.name), value: a.share ?? 0, note: `${a.users}` }))} unit="%"/></section>
        <section className="panel"><h3>{t.allEvents}</h3>{s.features.length ? <div className="table-scroll" style={SCROLL}><table className="admin-table"><thead><tr><th></th><th>{t.users}</th><th>{t.times}</th></tr></thead>
          <tbody>{s.features.map(f => <tr key={f.name}><td>{n(f.name)}</td><td>{f.users}</td><td>{f.count}</td></tr>)}</tbody></table></div> : <p className="muted">{t.none}</p>}</section>
      </div>

      <div className="chart-grid">
        <section className="panel"><h2>{t.funnel}</h2><p className="muted small">{fill(t.funnelHint, { n: s.days })}</p>
          <HBars rows={s.funnel.map(f => ({ label: n(f.step), value: f.users }))}/>
          <h3>{t.retention}</h3><div className="admin-kpis three">{s.retention.map(r => <Tile key={r.day} v={r.rate === null ? '—' : `${r.rate}%`} l={`${r.day}d · ${r.returned}/${r.eligible}`}/>)}</div></section>
        <section className="panel"><h2>{t.habits}</h2><p className="muted small">{fill(t.notif, { a: s.habits.notificationsSent, b: s.habits.notificationsRead })}</p>
          <h3>{t.badges}</h3>{Object.keys(s.habits.achievements).length ? <HBars rows={Object.entries(s.habits.achievements).map(([k, v]) => ({ label: k, value: v }))}/> : <p className="muted">{t.none}</p>}
          <h3>{t.audience}</h3><p className="muted small">{n('mobile')} {s.devices.mobile} · {n('desktop')} {s.devices.desktop}<br/>{Object.entries(s.locales).map(([k, v]) => `${n(k)} ${v}`).join(' · ')}</p></section>
      </div>

      <h2 className="admin-section">{t.people}</h2>
      <section className="panel"><p className="muted small">{t.peopleHint}</p>
        <div className="table-scroll" style={SCROLL}><table className="admin-table people-table"><thead><tr><th>{t.email}</th><th>{t.joined}</th><th>{t.last}</th><th>{t.activeDays}</th><th>{t.completed}</th><th>{t.rating}</th><th>{t.lang}</th><th>{t.device}</th></tr></thead>
          <tbody>{s.people.map((p, i) => <tr key={i}><td>{p.email}</td><td>{p.joined}</td><td>{p.lastActive ?? '—'}</td><td>{p.activeDays}</td><td>{p.workouts}</td><td>{p.rating ?? '—'}</td><td>{p.language ? n(p.language) : '—'}</td><td>{p.device ? n(p.device) : '—'}</td></tr>)}</tbody></table></div></section>
    </>}
  </section>;
}
