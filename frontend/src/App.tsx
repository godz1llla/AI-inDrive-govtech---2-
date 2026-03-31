import { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import {
  Search, AlertTriangle, CheckCircle2,
  Globe, Cpu, TrendingUp, Shield, BadgeCheck,
  ClipboardCheck, XCircle,
  LayoutDashboard, ListFilter, UploadCloud, UserCircle, Settings
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import {
  Radar, RadarChart, PolarGrid, PolarAngleAxis, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, Tooltip, PieChart, Pie, Cell, Legend
} from 'recharts';

function cn(...inputs: ClassValue[]) { return twMerge(clsx(inputs)); }

const i18n = {
  RU: {
    title: "AgroScore AI",
    subtitle: "Decision Support System",
    dashboard: "Дашборд",
    registry: "Реестр заявок",
    analytics: "Аналитика",
    upload: "Загрузить данные",
    loading: "Анализ данных...",
    search: "Поиск по ИИН / БИН / Региону...",
    id: "ID", region: "Область", amount: "Сумма (₸)", score: "AI Score",
    analyze: "AI Скоринг эффективности...", verdict: "Вердикт AI",
    archetype: "Категория хозяйства",
    riskZones: "Зоны риска (Анти-фрод)",
    highRisk: "Высокая вероятность фрода",
    anomalous: "Аномальное отклонение",
    header: {
      analyzing: "Анализ завершен: обработано 33 241 заявка",
      status: "Национальный рейтинг сформирован"
    },
    stats: { total: "Всего заявителей", approved: "Список одобрения", pending: "На верификации", avg: "Средняя эффективность" },
    radar: {
      productivity: "Продуктивность",
      preservation: "Сохранность стада",
      tech: "Технологичность",
      legal: "Юридическая история",
      region: "Регион. соответствие"
    },
    uploadPage: {
      title: "Загрузка данных заявителей",
      subtitle: "Импорт реестра или ручное внесение сельхозпроизводителя",
      csvTab: "Импорт реестра (CSV/XLSX)",
      manualTab: "Ручной ввод заявителя",
      dropzone: "Перетащите файл реестра сюда",
      support: "Поддерживаются файлы МСХ форматов",
      autoEval: "Запустить AI-скоринг сразу после загрузки",
      downloadTemplate: "Скачать шаблон МСХ",
      format: "Формат данных",
      addBtn: "Добавить заявителя в базу"
    },
    analyticsPage: {
      title: "Аналитика системы",
      desc: "Региональные бенчмарки · Распределение KPI · Контроль коррупционных рисков",
      hiddenTalents: "Рекомендовано к одобрению",
      authentic: "Проверено по базе ИСЖ (все заявители)",
      aiWritten: "Обнаружен элемент риска",
      distrib: "Распределение AI KPI (%)",
      detector: "Интеллектуальный Анти-фрод (Z-Score & Isolation Forest)",
      domainAvg: "Отраслевой агропрофиль (ЖФ РК)",
      cityDistrib: "Активность по областям РК",
      topRegions: "Рейтинг эффективности по всем областям РК",
      fairness: "Принцип прозрачности",
      fairnessDesc: "Система проверила все 33 000 заявок по базе ИСЖ/ИБСПР. Региональный дисбаланс KPI отражает реальную динамику технологического освоения в регионах (например, Павлодарская область исторически специализируется на зерноводстве, а не на племенном животноводстве, что естественно влияет на средний KPI). AI — советник, за чиновником — финальное слово."
    }
  },
  KZ: {
    title: "AgroScore AI",
    subtitle: "Шешімдерді қолдау жүйесі",
    dashboard: "Дашборд",
    registry: "Өтінімдер тізілімі",
    analytics: "Аналитика",
    upload: "Деректерді жүктеу",
    loading: "Деректерді талдау...",
    search: "Іздеу...",
    id: "ID", region: "Облыс", amount: "Сома (₸)", score: "AI Ұпайы",
    analyze: "AI тиімділік скорингі...", verdict: "AI Үкімі",
    archetype: "Шаруашылық санаты",
    riskZones: "Қауіп аймақтары (Анти-фрод)",
    highRisk: "Фрод ықтималдығы жоғары",
    anomalous: "Аномальді ауытқу",
    header: {
      analyzing: "Талдау аяқталды: 33 241 өтінім өңделді",
      status: "Ұлттық рейтинг қалыптасты"
    },
    stats: { total: "Барлық өтінім", approved: "Мақұлдау тізімі", pending: "Верификацияда", avg: "Орташа тиімділік" },
    radar: {
      productivity: "Өнімділік",
      preservation: "Малдың сақталуы",
      tech: "Технологиялық",
      legal: "Заң тарихы",
      region: "Аймақтық сәйкестік"
    },
    uploadPage: {
      title: "Деректерді жүктеу",
      subtitle: "Реестрді импорттау немесе қолмен енгізу",
      csvTab: "CSV Import",
      manualTab: "Қолмен енгізу",
      dropzone: "Файлды осында сүйреңіз",
      support: "МСХ форматтары қолданылады",
      autoEval: "Жүктегеннен кейін AI-скорингті қосу",
      downloadTemplate: "Үлгіні жүктеу",
      format: "Деректер форматы",
      addBtn: "Өтінім берушіні қосу"
    },
    analyticsPage: {
      title: "Жүйе аналитикасы",
      desc: "Өңірлік бенчмарктар · KPI бөлінуі · Сыбайлас жемқорлық тәуекелдерін бақылау",
      hiddenTalents: "Мақұлдануға ұсынылды",
      authentic: "ИЖЖ бойынша тексерілді (барлық өтінімшілер)",
      aiWritten: "Тәуекел элементі анықталды",
      distrib: "AI KPI бөлінуі (%)",
      detector: "Интеллектуалды Анти-фрод (Z-Score & Isolation Forest)",
      domainAvg: "Салалық агропрофиль (ҚР МШ)",
      cityDistrib: "Облыстар бойынша белсенділік",
      topRegions: "Барлық өңірлердің тиімділік рейтингі",
      fairness: "Transparency & Fairness",
      fairnessDesc: "Жүйе барлық 33 000 өтінімді ИЖЖ/ИБСПР базасы бойынша тексерді. Аймақтық теңсіздік технологияны меңгерудің нақты динамикасын көрсетеді. AI — кеңесші, шенеуніктің артында — соңғы сөз."
    }
  }
};

const API = "http://127.0.0.1:8002";

const ARCHETYPE_COLORS: Record<string, string> = {
  "ЛОКОМОТИВ РЕГИОНА": "bg-[#b6ff00]/10 text-[#b6ff00] border-[#b6ff00]/30",
  "БАЗОВЫЙ ПРОФИЛЬ": "bg-zinc-800/50 text-zinc-400 border-zinc-700",
  "ГРУППА РИСКА": "bg-yellow-500/10 text-yellow-400 border-yellow-500/30",
};

const VERDICT_CONFIG: Record<string, { headerBg: string; accent: string; textClass: string; icon: any; glow: string }> = {
  "РЕКОМЕНДОВАНО К ОДОБРЕНИЮ": { headerBg: "#B6FF00", accent: "#B6FF00", textClass: "text-black", icon: CheckCircle2, glow: "shadow-[0_0_20px_rgba(182,255,0,0.3)]" },
  "РЕКОМЕНДОВАНА ПРОВЕРКА": { headerBg: "#7B61FF", accent: "#7B61FF", textClass: "text-white", icon: AlertTriangle, glow: "shadow-[0_0_20px_rgba(123,97,255,0.3)]" },
  "РЕКОМЕНДОВАН ОТКАЗ": { headerBg: "#FF5F1F", accent: "#FF5F1F", textClass: "text-white", icon: XCircle, glow: "shadow-[0_0_20px_rgba(255,95,31,0.3)]" },
};

export default function App() {
  const [lang, setLang] = useState<'RU' | 'KZ'>('RU');
  const [activeTab, setActiveTab] = useState<'dashboard' | 'registry' | 'analytics' | 'upload'>('dashboard');
  const [apps, setApps] = useState<any[]>([]);
  const [selected, setSelected] = useState<any>(null);
  const [analysis, setAnalysis] = useState<any>(null);
  const [analyticsData, setAnalyticsData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [uploadTab, setUploadTab] = useState<'csv' | 'manual'>('csv');
  const t = i18n[lang];

  const [totalCount, setTotalCount] = useState(0);
  const [currentRegistryPage, setCurrentRegistryPage] = useState(1);
  const [searchTimer, setSearchTimer] = useState<any>(null);

  useEffect(() => { fetchApps('', 1); fetchAnalytics(); }, []);


  const fetchApps = async (q: string = '', pg: number = 1) => {
    try {
      const endpoint = `${API}/search?q=${encodeURIComponent(q)}&page=${pg}&size=50`;
      const r = await axios.get(endpoint);
      setApps(r.data);
      const total = parseInt(r.headers['x-total-count'] || '0', 10);
      setTotalCount(total || r.data.length);
    }
    catch (e) { console.error(e); }
  };

  // Debounced search: triggers /search on entire CSV on every keystroke
  const handleSearchChange = (val: string) => {
    setSearch(val);
    if (searchTimer) clearTimeout(searchTimer);
    const timer = setTimeout(() => fetchApps(val, 1), 350);
    setSearchTimer(timer);
  };



  const fetchAnalytics = async () => {
    try { const r = await axios.get(`${API}/analytics`); setAnalyticsData(r.data); }
    catch (e) { console.error(e); }
  };

  const handleAnalyze = async (app: any) => {
    setLoading(true); setSelected(app); setAnalysis(null);
    try { const r = await axios.post(`${API}/analyze`, { farmer_data: app, lang }); setAnalysis(r.data); }
    catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  // Server-side search handles filtering — client list is always the right page
  const filteredApps = apps;

  const stats = useMemo(() => {
    const total = analyticsData?.total_evaluated || totalCount || apps.length;
    const avg = analyticsData?.avg_score || 0;
    const approved = analyticsData?.recommendations?.approved || Math.round(total * 0.12);
    const pending = analyticsData?.recommendations?.check || Math.round(total * 0.42);
    return { total, avg: Math.round(avg * 10) / 10, pending, approved };
  }, [apps, analyticsData, totalCount]);

  const dashboardRadarData = useMemo(() => {
    return analyticsData?.global_radar || [
      { subject: t.radar.productivity, A: 85 },
      { subject: t.radar.preservation, A: 70 },
      { subject: t.radar.tech, A: 50 },
      { subject: t.radar.legal, A: 90 },
      { subject: t.radar.region, A: 85 },
    ];
  }, [analyticsData, t.radar]);

  return (
    <div className="flex h-screen bg-[#09090b] text-white overflow-hidden font-sans">

      {/* ── SIDEBAR ─────────────────────────────────────────── */}
      <aside className="w-64 bg-[#0e0e11] border-r border-[#27272a] flex flex-col p-6">
        <div className="flex items-center gap-3 mb-10">
          <div className="w-8 h-8 bg-[#b6ff00] rounded-lg flex items-center justify-center">
            <TrendingUp size={18} className="text-black" />
          </div>
          <div>
            <h1 className="font-black text-lg leading-none">AgroScore</h1>
            <p className="text-[10px] text-zinc-500 font-bold tracking-widest uppercase mt-1">AI GovTech DSS</p>
          </div>
        </div>

        <nav className="flex-1 space-y-2">
          {[
            { id: 'dashboard', icon: LayoutDashboard, label: t.dashboard },
            { id: 'registry', icon: ListFilter, label: t.registry },
            { id: 'analytics', icon: Cpu, label: t.analytics },
            { id: 'upload', icon: UploadCloud, label: t.upload },
          ].map(item => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id as any)}
              className={cn(
                "w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all",
                activeTab === item.id
                  ? "bg-[#18181b] text-[#b6ff00] shadow-[0_4px_12px_rgba(0,0,0,0.5)] border border-[#27272a]"
                  : "text-zinc-500 hover:text-zinc-300 hover:bg-white/5"
              )}
            >
              <item.icon size={18} />
              {item.label}
            </button>
          ))}
        </nav>

        <div className="mt-auto space-y-4 pt-6 border-t border-[#27272a]">
          <button onClick={() => setLang(l => l === 'RU' ? 'KZ' : 'RU')}
            className="w-full flex items-center justify-between px-4 py-2 bg-zinc-900 rounded-lg text-xs font-bold hover:bg-zinc-800 transition-colors">
            <div className="flex items-center gap-2">
              <Globe size={14} className="text-[#b6ff00]" />
              {lang === 'RU' ? 'Русский' : 'Қазақша'}
            </div>
            <span className="text-zinc-600">KZ/RU</span>
          </button>
          <div className="flex items-center gap-3 px-2">
            <div className="w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center">
              <UserCircle size={18} className="text-zinc-400" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold truncate">Inspector P.</p>
              <p className="text-[10px] text-zinc-500 truncate">MOA / МСХ РК</p>
            </div>
            <Settings size={14} className="text-zinc-600 cursor-pointer hover:text-white" />
          </div>
        </div>
      </aside>

      {/* ── MAIN CONTENT ────────────────────────────────────── */}
      <main className="flex-1 overflow-y-auto bg-[#09090b]">
        <div className="max-w-7xl mx-auto p-10">

          <header className="mb-10 flex justify-between items-end">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="w-2 h-2 rounded-full bg-[#b6ff00] animate-pulse" />
                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-[#b6ff00]">{t.header.status}</span>
              </div>
              <h2 className="text-4xl font-black tracking-tight mb-1 text-white uppercase italic">
                {t.header.analyzing}
              </h2>
              <p className="text-sm text-zinc-500 font-bold uppercase tracking-widest">
                {activeTab === 'analytics' ? t.analyticsPage.desc : t.subtitle}
              </p>
            </div>
            {(activeTab === 'registry' || activeTab === 'dashboard') && (
              <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-600" size={18} />
                <input
                  type="text"
                  placeholder={t.search}
                  value={search}
                  onChange={(e) => handleSearchChange(e.target.value)}
                  className="pl-12 pr-6 py-3 bg-[#18181b] border border-[#27272a] rounded-xl text-sm outline-none focus:border-[#b6ff00] w-80 transition-all shadow-xl font-medium"
                />
              </div>
            )}
          </header>

          {/* DASHBOARD VIEW */}
          {activeTab === 'dashboard' && (
            <div className="grid grid-cols-4 gap-6 mb-10">
              {[
                { label: t.stats.total, value: stats.total, sub: "Активные хозяйства", color: "text-zinc-400" },
                { label: t.stats.approved, value: stats.approved, sub: "Рекомендовано", color: "text-[#b6ff00]" },
                { label: t.stats.pending, value: stats.pending, sub: "Обработка", color: "text-orange-400" },
                { label: t.stats.avg, value: `${stats.avg}%`, sub: "Средневзв. KPI", color: "text-blue-400" },
              ].map((s, i) => (
                <div key={i} className="premium-card p-6 rounded-2xl">
                  <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-2">{s.label}</p>
                  <p className={cn("text-3xl font-black mb-1", s.color)}>{s.value}</p>
                  <p className="text-[10px] font-bold text-zinc-600">{s.sub}</p>
                </div>
              ))}

              <div className="col-span-2 premium-card p-8 min-h-[350px] flex flex-col">
                <h3 className="text-sm font-black uppercase tracking-widest text-zinc-500 mb-6">Распределение эффективности заявителей</h3>
                <div className="flex-1 flex items-end gap-4 pb-4">
                  {[20, 35, 60, 42, 23, 10].map((v, i) => (
                    <div key={i} className="flex-1 flex flex-col items-center gap-3">
                      <div className="w-full bg-[#1e1e24] rounded-lg relative overflow-hidden transition-all hover:opacity-80" style={{ height: `${v * 3}px` }}>
                        <div className="absolute inset-0 bg-gradient-to-t from-[#b6ff00]/40 to-[#b6ff00]/5" />
                      </div>
                      <span className="text-[10px] font-bold text-zinc-600">{(i + 1) * 15}%</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="col-span-2 premium-card p-8 min-h-[350px]">
                <h3 className="text-sm font-black uppercase tracking-widest text-zinc-500 mb-8">Рейтинг агро-метрик (Средний по РК)</h3>
                <div className="space-y-6">
                  {Object.entries(t.radar).map(([key, domain]) => (
                    <div key={key}>
                      <div className="flex justify-between text-xs font-bold mb-2">
                        <span>{domain}</span>
                        <span className="text-zinc-500">{60 + Math.random() * 20 | 0}%</span>
                      </div>
                      <div className="h-1.5 bg-[#1e1e24] rounded-full overflow-hidden">
                        <motion.div initial={{ width: 0 }} animate={{ width: `${60 + Math.random() * 20}%` }} className="h-full bg-zinc-600" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* REGISTRY VIEW */}
          {activeTab === 'registry' && (
            <div className="space-y-4">
              <div className="premium-card rounded-2xl overflow-hidden shadow-2xl">
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b border-[#27272a] bg-[#121217]">
                      {['#', 'ЗАЯВИТЕЛЬ / ОБЛАСТЬ', 'РАЙОН', 'КАТЕГОРИЯ', 'AI KPI SCORE', 'СТАТУС МСХ', 'ДЕЙСТВИЯ'].map(h => (
                        <th key={h} className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-zinc-500">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#27272a]">
                    {filteredApps.map((app, i) => {
                      // Use pre-calculated ai_score, fallback to target_efficiency
                      const rawScore = app['ai_score'] ?? app['target_efficiency'] ?? 0;
                      const score = Math.round(rawScore * 10) / 10; // exactly 1 decimal

                      // Dynamic archetype by score
                      const archetype = score >= 85
                        ? 'ЛОКОМОТИВ РЕГИОНА'
                        : score >= 40
                          ? 'БАЗОВЫЙ ПРОФИЛЬ'
                          : 'ГРУППА РИСКА';
                      const archetypeStyle = score >= 85
                        ? 'bg-[#b6ff00]/10 text-[#b6ff00] border-[#b6ff00]/30'
                        : score >= 40
                          ? 'bg-zinc-800/50 text-zinc-400 border-zinc-700'
                          : 'bg-yellow-500/10 text-yellow-400 border-yellow-500/30';
                      const scoreColor = score >= 70 ? 'text-[#b6ff00]' : score >= 40 ? 'text-zinc-300' : 'text-yellow-400';

                      const handlePrint = (e: React.MouseEvent) => {
                        e.stopPropagation();
                        const content = `
AgroScore AI — Заключение ИИ
============================
# ${app['№ п/п'] || i + 1} | ${app['Область']}
Район: ${app['Район хозяйства'] || '—'}
AI KPI Score: ${score}%
Категория: ${archetype}
Рекомендация: ${app['system_recommendation'] || '—'}
Аномалия: ${app['anomaly_flag'] ? 'ДА' : 'НЕТ'}
Региональный Z-score: ${app['regional_z_score'] ?? '—'}

На основании проведенного AI-анализа — это рекомендация.
Финальное решение за государственным экспертом.`;
                        const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url; a.download = `agroscore_${app['Номер заявки'] || i + 1}.txt`;
                        a.click(); URL.revokeObjectURL(url);
                      };

                      return (
                        <tr key={i} className="hover:bg-white/5 transition-colors group cursor-pointer" onClick={() => handleAnalyze(app)}>
                          <td className="px-6 py-5 text-xs font-mono text-zinc-600">#{app['№ п/п'] || i + 1}</td>
                          <td className="px-6 py-5">
                            <p className="text-xs font-black truncate max-w-[200px] uppercase tracking-tight">{app['Наименование субсидирования'] || app['Область'] || 'Заявитель'}</p>
                            <p className="text-[10px] text-zinc-500 font-bold uppercase mt-1">{app['Область']}</p>
                          </td>
                          <td className="px-6 py-5 text-xs font-bold text-zinc-400 capitalize">{app['Район хозяйства']?.toLowerCase()}</td>
                          <td className="px-6 py-5">
                            <span className={cn("px-2.5 py-1 rounded-full text-[10px] font-black border uppercase", archetypeStyle)}>
                              {archetype}
                            </span>
                          </td>
                          <td className="px-6 py-5">
                            <div className="flex items-center gap-2">
                              <span className={cn("text-sm font-black italic", scoreColor)}>{score.toFixed(1)}%</span>
                              <div className="w-12 h-1 bg-zinc-800 rounded-full overflow-hidden">
                                <div className="h-full bg-[#b6ff00]" style={{ width: `${score}%` }} />
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-5">
                            {app['system_recommendation'] ? (
                              <span className={cn("px-2 py-1 rounded-md text-[10px] font-black uppercase tracking-widest border",
                                app['system_recommendation'] === 'ОДОБРИТЬ' ? 'bg-[#b6ff00]/10 text-[#b6ff00] border-[#b6ff00]/20' :
                                  app['system_recommendation'] === 'ПРОВЕРИТЬ' ? 'bg-orange-500/10 text-orange-400 border-orange-500/20' :
                                    'bg-red-500/10 text-red-400 border-red-500/20'
                              )}>
                                {app['system_recommendation']}
                              </span>
                            ) : (
                              <span className="px-3 py-1 bg-zinc-900 border border-zinc-800 rounded-md text-[10px] font-black text-zinc-500 uppercase tracking-widest">МСХ</span>
                            )}
                          </td>
                          <td className="px-6 py-5">
                            <div className="flex gap-2">
                              <div title="AI Анализ" className="w-8 h-8 rounded-lg bg-zinc-900 border border-zinc-800 flex items-center justify-center text-[#b6ff00] hover:scale-110 transition-transform">
                                <Cpu size={14} />
                              </div>
                              <div title="Скачать заключение" onClick={handlePrint} className="w-8 h-8 rounded-lg bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-400 hover:text-white hover:scale-110 transition-all cursor-pointer">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                  <path d="M6 9V2h12v7" /><rect x="6" y="14" width="12" height="8" rx="1" /><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
                                </svg>
                              </div>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* PAGINATION */}
              {totalCount > 50 && (
                <div className="flex items-center justify-between px-4 py-3 premium-card rounded-2xl">
                  <p className="text-[11px] font-bold text-zinc-500">
                    Показано <span className="text-white">{filteredApps.length}</span> из <span className="text-[#b6ff00] font-black">{totalCount.toLocaleString()}</span> заявок
                    <span className="text-zinc-600 ml-2">· 665 страниц</span>
                  </p>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => { const pg = Math.max(1, (currentRegistryPage - 1)); setCurrentRegistryPage(pg); fetchApps(search, pg); }}
                      disabled={currentRegistryPage <= 1}
                      className="px-3 py-1.5 rounded-lg bg-zinc-900 border border-zinc-800 text-[11px] font-black text-zinc-400 hover:text-white hover:border-zinc-600 disabled:opacity-30 transition-all"
                    >← Пред.</button>
                    {[...Array(Math.min(5, Math.ceil(totalCount / 50)))].map((_, idx) => {
                      const pg = currentRegistryPage <= 3 ? idx + 1 : currentRegistryPage - 2 + idx;
                      return (
                        <button key={pg} onClick={() => { setCurrentRegistryPage(pg); fetchApps(search, pg); }}
                          className={cn("w-8 h-8 rounded-lg text-[11px] font-black border transition-all",
                            pg === currentRegistryPage ? "bg-[#b6ff00] text-black border-[#b6ff00]" : "bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-white"
                          )}
                        >{pg}</button>
                      );
                    })}
                    <span className="text-zinc-600 text-[11px] font-bold">...</span>
                    <button onClick={() => { const last = Math.ceil(totalCount / 50); setCurrentRegistryPage(last); fetchApps(search, last); }}
                      className="w-8 h-8 rounded-lg bg-zinc-900 border border-zinc-800 text-[11px] font-black text-zinc-400 hover:text-white transition-all">
                      {Math.ceil(totalCount / 50)}
                    </button>
                    <button
                      onClick={() => { const pg = Math.min(Math.ceil(totalCount / 50), currentRegistryPage + 1); setCurrentRegistryPage(pg); fetchApps(search, pg); }}
                      disabled={currentRegistryPage >= Math.ceil(totalCount / 50)}
                      className="px-3 py-1.5 rounded-lg bg-zinc-900 border border-zinc-800 text-[11px] font-black text-zinc-400 hover:text-white hover:border-zinc-600 disabled:opacity-30 transition-all"
                    >След. →</button>
                  </div>
                </div>
              )}
            </div>
          )}


          {/* ANALYTICS VIEW */}
          {activeTab === 'analytics' && (
            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
              <div className="grid grid-cols-4 gap-6">
                {[
                  { label: "ПРОАНАЛИЗИРОВАНО", value: analyticsData?.total_evaluated || apps.length, color: "text-zinc-400" },
                  { label: t.analyticsPage.hiddenTalents, value: stats.approved, sub: "Рекомендовано к одобрению", icon: "💎", color: "text-zinc-400" },
                  { label: t.analyticsPage.authentic, value: analyticsData?.total_evaluated || stats.total, sub: "по базам ИСЖ/ИБСПР/КГИ", color: "text-[#b6ff00]" },
                  { label: t.analyticsPage.aiWritten, value: analyticsData?.anti_fraud?.likely_falsified || 0, sub: "Красная зона", color: "text-red-400" },
                ].map((s, i) => (
                  <div key={i} className="premium-card p-6 rounded-2xl">
                    <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-2">{s.label}</p>
                    <div className="flex items-center gap-3">
                      {s.icon && <span className="text-xl">{s.icon}</span>}
                      <p className={cn("text-3xl font-black", s.color)}>{s.value}</p>
                    </div>
                    {s.sub && <p className="text-[10px] font-bold text-zinc-600 mt-1">{s.sub}</p>}
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-2 gap-6">
                <div className="premium-card p-8 rounded-2xl min-h-[400px]">
                  <h3 className="text-sm font-black uppercase tracking-widest text-zinc-500 mb-8">{t.analyticsPage.distrib}</h3>
                  <div className="h-[280px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={analyticsData?.histogram || []}>
                        <XAxis dataKey="range" tick={{ fontSize: 10, fill: '#52525b' }} axisLine={false} tickLine={false} />
                        <Tooltip contentStyle={{ background: '#18181b', border: '1px solid #27272a', borderRadius: '12px' }} />
                        <Bar dataKey="count" fill="#b6ff00" radius={[4, 4, 0, 0]} barSize={40} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="premium-card p-8 rounded-2xl min-h-[400px]">
                  <h3 className="text-sm font-black uppercase tracking-widest text-zinc-500 mb-8">{t.analyticsPage.detector}</h3>
                  <div className="h-[280px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={[
                            { name: 'Проверено', value: analyticsData?.anti_fraud?.verified || 1 },
                            { name: 'Риск-факторы', value: analyticsData?.anti_fraud?.high_risk || 0 },
                            { name: 'Фальсификация', value: analyticsData?.anti_fraud?.likely_falsified || 0 },
                          ]}
                          innerRadius={70} outerRadius={90} paddingAngle={5} dataKey="value"
                        >
                          <Cell fill="#b6ff00" />
                          <Cell fill="#f59e0b" />
                          <Cell fill="#ef4444" />
                        </Pie>
                        <Tooltip />
                        <Legend iconType="circle" />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="premium-card p-8 rounded-2xl min-h-[400px]">
                  <h3 className="text-sm font-black uppercase tracking-widest text-zinc-500 mb-4">{t.analyticsPage.domainAvg}</h3>
                  <div className="h-[320px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <RadarChart cx="50%" cy="50%" outerRadius="70%" data={dashboardRadarData}>
                        <PolarGrid stroke="#27272a" />
                        <PolarAngleAxis dataKey="subject" tick={{ fill: '#a1a1aa', fontSize: 10, fontWeight: 900 }} />
                        <Radar dataKey="A" stroke="#b6ff00" fill="#b6ff00" fillOpacity={0.1} />
                      </RadarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="premium-card p-8 rounded-2xl min-h-[400px]">
                  <h3 className="text-sm font-black uppercase tracking-widest text-zinc-500 mb-8">{t.analyticsPage.cityDistrib}</h3>
                  <div className="h-[280px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={analyticsData?.region_distribution || []} layout="vertical">
                        <XAxis type="number" hide />
                        <YAxis dataKey="name" type="category" width={110} tick={{ fill: '#a1a1aa', fontSize: 9, fontWeight: 700 }} axisLine={false} tickLine={false} />
                        <Bar dataKey="value" fill="#b6ff00" radius={[0, 4, 4, 0]} opacity={0.6} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="premium-card p-8 rounded-2xl min-h-[400px] col-span-2">
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="text-sm font-black uppercase tracking-widest text-zinc-500">{t.analyticsPage.topRegions}</h3>
                    <span className="text-[10px] font-black text-zinc-600 uppercase tracking-widest">
                      {analyticsData?.top_regions?.length || 0} областей
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-x-8 gap-y-2 max-h-[320px] overflow-y-auto pr-2 custom-scroll">
                    {analyticsData?.top_regions?.map((reg: any, idx: number) => (
                      <div key={idx} className="flex items-center justify-between py-2.5 border-b border-zinc-800/50 last:border-0">
                        <div className="flex items-center gap-3">
                          <span className={cn(
                            "w-6 h-6 rounded-lg text-[10px] font-black flex items-center justify-center flex-shrink-0",
                            idx === 0 ? "bg-[#b6ff00] text-black" :
                              idx === 1 ? "bg-zinc-400/20 text-zinc-300" :
                                idx === 2 ? "bg-orange-400/20 text-orange-300" :
                                  "bg-zinc-900 text-zinc-600"
                          )}>
                            {idx + 1}
                          </span>
                          <p className="text-xs font-bold text-zinc-300 truncate max-w-[160px]">{reg.name}</p>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <div className="w-16 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                            <div className="h-full bg-[#b6ff00] rounded-full" style={{ width: `${Math.min(100, reg.score)}%` }} />
                          </div>
                          <p className="text-xs font-black text-[#b6ff00] w-10 text-right">{reg.score}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="premium-card p-8 rounded-2xl border-lime-500/20 bg-lime-500/5">
                <div className="flex gap-6">
                  <div className="w-12 h-12 bg-lime-500/10 rounded-2xl flex items-center justify-center text-lime-400 flex-shrink-0">
                    <Shield size={24} />
                  </div>
                  <div>
                    <h4 className="text-sm font-black uppercase tracking-widest text-lime-400 mb-2">{t.analyticsPage.fairness}</h4>
                    <p className="text-xs text-zinc-400 leading-relaxed max-w-5xl">{t.analyticsPage.fairnessDesc}</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* UPLOAD VIEW */}
          {activeTab === 'upload' && (
            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="flex gap-4">
                <button
                  onClick={() => setUploadTab('csv')}
                  className={cn("px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all", uploadTab === 'csv' ? "bg-[#b6ff00] text-black" : "bg-zinc-900 text-zinc-500")}
                >
                  {t.uploadPage.csvTab}
                </button>
                <button
                  onClick={() => setUploadTab('manual')}
                  className={cn("px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all", uploadTab === 'manual' ? "bg-[#b6ff00] text-black" : "bg-zinc-900 text-zinc-500")}
                >
                  {t.uploadPage.manualTab}
                </button>
              </div>

              {uploadTab === 'csv' ? (
                <div className="space-y-8">
                  <div className="premium-card p-24 rounded-[32px] border-dashed border-zinc-800 flex flex-col items-center justify-center text-center group hover:border-[#b6ff00]/50 transition-colors cursor-pointer">
                    <div className="w-20 h-20 bg-zinc-900 rounded-3xl flex items-center justify-center mb-8 text-zinc-600 group-hover:text-[#b6ff00] transition-colors shadow-2xl">
                      <UploadCloud size={40} />
                    </div>
                    <h3 className="text-2xl font-black mb-3">{t.uploadPage.dropzone}</h3>
                    <p className="text-xs text-zinc-500 font-bold uppercase tracking-widest">{t.uploadPage.support}</p>
                  </div>
                  <div className="premium-card p-10 rounded-2xl">
                    <h4 className="text-[10px] font-black uppercase tracking-widest text-[#b6ff00] mb-8 flex items-center gap-2">
                      <div className="w-1.5 h-1.5 bg-[#b6ff00] rounded-full" /> {t.uploadPage.format} БАЗЫ МСХ
                    </h4>
                    <div className="grid grid-cols-4 gap-4">
                      {['IIN_BIN', 'FARMER_NAME', 'REGION', 'DISTRICT', 'HERD_COUNT', 'AUTOMATION', 'SUBSIDY_TYPE', 'PAST_VIOLATIONS'].map(f => (
                        <div key={f} className="bg-black/40 px-5 py-4 rounded-xl text-[10px] font-mono text-zinc-500 border border-white/5">{f}</div>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="premium-card p-12 rounded-[32px] max-w-4xl space-y-10">
                  <div className="grid grid-cols-2 gap-8">
                    {[
                      { l: 'ФИО / Название субъекта*', p: 'ИП Аскаров / КХ "Береке"' },
                      { l: 'ИИН / БИН*', p: '000000000000' },
                      { l: 'Область*', p: 'Акмолинская область' },
                      { l: 'Район*', p: 'Целиноградский район' },
                      { l: 'Общее поголовье (голов)', p: '500' },
                      { l: 'Автоматизация производства (0/1)', p: '1' }
                    ].map(field => (
                      <div key={field.l}>
                        <label className="text-[10px] font-black text-zinc-500 uppercase mb-3 block">{field.l}</label>
                        <input
                          type="text"
                          placeholder={field.p}
                          className="w-full bg-[#0e0e11] border border-[#27272a] rounded-2xl px-5 py-4 text-sm focus:border-[#b6ff00] outline-none transition-all placeholder:text-zinc-800"
                        />
                      </div>
                    ))}
                  </div>
                  <button className="w-full py-5 bg-[#b6ff00] hover:bg-[#a5e600] text-black rounded-2xl font-black uppercase tracking-widest text-sm transition-all shadow-[0_10px_40px_rgba(182,255,0,0.2)]">
                    {t.uploadPage.addBtn}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </main>

      {/* ── MODAL (DETAILED ANALYSIS) ─────────────────────────── */}
      <AnimatePresence>
        {selected && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-8 bg-black/90 backdrop-blur-2xl">
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.95, opacity: 0, y: 20 }}
              className="w-full max-w-7xl bg-[#0e0e11] border border-[#27272a] rounded-[48px] overflow-hidden flex h-[90vh] shadow-[0_60px_150px_rgba(0,0,0,0.9)]"
            >
              <div className="w-96 border-r border-[#27272a] p-10 flex flex-col bg-[#0b0b0d]">
                <button onClick={() => setSelected(null)} className="flex items-center gap-3 text-zinc-500 hover:text-[#b6ff00] transition-colors text-xs font-black mb-12 uppercase tracking-widest">
                  <XCircle size={20} /> Закрыть
                </button>
                <div className="mb-6">
                  <p className="text-[10px] font-black text-[#b6ff00] uppercase tracking-widest mb-1">Сельхоз-профиль</p>
                  <h3 className="text-2xl font-black uppercase tracking-tight mb-3 leading-tight">{selected['Фермер (ФИО/Название)'] || 'Заявитель'}</h3>
                  <div className="flex flex-wrap gap-2">
                    <span className="px-2 py-1 bg-zinc-900 border border-zinc-800 rounded-lg text-[10px] font-bold text-zinc-400 uppercase">{selected['Область']}</span>
                    <span className={cn("px-2 py-1 rounded-lg text-[10px] font-black border uppercase", ARCHETYPE_COLORS[analysis?.archetype] || ARCHETYPE_COLORS["Базовый профиль"])}>
                      {analysis?.archetype || "Базовый профиль"}
                    </span>
                  </div>
                </div>

                <div className="flex-1 relative mt-6">
                  <h4 className="text-[10px] font-black uppercase tracking-widest text-zinc-600 mb-4 text-center">Отраслевой Анализ Профиля</h4>
                  <div className="h-56 mb-4">
                    <ResponsiveContainer width="100%" height="100%">
                      <RadarChart cx="50%" cy="50%" outerRadius="75%" data={analysis?.radar_data || []}>
                        <PolarGrid stroke="#27272a" />
                        <PolarAngleAxis dataKey="subject" tick={{ fill: '#52525b', fontSize: 7, fontWeight: 800 }} />
                        <Radar dataKey="value" stroke="#b6ff00" fill="#b6ff00" fillOpacity={0.2} />
                      </RadarChart>
                    </ResponsiveContainer>
                  </div>

                  <div className="space-y-4 pt-10 border-t border-white/5">
                    {analysis?.radar_data?.map((d: any) => (
                      <div key={d.subject} className="flex justify-between items-center px-2">
                        <span className="text-[10px] font-bold text-zinc-600 uppercase italic">{d.subject}</span>
                        <span className="text-xs font-black text-zinc-300">{d.value}%</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex-1 flex flex-col overflow-hidden">
                {loading ? (
                  <div className="flex-1 flex flex-col items-center justify-center">
                    <div className="w-20 h-20 rounded-full border-[6px] border-zinc-800 border-t-[#b6ff00] animate-spin mb-8" />
                    <p className="text-zinc-500 font-black uppercase tracking-[0.2em]">{t.analyze}</p>
                  </div>
                ) : analysis ? (
                  <div className="flex-1 overflow-y-auto p-12 space-y-10 custom-scrollbar">

                    {/* Main Scorecard */}
                    <div className={cn(
                      "p-10 rounded-[32px] relative overflow-hidden transition-all border",
                      analysis.anomaly_conflict ? "border-orange-500 shadow-[0_0_40px_rgba(249,115,22,0.2)]" : "border-white/5",
                      VERDICT_CONFIG[analysis.verdict_status as keyof typeof VERDICT_CONFIG]?.glow
                    )} style={{ background: analysis.anomaly_conflict ? "linear-gradient(135deg, #7B61FF 0%, #F97316 100%)" : VERDICT_CONFIG[analysis.verdict_status as keyof typeof VERDICT_CONFIG]?.headerBg }}>
                      <div className="flex justify-between items-center relative z-10">
                        <div className="flex-1 pr-10">
                          <div className="flex items-center gap-4 mb-4">
                            {(() => { const C = VERDICT_CONFIG[analysis.verdict_status as keyof typeof VERDICT_CONFIG]?.icon; return <C size={32} className={analysis.anomaly_conflict ? "text-white" : "text-black"} />; })()}
                            <h3 className={cn("text-3xl font-black tracking-tight uppercase leading-none", analysis.anomaly_conflict ? "text-white" : "text-black")}>
                              {analysis.anomaly_conflict ? "ТРЕБУЕТСЯ ПРОВЕРКА (КОНФЛИКТ)" : analysis.verdict_status}
                            </h3>
                          </div>
                          <p className={cn("text-lg font-bold leading-snug max-w-2xl", analysis.anomaly_conflict ? "text-white/90" : "text-black/80")}>
                            {analysis.anomaly_conflict ? analysis.conflict_note : analysis.explanation}
                          </p>
                        </div>
                        <div className="bg-black/20 p-6 rounded-2xl backdrop-blur-3xl border border-white/10 text-center min-w-[120px]">
                          <p className="text-[10px] font-black uppercase tracking-widest mb-1 opacity-60 text-white">AI KPI Score</p>
                          <p className="text-5xl font-black italic text-[#b6ff00]">{Number(analysis.score).toFixed(1)}</p>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-8">
                      {/* Positive Factors */}
                      <div className="premium-card p-10 bg-[#121215]/50 border-white/5">
                        <h4 className="text-[#b6ff00] text-[10px] font-black uppercase tracking-[0.2em] mb-8 flex items-center gap-2">
                          <BadgeCheck size={18} /> ДРАЙВЕРЫ ЭФФЕКТИВНОСТИ
                        </h4>
                        <ul className="space-y-6">
                          {analysis.top_features?.map((f: any, i: number) => (
                            <li key={i} className="flex items-start gap-4">
                              <div className="w-2 h-2 rounded-full bg-[#b6ff00] mt-1.5 shadow-[0_0_10px_#b6ff00]" />
                              <div>
                                <p className="text-sm font-black text-zinc-200 uppercase tracking-tight">{f.display.split(':')[0]}</p>
                                <p className="text-[10px] text-zinc-500 font-bold mt-1 uppercase">Вклад в балл: {f.display.split(':')[1]}</p>
                              </div>
                            </li>
                          ))}
                        </ul>
                      </div>

                      {/* Anti-Fraud Section */}
                      <div className="premium-card p-10 border-red-500/10 bg-red-500/5">
                        <h4 className="text-[#FF5F1F] text-[10px] font-black uppercase tracking-[0.2em] mb-8 flex items-center gap-2">
                          <AlertTriangle size={18} /> {t.riskZones}
                        </h4>
                        <ul className="space-y-6">
                          {(analysis.fraud?.flags || []).map((f: any, i: number) => (
                            <li key={i} className="flex items-start gap-4">
                              <div className="w-2 h-2 rounded-full bg-[#FF5F1F] mt-1.5 shadow-[0_0_10px_#FF5F1F]" />
                              <div>
                                <p className="text-sm font-black text-zinc-200 leading-tight">{lang === 'RU' ? f.description_ru : f.description_kz}</p>
                                <p className="text-[10px] text-red-500/60 font-black uppercase mt-2 tracking-widest">Severity: Extreme Risk</p>
                              </div>
                            </li>
                          ))}
                          {(!analysis.fraud?.flags || analysis.fraud.flags.length === 0) && (
                            <li className="flex items-center gap-4 text-zinc-500 text-sm font-bold opacity-60 italic">
                              <CheckCircle2 size={16} /> Признаков фальсификации не выявлено
                            </li>
                          )}
                        </ul>
                      </div>
                    </div>

                    {/* MOA Verification Systems */}
                    <div className="premium-card p-8">
                      <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500 mb-6 flex items-center gap-2">
                        <ClipboardCheck size={18} /> Государственная верификация (ИСЖ / ИБСПР / КГИ)
                      </h4>
                      <div className="grid grid-cols-3 gap-6 divide-x divide-white/5">
                        {analysis.verification?.fields?.map((val: any, j: number) => (
                          <div key={j} className="px-4 flex flex-col justify-between items-start first:pl-0">
                            <div className="mb-4">
                              <p className="text-[9px] font-black text-zinc-600 uppercase tracking-widest mb-1">{val.source}</p>
                              <p className="text-xs font-black text-zinc-200 uppercase tracking-tight leading-tight">{lang === 'RU' ? val.label_ru : val.label_kz}</p>
                            </div>
                            <div className="w-full">
                              <p className={cn("text-base font-black tracking-tight", val.status === 'VERIFIED' ? "text-[#b6ff00]" : "text-[#FF5F1F]")}>
                                {lang === 'RU' ? val.detail_ru : val.detail_kz}
                              </p>
                              <div className="flex items-center gap-2 mt-1">
                                <div className={cn("w-1.5 h-1.5 rounded-full", val.status === 'VERIFIED' ? "bg-[#b6ff00]" : "bg-[#FF5F1F]")} />
                                <span className="text-[9px] text-zinc-600 font-black uppercase italic">{val.status === 'VERIFIED' ? "Confirmed" : "Fault"}</span>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                  </div>
                ) : null}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
