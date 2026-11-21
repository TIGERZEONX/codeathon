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
    { key: 'name', header: 'Name', render: (r: Rubric) => <span className="font-medium text-gray-900">{r.name}</span> },
    { key: 'type', header: 'Type', render: (r: Rubric) => <Badge color={r.isPredefined ? 'blue' : 'purple'}>{r.isPredefined ? 'System' : 'Custom'}</Badge> },
    { key: 'criteria', header: 'Criteria', render: (r: Rubric) => <span className="text-gray-600 text-xs">{r.criteria.map((c) => `${c.name} (${c.weight}%)`).join(', ')}</span> },
    {
      key: 'actions', header: 'Actions', render: (r: Rubric) => (
        <div className="flex gap-2">
          <button onClick={() => cloneMutation.mutate(r._id)} className="text-xs text-blue-600 hover:underline">Clone</button>
          {!r.isPredefined && <button onClick={() => openEdit(r)} className="text-xs text-gray-600 hover:underline">Edit</button>}
          {!r.isPredefined && <button onClick={() => setDeleteId(r._id)} className="text-xs text-red-600 hover:underline">Delete</button>}
        </div>
      ),
    },
  ];

  const CriteriaEditor = () => (
    <div>
      <div className="flex items-center justify-between mb-2">
        <label className="text-sm font-medium text-gray-700">
          Criteria <span className={totalWeight === 100 ? 'text-green-600' : 'text-red-600'}>({totalWeight}% total)</span>
        </label>
        <button className="text-xs text-blue-600 hover:underline" onClick={addCriterion}>+ Add</button>
      </div>
      {form.criteria.map((c, i) => (
        <div key={i} className="flex gap-2 mb-2 items-end">
          <div className="flex-1">
            <input
              className="w-full border rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
              placeholder="Criterion name"
              value={c.name}
              onChange={(e) => updateCriterion(i, 'name', e.target.value)}
            />
          </div>
          <div className="w-20">
            <input
              className="w-full border rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
              type="number"
              placeholder="Weight %"
              value={c.weight}
              onChange={(e) => updateCriterion(i, 'weight', Number(e.target.value))}
            />
          </div>
          <button onClick={() => removeCriterion(i)} className="text-red-400 hover:text-red-600 text-sm pb-1">✕</button>
        </div>
      ))}
      {totalWeight !== 100 && (
        <p className="text-xs text-red-600">Weights must sum to exactly 100%</p>
      )}
    </div>
  );

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Rubrics</h1>
        <Button onClick={() => { setForm({ name: '', criteria: [{ ...EMPTY_CRITERION }] }); setShowCreate(true); }}>+ Create Rubric</Button>
      </div>

      <Table columns={columns} data={rubrics} loading={isLoading} rowKey={(r) => r._id} emptyMessage="No rubrics found." />

      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="Create Rubric" size="lg">
        <div className="space-y-4">
          <Input label="Rubric Name" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
          <CriteriaEditor />
          <div className="flex gap-3 justify-end">
            <Button variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
            <Button onClick={() => createMutation.mutate()} loading={createMutation.isPending} disabled={totalWeight !== 100}>Create</Button>
          </div>
        </div>
      </Modal>

      <Modal open={!!editRubric} onClose={() => setEditRubric(null)} title="Edit Rubric" size="lg">
        <div className="space-y-4">
          <Input label="Rubric Name" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
          <CriteriaEditor />
          <div className="flex gap-3 justify-end">
            <Button variant="outline" onClick={() => setEditRubric(null)}>Cancel</Button>
            <Button onClick={() => editRubric && updateMutation.mutate({ id: editRubric._id, d: form })} loading={updateMutation.isPending} disabled={totalWeight !== 100}>Save</Button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog open={!!deleteId} onClose={() => setDeleteId(null)} onConfirm={() => deleteId && deleteMutation.mutate(deleteId)} loading={deleteMutation.isPending} title="Delete Rubric" message="Delete this rubric?" danger confirmLabel="Delete" />
    </div>
  );
}
