'use client';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { rubricsApi } from '@/lib/api';
import { Table } from '@/components/ui/Table';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Badge } from '@/components/ui/Badge';
import { Plus, Trash2, Edit2, Copy, Scale, CheckCircle2, X } from 'lucide-react';

interface Criterion { name: string; weight: number; description?: string }
interface Rubric {
  _id: string;
  name: string;
  isPredefined?: boolean;
  criteria: Criterion[];
}

const EMPTY_CRITERION: Criterion = { name: '', weight: 0, description: '' };

export default function RubricsPage() {
  const qc = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [editRubric, setEditRubric] = useState<Rubric | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: '', criteria: [{ ...EMPTY_CRITERION }] });

  const { data: rubricsData, isLoading } = useQuery({ queryKey: ['rubrics'], queryFn: rubricsApi.list });
  const rubrics: Rubric[] = (rubricsData as Rubric[]) || [];

  const totalWeight = form.criteria.reduce((s, c) => s + Number(c.weight), 0);

  const createMutation = useMutation({
    mutationFn: () => rubricsApi.create({ name: form.name, criteria: form.criteria }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['rubrics'] }); setShowCreate(false); setForm({ name: '', criteria: [{ ...EMPTY_CRITERION }] }); },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, d }: { id: string; d: typeof form }) => rubricsApi.update(id, d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['rubrics'] }); setEditRubric(null); },
  });

  const cloneMutation = useMutation({
    mutationFn: (id: string) => rubricsApi.clone(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['rubrics'] }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => rubricsApi.delete(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['rubrics'] }); setDeleteId(null); },
  });

  const openEdit = (r: Rubric) => {
    setEditRubric(r);
    setForm({ name: r.name, criteria: r.criteria.map((c) => ({ ...c })) });
  };

  const addCriterion = () => setForm((f) => ({ ...f, criteria: [...f.criteria, { ...EMPTY_CRITERION }] }));
  const removeCriterion = (i: number) => setForm((f) => ({ ...f, criteria: f.criteria.filter((_, ci) => ci !== i) }));
  const updateCriterion = (i: number, field: keyof Criterion, value: string | number) =>
    setForm((f) => ({ ...f, criteria: f.criteria.map((c, ci) => ci === i ? { ...c, [field]: value } : c) }));

  const columns = [
    {
      key: 'name',
      header: 'Rubric Profile',
      render: (r: Rubric) => (
        <div className="flex items-center gap-2">
          <Scale className="w-3.5 h-3.5 text-[#3760F8]" />
          <span className="font-semibold text-slate-900 tracking-tight text-xs">{r.name}</span>
        </div>
      ),
    },
    {
      key: 'type',
      header: 'Classification',
      render: (r: Rubric) => (
        <Badge color={r.isPredefined ? 'primary' : 'neon'}>
          {r.isPredefined ? 'Predefined Benchmark' : 'Custom Weighted'}
        </Badge>
      ),
    },
    {
      key: 'criteria',
      header: 'Weighted Criteria Composition',
      render: (r: Rubric) => (
        <div className="flex gap-1.5 flex-wrap">
          {r.criteria.map((c, i) => (
            <span key={i} className="text-[11px] font-mono bg-slate-100 text-slate-700 px-2 py-0.5 rounded-md border border-slate-200">
              {c.name}: <strong>{c.weight}%</strong>
            </span>
          ))}
        </div>
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (r: Rubric) => (
        <div className="flex items-center gap-3">
          <button onClick={() => cloneMutation.mutate(r._id)} className="text-xs font-semibold text-[#3760F8] hover:underline">
            Clone
          </button>
          {!r.isPredefined && (
            <>
              <button onClick={() => openEdit(r)} className="text-xs font-semibold text-slate-600 hover:underline">
                Edit
              </button>
              <button onClick={() => setDeleteId(r._id)} className="text-xs font-semibold text-rose-600 hover:underline">
                Delete
              </button>
            </>
          )}
        </div>
      ),
    },
  ];

  const CriteriaEditor = () => (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="text-xs font-bold text-slate-800">
          Weight Distribution &bull; Total: <span className={totalWeight === 100 ? 'text-emerald-600 font-extrabold' : 'text-rose-600 font-extrabold'}>{totalWeight}%</span>
        </label>
        <button className="text-xs font-semibold text-[#3760F8] hover:underline" onClick={addCriterion}>
          + Add Dimension
        </button>
      </div>
      <div className="space-y-2">
        {form.criteria.map((c, i) => (
          <div key={i} className="flex gap-2.5 items-center">
            <div className="flex-1">
              <input
                className="w-full border border-slate-200 rounded-xl px-3.5 py-2 text-xs focus:ring-2 focus:ring-[#3760F8]/30 focus:outline-none"
                placeholder="Dimension name (e.g. Correctness, Efficiency)"
                value={c.name}
                onChange={(e) => updateCriterion(i, 'name', e.target.value)}
              />
            </div>
            <div className="w-24">
              <input
                className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono font-bold focus:ring-2 focus:ring-[#3760F8]/30 focus:outline-none"
                type="number"
                placeholder="Weight %"
                value={c.weight}
                onChange={(e) => updateCriterion(i, 'weight', Number(e.target.value))}
              />
            </div>
            <button onClick={() => removeCriterion(i)} className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>
      {totalWeight !== 100 && (
        <p className="text-xs font-medium text-rose-600 bg-rose-50 px-3 py-1.5 rounded-xl border border-rose-200">
          Weights must total exactly 100% (currently {totalWeight}%)
        </p>
      )}
    </div>
  );

  return (
    <div className="p-6 sm:p-8 space-y-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Evaluation Rubrics</h1>
          <p className="text-xs text-slate-500 mt-0.5">Define multi-criteria scoring rubrics for code quality, accuracy, and speed</p>
        </div>
        <Button size="sm" onClick={() => { setForm({ name: '', criteria: [{ ...EMPTY_CRITERION }] }); setShowCreate(true); }} leftIcon={<Plus className="w-4 h-4" />}>
          Create Rubric
        </Button>
      </div>

      <Table columns={columns} data={rubrics} loading={isLoading} rowKey={(r) => r._id} emptyMessage="No rubrics defined yet." />

      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="Create Scoring Rubric" size="lg">
        <div className="space-y-4">
          <Input label="Rubric Name" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="e.g. Code Quality &amp; Test Coverage (80/20)" />
          <CriteriaEditor />
          <div className="flex gap-2.5 justify-end pt-2">
            <Button variant="outline" size="sm" onClick={() => setShowCreate(false)}>Cancel</Button>
            <Button size="sm" onClick={() => createMutation.mutate()} loading={createMutation.isPending} disabled={totalWeight !== 100}>Create Rubric</Button>
          </div>
        </div>
      </Modal>

      <Modal open={!!editRubric} onClose={() => setEditRubric(null)} title="Edit Scoring Rubric" size="lg">
        <div className="space-y-4">
          <Input label="Rubric Name" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
          <CriteriaEditor />
          <div className="flex gap-2.5 justify-end pt-2">
            <Button variant="outline" size="sm" onClick={() => setEditRubric(null)}>Cancel</Button>
            <Button size="sm" onClick={() => editRubric && updateMutation.mutate({ id: editRubric._id, d: form })} loading={updateMutation.isPending} disabled={totalWeight !== 100}>Save Rubric</Button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog open={!!deleteId} onClose={() => setDeleteId(null)} onConfirm={() => deleteId && deleteMutation.mutate(deleteId)} loading={deleteMutation.isPending} title="Delete Rubric" message="Are you sure you want to delete this scoring rubric?" confirmLabel="Delete Rubric" danger />
    </div>
  );
}
