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
} from 'lucide-react';

interface Section { _id: string; title: string; order: number }
interface Question {
  _id: string;
  title: string;
  type: 'mcq' | 'coding';
  marks: number;
  negativeMarks?: number;
  sectionId: string;
}
interface McqOption { text: string; isCorrect: boolean }
interface TestCase { input: string; output: string; isHidden: boolean; label?: string }

const EMPTY_MCQ: {
  title: string; statement: string; marks: number; negativeMarks: number;
  isMultiSelect: boolean; options: McqOption[];
} = {
  title: '', statement: '', marks: 1, negativeMarks: 0, isMultiSelect: false,
  options: [{ text: '', isCorrect: false }, { text: '', isCorrect: false }, { text: '', isCorrect: false }, { text: '', isCorrect: false }],
};

const EMPTY_CODING: {
  title: string; statement: string; marks: number; negativeMarks: number;
  testCases: TestCase[]; starterCode: string; languageIds: number[];
} = {
  title: '', statement: '', marks: 10, negativeMarks: 0,
  testCases: [{ input: '', output: '', isHidden: false, label: 'Sample 1' }],
  starterCode: '', languageIds: [71, 63, 54],
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

  const { data: contestData } = useQuery({ queryKey: ['contest', contestId], queryFn: () => contestsApi.get(contestId) });
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
    mutationFn: () => sectionsApi.create({ contestId, title: sectionTitle, order: sections.length }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['sections', contestId] }); setAddSection(false); setSectionTitle(''); },
  });

  const deleteSection = useMutation({
    mutationFn: (id: string) => sectionsApi.delete(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['sections', contestId] }); setDeleteSec(null); },
  });

  const createMcq = useMutation({
    mutationFn: (sectionId: string) =>
      questionsApi.create({
        contestId, sectionId, type: 'mcq',
        title: mcqForm.title, statement: mcqForm.statement,
        marks: mcqForm.marks, negativeMarks: mcqForm.negativeMarks,
        isMultiSelect: mcqForm.isMultiSelect,
        mcqOptions: mcqForm.options,
      }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['questions', contestId] }); setAddQModal(null); setMcqForm({ ...EMPTY_MCQ }); },
  });

  const createCoding = useMutation({
    mutationFn: (sectionId: string) =>
      questionsApi.create({
        contestId, sectionId, type: 'coding',
        title: codingForm.title, statement: codingForm.statement,
        marks: codingForm.marks, negativeMarks: codingForm.negativeMarks,
        testCases: codingForm.testCases,
        starterCode: codingForm.starterCode,
        languageIds: codingForm.languageIds,
      }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['questions', contestId] }); setAddQModal(null); setCodingForm({ ...EMPTY_CODING }); },
  });

  const deleteQuestion = useMutation({
    mutationFn: (id: string) => questionsApi.delete(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['questions', contestId] }); setDeleteQ(null); },
  });

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
        <div className="flex justify-center py-20"><Spinner size="lg" /></div>
      ) : (
        <div className="space-y-5">
          {sections.map((section) => {
            const sectionQuestions = questions.filter((q) => q.sectionId === section._id);
            return (
              <div key={section._id} className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/70">
                  <div className="flex items-center gap-2.5">
                    <Layers className="w-4 h-4 text-[#3760F8]" />
                    <h2 className="font-bold text-slate-900 text-sm tracking-tight">{section.title}</h2>
                    <span className="text-[11px] font-semibold text-slate-400 bg-white border border-slate-200 px-2 py-0.5 rounded-full ml-1">
                      {sectionQuestions.length} Questions
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setAddQModal({ sectionId: section._id, type: 'mcq' })}
                      leftIcon={<Plus className="w-3 h-3 text-[#3760F8]" />}
                    >
                      Add MCQ
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setAddQModal({ sectionId: section._id, type: 'coding' })}
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
                      <div key={q._id} className="flex items-center gap-3.5 px-6 py-3.5 hover:bg-slate-50/60 transition-colors">
                        <span className="w-6 h-6 rounded-lg bg-slate-100 flex items-center justify-center text-xs font-bold text-slate-600 font-mono">
                          {qi + 1}
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold text-slate-900 truncate tracking-tight">{q.title}</p>
                        </div>
                        <Badge color={q.type === 'coding' ? 'purple' : 'primary'}>
                          {q.type === 'coding' ? 'Coding' : 'MCQ'}
                        </Badge>
                        <span className="text-xs font-mono font-bold text-[#3760F8] bg-[#EEF2FF] px-2 py-0.5 rounded-md">
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
            onClick={() => setAddSection(true)}
            className="w-full border-2 border-dashed border-slate-200 hover:border-[#3760F8] rounded-2xl py-5 text-slate-500 hover:text-[#3760F8] hover:bg-[#EEF2FF]/20 transition-all text-xs font-semibold flex items-center justify-center gap-2"
          >
            <Plus className="w-4 h-4" />
            <span>Add New Contest Section</span>
          </button>
        </div>
      )}

      {/* Add Section Modal */}
      <Modal open={addSection} onClose={() => setAddSection(false)} title="Add Section" size="sm">
        <div className="space-y-4">
          <Input label="Section Title" value={sectionTitle} onChange={(e) => setSectionTitle(e.target.value)} placeholder="e.g. Part A: Fundamental Algorithms" />
          <div className="flex gap-2.5 justify-end pt-2">
            <Button variant="outline" size="sm" onClick={() => setAddSection(false)}>Cancel</Button>
            <Button size="sm" onClick={() => createSection.mutate()} loading={createSection.isPending}>Add Section</Button>
          </div>
        </div>
      </Modal>

      {/* Add MCQ Modal */}
      <Modal open={!!addQModal && addQModal.type === 'mcq'} onClose={() => setAddQModal(null)} title="Create Multiple Choice Question" size="lg">
        <div className="space-y-4">
          <Input label="Question Title" value={mcqForm.title} onChange={(e) => setMcqForm((f) => ({ ...f, title: e.target.value }))} placeholder="e.g. Time complexity of QuickSelect" />
          <div>
            <label className="text-xs font-semibold text-slate-700">Problem Statement</label>
            <textarea
              className="mt-1 w-full border border-slate-200 rounded-xl px-3.5 py-2 text-sm focus:ring-2 focus:ring-[#3760F8]/30 focus:outline-none"
              rows={3}
              value={mcqForm.statement}
              onChange={(e) => setMcqForm((f) => ({ ...f, statement: e.target.value }))}
              placeholder="State the problem scenario..."
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input label="Positive Marks" type="number" value={String(mcqForm.marks)} onChange={(e) => setMcqForm((f) => ({ ...f, marks: Number(e.target.value) }))} />
            <Input label="Negative Penalty" type="number" value={String(mcqForm.negativeMarks)} onChange={(e) => setMcqForm((f) => ({ ...f, negativeMarks: Number(e.target.value) }))} />
          </div>
          <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer">
            <input type="checkbox" className="w-4 h-4 accent-[#3760F8] rounded" checked={mcqForm.isMultiSelect} onChange={(e) => setMcqForm((f) => ({ ...f, isMultiSelect: e.target.checked }))} />
            <span>Multiple Choice (Multiple Correct Options Allowed)</span>
          </label>
          <div className="space-y-2.5 pt-1">
            <label className="text-xs font-bold text-slate-800">Options &amp; Correct Answer Check</label>
            {mcqForm.options.map((opt, oi) => (
              <div key={oi} className="flex items-center gap-2.5">
                <input
                  type="checkbox"
                  className="w-4 h-4 accent-[#3760F8] rounded"
                  checked={opt.isCorrect}
                  onChange={(e) => setMcqForm((f) => ({
                    ...f,
                    options: f.options.map((o, i) => i === oi ? { ...o, isCorrect: e.target.checked } : o),
                  }))}
                />
                <input
                  className="flex-1 border border-slate-200 rounded-xl px-3.5 py-2 text-xs text-slate-800 focus:ring-2 focus:ring-[#3760F8]/30 focus:outline-none"
                  value={opt.text}
                  placeholder={`Option ${String.fromCharCode(65 + oi)} statement`}
                  onChange={(e) => setMcqForm((f) => ({
                    ...f,
                    options: f.options.map((o, i) => i === oi ? { ...o, text: e.target.value } : o),
                  }))}
                />
              </div>
            ))}
          </div>
          <div className="flex gap-2.5 justify-end pt-3">
            <Button variant="outline" size="sm" onClick={() => setAddQModal(null)}>Cancel</Button>
            <Button size="sm" onClick={() => addQModal && createMcq.mutate(addQModal.sectionId)} loading={createMcq.isPending}>Add MCQ Question</Button>
          </div>
        </div>
      </Modal>

      {/* Add Coding Modal */}
      <Modal open={!!addQModal && addQModal.type === 'coding'} onClose={() => setAddQModal(null)} title="Create Coding Problem" size="xl">
        <div className="space-y-4">
          <Input label="Problem Title" value={codingForm.title} onChange={(e) => setCodingForm((f) => ({ ...f, title: e.target.value }))} placeholder="e.g. Subarray with Given Sum" />
          <div>
            <label className="text-xs font-semibold text-slate-700">Detailed Statement &amp; Constraints</label>
            <textarea
              className="mt-1 w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm focus:ring-2 focus:ring-[#3760F8]/30 focus:outline-none font-sans"
              rows={5}
              value={codingForm.statement}
              onChange={(e) => setCodingForm((f) => ({ ...f, statement: e.target.value }))}
              placeholder="Describe input, output, constraints and examples..."
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input label="Max Score Marks" type="number" value={String(codingForm.marks)} onChange={(e) => setCodingForm((f) => ({ ...f, marks: Number(e.target.value) }))} />
            <Input label="Negative Marks" type="number" value={String(codingForm.negativeMarks)} onChange={(e) => setCodingForm((f) => ({ ...f, negativeMarks: Number(e.target.value) }))} />
          </div>
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-bold text-slate-800">Test Cases Suite</label>
              <button
                className="text-xs font-semibold text-[#3760F8] hover:underline"
                onClick={() => setCodingForm((f) => ({ ...f, testCases: [...f.testCases, { input: '', output: '', isHidden: false }] }))}
              >
                + Add Test Case
              </button>
            </div>
            {codingForm.testCases.map((tc, ti) => (
              <div key={ti} className="border border-slate-200 rounded-2xl p-3.5 mb-2.5 space-y-2 bg-slate-50/50">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-700 font-mono">Case {ti + 1}</span>
                  <label className="flex items-center gap-1.5 text-xs text-slate-600 cursor-pointer">
                    <input
                      type="checkbox"
                      className="accent-[#3760F8] rounded"
                      checked={tc.isHidden}
                      onChange={(e) => setCodingForm((f) => ({ ...f, testCases: f.testCases.map((t, i) => i === ti ? { ...t, isHidden: e.target.checked } : t) }))}
                    />
                    <span>Hidden from Student</span>
                  </label>
                </div>
                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <label className="text-[10px] font-semibold text-slate-500 uppercase">STDIN</label>
                    <textarea className="w-full border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs font-mono focus:ring-1 focus:ring-[#3760F8] focus:outline-none bg-white" rows={2} value={tc.input} onChange={(e) => setCodingForm((f) => ({ ...f, testCases: f.testCases.map((t, i) => i === ti ? { ...t, input: e.target.value } : t) }))} />
                  </div>
                  <div>
                    <label className="text-[10px] font-semibold text-slate-500 uppercase">STDOUT</label>
                    <textarea className="w-full border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs font-mono focus:ring-1 focus:ring-[#3760F8] focus:outline-none bg-white" rows={2} value={tc.output} onChange={(e) => setCodingForm((f) => ({ ...f, testCases: f.testCases.map((t, i) => i === ti ? { ...t, output: e.target.value } : t) }))} />
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div className="flex gap-2.5 justify-end pt-3">
            <Button variant="outline" size="sm" onClick={() => setAddQModal(null)}>Cancel</Button>
            <Button size="sm" onClick={() => addQModal && createCoding.mutate(addQModal.sectionId)} loading={createCoding.isPending}>Add Coding Problem</Button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog open={!!deleteQ} onClose={() => setDeleteQ(null)} onConfirm={() => deleteQ && deleteQuestion.mutate(deleteQ)} loading={deleteQuestion.isPending} title="Delete Question" message="Are you sure you want to delete this question? Any submitted answers to this question will be affected." danger confirmLabel="Delete" />
      <ConfirmDialog open={!!deleteSec} onClose={() => setDeleteSec(null)} onConfirm={() => deleteSec && deleteSection.mutate(deleteSec)} loading={deleteSection.isPending} title="Delete Section" message="Are you sure you want to delete this whole section and its questions?" danger confirmLabel="Delete" />
    </div>
  );
}
