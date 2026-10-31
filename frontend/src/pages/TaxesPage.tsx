/**
 * src/pages/TaxesPage.tsx
 * Admin-only Taxes management interface matching docs/API_CONTRACT.md (§8.10).
 * Supports creation, editing, soft-deletion, and default tax flag assignment.
 */
import { useState, useEffect, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Plus,
  Search,
  Edit2,
  Trash2,
  Receipt,
  Percent,
  AlertCircle,
  CheckCircle2,
  Star,
} from 'lucide-react';
import { taxesService } from '../services/taxes';
import { getErrorMessage, getFieldErrors } from '../services/api';
import { toMoneyString } from '../utils/format';
import { PageHeader } from '../components/PageHeader';
import { Button } from '../components/Button';
import { FormField } from '../components/FormField';
import { Modal } from '../components/Modal';
import { DataTable } from '../components/DataTable';
import { ConfirmDialog } from '../components/ConfirmDialog';
import type { Tax, TableColumn } from '../types';

const taxSchema = z.object({
  name: z.string().min(1, 'Tax rule name is required').max(100),
  rate_percent: z
    .string()
    .min(1, 'Rate is required')
    .refine((v) => !isNaN(parseFloat(v)) && parseFloat(v) >= 0 && parseFloat(v) <= 100, {
      message: 'Rate must be between 0% and 100%',
    }),
  is_default: z.boolean().optional(),
  applies_to: z.enum(['all', 'product', 'hsn']),
  hsn_code: z.string().optional(),
  is_active: z.boolean().optional(),
});

type TaxFormData = z.infer<typeof taxSchema>;

export default function TaxesPage() {
  const [taxes, setTaxes] = useState<Tax[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const pageSize = 10;
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  // Modal create/edit state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTax, setEditingTax] = useState<Tax | null>(null);
  const [modalError, setModalError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Delete confirm state
  const [deleteTarget, setDeleteTarget] = useState<Tax | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setError: setFormError,
    formState: { errors },
  } = useForm<TaxFormData>({
    resolver: zodResolver(taxSchema),
    defaultValues: {
      name: '',
      rate_percent: '18.00',
      is_default: false,
      applies_to: 'all',
      hsn_code: '',
      is_active: true,
    },
  });

  const selectedAppliesTo = watch('applies_to');

  useEffect(() => {
    document.title = 'Taxes | SubSentry';
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(searchQuery);
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const loadTaxes = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await taxesService.getTaxes({
        page,
        page_size: pageSize,
        q: debouncedQuery.trim() || undefined,
      });
      setTaxes(res.data);
      setTotal(res.meta.total);
    } catch (err: unknown) {
      setError(getErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  }, [page, pageSize, debouncedQuery]);

  useEffect(() => {
    loadTaxes();
  }, [loadTaxes]);

  const openCreateModal = () => {
    setEditingTax(null);
    setModalError(null);
    reset({
      name: '',
      rate_percent: '18.00',
      is_default: false,
      applies_to: 'all',
      hsn_code: '',
      is_active: true,
    });
    setIsModalOpen(true);
  };

  const openEditModal = (tax: Tax) => {
    setEditingTax(tax);
    setModalError(null);
    reset({
      name: tax.name,
      rate_percent: String(tax.rate_percent || tax.rate),
      is_default: Boolean(tax.is_default),
      applies_to: tax.applies_to || 'all',
      hsn_code: tax.hsn_code || '',
      is_active: tax.is_active ?? true,
    });
    setIsModalOpen(true);
  };

  const onSave = async (data: TaxFormData) => {
    setIsSaving(true);
    setModalError(null);
    try {
      const payload = {
        name: data.name.trim(),
        rate_percent: toMoneyString(data.rate_percent),
        is_default: Boolean(data.is_default),
        applies_to: data.applies_to,
        hsn_code: data.applies_to === 'hsn' ? data.hsn_code?.trim() || null : null,
        ...(editingTax ? { is_active: data.is_active } : {}),
      };

      if (editingTax) {
        await taxesService.updateTax(editingTax.id, payload);
        setActionSuccess(`Tax rule "${data.name}" updated successfully.`);
      } else {
        await taxesService.createTax(payload);
        setActionSuccess(`Tax rule "${data.name}" created successfully.`);
      }

      setIsModalOpen(false);
      await loadTaxes();
    } catch (err: unknown) {
      setModalError(getErrorMessage(err));
      const fieldErrors = getFieldErrors(err);
      Object.entries(fieldErrors).forEach(([field, msg]) => {
        if (field in data) {
          setFormError(field as keyof TaxFormData, { message: msg });
        }
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      await taxesService.deleteTax(deleteTarget.id);
      setActionSuccess(`Tax rule "${deleteTarget.name}" deactivated.`);
      setDeleteTarget(null);
      await loadTaxes();
    } catch (err: unknown) {
      setError(getErrorMessage(err));
    } finally {
      setIsDeleting(false);
    }
  };

  const columns: TableColumn<Tax>[] = [
    {
      key: 'name',
      header: 'Tax Rule Name',
      render: (_, row) => (
        <div className="flex items-center gap-2">
          <Receipt className="h-4 w-4 text-indigo-600 shrink-0" />
          <span className="font-semibold text-slate-900">{row.name}</span>
          {row.is_default && (
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
              <Star className="h-2.5 w-2.5 fill-indigo-600" />
              Default
            </span>
          )}
        </div>
      ),
    },
    {
      key: 'rate',
      header: 'Rate',
      render: (_, row) => (
        <span className="font-mono font-semibold text-slate-900">
          {row.rate_percent || row.rate}%
        </span>
      ),
    },
    {
      key: 'applies_to',
      header: 'Applies To',
      render: (_, row) => (
        <span className="text-xs uppercase font-medium text-slate-600">
          {row.applies_to || 'all'}
        </span>
      ),
    },
    {
      key: 'hsn_code',
      header: 'HSN Code',
      render: (_, row) => (
        <span className="font-mono text-xs text-slate-600">
          {row.hsn_code || '—'}
        </span>
      ),
    },
    {
      key: 'is_active',
      header: 'Status',
      render: (_, row) =>
        row.is_active ? (
          <span className="px-2 py-0.5 rounded text-xs font-medium bg-emerald-100 text-emerald-700">
            Active
          </span>
        ) : (
          <span className="px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-600">
            Inactive
          </span>
        ),
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (_, row) => (
        <div className="flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={() => openEditModal(row)}
            className="p-1 text-slate-500 hover:text-indigo-600 rounded"
            title="Edit tax rule"
            id={`edit-tax-${row.id}`}
          >
            <Edit2 className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => setDeleteTarget(row)}
            className="p-1 text-slate-500 hover:text-red-600 rounded"
            title="Deactivate tax rule"
            id={`delete-tax-${row.id}`}
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Taxes"
        subtitle="Manage GST rates, sales tax brackets, and default billing tax rules"
        breadcrumbs={[
          { label: 'Home', href: '/dashboard' },
          { label: 'Taxes' },
        ]}
        actions={
          <Button
            leftIcon={<Plus className="h-4 w-4" />}
            onClick={openCreateModal}
            id="add-tax-button"
          >
            New Tax Rule
          </Button>
        }
      />

      {/* Notifications */}
      {actionSuccess && (
        <div className="mb-4 flex items-center gap-2 p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-sm text-emerald-700">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          <span>{actionSuccess}</span>
        </div>
      )}
      {error && (
        <div className="mb-4 flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Search Input */}
      <div className="mb-4 flex justify-between items-center">
        <div className="relative w-full max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search tax rules..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="input pl-9 text-xs"
            id="search-taxes-input"
          />
        </div>
      </div>

      {/* Taxes Data Table */}
      <DataTable<Tax>
        columns={columns}
        data={taxes}
        keyExtractor={(row) => String(row.id)}
        isLoading={isLoading}
        error={error}
        onRetry={loadTaxes}
        totalPages={Math.ceil(total / pageSize)}
        currentPage={page}
        onPageChange={setPage}
        emptyTitle="No tax rules found"
        emptyDescription="Define GST and VAT percentages applied to invoice line items."
      />

      {/* Create / Edit Tax Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingTax ? 'Edit Tax Rule' : 'Create Tax Rule'}
        size="md"
      >
        <form onSubmit={handleSubmit(onSave)} className="space-y-4">
          {modalError && (
            <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{modalError}</span>
            </div>
          )}

          <FormField id="tax-name-input" label="Tax Name" error={errors.name} required>
            <input
              id="tax-name-input"
              type="text"
              placeholder="e.g. GST 18% or IGST 12%"
              className="input text-xs"
              {...register('name')}
            />
          </FormField>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <FormField
              id="tax-rate-percent-input"
              label="Rate Percent (%)"
              error={errors.rate_percent}
              required
            >
              <div className="relative">
                <input
                  id="tax-rate-percent-input"
                  type="number"
                  step="0.01"
                  min="0"
                  max="100"
                  placeholder="18.00"
                  className="input text-xs pr-8"
                  {...register('rate_percent')}
                />
                <Percent className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
              </div>
            </FormField>

            <FormField
              id="tax-applies-to-select"
              label="Applies To"
              error={errors.applies_to}
              required
            >
              <select
                id="tax-applies-to-select"
                className="input text-xs"
                {...register('applies_to')}
              >
                <option value="all">All Products</option>
                <option value="product">Specific Product</option>
                <option value="hsn">HSN Code Category</option>
              </select>
            </FormField>
          </div>

          {selectedAppliesTo === 'hsn' && (
            <FormField id="tax-hsn-code-input" label="HSN Code" error={errors.hsn_code} required>
              <input
                id="tax-hsn-code-input"
                type="text"
                placeholder="e.g. 998313"
                className="input text-xs font-mono"
                {...register('hsn_code')}
              />
            </FormField>
          )}

          <div className="space-y-2 pt-2 border-t border-slate-200">
            <div className="flex items-center gap-2">
              <input
                id="tax-is-default-checkbox"
                type="checkbox"
                className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                {...register('is_default')}
              />
              <label htmlFor="tax-is-default-checkbox" className="text-xs font-medium text-slate-700">
                Set as default tax rule for new line items
              </label>
            </div>

            {editingTax && (
              <div className="flex items-center gap-2">
                <input
                  id="tax-is-active-checkbox"
                  type="checkbox"
                  className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                  {...register('is_active')}
                />
                <label htmlFor="tax-is-active-checkbox" className="text-xs font-medium text-slate-700">
                  Active tax rule
                </label>
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setIsModalOpen(false)}
              disabled={isSaving}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              isLoading={isSaving}
              id="save-tax-button"
            >
              {editingTax ? 'Save Tax Rule' : 'Create Tax Rule'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation Modal */}
      {deleteTarget && (
        <ConfirmDialog
          isOpen={true}
          onClose={() => setDeleteTarget(null)}
          onConfirm={handleDelete}
          title="Deactivate Tax Rule"
          message={`Are you sure you want to deactivate "${deleteTarget.name}"? Existing invoices will keep their computed tax amounts.`}
          confirmText="Deactivate"
          variant="danger"
          isLoading={isDeleting}
        />
      )}
    </div>
  );
}
