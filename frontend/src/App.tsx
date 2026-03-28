import { useState, useEffect } from 'react';
import axios from 'axios';
import {
  Search, AlertTriangle, CheckCircle2, ChevronRight,
  Globe, Cpu, TrendingUp, Shield, BadgeCheck,
  ClipboardCheck, XCircle, AlertCircle, ChevronDown, ChevronUp
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) { return twMerge(clsx(inputs)); }

const i18n = {
  RU: {
    title: "GovTech DSS",
    subtitle: "Decision Support System — Племенное животноводство",
    applications: "Реестр заявок",
    search: "Поиск по региону / ID...",
    id: "ID", region: "Область", amount: "Сумма (₸)", score: "AI Score",
    analyze: "Анализ...", verdict: "Вердикт системы",
    ОДОБРИТЬ: "РЕКОМЕНДОВАНО К ОДОБРЕНИЮ",
    "ВЫЕЗДНАЯ ПРОВЕРКА": "РЕКОМЕНДОВАНА ПРОВЕРКА",
    "РЕКОМЕНДОВАНО К ОДОБРЕНИЮ": "РЕКОМЕНДОВАНО К ОДОБРЕНИЮ",
    "РЕКОМЕНДОВАНА ПРОВЕРКА": "РЕКОМЕНДОВАНА ПРОВЕРКА",
    "РЕКОМЕНДОВАН ОТКАЗ": "РЕКОМЕНДОВАН ОТКАЗ",
    ОТКАЗАТЬ: "РЕКОМЕНДОВАН ОТКАЗ",
    techMetrics: "Факторы влияния (SHAP)",
    verificationTitle: "Верификация госсистемой",
    fraudTitle: "Антифрод (Rules + ML)",
    noFlags: "Нарушений не выявлено",
    specialistDetails: "Детали для специалиста ▾",
    riskLevels: { Low: "Низкий", Medium: "Средний", High: "Высокий", Anomalous: "Аномалия", Elite: "Элита" },
    zStatus: { Normal: "Статистически типично", Warning: "Отклонение от нормы", Risk: "⚠ Подозрительно" },
  },
  KZ: {
    title: "GovTech DSS",
    subtitle: "Шешімдерді қолдау жүйесі — Асыл тұқымды мал шаруашылығы",
    applications: "Өтінімдер тізілімі",
    search: "Іздеу...",
    id: "ID", region: "Облыс", amount: "Сома (₸)", score: "AI Ұпайы",
    analyze: "Талдау...", verdict: "Жүйе үкімі",
    ОДОБРИТЬ: "МАҚҰЛДАУҒА ҰСЫНЫЛАДЫ",
    "ВЫЕЗДНАЯ ПРОВЕРКА": "ТЕКСЕРУГЕ ҰСЫНЫЛАДЫ",
    "РЕКОМЕНДОВАНО К ОДОБРЕНИЮ": "МАҚҰЛДАУҒА ҰСЫНЫЛАДЫ",
    "РЕКОМЕНДОВАНА ПРОВЕРКА": "ТЕКСЕРУГЕ ҰСЫНЫЛАДЫ",
    "РЕКОМЕНДОВАН ОТКАЗ": "БАС ТАРТУҒА ҰСЫНЫЛАДЫ",
    ОТКАЗАТЬ: "БАС ТАРТУҒА ҰСЫНЫЛАДЫ",
    techMetrics: "SHAP факторлары",
    verificationTitle: "Мемлекеттік верификация",
    fraudTitle: "Антифрод (Rules + ML)",
    noFlags: "Бұзушылықтар анықталмады",
    specialistDetails: "Маман үшін мәліметтер ▾",
    riskLevels: { Low: "Төмен", Medium: "Орташа", High: "Жоғары", Anomalous: "Аномалия", Elite: "Элита" },
    zStatus: { Normal: "Статистикалық норма", Warning: "Ауытқу бар", Risk: "⚠ Күдікті" },
  }
};

const API = "http://localhost:8001";

type VerdictKey = "РЕКОМЕНДОВАНО К ОДОБРЕНИЮ" | "РЕКОМЕНДОВАНА ПРОВЕРКА" | "РЕКОМЕНДОВАН ОТКАЗ" | "ОДОБРИТЬ" | "ВЫЕЗДНАЯ ПРОВЕРКА" | "ОТКАЗАТЬ";
const VERDICT_CONFIG: Record<string, { headerBg: string; accent: string; textClass: string; icon: any }> = {
  "РЕКОМЕНДОВАНО К ОДОБРЕНИЮ": { headerBg: "#B6FF00", accent: "#B6FF00", textClass: "text-black", icon: CheckCircle2 },
  "РЕКОМЕНДОВАНА ПРОВЕРКА": { headerBg: "#F59E0B", accent: "#F59E0B", textClass: "text-black", icon: AlertTriangle },
  "РЕКОМЕНДОВАН ОТКАЗ": { headerBg: "#DC2626", accent: "#DC2626", textClass: "text-white", icon: XCircle },
  // Legacy aliases
  "ОДОБРИТЬ": { headerBg: "#B6FF00", accent: "#B6FF00", textClass: "text-black", icon: CheckCircle2 },
  "ВЫЕЗДНАЯ ПРОВЕРКА": { headerBg: "#F59E0B", accent: "#F59E0B", textClass: "text-black", icon: AlertTriangle },
  "ОТКАЗАТЬ": { headerBg: "#DC2626", accent: "#DC2626", textClass: "text-white", icon: XCircle },
};

export default function App() {
  const [lang, setLang] = useState<'RU' | 'KZ'>('RU');
  const [apps, setApps] = useState<any[]>([]);
  const [selected, setSelected] = useState<any>(null);
  const [analysis, setAnalysis] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const t = i18n[lang];

  useEffect(() => { fetchApps(); }, []);

  const fetchApps = async () => {
    try { const r = await axios.get(`${API}/applications`); setApps(r.data); }
    catch (e) { console.error(e); }
  };

  const handleAnalyze = async (app: any) => {
    setLoading(true); setSelected(app); setAnalysis(null); setShowDetails(false);
    try { const r = await axios.post(`${API}/analyze`, { farmer_data: app, lang }); setAnalysis(r.data); }
    catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const closeModal = () => { setSelected(null); setAnalysis(null); };

  const verdictKey = (analysis?.verdict_status ?? "ОДОБРИТЬ") as VerdictKey;
  const verdict = VERDICT_CONFIG[verdictKey] ?? VERDICT_CONFIG["ОДОБРИТЬ"];
  const VIcon = verdict.icon;
  const localVerdict = t[verdictKey as keyof typeof t] as string ?? verdictKey;

  return (
    <div style={{ fontFamily: "'Inter', sans-serif" }} className="min-h-screen bg-gray-50 text-black">

      {/* ── HEADER ─────────────────────────────────────────────── */}
      <header className="bg-white border-b border-gray-100 sticky top-0 z-50"
        style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.06)" }}>
        <div className="max-w-7xl mx-auto px-8 py-4 flex justify-between items-center">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 bg-black rounded-xl flex items-center justify-center flex-shrink-0">
              <span style={{ color: "#B6FF00" }} className="font-black text-base italic">GT</span>
            </div>
            <div>
              <div className="text-base font-black tracking-tight uppercase">{t.title}</div>
              <div className="text-xs text-gray-400 font-medium mt-0">{t.subtitle}</div>
            </div>
          </div>
          <button onClick={() => setLang(l => l === 'RU' ? 'KZ' : 'RU')}
            className="flex items-center gap-2 px-4 py-2 bg-black text-white rounded-full text-sm font-bold hover:opacity-80 transition-opacity">
            <Globe size={14} style={{ color: "#B6FF00" }} />
            {lang}
          </button>
        </div>
      </header>

      {/* ── MAIN TABLE ─────────────────────────────────────────── */}
      <main className="max-w-7xl mx-auto px-8 py-8">
        <div className="bg-white rounded-2xl overflow-hidden" style={{ boxShadow: "0 2px 16px rgba(0,0,0,0.06)", border: "1px solid #f0f0f0" }}>

          {/* Table header */}
          <div className="px-8 py-5 flex justify-between items-center border-b border-gray-100">
            <h2 className="text-xl font-black tracking-tight">{t.applications}</h2>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-300" size={16} />
              <input type="text" placeholder={t.search}
                className="pl-9 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none focus:border-gray-400 w-64 transition-colors" />
            </div>
          </div>

          {/* Table */}
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid #f5f5f5" }}>
                {[t.id, t.region, t.amount, t.score, ""].map((h, i) => (
                  <th key={i} className="px-8 py-3 text-left text-xs font-black uppercase tracking-widest text-gray-300">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {apps.map((app, i) => {
                const score = Math.round(app['target_efficiency'] || 0);
                const isHigh = score > 70;
                return (
                  <tr key={i} onClick={() => handleAnalyze(app)}
                    style={{ borderBottom: "1px solid #fafafa", cursor: "pointer" }}
                    className="hover:bg-gray-50 transition-colors group">
                    <td className="px-8 py-4 font-mono text-xs text-gray-300">#{app['№ п/п'] || i + 1}</td>
                    <td className="px-8 py-4">
                      <div className="font-semibold text-sm text-gray-900">{app['Область']}</div>
                      <div className="text-xs text-gray-400 uppercase tracking-wider mt-0.5">{app['Район хозяйства']}</div>
                    </td>
                    <td className="px-8 py-4 font-bold text-sm text-gray-700">
                      {new Intl.NumberFormat('ru-RU').format(app['Причитающая сумма'] || 0)}
                      <span className="text-gray-300 font-normal ml-1">₸</span>
                    </td>
                    <td className="px-8 py-4">
                      <span className="px-3 py-1.5 rounded-full text-xs font-black"
                        style={{ background: isHigh ? "#B6FF00" : "#f3f4f6", color: isHigh ? "#000" : "#9ca3af" }}>
                        {score}
                      </span>
                    </td>
                    <td className="px-8 py-4 text-right">
                      <div className="inline-flex p-2 rounded-xl bg-gray-100 group-hover:bg-gray-200 transition-colors">
                        <ChevronRight size={16} className="text-gray-400" />
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </main>

      {/* ── MODAL ──────────────────────────────────────────────── */}
      <AnimatePresence>
        {selected && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop */}
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={closeModal}
              style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.85)", backdropFilter: "blur(8px)" }} />

            {/* Card */}
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 24 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 24 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              style={{
                position: "relative", zIndex: 10, width: "100%", maxWidth: "520px",
                background: "white", borderRadius: "24px", overflow: "hidden",
                boxShadow: "0 40px 80px rgba(0,0,0,0.35)",
                maxHeight: "90vh", overflowY: "auto"
              }}
            >

              {/* Loading */}
              {loading && (
                <div className="py-32 flex flex-col items-center gap-6">
                  <div className="w-14 h-14 rounded-full border-4 animate-spin"
                    style={{ borderColor: "#B6FF00", borderTopColor: "black" }} />
                  <p className="font-black text-sm uppercase tracking-widest text-gray-400">{t.analyze}</p>
                </div>
              )}

              {/* Content */}
              {!loading && analysis && (
                <>
                  {/* ── EXEC SUMMARY HEADER ── */}
                  <div style={{ background: verdict.headerBg, padding: "32px" }}>
                    <div className="flex justify-between items-start mb-5">
                      <div className="flex items-center gap-3">
                        <VIcon size={28} className={verdict.textClass} />
                        <span className={cn("text-2xl font-black tracking-tight uppercase", verdict.textClass)}>
                          {localVerdict}
                        </span>
                      </div>
                      <button onClick={closeModal}
                        className="p-2 rounded-xl hover:opacity-70 transition-opacity"
                        style={{ background: "rgba(0,0,0,0.1)" }}>
                        <XCircle size={20} className={verdict.textClass} />
                      </button>
                    </div>

                    {/* Score + Explanation */}
                    <div className="flex items-center gap-5">
                      {/* Score circle */}
                      <div style={{ position: "relative", width: "88px", height: "88px", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <svg width="88" height="88" style={{ transform: "rotate(-90deg)", position: "absolute" }}>
                          <circle cx="44" cy="44" r="38" stroke="rgba(0,0,0,0.15)" strokeWidth="9" fill="none" />
                          <circle cx="44" cy="44" r="38" stroke="black" strokeWidth="9" fill="none"
                            strokeLinecap="round"
                            strokeDasharray={2 * Math.PI * 38}
                            strokeDashoffset={2 * Math.PI * 38 * (1 - analysis.score / 100)}
                            style={{ transition: "stroke-dashoffset 1s ease" }} />
                        </svg>
                        <span className={cn("font-black text-3xl italic relative", verdict.textClass)}>
                          {Math.round(analysis.score)}
                        </span>
                      </div>
                      <p className={cn("text-sm font-semibold leading-relaxed", verdict.textClass)} style={{ flex: 1 }}>
                        {analysis.explanation}
                      </p>
                    </div>
                  </div>

                  {/* Inspection banner */}
                  {analysis.fraud?.requires_field_inspection && (
                    <div style={{ background: "#7f1d1d", padding: "12px 32px" }} className="flex items-center gap-3">
                      <AlertTriangle size={16} className="text-red-300 flex-shrink-0" />
                      <p className="text-xs font-semibold text-red-200 leading-tight">{analysis.fraud.inspection_reason_ru}</p>
                    </div>
                  )}

                  {/* ── SPECIALIST TOGGLE ── */}
                  <button onClick={() => setShowDetails(d => !d)}
                    className="w-full flex items-center justify-between px-8 py-4 text-xs font-black uppercase tracking-widest text-gray-400 hover:bg-gray-50 transition-colors border-t border-gray-100">
                    <span>{t.specialistDetails}</span>
                    {showDetails ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                  </button>

                  {/* ── DETAILS (collapsible) ── */}
                  <AnimatePresence>
                    {showDetails && (
                      <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }} style={{ overflow: "hidden" }}>
                        <div className="px-8 pb-8 space-y-6 border-t border-gray-50">

                          {/* Gov Verification */}
                          <div className="pt-5">
                            <p className="text-xs font-black uppercase tracking-widest text-gray-300 flex items-center gap-2 mb-3">
                              <ClipboardCheck size={12} /> {t.verificationTitle}
                            </p>
                            <div className="space-y-1.5">
                              {analysis.verification?.fields?.map((f: any, i: number) => (
                                <div key={i} className="px-4 py-3 rounded-xl text-xs"
                                  style={{
                                    background: f.status === 'VERIFIED' ? "#f0fdf4" : "#fef2f2",
                                    border: `1px solid ${f.status === 'VERIFIED' ? "#bbf7d0" : "#fecaca"}`
                                  }}>
                                  <div className="flex items-start justify-between gap-3">
                                    <div className="flex items-start gap-2">
                                      {f.status === 'VERIFIED'
                                        ? <BadgeCheck size={14} className="text-green-600 mt-0.5 flex-shrink-0" />
                                        : <AlertCircle size={14} className="text-red-500 mt-0.5 flex-shrink-0" />}
                                      <div>
                                        <span className="font-bold">{lang === 'RU' ? f.label_ru : f.label_kz}</span>
                                        <p className="mt-0.5 font-normal" style={{ color: f.status === 'VERIFIED' ? "#166534" : "#991b1b" }}>
                                          {lang === 'RU' ? f.detail_ru : f.detail_kz}
                                        </p>
                                      </div>
                                    </div>
                                    <span className="font-black text-xs px-2 py-0.5 rounded-full flex-shrink-0"
                                      style={{ background: f.status === 'VERIFIED' ? "#16a34a" : "#dc2626", color: "white" }}>
                                      {f.source}
                                    </span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>

                          {/* Anti-fraud flags */}
                          <div>
                            <p className="text-xs font-black uppercase tracking-widest text-gray-300 flex items-center gap-2 mb-3">
                              <Shield size={12} /> {t.fraudTitle}
                              {analysis.fraud?.ml_anomaly_score !== undefined && (
                                <span className="ml-auto font-mono text-gray-400 normal-case tracking-normal text-xs">
                                  ML аномалия: {analysis.fraud.ml_anomaly_score.toFixed(3)}
                                </span>
                              )}
                            </p>
                            {!analysis.fraud?.flags?.length ? (
                              <div className="flex items-center gap-2 px-4 py-3 rounded-xl text-xs"
                                style={{ background: "#f0fdf4", border: "1px solid #bbf7d0" }}>
                                <CheckCircle2 size={14} className="text-green-600" />
                                <span className="font-semibold text-green-700">{t.noFlags}</span>
                              </div>
                            ) : (
                              <div className="space-y-1.5">
                                {analysis.fraud?.flags?.map((f: any, i: number) => {
                                  const bg = f.severity === 'HIGH' ? "#fef2f2" : f.severity === 'ML_ANOMALY' ? "#faf5ff" : "#fffbeb";
                                  const bo = f.severity === 'HIGH' ? "#fecaca" : f.severity === 'ML_ANOMALY' ? "#e9d5ff" : "#fde68a";
                                  return (
                                    <div key={i} className="px-4 py-3 rounded-xl text-xs"
                                      style={{ background: bg, border: `1px solid ${bo}` }}>
                                      <p className="font-semibold">{lang === 'RU' ? f.description_ru : f.description_kz}</p>
                                      <p className="text-gray-400 mt-0.5 font-mono" style={{ fontSize: "10px" }}>{f.rule_reference}</p>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>

                          {/* SHAP */}
                          <div>
                            <p className="text-xs font-black uppercase tracking-widest text-gray-300 flex items-center gap-2 mb-3">
                              <Cpu size={12} /> {t.techMetrics}
                            </p>
                            <div className="space-y-1.5">
                              {analysis.top_features?.map((f: any, i: number) => (
                                <div key={i} className="flex justify-between items-center px-4 py-3 rounded-xl text-xs"
                                  style={{ background: "#f9fafb", border: "1px solid #f3f4f6" }}>
                                  <span className="font-semibold">{f.display.split(':')[0]}</span>
                                  <span className="font-black" style={{ color: f.contribution > 0 ? "#16a34a" : "#dc2626" }}>
                                    {f.display.split(':')[1]}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>

                          {/* Status row */}
                          <div className="flex gap-3">
                            <div className="flex-1 px-4 py-4 rounded-2xl flex items-center gap-3 text-xs"
                              style={{
                                background: analysis.fraud?.requires_field_inspection ? "#fef2f2" : "#f9fafb",
                                border: `1px solid ${analysis.fraud?.requires_field_inspection ? "#fecaca" : "#f3f4f6"}`
                              }}>
                              <Shield size={18} style={{ color: analysis.fraud?.requires_field_inspection ? "#dc2626" : "#9ca3af" }} />
                              <div>
                                <div className="font-black uppercase tracking-widest text-gray-400" style={{ fontSize: "9px" }}>Риск</div>
                                <div className="font-black" style={{ color: analysis.fraud?.requires_field_inspection ? "#dc2626" : "#111" }}>
                                  {i18n[lang].riskLevels[analysis.risk_level as keyof typeof i18n.RU.riskLevels]}
                                </div>
                              </div>
                            </div>
                            <div className="flex-1 px-4 py-4 rounded-2xl flex items-center gap-3 text-xs"
                              style={{ background: "#111", border: "1px solid #222" }}>
                              <TrendingUp size={18} style={{ color: "#B6FF00" }} />
                              <div>
                                <div className="font-black uppercase tracking-widest text-gray-600" style={{ fontSize: "9px" }}>Z-Статус</div>
                                <div className="font-black" style={{ color: analysis.z_score > 2 ? "#f87171" : "#B6FF00" }}>
                                  {analysis.z_score > 2 ? t.zStatus.Risk : (analysis.z_score > 1.5 ? t.zStatus.Warning : t.zStatus.Normal)}
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
