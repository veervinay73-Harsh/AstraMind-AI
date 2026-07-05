"use client";

import { useState, useEffect, useCallback } from "react";
import { useToast } from "@/context/ToastContext";
import {
  BookOpen,
  Search,
  Plus,
  X,
  AlertCircle,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  XCircle,
  Pencil,
  Trash2,
  ToggleLeft,
  ToggleRight,
  Tag,
  Clock,
  Filter,
  Save,
  Loader2,
} from "lucide-react";

// ─── Type Definitions ────────────────────────────────────────────────────────

interface KBArticle {
  id: string;
  category: string;
  question: string;
  answer: string;
  isActive: boolean;
  hospitalId: string;
  createdAt: string;
  updatedAt: string;
}

interface Pagination {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

type DrawerMode = "view" | "edit" | "create";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const BASE_URL = (process.env.NEXT_PUBLIC_API_URL ? (process.env.NEXT_PUBLIC_API_URL.endsWith('/api') ? process.env.NEXT_PUBLIC_API_URL : process.env.NEXT_PUBLIC_API_URL.replace(/\/$/, '') + '/api') : "http://localhost:5000/api");

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString([], {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function formatRelative(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const days = Math.floor(diff / 86400000);
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days}d ago`;
  return formatDate(iso);
}

const CATEGORY_COLORS: Record<string, string> = {
  Hours: "bg-blue-50 dark:bg-blue-950/20 text-blue-600 dark:text-blue-400",
  Parking: "bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-400",
  Insurance: "bg-violet-50 dark:bg-violet-950/20 text-violet-600 dark:text-violet-400",
  Billing: "bg-amber-50 dark:bg-amber-950/20 text-amber-600 dark:text-amber-400",
  Emergency: "bg-rose-50 dark:bg-rose-950/20 text-rose-600 dark:text-rose-400",
  Visiting: "bg-sky-50 dark:bg-sky-950/20 text-sky-600 dark:text-sky-400",
  Contact: "bg-indigo-50 dark:bg-indigo-950/20 text-indigo-600 dark:text-indigo-400",
  Departments: "bg-teal-50 dark:bg-teal-950/20 text-teal-600 dark:text-teal-400",
};

function categoryBadgeClass(cat: string) {
  return (
    CATEGORY_COLORS[cat] ??
    "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400"
  );
}

// ─── Table Row Skeleton ───────────────────────────────────────────────────────

function RowSkeleton() {
  return (
    <tr className="animate-pulse border-b border-zinc-100 dark:border-zinc-900">
      <td className="p-4">
        <div className="h-3.5 w-20 bg-zinc-200 dark:bg-zinc-800 rounded-full" />
      </td>
      <td className="p-4">
        <div className="space-y-1.5">
          <div className="h-3.5 w-64 bg-zinc-200 dark:bg-zinc-800 rounded" />
          <div className="h-3 w-40 bg-zinc-200 dark:bg-zinc-800 rounded" />
        </div>
      </td>
      <td className="p-4">
        <div className="h-5 w-16 bg-zinc-200 dark:bg-zinc-800 rounded-full" />
      </td>
      <td className="p-4">
        <div className="h-3 w-16 bg-zinc-200 dark:bg-zinc-800 rounded" />
      </td>
      <td className="p-4 text-right">
        <div className="flex justify-end gap-2">
          <div className="h-7 w-7 bg-zinc-200 dark:bg-zinc-800 rounded-lg" />
          <div className="h-7 w-7 bg-zinc-200 dark:bg-zinc-800 rounded-lg" />
          <div className="h-7 w-7 bg-zinc-200 dark:bg-zinc-800 rounded-lg" />
        </div>
      </td>
    </tr>
  );
}

// ─── Delete Confirmation Modal ─────────────────────────────────────────────────

function DeleteModal({
  article,
  onConfirm,
  onCancel,
  isDeleting,
}: {
  article: KBArticle;
  onConfirm: () => void;
  onCancel: () => void;
  isDeleting: boolean;
}) {
  return (
    <>
      <div className="fixed inset-0 z-50 bg-zinc-950/70 backdrop-blur-sm flex items-center justify-center p-4">
        <div className="w-full max-w-sm bg-white dark:bg-zinc-950 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-2xl p-6 space-y-4 animate-in zoom-in-95 duration-200">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-rose-100 dark:bg-rose-950/30 flex items-center justify-center shrink-0">
              <Trash2 className="h-5 w-5 text-rose-600 dark:text-rose-400" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-zinc-900 dark:text-white">Delete Article</h3>
              <p className="text-xs text-zinc-500">This action cannot be undone.</p>
            </div>
          </div>
          <div className="rounded-xl border border-zinc-100 dark:border-zinc-900 bg-zinc-50/50 dark:bg-zinc-900/30 p-3">
            <p className="text-xs text-zinc-500 mb-1 font-semibold uppercase tracking-widest">
              Article to delete
            </p>
            <p className="text-sm text-zinc-800 dark:text-zinc-200 font-medium leading-snug">
              {article.question}
            </p>
          </div>
          <div className="flex gap-3 pt-1">
            <button
              onClick={onCancel}
              disabled={isDeleting}
              className="flex-1 h-9 rounded-lg border border-zinc-200 dark:border-zinc-800 text-sm font-semibold text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-900 disabled:opacity-50 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={onConfirm}
              disabled={isDeleting}
              className="flex-1 h-9 rounded-lg bg-rose-600 hover:bg-rose-700 text-sm font-semibold text-white disabled:opacity-60 transition-colors flex items-center justify-center gap-2"
            >
              {isDeleting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4" />
              )}
              {isDeleting ? "Deleting…" : "Delete"}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

// ─── Article Form (Create / Edit) ─────────────────────────────────────────────

interface ArticleFormProps {
  initial?: Partial<KBArticle>;
  categories: string[];
  onSave: (data: { category: string; question: string; answer: string }) => Promise<void>;
  onCancel: () => void;
  isSaving: boolean;
}

function ArticleForm({ initial, categories, onSave, onCancel, isSaving }: ArticleFormProps) {
  const [category, setCategory] = useState(initial?.category ?? "");
  const [customCategory, setCustomCategory] = useState("");
  const [question, setQuestion] = useState(initial?.question ?? "");
  const [answer, setAnswer] = useState(initial?.answer ?? "");
  const [validationError, setValidationError] = useState<string | null>(null);

  const isNewCategory = category === "__new__";
  const effectiveCategory = isNewCategory ? customCategory : category;

  const handleSubmit = async () => {
    if (!effectiveCategory.trim()) {
      setValidationError("Category is required.");
      return;
    }
    if (!question.trim()) {
      setValidationError("Question is required.");
      return;
    }
    if (!answer.trim()) {
      setValidationError("Answer is required.");
      return;
    }
    setValidationError(null);
    await onSave({
      category: effectiveCategory.trim(),
      question: question.trim(),
      answer: answer.trim(),
    });
  };

  return (
    <div className="space-y-4">
      {validationError && (
        <div className="flex items-center gap-2 rounded-lg bg-rose-50 dark:bg-rose-950/20 border border-rose-100 dark:border-rose-900/30 p-3 text-xs text-rose-600 dark:text-rose-400">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{validationError}</span>
        </div>
      )}

      {/* Category */}
      <div className="space-y-1.5">
        <label className="text-xs font-semibold text-zinc-500 uppercase tracking-widest">
          Category
        </label>
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="w-full h-9 px-3 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-transparent text-sm text-zinc-700 dark:text-zinc-300 focus:outline-none focus:border-indigo-500"
        >
          <option value="">Select a category…</option>
          {categories.map((cat) => (
            <option key={cat} value={cat}>
              {cat}
            </option>
          ))}
          <option value="__new__">+ New category…</option>
        </select>
        {isNewCategory && (
          <input
            type="text"
            value={customCategory}
            onChange={(e) => setCustomCategory(e.target.value)}
            placeholder="Enter new category name…"
            className="w-full h-9 px-3 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-transparent text-sm placeholder-zinc-400 focus:outline-none focus:border-indigo-500 dark:text-zinc-200"
          />
        )}
      </div>

      {/* Question */}
      <div className="space-y-1.5">
        <label className="text-xs font-semibold text-zinc-500 uppercase tracking-widest">
          Question
        </label>
        <input
          type="text"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="What would a patient ask?"
          className="w-full h-9 px-3 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-transparent text-sm placeholder-zinc-400 focus:outline-none focus:border-indigo-500 dark:text-zinc-200"
        />
      </div>

      {/* Answer */}
      <div className="space-y-1.5">
        <label className="text-xs font-semibold text-zinc-500 uppercase tracking-widest">
          Answer
        </label>
        <textarea
          value={answer}
          onChange={(e) => setAnswer(e.target.value)}
          placeholder="The AI will speak this answer to patients…"
          rows={5}
          className="w-full px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-transparent text-sm placeholder-zinc-400 focus:outline-none focus:border-indigo-500 dark:text-zinc-200 resize-none leading-relaxed"
        />
        <p className="text-[10px] text-zinc-400">
          {answer.length} characters · Tip: Keep answers concise for natural speech.
        </p>
      </div>

      {/* Actions */}
      <div className="flex gap-3 pt-1">
        <button
          onClick={onCancel}
          disabled={isSaving}
          className="flex-1 h-9 rounded-lg border border-zinc-200 dark:border-zinc-800 text-sm font-semibold text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-900 disabled:opacity-50 transition-colors"
        >
          Cancel
        </button>
        <button
          onClick={handleSubmit}
          disabled={isSaving}
          className="flex-1 h-9 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-sm font-semibold text-white disabled:opacity-60 transition-colors flex items-center justify-center gap-2"
        >
          {isSaving ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Save className="h-4 w-4" />
          )}
          {isSaving ? "Saving…" : "Save Article"}
        </button>
      </div>
    </div>
  );
}

// ─── Article Drawer ───────────────────────────────────────────────────────────

function ArticleDrawer({
  article,
  mode: initialMode,
  categories,
  onClose,
  onUpdate,
}: {
  article: KBArticle | null;
  mode: DrawerMode;
  categories: string[];
  onClose: () => void;
  onUpdate: (updated: KBArticle) => void;
}) {
  const [mode, setMode] = useState<DrawerMode>(initialMode);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Sync mode when props change (e.g. switching from view → edit)
  useEffect(() => {
    setMode(initialMode);
    setError(null);
  }, [initialMode, article?.id]);

  const handleSave = async (data: {
    category: string;
    question: string;
    answer: string;
  }) => {
    setIsSaving(true);
    setError(null);
    try {
      let res: Response;
      if (mode === "create") {
        res = await fetch(`${BASE_URL}/kb`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        });
      } else {
        res = await fetch(`${BASE_URL}/kb/${article!.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        });
      }
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? "Failed to save article.");
      }
      const saved: KBArticle = await res.json();
      onUpdate(saved);
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Unknown error.");
    } finally {
      setIsSaving(false);
    }
  };

  const isCreate = mode === "create";
  const isView = mode === "view";
  const isEdit = mode === "edit";

  return (
    <>
      <div className="fixed inset-0 z-40 bg-zinc-950/60 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed inset-y-0 right-0 z-50 w-full max-w-lg bg-white dark:bg-zinc-950 border-l border-zinc-200 dark:border-zinc-800 shadow-2xl flex flex-col animate-in slide-in-from-right duration-300">

        {/* Drawer Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-100 dark:border-zinc-900 shrink-0">
          <div className="flex items-center gap-3">
            <div className={`h-9 w-9 rounded-lg flex items-center justify-center shrink-0 ${isCreate ? "bg-indigo-100 dark:bg-indigo-950/30" : "bg-amber-50 dark:bg-amber-950/20"}`}>
              {isCreate ? (
                <Plus className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
              ) : (
                <BookOpen className="h-4 w-4 text-amber-600 dark:text-amber-400" />
              )}
            </div>
            <div>
              <h2 className="text-sm font-bold text-zinc-900 dark:text-white">
                {isCreate ? "New KB Article" : isEdit ? "Edit Article" : "Article Details"}
              </h2>
              {article && !isCreate && (
                <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${categoryBadgeClass(article.category)}`}>
                  {article.category}
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {isView && article && (
              <button
                onClick={() => setMode("edit")}
                className="h-7 px-3 flex items-center gap-1.5 rounded-lg border border-zinc-200 dark:border-zinc-800 text-xs font-semibold text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-900"
              >
                <Pencil className="h-3 w-3" />
                Edit
              </button>
            )}
            <button
              onClick={onClose}
              className="h-8 w-8 flex items-center justify-center rounded-lg border border-zinc-100 dark:border-zinc-900 text-zinc-500 hover:bg-zinc-50 dark:hover:bg-zinc-900"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {error && (
            <div className="flex items-center gap-2 rounded-lg bg-rose-50 dark:bg-rose-950/20 border border-rose-100 dark:border-rose-900/30 p-3 text-xs text-rose-600 dark:text-rose-400 mb-4">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* View Mode */}
          {isView && article && (
            <div className="space-y-5 text-sm">
              {/* Metadata row */}
              <div className="flex items-center gap-3 flex-wrap">
                <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${categoryBadgeClass(article.category)}`}>
                  <Tag className="h-3 w-3" />
                  {article.category}
                </span>
                <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${article.isActive ? "bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-400" : "bg-zinc-100 dark:bg-zinc-800 text-zinc-500"}`}>
                  {article.isActive ? <CheckCircle2 className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
                  {article.isActive ? "Active" : "Inactive"}
                </span>
                <span className="flex items-center gap-1 text-xs text-zinc-400">
                  <Clock className="h-3 w-3" />
                  Updated {formatRelative(article.updatedAt)}
                </span>
              </div>

              {/* Question */}
              <div className="space-y-1.5">
                <p className="text-xs font-bold text-zinc-400 uppercase tracking-widest">Question</p>
                <p className="text-zinc-800 dark:text-zinc-200 font-medium leading-snug">
                  {article.question}
                </p>
              </div>

              {/* Answer */}
              <div className="space-y-1.5">
                <p className="text-xs font-bold text-zinc-400 uppercase tracking-widest">Answer</p>
                <div className="rounded-xl border border-zinc-100 dark:border-zinc-900 bg-zinc-50/50 dark:bg-zinc-900/20 p-4">
                  <p className="text-zinc-700 dark:text-zinc-300 leading-relaxed">
                    {article.answer}
                  </p>
                </div>
              </div>

              {/* Timestamps */}
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: "Created", value: formatDate(article.createdAt) },
                  { label: "Last Updated", value: formatDate(article.updatedAt) },
                ].map((row) => (
                  <div
                    key={row.label}
                    className="rounded-xl border border-zinc-100 dark:border-zinc-900 bg-zinc-50/50 dark:bg-zinc-900/20 p-3"
                  >
                    <p className="text-[10px] text-zinc-400 font-semibold uppercase tracking-widest mb-0.5">
                      {row.label}
                    </p>
                    <p className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
                      {row.value}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Edit / Create Mode */}
          {(isEdit || isCreate) && (
            <ArticleForm
              initial={isEdit && article ? article : undefined}
              categories={categories}
              onSave={handleSave}
              onCancel={onClose}
              isSaving={isSaving}
            />
          )}
        </div>
      </div>
    </>
  );
}

// ─── Main Knowledge Base Page ─────────────────────────────────────────────────

export default function KnowledgeBasePage() {
  const [articles, setArticles] = useState<KBArticle[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filter / sort / pagination state
  const [search, setSearch] = useState("");
  const [filterCategory, setFilterCategory] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [sort, setSort] = useState("updatedAt");
  const [page, setPage] = useState(1);
  const [limit] = useState(10);
  const [pagination, setPagination] = useState<Pagination>({
    total: 0,
    page: 1,
    limit: 10,
    totalPages: 1,
  });

  // Drawer state
  const [drawerArticle, setDrawerArticle] = useState<KBArticle | null>(null);
  const [drawerMode, setDrawerMode] = useState<DrawerMode>("view");

  // Toggling / deleting state
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<KBArticle | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const { success: toastSuccess, error: toastError } = useToast();

  // ── Fetch categories (once) ─────────────────────────────────────────────────
  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const res = await fetch(`${BASE_URL}/kb/categories`);
        if (res.ok) {
          const data = await res.json();
          setCategories(data.categories);
        }
      } catch {
        // non-critical — categories are optional
      }
    };
    fetchCategories();
  }, []);

  // ── Fetch articles ──────────────────────────────────────────────────────────
  const fetchArticles = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
        sort,
        ...(search && { search }),
        ...(filterCategory && { category: filterCategory }),
        ...(filterStatus !== "" && { isActive: filterStatus }),
      });
      const res = await fetch(`${BASE_URL}/kb?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to load knowledge base articles.");
      const data = await res.json();
      setArticles(data.articles);
      setPagination(data.pagination);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "An unexpected error occurred.");
    } finally {
      setIsLoading(false);
    }
  }, [search, filterCategory, filterStatus, sort, page, limit]);

  useEffect(() => {
    fetchArticles();
  }, [fetchArticles]);

  // ── Toggle active status ────────────────────────────────────────────────────
  const handleToggle = async (article: KBArticle) => {
    setTogglingId(article.id);
    try {
      const res = await fetch(`${BASE_URL}/kb/${article.id}/toggle`, { method: "PATCH" });
      if (!res.ok) throw new Error("Failed to toggle status.");
      const updated: KBArticle = await res.json();
      setArticles((prev) => prev.map((a) => (a.id === updated.id ? updated : a)));
      toastSuccess(
        updated.isActive ? "Article Activated" : "Article Deactivated",
        `"${updated.question.slice(0, 50)}…" is now ${updated.isActive ? "active" : "inactive"}.`
      );
    } catch {
      toastError("Toggle Failed", "Could not update article status. Please try again.");
    } finally {
      setTogglingId(null);
    }
  };

  // ── Delete article ──────────────────────────────────────────────────────────
  const handleDelete = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      const res = await fetch(`${BASE_URL}/kb/${deleteTarget.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete article.");
      setArticles((prev) => prev.filter((a) => a.id !== deleteTarget.id));
      setPagination((prev) => ({ ...prev, total: prev.total - 1 }));
      toastSuccess("Article Deleted", `"${deleteTarget.question.slice(0, 50)}" has been removed.`);
      setDeleteTarget(null);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Delete failed.";
      toastError("Delete Failed", msg);
      setError(msg);
    } finally {
      setIsDeleting(false);
    }
  };

  // ── Handle drawer save (create / update) ───────────────────────────────────
  const handleDrawerUpdate = (updated: KBArticle) => {
    setArticles((prev) => {
      const exists = prev.find((a) => a.id === updated.id);
      if (exists) return prev.map((a) => (a.id === updated.id ? updated : a));
      return [updated, ...prev]; // new article at top
    });
    // Refresh categories if new category was added
    fetch(`${BASE_URL}/kb/categories`)
      .then((r) => r.json())
      .then((d) => setCategories(d.categories))
      .catch(() => {});
  };

  const handleResetFilters = () => {
    setSearch("");
    setFilterCategory("");
    setFilterStatus("");
    setSort("updatedAt");
    setPage(1);
  };

  return (
    <div className="space-y-6 relative min-h-screen pb-16">

      {/* Page Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-white">
            Knowledge Base
          </h1>
          <p className="text-sm text-zinc-500 mt-0.5">
            Manage FAQ articles that the AI receptionist uses to answer patient questions.
          </p>
        </div>
        <button
          onClick={() => {
            setDrawerArticle(null);
            setDrawerMode("create");
          }}
          className="inline-flex items-center gap-2 h-9 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-sm font-semibold text-white transition-colors shadow-sm shrink-0"
        >
          <Plus className="h-4 w-4" />
          New Article
        </button>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="flex items-center justify-between rounded-xl bg-rose-50 dark:bg-rose-950/20 border border-rose-100 dark:border-rose-900/30 p-4 text-sm text-rose-600 dark:text-rose-400">
          <div className="flex items-center gap-2.5">
            <AlertCircle className="h-5 w-5 shrink-0" />
            <span>{error}</span>
          </div>
          <button
            onClick={fetchArticles}
            className="flex items-center gap-1 text-xs font-semibold hover:underline bg-rose-100 dark:bg-rose-900/40 px-2.5 py-1 rounded-md"
          >
            <RefreshCw className="h-3 w-3" />
            Retry
          </button>
        </div>
      )}

      {/* Search + Filter Controls */}
      <div className="space-y-3 p-5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 shadow-sm">
        <div className="flex flex-col sm:flex-row gap-3">
          {/* Search */}
          <div className="relative flex-1">
            <Search className="absolute top-2.5 left-3 h-4 w-4 text-zinc-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              placeholder="Search questions, answers, or categories…"
              className="w-full h-9 pl-9 pr-4 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-transparent text-sm placeholder-zinc-400 focus:outline-none focus:border-indigo-500 dark:text-zinc-200"
            />
          </div>
          <button
            onClick={handleResetFilters}
            className="h-9 px-4 rounded-lg border border-zinc-200 dark:border-zinc-800 text-xs font-semibold text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-colors shrink-0"
          >
            Reset
          </button>
        </div>

        <div className="flex flex-wrap gap-3 items-end">
          {/* Category Filter */}
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest flex items-center gap-1">
              <Filter className="h-3 w-3" /> Category
            </label>
            <select
              value={filterCategory}
              onChange={(e) => { setFilterCategory(e.target.value); setPage(1); }}
              className="h-9 px-3 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-transparent text-xs font-medium text-zinc-700 dark:text-zinc-300 focus:outline-none focus:border-indigo-500"
            >
              <option value="">All Categories</option>
              {categories.map((cat) => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>

          {/* Status Filter */}
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest flex items-center gap-1">
              <Filter className="h-3 w-3" /> Status
            </label>
            <select
              value={filterStatus}
              onChange={(e) => { setFilterStatus(e.target.value); setPage(1); }}
              className="h-9 px-3 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-transparent text-xs font-medium text-zinc-700 dark:text-zinc-300 focus:outline-none focus:border-indigo-500"
            >
              <option value="">All Statuses</option>
              <option value="true">Active Only</option>
              <option value="false">Inactive Only</option>
            </select>
          </div>

          {/* Sort */}
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">
              Sort By
            </label>
            <select
              value={sort}
              onChange={(e) => { setSort(e.target.value); setPage(1); }}
              className="h-9 px-3 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-transparent text-xs font-medium text-zinc-700 dark:text-zinc-300 focus:outline-none focus:border-indigo-500"
            >
              <option value="updatedAt">Recently Updated</option>
              <option value="category">Category (A–Z)</option>
            </select>
          </div>
        </div>
      </div>

      {/* Record Count */}
      {!isLoading && !error && (
        <p className="text-xs text-zinc-400">
          Showing{" "}
          <span className="font-semibold text-zinc-700 dark:text-zinc-300">{articles.length}</span>{" "}
          of{" "}
          <span className="font-semibold text-zinc-700 dark:text-zinc-300">{pagination.total}</span>{" "}
          articles
        </p>
      )}

      {/* Articles Table */}
      <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 overflow-hidden shadow-sm">
        {articles.length === 0 && !isLoading && !error ? (
          <div className="flex flex-col items-center justify-center py-16 text-center text-zinc-400">
            <BookOpen className="h-10 w-10 text-zinc-300 mb-3" />
            <h3 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">
              No Articles Found
            </h3>
            <p className="text-xs text-zinc-500 mt-1 max-w-xs">
              Try clearing your filters, or create a new KB article using the button above.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-zinc-100 dark:border-zinc-900 bg-zinc-50/50 dark:bg-zinc-900/10 text-xs font-semibold text-zinc-500 uppercase tracking-wider">
                  <th className="p-4">Category</th>
                  <th className="p-4">Question & Answer</th>
                  <th className="p-4">Status</th>
                  <th className="p-4">Updated</th>
                  <th className="p-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-900 text-sm">
                {isLoading
                  ? Array.from({ length: limit }).map((_, i) => <RowSkeleton key={i} />)
                  : articles.map((article) => (
                      <tr
                        key={article.id}
                        className="hover:bg-zinc-50/40 dark:hover:bg-zinc-900/10 transition-colors group"
                      >
                        {/* Category */}
                        <td className="p-4">
                          <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${categoryBadgeClass(article.category)}`}>
                            <Tag className="h-3 w-3" />
                            {article.category}
                          </span>
                        </td>

                        {/* Question + Answer preview */}
                        <td
                          className="p-4 cursor-pointer max-w-sm"
                          onClick={() => { setDrawerArticle(article); setDrawerMode("view"); }}
                        >
                          <p className="font-semibold text-zinc-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors line-clamp-1">
                            {article.question}
                          </p>
                          <p className="text-xs text-zinc-500 mt-0.5 line-clamp-1">
                            {article.answer}
                          </p>
                        </td>

                        {/* Status Toggle */}
                        <td className="p-4">
                          <button
                            onClick={() => handleToggle(article)}
                            disabled={togglingId === article.id}
                            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold transition-all ${
                              article.isActive
                                ? "bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-950/40"
                                : "bg-zinc-100 dark:bg-zinc-800 text-zinc-500 hover:bg-zinc-200 dark:hover:bg-zinc-700"
                            } disabled:opacity-60`}
                          >
                            {togglingId === article.id ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : article.isActive ? (
                              <ToggleRight className="h-3.5 w-3.5" />
                            ) : (
                              <ToggleLeft className="h-3.5 w-3.5" />
                            )}
                            {article.isActive ? "Active" : "Inactive"}
                          </button>
                        </td>

                        {/* Updated At */}
                        <td className="p-4 text-xs text-zinc-500">
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3 text-zinc-400" />
                            {formatRelative(article.updatedAt)}
                          </span>
                        </td>

                        {/* Actions */}
                        <td className="p-4 text-right">
                          <div className="flex items-center justify-end gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                            {/* Edit */}
                            <button
                              onClick={() => { setDrawerArticle(article); setDrawerMode("edit"); }}
                              className="h-7 w-7 inline-flex items-center justify-center rounded-lg border border-zinc-200 dark:border-zinc-800 text-zinc-500 hover:bg-indigo-50 dark:hover:bg-indigo-950/20 hover:text-indigo-600 dark:hover:text-indigo-400 hover:border-indigo-200 dark:hover:border-indigo-800 transition-all"
                              title="Edit article"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </button>
                            {/* View */}
                            <button
                              onClick={() => { setDrawerArticle(article); setDrawerMode("view"); }}
                              className="h-7 w-7 inline-flex items-center justify-center rounded-lg border border-zinc-200 dark:border-zinc-800 text-zinc-500 hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-all"
                              title="View article"
                            >
                              <BookOpen className="h-3.5 w-3.5" />
                            </button>
                            {/* Delete */}
                            <button
                              onClick={() => setDeleteTarget(article)}
                              className="h-7 w-7 inline-flex items-center justify-center rounded-lg border border-zinc-200 dark:border-zinc-800 text-zinc-500 hover:bg-rose-50 dark:hover:bg-rose-950/20 hover:text-rose-600 dark:hover:text-rose-400 hover:border-rose-200 dark:hover:border-rose-800 transition-all"
                              title="Delete article"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Footer */}
        {!isLoading && pagination.total > 0 && (
          <div className="flex items-center justify-between border-t border-zinc-100 dark:border-zinc-900 px-6 py-4">
            <span className="text-xs text-zinc-500">
              Page{" "}
              <strong className="text-zinc-800 dark:text-zinc-200">{pagination.page}</strong> of{" "}
              <strong className="text-zinc-800 dark:text-zinc-200">{pagination.totalPages}</strong>{" "}
              ({pagination.total} articles)
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="h-8 w-8 inline-flex items-center justify-center rounded-lg border border-zinc-200 dark:border-zinc-800 disabled:opacity-50 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-900"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
                disabled={page === pagination.totalPages}
                className="h-8 w-8 inline-flex items-center justify-center rounded-lg border border-zinc-200 dark:border-zinc-800 disabled:opacity-50 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-900"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Article Drawer (View / Edit / Create) */}
      {(drawerArticle || drawerMode === "create") && (
        <ArticleDrawer
          article={drawerArticle}
          mode={drawerMode}
          categories={categories}
          onClose={() => { setDrawerArticle(null); setDrawerMode("view"); }}
          onUpdate={handleDrawerUpdate}
        />
      )}

      {/* Delete Confirmation Modal */}
      {deleteTarget && (
        <DeleteModal
          article={deleteTarget}
          onConfirm={handleDelete}
          onCancel={() => setDeleteTarget(null)}
          isDeleting={isDeleting}
        />
      )}
    </div>
  );
}
