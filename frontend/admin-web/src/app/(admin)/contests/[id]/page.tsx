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
  const [editQ, setEditQ] = useState<Question | null>(null);

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
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/contests" className="text-blue-600 hover:underline text-sm">← Contests</Link>
        <h1 className="text-2xl font-bold text-gray-900">{contest?.title || 'Contest Detail'}</h1>
      </div>

      <div className="flex gap-3">
        <Link href={`/attendance/${contestId}`}><Button variant="outline" size="sm">Attendance</Button></Link>
        <Link href={`/assignments/${contestId}`}><Button variant="outline" size="sm">Assignments</Button></Link>
        <Link href={`/leaderboard/${contestId}`}><Button variant="outline" size="sm">Leaderboard</Button></Link>
        <Link href={`/reports/${contestId}`}><Button variant="outline" size="sm">Reports</Button></Link>
      </div>

      {isLoading ? <div className="flex justify-center py-16"><Spinner size="lg" /></div> : (
        <div className="space-y-4">
          {sections.map((section) => {
            const sectionQuestions = questions.filter((q) => q.sectionId === section._id);
            return (
              <div key={section._id} className="bg-white rounded-xl border border-gray-200">
                <div className="flex items-center justify-between px-5 py-3 border-b bg-gray-50 rounded-t-xl">
                  <h2 className="font-semibold text-gray-800">{section.title}</h2>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => setAddQModal({ sectionId: section._id, type: 'mcq' })}>+ MCQ</Button>
                    <Button size="sm" variant="outline" onClick={() => setAddQModal({ sectionId: section._id, type: 'coding' })}>+ Coding</Button>
                    <button onClick={() => setDeleteSec(section._id)} className="text-xs text-red-500 hover:text-red-700 px-2">Delete Section</button>
                  </div>
                </div>
                {sectionQuestions.length === 0 ? (
                  <p className="text-center text-gray-400 text-sm py-6">No questions yet. Add MCQ or Coding questions.</p>
                ) : (
                  <div className="divide-y">
                    {sectionQuestions.map((q, qi) => (
                      <div key={q._id} className="flex items-center gap-3 px-5 py-3">
                        <span className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center text-xs font-bold text-gray-600">{qi + 1}</span>
                        <span className="flex-1 text-sm text-gray-800">{q.title}</span>
                        <Badge color={q.type === 'coding' ? 'purple' : 'blue'}>{q.type}</Badge>
                        <span className="text-xs text-gray-500">{q.marks}m</span>
                        {q.negativeMarks ? <span className="text-xs text-red-400">-{q.negativeMarks}</span> : null}
                        <button onClick={() => setDeleteQ(q._id)} className="text-xs text-red-500 hover:text-red-700 ml-2">Delete</button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}

          <button
            onClick={() => setAddSection(true)}
            className="w-full border-2 border-dashed border-gray-300 rounded-xl py-4 text-gray-500 hover:border-blue-400 hover:text-blue-600 transition-colors text-sm"
          >
            + Add Section
          </button>
        </div>
      )}

      {/* Add Section Modal */}
      <Modal open={addSection} onClose={() => setAddSection(false)} title="Add Section" size="sm">
        <Input label="Section Title" value={sectionTitle} onChange={(e) => setSectionTitle(e.target.value)} placeholder="e.g. Part A — MCQ" />
        <div className="flex gap-3 justify-end mt-4">
          <Button variant="outline" onClick={() => setAddSection(false)}>Cancel</Button>
          <Button onClick={() => createSection.mutate()} loading={createSection.isPending}>Add</Button>
        </div>
      </Modal>

      {/* Add MCQ Modal */}
      <Modal open={!!addQModal && addQModal.type === 'mcq'} onClose={() => setAddQModal(null)} title="Add MCQ Question" size="lg">
        <div className="space-y-3">
          <Input label="Title" value={mcqForm.title} onChange={(e) => setMcqForm((f) => ({ ...f, title: e.target.value }))} />
          <div>
            <label className="text-sm font-medium text-gray-700">Statement</label>
            <textarea className="mt-1 w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none" rows={3} value={mcqForm.statement} onChange={(e) => setMcqForm((f) => ({ ...f, statement: e.target.value }))} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input label="Marks" type="number" value={String(mcqForm.marks)} onChange={(e) => setMcqForm((f) => ({ ...f, marks: Number(e.target.value) }))} />
            <Input label="Negative Marks" type="number" value={String(mcqForm.negativeMarks)} onChange={(e) => setMcqForm((f) => ({ ...f, negativeMarks: Number(e.target.value) }))} />
          </div>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input type="checkbox" checked={mcqForm.isMultiSelect} onChange={(e) => setMcqForm((f) => ({ ...f, isMultiSelect: e.target.checked }))} />
            Multi-select
          </label>
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">Options (check correct answers)</label>
            {mcqForm.options.map((opt, oi) => (
              <div key={oi} className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={opt.isCorrect}
                  onChange={(e) => setMcqForm((f) => ({
                    ...f,
                    options: f.options.map((o, i) => i === oi ? { ...o, isCorrect: e.target.checked } : o),
                  }))}
                />
                <input
                  className="flex-1 border rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  value={opt.text}
                  placeholder={`Option ${String.fromCharCode(65 + oi)}`}
                  onChange={(e) => setMcqForm((f) => ({
                    ...f,
                    options: f.options.map((o, i) => i === oi ? { ...o, text: e.target.value } : o),
                  }))}
                />
              </div>
            ))}
          </div>
          <div className="flex gap-3 justify-end pt-2">
            <Button variant="outline" onClick={() => setAddQModal(null)}>Cancel</Button>
            <Button onClick={() => addQModal && createMcq.mutate(addQModal.sectionId)} loading={createMcq.isPending}>Add Question</Button>
          </div>
        </div>
      </Modal>

      {/* Add Coding Modal */}
      <Modal open={!!addQModal && addQModal.type === 'coding'} onClose={() => setAddQModal(null)} title="Add Coding Question" size="xl">
        <div className="space-y-3">
          <Input label="Title" value={codingForm.title} onChange={(e) => setCodingForm((f) => ({ ...f, title: e.target.value }))} />
          <div>
            <label className="text-sm font-medium text-gray-700">Problem Statement</label>
            <textarea className="mt-1 w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none" rows={5} value={codingForm.statement} onChange={(e) => setCodingForm((f) => ({ ...f, statement: e.target.value }))} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input label="Marks" type="number" value={String(codingForm.marks)} onChange={(e) => setCodingForm((f) => ({ ...f, marks: Number(e.target.value) }))} />
            <Input label="Negative Marks" type="number" value={String(codingForm.negativeMarks)} onChange={(e) => setCodingForm((f) => ({ ...f, negativeMarks: Number(e.target.value) }))} />
          </div>
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-gray-700">Test Cases</label>
              <button className="text-xs text-blue-600 hover:underline" onClick={() => setCodingForm((f) => ({ ...f, testCases: [...f.testCases, { input: '', output: '', isHidden: false }] }))}>+ Add Case</button>
            </div>
            {codingForm.testCases.map((tc, ti) => (
              <div key={ti} className="border rounded-lg p-3 mb-2 space-y-2">
                <div className="flex items-center gap-3">
                  <span className="text-xs font-medium text-gray-600">Case {ti + 1}</span>
                  <label className="flex items-center gap-1 text-xs cursor-pointer ml-auto">
                    <input type="checkbox" checked={tc.isHidden} onChange={(e) => setCodingForm((f) => ({ ...f, testCases: f.testCases.map((t, i) => i === ti ? { ...t, isHidden: e.target.checked } : t) }))} />
                    Hidden
                  </label>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-xs text-gray-500">Input</label>
                    <textarea className="w-full border rounded px-2 py-1 text-xs font-mono focus:ring-1 focus:ring-blue-500 focus:outline-none" rows={2} value={tc.input} onChange={(e) => setCodingForm((f) => ({ ...f, testCases: f.testCases.map((t, i) => i === ti ? { ...t, input: e.target.value } : t) }))} />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500">Expected Output</label>
                    <textarea className="w-full border rounded px-2 py-1 text-xs font-mono focus:ring-1 focus:ring-blue-500 focus:outline-none" rows={2} value={tc.output} onChange={(e) => setCodingForm((f) => ({ ...f, testCases: f.testCases.map((t, i) => i === ti ? { ...t, output: e.target.value } : t) }))} />
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div className="flex gap-3 justify-end pt-2">
            <Button variant="outline" onClick={() => setAddQModal(null)}>Cancel</Button>
            <Button onClick={() => addQModal && createCoding.mutate(addQModal.sectionId)} loading={createCoding.isPending}>Add Question</Button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog open={!!deleteQ} onClose={() => setDeleteQ(null)} onConfirm={() => deleteQ && deleteQuestion.mutate(deleteQ)} loading={deleteQuestion.isPending} title="Delete Question" message="Delete this question?" danger confirmLabel="Delete" />
      <ConfirmDialog open={!!deleteSec} onClose={() => setDeleteSec(null)} onConfirm={() => deleteSec && deleteSection.mutate(deleteSec)} loading={deleteSection.isPending} title="Delete Section" message="Delete this section and all its questions?" danger confirmLabel="Delete" />
    </div>
  );
}
