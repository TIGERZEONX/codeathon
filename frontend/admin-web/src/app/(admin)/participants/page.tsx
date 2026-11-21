'use client';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { participantsApi } from '@/lib/api';
import { Table } from '@/components/ui/Table';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Badge } from '@/components/ui/Badge';
import { Plus, UploadCloud, Download, Trash2, Search, User, Network, AlertCircle } from 'lucide-react';

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
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [form, setForm] = useState({ rollNumber: '', name: '', email: '', department: '', password: '' });

  const { data, isLoading } = useQuery({
    queryKey: ['participants', search],
    queryFn: () => participantsApi.list({ search, limit: 100 }),
  });
  const participants: Participant[] = (data as { data?: Participant[] })?.data || [];

  const createMutation = useMutation({
    mutationFn: async () => {
      setErrorMsg(null);
      return participantsApi.create({
        rollNumber: form.rollNumber.trim(),
        name: form.name.trim(),
        email: form.email.trim(),
        department: form.department.trim() || 'Computer Science',
        password: form.password.trim() || 'Codeathon@123',
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['participants'] });
      setShowCreate(false);
      setForm({ rollNumber: '', name: '', email: '', department: '', password: '' });
    },
    onError: (err: any) => {
      const msg = err.response?.data?.message || err.message || 'Failed to register candidate';
      setErrorMsg(typeof msg === 'string' ? msg : JSON.stringify(msg));
    },
  });

  const importMutation = useMutation({
    mutationFn: async () => {
      setErrorMsg(null);
      return participantsApi.importCsv(csvText);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['participants'] });
      setShowImport(false);
      setCsvText('');
    },
    onError: (err: any) => {
      const msg = err.response?.data?.message || err.message || 'CSV Import failed';
      setErrorMsg(typeof msg === 'string' ? msg : JSON.stringify(msg));
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => participantsApi.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['participants'] });
      setDeleteId(null);
    },
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

  const openCreate = () => {
    setErrorMsg(null);
    setForm({ rollNumber: '', name: '', email: '', department: '', password: '' });
    setShowCreate(true);
  };

  const openImport = () => {
    setErrorMsg(null);
    setCsvText('');
    setShowImport(true);
  };

  const columns = [
    {
      key: 'rollNumber',
      header: 'Roll Number / ID',
      render: (p: Participant) => (
        <span className="font-mono font-bold text-xs text-slate-800 bg-slate-100 px-2.5 py-1 rounded-md border border-slate-200">
          {p.rollNumber}
        </span>
      ),
    },
    {
      key: 'name',
      header: 'Candidate Name',
      render: (p: Participant) => (
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-full bg-[#3760F8]/10 text-[#3760F8] flex items-center justify-center text-xs font-bold">
            {p.name.charAt(0)}
          </div>
          <div>
            <span className="font-semibold text-slate-900 tracking-tight text-xs block">{p.name}</span>
            <span className="text-[11px] text-slate-400">{p.email}</span>
          </div>
        </div>
      ),
    },
    {
      key: 'department',
      header: 'Department',
      render: (p: Participant) => (
        <span className="text-xs text-slate-600 font-medium">{p.department || 'General'}</span>
      ),
    },
    {
      key: 'team',
      header: 'Team Association',
      render: (p: Participant) =>
        p.teamName ? (
          <Badge color="neon">{p.teamName}</Badge>
        ) : (
          <span className="text-xs text-slate-400 italic">Individual</span>
        ),
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (p: Participant) => (
        <Button
          variant="ghost"
          size="sm"
          className="text-rose-600 hover:text-rose-700 hover:bg-rose-50"
          onClick={() => setDeleteId(p._id)}
          leftIcon={<Trash2 className="w-3.5 h-3.5" />}
        >
          Remove
        </Button>
      ),
    },
  ];

  return (
    <div className="p-6 sm:p-8 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Candidate Roster</h1>
          <p className="text-xs text-slate-500 mt-1">Manage student identities, single registration, and bulk CSV ingestion</p>
        </div>
        <div className="flex items-center gap-2.5 flex-wrap">
          <Button variant="outline" size="sm" onClick={handleExport} leftIcon={<Download className="w-3.5 h-3.5" />}>
            Export CSV
          </Button>
          <Button variant="outline" size="sm" onClick={openImport} leftIcon={<UploadCloud className="w-3.5 h-3.5" />}>
            Bulk CSV
          </Button>
          <Button size="sm" onClick={openCreate} leftIcon={<Plus className="w-3.5 h-3.5" />}>
            Add Candidate
          </Button>
        </div>
      </div>

      <div className="max-w-md">
        <Input
          placeholder="Filter by roll number, name, or department..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <Table
        columns={columns}
        data={participants}
        loading={isLoading}
        rowKey={(p) => p._id}
        emptyMessage="No candidates registered yet. Click 'Add Candidate' or 'Bulk CSV'."
      />

      {/* Create Modal */}
      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="Register Single Candidate">
        <div className="space-y-4">
          {errorMsg && (
            <div className="flex items-center gap-2.5 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          <Input
            label="Roll Number / ID *"
            value={form.rollNumber}
            onChange={(e) => setForm((f) => ({ ...f, rollNumber: e.target.value }))}
            placeholder="e.g. CS2026003"
            required
          />
          <Input
            label="Full Name *"
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            placeholder="e.g. John Doe"
            required
          />
          <Input
            label="Email *"
            type="email"
            value={form.email}
            onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
            placeholder="student@university.edu"
            required
          />
          <Input
            label="Department"
            value={form.department}
            onChange={(e) => setForm((f) => ({ ...f, department: e.target.value }))}
            placeholder="e.g. Computer Science"
          />
          <Input
            label="Password"
            type="password"
            value={form.password}
            onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
            helperText="Leave blank to default to 'Codeathon@123'."
          />
          <div className="flex gap-2.5 justify-end pt-2">
            <Button variant="outline" size="sm" onClick={() => setShowCreate(false)}>
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={() => createMutation.mutate()}
              loading={createMutation.isPending}
              disabled={!form.rollNumber.trim() || !form.name.trim() || !form.email.trim()}
            >
              Add Candidate
            </Button>
          </div>
        </div>
      </Modal>

      {/* Bulk Import Modal */}
      <Modal open={showImport} onClose={() => setShowImport(false)} title="Bulk Import Candidates via CSV" size="lg">
        <div className="space-y-3">
          {errorMsg && (
            <div className="flex items-center gap-2.5 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}
          <p className="text-xs text-slate-600 leading-relaxed">
            Paste raw CSV data with column headers: <code className="bg-slate-100 text-[#3760F8] px-1.5 py-0.5 rounded font-mono text-xs">rollNumber,name,email,department,password</code>
          </p>
          <textarea
            className="w-full border border-slate-200 rounded-2xl px-4 py-3 text-xs font-mono focus:ring-2 focus:ring-[#3760F8]/30 focus:outline-none h-48 bg-slate-50/50 leading-relaxed"
            placeholder={'rollNumber,name,email,department\nCS2026001,Alice Smith,alice@example.com,CSE\nCS2026002,Bob Jones,bob@example.com,ECE'}
            value={csvText}
            onChange={(e) => setCsvText(e.target.value)}
          />
          <div className="flex gap-2.5 justify-end pt-2">
            <Button variant="outline" size="sm" onClick={() => setShowImport(false)}>
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={() => importMutation.mutate()}
              loading={importMutation.isPending}
              disabled={!csvText.trim()}
            >
              Import Batch
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
        title="Delete Candidate Record"
        message="Are you sure you want to remove this student? All attendance records, submissions, and contest attempts will be erased."
        confirmLabel="Delete Candidate"
        danger
      />
    </div>
  );
}
