"use client";

type School = { id: string; name: string };

export default function SchoolFilterSelect({
  schools,
  selectedSchoolId,
}: {
  schools: School[];
  selectedSchoolId: string;
}) {
  return (
    <form method="get" className="flex flex-wrap items-center gap-2">
      <label
        htmlFor="school-filter"
        className="whitespace-nowrap text-sm font-medium text-muted-foreground"
      >
        Filter by school:
      </label>
      <select
        id="school-filter"
        name="school"
        defaultValue={selectedSchoolId}
        onChange={(e) => {
          (e.target.form as HTMLFormElement).submit();
        }}
        className="h-9 rounded-md border border-input bg-background px-3 text-sm"
      >
        <option value="">All Students</option>
        {schools.map((school) => (
          <option key={school.id} value={school.id}>
            {school.name}
          </option>
        ))}
      </select>
      {/* No-JS fallback */}
      <noscript>
        <button
          type="submit"
          className="h-9 rounded-md border border-border px-3 text-sm font-medium hover:bg-muted"
        >
          Apply
        </button>
      </noscript>
      {selectedSchoolId ? (
        <a
          href="/admin/students"
          className="inline-flex h-9 items-center rounded-md border border-border px-3 text-sm text-muted-foreground hover:bg-muted"
        >
          Clear
        </a>
      ) : null}
    </form>
  );
}
