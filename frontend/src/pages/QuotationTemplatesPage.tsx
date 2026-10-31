/**
 * src/pages/QuotationTemplatesPage.tsx
 * Quotation template presets with lines, validity days, and create/edit/delete actions.
 */
import { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Plus,
  Search,
  Edit2,
  Trash2,
  FileText,
  Calendar,
  Layers,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { templatesService } from '../services/templates';
import { getErrorMessage } from '../services/api';
import { formatDate } from '../utils/format';
import { PageHeader } from '../components/PageHeader';
import { Button } from '../components/Button';
import { Card, CardBody } from '../components/Card';
import { DataTable } from '../components/DataTable';
import { ConfirmDialog } from '../components/ConfirmDialog';
import type { QuotationTemplate, TableColumn } from '../types';

export default function QuotationTemplatesPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const canEdit = user?.role === 'admin' || user?.role === 'staff';

  const [templates, setTemplates] = useState<QuotationTemplate[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const pageSize = 10;
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(searchQuery);
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const loadTemplates = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await templatesService.getTemplates({
        page,
        page_size: pageSize,
        q: debouncedQuery.trim() || undefined,
      });
      setTemplates(res.data);
      setTotal(res.meta.total);
    } catch (err: unknown) {
      setError(getErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  }, [page, debouncedQuery]);

  useEffect(() => {
    loadTemplates();
  }, [loadTemplates]);

  async function handleDelete() {
    if (!deleteId) return;
    setIsDeleting(true);
    try {
      await templatesService.deleteTemplate(deleteId);
      setDeleteId(null);
      await loadTemplates();
    } catch (err: unknown) {
      setError(getErrorMessage(err));
    } finally {
      setIsDeleting(false);
    }
  }

  const columns: TableColumn<QuotationTemplate>[] = [
    {
      key: 'name',
      header: 'Template Name',
      render: (_, t) => (
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center flex-shrink-0">
            <FileText className="h-5 w-5" />
          </div>
          <div>
            <Link
              to={`/quotations/templates/${t.id}/edit`}
              className="font-bold text-slate-900 hover:text-primary-600 transition-colors block"
            >
              {t.name}
            </Link>
            {t.notes && (
              <p className="text-xs text-slate-500 line-clamp-1 max-w-sm">
                {t.notes}
              </p>
            )}
          </div>
        </div>
      ),
    },
    {
      key: 'validity_days',
      header: 'Validity',
      render: (_, t) => (
        <span className="inline-flex items-center gap-1 text-xs text-slate-700">
          <Calendar className="h-3.5 w-3.5 text-slate-400" />
          {t.validity_days} days
        </span>
      ),
    },
    {
      key: 'lines',
      header: 'Pre-configured Lines',
      render: (_, t) => (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-xs font-semibold bg-slate-100 text-slate-700">
          <Layers className="h-3 w-3 text-slate-500" />
          {t.lines?.length || 0} {t.lines?.length === 1 ? 'line' : 'lines'}
        </span>
      ),
    },
    {
      key: 'valid_until',
      header: 'Valid Until',
      render: (_, t) => (
        <span className="text-xs text-slate-600">
          {t.valid_until ? formatDate(t.valid_until) : 'Indefinite'}
        </span>
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      className: 'text-right',
      render: (_, t) => (
        <div className="flex items-center justify-end gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate(`/quotations/templates/${t.id}/edit`)}
            title="Edit template"
          >
            <Edit2 className="h-3.5 w-3.5" />
          </Button>
          {canEdit && (
            <Button
              variant="ghost"
              size="sm"
              className="text-rose-600 hover:text-rose-700 hover:bg-rose-50"
              onClick={() => setDeleteId(t.id)}
              title="Delete template"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      ),
    },
  ];

  const totalPages = Math.ceil(total / pageSize);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Quotation Templates"
        subtitle="Reusable quotation templates with pre-configured product lines and validity periods"
        actions={
          canEdit ? (
            <Button
              variant="primary"
              onClick={() => navigate('/quotations/templates/new')}
              id="add-template-button"
            >
              <Plus className="h-4 w-4 mr-1.5" /> Add Template
            </Button>
          ) : undefined
        }
        breadcrumbs={[
          { label: 'Home', href: '/dashboard' },
          { label: 'Quotations', href: '/quotations' },
          { label: 'Templates' },
        ]}
      />

      <Card>
        <CardBody className="p-4 flex flex-col sm:flex-row gap-3 items-center justify-between">
          <div className="relative w-full sm:w-80">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400 pointer-events-none" />
            <input
              type="text"
              placeholder="Search templates by name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="input pl-9"
              id="template-search-input"
            />
          </div>
          <div className="text-xs text-slate-500 self-end sm:self-center">
            Showing {templates.length} of {total} templates
          </div>
        </CardBody>
      </Card>

      <DataTable<QuotationTemplate>
        columns={columns}
        data={templates}
        isLoading={isLoading}
        error={error}
        onRetry={loadTemplates}
        emptyTitle="No quotation templates"
        emptyDescription="Create quotation presets to quickly initiate standard subscription packages."
        keyExtractor={(t) => String(t.id)}
        currentPage={page}
        totalPages={totalPages}
        onPageChange={(p) => setPage(p)}
      />

      <ConfirmDialog
        isOpen={deleteId !== null}
        onClose={() => setDeleteId(null)}
        onConfirm={handleDelete}
        title="Delete Quotation Template"
        message="Are you sure you want to delete this template? Existing quotations created from it will remain unaffected."
        confirmText="Delete"
        variant="danger"
        isLoading={isDeleting}
      />
    </div>
  );
}
