'use client';

import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation } from '@tanstack/react-query';
import { contestApi, proctorApi, authApi } from '@/lib/api';
import { useAuthStore } from '@/store/authStore';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Spinner } from '@/components/ui/Spinner';
import {
  Clock,
  AlertTriangle,
  Play,
  Check,
  ChevronLeft,
  ChevronRight,
  ShieldAlert,
  SendHorizontal,
  Code2,
  Terminal,
  RotateCcw,
  Bookmark,
  HelpCircle,
  FileText,
  ShieldCheck,
  Maximize2,
  Minimize2,
  CheckSquare,
  Sparkles,
  Info,
  CheckCircle2,
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
  selectedOptions?: string[];
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

  // Fresh user profile
  const { data: meUser } = useQuery({
    queryKey: ['me-attempt'],
    queryFn: authApi.me,
    staleTime: 60_000,
  });
  const currentUser = meUser || user;

  const [activeSectionIdx, setActiveSectionIdx] = useState(0);
  const [activeQuestionIdx, setActiveQuestionIdx] = useState(0);

  // JEE Question Tracking States
  const [answers, setAnswers] = useState<Record<string, AnswerState>>({});
  const [visitedQuestions, setVisitedQuestions] = useState<Set<string>>(new Set());
  const [markedForReview, setMarkedForReview] = useState<Set<string>>(new Set());

  // Coding Runner States
  const [runResult, setRunResult] = useState<RunResult | null>(null);
  const [submitCodeResult, setSubmitCodeResult] = useState<CodeResult | null>(null);
  const [runningCode, setRunningCode] = useState(false);
  const [submittingCode, setSubmittingCode] = useState(false);
  const [customInput, setCustomInput] = useState('');
  const [showCustomInput, setShowCustomInput] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

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
    return {
      hours: String(h).padStart(2, '0'),
      minutes: String(m).padStart(2, '0'),
      seconds: String(s).padStart(2, '0'),
    };
  };

  const timerObj = formatTimer(remaining);

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
      setIsFullscreen(!!document.fullscreenElement);
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

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  };

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
  const handleSaveAndNext = () => {
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
    if (qId && markedForReview.has(qId)) {
      setMarkedForReview((prev) => {
        const next = new Set(prev);
        next.delete(qId);
        return next;
      });
    }
    navigateToNextQuestion();
  };

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

  const initials = useMemo(() => {
    const name = currentUser?.name || 'Candidate';
    return name
      .split(' ')
      .map((p: string) => p[0])
      .slice(0, 2)
      .join('')
      .toUpperCase();
  }, [currentUser?.name]);

  if (isLoading || !stateData) {
    return (
      <div className="h-screen flex flex-col items-center justify-center bg-slate-50 gap-3 font-sans">
        <Spinner size="lg" />
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest">
          Loading Examination Hall...
        </p>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-slate-100 font-sans select-none overflow-hidden text-slate-800">
      {/* 1. TOP COMMAND HEADER */}
      <header className="bg-white border-b border-slate-200/90 px-4 sm:px-6 py-2.5 flex items-center justify-between shrink-0 z-30 shadow-xs">
        {/* Left: Brand & Contest Title */}
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-9 h-9 rounded-xl bg-[#3760F8] text-white flex items-center justify-center font-extrabold text-sm shadow-[0_2px_10px_rgba(55,96,248,0.3)] shrink-0 relative">
            <span>H</span>
            <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-[#D3FE4F] border-2 border-white" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="font-extrabold text-slate-900 text-sm sm:text-base tracking-tight truncate max-w-xs sm:max-w-md">
                {attempt?.contest?.title || 'HirePro Assessment'}
              </h1>
              <span className="hidden md:inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-extrabold text-[#3760F8] bg-[#EEF2FF] border border-[#C7D2FE] uppercase tracking-wider">
                Assessment
              </span>
            </div>
            <p className="text-[11px] text-slate-500 font-medium truncate">
              Session ID: <span className="font-mono">{contestId.slice(-8).toUpperCase()}</span>
            </p>
          </div>
        </div>

        {/* Center: High-Contrast Countdown HUD */}
        <div className="flex items-center gap-2 sm:gap-3 bg-slate-900 text-white px-3 sm:px-5 py-1.5 sm:py-2 rounded-2xl shadow-sm border border-slate-800">
          <div className="flex items-center gap-1.5 text-slate-400 text-xs font-semibold">
            <Clock className={`w-4 h-4 ${remaining < 300 ? 'text-rose-500 animate-pulse' : 'text-[#D3FE4F]'}`} />
            <span className="hidden sm:inline">Time Left:</span>
          </div>
          <div className="flex items-center gap-1 font-mono font-extrabold text-sm sm:text-base text-[#D3FE4F] tracking-widest">
            <span className="bg-white/10 px-1.5 py-0.5 rounded text-white">{timerObj.hours}</span>
            <span className="text-slate-400">:</span>
            <span className="bg-white/10 px-1.5 py-0.5 rounded text-white">{timerObj.minutes}</span>
            <span className="text-slate-400">:</span>
            <span className={`bg-white/10 px-1.5 py-0.5 rounded ${remaining < 300 ? 'text-rose-400' : 'text-[#D3FE4F]'}`}>
              {timerObj.seconds}
            </span>
          </div>
        </div>

        {/* Right: Quick Utilities */}
        <div className="flex items-center gap-2">
          {/* Proctor Indicator */}
          <div className="hidden xl:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs font-semibold">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>Proctoring Active</span>
          </div>

          <button
            onClick={() => setShowQuestionPaperModal(true)}
            className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 shadow-2xs transition-all"
          >
            <FileText className="w-3.5 h-3.5 text-slate-500" />
            <span>Paper</span>
          </button>

          <button
            onClick={() => setShowInstructionsModal(true)}
            className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 shadow-2xs transition-all"
          >
            <HelpCircle className="w-3.5 h-3.5 text-slate-500" />
            <span>Instructions</span>
          </button>

          <button
            onClick={toggleFullscreen}
            title={isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen'}
            className="p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-xl border border-slate-200 bg-white transition-all shadow-2xs"
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
        </div>
      </header>

      {/* 2. SECTION TABS BAR */}
      <div className="bg-white border-b border-slate-200/80 px-4 sm:px-6 py-2 flex items-center justify-between gap-4 overflow-x-auto shrink-0 z-20 shadow-2xs">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider mr-1 shrink-0 hidden sm:inline">
            Sections:
          </span>
          <div className="flex items-center gap-2">
            {sections.map((sec, sIdx) => {
              const isActive = sIdx === activeSectionIdx;
              const isCoding = sec.questions.some((q) => q.type === 'coding');
              
              // Count answered in section
              const answeredCount = sec.questions.filter((q) => {
                const st = getQuestionJeeStatus(q._id || q.id || '');
                return st === 'answered' || st === 'answered_and_marked';
              }).length;

              return (
                <button
                  key={sec._id || sec.id || sIdx}
                  onClick={() => {
                    setActiveSectionIdx(sIdx);
                    setActiveQuestionIdx(0);
                    setRunResult(null);
                    setSubmitCodeResult(null);
                  }}
                  className={`flex items-center gap-2 px-3.5 py-1.5 text-xs font-bold rounded-xl transition-all border ${
                    isActive
                      ? 'bg-[#3760F8] text-white border-[#3760F8] shadow-sm'
                      : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
                  }`}
                >
                  {isCoding ? (
                    <Code2 className={`w-3.5 h-3.5 ${isActive ? 'text-white' : 'text-slate-500'}`} />
                  ) : (
                    <CheckSquare className={`w-3.5 h-3.5 ${isActive ? 'text-white' : 'text-slate-500'}`} />
                  )}
                  <span>{sec.title}</span>
                  <span
                    className={`ml-1 text-[10px] px-1.5 py-0.5 rounded-full font-bold ${
                      isActive
                        ? 'bg-white/20 text-white'
                        : 'bg-slate-200 text-slate-700'
                    }`}
                  >
                    {answeredCount}/{sec.questions?.length || 0}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Section Progress Indicator */}
        <div className="hidden lg:flex items-center gap-3 text-xs text-slate-500 shrink-0">
          <span className="font-semibold text-slate-700">{activeSection?.title}</span>
          <div className="w-24 bg-slate-100 rounded-full h-2 overflow-hidden border border-slate-200">
            <div
              className="bg-[#3760F8] h-full rounded-full transition-all duration-300"
              style={{
                width: `${
                  currentQuestions.length > 0
                    ? ((stats.answered + stats.answeredAndMarked) / currentQuestions.length) * 100
                    : 0
                }%`,
              }}
            />
          </div>
        </div>
      </div>

      {/* 3. MAIN WORKSPACE: LEFT QUESTION AREA (~72%) + RIGHT PALETTE PANE (~28%) */}
      <div className="flex-1 flex overflow-hidden">
        {/* LEFT QUESTION PANE */}
        <div className="flex-1 flex flex-col bg-white border-r border-slate-200/90 overflow-hidden">
          {/* Question Sub-Header: Question No., Type & Marks Breakdown */}
          <div className="bg-slate-50/90 border-b border-slate-200 px-6 py-3 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-3">
              <span className="font-extrabold text-slate-900 text-sm tracking-tight bg-white px-3 py-1 rounded-lg border border-slate-200 shadow-2xs">
                Question {activeQuestionIdx + 1} of {currentQuestions.length}
              </span>
              <span className="text-xs font-semibold px-2.5 py-1 rounded-lg bg-blue-50 text-[#3760F8] border border-blue-200">
                {activeQuestion?.type === 'coding' ? 'Programming Task' : 'Single Choice (MCQ)'}
              </span>
            </div>

            {/* Marks Pill */}
            <div className="flex items-center gap-2 text-xs font-bold">
              <span className="text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200 flex items-center gap-1 shadow-2xs">
                <span>+{activeQuestion?.marks || 4}.00</span>
                <span className="text-[10px] font-normal text-emerald-600">Correct</span>
              </span>
              {activeQuestion?.negativeMarks ? (
                <span className="text-rose-700 bg-rose-50 px-2.5 py-1 rounded-lg border border-rose-200 flex items-center gap-1 shadow-2xs">
                  <span>-{activeQuestion.negativeMarks}.00</span>
                  <span className="text-[10px] font-normal text-rose-600">Negative</span>
                </span>
              ) : null}
            </div>
          </div>

          {/* Question Body (Scrollable Container) */}
          <div className="flex-1 overflow-y-auto p-6 sm:p-8 space-y-6">
            {!activeQuestion ? (
              <div className="py-24 text-center text-slate-400 text-xs">
                No questions found in this section.
              </div>
            ) : (
              <div className="max-w-4xl mx-auto space-y-6">
                {/* Problem Statement Card */}
                <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-3">
                  <h3 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight leading-snug">
                    {activeQuestion.title}
                  </h3>
                  <div className="text-sm text-slate-800 leading-relaxed whitespace-pre-wrap font-normal pt-1 bg-slate-50/70 p-4 rounded-xl border border-slate-100">
                    {activeQuestion.statement}
                  </div>
                </div>

                {/* MCQ Options Rendering */}
                {activeQuestion.type === 'mcq' && (
                  <div className="space-y-3 pt-1">
                    <div className="flex items-center justify-between pb-1">
                      <span className="text-xs font-bold text-slate-600 uppercase tracking-wider">
                        Select One Option:
                      </span>
                      {currentAnswer?.selectedOptions && currentAnswer.selectedOptions.length > 0 && (
                        <span className="text-xs font-semibold text-emerald-600 flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Option Chosen
                        </span>
                      )}
                    </div>

                    <div className="grid grid-cols-1 gap-3">
                      {(activeQuestion.mcqOptions || []).map((opt, oIdx) => {
                        const optKey = opt.id || String(oIdx);
                        const isSelected = (currentAnswer?.selectedOptions || []).includes(optKey);
                        const letter = String.fromCharCode(65 + oIdx);

                        return (
                          <div
                            key={optKey}
                            onClick={() => handleSelectOption(optKey)}
                            className={`flex items-center gap-4 p-4 rounded-2xl border-2 cursor-pointer transition-all duration-150 ${
                              isSelected
                                ? 'border-[#3760F8] bg-[#EEF2FF] shadow-xs ring-2 ring-[#3760F8]/10'
                                : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/80 shadow-2xs'
                            }`}
                          >
                            <div
                              className={`w-7 h-7 rounded-xl border-2 flex items-center justify-center shrink-0 font-bold text-xs transition-all ${
                                isSelected
                                  ? 'border-[#3760F8] bg-[#3760F8] text-white shadow-xs'
                                  : 'border-slate-300 bg-slate-50 text-slate-700'
                              }`}
                            >
                              {letter}
                            </div>
                            <span
                              className={`text-sm leading-relaxed flex-1 select-text ${
                                isSelected ? 'font-bold text-slate-900' : 'font-medium text-slate-800'
                              }`}
                            >
                              {opt.text}
                            </span>
                            {isSelected && (
                              <div className="w-5 h-5 rounded-full bg-[#3760F8] text-white flex items-center justify-center shrink-0 shadow-2xs">
                                <Check className="w-3 h-3 stroke-[3]" />
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Coding Challenge Editor */}
                {activeQuestion.type === 'coding' && (
                  <div className="space-y-4 pt-1">
                    {/* Constraints */}
                    {activeQuestion.codingConfig?.constraints && (
                      <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 text-xs space-y-1">
                        <span className="font-bold text-slate-700 block uppercase tracking-wider text-[11px]">
                          Constraints:
                        </span>
                        <p className="text-slate-600 font-mono text-xs whitespace-pre-wrap">
                          {activeQuestion.codingConfig.constraints}
                        </p>
                      </div>
                    )}

                    {/* Language Selector Strip */}
                    <div className="flex items-center justify-between gap-3 bg-slate-100 p-2.5 rounded-2xl border border-slate-200">
                      <div className="flex items-center gap-2 pl-2">
                        <Code2 className="w-4 h-4 text-[#3760F8]" />
                        <span className="text-xs font-bold text-slate-800">IDE Sandbox:</span>
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
                        className="bg-white border border-slate-300 text-xs font-bold rounded-xl px-3 py-1.5 shadow-2xs focus:ring-2 focus:ring-[#3760F8]/20 focus:outline-none cursor-pointer"
                      >
                        {SUPPORTED_LANGUAGES.map((l) => (
                          <option key={l.key} value={l.key}>
                            {l.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Monospace Code Editor */}
                    <div className="border border-slate-800 rounded-2xl overflow-hidden shadow-md">
                      <div className="bg-[#1E293B] px-4 py-2 border-b border-slate-800 flex items-center justify-between text-xs text-slate-400 font-mono">
                        <span>solution.{currentAnswer?.language === 'python' ? 'py' : 'cpp'}</span>
                        <span>UTF-8</span>
                      </div>
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
                    <div className="flex items-center justify-between gap-3 flex-wrap pt-1">
                      <button
                        onClick={() => setShowCustomInput((v) => !v)}
                        className="text-xs text-[#3760F8] hover:text-[#254EDB] font-bold"
                      >
                        {showCustomInput ? '- Hide Custom Input' : '+ Provide Custom Stdin Input'}
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
                          Submit Code
                        </Button>
                      </div>
                    </div>

                    {showCustomInput && (
                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-slate-700">Custom Stdin Input:</label>
                        <textarea
                          rows={3}
                          value={customInput}
                          onChange={(e) => setCustomInput(e.target.value)}
                          className="w-full font-mono text-xs p-3 rounded-xl border border-slate-300 bg-white"
                          placeholder="Provide custom test input here..."
                        />
                      </div>
                    )}

                    {/* Run Result Output Banner */}
                    {runResult && (
                      <div className="bg-slate-900 text-white rounded-2xl p-4 font-mono text-xs space-y-2 border border-slate-800 shadow-md">
                        <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                          <span className="font-bold text-[#D3FE4F]">Execution Output:</span>
                          <span className="text-slate-400 text-[11px]">
                            {runResult.error ? 'Compilation / Runtime Error' : 'All Cases Executed'}
                          </span>
                        </div>
                        {runResult.error ? (
                          <p className="text-rose-400 whitespace-pre-wrap">{runResult.error}</p>
                        ) : (
                          <div className="space-y-2">
                            {(runResult.results || []).map((r, rIdx) => (
                              <div key={rIdx} className="flex items-center gap-2">
                                <span
                                  className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold ${
                                    r.passed ? 'bg-emerald-500 text-white' : 'bg-rose-500 text-white'
                                  }`}
                                >
                                  {r.passed ? '✓' : '✗'}
                                </span>
                                <span className={r.passed ? 'text-emerald-300' : 'text-rose-300'}>
                                  Sample Test Case #{rIdx + 1}: {r.passed ? 'Passed' : 'Failed'}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {submitCodeResult && (
                      <div className="bg-slate-900 text-white rounded-2xl p-4 font-mono text-xs space-y-2 border border-slate-800 shadow-md">
                        <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                          <span className="font-bold text-[#D3FE4F]">Verdict: {submitCodeResult.verdict}</span>
                          <span className="text-emerald-400 font-bold">Score: {submitCodeResult.score} pts</span>
                        </div>
                        <p className="text-slate-300">
                          Passed {submitCodeResult.passed} / {submitCodeResult.total} Total Test Cases
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* BOTTOM JEE ACTION RIBBON (THE 5 OFFICIAL STANDARDIZED BUTTONS) */}
          <div className="bg-white border-t border-slate-200/90 px-6 py-3.5 flex items-center justify-between gap-4 shrink-0 flex-wrap shadow-lg">
            {/* Left Action Buttons */}
            <div className="flex items-center gap-2.5 flex-wrap">
              <button
                onClick={handleSaveAndMarkForReview}
                className="px-4 py-2 rounded-xl text-xs font-bold text-purple-700 bg-purple-50 hover:bg-purple-100 border border-purple-200 shadow-2xs transition-all flex items-center gap-1.5"
              >
                <Bookmark className="w-3.5 h-3.5" />
                <span>Save &amp; Mark Review</span>
              </button>
              <button
                onClick={handleClearResponse}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-200 shadow-2xs transition-all flex items-center gap-1.5"
              >
                <RotateCcw className="w-3.5 h-3.5 text-slate-500" />
                <span>Clear Response</span>
              </button>
              <button
                onClick={handleMarkForReviewAndNext}
                className="px-4 py-2 rounded-xl text-xs font-bold text-amber-800 bg-amber-50 hover:bg-amber-100 border border-amber-200 shadow-2xs transition-all flex items-center gap-1.5"
              >
                <span>Mark Review &amp; Next</span>
              </button>
            </div>

            {/* Right Navigation & Progression */}
            <div className="flex items-center gap-2.5">
              <button
                onClick={navigateToPrevQuestion}
                disabled={activeSectionIdx === 0 && activeQuestionIdx === 0}
                className="px-4 py-2 text-xs font-bold rounded-xl border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 disabled:pointer-events-none text-slate-700 transition-all flex items-center gap-1 shadow-2xs"
              >
                <ChevronLeft className="w-4 h-4" />
                <span>Previous</span>
              </button>
              <button
                onClick={handleSaveAndNext}
                className="px-6 py-2 bg-[#3760F8] hover:bg-[#254EDB] active:scale-95 text-white text-xs font-extrabold rounded-xl shadow-[0_2px_12px_rgba(55,96,248,0.35)] transition-all flex items-center gap-1.5"
              >
                <span>Save &amp; Next</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* RIGHT QUESTION PALETTE & CANDIDATE PANE (~28%) */}
        <aside className="w-80 lg:w-96 bg-white flex flex-col border-l border-slate-200/90 shrink-0 overflow-y-auto">
          {/* Candidate Profile Card */}
          <div className="p-4 border-b border-slate-200/80 bg-gradient-to-r from-slate-50 to-blue-50/20 flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-[#3760F8] to-[#60A5FA] text-white flex items-center justify-center font-bold text-base shadow-sm ring-2 ring-[#3760F8]/15 shrink-0">
              {initials}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-1">
                <p className="text-xs font-extrabold text-slate-900 truncate">{currentUser?.name || 'Candidate'}</p>
                <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.2 rounded border border-emerald-200">
                  Verified
                </span>
              </div>
              <p className="text-xs font-mono font-bold text-[#3760F8] truncate mt-0.5">
                {currentUser?.rollNumber ?? '2024PECAI381'}
              </p>
              <p className="text-[11px] text-slate-500 truncate">{currentUser?.email || ''}</p>
            </div>
          </div>

          {/* Official JEE Color Legend */}
          <div className="p-4 border-b border-slate-200/80 bg-white space-y-3">
            <h4 className="text-[11px] font-extrabold text-slate-500 uppercase tracking-wider">
              Question Palette Legend
            </h4>
            <div className="grid grid-cols-2 gap-2 text-xs font-semibold">
              <div className="flex items-center gap-2 p-1.5 rounded-xl bg-slate-50 border border-slate-100">
                <span className="w-6 h-6 rounded-lg bg-emerald-600 text-white font-bold flex items-center justify-center text-xs shrink-0 shadow-2xs">
                  {stats.answered}
                </span>
                <span className="text-slate-800 text-[11px]">Answered</span>
              </div>
              <div className="flex items-center gap-2 p-1.5 rounded-xl bg-slate-50 border border-slate-100">
                <span className="w-6 h-6 rounded-lg bg-rose-600 text-white font-bold flex items-center justify-center text-xs shrink-0 shadow-2xs">
                  {stats.notAnswered}
                </span>
                <span className="text-slate-800 text-[11px]">Not Answered</span>
              </div>
              <div className="flex items-center gap-2 p-1.5 rounded-xl bg-slate-50 border border-slate-100">
                <span className="w-6 h-6 rounded-lg bg-slate-200 text-slate-700 font-bold flex items-center justify-center text-xs shrink-0 border border-slate-300">
                  {stats.notVisited}
                </span>
                <span className="text-slate-800 text-[11px]">Not Visited</span>
              </div>
              <div className="flex items-center gap-2 p-1.5 rounded-xl bg-slate-50 border border-slate-100">
                <span className="w-6 h-6 rounded-lg bg-purple-600 text-white font-bold flex items-center justify-center text-xs shrink-0 shadow-2xs">
                  {stats.marked}
                </span>
                <span className="text-slate-800 text-[11px] leading-tight">Review</span>
              </div>
            </div>

            <div className="flex items-center gap-2.5 p-2 rounded-xl bg-purple-50/60 border border-purple-100 text-[11px] font-semibold">
              <span className="w-6 h-6 rounded-lg bg-purple-600 text-white font-bold flex items-center justify-center text-xs shrink-0 relative shadow-2xs">
                {stats.answeredAndMarked}
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 border border-white absolute -bottom-1 -right-1" />
              </span>
              <span className="text-purple-900 leading-tight">
                Answered &amp; Marked for Review (Will be evaluated)
              </span>
            </div>
          </div>

          {/* Question Number Palette Grid */}
          <div className="flex-1 p-4 space-y-3 overflow-y-auto">
            <div className="flex items-center justify-between pb-1">
              <span className="text-xs font-bold text-slate-800 uppercase tracking-tight">
                {activeSection?.title || 'Questions'}
              </span>
              <span className="text-xs font-mono font-semibold text-slate-500">
                {currentQuestions.length} Questions
              </span>
            </div>

            <div className="grid grid-cols-5 gap-2.5 pt-1">
              {currentQuestions.map((q, idx) => {
                const id = q._id || q.id || '';
                const status = getQuestionJeeStatus(id);
                const isCurrent = idx === activeQuestionIdx;

                let badgeClasses = 'bg-slate-100 text-slate-700 border-slate-300 hover:bg-slate-200';
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
                    className={`h-11 rounded-xl font-extrabold text-xs flex items-center justify-center relative border transition-all ${badgeClasses} ${
                      isCurrent
                        ? 'ring-3 ring-[#3760F8] ring-offset-2 scale-105 z-10 shadow-md font-black'
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

          {/* Bottom Persistent Submit Action */}
          <div className="p-4 border-t border-slate-200/90 bg-slate-50 shrink-0">
            <button
              onClick={() => setShowSubmitConfirm(true)}
              className="w-full py-3 px-4 text-xs font-extrabold rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white shadow-[0_2px_14px_rgba(22,163,74,0.35)] transition-all active:scale-95 flex items-center justify-center gap-2 uppercase tracking-wider"
            >
              <Check className="w-4 h-4 stroke-[3]" />
              <span>Submit Assessment</span>
            </button>
          </div>
        </aside>
      </div>

      {/* 4. FINAL SUBMIT CONFIRMATION MODAL */}
      <Modal
        open={showSubmitConfirm}
        onClose={() => setShowSubmitConfirm(false)}
        title="Review Assessment Summary"
        size="lg"
      >
        <div className="space-y-4">
          <p className="text-xs text-slate-600">
            Please verify your section attempt summary before finalizing your exam submission:
          </p>

          {/* Breakdown Table */}
          <div className="border border-slate-200 rounded-2xl overflow-hidden text-xs shadow-2xs">
            <table className="w-full text-left divide-y divide-slate-200">
              <thead className="bg-slate-50 font-extrabold text-slate-700 text-[11px] uppercase">
                <tr>
                  <th className="px-3.5 py-2.5">Section Name</th>
                  <th className="px-3.5 py-2.5 text-center">Total</th>
                  <th className="px-3.5 py-2.5 text-center text-emerald-600">Answered</th>
                  <th className="px-3.5 py-2.5 text-center text-rose-600">Not Answered</th>
                  <th className="px-3.5 py-2.5 text-center text-purple-600">Review</th>
                  <th className="px-3.5 py-2.5 text-center text-slate-400">Not Visited</th>
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
                      <td className="px-3.5 py-2.5 font-bold text-slate-900">{sec.title}</td>
                      <td className="px-3.5 py-2.5 text-center font-bold text-slate-700">{sec.questions?.length || 0}</td>
                      <td className="px-3.5 py-2.5 text-center font-extrabold text-emerald-600">{ansCount}</td>
                      <td className="px-3.5 py-2.5 text-center font-extrabold text-rose-600">{notAnsCount}</td>
                      <td className="px-3.5 py-2.5 text-center font-extrabold text-purple-600">{reviewCount}</td>
                      <td className="px-3.5 py-2.5 text-center text-slate-400">{notVisCount}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-2xl text-amber-800 text-xs font-semibold flex items-center gap-2.5">
            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
            <span>
              Once you click Submit, your assessment will be closed and submitted for final grading. You will not be able to resume or modify your answers.
            </span>
          </div>

          <div className="flex gap-2.5 justify-end pt-2">
            <Button variant="outline" size="sm" onClick={() => setShowSubmitConfirm(false)}>
              Resume Assessment
            </Button>
            <Button
              size="sm"
              className="bg-emerald-600 hover:bg-emerald-700"
              onClick={() => {
                setShowSubmitConfirm(false);
                finishMutation.mutate();
              }}
              loading={finishMutation.isPending}
            >
              Confirm &amp; Final Submit
            </Button>
          </div>
        </div>
      </Modal>

      {/* Instructions Modal */}
      <Modal
        open={showInstructionsModal}
        onClose={() => setShowInstructionsModal(false)}
        title="Candidate Instructions &amp; CBT Rules"
      >
        <div className="space-y-3.5 text-xs text-slate-700 leading-relaxed max-h-96 overflow-y-auto">
          <p className="font-extrabold text-slate-900">Official Computer Based Test (CBT) Protocols:</p>
          <ul className="list-disc pl-5 space-y-1.5 text-slate-600">
            <li>The server clock in the top banner tracks time remaining.</li>
            <li>Use <strong>Save &amp; Next</strong> to record your answer and advance to the next problem.</li>
            <li>Click <strong>Clear Response</strong> to erase your selected option.</li>
            <li>Use <strong>Mark for Review</strong> to bookmark questions you want to reconsider before finishing.</li>
            <li><strong>Answered &amp; Marked for Review</strong> responses WILL be evaluated and graded.</li>
            <li>Full screen and active tab integrity are continuously monitored by the automated proctor.</li>
          </ul>
          <div className="pt-2 flex justify-end">
            <Button size="sm" onClick={() => setShowInstructionsModal(false)}>
              Return to Examination
            </Button>
          </div>
        </div>
      </Modal>

      {/* Question Paper Overview Modal */}
      <Modal
        open={showQuestionPaperModal}
        onClose={() => setShowQuestionPaperModal(false)}
        title="Question Paper Overview"
        size="lg"
      >
        <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-2 divide-y divide-slate-100">
          {sections.map((sec, sIdx) => (
            <div key={sec._id || sec.id || sIdx} className="pt-3 space-y-2">
              <h4 className="font-extrabold text-xs text-[#3760F8] uppercase tracking-wider">{sec.title}</h4>
              <div className="space-y-2">
                {(sec.questions || []).map((q, qIdx) => (
                  <div key={q._id || q.id || qIdx} className="p-3.5 bg-slate-50 rounded-2xl text-xs space-y-1.5 border border-slate-200/70">
                    <div className="flex justify-between items-center font-bold text-slate-900">
                      <span>Question {qIdx + 1}: {q.title}</span>
                      <span className="text-[#3760F8] font-mono text-[11px] font-extrabold">[{q.marks} Marks]</span>
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
        <div className="space-y-3.5">
          <div className="flex items-center gap-3 p-3.5 bg-rose-50 border border-rose-200 rounded-2xl text-rose-700 text-xs">
            <ShieldAlert className="w-5 h-5 shrink-0" />
            <div>
              <p className="font-bold">Proctoring Event Logged</p>
              <p className="mt-0.5">
                Tab switch, screen defocus, or unauthorized clipboard action recorded. Violation flag #{violationCount}.
              </p>
            </div>
          </div>
          <p className="text-xs text-slate-500">
            Excessive violation flags will result in administrative disqualification or auto-submission.
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
