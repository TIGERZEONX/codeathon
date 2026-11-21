'use client';
import { useEffect, useRef, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation } from '@tanstack/react-query';
import { contestApi, proctorApi } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Spinner } from '@/components/ui/Spinner';
import {
  Clock,
  AlertTriangle,
  Star,
  Play,
  Check,
  X,
  ChevronLeft,
  ChevronRight,
  ShieldAlert,
  SendHorizontal,
  Code2,
  FileQuestion,
  Terminal,
} from 'lucide-react';

// ---- Types ----
interface McqOption { text: string }
interface TestCase { input: string; output: string; label?: string }
interface Question {
  _id: string;
  type: 'mcq' | 'coding';
  title: string;
  statement: string;
  marks: number;
  negativeMarks?: number;
  mcqOptions?: McqOption[];
  isMultiSelect?: boolean;
  sampleTestCases?: TestCase[];
}
interface Section { _id: string; title: string; questions: Question[] }
interface ProctorConfig {
  enabled?: boolean;
  blockTabSwitch?: boolean;
  blockCopyPaste?: boolean;
  enforceFullscreen?: boolean;
  blockRightClick?: boolean;
  maxViolations?: number;
}
interface AttemptState {
  _id: string;
  status: string;
  remainingSeconds: number;
  sections: Section[];
  contest?: { title?: string; proctorConfig?: ProctorConfig };
  startedAt?: string;
  submittedAt?: string;
}
interface AnswerState {
  selectedOptions?: number[];
  code?: string;
  language?: string;
}
interface RunResult {
  results?: { passed: boolean; label: string }[];
  error?: string;
}
interface CodeResult {
  verdict: string;
  passed: number;
  total: number;
  score: number;
}

// ---- Timer hook ----
function useTimer(initialSeconds: number, onExpire: () => void) {
  const [remaining, setRemaining] = useState(initialSeconds);
  const expiredRef = useRef(false);

  useEffect(() => {
    if (initialSeconds > 0) setRemaining(initialSeconds);
  }, [initialSeconds]);

  useEffect(() => {
    if (remaining <= 0) {
      if (!expiredRef.current) { expiredRef.current = true; onExpire(); }
      return;
    }
    const t = setTimeout(() => setRemaining((r) => r - 1), 1000);
    return () => clearTimeout(t);
  }, [remaining, onExpire]);

  const fmt = (s: number) => {
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    return `${h > 0 ? String(h).padStart(2, '0') + ':' : ''}${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  };

  return { remaining, display: fmt(remaining) };
}

// ---- MCQ Option Row ----
function McqOptionRow({
  option, index, selected, multi, onChange,
}: {
  option: McqOption; index: number; selected: boolean; multi: boolean;
  onChange: (i: number, checked: boolean) => void;
}) {
  const letter = String.fromCharCode(65 + index);
  return (
    <label
      className={`flex items-start gap-3.5 p-4 rounded-2xl border cursor-pointer transition-all ${
        selected
          ? 'border-[#3760F8] bg-[#EEF2FF]/60 shadow-xs ring-1 ring-[#3760F8]/20'
          : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/50'
      }`}
    >
      <input
        type={multi ? 'checkbox' : 'radio'}
        className="mt-0.5 w-4 h-4 text-[#3760F8] accent-[#3760F8] rounded focus:ring-[#3760F8]"
        checked={selected}
        onChange={(e) => onChange(index, e.target.checked)}
      />
      <span className={`w-5 h-5 rounded-lg flex items-center justify-center text-xs font-bold ${selected ? 'bg-[#3760F8] text-white' : 'bg-slate-100 text-slate-500'}`}>
        {letter}
      </span>
      <span className="text-sm text-slate-800 flex-1 leading-relaxed font-normal">{option.text}</span>
    </label>
  );
}

const SUPPORTED_LANGUAGES = [
  { id: 71, name: 'Python 3', key: 'python' },
  { id: 63, name: 'JavaScript (Node.js)', key: 'javascript' },
  { id: 54, name: 'C++ (GCC)', key: 'cpp' },
  { id: 50, name: 'C (GCC)', key: 'c' },
  { id: 62, name: 'Java', key: 'java' },
];

export default function AttemptPage() {
  const { id: contestId } = useParams<{ id: string }>();
  const router = useRouter();

  const [activeSectionIdx, setActiveSectionIdx] = useState(0);
  const [activeQuestionIdx, setActiveQuestionIdx] = useState(0);
  const [answers, setAnswers] = useState<Record<string, AnswerState>>({});
  const [markedForReview, setMarkedForReview] = useState<Set<string>>(new Set());
  const [runResult, setRunResult] = useState<RunResult | null>(null);
  const [submitCodeResult, setSubmitCodeResult] = useState<CodeResult | null>(null);
  const [showSubmitConfirm, setShowSubmitConfirm] = useState(false);
  const [violationCount, setViolationCount] = useState(0);
  const [violationModal, setViolationModal] = useState(false);
  const [revokedModal, setRevokedModal] = useState(false);
  const [runningCode, setRunningCode] = useState(false);
  const [submittingCode, setSubmittingCode] = useState(false);
  const autoSaveRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Fetch attempt state
  const { data: stateData, isLoading } = useQuery({
    queryKey: ['attempt-state', contestId],
    queryFn: () => contestApi.getAttemptState(contestId),
    refetchInterval: 60000,
  });

  const attempt = stateData as AttemptState | null;
  const sections: Section[] = attempt?.sections || [];
  const remainingSeconds = attempt?.remainingSeconds || 0;

  const activeSection = sections[activeSectionIdx];
  const activeQuestion = activeSection?.questions?.[activeQuestionIdx];
  const qId = activeQuestion?._id;
  const currentAnswer = qId ? answers[qId] : undefined;

  // Finish / auto-submit
  const finishMutation = useMutation({
    mutationFn: () => contestApi.finishAttempt(contestId),
    onSuccess: () => router.push(`/contest/${contestId}/results`),
  });

  const handleExpire = useCallback(() => {
    finishMutation.mutate();
  }, []); // eslint-disable-line

  const { display: timerDisplay, remaining } = useTimer(remainingSeconds, handleExpire);

  // Auto-save every 30s
  useEffect(() => {
    autoSaveRef.current = setInterval(() => {
      Object.entries(answers).forEach(([questionId, ans]) => {
        if (ans.selectedOptions !== undefined) {
          contestApi
            .saveAnswer(contestId, { questionId, selectedOptions: ans.selectedOptions.map(String) })
            .catch(() => {});
        }
        if (ans.code !== undefined) {
          contestApi
            .saveAnswer(contestId, { questionId, draftCode: ans.code, language: ans.language })
            .catch(() => {});
        }
      });
    }, 30000);
    return () => { if (autoSaveRef.current) clearInterval(autoSaveRef.current); };
  }, [answers, contestId]);

  // Proctoring
  const logViolation = useCallback(
    async (type: string) => {
      try {
        await proctorApi.logEvent({ contestId, attemptId: attempt?._id || '', type });
        setViolationCount((c) => c + 1);
        setViolationModal(true);
      } catch {}
    },
    [contestId, attempt]
  );

  useEffect(() => {
    const cfg = attempt?.contest?.proctorConfig;
    if (!cfg?.enabled) return;

    const onVisibility = () => { if (document.hidden && cfg.blockTabSwitch) logViolation('tab_switch'); };
    const onCopy = (e: ClipboardEvent) => { if (cfg.blockCopyPaste) { e.preventDefault(); logViolation('copy'); } };
    const onPaste = (e: ClipboardEvent) => { if (cfg.blockCopyPaste) { e.preventDefault(); logViolation('paste'); } };
    const onContext = (e: MouseEvent) => { if (cfg.blockRightClick) { e.preventDefault(); logViolation('right_click'); } };
    const onFullscreen = () => { if (!document.fullscreenElement && cfg.enforceFullscreen) logViolation('fullscreen_exit'); };

    document.addEventListener('visibilitychange', onVisibility);
    document.addEventListener('copy', onCopy as EventListener);
    document.addEventListener('paste', onPaste as EventListener);
    document.addEventListener('contextmenu', onContext as EventListener);
    document.addEventListener('fullscreenchange', onFullscreen);

    if (cfg.enforceFullscreen && !document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    }

    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      document.removeEventListener('copy', onCopy as EventListener);
      document.removeEventListener('paste', onPaste as EventListener);
      document.removeEventListener('contextmenu', onContext as EventListener);
      document.removeEventListener('fullscreenchange', onFullscreen);
    };
  }, [attempt, logViolation]);

  // MCQ change
  const handleMcqChange = useCallback(
    (questionId: string, optIdx: number, checked: boolean, multi: boolean) => {
      setAnswers((prev) => {
        const cur = prev[questionId]?.selectedOptions || [];
        const next = multi
          ? checked ? [...cur, optIdx] : cur.filter((o) => o !== optIdx)
          : [optIdx];
        contestApi
          .saveAnswer(contestId, { questionId, selectedOptions: next.map(String) })
          .catch(() => {});
        return { ...prev, [questionId]: { ...prev[questionId], selectedOptions: next } };
      });
    },
    [contestId]
  );

  // Code change
  const handleCodeChange = useCallback((questionId: string, code: string) => {
    setAnswers((prev) => ({ ...prev, [questionId]: { ...prev[questionId], code } }));
  }, []);

  const handleLanguageChange = useCallback((questionId: string, language: string) => {
    setAnswers((prev) => ({ ...prev, [questionId]: { ...prev[questionId], language } }));
  }, []);

  // Run code
  const handleRunCode = async (questionId: string) => {
    const ans = answers[questionId];
    if (!ans?.code) return;
    setRunningCode(true);
    setRunResult(null);
    try {
      const res = await contestApi.runCode(contestId, {
        questionId,
        code: ans.code,
        language: ans.language || 'python',
      });
      setRunResult(res as RunResult);
    } catch (err) {
      const e = err as { response?: { data?: { message?: string } } };
      setRunResult({ error: e?.response?.data?.message || 'Code execution failed' });
    } finally {
      setRunningCode(false);
    }
  };

  // Submit code
  const handleSubmitCode = async (questionId: string) => {
    const ans = answers[questionId];
    if (!ans?.code) return;
    setSubmittingCode(true);
    setSubmitCodeResult(null);
    try {
      const res = await contestApi.submitCode(contestId, {
        questionId,
        code: ans.code,
        language: ans.language || 'python',
      });
      setSubmitCodeResult(res as CodeResult);
    } catch (err) {
      const e = err as { response?: { data?: { message?: string } } };
      setSubmitCodeResult({ verdict: e?.response?.data?.message || 'Error', passed: 0, total: 0, score: 0 });
    } finally {
      setSubmittingCode(false);
    }
  };

  // Final submit
  const handleFinalSubmit = () => {
    setShowSubmitConfirm(false);
    finishMutation.mutate();
  };

  const navigatePrev = () => {
    if (activeQuestionIdx > 0) {
      setActiveQuestionIdx((q) => q - 1);
    } else if (activeSectionIdx > 0) {
      const prevSectionIdx = activeSectionIdx - 1;
      setActiveSectionIdx(prevSectionIdx);
      setActiveQuestionIdx((sections[prevSectionIdx]?.questions.length || 1) - 1);
    }
    setRunResult(null);
    setSubmitCodeResult(null);
  };

  const navigateNext = () => {
    if (activeQuestionIdx < (activeSection?.questions.length || 1) - 1) {
      setActiveQuestionIdx((q) => q + 1);
    } else if (activeSectionIdx < sections.length - 1) {
      setActiveSectionIdx((s) => s + 1);
      setActiveQuestionIdx(0);
    }
    setRunResult(null);
    setSubmitCodeResult(null);
  };

  if (isLoading) {
    return (
      <div className="h-screen flex items-center justify-center bg-slate-50">
        <Spinner size="lg" />
      </div>
    );
  }

  if (!attempt) {
    return (
      <div className="h-screen flex items-center justify-center text-slate-500 font-sans">
        Attempt session expired.{' '}
        <button className="ml-2 text-[#3760F8] underline font-medium" onClick={() => router.push('/dashboard')}>
          Return to Dashboard
        </button>
      </div>
    );
  }

  const isAtEnd =
    activeSectionIdx === sections.length - 1 &&
    activeQuestionIdx === (activeSection?.questions.length || 1) - 1;

  const isAtStart = activeSectionIdx === 0 && activeQuestionIdx === 0;

  return (
    <div className="h-screen flex flex-col bg-slate-100 font-sans overflow-hidden">
      {/* Top Bar with Timer and Finish */}
      <header className="bg-white border-b border-slate-200/80 flex items-center justify-between px-5 py-2.5 flex-shrink-0 z-20 shadow-2xs">
        <div className="flex items-center gap-3">
          <span className="font-bold text-slate-900 text-sm tracking-tight truncate max-w-xs sm:max-w-md">
            {attempt.contest?.title || 'Contest'}
          </span>
          {violationCount > 0 && (
            <Badge color="red" dot>
              {violationCount} {violationCount === 1 ? 'violation' : 'violations'}
            </Badge>
          )}
        </div>

        {/* Server Authoritative Timer */}
        <div
          className={`flex items-center gap-2 font-mono text-sm sm:text-base font-bold px-4 py-1.5 rounded-xl border transition-all ${
            remaining < 300
              ? 'bg-rose-50 border-rose-200 text-rose-700 animate-pulse'
              : 'bg-[#0B0F19] text-[#D3FE4F] border-[#1E293B] shadow-xs'
          }`}
        >
          <Clock className="w-4 h-4 text-slate-400" />
          <span>{timerDisplay}</span>
        </div>

        <Button variant="danger" size="sm" onClick={() => setShowSubmitConfirm(true)}>
          Submit Assessment
        </Button>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Left Section and Questions Navigator */}
        <aside className="w-64 bg-white border-r border-slate-200/80 overflow-y-auto flex-shrink-0 flex flex-col shadow-2xs">
          <div className="p-3 border-b border-slate-100 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
            Sections &amp; Questions
          </div>
          <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
            {sections.map((section, si) => (
              <div key={section._id}>
                <button
                  className={`w-full text-left px-4 py-2 text-xs font-semibold uppercase tracking-wider transition-colors ${
                    si === activeSectionIdx
                      ? 'bg-[#EEF2FF] text-[#3760F8] border-l-3 border-[#3760F8]'
                      : 'bg-slate-50/70 text-slate-600 hover:bg-slate-100'
                  }`}
                  onClick={() => {
                    setActiveSectionIdx(si);
                    setActiveQuestionIdx(0);
                    setRunResult(null);
                    setSubmitCodeResult(null);
                  }}
                >
                  {section.title}
                </button>
                {si === activeSectionIdx &&
                  section.questions.map((q, qi) => {
                    const answered =
                      (answers[q._id]?.selectedOptions?.length ?? 0) > 0 ||
                      (answers[q._id]?.code?.trim().length ?? 0) > 0;
                    const reviewed = markedForReview.has(q._id);
                    return (
                      <button
                        key={q._id}
                        className={`w-full flex items-center gap-2.5 px-4 py-2.5 text-xs transition-colors ${
                          qi === activeQuestionIdx
                            ? 'bg-[#3760F8]/5 font-semibold text-[#3760F8]'
                            : 'hover:bg-slate-50 text-slate-700'
                        }`}
                        onClick={() => {
                          setActiveQuestionIdx(qi);
                          setRunResult(null);
                          setSubmitCodeResult(null);
                        }}
                      >
                        <span
                          className={`w-5 h-5 flex items-center justify-center rounded-lg text-[10px] font-bold flex-shrink-0 ${
                            answered
                              ? 'bg-emerald-500 text-white shadow-2xs'
                              : reviewed
                              ? 'bg-amber-400 text-slate-900 shadow-2xs'
                              : 'bg-slate-200 text-slate-600'
                          }`}
                        >
                          {qi + 1}
                        </span>
                        <span className="truncate flex-1 text-left">
                          {q.title || `Problem ${qi + 1}`}
                        </span>
                        <Badge color={q.type === 'coding' ? 'purple' : 'primary'}>
                          {q.type === 'coding' ? 'Code' : 'MCQ'}
                        </Badge>
                      </button>
                    );
                  })}
              </div>
            ))}
          </div>
        </aside>

        {/* Main Exam Canvas */}
        <main className="flex-1 overflow-y-auto bg-slate-50">
          {activeQuestion ? (
            <div className="p-6 sm:p-8 space-y-5 max-w-4xl mx-auto">
              {/* Question Header */}
              <div className="flex items-start justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
                <div>
                  <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                    <span className="text-xs font-semibold text-slate-400">
                      Question {activeQuestionIdx + 1} of {activeSection?.questions.length}
                    </span>
                    <Badge color={activeQuestion.type === 'coding' ? 'purple' : 'primary'}>
                      {activeQuestion.type === 'coding' ? 'Coding Challenge' : 'Multiple Choice'}
                    </Badge>
                    <span className="text-xs font-semibold text-slate-700 bg-slate-100 px-2 py-0.5 rounded-full">
                      {activeQuestion.marks} Marks
                    </span>
                    {activeQuestion.negativeMarks ? (
                      <span className="text-xs font-semibold text-rose-600 bg-rose-50 px-2 py-0.5 rounded-full">
                        -{activeQuestion.negativeMarks} Penalty
                      </span>
                    ) : null}
                  </div>
                  <h2 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight">
                    {activeQuestion.title}
                  </h2>
                </div>
                <button
                  className={`flex-shrink-0 flex items-center gap-1.5 text-xs px-3.5 py-1.5 rounded-xl border transition-all ${
                    markedForReview.has(activeQuestion._id)
                      ? 'bg-amber-50 border-amber-300 text-amber-800 font-semibold shadow-xs'
                      : 'border-slate-200 text-slate-500 hover:bg-slate-50'
                  }`}
                  onClick={() =>
                    setMarkedForReview((s) => {
                      const n = new Set(s);
                      n.has(activeQuestion._id) ? n.delete(activeQuestion._id) : n.add(activeQuestion._id);
                      return n;
                    })
                  }
                >
                  <Star className={`w-3.5 h-3.5 ${markedForReview.has(activeQuestion._id) ? 'fill-amber-400 text-amber-500' : 'text-slate-400'}`} />
                  <span>{markedForReview.has(activeQuestion._id) ? 'Review Marked' : 'Mark for Review'}</span>
                </button>
              </div>

              {/* Problem Statement */}
              <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-xs">
                <p className="text-slate-800 text-sm leading-relaxed whitespace-pre-wrap font-normal">
                  {activeQuestion.statement}
                </p>
              </div>

              {/* MCQ Options */}
              {activeQuestion.type === 'mcq' && activeQuestion.mcqOptions && (
                <div className="space-y-3">
                  {activeQuestion.isMultiSelect && (
                    <p className="text-xs text-[#3760F8] font-semibold tracking-tight">
                      Multiple answers allowed. Select all options that apply:
                    </p>
                  )}
                  {activeQuestion.mcqOptions.map((opt, oi) => (
                    <McqOptionRow
                      key={oi}
                      option={opt}
                      index={oi}
                      multi={!!activeQuestion.isMultiSelect}
                      selected={currentAnswer?.selectedOptions?.includes(oi) ?? false}
                      onChange={(idx, checked) =>
                        handleMcqChange(activeQuestion._id, idx, checked, !!activeQuestion.isMultiSelect)
                      }
                    />
                  ))}
                </div>
              )}

              {/* Coding Question Arena */}
              {activeQuestion.type === 'coding' && (
                <div className="space-y-4">
                  {/* Language Selector Bar */}
                  <div className="flex items-center justify-between bg-white px-4 py-2.5 rounded-2xl border border-slate-200/80 shadow-xs">
                    <div className="flex items-center gap-2 text-xs font-semibold text-slate-700">
                      <Code2 className="w-4 h-4 text-[#3760F8]" />
                      <span>Select Environment:</span>
                    </div>
                    <select
                      className="border border-slate-200 bg-slate-50 rounded-xl px-3 py-1.5 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#3760F8]/30"
                      value={currentAnswer?.language || 'python'}
                      onChange={(e) => handleLanguageChange(activeQuestion._id, e.target.value)}
                    >
                      {SUPPORTED_LANGUAGES.map((lang) => (
                        <option key={lang.id} value={lang.key}>
                          {lang.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Code Editor Container */}
                  <div className="rounded-2xl border border-slate-800 overflow-hidden shadow-lg bg-[#0B0F19]">
                    <div className="bg-[#111827] px-4 py-2.5 flex items-center justify-between border-b border-slate-800">
                      <div className="flex items-center gap-2">
                        <span className="w-3 h-3 rounded-full bg-rose-500/80" />
                        <span className="w-3 h-3 rounded-full bg-amber-500/80" />
                        <span className="w-3 h-3 rounded-full bg-emerald-500/80" />
                        <span className="text-slate-400 text-xs font-mono ml-2 font-medium">solution.{currentAnswer?.language === 'javascript' ? 'js' : currentAnswer?.language === 'cpp' ? 'cpp' : 'py'}</span>
                      </div>
                      <span className="text-[11px] font-semibold text-[#D3FE4F] bg-white/5 px-2.5 py-0.5 rounded-full">
                        Auto-Save Active
                      </span>
                    </div>
                    <textarea
                      className="w-full h-80 bg-[#0B0F19] text-[#D3FE4F] font-mono text-sm p-4 resize-none focus:outline-none selection:bg-[#3760F8] selection:text-white leading-relaxed"
                      placeholder="# Write your clean solution here..."
                      value={currentAnswer?.code || ''}
                      onChange={(e) => handleCodeChange(activeQuestion._id, e.target.value)}
                      spellCheck={false}
                    />
                  </div>

                  {/* Execution Action Buttons */}
                  <div className="flex items-center gap-3">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleRunCode(activeQuestion._id)}
                      loading={runningCode}
                      leftIcon={<Play className="w-3.5 h-3.5 text-[#3760F8] fill-[#3760F8]" />}
                    >
                      Run Sample Tests
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => handleSubmitCode(activeQuestion._id)}
                      loading={submittingCode}
                      leftIcon={<SendHorizontal className="w-3.5 h-3.5 text-white" />}
                    >
                      Submit Solution
                    </Button>
                  </div>

                  {/* Sample Run Output */}
                  {runResult && (
                    <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs space-y-3">
                      <div className="flex items-center gap-2 text-slate-800 text-xs font-semibold uppercase tracking-wider">
                        <Terminal className="w-4 h-4 text-[#3760F8]" />
                        <span>Sample Test Results</span>
                      </div>
                      {runResult.error && (
                        <p className="text-rose-600 text-xs font-mono bg-rose-50 p-3 rounded-xl border border-rose-200">
                          {runResult.error}
                        </p>
                      )}
                      {runResult.results && (
                        <div className="space-y-2">
                          {runResult.results.map((r, ri) => (
                            <div
                              key={ri}
                              className={`flex items-center gap-2.5 p-3 rounded-xl text-xs font-medium border ${
                                r.passed ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : 'bg-rose-50 text-rose-800 border-rose-200'
                              }`}
                            >
                              {r.passed ? (
                                <Check className="w-4 h-4 text-emerald-600" />
                              ) : (
                                <X className="w-4 h-4 text-rose-600" />
                              )}
                              <span>{r.label || `Case ${ri + 1}`}</span>
                              <span className="ml-auto font-bold">{r.passed ? 'PASSED' : 'FAILED'}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Submission Evaluation Verdict */}
                  {submitCodeResult && (
                    <div
                      className={`rounded-2xl border p-5 shadow-xs ${
                        submitCodeResult.verdict === 'Accepted'
                          ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                          : 'bg-rose-50 border-rose-200 text-rose-900'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <span className="text-base font-bold tracking-tight">
                            {submitCodeResult.verdict}
                          </span>
                          <span className="text-xs text-slate-600">
                            {submitCodeResult.passed}/{submitCodeResult.total} test cases passed
                          </span>
                        </div>
                        <span className="text-sm font-extrabold text-[#3760F8] bg-white px-3 py-1 rounded-xl shadow-2xs">
                          +{submitCodeResult.score} pts
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Sample Test Cases Display */}
                  {activeQuestion.sampleTestCases && activeQuestion.sampleTestCases.length > 0 && (
                    <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs space-y-3">
                      <div className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                        Sample Input &amp; Output
                      </div>
                      {activeQuestion.sampleTestCases.map((tc, ti) => (
                        <div key={ti} className="grid sm:grid-cols-2 gap-3 text-xs font-mono">
                          <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3">
                            <span className="text-[10px] font-semibold text-slate-400 block mb-1">
                              Input ({tc.label || `Case ${ti + 1}`})
                            </span>
                            <pre className="text-slate-800 whitespace-pre-wrap">{tc.input}</pre>
                          </div>
                          <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3">
                            <span className="text-[10px] font-semibold text-slate-400 block mb-1">
                              Expected Output
                            </span>
                            <pre className="text-slate-800 whitespace-pre-wrap">{tc.output}</pre>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Navigation Toolbar */}
              <div className="flex justify-between items-center pt-4 border-t border-slate-200">
                <Button variant="outline" size="sm" disabled={isAtStart} onClick={navigatePrev} leftIcon={<ChevronLeft className="w-4 h-4" />}>
                  Previous
                </Button>
                {!isAtEnd ? (
                  <Button variant="outline" size="sm" onClick={navigateNext}>
                    <span>Next</span>
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                ) : (
                  <Button variant="danger" size="sm" onClick={() => setShowSubmitConfirm(true)}>
                    Final Submit
                  </Button>
                )}
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-slate-400 text-sm">
              <FileQuestion className="w-10 h-10 mb-2 opacity-40" />
              <span>Select a question from the navigation panel to view.</span>
            </div>
          )}
        </main>
      </div>

      {/* Confirmation & Alert Modals */}
      <ConfirmDialog
        open={showSubmitConfirm}
        onClose={() => setShowSubmitConfirm(false)}
        onConfirm={handleFinalSubmit}
        loading={finishMutation.isPending}
        title="Submit Assessment"
        message="Are you sure you want to finish and submit your contest? All your responses will be permanently locked."
        confirmLabel="Confirm Submission"
        danger
      />

      <Modal open={violationModal} onClose={() => setViolationModal(false)} title="Security Notification">
        <div className="space-y-4">
          <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 p-4 rounded-xl text-amber-900 text-sm">
            <ShieldAlert className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">Proctoring Anomaly Detected</p>
              <p className="text-xs text-amber-800 mt-1 leading-relaxed">
                A proctoring event was logged ({violationCount} recorded). Repeated violations may result in immediate auto-submission.
              </p>
            </div>
          </div>
          <div className="flex justify-end">
            <Button size="sm" onClick={() => setViolationModal(false)}>
              Acknowledge &amp; Resume
            </Button>
          </div>
        </div>
      </Modal>

      <Modal open={revokedModal} onClose={() => {}} title="Access Revoked">
        <div className="space-y-4">
          <p className="text-sm text-slate-600">
            Your attempt has been revoked by the test coordinator.
          </p>
          <div className="flex justify-end">
            <Button size="sm" onClick={() => router.push('/dashboard')}>
              Dashboard
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
