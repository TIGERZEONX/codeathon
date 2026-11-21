'use client';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { rubricsApi } from '@/lib/api';
import { getErrorMessage } from '@/lib/apiClient';
import { Table } from '@/components/ui/Table';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Badge } from '@/components/ui/Badge';
import { Plus, Trash2, Edit2, Copy, Scale, CheckCircle2, X, AlertCircle } from 'lucide-react';

const CRITERIA_TYPE_OPTIONS = [
  { value: 'test_cases_passed_pct', label: 'Public Test Cases Passed (%)' },
  { value: 'hidden_test_cases_passed_pct', label: 'Hidden Test Cases (%)' },
  { value: 'mcq_accuracy', label: 'MCQ Accuracy (%)' },
  { value: 'completion_time', label: 'Completion Speed (Time)' },
  { value: 'runtime_efficiency', label: 'Runtime & Memory Efficiency' },
  { value: 'code_quality_manual', label: 'Code Quality & Structure' },
  { value: 'attempts_penalty', label: 'Submission Attempts Penalty' },
] as const;

type CriterionType = (typeof CRITERIA_TYPE_OPTIONS)[number]['value'];

interface Criterion {
  name: string;
  type: CriterionType;
  weight: number | string;
  description?: string;
}

interface Rubric {
  _id: string;
  name: string;
  description?: string;
  isPredefined?: boolean;
  criteria: Criterion[];
}

const DEFAULT_CRITERIA: Criterion[] = [
  { name: 'Public Test Cases', type: 'test_cases_passed_pct', weight: 60, description: 'Percentage of passed sample and visible test cases' },
  { name: 'Hidden Test Cases', type: 'hidden_test_cases_passed_pct', weight: 40, description: 'Percentage of passed hidden evaluation test cases' },
];

export default function RubricsPage() {
  const qc = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [editRubric, setEditRubric] = useState<Rubric | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [form, setForm] = useState<{
    name: string;
    description: string;
    criteria: Criterion[];
  }>({
    name: '',
    description: '',
    criteria: DEFAULT_CRITERIA.map((c) => ({ ...c })),
  });

  const { data: rubricsData, isLoading } = useQuery({
    queryKey: ['rubrics'],
    queryFn: rubricsApi.list,
  });
  const rubrics: Rubric[] = (rubricsData as Rubric[]) || [];

  const totalWeight = form.criteria.reduce((s, c) => s + (Number(c.weight) || 0), 0);

  const createMutation = useMutation({
    mutationFn: async () => {
      setErrorMsg(null);
      const payload = {
        name: form.name.trim(),
        description: form.description.trim() || undefined,
        criteria: form.criteria.map((c) => ({
          name: c.name.trim() || 'Criterion',
          type: c.type,
          weight: Number(c.weight),
          description: c.description?.trim() || '',
        })),
      };
      return rubricsApi.create(payload);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['rubrics'] });
      setShowCreate(false);
      setForm({ name: '', description: '', criteria: DEFAULT_CRITERIA.map((c) => ({ ...c })) });
    },
    onError: (err: any) => {
      setErrorMsg(getErrorMessage(err, 'Failed to create rubric'));
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id }: { id: string }) => {
      setErrorMsg(null);
      const payload = {
        name: form.name.trim(),
        description: form.description.trim() || undefined,
        criteria: form.criteria.map((c) => ({
          name: c.name.trim() || 'Criterion',
          type: c.type,
          weight: Number(c.weight),
          description: c.description?.trim() || '',
        })),
      };
      return rubricsApi.update(id, payload);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['rubrics'] });
      setEditRubric(null);
    },
    onError: (err: any) => {
      setErrorMsg(getErrorMessage(err, 'Failed to update rubric'));
    },
  });

  const cloneMutation = useMutation({
    mutationFn: (id: string) => rubricsApi.clone(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['rubrics'] }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => rubricsApi.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['rubrics'] });
      setDeleteId(null);
    },
  });

  const openCreate = () => {
    setErrorMsg(null);
    setForm({
      name: '',
      description: '',
      criteria: [
        { name: 'Public Test Cases', type: 'test_cases_passed_pct', weight: 60, description: 'Evaluation on sample test cases' },
        { name: 'Hidden Test Cases', type: 'hidden_test_cases_passed_pct', weight: 40, description: 'Evaluation on boundary/hidden tests' },
      ],
    });
    setShowCreate(true);
  };

  const openEdit = (r: Rubric) => {
    setErrorMsg(null);
    setEditRubric(r);
    setForm({
      name: r.name,
      description: r.description || '',
      criteria: r.criteria.map((c) => ({
        name: c.name,
        type: c.type || 'test_cases_passed_pct',
        weight: c.weight,
        description: c.description || '',
      })),
    });
  };

  const addCriterion = () => {
    setForm((f) => ({
      ...f,
      criteria: [
        ...f.criteria,
        {
          name: '',
          type: 'runtime_efficiency',
          weight: Math.max(0, 100 - totalWeight),
          description: '',
        },
      ],
    }));
  };

  const removeCriterion = (idx: number) => {
    setForm((f) => ({ ...f, criteria: f.criteria.filter((_, i) => i !== idx) }));
  };

  const updateCriterion = (idx: number, field: string, value: any) => {
    setForm((f) => ({
      ...f,
      criteria: f.criteria.map((c, i) => (i === idx ? { ...c, [field]: value } : c)),
    }));
  };

  const columns = [
    {
      key: 'name',
      header: 'Rubric Profile',
      render: (r: Rubric) => (
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-[#3760F8]/10 text-[#3760F8] flex items-center justify-center shrink-0">
            <Scale className="w-4 h-4" />
          </div>
          <div>
            <span className="font-semibold text-slate-900 tracking-tight text-sm block">{r.name}</span>
            {r.description && <span className="text-xs text-slate-500 line-clamp-1">{r.description}</span>}
          </div>
        </div>
      ),
    },
    {
      key: 'type',
      header: 'Classification',
      render: (r: Rubric) => (
        <Badge color={r.isPredefined ? 'primary' : 'neon'}>
          {r.isPredefined ? 'System Default' : 'Custom Weighted'}
        </Badge>
      ),
    },
    {
      key: 'criteria',
      header: 'Weighted Criteria Composition',
      render: (r: Rubric) => (
        <div className="flex gap-1.5 flex-wrap">
          {r.criteria.map((c, i) => (
            <span
              key={i}
              className="text-xs font-mono bg-slate-100 text-slate-700 px-2.5 py-1 rounded-lg border border-slate-200"
            >
              {c.name || c.type}: <strong className="text-slate-900">{c.weight}%</strong>
            </span>
          ))}
        </div>
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (r: Rubric) => (
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => cloneMutation.mutate(r._id)}
            leftIcon={<Copy className="w-3.5 h-3.5" />}
          >
            Clone
          </Button>
          {!r.isPredefined && (
            <>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => openEdit(r)}
                leftIcon={<Edit2 className="w-3.5 h-3.5" />}
              >
                Edit
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="text-rose-600 hover:text-rose-700 hover:bg-rose-50"
                onClick={() => setDeleteId(r._id)}
                leftIcon={<Trash2 className="w-3.5 h-3.5" />}
              >
                Delete
              </Button>
            </>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="p-6 sm:p-8 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Evaluation Rubrics</h1>
          <p className="text-xs text-slate-500 mt-1">
            Configure precision multi-dimensional scoring distributions for automated code evaluations and MCQs
          </p>
        </div>
        <Button size="sm" onClick={openCreate} leftIcon={<Plus className="w-4 h-4" />}>
          Create Rubric
        </Button>
      </div>

      {/* Main Table */}
      <Table
        columns={columns}
        data={rubrics}
        loading={isLoading}
        rowKey={(r) => r._id}
        emptyMessage="No evaluation rubrics found. Click 'Create Rubric' to get started."
      />

      {/* Create Modal */}
      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="Create Scoring Rubric" size="lg">
        <div className="space-y-5">
          {errorMsg && (
            <div className="flex items-center gap-2.5 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          <Input
            label="Rubric Name"
            placeholder="e.g. Standard Coding Assessment (60/40 Split)"
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          />

          <Input
            label="Description (Optional)"
            placeholder="Brief explanation of scoring criteria"
            value={form.description}
            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
          />

          {/* Criteria List */}
          <div className="space-y-3 pt-1">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-800">Scoring Dimensions</span>
                <span
                  className={`text-xs px-2.5 py-0.5 rounded-full font-mono font-bold ${
                    totalWeight === 100
                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                      : 'bg-rose-50 text-rose-700 border border-rose-200'
                  }`}
                >
                  Total: {totalWeight}% / 100%
                </span>
              </div>
              <button
                type="button"
                onClick={addCriterion}
                className="text-xs font-semibold text-[#3760F8] hover:underline flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" /> Add Dimension
              </button>
            </div>

            <div className="space-y-3 max-h-[320px] overflow-y-auto pr-1">
              {form.criteria.map((c, i) => (
                <div key={i} className="p-3 rounded-xl border border-slate-200 bg-slate-50/50 space-y-2.5">
                  <div className="flex gap-2.5 items-center">
                    <div className="flex-1">
                      <label className="text-[11px] font-semibold text-slate-600 block mb-1">Criterion Name</label>
                      <input
                        className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs bg-white text-slate-900 focus:ring-2 focus:ring-[#3760F8]/30 focus:outline-none"
                        placeholder="e.g. Test Cases Passed"
                        value={c.name}
                        onChange={(e) => updateCriterion(i, 'name', e.target.value)}
                      />
                    </div>

                    <div className="w-48">
                      <label className="text-[11px] font-semibold text-slate-600 block mb-1">Evaluation Metric</label>
                      <select
                        className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs bg-white text-slate-900 focus:ring-2 focus:ring-[#3760F8]/30 focus:outline-none"
                        value={c.type}
                        onChange={(e) => updateCriterion(i, 'type', e.target.value as CriterionType)}
                      >
                        {CRITERIA_TYPE_OPTIONS.map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="w-24">
                      <label className="text-[11px] font-semibold text-slate-600 block mb-1">Weight %</label>
                      <input
                        type="number"
                        min="1"
                        max="100"
                        className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono font-bold bg-white text-slate-900 text-center focus:ring-2 focus:ring-[#3760F8]/30 focus:outline-none"
                        value={c.weight === '' ? '' : c.weight}
                        onChange={(e) => updateCriterion(i, 'weight', e.target.value === '' ? '' : Number(e.target.value))}
                      />
                    </div>

                    {form.criteria.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeCriterion(i)}
                        className="mt-5 p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                        title="Remove criterion"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {totalWeight !== 100 && (
              <p className="text-xs font-medium text-rose-600 bg-rose-50 px-3.5 py-2 rounded-xl border border-rose-200">
                Criteria weights must total exactly 100% (currently {totalWeight}%). Adjust the individual weights above.
              </p>
            )}
          </div>

          <div className="flex gap-2.5 justify-end pt-3 border-t border-slate-100">
            <Button variant="outline" size="sm" onClick={() => setShowCreate(false)}>
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={() => createMutation.mutate()}
              loading={createMutation.isPending}
              disabled={totalWeight !== 100 || !form.name.trim()}
            >
              Create Rubric
            </Button>
          </div>
        </div>
      </Modal>

      {/* Edit Modal */}
      <Modal open={!!editRubric} onClose={() => setEditRubric(null)} title="Edit Scoring Rubric" size="lg">
        <div className="space-y-5">
          {errorMsg && (
            <div className="flex items-center gap-2.5 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          <Input
            label="Rubric Name"
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          />

          <Input
            label="Description (Optional)"
            value={form.description}
            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
          />

          {/* Criteria List */}
          <div className="space-y-3 pt-1">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-800">Scoring Dimensions</span>
                <span
                  className={`text-xs px-2.5 py-0.5 rounded-full font-mono font-bold ${
                    totalWeight === 100
                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                      : 'bg-rose-50 text-rose-700 border border-rose-200'
                  }`}
                >
                  Total: {totalWeight}% / 100%
                </span>
              </div>
              <button
                type="button"
                onClick={addCriterion}
                className="text-xs font-semibold text-[#3760F8] hover:underline flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" /> Add Dimension
              </button>
            </div>

            <div className="space-y-3 max-h-[320px] overflow-y-auto pr-1">
              {form.criteria.map((c, i) => (
                <div key={i} className="p-3 rounded-xl border border-slate-200 bg-slate-50/50 space-y-2.5">
                  <div className="flex gap-2.5 items-center">
                    <div className="flex-1">
                      <label className="text-[11px] font-semibold text-slate-600 block mb-1">Criterion Name</label>
                      <input
                        className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs bg-white text-slate-900 focus:ring-2 focus:ring-[#3760F8]/30 focus:outline-none"
                        value={c.name}
                        onChange={(e) => updateCriterion(i, 'name', e.target.value)}
                      />
                    </div>

                    <div className="w-48">
                      <label className="text-[11px] font-semibold text-slate-600 block mb-1">Evaluation Metric</label>
                      <select
                        className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs bg-white text-slate-900 focus:ring-2 focus:ring-[#3760F8]/30 focus:outline-none"
                        value={c.type}
                        onChange={(e) => updateCriterion(i, 'type', e.target.value as CriterionType)}
                      >
                        {CRITERIA_TYPE_OPTIONS.map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="w-24">
                      <label className="text-[11px] font-semibold text-slate-600 block mb-1">Weight %</label>
                      <input
                        type="number"
                        min="1"
                        max="100"
                        className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono font-bold bg-white text-slate-900 text-center focus:ring-2 focus:ring-[#3760F8]/30 focus:outline-none"
                        value={c.weight === '' ? '' : c.weight}
                        onChange={(e) => updateCriterion(i, 'weight', e.target.value === '' ? '' : Number(e.target.value))}
                      />
                    </div>

                    {form.criteria.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeCriterion(i)}
                        className="mt-5 p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                        title="Remove criterion"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {totalWeight !== 100 && (
              <p className="text-xs font-medium text-rose-600 bg-rose-50 px-3.5 py-2 rounded-xl border border-rose-200">
                Criteria weights must total exactly 100% (currently {totalWeight}%). Adjust the individual weights above.
              </p>
            )}
          </div>

          <div className="flex gap-2.5 justify-end pt-3 border-t border-slate-100">
            <Button variant="outline" size="sm" onClick={() => setEditRubric(null)}>
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={() => editRubric && updateMutation.mutate({ id: editRubric._id })}
              loading={updateMutation.isPending}
              disabled={totalWeight !== 100 || !form.name.trim()}
            >
              Save Rubric
            </Button>
          </div>
        </div>
      </Modal>

      {/* Delete Confirmation */}
      <ConfirmDialog
        open={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={() => deleteId && deleteMutation.mutate(deleteId)}
        loading={deleteMutation.isPending}
        title="Delete Rubric"
        message="Are you sure you want to delete this scoring rubric? Any contest using it will revert to standard unweighted scoring."
        confirmLabel="Delete Rubric"
        danger
      />
    </div>
  );
}
