/**
 * src/pages/ProductFormPage.tsx
 * Product Create & Edit page with Variant Management and Live Price Preview API integration.
 */
import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import {
  ArrowLeft,
  Plus,
  Save,
  Trash2,
  Package,
  Layers,
  Calculator,
  AlertCircle,
  Tag,
  CheckCircle2,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { productsService } from '../services/products';
import { getErrorMessage, getFieldErrors } from '../services/api';
import { formatCurrency, toMoneyString } from '../utils/format';
import { PageHeader } from '../components/PageHeader';
import { Button } from '../components/Button';
import { Card, CardHeader, CardBody } from '../components/Card';
import { Modal } from '../components/Modal';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { Spinner } from '../components/Spinner';
import type {
  Product,
  ProductVariant,
  ProductType,
  PricePreviewResponse,
} from '../types';

interface ProductFormData {
  name: string;
  product_type: ProductType;
  sales_price: string;
  cost_price: string;
  unit: string;
  hsn_code: string;
  notes: string;
  description: string;
  is_active: boolean;
}

interface VariantFormData {
  attribute: string;
  value: string;
  extra_price: string;
  sku: string;
}

export default function ProductFormPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const isEdit = Boolean(id);

  const [isLoading, setIsLoading] = useState(isEdit);
  const [product, setProduct] = useState<Product | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Variant modal state
  const [isVariantModalOpen, setIsVariantModalOpen] = useState(false);
  const [variantForm, setVariantForm] = useState<VariantFormData>({
    attribute: '',
    value: '',
    extra_price: '0.00',
    sku: '',
  });
  const [variantSubmitting, setVariantSubmitting] = useState(false);
  const [variantError, setVariantError] = useState<string | null>(null);

  // Delete variant state
  const [deleteVariantId, setDeleteVariantId] = useState<number | null>(null);
  const [isDeletingVariant, setIsDeletingVariant] = useState(false);

  // Live Price Preview state
  const [selectedPreviewVariantId, setSelectedPreviewVariantId] = useState<
    string | ''
  >('');
  const [pricePreview, setPricePreview] =
    useState<PricePreviewResponse | null>(null);
  const [isCalculatingPrice, setIsCalculatingPrice] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<ProductFormData>({
    defaultValues: {
      name: '',
      product_type: 'software',
      sales_price: '0.00',
      cost_price: '0.00',
      unit: 'license',
      hsn_code: '',
      notes: '',
      description: '',
      is_active: true,
    },
  });

  // Fetch product data if in edit mode
  const fetchProduct = useCallback(async () => {
    if (!id) return;
    setIsLoading(true);
    setServerError(null);
    try {
      const data = await productsService.getProduct(id);
      setProduct(data);
      reset({
        name: data.name,
        product_type: data.product_type,
        sales_price: data.sales_price,
        cost_price: data.cost_price,
        unit: data.unit || '',
        hsn_code: data.hsn_code || '',
        notes: data.notes || '',
        description: data.description || '',
        is_active: data.is_active,
      });

      // Default select the first variant if available
      if (data.variants && data.variants.length > 0) {
        setSelectedPreviewVariantId(String(data.variants[0].id));
      }
    } catch (err: unknown) {
      setServerError(getErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  }, [id, reset]);

  useEffect(() => {
    if (isEdit) {
      fetchProduct();
    }
  }, [isEdit, fetchProduct]);

  // Live price calculation from backend API (Rule: do NOT compute price in frontend)
  const fetchPricePreview = useCallback(
    async (productId: number, variantId?: number | null) => {
      setIsCalculatingPrice(true);
      try {
        const preview = await productsService.getPricePreview(
          productId,
          variantId
        );
        setPricePreview(preview);
      } catch (err: unknown) {
        console.error('Failed to fetch price preview:', err);
      } finally {
        setIsCalculatingPrice(false);
      }
    },
    []
  );

  // Trigger price preview whenever selected variant changes
  useEffect(() => {
    if (product?.id) {
      const varId = selectedPreviewVariantId
        ? parseInt(selectedPreviewVariantId, 10)
        : null;
      fetchPricePreview(product.id, varId);
    }
  }, [product?.id, selectedPreviewVariantId, fetchPricePreview]);

  // Submit product form
  async function onSubmit(data: ProductFormData) {
    if (!isAdmin) return;
    setServerError(null);
    setSaveSuccess(false);

    const payload = {
      name: data.name.trim(),
      product_type: data.product_type,
      sales_price: toMoneyString(data.sales_price),
      cost_price: toMoneyString(data.cost_price),
      unit: data.unit.trim() || null,
      hsn_code: data.hsn_code.trim() || null,
      notes: data.notes.trim() || null,
      description: data.description.trim() || null,
    };

    try {
      if (isEdit && id) {
        const updated = await productsService.updateProduct(id, {
          ...payload,
          is_active: data.is_active,
        });
        setProduct(updated);
        setSaveSuccess(true);
      } else {
        const created = await productsService.createProduct(payload);
        navigate(`/products/${created.id}/edit`, { replace: true });
      }
    } catch (err: unknown) {
      const fieldErrors = getFieldErrors(err);
      if (Object.keys(fieldErrors).length > 0) {
        for (const [field, message] of Object.entries(fieldErrors)) {
          setError(field as keyof ProductFormData, {
            type: 'server',
            message,
          });
        }
      } else {
        setServerError(getErrorMessage(err));
      }
    }
  }

  // Add Variant
  async function handleCreateVariant(e: React.FormEvent) {
    e.preventDefault();
    if (!product?.id) return;

    if (!variantForm.attribute.trim() || !variantForm.value.trim()) {
      setVariantError('Attribute and Value are required.');
      return;
    }

    setVariantSubmitting(true);
    setVariantError(null);

    try {
      await productsService.createVariant(product.id, {
        attribute: variantForm.attribute.trim(),
        value: variantForm.value.trim(),
        extra_price: toMoneyString(variantForm.extra_price),
        sku: variantForm.sku.trim() || null,
      });

      // Reload product to refresh variants list
      await fetchProduct();
      setIsVariantModalOpen(false);
      setVariantForm({
        attribute: '',
        value: '',
        extra_price: '0.00',
        sku: '',
      });
    } catch (err: unknown) {
      setVariantError(getErrorMessage(err));
    } finally {
      setVariantSubmitting(false);
    }
  }

  // Delete Variant
  async function handleDeleteVariant() {
    if (!deleteVariantId) return;
    setIsDeletingVariant(true);
    try {
      await productsService.deleteVariant(deleteVariantId);
      setDeleteVariantId(null);
      await fetchProduct();
    } catch (err: unknown) {
      setServerError(getErrorMessage(err));
    } finally {
      setIsDeletingVariant(false);
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-[50vh] flex items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12">
      <PageHeader
        title={isEdit ? `Edit Product: ${product?.name || ''}` : 'New Product'}
        subtitle={
          isEdit
            ? 'Update specifications, manage variants, and test price calculation'
            : 'Register a new service, software license, or addon product'
        }
        actions={
          <Button
            variant="secondary"
            onClick={() => navigate('/products')}
            id="back-to-products-button"
          >
            <ArrowLeft className="h-4 w-4 mr-1.5" /> Back to Products
          </Button>
        }
        breadcrumbs={[
          { label: 'Home', href: '/dashboard' },
          { label: 'Products', href: '/products' },
          { label: isEdit ? 'Edit' : 'New' },
        ]}
      />

      {serverError && (
        <div className="alert-error" role="alert" id="product-form-error-alert">
          <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
          <p className="flex-1">{serverError}</p>
        </div>
      )}

      {saveSuccess && (
        <div className="alert-success" role="status" id="product-saved-alert">
          <CheckCircle2 className="h-4 w-4 flex-shrink-0 mt-0.5" />
          <p className="flex-1">Product details updated successfully.</p>
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6" noValidate>
        {/* Basic Details Card */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Package className="h-5 w-5 text-primary-600" />
              <h2 className="text-base font-bold text-slate-900">
                Product Details
              </h2>
            </div>
            {!isAdmin && (
              <span className="text-xs px-2 py-0.5 bg-amber-50 text-amber-700 rounded-full font-medium">
                Read-only mode
              </span>
            )}
          </CardHeader>
          <CardBody className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Product Name */}
              <div className="md:col-span-2">
                <label className="label" htmlFor="product-name-input">
                  Product Name *
                </label>
                <input
                  id="product-name-input"
                  type="text"
                  placeholder="e.g. ERP Software License"
                  disabled={!isAdmin}
                  className={`input ${errors.name ? 'input-error' : ''}`}
                  {...register('name', { required: 'Product name is required' })}
                />
                {errors.name && (
                  <p className="error-msg">{errors.name.message}</p>
                )}
              </div>

              {/* Product Type */}
              <div>
                <label className="label" htmlFor="product-type-select">
                  Product Type *
                </label>
                <select
                  id="product-type-select"
                  disabled={!isAdmin}
                  className="input"
                  {...register('product_type')}
                >
                  <option value="software">Software</option>
                  <option value="service">Service</option>
                  <option value="addon">Addon</option>
                </select>
              </div>

              {/* Unit of Measurement */}
              <div>
                <label className="label" htmlFor="product-unit-input">
                  Unit (e.g. license, seat, month)
                </label>
                <input
                  id="product-unit-input"
                  type="text"
                  placeholder="license"
                  disabled={!isAdmin}
                  className="input"
                  {...register('unit')}
                />
              </div>

              {/* Sales Price */}
              <div>
                <label className="label" htmlFor="product-sales-price-input">
                  Sales Price (INR) *
                </label>
                <input
                  id="product-sales-price-input"
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="2000.00"
                  disabled={!isAdmin}
                  className={`input ${errors.sales_price ? 'input-error' : ''}`}
                  {...register('sales_price', {
                    required: 'Sales price is required',
                  })}
                />
                {errors.sales_price && (
                  <p className="error-msg">{errors.sales_price.message}</p>
                )}
              </div>

              {/* Cost Price */}
              <div>
                <label className="label" htmlFor="product-cost-price-input">
                  Cost Price (INR)
                </label>
                <input
                  id="product-cost-price-input"
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                  disabled={!isAdmin}
                  className="input"
                  {...register('cost_price')}
                />
              </div>

              {/* HSN Code */}
              <div>
                <label className="label" htmlFor="product-hsn-input">
                  HSN / SAC Code
                </label>
                <input
                  id="product-hsn-input"
                  type="text"
                  placeholder="998314"
                  disabled={!isAdmin}
                  className="input"
                  {...register('hsn_code')}
                />
              </div>

              {/* Active Toggle (Edit mode) */}
              {isEdit && (
                <div className="flex items-center gap-3 pt-6">
                  <input
                    id="product-active-toggle"
                    type="checkbox"
                    disabled={!isAdmin}
                    className="h-4 w-4 rounded border-slate-300 text-primary-600 focus:ring-primary-500"
                    {...register('is_active')}
                  />
                  <label
                    htmlFor="product-active-toggle"
                    className="text-sm font-medium text-slate-700 cursor-pointer"
                  >
                    Active in catalog
                  </label>
                </div>
              )}

              {/* Description */}
              <div className="md:col-span-2">
                <label className="label" htmlFor="product-description-input">
                  Description
                </label>
                <textarea
                  id="product-description-input"
                  rows={2}
                  placeholder="Detailed description of the product or service"
                  disabled={!isAdmin}
                  className="input"
                  {...register('description')}
                />
              </div>

              {/* Notes */}
              <div className="md:col-span-2">
                <label className="label" htmlFor="product-notes-input">
                  Internal Notes
                </label>
                <input
                  id="product-notes-input"
                  type="text"
                  placeholder="e.g. Main license"
                  disabled={!isAdmin}
                  className="input"
                  {...register('notes')}
                />
              </div>
            </div>

            {isAdmin && (
              <div className="flex justify-end pt-4 border-t border-slate-100">
                <Button
                  type="submit"
                  variant="primary"
                  disabled={isSubmitting}
                  id="save-product-button"
                >
                  {isSubmitting ? (
                    <>
                      <Spinner size="sm" className="mr-1.5" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="h-4 w-4 mr-1.5" />
                      {isEdit ? 'Save Changes' : 'Create Product'}
                    </>
                  )}
                </Button>
              </div>
            )}
          </CardBody>
        </Card>
      </form>

      {/* VARIANTS & PRICE PREVIEW SECTION (only in Edit mode when product exists) */}
      {isEdit && product && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left 2 Cols: Variants Management */}
          <div className="lg:col-span-2 space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Layers className="h-5 w-5 text-indigo-600" />
                  <h3 className="text-base font-bold text-slate-900">
                    Product Variants
                  </h3>
                </div>
                {isAdmin && (
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => {
                      setVariantError(null);
                      setIsVariantModalOpen(true);
                    }}
                    id="add-variant-button"
                  >
                    <Plus className="h-3.5 w-3.5 mr-1" /> Add Variant
                  </Button>
                )}
              </CardHeader>

              <CardBody className="p-0">
                {product.variants && product.variants.length > 0 ? (
                  <div className="table-wrapper border-0 rounded-none">
                    <table className="table">
                      <thead>
                        <tr>
                          <th>Attribute</th>
                          <th>Value</th>
                          <th>Extra Price</th>
                          <th>SKU</th>
                          {isAdmin && <th className="text-right">Actions</th>}
                        </tr>
                      </thead>
                      <tbody>
                        {product.variants.map((v: ProductVariant) => (
                          <tr key={v.id} id={`variant-row-${v.id}`}>
                            <td className="font-medium text-slate-900">
                              {v.attribute}
                            </td>
                            <td>
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-indigo-50 text-indigo-700">
                                {v.value}
                              </span>
                            </td>
                            <td className="font-semibold text-slate-900">
                              +{formatCurrency(v.extra_price)}
                            </td>
                            <td className="text-xs text-slate-500 font-mono">
                              {v.sku || '—'}
                            </td>
                            {isAdmin && (
                              <td className="text-right">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="text-rose-600 hover:text-rose-700 hover:bg-rose-50"
                                  onClick={() => setDeleteVariantId(v.id)}
                                  title="Deactivate variant"
                                  id={`delete-variant-${v.id}`}
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              </td>
                            )}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="p-8 text-center text-slate-400 text-xs">
                    No variants created yet for this product. Click &quot;Add
                    Variant&quot; to configure editions, tiers, or brands.
                  </div>
                )}
              </CardBody>
            </Card>
          </div>

          {/* Right Col: Live Price Preview (GET /products/{id}/price?variant_id=...) */}
          <div className="space-y-4">
            <Card className="border-indigo-100 bg-gradient-to-br from-white to-indigo-50/20 shadow-sm">
              <CardHeader className="border-indigo-100/60 pb-3">
                <div className="flex items-center gap-2">
                  <Calculator className="h-4 w-4 text-indigo-600" />
                  <h3 className="text-sm font-bold text-slate-900">
                    Live Final Price Preview
                  </h3>
                </div>
              </CardHeader>
              <CardBody className="space-y-4">
                <p className="text-xs text-slate-500 leading-relaxed">
                  The final per-unit price is computed dynamically by the backend
                  via{' '}
                  <code className="text-[11px] bg-slate-100 px-1 py-0.5 rounded text-indigo-600 font-mono">
                    GET /products/{product.id}/price
                  </code>
                  .
                </p>

                {/* Variant Selector for Price Calculator */}
                <div>
                  <label
                    className="label"
                    htmlFor="preview-variant-selector"
                  >
                    Select Variant:
                  </label>
                  <select
                    id="preview-variant-selector"
                    value={selectedPreviewVariantId}
                    onChange={(e) => setSelectedPreviewVariantId(e.target.value)}
                    className="input text-xs"
                  >
                    <option value="">Base Product (No Variant)</option>
                    {product.variants?.map((v) => (
                      <option key={v.id} value={String(v.id)}>
                        {v.attribute}: {v.value} (+
                        {formatCurrency(v.extra_price)})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Price Breakdown from Backend API */}
                <div
                  className="p-4 rounded-xl bg-white border border-indigo-100 shadow-sm space-y-2.5"
                  id="final-price-preview-box"
                >
                  <div className="flex items-center justify-between text-xs text-slate-600">
                    <span>Base Sales Price:</span>
                    <span className="font-semibold text-slate-900">
                      {formatCurrency(pricePreview?.sales_price || product.sales_price)}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-xs text-slate-600">
                    <span>Variant Extra Price:</span>
                    <span className="font-semibold text-indigo-600">
                      +{formatCurrency(pricePreview?.extra_price || '0.00')}
                    </span>
                  </div>

                  <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-800">
                      Final Computed Price:
                    </span>
                    <span
                      className="text-lg font-extrabold text-primary-600"
                      id="computed-final-price-value"
                    >
                      {isCalculatingPrice ? (
                        <Spinner size="sm" />
                      ) : (
                        formatCurrency(
                          pricePreview?.final_price || product.sales_price
                        )
                      )}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
                  <Tag className="h-3 w-3 text-slate-400" />
                  <span>Verified by backend single source of truth</span>
                </div>
              </CardBody>
            </Card>
          </div>
        </div>
      )}

      {/* Add Variant Modal */}
      <Modal
        isOpen={isVariantModalOpen}
        onClose={() => setIsVariantModalOpen(false)}
        title="Add Product Variant"
        description="Add a specialized edition, tier, or brand with an extra price add-on."
        size="md"
      >
        <form onSubmit={handleCreateVariant} className="space-y-4" noValidate>
          {variantError && (
            <div className="alert-error text-xs" role="alert">
              <p>{variantError}</p>
            </div>
          )}

          <div>
            <label className="label" htmlFor="variant-attribute-input">
              Attribute Name * (e.g. Brand, Edition, Tier)
            </label>
            <input
              id="variant-attribute-input"
              type="text"
              placeholder="e.g. Brand"
              value={variantForm.attribute}
              onChange={(e) =>
                setVariantForm({ ...variantForm, attribute: e.target.value })
              }
              className="input"
              required
            />
          </div>

          <div>
            <label className="label" htmlFor="variant-value-input">
              Attribute Value * (e.g. Odoo, Enterprise, Pro)
            </label>
            <input
              id="variant-value-input"
              type="text"
              placeholder="e.g. Odoo"
              value={variantForm.value}
              onChange={(e) =>
                setVariantForm({ ...variantForm, value: e.target.value })
              }
              className="input"
              required
            />
          </div>

          <div>
            <label className="label" htmlFor="variant-extra-price-input">
              Extra Price (INR)
            </label>
            <input
              id="variant-extra-price-input"
              type="number"
              step="0.01"
              min="0"
              placeholder="560.00"
              value={variantForm.extra_price}
              onChange={(e) =>
                setVariantForm({ ...variantForm, extra_price: e.target.value })
              }
              className="input"
            />
          </div>

          <div>
            <label className="label" htmlFor="variant-sku-input">
              SKU (Optional)
            </label>
            <input
              id="variant-sku-input"
              type="text"
              placeholder="e.g. ERP-ODOO-001"
              value={variantForm.sku}
              onChange={(e) =>
                setVariantForm({ ...variantForm, sku: e.target.value })
              }
              className="input"
            />
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setIsVariantModalOpen(false)}
              disabled={variantSubmitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              disabled={variantSubmitting}
              id="submit-variant-button"
            >
              {variantSubmitting ? (
                <>
                  <Spinner size="sm" className="mr-1.5" />
                  Saving...
                </>
              ) : (
                'Add Variant'
              )}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Delete Variant Confirmation */}
      <ConfirmDialog
        isOpen={deleteVariantId !== null}
        onClose={() => setDeleteVariantId(null)}
        onConfirm={handleDeleteVariant}
        title="Deactivate Variant"
        message="Are you sure you want to deactivate this variant? Existing subscriptions using this variant will preserve their current pricing."
        confirmText="Deactivate"
        variant="danger"
        isLoading={isDeletingVariant}
      />
    </div>
  );
}
