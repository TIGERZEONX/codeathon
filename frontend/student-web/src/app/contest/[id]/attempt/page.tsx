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

// ---- MCQ Option ----
function McqOptionRow({
  option, index, selected, multi, onChange,
}: {
  option: McqOption; index: number; selected: boolean; multi: boolean;
  onChange: (i: number, checked: boolean) => void;
}) {
  const letter = String.fromCharCode(65 + index);
  return (
    <label
      className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
        selected
          ? 'border-blue-500 bg-blue-50'
          : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
      }`}
    >
      <input
        type={multi ? 'checkbox' : 'radio'}
        className="mt-0.5 accent-blue-600"
        checked={selected}
        onChange={(e) => onChange(index, e.target.checked)}
      />
      <span className="text-sm font-medium text-gray-500 mt-0.5">{letter}.</span>
      <span className="text-sm text-gray-800 flex-1">{option.text}</span>
    </label>
  );
}

const SUPPORTED_LANGUAGES = [
  { id: 71, name: 'Python 3' },
  { id: 63, name: 'JavaScript (Node.js)' },
  { id: 54, name: 'C++ (GCC)' },
  { id: 50, name: 'C (GCC)' },
  { id: 62, name: 'Java' },
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
      setRunResult({ error: e?.response?.data?.message || 'Run failed' });
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
      <div className="h-screen flex items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  }

  if (!attempt) {
    return (
      <div className="h-screen flex items-center justify-center text-gray-500">
        Attempt not found. <button className="ml-2 text-blue-600 underline" onClick={() => router.push('/dashboard')}>Go to Dashboard</button>
      </div>
    );
  }

  const isAtEnd =
    activeSectionIdx === sections.length - 1 &&
    activeQuestionIdx === (activeSection?.questions.length || 1) - 1;

  const isAtStart = activeSectionIdx === 0 && activeQuestionIdx === 0;

  return (
    <div className="h-screen flex flex-col bg-gray-100 overflow-hidden">
      {/* Top bar */}
      <header className="bg-white border-b flex items-center justify-between px-4 py-2 flex-shrink-0 z-10">
        <div className="flex items-center gap-3">
          <span className="font-bold text-gray-900 text-sm truncate max-w-xs">
            {attempt.contest?.title || 'Contest'}
          </span>
          {violationCount > 0 && (
            <Badge color="red">{violationCount} violation{violationCount > 1 ? 's' : ''}</Badge>
          )}
        </div>
        <div
          className={`font-mono text-lg font-bold px-4 py-1 rounded-lg ${
            remaining < 300 ? 'bg-red-100 text-red-700' : 'bg-blue-50 text-blue-700'
          }`}
        >
          {timerDisplay}
        </div>
        <Button variant="danger" size="sm" onClick={() => setShowSubmitConfirm(true)}>
          Submit Test
        </Button>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Left sidebar */}
        <aside className="w-60 bg-white border-r overflow-y-auto flex-shrink-0">
          {sections.map((section, si) => (
            <div key={section._id}>
              <button
                className={`w-full text-left px-4 py-2 text-xs font-semibold uppercase tracking-wide transition-colors ${
                  si === activeSectionIdx
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
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
                      className={`w-full flex items-center gap-2 px-4 py-2 text-sm transition-colors ${
                        qi === activeQuestionIdx
                          ? 'bg-blue-50 border-l-2 border-blue-600'
                          : 'hover:bg-gray-50'
                      }`}
                      onClick={() => {
                        setActiveQuestionIdx(qi);
                        setRunResult(null);
                        setSubmitCodeResult(null);
                      }}
                    >
                      <span
                        className={`w-6 h-6 flex items-center justify-center rounded-full text-xs font-bold flex-shrink-0 ${
                          answered
                            ? 'bg-green-500 text-white'
                            : reviewed
                            ? 'bg-yellow-400 text-white'
                            : 'bg-gray-200 text-gray-700'
                        }`}
                      >
                        {qi + 1}
                      </span>
                      <span className="truncate text-gray-700 flex-1 text-left">
                        {q.title || `Q${qi + 1}`}
                      </span>
                      <Badge color={q.type === 'coding' ? 'purple' : 'blue'}>
                        {q.type === 'coding' ? 'Code' : 'MCQ'}
                      </Badge>
                    </button>
                  );
                })}
            </div>
          ))}
        </aside>

        {/* Main content */}
        <main className="flex-1 overflow-y-auto">
          {activeQuestion ? (
            <div className="p-6 space-y-4 max-w-4xl mx-auto">
              {/* Question header */}
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm text-gray-500">
                      Q{activeQuestionIdx + 1} of {activeSection?.questions.length}
                    </span>
                    <Badge color={activeQuestion.type === 'coding' ? 'purple' : 'blue'}>
                      {activeQuestion.type === 'coding' ? 'Coding' : 'MCQ'}
                    </Badge>
                    <span className="text-sm text-gray-500">{activeQuestion.marks} marks</span>
                    {activeQuestion.negativeMarks ? (
                      <span className="text-xs text-red-500">-{activeQuestion.negativeMarks} penalty</span>
                    ) : null}
                  </div>
                  <h2 className="text-base font-semibold text-gray-900">{activeQuestion.title}</h2>
                </div>
                <button
                  className={`flex-shrink-0 text-xs px-3 py-1 rounded-full border transition-colors ${
                    markedForReview.has(activeQuestion._id)
                      ? 'bg-yellow-100 border-yellow-400 text-yellow-700'
                      : 'border-gray-300 text-gray-500 hover:bg-gray-50'
                  }`}
                  onClick={() =>
                    setMarkedForReview((s) => {
                      const n = new Set(s);
                      n.has(activeQuestion._id) ? n.delete(activeQuestion._id) : n.add(activeQuestion._id);
                      return n;
                    })
                  }
                >
                  {markedForReview.has(activeQuestion._id) ? '★ Marked' : '☆ Mark for Review'}
                </button>
              </div>

              {/* Statement */}
              <div className="bg-white rounded-xl border border-gray-200 p-5">
                <p className="text-gray-800 text-sm whitespace-pre-wrap">{activeQuestion.statement}</p>
              </div>

              {/* MCQ Options */}
              {activeQuestion.type === 'mcq' && activeQuestion.mcqOptions && (
                <div className="space-y-2">
                  {activeQuestion.isMultiSelect && (
                    <p className="text-xs text-blue-600 font-medium">Select all that apply</p>
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

              {/* Coding Question */}
              {activeQuestion.type === 'coding' && (
                <div className="space-y-4">
                  {/* Language selector */}
                  <div className="flex items-center gap-3">
                    <label className="text-sm font-medium text-gray-700">Language:</label>
                    <select
                      className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      value={currentAnswer?.language || 'python'}
                      onChange={(e) => handleLanguageChange(activeQuestion._id, e.target.value)}
                    >
                      {SUPPORTED_LANGUAGES.map((lang) => (
                        <option key={lang.id} value={lang.name.toLowerCase().split(' ')[0]}>
                          {lang.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Code editor */}
                  <div className="border border-gray-300 rounded-xl overflow-hidden">
                    <div className="bg-gray-800 px-4 py-2 flex items-center gap-2">
                      <span className="w-3 h-3 rounded-full bg-red-400" />
                      <span className="w-3 h-3 rounded-full bg-yellow-400" />
                      <span className="w-3 h-3 rounded-full bg-green-400" />
                      <span className="text-gray-400 text-xs font-mono ml-2">Solution</span>
                    </div>
                    <textarea
                      className="w-full h-72 bg-gray-900 text-green-300 font-mono text-sm p-4 resize-none focus:outline-none"
                      placeholder="# Write your code here..."
                      value={currentAnswer?.code || ''}
                      onChange={(e) => handleCodeChange(activeQuestion._id, e.target.value)}
                      spellCheck={false}
                    />
                  </div>

                  {/* Action buttons */}
                  <div className="flex gap-3 flex-wrap">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleRunCode(activeQuestion._id)}
                      loading={runningCode}
                    >
                      ▶ Run (Sample Tests)
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => handleSubmitCode(activeQuestion._id)}
                      loading={submittingCode}
                    >
                      Submit Code
                    </Button>
                  </div>

                  {/* Run result */}
                  {runResult && (
                    <div className="bg-white rounded-xl border border-gray-200 p-4">
                      <h4 className="text-sm font-semibold text-gray-700 mb-3">
                        Run Results (Sample Cases)
                      </h4>
                      {runResult.error && (
                        <p className="text-red-600 text-sm font-mono">{runResult.error}</p>
                      )}
                      {runResult.results && (
                        <div className="space-y-2">
                          {runResult.results.map((r, ri) => (
                            <div
                              key={ri}
                              className={`flex items-center gap-3 p-2 rounded-lg text-sm ${
                                r.passed ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
                              }`}
                            >
                              <span>{r.passed ? '✓' : '✗'}</span>
                              <span>{r.label || `Case ${ri + 1}`}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Submit code result */}
                  {submitCodeResult && (
                    <div
                      className={`rounded-xl border p-4 ${
                        submitCodeResult.verdict === 'Accepted'
                          ? 'bg-green-50 border-green-200'
                          : 'bg-red-50 border-red-200'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <span
                          className={`text-lg font-bold ${
                            submitCodeResult.verdict === 'Accepted'
                              ? 'text-green-700'
                              : 'text-red-700'
                          }`}
                        >
                          {submitCodeResult.verdict}
                        </span>
                        <span className="text-sm text-gray-600">
                          {submitCodeResult.passed}/{submitCodeResult.total} tests passed
                        </span>
                        <span className="ml-auto font-semibold text-blue-600">
                          +{submitCodeResult.score} pts
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Sample test cases */}
                  {activeQuestion.sampleTestCases && activeQuestion.sampleTestCases.length > 0 && (
                    <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
                      <h4 className="text-sm font-semibold text-gray-700">Sample Test Cases</h4>
                      {activeQuestion.sampleTestCases.map((tc, ti) => (
                        <div key={ti} className="grid grid-cols-2 gap-3 text-xs font-mono">
                          <div>
                            <div className="text-gray-500 mb-1">Input {tc.label || ti + 1}</div>
                            <pre className="bg-gray-50 border rounded p-2 overflow-x-auto whitespace-pre-wrap">
                              {tc.input}
                            </pre>
                          </div>
                          <div>
                            <div className="text-gray-500 mb-1">Expected Output</div>
                            <pre className="bg-gray-50 border rounded p-2 overflow-x-auto whitespace-pre-wrap">
                              {tc.output}
                            </pre>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Navigation */}
              <div className="flex justify-between pt-4 border-t">
                <Button variant="outline" size="sm" disabled={isAtStart} onClick={navigatePrev}>
                  ← Previous
                </Button>
                {!isAtEnd ? (
                  <Button variant="outline" size="sm" onClick={navigateNext}>
                    Next →
                  </Button>
                ) : (
                  <Button variant="danger" size="sm" onClick={() => setShowSubmitConfirm(true)}>
                    Submit Test
                  </Button>
                )}
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center h-full text-gray-400 text-sm">
              Select a question from the sidebar.
            </div>
          )}
        </main>
      </div>

      {/* Modals */}
      <ConfirmDialog
        open={showSubmitConfirm}
        onClose={() => setShowSubmitConfirm(false)}
        onConfirm={handleFinalSubmit}
        loading={finishMutation.isPending}
        title="Submit Test"
        message="Are you sure you want to submit? This action cannot be undone and all your answers will be locked."
        confirmLabel="Submit Now"
        danger
      />

      <Modal open={violationModal} onClose={() => setViolationModal(false)} title="⚠️ Proctoring Violation">
        <p className="text-gray-700">
          A proctoring violation has been recorded ({violationCount} total). Further violations may
          result in automatic submission of your test.
        </p>
        <div className="mt-4 flex justify-end">
          <Button onClick={() => setViolationModal(false)}>Understood</Button>
        </div>
      </Modal>

      <Modal open={revokedModal} onClose={() => {}} title="Access Revoked">
        <p className="text-gray-700">
          Your attempt has been revoked by the administrator. Please contact your exam supervisor.
        </p>
        <div className="mt-4 flex justify-end">
          <Button onClick={() => router.push('/dashboard')}>Go to Dashboard</Button>
        </div>
      </Modal>
    </div>
  );
}
