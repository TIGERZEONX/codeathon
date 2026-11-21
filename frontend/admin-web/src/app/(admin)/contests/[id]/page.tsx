'use client';
import { useState } from 'react';
import { useParams } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { sectionsApi, questionsApi, contestsApi } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { Badge } from '@/components/ui/Badge';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Spinner } from '@/components/ui/Spinner';
import Link from 'next/link';
import {
  ArrowLeft,
  Plus,
  Trash2,
  Code2,
  CheckSquare,
  Layers,
  FileQuestion,
  Users,
  Trophy,
  BarChart3,
  UserCheck,
  AlertCircle,
  X,
} from 'lucide-react';

interface Section {
  _id: string;
  title: string;
  order: number;
}

interface Question {
  _id: string;
  title: string;
  statement: string;
  type: 'mcq' | 'coding';
  marks: number;
  negativeMarks?: number;
  sectionId: string;
}

interface McqOption {
  text: string;
  isCorrect: boolean;
}

interface TestCase {
  input: string;
  output: string;
  isHidden: boolean;
}

const EMPTY_MCQ = {
  title: '',
  statement: '',
  marks: 1,
  negativeMarks: 0,
  isMultiSelect: false,
  options: [
    { text: '', isCorrect: true },
    { text: '', isCorrect: false },
    { text: '', isCorrect: false },
    { text: '', isCorrect: false },
  ],
};

const EMPTY_CODING = {
  title: '',
  statement: '',
  marks: 10,
  negativeMarks: 0,
  inputFormat: '',
  outputFormat: '',
  constraints: '',
  testCases: [
    { input: '2\n3', output: '5', isHidden: false },
    { input: '10\n20', output: '30', isHidden: true },
  ],
};

export default function ContestDetailPage() {
  const { id: contestId } = useParams<{ id: string }>();
  const qc = useQueryClient();

  const [addSection, setAddSection] = useState(false);
  const [sectionTitle, setSectionTitle] = useState('');
  const [addQModal, setAddQModal] = useState<{ sectionId: string; type: 'mcq' | 'coding' } | null>(null);
  const [mcqForm, setMcqForm] = useState({ ...EMPTY_MCQ });
  const [codingForm, setCodingForm] = useState({ ...EMPTY_CODING });
  const [deleteQ, setDeleteQ] = useState<string | null>(null);
  const [deleteSec, setDeleteSec] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const { data: contestData } = useQuery({
    queryKey: ['contest', contestId],
    queryFn: () => contestsApi.get(contestId),
  });
  const contest = contestData as { title?: string } | null;

  const { data: sectionsData, isLoading: secLoading } = useQuery({
    queryKey: ['sections', contestId],
    queryFn: () => sectionsApi.getByContest(contestId),
  });
  const sections: Section[] = (sectionsData as Section[]) || [];

  const { data: questionsData, isLoading: qLoading } = useQuery({
    queryKey: ['questions', contestId],
    queryFn: () => questionsApi.getByContest(contestId),
  });
  const questions: Question[] = (questionsData as Question[]) || [];

  const createSection = useMutation({
    mutationFn: async () => {
      setErrorMsg(null);
      return sectionsApi.create({
        contestId,
        title: sectionTitle.trim(),
        order: sections.length,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['sections', contestId] });
      setAddSection(false);
      setSectionTitle('');
    },
    onError: (err: any) => {
      const msg = err.response?.data?.message || err.message || 'Failed to create section';
      setErrorMsg(typeof msg === 'string' ? msg : JSON.stringify(msg));
    },
  });

  const deleteSection = useMutation({
    mutationFn: (id: string) => sectionsApi.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['sections', contestId] });
      setDeleteSec(null);
    },
  });

  const createMcq = useMutation({
    mutationFn: async (sectionId: string) => {
      setErrorMsg(null);
      const statement = mcqForm.statement.trim() || mcqForm.title.trim() || 'Select the correct answer.';
      if (statement.length < 5) {
        throw new Error('Problem statement must be at least 5 characters');
      }

      const mcqOptions = mcqForm.options
        .filter((o) => o.text.trim().length > 0)
        .map((o, idx) => ({
          id: `opt_${Date.now()}_${idx}`,
          text: o.text.trim(),
          isCorrect: Boolean(o.isCorrect),
        }));

      if (mcqOptions.length < 2) {
        throw new Error('Please provide at least 2 non-empty options for MCQ');
      }

      const hasCorrect = mcqOptions.some((o) => o.isCorrect);
      if (!hasCorrect) {
        throw new Error('Please mark at least one option as correct');
      }

      return questionsApi.create({
        contestId,
        sectionId,
        type: 'mcq',
        title: mcqForm.title.trim(),
        statement,
        marks: Number(mcqForm.marks) || 1,
        negativeMarks: Number(mcqForm.negativeMarks) || 0,
        isMultiSelect: mcqForm.isMultiSelect,
        mcqOptions,
        order: questions.filter((q) => q.sectionId === sectionId).length,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['questions', contestId] });
      setAddQModal(null);
      setMcqForm({ ...EMPTY_MCQ });
    },
    onError: (err: any) => {
      const msg = err.response?.data?.message || err.message || 'Failed to create MCQ';
      setErrorMsg(typeof msg === 'string' ? msg : JSON.stringify(msg));
    },
  });

  const createCoding = useMutation({
    mutationFn: async (sectionId: string) => {
      setErrorMsg(null);
      const statement = codingForm.statement.trim() || codingForm.title.trim() || 'Write a program to solve this problem.';
      if (statement.length < 5) {
        throw new Error('Problem statement must be at least 5 characters');
      }

      const testCases = codingForm.testCases.map((tc, idx) => ({
        id: `tc_${Date.now()}_${idx}`,
        input: tc.input || '',
        expectedOutput: tc.output || '',
        isSample: !tc.isHidden,
        isHidden: Boolean(tc.isHidden),
        weight: 1,
        explanation: '',
      }));

      return questionsApi.create({
        contestId,
        sectionId,
        type: 'coding',
        title: codingForm.title.trim(),
        statement,
        marks: Number(codingForm.marks) || 10,
        negativeMarks: Number(codingForm.negativeMarks) || 0,
        order: questions.filter((q) => q.sectionId === sectionId).length,
        codingConfig: {
          inputFormat: codingForm.inputFormat || '',
          outputFormat: codingForm.outputFormat || '',
          constraints: codingForm.constraints || '',
          timeLimitMs: 2000,
          memoryLimitMb: 256,
          allowedLanguages: ['python', 'javascript', 'cpp', 'java'],
          starterCode: {
            python: '# Write your Python solution here\nimport sys\n\ndef solve():\n    lines = sys.stdin.read().splitlines()\n    # TODO\n\nif __name__ == "__main__":\n    solve()\n',
            javascript: '// Write your JavaScript solution here\nconst fs = require("fs");\nconst input = fs.readFileSync(0, "utf-8").trim();\nconsole.log(input);\n',
          },
          testCases,
        },
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['questions', contestId] });
      setAddQModal(null);
      setCodingForm({ ...EMPTY_CODING });
    },
    onError: (err: any) => {
      const msg = err.response?.data?.message || err.message || 'Failed to create coding problem';
      setErrorMsg(typeof msg === 'string' ? msg : JSON.stringify(msg));
    },
  });

  const deleteQuestion = useMutation({
    mutationFn: (id: string) => questionsApi.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['questions', contestId] });
      setDeleteQ(null);
    },
  });

  const openAddQ = (sectionId: string, type: 'mcq' | 'coding') => {
    setErrorMsg(null);
    if (type === 'mcq') setMcqForm({ ...EMPTY_MCQ });
    else setCodingForm({ ...EMPTY_CODING });
    setAddQModal({ sectionId, type });
  };

  const isLoading = secLoading || qLoading;

  return (
    <div className="p-6 sm:p-8 space-y-6 max-w-7xl mx-auto">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link
            href="/contests"
            className="flex items-center gap-1.5 text-xs font-semibold text-[#3760F8] hover:text-[#254EDB] px-3 py-1.5 rounded-lg bg-[#EEF2FF] hover:bg-[#E0E7FF] transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Contests</span>
          </Link>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">{contest?.title || 'Contest Sections'}</h1>
        </div>

        {/* Quick Nav Pills */}
        <div className="flex items-center gap-2 flex-wrap">
          <Link href={`/attendance/${contestId}`}>
            <Button variant="outline" size="sm" leftIcon={<UserCheck className="w-3.5 h-3.5 text-slate-500" />}>
              Attendance
            </Button>
          </Link>
          <Link href={`/assignments/${contestId}`}>
            <Button variant="outline" size="sm" leftIcon={<Users className="w-3.5 h-3.5 text-slate-500" />}>
              Assignments
            </Button>
          </Link>
          <Link href={`/leaderboard/${contestId}`}>
            <Button variant="outline" size="sm" leftIcon={<Trophy className="w-3.5 h-3.5 text-slate-500" />}>
              Leaderboard
            </Button>
          </Link>
          <Link href={`/reports/${contestId}`}>
            <Button variant="outline" size="sm" leftIcon={<BarChart3 className="w-3.5 h-3.5 text-slate-500" />}>
              Reports
            </Button>
          </Link>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-20">
          <Spinner size="lg" />
        </div>
      ) : (
        <div className="space-y-5">
          {sections.map((section) => {
            const sectionQuestions = questions.filter((q) => q.sectionId === section._id);
            return (
              <div
                key={section._id}
                className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden"
              >
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/70">
                  <div className="flex items-center gap-2.5">
                    <Layers className="w-4 h-4 text-[#3760F8]" />
                    <h2 className="font-bold text-slate-900 text-sm tracking-tight">{section.title}</h2>
                    <span className="text-[11px] font-semibold text-slate-500 bg-white border border-slate-200 px-2 py-0.5 rounded-full ml-1">
                      {sectionQuestions.length} Questions
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => openAddQ(section._id, 'mcq')}
                      leftIcon={<Plus className="w-3 h-3 text-[#3760F8]" />}
                    >
                      Add MCQ
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => openAddQ(section._id, 'coding')}
                      leftIcon={<Plus className="w-3 h-3 text-[#3760F8]" />}
                    >
                      Add Coding
                    </Button>
                    <button
                      onClick={() => setDeleteSec(section._id)}
                      className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition-colors"
                      title="Delete Section"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {sectionQuestions.length === 0 ? (
                  <div className="p-8 text-center text-xs text-slate-400">
                    No questions added yet to this section. Click &ldquo;Add MCQ&rdquo; or &ldquo;Add Coding&rdquo; above.
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100">
                    {sectionQuestions.map((q, qi) => (
                      <div
                        key={q._id}
                        className="flex items-center gap-3.5 px-6 py-3.5 hover:bg-slate-50/60 transition-colors"
                      >
                        <span className="w-6 h-6 rounded-lg bg-slate-100 flex items-center justify-center text-xs font-bold text-slate-600 font-mono">
                          {qi + 1}
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold text-slate-900 truncate tracking-tight">{q.title}</p>
                          {q.statement && <p className="text-[11px] text-slate-500 line-clamp-1">{q.statement}</p>}
                        </div>
                        <Badge color={q.type === 'coding' ? 'purple' : 'primary'}>
                          {q.type === 'coding' ? 'Coding' : 'MCQ'}
                        </Badge>
                        <span className="text-xs font-mono font-bold text-[#3760F8] bg-[#EEF2FF] px-2.5 py-0.5 rounded-md">
                          {q.marks} pts
                        </span>
                        {q.negativeMarks ? (
                          <span className="text-xs font-mono font-medium text-rose-600 bg-rose-50 px-2 py-0.5 rounded-md">
                            -{q.negativeMarks}
                          </span>
                        ) : null}
                        <button
                          onClick={() => setDeleteQ(q._id)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors ml-2"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}

          <button
            onClick={() => {
              setErrorMsg(null);
              setSectionTitle('');
              setAddSection(true);
            }}
            className="w-full border-2 border-dashed border-slate-200 hover:border-[#3760F8] rounded-2xl py-5 text-slate-500 hover:text-[#3760F8] hover:bg-[#EEF2FF]/20 transition-all text-xs font-semibold flex items-center justify-center gap-2"
          >
            <Plus className="w-4 h-4" />
            <span>Add New Contest Section</span>
          </button>
        </div>
      )}

      {/* Add Section Modal */}
      <Modal open={addSection} onClose={() => setAddSection(false)} title="Add Contest Section" size="sm">
        <div className="space-y-4">
          {errorMsg && (
            <div className="flex items-center gap-2.5 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}
          <Input
            label="Section Title"
            value={sectionTitle}
            onChange={(e) => setSectionTitle(e.target.value)}
            placeholder="e.g. Section A: Multiple Choice Questions"
          />
          <div className="flex gap-2.5 justify-end pt-2">
            <Button variant="outline" size="sm" onClick={() => setAddSection(false)}>
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={() => createSection.mutate()}
              loading={createSection.isPending}
              disabled={!sectionTitle.trim()}
            >
              Add Section
            </Button>
          </div>
        </div>
      </Modal>

      {/* Add MCQ Modal */}
      <Modal
        open={!!addQModal && addQModal.type === 'mcq'}
        onClose={() => setAddQModal(null)}
        title="Create Multiple Choice Question"
        size="lg"
      >
        <div className="space-y-4 max-h-[75vh] overflow-y-auto pr-1">
          {errorMsg && (
            <div className="flex items-center gap-2.5 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          <Input
            label="Question Title *"
            value={mcqForm.title}
            onChange={(e) => setMcqForm((f) => ({ ...f, title: e.target.value }))}
            placeholder="e.g. Time complexity of QuickSelect"
          />

          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-1">Problem Statement / Question *</label>
            <textarea
              className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 focus:ring-2 focus:ring-[#3760F8]/30 focus:outline-none"
              rows={3}
              value={mcqForm.statement}
              onChange={(e) => setMcqForm((f) => ({ ...f, statement: e.target.value }))}
              placeholder="State the question clearly..."
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Positive Marks"
              type="number"
              min="1"
              value={String(mcqForm.marks)}
              onChange={(e) => setMcqForm((f) => ({ ...f, marks: Number(e.target.value) }))}
            />
            <Input
              label="Negative Penalty"
              type="number"
              min="0"
              value={String(mcqForm.negativeMarks)}
              onChange={(e) => setMcqForm((f) => ({ ...f, negativeMarks: Number(e.target.value) }))}
            />
          </div>

          <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer">
            <input
              type="checkbox"
              className="w-4 h-4 accent-[#3760F8] rounded"
              checked={mcqForm.isMultiSelect}
              onChange={(e) => setMcqForm((f) => ({ ...f, isMultiSelect: e.target.checked }))}
            />
            <span>Multiple Choice (Multiple Correct Options Allowed)</span>
          </label>

          <div className="space-y-2.5 pt-1">
            <label className="text-xs font-bold text-slate-800 block">
              Options &amp; Correct Answer Checkbox (Check the correct answer)
            </label>
            {mcqForm.options.map((opt, oi) => (
              <div key={oi} className="flex items-center gap-2.5">
                <input
                  type={mcqForm.isMultiSelect ? 'checkbox' : 'radio'}
                  name="mcqCorrectOption"
                  className="w-4 h-4 accent-[#3760F8] rounded cursor-pointer"
                  checked={opt.isCorrect}
                  onChange={(e) =>
                    setMcqForm((f) => ({
                      ...f,
                      options: f.options.map((o, i) =>
                        mcqForm.isMultiSelect
                          ? i === oi
                            ? { ...o, isCorrect: e.target.checked }
                            : o
                          : { ...o, isCorrect: i === oi }
                      ),
                    }))
                  }
                />
                <input
                  className="flex-1 border border-slate-200 rounded-xl px-3.5 py-2 text-xs text-slate-900 bg-white focus:ring-2 focus:ring-[#3760F8]/30 focus:outline-none"
                  value={opt.text}
                  placeholder={`Option ${String.fromCharCode(65 + oi)} text`}
                  onChange={(e) =>
                    setMcqForm((f) => ({
                      ...f,
                      options: f.options.map((o, i) => (i === oi ? { ...o, text: e.target.value } : o)),
                    }))
                  }
                />
              </div>
            ))}
          </div>

          <div className="flex gap-2.5 justify-end pt-3 border-t border-slate-100">
            <Button variant="outline" size="sm" onClick={() => setAddQModal(null)}>
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={() => addQModal && createMcq.mutate(addQModal.sectionId)}
              loading={createMcq.isPending}
              disabled={!mcqForm.title.trim()}
            >
              Add MCQ Question
            </Button>
          </div>
        </div>
      </Modal>

      {/* Add Coding Modal */}
      <Modal
        open={!!addQModal && addQModal.type === 'coding'}
        onClose={() => setAddQModal(null)}
        title="Create Coding Problem"
        size="xl"
      >
        <div className="space-y-4 max-h-[75vh] overflow-y-auto pr-1">
          {errorMsg && (
            <div className="flex items-center gap-2.5 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          <Input
            label="Problem Title *"
            value={codingForm.title}
            onChange={(e) => setCodingForm((f) => ({ ...f, title: e.target.value }))}
            placeholder="e.g. Two Sum / Array Balancing"
          />

          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-1">Problem Description &amp; Requirements *</label>
            <textarea
              className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 focus:ring-2 focus:ring-[#3760F8]/30 focus:outline-none font-sans"
              rows={4}
              value={codingForm.statement}
              onChange={(e) => setCodingForm((f) => ({ ...f, statement: e.target.value }))}
              placeholder="Describe problem specification, inputs, outputs and constraints..."
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Max Score Marks"
              type="number"
              min="1"
              value={String(codingForm.marks)}
              onChange={(e) => setCodingForm((f) => ({ ...f, marks: Number(e.target.value) }))}
            />
            <Input
              label="Negative Marks"
              type="number"
              min="0"
              value={String(codingForm.negativeMarks)}
              onChange={(e) => setCodingForm((f) => ({ ...f, negativeMarks: Number(e.target.value) }))}
            />
          </div>

          {/* Test Cases */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-800">Test Cases Suite</label>
              <button
                type="button"
                className="text-xs font-semibold text-[#3760F8] hover:underline flex items-center gap-1"
                onClick={() =>
                  setCodingForm((f) => ({
                    ...f,
                    testCases: [...f.testCases, { input: '', output: '', isHidden: false }],
                  }))
                }
              >
                <Plus className="w-3.5 h-3.5" /> Add Test Case
              </button>
            </div>

            {codingForm.testCases.map((tc, ti) => (
              <div key={ti} className="border border-slate-200 rounded-2xl p-3.5 space-y-2.5 bg-slate-50/50">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-700 font-mono">Case #{ti + 1}</span>
                  <div className="flex items-center gap-3">
                    <label className="flex items-center gap-1.5 text-xs text-slate-600 cursor-pointer">
                      <input
                        type="checkbox"
                        className="accent-[#3760F8] rounded"
                        checked={tc.isHidden}
                        onChange={(e) =>
                          setCodingForm((f) => ({
                            ...f,
                            testCases: f.testCases.map((t, i) => (i === ti ? { ...t, isHidden: e.target.checked } : t)),
                          }))
                        }
                      />
                      <span>Hidden Evaluation Test</span>
                    </label>
                    {codingForm.testCases.length > 1 && (
                      <button
                        type="button"
                        onClick={() =>
                          setCodingForm((f) => ({
                            ...f,
                            testCases: f.testCases.filter((_, i) => i !== ti),
                          }))
                        }
                        className="text-slate-400 hover:text-rose-600"
                        title="Remove test case"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div>
                    <label className="text-[10px] font-semibold text-slate-500 uppercase block mb-1">Standard Input (STDIN)</label>
                    <textarea
                      className="w-full border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs font-mono focus:ring-1 focus:ring-[#3760F8] focus:outline-none bg-white"
                      rows={2}
                      value={tc.input}
                      onChange={(e) =>
                        setCodingForm((f) => ({
                          ...f,
                          testCases: f.testCases.map((t, i) => (i === ti ? { ...t, input: e.target.value } : t)),
                        }))
                      }
                      placeholder="Input data"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-semibold text-slate-500 uppercase block mb-1">Expected Output (STDOUT)</label>
                    <textarea
                      className="w-full border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs font-mono focus:ring-1 focus:ring-[#3760F8] focus:outline-none bg-white"
                      rows={2}
                      value={tc.output}
                      onChange={(e) =>
                        setCodingForm((f) => ({
                          ...f,
                          testCases: f.testCases.map((t, i) => (i === ti ? { ...t, output: e.target.value } : t)),
                        }))
                      }
                      placeholder="Expected output"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="flex gap-2.5 justify-end pt-3 border-t border-slate-100">
            <Button variant="outline" size="sm" onClick={() => setAddQModal(null)}>
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={() => addQModal && createCoding.mutate(addQModal.sectionId)}
              loading={createCoding.isPending}
              disabled={!codingForm.title.trim()}
            >
              Add Coding Problem
            </Button>
          </div>
        </div>
      </Modal>

      {/* Confirmation Dialogs */}
      <ConfirmDialog
        open={!!deleteQ}
        onClose={() => setDeleteQ(null)}
        onConfirm={() => deleteQ && deleteQuestion.mutate(deleteQ)}
        loading={deleteQuestion.isPending}
        title="Delete Question"
        message="Are you sure you want to delete this question? Any submitted attempts for this question will be impacted."
        danger
        confirmLabel="Delete"
      />
      <ConfirmDialog
        open={!!deleteSec}
        onClose={() => setDeleteSec(null)}
        onConfirm={() => deleteSec && deleteSection.mutate(deleteSec)}
        loading={deleteSection.isPending}
        title="Delete Section"
        message="Are you sure you want to delete this whole section and its questions?"
        danger
        confirmLabel="Delete Section"
      />
    </div>
  );
}
