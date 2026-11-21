'use client';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { participantsApi } from '@/lib/api';
import { Table } from '@/components/ui/Table';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';

interface Participant {
  _id: string;
  rollNumber: string;
  name: string;
  email: string;
  department?: string;
  teamName?: string;
}

export default function ParticipantsPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [csvText, setCsvText] = useState('');
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [form, setForm] = useState({ rollNumber: '', name: '', email: '', department: '', password: '' });

  const { data, isLoading } = useQuery({
    queryKey: ['participants', search],
    queryFn: () => participantsApi.list({ search, limit: 100 }),
  });
  const participants: Participant[] = (data as { data?: Participant[] })?.data || [];

  const createMutation = useMutation({
    mutationFn: () => participantsApi.create(form),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['participants'] }); setShowCreate(false); setForm({ rollNumber: '', name: '', email: '', department: '', password: '' }); },
  });

  const importMutation = useMutation({
    mutationFn: () => participantsApi.importCsv(csvText),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['participants'] }); setShowImport(false); setCsvText(''); },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => participantsApi.delete(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['participants'] }); setDeleteId(null); },
  });

  const handleExport = async () => {
    try {
      const blob = await participantsApi.exportCsv();
      const url = URL.createObjectURL(blob as Blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'participants.csv';
      a.click();
    } catch {}
  };

  const columns = [
    { key: 'rollNumber', header: 'Roll No.' },
    { key: 'name', header: 'Name' },
    { key: 'email', header: 'Email' },
    { key: 'department', header: 'Department', render: (p: Participant) => p.department || '—' },
    { key: 'teamName', header: 'Team', render: (p: Participant) => p.teamName || '—' },
    {
      key: 'actions',
      header: 'Actions',
      render: (p: Participant) => (
        <button onClick={() => setDeleteId(p._id)} className="text-xs text-red-600 hover:underline">
          Delete
        </button>
      ),
    },
  ];

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Participants</h1>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleExport}>Export CSV</Button>
          <Button variant="outline" onClick={() => setShowImport(true)}>Bulk Import</Button>
          <Button onClick={() => setShowCreate(true)}>+ Add Participant</Button>
        </div>
      </div>

      <div className="max-w-sm">
        <Input placeholder="Search by name, roll no, email..." value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      <Table columns={columns} data={participants} loading={isLoading} rowKey={(p) => p._id} emptyMessage="No participants found." />

      {/* Create Modal */}
      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="Add Participant">
        <div className="space-y-3">
          <Input label="Roll Number" value={form.rollNumber} onChange={(e) => setForm((f) => ({ ...f, rollNumber: e.target.value }))} required />
          <Input label="Full Name" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} required />
          <Input label="Email" type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
          <Input label="Department" value={form.department} onChange={(e) => setForm((f) => ({ ...f, department: e.target.value }))} />
          <Input label="Initial Password" type="password" value={form.password} onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))} helperText="If blank, defaults to roll number." />
          <div className="flex gap-3 justify-end pt-2">
            <Button variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
            <Button onClick={() => createMutation.mutate()} loading={createMutation.isPending}>Add</Button>
          </div>
        </div>
      </Modal>

      {/* Bulk Import Modal */}
      <Modal open={showImport} onClose={() => setShowImport(false)} title="Bulk Import Participants" size="lg">
        <div className="space-y-3">
          <p className="text-sm text-gray-600">
            Paste CSV data with columns: <code className="bg-gray-100 px-1 rounded">rollNumber,name,email,department,password</code>
          </p>
          <p className="text-xs text-gray-500">First row should be the header. Password column is optional.</p>
          <textarea
            className="w-full border rounded-lg px-3 py-2 text-sm font-mono focus:ring-2 focus:ring-blue-500 focus:outline-none h-48"
            placeholder={'rollNumber,name,email,department\nCS2026001,Alice Smith,alice@example.com,CSE\nCS2026002,Bob Jones,bob@example.com,ECE'}
            value={csvText}
            onChange={(e) => setCsvText(e.target.value)}
          />
          {importMutation.isError && (
            <p className="text-red-600 text-sm">
              {(importMutation.error as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Import failed'}
            </p>
          )}
          {importMutation.isSuccess && (
            <p className="text-green-600 text-sm">Import successful!</p>
          )}
          <div className="flex gap-3 justify-end">
            <Button variant="outline" onClick={() => setShowImport(false)}>Cancel</Button>
            <Button onClick={() => importMutation.mutate()} loading={importMutation.isPending}>Import</Button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={() => deleteId && deleteMutation.mutate(deleteId)}
        loading={deleteMutation.isPending}
        title="Delete Participant"
        message="Are you sure you want to delete this participant? This action cannot be undone."
        confirmLabel="Delete"
        danger
      />
    </div>
  );
}
