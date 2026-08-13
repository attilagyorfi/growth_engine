/**
 * G2A Growth Engine — DataTable (TanStack Table + shadcn Table)
 *
 * Az audit-agent talált: "Táblázat pattern nincs — shadcn <Table> 0 fájlban.
 * AdminUsers, ProjectsPage, ContentStudio drafts, Newsletter feliratkozók —
 * mind div-alapú lista. Sort/filter/paginate reinventing. DataTable wrapper
 * Tanstack Table + shadcn Table alapokkal."
 *
 * Ez a wrapper egy-fájlos, generikus. A hívók csak columns + data prop-ot
 * adnak. Sort/global-filter/paginate ingyen.
 *
 * Használat:
 *   const columns: ColumnDef<User>[] = [
 *     { accessorKey: "name", header: "Név", cell: ({ row }) => <b>{row.original.name}</b> },
 *     { accessorKey: "email", header: "Email" },
 *   ];
 *   <DataTable columns={columns} data={users} searchPlaceholder="Név vagy email…" />
 */
import { useState } from "react";
import {
  ColumnDef, flexRender, getCoreRowModel, getFilteredRowModel,
  getPaginationRowModel, getSortedRowModel, SortingState, useReactTable,
} from "@tanstack/react-table";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  ChevronUp, ChevronDown, ChevronsUpDown, Search,
  ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight,
} from "lucide-react";

interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[];
  data: TData[];
  searchPlaceholder?: string;
  /** Ha megadva, csak ezekben az oszlopokban keresünk (accessorKey). */
  searchableColumns?: string[];
  pageSize?: number;
  /** Ha `false`, nem mutatunk paginate-et (kis listák). */
  paginated?: boolean;
  emptyMessage?: string;
}

export function DataTable<TData, TValue>({
  columns,
  data,
  searchPlaceholder = "Keresés…",
  searchableColumns,
  pageSize = 10,
  paginated = true,
  emptyMessage = "Nincs találat.",
}: DataTableProps<TData, TValue>) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [globalFilter, setGlobalFilter] = useState("");

  const table = useReactTable({
    data,
    columns,
    state: { sorting, globalFilter },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: paginated ? getPaginationRowModel() : undefined,
    initialState: { pagination: { pageSize } },
    // Global filter — ha `searchableColumns` meg van adva, csak azokban keres,
    // egyébként minden accessorFn/accessorKey-es oszlopban.
    globalFilterFn: searchableColumns
      ? (row, _columnId, filterValue) => {
          const search = String(filterValue).toLowerCase();
          return searchableColumns.some((key) => {
            const v = row.getValue(key);
            return v != null && String(v).toLowerCase().includes(search);
          });
        }
      : "includesString",
  });

  return (
    <div className="space-y-3">
      {/* Search bar */}
      <div className="flex items-center gap-2">
        <div
          className="relative flex-1 max-w-sm"
        >
          <Search
            size={14}
            className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
            style={{ color: "var(--qa-fg4)" }}
          />
          <Input
            value={globalFilter}
            onChange={(e) => setGlobalFilter(e.target.value)}
            placeholder={searchPlaceholder}
            className="pl-9"
          />
        </div>
        {globalFilter && (
          <span className="text-xs" style={{ color: "var(--qa-fg4)" }}>
            {table.getFilteredRowModel().rows.length} találat
          </span>
        )}
      </div>

      {/* Table */}
      <div
        className="rounded-xl border overflow-hidden"
        style={{ background: "var(--qa-surface)", borderColor: "var(--qa-border)" }}
      >
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id} className="hover:bg-transparent" style={{ borderColor: "var(--qa-border)" }}>
                {headerGroup.headers.map((header) => {
                  const canSort = header.column.getCanSort();
                  const sorted = header.column.getIsSorted();
                  return (
                    <TableHead
                      key={header.id}
                      style={{ color: "var(--qa-fg3)" }}
                      className={canSort ? "cursor-pointer select-none" : ""}
                      onClick={canSort ? header.column.getToggleSortingHandler() : undefined}
                    >
                      <div className="flex items-center gap-1.5">
                        {header.isPlaceholder
                          ? null
                          : flexRender(header.column.columnDef.header, header.getContext())}
                        {canSort && (
                          <span aria-hidden="true">
                            {sorted === "asc" ? <ChevronUp size={12} /> :
                             sorted === "desc" ? <ChevronDown size={12} /> :
                             <ChevronsUpDown size={12} style={{ opacity: 0.4 }} />}
                          </span>
                        )}
                      </div>
                    </TableHead>
                  );
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  data-state={row.getIsSelected() && "selected"}
                  style={{ borderColor: "var(--qa-border)" }}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id} style={{ color: "var(--qa-fg2)" }}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={columns.length} className="h-24 text-center" style={{ color: "var(--qa-fg4)" }}>
                  {emptyMessage}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {paginated && table.getPageCount() > 1 && (
        <div className="flex items-center justify-between flex-wrap gap-2">
          <p className="text-xs" style={{ color: "var(--qa-fg4)" }}>
            {table.getState().pagination.pageIndex * table.getState().pagination.pageSize + 1}
            {"–"}
            {Math.min(
              (table.getState().pagination.pageIndex + 1) * table.getState().pagination.pageSize,
              table.getFilteredRowModel().rows.length
            )}
            {" / "}
            {table.getFilteredRowModel().rows.length} sor
          </p>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="sm"
              onClick={() => table.setPageIndex(0)}
              disabled={!table.getCanPreviousPage()}
              aria-label="Első oldal"
              className="h-8 w-8 p-0"
            >
              <ChevronsLeft size={14} />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
              aria-label="Előző oldal"
              className="h-8 w-8 p-0"
            >
              <ChevronLeft size={14} />
            </Button>
            <span className="text-xs px-2" style={{ color: "var(--qa-fg3)" }}>
              {table.getState().pagination.pageIndex + 1} / {table.getPageCount()}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
              aria-label="Következő oldal"
              className="h-8 w-8 p-0"
            >
              <ChevronRight size={14} />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => table.setPageIndex(table.getPageCount() - 1)}
              disabled={!table.getCanNextPage()}
              aria-label="Utolsó oldal"
              className="h-8 w-8 p-0"
            >
              <ChevronsRight size={14} />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
