const PAGE_SIZE = 1000;

interface PageResult<T> {
  data: T[] | null;
  error: { message: string } | null;
}

// Supabase caps every select at the project's "Max rows" (1000 by default) and
// silently drops the rest. Page until a request comes back empty — advancing by
// what was actually returned, so this still works if the cap is below PAGE_SIZE.
// The query passed in must have a stable, unique order (e.g. end with .order("id")).
export async function fetchAll<T>(
  page: (from: number, to: number) => PromiseLike<PageResult<T>>
): Promise<T[]> {
  const rows: T[] = [];
  for (;;) {
    const { data, error } = await page(rows.length, rows.length + PAGE_SIZE - 1);
    if (error) throw new Error(error.message);
    if (!data || data.length === 0) return rows;
    rows.push(...data);
  }
}
