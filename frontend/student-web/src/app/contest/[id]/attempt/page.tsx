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
  ChevronDown,
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
  X,
  Menu,
  Smartphone,
} from 'lucide-react';

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
  { id: 62, name: 'Java (OpenJDK 17)', key: 'java' },
  { id: 86, name: 'C# (.NET Core)', key: 'csharp' },
  { id: 63, name: 'JavaScript (Node.js)', key: 'javascript' },
  { id: 54, name: 'C++ (GCC)', key: 'cpp' },
  { id: 50, name: 'C (GCC)', key: 'c' },
];

const DEFAULT_STARTER_CODE: Record<string, string> = {
  python: `# Write your Python solution here\nimport sys\n\ndef main():\n    # lines = sys.stdin.read().splitlines()\n    pass\n\nif __name__ == '__main__':\n    main()\n`,
  java: `import java.util.*;\nimport java.io.*;\n\npublic class Main {\n    public static void main(String[] args) {\n        Scanner sc = new Scanner(System.in);\n        // Write your Java solution here\n    }\n}\n`,
  csharp: `using System;\n\nclass Program {\n    static void Main(string[] args) {\n        // Write your C# solution here\n        // string line = Console.ReadLine();\n    }\n}\n`,
  javascript: `const fs = require('fs');\nconst input = fs.readFileSync(0, 'utf-8').trim();\n\n// Write your solution here\n`,
  cpp: `#include <iostream>\nusing namespace std;\n\nint main() {\n    // Write your C++ solution here\n    return 0;\n}\n`,
  c: `#include <stdio.h>\n\nint main() {\n    // Write your C solution here\n    return 0;\n}\n`,
};

export default function AttemptPage() {
  const { id: contestId } = useParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuthStore();

  const { data: meUser } = useQuery({
    queryKey: ['me-attempt'],
    queryFn: authApi.me,
    staleTime: 60_000,
  });
  const currentUser = meUser || user;

  const [activeSectionIdx, setActiveSectionIdx] = useState(0);
  const [activeQuestionIdx, setActiveQuestionIdx] = useState(0);

  // Mobile Tab Toggle: 'question' or 'answer'
  const [mobileTab, setMobileTab] = useState<'question' | 'answer'>('question');

  // Answers & Reviews
  const [answers, setAnswers] = useState<Record<string, AnswerState>>({});
  const [visitedQuestions, setVisitedQuestions] = useState<Set<string>>(new Set());
  const [markedForReview, setMarkedForReview] = useState<Set<string>>(new Set());

  // Coding Runner
  const [runResult, setRunResult] = useState<RunResult | null>(null);
  const [submitCodeResult, setSubmitCodeResult] = useState<CodeResult | null>(null);
  const [runningCode, setRunningCode] = useState(false);
  const [submittingCode, setSubmittingCode] = useState(false);
  const [customInput, setCustomInput] = useState('');
  const [showCustomInput, setShowCustomInput] = useState(false);

  // Fullscreen & Proctoring State
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [needsFullscreenGate, setNeedsFullscreenGate] = useState(false);
  const [violationCount, setViolationCount] = useState(0);
  const [violationModal, setViolationModal] = useState(false);
  const [lastViolationReason, setLastViolationReason] = useState('');
  const [disqualified, setDisqualified] = useState(false);

  // Drawer / Modals
  const [showQuestionDrawer, setShowQuestionDrawer] = useState(false);
  const [showSubmitConfirm, setShowSubmitConfirm] = useState(false);
  const [showInstructionsModal, setShowInstructionsModal] = useState(false);
  const [showQuestionPaperModal, setShowQuestionPaperModal] = useState(false);
  const [isLangOpen, setIsLangOpen] = useState(false);

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

  // Autosave answers every 25 seconds
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
    }, 25000);
    return () => {
      if (autoSaveRef.current) clearInterval(autoSaveRef.current);
    };
  }, [answers, markedForReview, contestId]);

  // Strict Proctoring Violation Logger
  const logViolation = useCallback(
    async (type: string, reasonDescription: string) => {
      const realAttemptId =
        (attempt as any)?.attempt?.id ||
        (attempt as any)?.attempt?._id ||
        (attempt as any)?.attemptId ||
        attempt?._id ||
        attempt?.id ||
        '';

      try {
        await proctorApi.logEvent({
          contestId,
          attemptId: realAttemptId,
          type,
          details: { reason: reasonDescription },
        });
      } catch (err) {
        console.warn('Proctoring log error:', err);
      }

      const cfg = attempt?.contest?.proctorConfig;
      const maxLimit = cfg?.maxViolations || 5;

      setViolationCount((prev) => {
        const next = prev + 1;
        setLastViolationReason(reasonDescription);

        if (next >= maxLimit) {
          setDisqualified(true);
          finishMutation.mutate();
        } else {
          setViolationModal(true);
        }
        return next;
      });
    },
    [contestId, attempt, finishMutation]
  );

  // Fullscreen Request Handler
  const requestStrictFullscreen = async () => {
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
      }
      setIsFullscreen(true);
      setNeedsFullscreenGate(false);
    } catch (err) {
      // User refused or browser blocked fullscreen
      setNeedsFullscreenGate(true);
    }
  };

  // Fullscreen & Proctoring Listeners
  useEffect(() => {
    const cfg = attempt?.contest?.proctorConfig;
    if (!cfg?.enabled) return;

    // Check fullscreen on load if enforced
    if (cfg.enforceFullscreen) {
      if (!document.fullscreenElement) {
        setNeedsFullscreenGate(true);
      } else {
        setIsFullscreen(true);
      }
    }

    const onFullscreenChange = () => {
      const isNowFullscreen = !!document.fullscreenElement;
      setIsFullscreen(isNowFullscreen);

      if (cfg.enforceFullscreen && !isNowFullscreen) {
        setNeedsFullscreenGate(true);
        logViolation('fullscreen_exit', 'Exited fullscreen examination mode.');
      }
    };

    const onVisibilityChange = () => {
      if (document.hidden && cfg.blockTabSwitch) {
        logViolation('tab_switch', 'Switched away to another browser tab.');
      }
    };

    const onWindowBlur = () => {
      if (cfg.blockTabSwitch) {
        logViolation('window_blur', 'Window lost focus or application switch detected.');
      }
    };

    const onCopy = (e: ClipboardEvent) => {
      if (cfg.blockCopyPaste) {
        e.preventDefault();
        logViolation('copy', 'Attempted clipboard copy action.');
      }
    };

    const onPaste = (e: ClipboardEvent) => {
      if (cfg.blockCopyPaste) {
        e.preventDefault();
        logViolation('paste', 'Attempted clipboard paste action.');
      }
    };

    const onContextMenu = (e: MouseEvent) => {
      if (cfg.blockRightClick) {
        e.preventDefault();
        logViolation('context_menu', 'Right-click context menu prohibited.');
      }
    };

    document.addEventListener('fullscreenchange', onFullscreenChange);
    document.addEventListener('visibilitychange', onVisibilityChange);
    window.addEventListener('blur', onWindowBlur);
    document.addEventListener('copy', onCopy as EventListener);
    document.addEventListener('paste', onPaste as EventListener);
    document.addEventListener('contextmenu', onContextMenu as EventListener);

    return () => {
      document.removeEventListener('fullscreenchange', onFullscreenChange);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      window.removeEventListener('blur', onWindowBlur);
      document.removeEventListener('copy', onCopy as EventListener);
      document.removeEventListener('paste', onPaste as EventListener);
      document.removeEventListener('contextmenu', onContextMenu as EventListener);
    };
  }, [attempt, logViolation]);

  // JEE Status Helper
  const getQuestionJeeStatus = (targetQId: string) => {
    const ans = answers[targetQId];
    const isAnswered =
      (ans?.selectedOptions && ans.selectedOptions.length > 0) ||
      (ans?.code && ans.code.trim().length > 10);
    const isMarked = markedForReview.has(targetQId);

    if (isAnswered && isMarked) return 'answered_and_marked';
    if (isAnswered) return 'answered';
    if (isMarked) return 'marked_for_review';
    if (visitedQuestions.has(targetQId)) return 'not_answered';
    return 'not_visited';
  };

  const currentAnswer = answers[qId];

  // Option selection
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

  // Navigation & Save Helpers
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
    navigateToNextQuestion();
  };

  const handleToggleReview = () => {
    if (!qId) return;
    setMarkedForReview((prev) => {
      const next = new Set(prev);
      const isCurrentlyMarked = next.has(qId);
      if (isCurrentlyMarked) {
        next.delete(qId);
      } else {
        next.add(qId);
      }
      contestApi
        .saveAnswer(contestId, {
          questionId: qId,
          selectedOptions: currentAnswer?.selectedOptions || [],
          draftCode: currentAnswer?.code || '',
          language: currentAnswer?.language || 'python',
          isMarkedForReview: !isCurrentlyMarked,
        })
        .catch(() => {});
      return next;
    });
  };

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

  // Summary stats
  const totalAnswered = useMemo(() => {
    let count = 0;
    sections.forEach((s) => {
      s.questions.forEach((q) => {
        const id = q._id || q.id || '';
        const st = getQuestionJeeStatus(id);
        if (st === 'answered' || st === 'answered_and_marked') count++;
      });
    });
    return count;
  }, [sections, answers, markedForReview]);

  const totalQuestions = useMemo(() => {
    return sections.reduce((acc, s) => acc + (s.questions?.length || 0), 0);
  }, [sections]);

  if (isLoading || !stateData) {
    return (
      <div className="h-screen flex flex-col items-center justify-center bg-slate-50 gap-3 font-sans">
        <Spinner size="lg" />
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest">
          Loading Examination Portal...
        </p>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-slate-100 font-sans select-none overflow-hidden text-slate-900">
      {/* ===================== STRICT FULLSCREEN GATE OVERLAY ===================== */}
      {needsFullscreenGate && (
        <div className="fixed inset-0 z-50 bg-slate-900/95 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-md w-full text-center shadow-2xl space-y-4 border border-slate-200">
            <div className="w-16 h-16 bg-[#EEF2FF] text-[#3760F8] rounded-3xl flex items-center justify-center mx-auto shadow-sm">
              <Maximize2 className="w-8 h-8" />
            </div>
            <div>
              <h2 className="text-xl font-extrabold text-slate-900 tracking-tight">Fullscreen Security Required</h2>
              <p className="text-xs text-slate-600 leading-relaxed mt-2">
                This assessment enforces strict fullscreen proctoring. Exiting fullscreen mode, switching tabs, or minimizing the browser is recorded as a security violation.
              </p>
            </div>
            {violationCount > 0 && (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 text-xs font-semibold">
                Violation flags logged: {violationCount} / {attempt?.contest?.proctorConfig?.maxViolations || 5}
              </div>
            )}
            <button
              onClick={requestStrictFullscreen}
              className="w-full py-3.5 bg-[#3760F8] hover:bg-[#254EDB] text-white font-bold text-xs uppercase tracking-wider rounded-xl shadow-lg transition-all active:scale-95"
            >
              Enter Fullscreen &amp; Continue Test
            </button>
          </div>
        </div>
      )}

      {/* ===================== TOP COMMAND HEADER ===================== */}
      <header className="bg-white border-b border-slate-200 px-4 sm:px-6 py-2.5 flex items-center justify-between shrink-0 z-30 shadow-xs">
        {/* Left: Brand & Contest Title */}
        <div className="flex items-center gap-3 min-w-0">
          <img src="/logo.png" alt="HACKPRO" className="h-8 w-auto object-contain rounded" />
          <div className="min-w-0">
            <h1 className="font-extrabold text-slate-900 text-sm sm:text-base tracking-tight truncate max-w-xs sm:max-w-md">
              {attempt?.contest?.title || 'Assessment'}
            </h1>
            <p className="text-[11px] text-slate-400 font-mono truncate">
              {currentUser?.name} &bull; {currentUser?.rollNumber}
            </p>
          </div>
        </div>

        {/* Center: High-Contrast Countdown Timer */}
        <div className="flex items-center gap-2 bg-slate-900 text-white px-3 sm:px-4 py-1.5 rounded-xl shadow-sm border border-slate-800">
          <Clock className={`w-3.5 h-3.5 ${remaining < 300 ? 'text-rose-500 animate-pulse' : 'text-[#D3FE4F]'}`} />
          <div className="flex items-center font-mono font-bold text-xs sm:text-sm text-[#D3FE4F] tracking-wider">
            <span>{timerObj.hours}</span>:<span>{timerObj.minutes}</span>:
            <span className={remaining < 300 ? 'text-rose-400 font-black' : ''}>{timerObj.seconds}</span>
          </div>
        </div>

        {/* Right: Quick Utilities & Submit */}
        <div className="flex items-center gap-2">
          {attempt?.contest?.proctorConfig?.enabled && (
            <div className="hidden lg:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs font-semibold">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>Proctoring Active</span>
            </div>
          )}

          {/* Question Palette Drawer Trigger */}
          <button
            onClick={() => setShowQuestionDrawer(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 shadow-2xs"
            title="Open question palette"
          >
            <Menu className="w-3.5 h-3.5 text-slate-600" />
            <span className="hidden sm:inline">Palette</span>
            <span className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded-md font-mono font-bold">
              {totalAnswered}/{totalQuestions}
            </span>
          </button>

          <button
            onClick={() => setShowSubmitConfirm(true)}
            className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-xs transition-all"
          >
            Submit
          </button>
        </div>
      </header>

      {/* ===================== SECTION TABS & MOBILE VIEW TOGGLE ===================== */}
      <div className="bg-white border-b border-slate-200 px-4 sm:px-6 py-2 flex items-center justify-between gap-3 shrink-0 z-20 overflow-x-auto">
        <div className="flex items-center gap-2">
          {sections.map((sec, sIdx) => {
            const isActive = sIdx === activeSectionIdx;
            const isCoding = sec.questions.some((q) => q.type === 'coding');
            return (
              <button
                key={sec._id || sec.id || sIdx}
                onClick={() => {
                  setActiveSectionIdx(sIdx);
                  setActiveQuestionIdx(0);
                  setRunResult(null);
                  setSubmitCodeResult(null);
                }}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-xl transition-all border whitespace-nowrap ${
                  isActive
                    ? 'bg-[#3760F8] text-white border-[#3760F8] shadow-xs'
                    : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
                }`}
              >
                {isCoding ? <Code2 className="w-3.5 h-3.5" /> : <CheckSquare className="w-3.5 h-3.5" />}
                <span>{sec.title}</span>
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${isActive ? 'bg-white/20' : 'bg-slate-200'}`}>
                  {sec.questions?.length || 0}
                </span>
              </button>
            );
          })}
        </div>

        {/* Mobile View Toggle (Only shown for Coding Problems on Mobile) */}
        {activeQuestion?.type === 'coding' && (
          <div className="flex md:hidden items-center bg-slate-100 p-1 rounded-xl border border-slate-200 shrink-0">
            <button
              onClick={() => setMobileTab('question')}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                mobileTab === 'question' ? 'bg-white text-[#3760F8] shadow-2xs' : 'text-slate-600'
              }`}
            >
              Problem
            </button>
            <button
              onClick={() => setMobileTab('answer')}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                mobileTab === 'answer' ? 'bg-white text-[#3760F8] shadow-2xs' : 'text-slate-600'
              }`}
            >
              Code Editor
            </button>
          </div>
        )}
      </div>

      {/* ===================== STRUCTURED SPLIT WORKSPACE ===================== */}
      <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
        {/* LEFT PANEL (50% Desktop): Question Statement & Specifications */}
        <div
          className={`flex-1 md:w-1/2 flex-col bg-white border-r border-slate-200 overflow-hidden ${
            mobileTab === 'question' ? 'flex' : 'hidden md:flex'
          }`}
        >
          {/* Question Sub-Header */}
          <div className="bg-slate-50 px-5 py-3 border-b border-slate-200 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2">
              <span className="font-bold text-xs bg-white border border-slate-200 px-2.5 py-1 rounded-lg text-slate-900 shadow-2xs">
                Question {activeQuestionIdx + 1} of {currentQuestions.length}
              </span>
              <span className="text-xs font-semibold text-[#3760F8] bg-[#EEF2FF] border border-[#C7D2FE] px-2 py-0.5 rounded-lg">
                {activeQuestion?.type === 'coding' ? 'Coding Problem' : 'MCQ'}
              </span>
            </div>

            {/* Marks breakdown */}
            <div className="flex items-center gap-2 text-xs font-bold font-mono">
              <span className="text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                +{activeQuestion?.marks || 1}
              </span>
              {activeQuestion?.negativeMarks ? (
                <span className="text-rose-700 bg-rose-50 px-2 py-0.5 rounded-md border border-rose-200">
                  -{activeQuestion.negativeMarks}
                </span>
              ) : null}
            </div>
          </div>

          {/* Question Details Body */}
          <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-4">
            {!activeQuestion ? (
              <div className="py-20 text-center text-xs text-slate-400">No question selected.</div>
            ) : (
              <div className="space-y-4">
                <h3 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight">
                  {activeQuestion.title}
                </h3>

                <div className="p-4 bg-slate-50/80 rounded-2xl border border-slate-200 text-xs sm:text-sm text-slate-800 leading-relaxed whitespace-pre-wrap">
                  {activeQuestion.statement}
                </div>

                {/* Mobile-Friendly MCQ Options: Rendered directly on phones so candidates never need to switch tabs to answer */}
                {activeQuestion.type === 'mcq' && (
                  <div className="md:hidden pt-2 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                        Select Answer:
                      </span>
                      {currentAnswer?.selectedOptions && currentAnswer.selectedOptions.length > 0 && (
                        <button
                          onClick={handleClearResponse}
                          className="text-xs text-rose-600 hover:text-rose-700 font-semibold"
                        >
                          Clear Choice
                        </button>
                      )}
                    </div>

                    <div className="space-y-2.5">
                      {((activeQuestion.mcqOptions && activeQuestion.mcqOptions.length > 0)
                        ? activeQuestion.mcqOptions
                        : ((activeQuestion as any).options || [])
                      ).map((opt: any, oIdx: number) => {
                        const optKey = opt.id || String(oIdx);
                        const isSelected = (currentAnswer?.selectedOptions || []).includes(optKey);
                        const letter = String.fromCharCode(65 + oIdx);

                        return (
                          <div
                            key={optKey}
                            onClick={() => handleSelectOption(optKey)}
                            className={`flex items-center gap-3 p-3.5 rounded-2xl border-2 cursor-pointer transition-all active:scale-[0.99] ${
                              isSelected
                                ? 'border-[#3760F8] bg-[#EEF2FF] shadow-xs'
                                : 'border-slate-200 bg-white hover:border-slate-300'
                            }`}
                          >
                            <div
                              className={`w-7 h-7 rounded-xl border-2 flex items-center justify-center shrink-0 font-bold text-xs ${
                                isSelected
                                  ? 'border-[#3760F8] bg-[#3760F8] text-white'
                                  : 'border-slate-300 bg-slate-50 text-slate-700'
                              }`}
                            >
                              {letter}
                            </div>
                            <span
                              className={`text-xs sm:text-sm flex-1 ${
                                isSelected ? 'font-bold text-slate-900' : 'font-medium text-slate-700'
                              }`}
                            >
                              {opt.text}
                            </span>
                            {isSelected && (
                              <div className="w-5 h-5 rounded-full bg-[#3760F8] text-white flex items-center justify-center shrink-0">
                                <Check className="w-3 h-3 stroke-[3]" />
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {activeQuestion.type === 'coding' && (
                  <div className="space-y-3 pt-2 text-xs">
                    {activeQuestion.codingConfig?.inputFormat && (
                      <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
                        <span className="font-bold text-slate-700 uppercase text-[10px] tracking-wider block">Input Format</span>
                        <p className="text-slate-600 font-mono text-[11px] whitespace-pre-wrap">{activeQuestion.codingConfig.inputFormat}</p>
                      </div>
                    )}

                    {activeQuestion.codingConfig?.outputFormat && (
                      <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
                        <span className="font-bold text-slate-700 uppercase text-[10px] tracking-wider block">Output Format</span>
                        <p className="text-slate-600 font-mono text-[11px] whitespace-pre-wrap">{activeQuestion.codingConfig.outputFormat}</p>
                      </div>
                    )}

                    {activeQuestion.codingConfig?.constraints && (
                      <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
                        <span className="font-bold text-slate-700 uppercase text-[10px] tracking-wider block">Constraints</span>
                        <p className="text-slate-600 font-mono text-[11px] whitespace-pre-wrap">{activeQuestion.codingConfig.constraints}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* RIGHT PANEL (50% Desktop): Answer Area (MCQ Radios or Coding IDE) */}
        <div
          className={`flex-1 md:w-1/2 flex-col bg-white overflow-hidden ${
            mobileTab === 'answer' ? 'flex' : 'hidden md:flex'
          }`}
        >
          {activeQuestion?.type === 'mcq' ? (
            /* ================== MCQ OPTION SELECTOR ================== */
            <div className="flex-1 flex flex-col overflow-hidden">
              <div className="bg-slate-50 px-5 py-3 border-b border-slate-200 flex items-center justify-between shrink-0">
                <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Select Answer:
                </span>
                {currentAnswer?.selectedOptions && currentAnswer.selectedOptions.length > 0 && (
                  <button
                    onClick={handleClearResponse}
                    className="text-xs text-rose-600 hover:text-rose-700 font-semibold"
                  >
                    Clear Choice
                  </button>
                )}
              </div>

              <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-3">
                {((activeQuestion.mcqOptions && activeQuestion.mcqOptions.length > 0)
                  ? activeQuestion.mcqOptions
                  : ((activeQuestion as any).options || [])
                ).map((opt: any, oIdx: number) => {
                  const optKey = opt.id || String(oIdx);
                  const isSelected = (currentAnswer?.selectedOptions || []).includes(optKey);
                  const letter = String.fromCharCode(65 + oIdx);

                  return (
                    <div
                      key={optKey}
                      onClick={() => handleSelectOption(optKey)}
                      className={`flex items-center gap-3.5 p-4 rounded-2xl border-2 cursor-pointer transition-all ${
                        isSelected
                          ? 'border-[#3760F8] bg-[#EEF2FF] shadow-xs'
                          : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/80 shadow-2xs'
                      }`}
                    >
                      <div
                        className={`w-7 h-7 rounded-xl border-2 flex items-center justify-center shrink-0 font-bold text-xs ${
                          isSelected
                            ? 'border-[#3760F8] bg-[#3760F8] text-white'
                            : 'border-slate-300 bg-slate-50 text-slate-700'
                        }`}
                      >
                        {letter}
                      </div>
                      <span
                        className={`text-xs sm:text-sm flex-1 ${
                          isSelected ? 'font-bold text-slate-900' : 'font-medium text-slate-700'
                        }`}
                      >
                        {opt.text}
                      </span>
                      {isSelected && (
                        <div className="w-5 h-5 rounded-full bg-[#3760F8] text-white flex items-center justify-center shrink-0">
                          <Check className="w-3 h-3 stroke-[3]" />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            /* ================== CODING IDE & TEST RUNNER ================== */
            <div className="flex-1 flex flex-col overflow-hidden bg-slate-900">
              {/* Language Toolbar */}
              <div className="bg-[#1E293B] px-4 py-2 border-b border-slate-800 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-2">
                  <Code2 className="w-4 h-4 text-[#3760F8]" />
                  <span className="text-xs font-bold text-slate-300">Editor</span>
                </div>
                <div className="relative inline-flex items-center">
                  <button
                    type="button"
                    onClick={() => setIsLangOpen((prev) => !prev)}
                    className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700/80 border border-slate-700 text-white text-xs font-semibold rounded-lg pl-3 pr-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-[#3760F8]/40 shadow-xs transition-colors cursor-pointer"
                  >
                    <span>
                      {SUPPORTED_LANGUAGES.find((l) => l.key === (currentAnswer?.language || 'python'))?.name || 'Python'}
                    </span>
                    <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform ${isLangOpen ? 'rotate-180 text-[#3760F8]' : ''}`} />
                  </button>

                  {isLangOpen && (
                    <div className="absolute right-0 top-full mt-1.5 w-36 bg-slate-800 rounded-xl border border-slate-700 shadow-xl overflow-hidden py-1 z-50">
                      {SUPPORTED_LANGUAGES.map((l) => {
                        const isSel = (currentAnswer?.language || 'python') === l.key;
                        return (
                          <button
                            key={l.key}
                            type="button"
                            onClick={() => {
                              const currentCode = currentAnswer?.code;
                              const isDefaultCode = !currentCode || Object.values(DEFAULT_STARTER_CODE).some((tpl) => tpl.trim() === currentCode.trim());
                              setAnswers((prev) => ({
                                ...prev,
                                [qId]: {
                                  ...prev[qId],
                                  language: l.key,
                                  ...(isDefaultCode ? { code: activeQuestion?.codingConfig?.starterCode?.[l.key] || DEFAULT_STARTER_CODE[l.key] || '' } : {}),
                                },
                              }));
                              setIsLangOpen(false);
                            }}
                            className={`w-full text-left px-3 py-1.5 text-xs font-semibold flex items-center justify-between cursor-pointer ${
                              isSel ? 'bg-[#3760F8] text-white' : 'text-slate-300 hover:bg-slate-700 hover:text-white'
                            }`}
                          >
                            <span>{l.name}</span>
                            {isSel && <Check className="w-3.5 h-3.5" />}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              {/* Code Editor */}
              <div className="flex-1 flex flex-col overflow-hidden">
                <textarea
                  value={
                    currentAnswer?.code !== undefined
                      ? currentAnswer.code
                      : activeQuestion?.codingConfig?.starterCode?.[currentAnswer?.language || 'python'] ||
                        DEFAULT_STARTER_CODE[currentAnswer?.language || 'python'] ||
                        '// Write your solution here\n'
                  }
                  onChange={(e) => {
                    const code = e.target.value;
                    setAnswers((prev) => ({
                      ...prev,
                      [qId]: { ...prev[qId], code },
                    }));
                  }}
                  spellCheck={false}
                  className="flex-1 w-full font-mono text-xs p-4 bg-[#0F172A] text-[#F8FAFC] leading-relaxed resize-none focus:outline-none selection:bg-[#3760F8]"
                  placeholder="# Write your program code here..."
                />
              </div>

              {/* Run & Submit Action Row */}
              <div className="p-3 bg-[#1E293B] border-t border-slate-800 flex items-center justify-between gap-2 shrink-0">
                <button
                  onClick={() => setShowCustomInput((v) => !v)}
                  className="text-[11px] text-[#D3FE4F] hover:underline font-semibold"
                >
                  {showCustomInput ? 'Hide Stdin' : 'Custom Input'}
                </button>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-xs h-7 px-3 bg-slate-800 text-white border-slate-700 hover:bg-slate-700"
                    onClick={handleRunCode}
                    loading={runningCode}
                    leftIcon={<Terminal className="w-3.5 h-3.5 text-slate-300" />}
                  >
                    Run Code
                  </Button>
                  <Button
                    size="sm"
                    className="text-xs h-7 px-3 bg-[#3760F8] hover:bg-[#254EDB]"
                    onClick={handleSubmitCode}
                    loading={submittingCode}
                    leftIcon={<SendHorizontal className="w-3.5 h-3.5 text-white" />}
                  >
                    Submit Code
                  </Button>
                </div>
              </div>

              {/* Custom Input Panel */}
              {showCustomInput && (
                <div className="p-3 bg-slate-800 border-t border-slate-700 space-y-1">
                  <label className="text-[10px] uppercase font-bold text-slate-400">Custom Stdin:</label>
                  <textarea
                    rows={2}
                    value={customInput}
                    onChange={(e) => setCustomInput(e.target.value)}
                    className="w-full font-mono text-xs p-2 rounded bg-slate-900 border border-slate-700 text-white focus:outline-none"
                    placeholder="Input data..."
                  />
                </div>
              )}

              {/* Output Results */}
              {(runResult || submitCodeResult) && (
                <div className="max-h-40 overflow-y-auto p-3 bg-black/90 border-t border-slate-800 text-xs font-mono space-y-1">
                  {runResult && (
                    <div>
                      <span className="text-[#D3FE4F] font-bold">Execution Output:</span>
                      {runResult.error ? (
                        <p className="text-rose-400 mt-1 whitespace-pre-wrap">{runResult.error}</p>
                      ) : (
                        <div className="space-y-1 mt-1">
                          {(runResult.results || []).map((r, i) => (
                            <div key={i} className={r.passed ? 'text-emerald-400' : 'text-rose-400'}>
                              {r.passed ? '✓ Test Case Passed' : '✗ Test Case Failed'}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {submitCodeResult && (
                    <div className="pt-1">
                      <span className="text-[#D3FE4F] font-bold">Verdict: {submitCodeResult.verdict}</span>
                      <span className="text-emerald-400 ml-2">Score: {submitCodeResult.score} pts</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ===================== BOTTOM NAVIGATION ACTION BAR ===================== */}
      <footer className="bg-white border-t border-slate-200 px-4 sm:px-6 py-3 flex items-center justify-between gap-3 shrink-0 shadow-lg">
        {/* Left: Review & Clear Actions */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleToggleReview}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all flex items-center gap-1.5 ${
              markedForReview.has(qId)
                ? 'bg-purple-600 text-white border-purple-600'
                : 'bg-purple-50 text-purple-700 hover:bg-purple-100 border-purple-200'
            }`}
          >
            <Bookmark className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">
              {markedForReview.has(qId) ? 'Marked for Review' : 'Mark for Review'}
            </span>
          </button>
        </div>

        {/* Right: Previous & Save/Next Buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={navigateToPrevQuestion}
            disabled={activeSectionIdx === 0 && activeQuestionIdx === 0}
            className="px-3.5 py-1.5 text-xs font-bold rounded-xl border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 disabled:pointer-events-none text-slate-700 transition-all flex items-center gap-1"
          >
            <ChevronLeft className="w-4 h-4" />
            <span>Previous</span>
          </button>
          <button
            onClick={handleSaveAndNext}
            className="px-5 py-1.5 bg-[#3760F8] hover:bg-[#254EDB] text-white text-xs font-bold rounded-xl shadow-xs transition-all flex items-center gap-1.5"
          >
            <span>Save &amp; Next</span>
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </footer>

      {/* ===================== QUESTION PALETTE DRAWER ===================== */}
      {showQuestionDrawer && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex justify-end">
          <div className="w-80 sm:w-96 bg-white h-full shadow-2xl flex flex-col">
            <div className="p-4 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-sm text-slate-900">Questions Palette</h3>
                <p className="text-[11px] text-slate-400">Jump to any question in your assessment</p>
              </div>
              <button
                onClick={() => setShowQuestionDrawer(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {sections.map((sec, sIdx) => (
                <div key={sec._id || sec.id || sIdx} className="space-y-2">
                  <span className="text-xs font-bold text-slate-700 block">{sec.title}</span>
                  <div className="grid grid-cols-5 gap-2">
                    {sec.questions.map((q, qIdx) => {
                      const id = q._id || q.id || '';
                      const st = getQuestionJeeStatus(id);
                      const isCurrent = sIdx === activeSectionIdx && qIdx === activeQuestionIdx;

                      let bg = 'bg-slate-100 text-slate-700 border-slate-200';
                      if (st === 'answered') bg = 'bg-emerald-600 text-white border-emerald-700';
                      else if (st === 'not_answered') bg = 'bg-rose-500 text-white border-rose-600';
                      else if (st === 'marked_for_review') bg = 'bg-purple-600 text-white border-purple-700';
                      else if (st === 'answered_and_marked') bg = 'bg-purple-600 text-white border-purple-700 ring-2 ring-emerald-400';

                      return (
                        <button
                          key={id || qIdx}
                          onClick={() => {
                            setActiveSectionIdx(sIdx);
                            setActiveQuestionIdx(qIdx);
                            setShowQuestionDrawer(false);
                            setRunResult(null);
                            setSubmitCodeResult(null);
                          }}
                          className={`h-9 rounded-xl font-bold text-xs flex items-center justify-center border transition-all ${bg} ${
                            isCurrent ? 'ring-2 ring-[#3760F8] scale-105' : ''
                          }`}
                        >
                          {qIdx + 1}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ===================== CONFIRM SUBMIT MODAL ===================== */}
      <Modal
        open={showSubmitConfirm}
        onClose={() => setShowSubmitConfirm(false)}
        title="Confirm Assessment Submission"
      >
        <div className="space-y-4">
          <p className="text-xs text-slate-600">
            You have answered <span className="font-bold text-[#3760F8]">{totalAnswered}</span> out of{' '}
            <span className="font-bold">{totalQuestions}</span> questions.
          </p>

          <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 text-xs">
            Once submitted, your responses will be locked and sent for automatic grading. You cannot resume the exam.
          </div>

          <div className="flex gap-2.5 justify-end pt-2">
            <Button variant="outline" size="sm" onClick={() => setShowSubmitConfirm(false)}>
              Keep Answering
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
              Confirm &amp; Submit Assessment
            </Button>
          </div>
        </div>
      </Modal>

      {/* ===================== PROCTORING WARNING MODAL ===================== */}
      <Modal
        open={violationModal}
        onClose={() => setViolationModal(false)}
        title="Assessment Security Warning"
      >
        <div className="space-y-3.5">
          <div className="flex items-center gap-3 p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs">
            <ShieldAlert className="w-5 h-5 shrink-0" />
            <div>
              <p className="font-bold">Security Violation Logged</p>
              <p className="mt-0.5">{lastViolationReason}</p>
            </div>
          </div>
          <p className="text-xs text-slate-500">
            Total violations: <strong className="text-rose-600">{violationCount}</strong> /{' '}
            {attempt?.contest?.proctorConfig?.maxViolations || 5}. Reaching the limit will trigger automatic disqualification.
          </p>
          <div className="flex justify-end pt-2">
            <Button size="sm" onClick={() => setViolationModal(false)}>
              Acknowledge &amp; Return
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
