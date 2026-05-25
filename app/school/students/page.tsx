"use client";

import { Loader2, Pencil, Search, Trash2, UserRoundPlus, Users } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type StudentRow = {
  id: string;
  unique_student_id: string;
  full_name: string;
  email: string;
  created_at: string;
};

type Pagination = {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

type Toast = {
  id: number;
  message: string;
  type: "success" | "error";
};

const PAGE_SIZE = 10;

function formatDate(dateString: string) {
  return new Date(dateString).toLocaleDateString("en-PK", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export default function SchoolStudentsPage() {
  const router = useRouter();
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [pagination, setPagination] = useState<Pagination>({
    page: 1,
    pageSize: PAGE_SIZE,
    total: 0,
    totalPages: 1,
  });
  const [queryInput, setQueryInput] = useState("");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [addOpen, setAddOpen] = useState(false);
  const [addSubmitting, setAddSubmitting] = useState(false);
  const [addForm, setAddForm] = useState({
    fullName: "",
    email: "",
    temporaryPassword: "",
    fatherName: "",
    fatherCnic: "",
  });
  const [addPhoto, setAddPhoto] = useState<File | null>(null);

  const [editStudent, setEditStudent] = useState<StudentRow | null>(null);
  const [editName, setEditName] = useState("");
  const [editSubmitting, setEditSubmitting] = useState(false);

  const [deleteStudent, setDeleteStudent] = useState<StudentRow | null>(null);
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);

  const [toasts, setToasts] = useState<Toast[]>([]);

  const fetchStudents = async (page: number, q: string) => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(PAGE_SIZE),
      });
      if (q.trim()) params.set("q", q.trim());

      const response = await fetch(`/api/school/students?${params.toString()}`, {
        method: "GET",
        cache: "no-store",
      });
      const payload = (await response.json()) as {
        data?: StudentRow[];
        error?: string;
        pagination?: Pagination;
        sessionExpired?: boolean;
        redirectTo?: string;
      };

      if (response.status === 401 && payload.redirectTo) {
        router.replace(payload.redirectTo);
        return;
      }

      if (!response.ok) {
        throw new Error(payload.error ?? "Failed to fetch students.");
      }

      setStudents(payload.data ?? []);
      setPagination(
        payload.pagination ?? {
          page: 1,
          pageSize: PAGE_SIZE,
          total: 0,
          totalPages: 1,
        },
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch students.");
      setStudents([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchStudents(pagination.page, query);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pagination.page, query]);

  const pushToast = (message: string, type: "success" | "error") => {
    const id = Date.now() + Math.floor(Math.random() * 1000);
    setToasts((prev) => [...prev, { id, message, type }]);
    window.setTimeout(() => {
      setToasts((prev) => prev.filter((toast) => toast.id !== id));
    }, 2800);
  };

  const onSearchSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setPagination((prev) => ({ ...prev, page: 1 }));
    setQuery(queryInput.trim());
  };

  const totalCountLabel = useMemo(() => `${pagination.total} student${pagination.total === 1 ? "" : "s"}`, [
    pagination.total,
  ]);

  // Auto-format CNIC as user types: XXXX-XXXXXXX-X
  const formatCnic = (raw: string) => {
    const digits = raw.replace(/\D/g, "");
    if (digits.length <= 4) return digits;
    if (digits.length <= 11) return `${digits.slice(0, 4)}-${digits.slice(4)}`;
    return `${digits.slice(0, 4)}-${digits.slice(4, 11)}-${digits.slice(11, 12)}`;
  };

  const submitAddStudent = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!addPhoto) {
      pushToast("Student photo is required.", "error");
      return;
    }

    setAddSubmitting(true);

    try {
      const fd = new FormData();
      fd.append("fullName", addForm.fullName);
      fd.append("email", addForm.email);
      fd.append("temporaryPassword", addForm.temporaryPassword);
      fd.append("fatherName", addForm.fatherName);
      fd.append("fatherCnic", addForm.fatherCnic);
      fd.append("photo", addPhoto);

      // Do NOT set Content-Type manually — browser sets it with correct boundary
      const response = await fetch("/api/school/students", { method: "POST", body: fd });
      const payload = (await response.json()) as { error?: string };
      if (response.status === 401 && (payload as any).redirectTo) {
        router.replace((payload as any).redirectTo);
        return;
      }
      if (!response.ok) throw new Error(payload.error ?? "Failed to add student.");

      setAddOpen(false);
      setAddForm({ fullName: "", email: "", temporaryPassword: "", fatherName: "", fatherCnic: "" });
      setAddPhoto(null);
      pushToast("Student added successfully", "success");
      await fetchStudents(1, query);
      setPagination((prev) => ({ ...prev, page: 1 }));
    } catch (err) {
      pushToast(err instanceof Error ? err.message : "Failed to add student.", "error");
    } finally {
      setAddSubmitting(false);
    }
  };

  const submitEditStudent = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!editStudent) return;
    setEditSubmitting(true);
    try {
      const response = await fetch(`/api/school/students/${editStudent.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fullName: editName }),
      });
      const payload = (await response.json()) as { error?: string };
      if (response.status === 401 && (payload as any).redirectTo) {
        router.replace((payload as any).redirectTo);
        return;
      }
      if (!response.ok) throw new Error(payload.error ?? "Failed to update student.");

      pushToast("Student updated successfully", "success");
      setEditStudent(null);
      setEditName("");
      await fetchStudents(pagination.page, query);
    } catch (err) {
      pushToast(err instanceof Error ? err.message : "Failed to update student.", "error");
    } finally {
      setEditSubmitting(false);
    }
  };

  const submitDeleteStudent = async () => {
    if (!deleteStudent) return;
    setDeleteSubmitting(true);
    try {
      const response = await fetch(`/api/school/students/${deleteStudent.id}`, {
        method: "DELETE",
      });
      const payload = (await response.json()) as { error?: string };
      if (response.status === 401 && (payload as any).redirectTo) {
        router.replace((payload as any).redirectTo);
        return;
      }
      if (!response.ok) throw new Error(payload.error ?? "Failed to delete student.");

      pushToast("Student deleted successfully", "success");
      setDeleteStudent(null);
      const nextPage =
        students.length === 1 && pagination.page > 1 ? pagination.page - 1 : pagination.page;
      setPagination((prev) => ({ ...prev, page: nextPage }));
      await fetchStudents(nextPage, query);
    } catch (err) {
      pushToast(err instanceof Error ? err.message : "Failed to delete student.", "error");
    } finally {
      setDeleteSubmitting(false);
    }
  };

  return (
    <main className="space-y-4 rounded-lg border bg-card p-4 md:p-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-lg font-semibold">Student Management</h2>
          <p className="text-sm text-muted-foreground">{totalCountLabel}</p>
        </div>
        <button
          type="button"
          onClick={() => setAddOpen(true)}
          className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground"
        >
          <UserRoundPlus className="h-4 w-4" />
          Add Student
        </button>
      </div>

      <form onSubmit={onSearchSubmit} className="flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={queryInput}
            onChange={(event) => setQueryInput(event.target.value)}
            placeholder="Search by student name or unique ID"
            className="h-10 w-full rounded-md border border-input bg-background pl-9 pr-3 text-sm"
          />
        </div>
        <button
          type="submit"
          className="h-10 rounded-md border border-border px-4 text-sm font-medium text-slate-700 hover:bg-muted"
        >
          Search
        </button>
      </form>

      {error ? (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      ) : null}

      <section className="overflow-x-auto rounded-lg border">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b bg-muted/50">
            <tr>
              <th className="p-3 font-medium">Unique Student ID</th>
              <th className="p-3 font-medium">Full Name</th>
              <th className="p-3 font-medium">Email</th>
              <th className="p-3 font-medium">Date Added</th>
              <th className="p-3 font-medium text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading
              ? Array.from({ length: 6 }).map((_, idx) => (
                  <tr key={`skeleton-${idx}`} className="border-b">
                    <td className="p-3">
                      <div className="h-4 w-28 animate-pulse rounded bg-muted" />
                    </td>
                    <td className="p-3">
                      <div className="h-4 w-36 animate-pulse rounded bg-muted" />
                    </td>
                    <td className="p-3">
                      <div className="h-4 w-44 animate-pulse rounded bg-muted" />
                    </td>
                    <td className="p-3">
                      <div className="h-4 w-24 animate-pulse rounded bg-muted" />
                    </td>
                    <td className="p-3">
                      <div className="ml-auto h-8 w-20 animate-pulse rounded bg-muted" />
                    </td>
                  </tr>
                ))
              : null}

            {!loading &&
              students.map((student, idx) => (
                <tr key={student.id} className={idx % 2 === 0 ? "border-b bg-background" : "border-b bg-muted/20"}>
                  <td className="p-3 font-mono text-xs">{student.unique_student_id}</td>
                  <td className="p-3">{student.full_name}</td>
                  <td className="p-3 text-muted-foreground">{student.email}</td>
                  <td className="p-3 text-muted-foreground">{formatDate(student.created_at)}</td>
                  <td className="p-3">
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        title="Edit student"
                        onClick={() => {
                          setEditStudent(student);
                          setEditName(student.full_name);
                        }}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-border text-slate-700 hover:bg-muted"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        title="Delete student"
                        onClick={() => setDeleteStudent(student)}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-destructive/40 text-destructive hover:bg-destructive/10"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>

        {!loading && students.length === 0 ? (
          <div className="flex flex-col items-center gap-2 px-6 py-12 text-center text-muted-foreground">
            <Users className="h-8 w-8 text-muted-foreground/70" />
            <p className="text-sm font-medium">No students added yet</p>
          </div>
        ) : null}
      </section>

      <div className="flex flex-col items-center justify-between gap-3 sm:flex-row">
        <p className="text-sm text-muted-foreground">
          Page {pagination.page} of {pagination.totalPages}
        </p>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setPagination((prev) => ({ ...prev, page: Math.max(1, prev.page - 1) }))}
            disabled={pagination.page <= 1 || loading}
            className="h-9 rounded-md border border-border px-3 text-sm disabled:cursor-not-allowed disabled:opacity-50"
          >
            Previous
          </button>
          <button
            type="button"
            onClick={() =>
              setPagination((prev) => ({ ...prev, page: Math.min(prev.totalPages, prev.page + 1) }))
            }
            disabled={pagination.page >= pagination.totalPages || loading}
            className="h-9 rounded-md border border-border px-3 text-sm disabled:cursor-not-allowed disabled:opacity-50"
          >
            Next
          </button>
        </div>
      </div>

      {addOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="w-full max-w-lg rounded-lg border bg-white p-5 shadow-lg">
            <h3 className="text-lg font-semibold">Add Student</h3>
            <form onSubmit={submitAddStudent} className="mt-4 space-y-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <label className="text-sm font-medium">Full Name <span className="text-destructive">*</span></label>
                  <input
                    required
                    value={addForm.fullName}
                    onChange={(event) => setAddForm((prev) => ({ ...prev, fullName: event.target.value }))}
                    className="h-10 w-full rounded-md border border-input px-3 text-sm"
                    placeholder="Student full name"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium">Email <span className="text-destructive">*</span></label>
                  <input
                    required
                    type="email"
                    value={addForm.email}
                    onChange={(event) => setAddForm((prev) => ({ ...prev, email: event.target.value }))}
                    className="h-10 w-full rounded-md border border-input px-3 text-sm"
                    placeholder="student@email.com"
                  />
                  <p className="text-xs text-muted-foreground">Used as the student&apos;s login email.</p>
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium">Temporary Password <span className="text-destructive">*</span></label>
                  <input
                    required
                    minLength={8}
                    value={addForm.temporaryPassword}
                    onChange={(event) =>
                      setAddForm((prev) => ({ ...prev, temporaryPassword: event.target.value }))
                    }
                    className="h-10 w-full rounded-md border border-input px-3 text-sm"
                    placeholder="Min 8 characters"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium">Father&apos;s Name <span className="text-destructive">*</span></label>
                  <input
                    required
                    value={addForm.fatherName}
                    onChange={(event) => setAddForm((prev) => ({ ...prev, fatherName: event.target.value }))}
                    className="h-10 w-full rounded-md border border-input px-3 text-sm"
                    placeholder="Father's full name"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium">Father&apos;s CNIC <span className="text-destructive">*</span></label>
                  <input
                    required
                    value={addForm.fatherCnic}
                    onChange={(event) =>
                      setAddForm((prev) => ({ ...prev, fatherCnic: formatCnic(event.target.value) }))
                    }
                    maxLength={14}
                    className="h-10 w-full rounded-md border border-input px-3 text-sm font-mono"
                    placeholder="0000-0000000-0"
                  />
                  <p className="text-xs text-muted-foreground">Format: 0000-0000000-0</p>
                </div>
                <div className="space-y-1 sm:col-span-2">
                  <label className="text-sm font-medium">Student Photo <span className="text-destructive">*</span></label>
                  <input
                    required
                    type="file"
                    accept="image/*"
                    onChange={(event) => setAddPhoto(event.target.files?.[0] ?? null)}
                    className="h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm file:mr-3 file:rounded file:border-0 file:bg-primary/10 file:px-3 file:py-1 file:text-xs file:font-medium file:text-primary"
                  />
                  <p className="text-xs text-muted-foreground">JPG, PNG or WEBP · Max 5 MB</p>
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setAddOpen(false);
                    setAddForm({ fullName: "", email: "", temporaryPassword: "", fatherName: "", fatherCnic: "" });
                    setAddPhoto(null);
                  }}
                  className="h-9 rounded-md border border-border px-3 text-sm"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={addSubmitting}
                  className="inline-flex h-9 items-center justify-center gap-2 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground disabled:opacity-60"
                >
                  {addSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  {addSubmitting ? "Adding..." : "Add Student"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {editStudent ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="w-full max-w-md rounded-lg border bg-white p-5 shadow-lg">
            <h3 className="text-lg font-semibold">Edit Student</h3>
            <form onSubmit={submitEditStudent} className="mt-4 space-y-3">
              <div className="space-y-1">
                <label className="text-sm font-medium">Student ID</label>
                <input
                  disabled
                  value={editStudent.unique_student_id}
                  className="h-10 w-full rounded-md border border-input bg-muted px-3 text-sm"
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium">Email</label>
                <input
                  disabled
                  value={editStudent.email}
                  className="h-10 w-full rounded-md border border-input bg-muted px-3 text-sm"
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium">Full Name</label>
                <input
                  required
                  value={editName}
                  onChange={(event) => setEditName(event.target.value)}
                  className="h-10 w-full rounded-md border border-input px-3 text-sm"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditStudent(null)}
                  className="h-9 rounded-md border border-border px-3 text-sm"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={editSubmitting}
                  className="inline-flex h-9 items-center justify-center gap-2 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground disabled:opacity-60"
                >
                  {editSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  {editSubmitting ? "Saving..." : "Save"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {deleteStudent ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="w-full max-w-lg rounded-lg border bg-white p-5 shadow-lg">
            <h3 className="text-lg font-semibold text-destructive">Delete Student</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Are you sure you want to delete <span className="font-medium">{deleteStudent.full_name}</span>? This
              will permanently remove their account and all claim history. This cannot be undone.
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setDeleteStudent(null)}
                className="h-9 rounded-md border border-border px-3 text-sm"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={deleteSubmitting}
                onClick={submitDeleteStudent}
                className="inline-flex h-9 items-center justify-center gap-2 rounded-md bg-destructive px-3 text-sm font-medium text-destructive-foreground disabled:opacity-60"
              >
                {deleteSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                {deleteSubmitting ? "Deleting..." : "Delete Student"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <div className="fixed bottom-4 right-4 z-[60] space-y-2">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={
              toast.type === "success"
                ? "rounded-md border border-emerald-300/50 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-800 shadow-sm"
                : "rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive shadow-sm"
            }
          >
            {toast.message}
          </div>
        ))}
      </div>
    </main>
  );
}
