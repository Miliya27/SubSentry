/**
 * src/pages/ProductsPage.tsx
 * Product catalogue management with server-side pagination, search,
 * role-based permissions (admin CRUD, staff read-only), and variant preview.
 */
import { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Plus,
  Search,
  Edit2,
  Trash2,
  Package,
  Layers,
  Tag,
  CheckCircle2,
  XCircle,
  Eye,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { productsService } from '../services/products';
import { getErrorMessage } from '../services/api';
import { formatCurrency } from '../utils/format';
import { PageHeader } from '../components/PageHeader';
import { Button } from '../components/Button';
import { Card, CardBody } from '../components/Card';
import { DataTable } from '../components/DataTable';
import { ConfirmDialog } from '../components/ConfirmDialog';
import type { Product, TableColumn } from '../types';

export default function ProductsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const isAdmin = user?.role === 'admin';

  const [products, setProducts] = useState<Product[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const pageSize = 10;
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Deletion modal state
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(searchQuery);
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const loadProducts = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await productsService.getProducts({
        page,
        page_size: pageSize,
        q: debouncedQuery.trim() || undefined,
      });
      setProducts(res.data);
      setTotal(res.meta.total);
    } catch (err: unknown) {
      setError(getErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  }, [page, debouncedQuery]);

  useEffect(() => {
    loadProducts();
  }, [loadProducts]);

  async function handleDelete() {
    if (!deleteId) return;
    setIsDeleting(true);
    setDeleteError(null);
    try {
      await productsService.deleteProduct(deleteId);
      setDeleteId(null);
      await loadProducts();
    } catch (err: unknown) {
      setDeleteError(getErrorMessage(err));
    } finally {
      setIsDeleting(false);
    }
  }

  const columns: TableColumn<Product>[] = [
    {
      key: 'name',
      header: 'Product',
      render: (_, product) => (
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-lg bg-primary-50 text-primary-600 flex items-center justify-center flex-shrink-0">
            <Package className="h-5 w-5" />
          </div>
          <div>
            <div className="font-semibold text-slate-900 flex items-center gap-2">
              <Link
                to={`/products/${product.id}/edit`}
                className="hover:text-primary-600 transition-colors"
              >
                {product.name}
              </Link>
              {!product.is_active && (
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 font-medium">
                  Inactive
                </span>
              )}
            </div>
            {product.description && (
              <p className="text-xs text-slate-500 line-clamp-1 max-w-xs">
                {product.description}
              </p>
            )}
          </div>
        </div>
      ),
    },
    {
      key: 'product_type',
      header: 'Type',
      render: (_, product) => (
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-700 capitalize">
          <Tag className="h-3 w-3 mr-1 text-slate-400" />
          {product.product_type}
        </span>
      ),
    },
    {
      key: 'sales_price',
      header: 'Sales Price',
      render: (_, product) => (
        <span className="font-semibold text-slate-900">
          {formatCurrency(product.sales_price)}
        </span>
      ),
    },
    {
      key: 'cost_price',
      header: 'Cost Price',
      render: (_, product) => (
        <span className="text-xs text-slate-500">
          {formatCurrency(product.cost_price)}
        </span>
      ),
    },
    {
      key: 'variants',
      header: 'Variants',
      render: (_, product) => {
        const count = product.variants?.length ?? 0;
        return (
          <div className="flex items-center gap-1.5">
            <span
              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${
                count > 0
                  ? 'bg-indigo-50 text-indigo-700'
                  : 'bg-slate-100 text-slate-500'
              }`}
            >
              <Layers className="h-3 w-3" />
              {count} {count === 1 ? 'variant' : 'variants'}
            </span>
          </div>
        );
      },
    },
    {
      key: 'is_active',
      header: 'Status',
      render: (_, product) =>
        product.is_active ? (
          <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700">
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" /> Active
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 text-xs font-medium text-slate-400">
            <XCircle className="h-3.5 w-3.5 text-slate-400" /> Inactive
          </span>
        ),
    },
    {
      key: 'actions',
      header: 'Actions',
      className: 'text-right',
      render: (_, product) => (
        <div className="flex items-center justify-end gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate(`/products/${product.id}/edit`)}
            title={isAdmin ? 'Edit product' : 'View product'}
            id={`edit-product-${product.id}`}
          >
            {isAdmin ? (
              <Edit2 className="h-3.5 w-3.5" />
            ) : (
              <Eye className="h-3.5 w-3.5" />
            )}
          </Button>

          {isAdmin && (
            <Button
              variant="ghost"
              size="sm"
              className="text-rose-600 hover:text-rose-700 hover:bg-rose-50"
              onClick={() => {
                setDeleteError(null);
                setDeleteId(product.id);
              }}
              title="Deactivate product"
              id={`delete-product-${product.id}`}
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
        title="Products"
        subtitle="Manage product catalog, custom attributes, pricing and variants"
        actions={
          isAdmin ? (
            <Button
              variant="primary"
              onClick={() => navigate('/products/new')}
              id="add-product-button"
            >
              <Plus className="h-4 w-4 mr-1.5" /> Add Product
            </Button>
          ) : undefined
        }
        breadcrumbs={[
          { label: 'Home', href: '/dashboard' },
          { label: 'Products' },
        ]}
      />

      {/* Search Filter Bar */}
      <Card>
        <CardBody className="p-4 flex flex-col sm:flex-row gap-3 items-center justify-between">
          <div className="relative w-full sm:w-80">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400 pointer-events-none" />
            <input
              type="text"
              placeholder="Search products by name, HSN..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="input pl-9"
              id="product-search-input"
            />
          </div>
          <div className="text-xs text-slate-500 self-end sm:self-center">
            Showing {products.length} of {total} products
          </div>
        </CardBody>
      </Card>

      {/* Delete error notification if any */}
      {deleteError && (
        <div className="alert-error" role="alert">
          <p>{deleteError}</p>
        </div>
      )}

      {/* Products Table */}
      <DataTable<Product>
        columns={columns}
        data={products}
        isLoading={isLoading}
        error={error}
        onRetry={loadProducts}
        emptyTitle="No products found"
        emptyDescription={
          debouncedQuery
            ? 'No products matched your search term.'
            : 'Create your first product to start attaching variants and plans.'
        }
        keyExtractor={(p) => String(p.id)}
        currentPage={page}
        totalPages={totalPages}
        onPageChange={(newPage) => setPage(newPage)}
      />

      {/* Confirmation Dialog for Product Deactivation */}
      <ConfirmDialog
        isOpen={deleteId !== null}
        onClose={() => setDeleteId(null)}
        onConfirm={handleDelete}
        title="Deactivate Product"
        message="Are you sure you want to deactivate this product? It will be marked inactive and hidden from active plan creation."
        confirmText="Deactivate"
        variant="danger"
        isLoading={isDeleting}
      />
    </div>
  );
}
