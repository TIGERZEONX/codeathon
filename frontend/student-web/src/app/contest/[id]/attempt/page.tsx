'use client';
import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation } from '@tanstack/react-query';
import { contestApi, proctorApi } from '@/lib/api';
import { useAuthStore } from '@/store/authStore';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { Spinner } from '@/components/ui/Spinner';
import {
  Clock,
  AlertTriangle,
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
  RotateCcw,
  Bookmark,
  Eye,
  Info,
  Layers,
  HelpCircle,
  FileText,
} from 'lucide-react';

// ---- Types ----
interface McqOption {
  id?: string;
  text: string;
}

interface TestCase {
  id?: string;
  input: string;
  expectedOutput?: string;
  output?: string;
  explanation?: string;
}

interface Question {
  _id?: string;
  id?: string;
  sectionId?: string;
  type: 'mcq' | 'coding';
  title: string;
  statement: string;
  marks: number;
  negativeMarks?: number;
  order?: number;
  isMultiSelect?: boolean;
  mcqOptions?: McqOption[];
  codingConfig?: {
    inputFormat?: string;
    outputFormat?: string;
    constraints?: string;
    examples?: string;
    timeLimitMs?: number;
    memoryLimitMb?: number;
    allowedLanguages?: string[];
    starterCode?: Record<string, string>;
    sampleTestCases?: TestCase[];
    hiddenTestCasesCount?: number;
  };
}

interface Section {
  _id?: string;
  id?: string;
  title: string;
  order?: number;
  questions: Question[];
}

interface ProctorConfig {
  enabled?: boolean;
  blockTabSwitch?: boolean;
  blockCopyPaste?: boolean;
  enforceFullscreen?: boolean;
  blockRightClick?: boolean;
  maxViolations?: number;
}

interface AttemptState {
  _id?: string;
  id?: string;
  status: string;
  remainingSeconds: number;
  sections?: Section[];
  questions?: Question[];
  savedAnswers?: any[];
  contest?: {
    id?: string;
    title?: string;
    description?: string;
    instructions?: string;
    proctorConfig?: ProctorConfig;
  };
  startedAt?: string;
  submittedAt?: string;
}

interface AnswerState {
  selectedOptions?: string[]; // array of option ids or indices
  code?: string;
  language?: string;
}

interface RunResult {
  results?: { passed: boolean; label?: string; input?: string; expected?: string; actual?: string }[];
  error?: string;
}

interface CodeResult {
  verdict: string;
  passed: number;
  total: number;
  score: number;
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
  const { user } = useAuthStore();

  const [activeSectionIdx, setActiveSectionIdx] = useState(0);
  const [activeQuestionIdx, setActiveQuestionIdx] = useState(0);

  // JEE Question Tracking States
  // Map of questionId -> AnswerState
  const [answers, setAnswers] = useState<Record<string, AnswerState>>({});
  // Set of questionIds visited at least once
  const [visitedQuestions, setVisitedQuestions] = useState<Set<string>>(new Set());
  // Set of questionIds marked for review
  const [markedForReview, setMarkedForReview] = useState<Set<string>>(new Set());

  // Coding Runner States
  const [runResult, setRunResult] = useState<RunResult | null>(null);
  const [submitCodeResult, setSubmitCodeResult] = useState<CodeResult | null>(null);
  const [runningCode, setRunningCode] = useState(false);
  const [submittingCode, setSubmittingCode] = useState(false);
  const [customInput, setCustomInput] = useState('');
  const [showCustomInput, setShowCustomInput] = useState(false);

  // Modals
  const [showSubmitConfirm, setShowSubmitConfirm] = useState(false);
  const [showInstructionsModal, setShowInstructionsModal] = useState(false);
  const [showQuestionPaperModal, setShowQuestionPaperModal] = useState(false);
  const [violationCount, setViolationCount] = useState(0);
  const [violationModal, setViolationModal] = useState(false);

  const autoSaveRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Fetch Attempt State
  const { data: stateData, isLoading } = useQuery({
    queryKey: ['attempt-state', contestId],
    queryFn: () => contestApi.getAttemptState(contestId),
    refetchInterval: 60000,
    retry: 2,
  });

  const attempt = stateData as AttemptState | null;

  // Format sections and questions safely
  const sections: Section[] = useMemo(() => {
    if (!attempt) return [];
    if (attempt.sections && attempt.sections.length > 0) {
      return attempt.sections;
    }
    // Fallback if backend returned flat questions array
    if (attempt.questions && attempt.questions.length > 0) {
      const grouped: Record<string, Question[]> = {};
      attempt.questions.forEach((q) => {
        const secId = q.sectionId || 'default';
        if (!grouped[secId]) grouped[secId] = [];
        grouped[secId].push(q);
      });
      return Object.entries(grouped).map(([secId, qList], idx) => ({
        id: secId,
        _id: secId,
        title: `Section ${idx + 1}`,
        questions: qList,
      }));
    }
    return [];
  }, [attempt]);

  // Timer Setup
  const [remaining, setRemaining] = useState<number>(0);
  const expiredRef = useRef(false);

  useEffect(() => {
    if (attempt?.remainingSeconds && attempt.remainingSeconds > 0) {
      setRemaining(attempt.remainingSeconds);
    }
  }, [attempt?.remainingSeconds]);

  // Finish Attempt Mutation
  const finishMutation = useMutation({
    mutationFn: () => contestApi.finishAttempt(contestId),
    onSuccess: () => router.push(`/contest/${contestId}/results`),
  });

  const handleExpire = useCallback(() => {
    if (!expiredRef.current) {
      expiredRef.current = true;
      finishMutation.mutate();
    }
  }, [finishMutation]);

  useEffect(() => {
    if (remaining <= 0) return;
    const interval = setInterval(() => {
      setRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          handleExpire();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [remaining, handleExpire]);

  // Format Timer String (HH:MM:SS)
  const formatTimer = (secs: number) => {
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = secs % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  // Active Section & Question Pointers
  const activeSection = sections[activeSectionIdx] || sections[0];
  const currentQuestions = activeSection?.questions || [];
  const activeQuestion: Question | undefined = currentQuestions[activeQuestionIdx];
  const qId = activeQuestion?._id || activeQuestion?.id || '';

  // Mark current question as visited
  useEffect(() => {
    if (qId) {
      setVisitedQuestions((prev) => {
        if (!prev.has(qId)) {
          const next = new Set(prev);
          next.add(qId);
          return next;
        }
        return prev;
      });
    }
  }, [qId]);

  // Initialize saved answers from backend
  useEffect(() => {
    if (attempt?.savedAnswers && Array.isArray(attempt.savedAnswers) && Object.keys(answers).length === 0) {
      const initialAnswers: Record<string, AnswerState> = {};
      const initialReviews = new Set<string>();

      attempt.savedAnswers.forEach((sa) => {
        const id = sa.questionId || sa.question?._id || sa.question?.id;
        if (id) {
          initialAnswers[id] = {
            selectedOptions: sa.selectedOptions || [],
            code: sa.draftCode || sa.code || '',
            language: sa.language || 'python',
          };
          if (sa.isMarkedForReview) {
            initialReviews.add(id);
          }
        }
      });

      setAnswers(initialAnswers);
      setMarkedForReview(initialReviews);
    }
  }, [attempt?.savedAnswers, answers]);

  // Autosave answers every 30 seconds
  useEffect(() => {
    autoSaveRef.current = setInterval(() => {
      Object.entries(answers).forEach(([questionId, ans]) => {
        if (ans.selectedOptions && ans.selectedOptions.length > 0) {
          contestApi
            .saveAnswer(contestId, {
              questionId,
              selectedOptions: ans.selectedOptions,
              isMarkedForReview: markedForReview.has(questionId),
            })
            .catch(() => {});
        }
        if (ans.code) {
          contestApi
            .saveAnswer(contestId, {
              questionId,
              draftCode: ans.code,
              language: ans.language || 'python',
              isMarkedForReview: markedForReview.has(questionId),
            })
            .catch(() => {});
        }
      });
    }, 30000);
    return () => {
      if (autoSaveRef.current) clearInterval(autoSaveRef.current);
    };
  }, [answers, markedForReview, contestId]);

  // Anti-cheating Proctoring Listeners
  const logViolation = useCallback(
    async (type: string) => {
      try {
        await proctorApi.logEvent({ contestId, attemptId: attempt?._id || attempt?.id || '', type });
        setViolationCount((c) => c + 1);
        setViolationModal(true);
      } catch {}
    },
    [contestId, attempt]
  );

  useEffect(() => {
    const cfg = attempt?.contest?.proctorConfig;
    if (!cfg?.enabled) return;

    const onVisibility = () => {
      if (document.hidden && cfg.blockTabSwitch) logViolation('tab_switch');
    };
    const onCopy = (e: ClipboardEvent) => {
      if (cfg.blockCopyPaste) {
        e.preventDefault();
        logViolation('copy');
      }
    };
    const onPaste = (e: ClipboardEvent) => {
      if (cfg.blockCopyPaste) {
        e.preventDefault();
        logViolation('paste');
      }
    };
    const onContext = (e: MouseEvent) => {
      if (cfg.blockRightClick) {
        e.preventDefault();
        logViolation('right_click');
      }
    };
    const onFullscreen = () => {
      if (!document.fullscreenElement && cfg.enforceFullscreen) logViolation('fullscreen_exit');
    };

    document.addEventListener('visibilitychange', onVisibility);
    document.addEventListener('copy', onCopy as EventListener);
    document.addEventListener('paste', onPaste as EventListener);
    document.addEventListener('contextmenu', onContext as EventListener);
    document.addEventListener('fullscreenchange', onFullscreen);

    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      document.removeEventListener('copy', onCopy as EventListener);
      document.removeEventListener('paste', onPaste as EventListener);
      document.removeEventListener('contextmenu', onContext as EventListener);
      document.removeEventListener('fullscreenchange', onFullscreen);
    };
  }, [attempt, logViolation]);

  // Current Question Answer Helpers
  const currentAnswer = qId ? answers[qId] : undefined;

  const isQuestionAnswered = (questionId: string) => {
    const ans = answers[questionId];
    if (!ans) return false;
    if (ans.selectedOptions && ans.selectedOptions.length > 0) return true;
    if (ans.code && ans.code.trim().length > 0) return true;
    return false;
  };

  // JEE Question Palette Status Resolver
  // 1: answered (green)
  // 2: not_answered (red)
  // 3: not_visited (gray)
  // 4: marked_for_review (purple)
  // 5: answered_and_marked (purple with green dot)
  const getQuestionJeeStatus = (questionId: string) => {
    const isAnswered = isQuestionAnswered(questionId);
    const isMarked = markedForReview.has(questionId);
    const isVisited = visitedQuestions.has(questionId);

    if (isAnswered && isMarked) return 'answered_and_marked';
    if (isMarked) return 'marked_for_review';
    if (isAnswered) return 'answered';
    if (isVisited) return 'not_answered';
    return 'not_visited';
  };

  // Legend Statistics Breakdown for Current Section & Total
  const stats = useMemo(() => {
    let answered = 0;
    let notAnswered = 0;
    let notVisited = 0;
    let marked = 0;
    let answeredAndMarked = 0;

    currentQuestions.forEach((q) => {
      const id = q._id || q.id || '';
      const status = getQuestionJeeStatus(id);
      if (status === 'answered') answered++;
      else if (status === 'not_answered') notAnswered++;
      else if (status === 'not_visited') notVisited++;
      else if (status === 'marked_for_review') marked++;
      else if (status === 'answered_and_marked') answeredAndMarked++;
    });

    return { answered, notAnswered, notVisited, marked, answeredAndMarked };
  }, [currentQuestions, answers, markedForReview, visitedQuestions]);

  // Handle MCQ Selection
  const handleSelectOption = (optId: string) => {
    if (!qId) return;
    setAnswers((prev) => {
      const next = {
        ...prev,
        [qId]: {
          ...prev[qId],
          selectedOptions: [optId],
        },
      };
      // Auto persist immediately
      contestApi
        .saveAnswer(contestId, {
          questionId: qId,
          selectedOptions: [optId],
          isMarkedForReview: markedForReview.has(qId),
        })
        .catch(() => {});
      return next;
    });
  };

  // Clear Response
  const handleClearResponse = () => {
    if (!qId) return;
    setAnswers((prev) => {
      const next = { ...prev };
      delete next[qId];
      return next;
    });
    setMarkedForReview((prev) => {
      const next = new Set(prev);
      next.delete(qId);
      return next;
    });
    contestApi
      .saveAnswer(contestId, {
        questionId: qId,
        selectedOptions: [],
        draftCode: '',
        isMarkedForReview: false,
      })
      .catch(() => {});
  };

  // JEE Action Buttons:
  // 1. Save & Next:
  const handleSaveAndNext = () => {
    // Save current answer
    if (qId && currentAnswer) {
      contestApi
        .saveAnswer(contestId, {
          questionId: qId,
          selectedOptions: currentAnswer.selectedOptions || [],
          draftCode: currentAnswer.code || '',
          language: currentAnswer.language || 'python',
          isMarkedForReview: markedForReview.has(qId),
        })
        .catch(() => {});
    }
    // Remove marked for review if student explicitly clicked Save & Next
    if (qId && markedForReview.has(qId)) {
      setMarkedForReview((prev) => {
        const next = new Set(prev);
        next.delete(qId);
        return next;
      });
    }
    // Advance to next question
    navigateToNextQuestion();
  };

  // 2. Save & Mark for Review:
  const handleSaveAndMarkForReview = () => {
    if (qId) {
      setMarkedForReview((prev) => {
        const next = new Set(prev);
        next.add(qId);
        return next;
      });
      if (currentAnswer) {
        contestApi
          .saveAnswer(contestId, {
            questionId: qId,
            selectedOptions: currentAnswer.selectedOptions || [],
            draftCode: currentAnswer.code || '',
            language: currentAnswer.language || 'python',
            isMarkedForReview: true,
          })
          .catch(() => {});
      }
    }
    navigateToNextQuestion();
  };

  // 3. Mark for Review & Next (without saving an answer):
  const handleMarkForReviewAndNext = () => {
    if (qId) {
      setMarkedForReview((prev) => {
        const next = new Set(prev);
        next.add(qId);
        return next;
      });
      contestApi
        .saveAnswer(contestId, {
          questionId: qId,
          selectedOptions: currentAnswer?.selectedOptions || [],
          draftCode: currentAnswer?.code || '',
          isMarkedForReview: true,
        })
        .catch(() => {});
    }
    navigateToNextQuestion();
  };

  // Navigation Helpers
  const navigateToNextQuestion = () => {
    setRunResult(null);
    setSubmitCodeResult(null);
    if (activeQuestionIdx < currentQuestions.length - 1) {
      setActiveQuestionIdx((i) => i + 1);
    } else if (activeSectionIdx < sections.length - 1) {
      setActiveSectionIdx((s) => s + 1);
      setActiveQuestionIdx(0);
    }
  };

  const navigateToPrevQuestion = () => {
    setRunResult(null);
    setSubmitCodeResult(null);
    if (activeQuestionIdx > 0) {
      setActiveQuestionIdx((i) => i - 1);
    } else if (activeSectionIdx > 0) {
      setActiveSectionIdx((s) => s - 1);
      const prevSec = sections[activeSectionIdx - 1];
      setActiveQuestionIdx((prevSec?.questions?.length || 1) - 1);
    }
  };

  // Code Runner
  const handleRunCode = async () => {
    if (!qId || !currentAnswer?.code) return;
    setRunningCode(true);
    setRunResult(null);
    try {
      const res = await contestApi.runCode(contestId, {
        questionId: qId,
        code: currentAnswer.code,
        language: currentAnswer.language || 'python',
        customInput: showCustomInput ? customInput : undefined,
      });
      setRunResult(res as RunResult);
    } catch (err: any) {
      setRunResult({ error: err.response?.data?.error?.message || err.message || 'Execution error' });
    } finally {
      setRunningCode(false);
    }
  };

  // Code Submitter
  const handleSubmitCode = async () => {
    if (!qId || !currentAnswer?.code) return;
    setSubmittingCode(true);
    setSubmitCodeResult(null);
    try {
      const res = await contestApi.submitCode(contestId, {
        questionId: qId,
        code: currentAnswer.code,
        language: currentAnswer.language || 'python',
      });
      setSubmitCodeResult(res as CodeResult);
    } catch (err: any) {
      setSubmitCodeResult({
        verdict: err.response?.data?.error?.message || 'Submission Error',
        passed: 0,
        total: 0,
        score: 0,
      });
    } finally {
      setSubmittingCode(false);
    }
  };

  if (isLoading || !stateData) {
    return (
      <div className="h-screen flex flex-col items-center justify-center bg-slate-50 gap-3 font-sans">
        <Spinner size="lg" />
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest">
          Loading JEE Assessment Interface...
        </p>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-[#F8FAFC] font-sans select-none overflow-hidden text-slate-800">
      {/* 1. TOP HEADER (NTA JEE CBT STYLE) */}
      <header className="bg-white border-b-2 border-slate-200 px-4 py-2.5 flex items-center justify-between shrink-0 shadow-2xs z-30">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-[#3760F8] text-white flex items-center justify-center font-bold text-sm shadow-xs">
            C
          </div>
          <div>
            <h1 className="font-bold text-slate-900 text-sm tracking-tight leading-tight">
              {attempt?.contest?.title || 'National Assessment Examination'}
            </h1>
            <p className="text-[11px] text-slate-500 font-medium">Computer Based Test (CBT)</p>
          </div>
        </div>

        {/* Center / Right: JEE Countdown Timer */}
        <div className="flex items-center gap-4">
          <div
            className={`flex items-center gap-2 px-4 py-1.5 rounded-lg border-2 font-mono font-bold text-sm tracking-wider shadow-inner transition-all ${
              remaining < 300
                ? 'bg-rose-50 border-rose-500 text-rose-600 animate-pulse'
                : 'bg-slate-900 border-slate-800 text-[#D3FE4F]'
            }`}
          >
            <Clock className="w-4 h-4 text-slate-400" />
            <span>Time Left: {formatTimer(remaining)}</span>
          </div>

          <div className="hidden sm:flex items-center gap-2">
            <button
              onClick={() => setShowQuestionPaperModal(true)}
              className="px-3 py-1 text-xs font-semibold rounded border border-slate-300 hover:bg-slate-100 text-slate-700 transition-colors flex items-center gap-1.5"
            >
              <FileText className="w-3.5 h-3.5 text-slate-500" />
              <span>Question Paper</span>
            </button>
            <button
              onClick={() => setShowInstructionsModal(true)}
              className="px-3 py-1 text-xs font-semibold rounded border border-slate-300 hover:bg-slate-100 text-slate-700 transition-colors flex items-center gap-1.5"
            >
              <HelpCircle className="w-3.5 h-3.5 text-slate-500" />
              <span>Instructions</span>
            </button>
          </div>
        </div>
      </header>

      {/* 2. SECTION TABS BAR */}
      <div className="bg-[#E2E8F0] border-b border-slate-300 px-4 py-1.5 flex items-center gap-2 overflow-x-auto shrink-0 z-20">
        <span className="text-xs font-bold text-slate-600 uppercase tracking-wider mr-2 shrink-0">
          Sections:
        </span>
        {sections.map((sec, sIdx) => {
          const isActive = sIdx === activeSectionIdx;
          return (
            <button
              key={sec._id || sec.id || sIdx}
              onClick={() => {
                setActiveSectionIdx(sIdx);
                setActiveQuestionIdx(0);
                setRunResult(null);
                setSubmitCodeResult(null);
              }}
              className={`px-4 py-1.5 text-xs font-bold rounded-t-md transition-all shrink-0 border-t-2 border-x ${
                isActive
                  ? 'bg-white text-[#3760F8] border-t-[#3760F8] border-x-slate-300 shadow-2xs -mb-2 pb-2'
                  : 'bg-slate-200/80 text-slate-700 hover:bg-slate-200 border-transparent'
              }`}
            >
              <span>{sec.title}</span>
              <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
                {sec.questions?.length || 0}
              </span>
            </button>
          );
        })}
      </div>

      {/* 3. MAIN CONTENT: LEFT QUESTION PANE (~73%) + RIGHT PALETTE PANE (~27%) */}
      <div className="flex-1 flex overflow-hidden">
        {/* LEFT QUESTION PANE */}
        <div className="flex-1 flex flex-col bg-white border-r border-slate-300 overflow-hidden">
          {/* Question Sub-Header: Type, Question No., Marks */}
          <div className="bg-[#F1F5F9] border-b border-slate-200 px-5 py-2.5 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-3">
              <span className="font-bold text-slate-900 text-sm">
                Question No. {activeQuestionIdx + 1}
              </span>
              <span className="text-xs px-2.5 py-0.5 rounded bg-white border border-slate-300 text-slate-600 font-medium">
                Type: {activeQuestion?.type === 'coding' ? 'Coding Problem' : 'Single Choice (MCQ)'}
              </span>
            </div>
            <div className="flex items-center gap-3 text-xs font-semibold">
              <span className="text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                Marks for correct answer: +{activeQuestion?.marks || 4}
              </span>
              {activeQuestion?.negativeMarks ? (
                <span className="text-rose-700 bg-rose-50 px-2 py-0.5 rounded border border-rose-200">
                  Negative mark: -{activeQuestion.negativeMarks}
                </span>
              ) : null}
            </div>
          </div>

          {/* Question Body (Scrollable) */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {!activeQuestion ? (
              <div className="py-20 text-center text-slate-400 text-xs">
                No questions available in this section.
              </div>
            ) : (
              <>
                {/* Question Statement */}
                <div className="space-y-3">
                  <h3 className="text-sm font-bold text-slate-900 tracking-tight leading-snug">
                    {activeQuestion.title}
                  </h3>
                  <div className="text-sm text-slate-800 leading-relaxed whitespace-pre-wrap font-normal bg-slate-50/50 p-4 rounded-xl border border-slate-200/60">
                    {activeQuestion.statement}
                  </div>
                </div>

                {/* MCQ Options Rendering */}
                {activeQuestion.type === 'mcq' && (
                  <div className="space-y-3 pt-2">
                    <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                      Options (Choose one answer):
                    </p>
                    <div className="grid grid-cols-1 gap-2.5">
                      {(activeQuestion.mcqOptions || []).map((opt, oIdx) => {
                        const optKey = opt.id || String(oIdx);
                        const isSelected = (currentAnswer?.selectedOptions || []).includes(optKey);
                        return (
                          <div
                            key={optKey}
                            onClick={() => handleSelectOption(optKey)}
                            className={`flex items-start gap-3.5 p-3.5 rounded-xl border-2 cursor-pointer transition-all ${
                              isSelected
                                ? 'border-[#3760F8] bg-[#EEF2FF] shadow-xs'
                                : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/60'
                            }`}
                          >
                            <div
                              className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 mt-0.5 font-bold text-[11px] transition-colors ${
                                isSelected
                                  ? 'border-[#3760F8] bg-[#3760F8] text-white'
                                  : 'border-slate-300 bg-white text-slate-600'
                              }`}
                            >
                              {String.fromCharCode(65 + oIdx)}
                            </div>
                            <span className="text-sm text-slate-800 leading-relaxed select-text flex-1">
                              {opt.text}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Coding Challenge Editor */}
                {activeQuestion.type === 'coding' && (
                  <div className="space-y-4 pt-2">
                    {/* Constraints & Formats */}
                    {activeQuestion.codingConfig?.constraints && (
                      <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs space-y-1">
                        <span className="font-bold text-slate-700 block">Constraints:</span>
                        <p className="text-slate-600 font-mono text-[11px] whitespace-pre-wrap">
                          {activeQuestion.codingConfig.constraints}
                        </p>
                      </div>
                    )}

                    {/* Language Selector Strip */}
                    <div className="flex items-center justify-between gap-3 bg-slate-100 p-2 rounded-xl border border-slate-200">
                      <div className="flex items-center gap-2">
                        <Code2 className="w-4 h-4 text-[#3760F8]" />
                        <span className="text-xs font-bold text-slate-700">Code Editor:</span>
                      </div>
                      <select
                        value={currentAnswer?.language || 'python'}
                        onChange={(e) => {
                          const lang = e.target.value;
                          setAnswers((prev) => ({
                            ...prev,
                            [qId]: { ...prev[qId], language: lang },
                          }));
                        }}
                        className="bg-white border border-slate-300 text-xs font-semibold rounded-lg px-3 py-1 shadow-2xs focus:ring-2 focus:ring-[#3760F8]/20 focus:outline-none cursor-pointer"
                      >
                        {SUPPORTED_LANGUAGES.map((l) => (
                          <option key={l.key} value={l.key}>
                            {l.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Monospace Code Editor */}
                    <div className="border border-slate-300 rounded-xl overflow-hidden shadow-inner">
                      <textarea
                        value={
                          currentAnswer?.code !== undefined
                            ? currentAnswer.code
                            : activeQuestion.codingConfig?.starterCode?.[currentAnswer?.language || 'python'] ||
                              '# Write your solution here\n'
                        }
                        onChange={(e) => {
                          const code = e.target.value;
                          setAnswers((prev) => ({
                            ...prev,
                            [qId]: { ...prev[qId], code },
                          }));
                        }}
                        rows={14}
                        spellCheck={false}
                        className="w-full font-mono text-xs p-4 bg-[#0F172A] text-[#F8FAFC] leading-relaxed resize-y focus:outline-none focus:ring-0 selection:bg-[#3760F8]"
                        placeholder="# Write your program code here..."
                      />
                    </div>

                    {/* Run / Test Actions */}
                    <div className="flex items-center justify-between gap-3 flex-wrap">
                      <button
                        onClick={() => setShowCustomInput((v) => !v)}
                        className="text-xs text-slate-600 hover:text-slate-900 font-semibold underline"
                      >
                        {showCustomInput ? '- Hide Custom Input' : '+ Custom Input'}
                      </button>
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={handleRunCode}
                          loading={runningCode}
                          leftIcon={<Terminal className="w-3.5 h-3.5 text-slate-600" />}
                        >
                          Run Sample Tests
                        </Button>
                        <Button
                          size="sm"
                          onClick={handleSubmitCode}
                          loading={submittingCode}
                          leftIcon={<SendHorizontal className="w-3.5 h-3.5 text-white" />}
                        >
                          Submit Solution
                        </Button>
                      </div>
                    </div>

                    {showCustomInput && (
                      <div className="space-y-1">
                        <label className="text-xs font-bold text-slate-600">Custom Stdin Input:</label>
                        <textarea
                          rows={3}
                          value={customInput}
                          onChange={(e) => setCustomInput(e.target.value)}
                          className="w-full font-mono text-xs p-2.5 rounded-lg border border-slate-300 bg-white"
                          placeholder="Provide custom input here..."
                        />
                      </div>
                    )}

                    {/* Run / Submit Result Banner */}
                    {runResult && (
                      <div className="bg-slate-900 text-white rounded-xl p-4 font-mono text-xs space-y-2 border border-slate-800">
                        <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                          <span className="font-bold text-[#D3FE4F]">Execution Output:</span>
                          <span className="text-slate-400 text-[11px]">
                            {runResult.error ? 'Failed' : 'Completed'}
                          </span>
                        </div>
                        {runResult.error ? (
                          <p className="text-rose-400 whitespace-pre-wrap">{runResult.error}</p>
                        ) : (
                          <div className="space-y-1.5">
                            {(runResult.results || []).map((r, rIdx) => (
                              <div key={rIdx} className="flex items-center gap-2">
                                <span
                                  className={`w-3.5 h-3.5 rounded-full flex items-center justify-center text-[9px] font-bold ${
                                    r.passed ? 'bg-emerald-500 text-white' : 'bg-rose-500 text-white'
                                  }`}
                                >
                                  {r.passed ? '✓' : '✗'}
                                </span>
                                <span>Sample Case #{rIdx + 1}: {r.passed ? 'Passed' : 'Failed'}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {submitCodeResult && (
                      <div className="bg-slate-900 text-white rounded-xl p-4 font-mono text-xs space-y-2 border border-slate-800">
                        <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                          <span className="font-bold text-[#D3FE4F]">Verdict: {submitCodeResult.verdict}</span>
                          <span className="text-emerald-400 font-bold">Score: {submitCodeResult.score} pts</span>
                        </div>
                        <p className="text-slate-300">
                          Passed {submitCodeResult.passed} / {submitCodeResult.total} Test Cases
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </div>

          {/* BOTTOM JEE ACTION RIBBON (THE 5 OFFICIAL BUTTONS) */}
          <div className="bg-[#F8FAFC] border-t-2 border-slate-200 px-5 py-3 flex items-center justify-between gap-3 shrink-0 flex-wrap">
            {/* Left Action Buttons */}
            <div className="flex items-center gap-2.5 flex-wrap">
              <Button
                variant="outline"
                size="sm"
                onClick={handleSaveAndMarkForReview}
                className="bg-white hover:bg-purple-50 text-purple-700 border-purple-300 text-xs font-semibold"
              >
                Save &amp; Mark for Review
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleClearResponse}
                className="bg-white hover:bg-slate-100 text-slate-700 border-slate-300 text-xs font-semibold"
              >
                Clear Response
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleMarkForReviewAndNext}
                className="bg-white hover:bg-amber-50 text-amber-700 border-amber-300 text-xs font-semibold"
              >
                Mark for Review &amp; Next
              </Button>
            </div>

            {/* Right Navigation & Primary Button */}
            <div className="flex items-center gap-2">
              <button
                onClick={navigateToPrevQuestion}
                disabled={activeSectionIdx === 0 && activeQuestionIdx === 0}
                className="px-3.5 py-2 text-xs font-bold rounded-lg border border-slate-300 bg-white hover:bg-slate-100 disabled:opacity-40 disabled:pointer-events-none text-slate-700 transition-colors flex items-center gap-1"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                <span>Previous</span>
              </button>
              <Button
                size="sm"
                onClick={handleSaveAndNext}
                className="px-5 font-bold shadow-xs text-xs"
              >
                <span>Save &amp; Next</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>
        </div>

        {/* RIGHT QUESTION PALETTE PANE (THE OFFICIAL NTA JEE CBT PALETTE) */}
        <aside className="w-80 bg-white flex flex-col border-l border-slate-300 shrink-0 overflow-y-auto">
          {/* Candidate Profile Card */}
          <div className="p-3.5 border-b border-slate-200 bg-slate-50 flex items-center gap-3">
            <div className="w-12 h-12 rounded-lg bg-[#3760F8]/10 border border-[#3760F8]/30 flex items-center justify-center text-[#3760F8] font-bold text-base shrink-0">
              {user?.name?.[0]?.toUpperCase() || 'C'}
            </div>
            <div className="min-w-0">
              <p className="text-xs font-bold text-slate-900 truncate">{user?.name || 'Candidate'}</p>
              <p className="text-[11px] text-slate-500 font-mono truncate">{user?.rollNumber || 'Roll No. Not Set'}</p>
              <p className="text-[10px] text-slate-400 truncate">{user?.email || ''}</p>
            </div>
          </div>

          {/* Official JEE Color Legend */}
          <div className="p-3 border-b border-slate-200 bg-white space-y-2">
            <div className="grid grid-cols-2 gap-2 text-[11px] font-semibold">
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 rounded bg-emerald-600 text-white font-bold flex items-center justify-center text-xs shrink-0 shadow-2xs">
                  {stats.answered}
                </span>
                <span className="text-slate-700">Answered</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 rounded bg-rose-600 text-white font-bold flex items-center justify-center text-xs shrink-0 shadow-2xs">
                  {stats.notAnswered}
                </span>
                <span className="text-slate-700">Not Answered</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 rounded bg-slate-200 text-slate-700 font-bold flex items-center justify-center text-xs shrink-0 border border-slate-300">
                  {stats.notVisited}
                </span>
                <span className="text-slate-700">Not Visited</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 rounded bg-purple-600 text-white font-bold flex items-center justify-center text-xs shrink-0 shadow-2xs">
                  {stats.marked}
                </span>
                <span className="text-slate-700 leading-tight">Marked for Review</span>
              </div>
            </div>
            <div className="flex items-center gap-2 pt-1 border-t border-slate-100 text-[11px] font-semibold">
              <span className="w-6 h-6 rounded bg-purple-600 text-white font-bold flex items-center justify-center text-xs shrink-0 relative shadow-2xs">
                {stats.answeredAndMarked}
                <span className="w-2 h-2 rounded-full bg-emerald-400 border border-white absolute -bottom-0.5 -right-0.5" />
              </span>
              <span className="text-slate-700 text-[10px] leading-tight">
                Answered &amp; Marked for Review (will be evaluated)
              </span>
            </div>
          </div>

          {/* Question Number Palette Grid */}
          <div className="flex-1 p-3.5 space-y-2 overflow-y-auto">
            <div className="flex items-center justify-between pb-1">
              <span className="text-xs font-bold text-slate-800 uppercase tracking-tight">
                {activeSection?.title || 'Questions'}
              </span>
              <span className="text-[11px] text-slate-400 font-mono">
                {currentQuestions.length} Qs
              </span>
            </div>

            <div className="grid grid-cols-4 gap-2 pt-1">
              {currentQuestions.map((q, idx) => {
                const id = q._id || q.id || '';
                const status = getQuestionJeeStatus(id);
                const isCurrent = idx === activeQuestionIdx;

                // Color mapping according to official JEE standard
                let badgeClasses = 'bg-slate-200 text-slate-800 border-slate-300 hover:bg-slate-300';
                let hasDot = false;

                if (status === 'answered') {
                  badgeClasses = 'bg-emerald-600 text-white border-emerald-700';
                } else if (status === 'not_answered') {
                  badgeClasses = 'bg-rose-600 text-white border-rose-700';
                } else if (status === 'marked_for_review') {
                  badgeClasses = 'bg-purple-600 text-white border-purple-700';
                } else if (status === 'answered_and_marked') {
                  badgeClasses = 'bg-purple-600 text-white border-purple-700';
                  hasDot = true;
                }

                return (
                  <button
                    key={id || idx}
                    onClick={() => {
                      setActiveQuestionIdx(idx);
                      setRunResult(null);
                      setSubmitCodeResult(null);
                    }}
                    className={`h-10 rounded-md font-bold text-xs flex items-center justify-center relative border transition-all ${badgeClasses} ${
                      isCurrent
                        ? 'ring-3 ring-[#3760F8] ring-offset-2 scale-105 z-10 shadow-sm'
                        : 'shadow-2xs'
                    }`}
                  >
                    <span>{idx + 1}</span>
                    {hasDot && (
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 border border-white absolute -top-1 -right-1" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Bottom Submit Test Button */}
          <div className="p-3 border-t border-slate-200 bg-slate-50 shrink-0">
            <Button
              className="w-full py-2.5 text-xs font-bold bg-[#16A34A] hover:bg-[#15803D] text-white shadow-sm"
              onClick={() => setShowSubmitConfirm(true)}
            >
              Submit Assessment
            </Button>
          </div>
        </aside>
      </div>

      {/* 4. JEE FINAL SUBMIT CONFIRMATION MODAL */}
      <Modal
        open={showSubmitConfirm}
        onClose={() => setShowSubmitConfirm(false)}
        title="Assessment Summary"
        size="lg"
      >
        <div className="space-y-4">
          <p className="text-xs text-slate-600">
            Please review your question attempts before final submission:
          </p>

          {/* Summary Breakdown Table */}
          <div className="border border-slate-200 rounded-xl overflow-hidden text-xs">
            <table className="w-full text-left divide-y divide-slate-200">
              <thead className="bg-slate-50 font-bold text-slate-700 text-[11px] uppercase">
                <tr>
                  <th className="px-3 py-2">Section Name</th>
                  <th className="px-3 py-2 text-center">Total</th>
                  <th className="px-3 py-2 text-center text-emerald-600">Answered</th>
                  <th className="px-3 py-2 text-center text-rose-600">Not Answered</th>
                  <th className="px-3 py-2 text-center text-purple-600">Review</th>
                  <th className="px-3 py-2 text-center text-slate-500">Not Visited</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {sections.map((sec, sIdx) => {
                  let ansCount = 0;
                  let notAnsCount = 0;
                  let reviewCount = 0;
                  let notVisCount = 0;

                  (sec.questions || []).forEach((q) => {
                    const id = q._id || q.id || '';
                    const st = getQuestionJeeStatus(id);
                    if (st === 'answered' || st === 'answered_and_marked') ansCount++;
                    else if (st === 'not_answered') notAnsCount++;
                    else if (st === 'marked_for_review') reviewCount++;
                    else notVisCount++;
                  });

                  return (
                    <tr key={sec._id || sec.id || sIdx} className="hover:bg-slate-50/50">
                      <td className="px-3 py-2 font-medium text-slate-800">{sec.title}</td>
                      <td className="px-3 py-2 text-center font-bold">{sec.questions?.length || 0}</td>
                      <td className="px-3 py-2 text-center font-bold text-emerald-600">{ansCount}</td>
                      <td className="px-3 py-2 text-center font-bold text-rose-600">{notAnsCount}</td>
                      <td className="px-3 py-2 text-center font-bold text-purple-600">{reviewCount}</td>
                      <td className="px-3 py-2 text-center text-slate-400">{notVisCount}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 text-xs font-medium flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
            <span>
              Are you sure you want to finish? Once submitted, you cannot change any answers.
            </span>
          </div>

          <div className="flex gap-2 justify-end pt-2">
            <Button variant="outline" size="sm" onClick={() => setShowSubmitConfirm(false)}>
              Resume Assessment
            </Button>
            <Button
              size="sm"
              className="bg-[#16A34A] hover:bg-[#15803D]"
              onClick={() => {
                setShowSubmitConfirm(false);
                finishMutation.mutate();
              }}
              loading={finishMutation.isPending}
            >
              Submit Final Assessment
            </Button>
          </div>
        </div>
      </Modal>

      {/* Instructions Modal */}
      <Modal
        open={showInstructionsModal}
        onClose={() => setShowInstructionsModal(false)}
        title="Exam Instructions"
      >
        <div className="space-y-3 text-xs text-slate-700 leading-relaxed max-h-96 overflow-y-auto">
          <p className="font-bold">General Instructions:</p>
          <ul className="list-disc pl-5 space-y-1 text-slate-600">
            <li>The clock will display remaining time in the top right banner.</li>
            <li>Use <strong>Save &amp; Next</strong> to lock your answer and proceed.</li>
            <li>Click <strong>Clear Response</strong> to wipe your choice for the current question.</li>
            <li>Use <strong>Mark for Review</strong> to flag questions you want to reconsider.</li>
            <li>Answered &amp; Marked for review questions will be evaluated for final score.</li>
            <li>Fullscreen and active tab integrity is strictly monitored.</li>
          </ul>
          <div className="pt-2 flex justify-end">
            <Button size="sm" onClick={() => setShowInstructionsModal(false)}>
              Back to Test
            </Button>
          </div>
        </div>
      </Modal>

      {/* Question Paper Overview Modal */}
      <Modal
        open={showQuestionPaperModal}
        onClose={() => setShowQuestionPaperModal(false)}
        title="Full Question Paper Overview"
        size="lg"
      >
        <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-2 divide-y divide-slate-100">
          {sections.map((sec, sIdx) => (
            <div key={sec._id || sec.id || sIdx} className="pt-3 space-y-2">
              <h4 className="font-bold text-xs text-[#3760F8] uppercase tracking-wider">{sec.title}</h4>
              <div className="space-y-2">
                {(sec.questions || []).map((q, qIdx) => (
                  <div key={q._id || q.id || qIdx} className="p-3 bg-slate-50 rounded-xl text-xs space-y-1 border border-slate-200/60">
                    <div className="flex justify-between items-center font-bold text-slate-800">
                      <span>Q{qIdx + 1}: {q.title}</span>
                      <span className="text-slate-500 font-mono">[{q.marks} pts]</span>
                    </div>
                    <p className="text-slate-600 whitespace-pre-wrap">{q.statement}</p>
                  </div>
                ))}
              </div>
            </div>
          ))}
          <div className="pt-3 flex justify-end">
            <Button size="sm" onClick={() => setShowQuestionPaperModal(false)}>
              Close Overview
            </Button>
          </div>
        </div>
      </Modal>

      {/* Proctoring Warning Modal */}
      <Modal
        open={violationModal}
        onClose={() => setViolationModal(false)}
        title="Proctoring Advisory Notice"
      >
        <div className="space-y-3">
          <div className="flex items-center gap-3 p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs">
            <ShieldAlert className="w-5 h-5 shrink-0" />
            <div>
              <p className="font-bold">Proctoring Rule Triggered</p>
              <p className="mt-0.5">
                Tab-switch, window blur, or unauthorized clipboard action recorded. Violation #{violationCount}.
              </p>
            </div>
          </div>
          <p className="text-xs text-slate-500">
            Repeated anomalies will result in automatic submission by the proctor monitor.
          </p>
          <div className="flex justify-end pt-2">
            <Button size="sm" onClick={() => setViolationModal(false)}>
              I Understand &bull; Return to Test
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
