import React, { useMemo, useState } from 'react';
import { ArrowDownUp, ChevronLeft, ChevronRight, Download, Search } from 'lucide-react';
import {
  AGE_GROUPS,
  DatasetScope,
  OCCUPATIONS,
  SurveyResponse,
} from '../types/survey';
import { filterAndSortResponses, SortDirection, SortField } from '../utils/surveyLogic';

interface DataTableViewProps {
  responses: SurveyResponse[];
  scope: DatasetScope;
  onScopeChange: (scope: DatasetScope) => void;
}

export const DataTableView: React.FC<DataTableViewProps> = ({
  responses,
  scope,
  onScopeChange,
}) => {
  const [search, setSearch] = useState('');
  const [ageGroup, setAgeGroup] = useState('All');
  const [occupation, setOccupation] = useState('All');
  const [sortBy, setSortBy] = useState<SortField>('id');
  const [sortDir, setSortDir] = useState<SortDirection>('desc');
  const [page, setPage] = useState(1);
  const [selectedRow, setSelectedRow] = useState<SurveyResponse | null>(null);
  const pageSize = 8;

  const result = useMemo(
    () =>
      filterAndSortResponses(responses, {
        search,
        ageGroup,
        occupation,
        scope,
        sortBy,
        sortDir,
        page,
        pageSize,
      }),
    [responses, search, ageGroup, occupation, scope, sortBy, sortDir, page]
  );

  const toggleSort = (field: SortField) => {
    if (sortBy === field) {
      setSortDir((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortBy(field);
      setSortDir(field === 'avgDailyHours' ? 'desc' : 'asc');
    }
    setPage(1);
  };

  return (
    <div className="space-y-6">
      <section className="theme-surface flex flex-col justify-between gap-4 rounded-lg border p-6 sm:flex-row sm:items-center">
        <div>
          <p className="theme-accent-text text-xs font-semibold tracking-wide">
            Structured Survey Records · Search, Filter & Sort
          </p>
          <h1 className="theme-heading mt-1 text-2xl font-bold">Collected Survey Data</h1>
          <p className="theme-muted mt-1 text-sm">
            Showing{' '}
            <span className="theme-heading font-mono font-semibold tabular-nums">
              {result.totalFiltered}
            </span>{' '}
            matching record(s). Sample demonstration records are explicitly marked.
          </p>
        </div>

        <a
          href={`/api/export/csv?scope=${scope}`}
          download
          className="theme-btn-primary inline-flex items-center gap-2 rounded-md px-4 py-2 text-xs font-semibold transition-colors whitespace-nowrap shrink-0"
        >
          <Download className="h-4 w-4" />
          <span>Export CSV</span>
        </a>
      </section>

      <section className="theme-surface rounded-lg border p-5">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-12">
          <div className="md:col-span-5">
            <label htmlFor="table-search" className="sr-only">
              Search survey responses
            </label>
            <div className="relative">
              <Search className="theme-muted pointer-events-none absolute left-3 top-2.5 h-4 w-4" />
              <input
                id="table-search"
                type="search"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                placeholder="Search college, brand, apps, purpose, or opinion..."
                className="theme-surface block w-full rounded-md border py-2 pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent-secondary)]"
              />
            </div>
          </div>

          <div className="md:col-span-2">
            <label htmlFor="filter-age" className="sr-only">
              Filter by age group
            </label>
            <select
              id="filter-age"
              value={ageGroup}
              onChange={(e) => {
                setAgeGroup(e.target.value);
                setPage(1);
              }}
              className="theme-surface block w-full rounded-md border px-3 py-2 text-sm focus:outline-none"
            >
              <option value="All">All Age Groups</option>
              {AGE_GROUPS.map((age) => (
                <option key={age} value={age}>
                  {age} yrs
                </option>
              ))}
            </select>
          </div>

          <div className="md:col-span-3">
            <label htmlFor="filter-occupation" className="sr-only">
              Filter by occupation
            </label>
            <select
              id="filter-occupation"
              value={occupation}
              onChange={(e) => {
                setOccupation(e.target.value);
                setPage(1);
              }}
              className="theme-surface block w-full rounded-md border px-3 py-2 text-sm focus:outline-none"
            >
              <option value="All">All Occupations</option>
              {OCCUPATIONS.map((occ) => (
                <option key={occ} value={occ}>
                  {occ}
                </option>
              ))}
            </select>
          </div>

          <div className="md:col-span-2">
            <label htmlFor="filter-scope" className="sr-only">
              Filter by data source
            </label>
            <select
              id="filter-scope"
              value={scope}
              onChange={(e) => {
                onScopeChange(e.target.value as DatasetScope);
                setPage(1);
              }}
              className="theme-surface block w-full rounded-md border px-3 py-2 text-sm focus:outline-none"
            >
              <option value="all">All Sources</option>
              <option value="real">Real Only</option>
              <option value="sample">Sample Demo</option>
            </select>
          </div>
        </div>

        <div className="mt-5 overflow-x-auto">
          <table className="w-full border-collapse text-left text-sm">
            <thead>
              <tr className="theme-surface-muted theme-muted border-b border-[var(--border-subtle)] text-xs font-semibold">
                <th className="px-3 py-2.5">
                  <button
                    type="button"
                    onClick={() => toggleSort('id')}
                    className="inline-flex items-center gap-1 hover:opacity-80"
                  >
                    <span>ID</span>
                    <ArrowDownUp className="h-3 w-3" />
                  </button>
                </th>
                <th className="px-3 py-2.5">Source</th>
                <th className="px-3 py-2.5">
                  <button
                    type="button"
                    onClick={() => toggleSort('ageGroup')}
                    className="inline-flex items-center gap-1 hover:opacity-80"
                  >
                    <span>Age</span>
                    <ArrowDownUp className="h-3 w-3" />
                  </button>
                </th>
                <th className="px-3 py-2.5">
                  <button
                    type="button"
                    onClick={() => toggleSort('occupation')}
                    className="inline-flex items-center gap-1 hover:opacity-80"
                  >
                    <span>Occupation</span>
                    <ArrowDownUp className="h-3 w-3" />
                  </button>
                </th>
                <th className="px-3 py-2.5">Brand</th>
                <th className="px-3 py-2.5 text-right">
                  <button
                    type="button"
                    onClick={() => toggleSort('avgDailyHours')}
                    className="inline-flex items-center gap-1 hover:opacity-80"
                  >
                    <span>Daily Hrs</span>
                    <ArrowDownUp className="h-3 w-3" />
                  </button>
                </th>
                <th className="px-3 py-2.5">Primary Purpose</th>
                <th className="px-3 py-2.5">
                  <button
                    type="button"
                    onClick={() => toggleSort('privacyAwareness')}
                    className="inline-flex items-center gap-1 hover:opacity-80"
                  >
                    <span>Privacy</span>
                    <ArrowDownUp className="h-3 w-3" />
                  </button>
                </th>
                <th className="px-3 py-2.5 text-right">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-subtle)]">
              {result.items.length === 0 ? (
                <tr>
                  <td colSpan={9} className="theme-muted px-4 py-10 text-center text-sm">
                    No survey responses match your active search or filter criteria.
                  </td>
                </tr>
              ) : (
                result.items.map((row) => (
                  <tr key={row.id} className="hover:bg-[var(--bg-surface-muted)]">
                    <td className="theme-muted px-3 py-2.5 font-mono text-xs tabular-nums">
                      #{row.id}
                    </td>
                    <td className="px-3 py-2.5 text-xs">
                      {row.isSample ? (
                        <span className="theme-accent-text font-medium">Sample Demo</span>
                      ) : (
                        <span className="theme-heading font-semibold">Real Submission</span>
                      )}
                    </td>
                    <td className="theme-muted px-3 py-2.5 font-mono text-xs tabular-nums">
                      {row.ageGroup}
                    </td>
                    <td className="theme-heading px-3 py-2.5 font-medium">{row.occupation}</td>
                    <td className="theme-muted px-3 py-2.5">{row.smartphoneBrand}</td>
                    <td className="theme-heading px-3 py-2.5 text-right font-mono font-medium tabular-nums">
                      {row.avgDailyHours.toFixed(1)}
                    </td>
                    <td className="theme-muted px-3 py-2.5">{row.primaryPurpose}</td>
                    <td className="theme-muted px-3 py-2.5 text-xs font-medium">
                      {row.privacyAwareness}
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      <button
                        type="button"
                        onClick={() => setSelectedRow(row)}
                        className="theme-accent-text text-xs font-semibold hover:underline"
                      >
                        Inspect
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="theme-muted mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-[var(--border-subtle)] pt-4 text-xs">
          <p className="font-mono tabular-nums">
            Page {result.currentPage} of {result.totalPages} ({result.totalFiltered} records)
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={result.currentPage <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="theme-surface inline-flex items-center gap-1 rounded-md border px-3 py-1.5 font-medium disabled:opacity-40"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
              <span>Previous</span>
            </button>
            <button
              type="button"
              disabled={result.currentPage >= result.totalPages}
              onClick={() => setPage((p) => Math.min(result.totalPages, p + 1))}
              className="theme-surface inline-flex items-center gap-1 rounded-md border px-3 py-1.5 font-medium disabled:opacity-40"
            >
              <span>Next</span>
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </section>

      {selectedRow && (
        <section
          aria-label="Selected response details"
          className="theme-surface rounded-lg border p-6"
        >
          <div className="flex items-start justify-between gap-4 border-b border-[var(--border-subtle)] pb-4">
            <div>
              <p className="theme-accent-text text-xs font-semibold">
                Response #{selectedRow.id} ·{' '}
                {selectedRow.isSample ? 'Sample Demo Record' : 'Real Submission'}
              </p>
              <h2 className="theme-heading mt-1 text-lg font-semibold">
                {selectedRow.occupation} ({selectedRow.ageGroup} yrs · {selectedRow.gender})
              </h2>
            </div>
            <button
              type="button"
              onClick={() => setSelectedRow(null)}
              className="theme-surface rounded-md border px-3 py-1.5 text-xs font-medium hover:opacity-90"
            >
              Close
            </button>
          </div>

          <dl className="mt-4 grid grid-cols-1 gap-4 text-sm sm:grid-cols-3">
            <div>
              <dt className="theme-muted text-xs">Device & Tenure</dt>
              <dd className="theme-heading mt-0.5 font-medium">
                {selectedRow.smartphoneBrand} · {selectedRow.yearsOfUsage}
              </dd>
            </div>
            <div>
              <dt className="theme-muted text-xs">Daily Breakdown</dt>
              <dd className="theme-heading mt-0.5 font-mono tabular-nums">
                Total {selectedRow.avgDailyHours}h · Edu/Work {selectedRow.eduWorkHours}h · Ent{' '}
                {selectedRow.entertainmentHours}h
              </dd>
            </div>
            <div>
              <dt className="theme-muted text-xs">College / Institution</dt>
              <dd className="theme-heading mt-0.5 font-medium">
                {selectedRow.collegeName || 'Community / General Respondent'}
              </dd>
            </div>
            <div className="sm:col-span-3">
              <dt className="theme-muted text-xs">Frequently Used Applications</dt>
              <dd className="theme-muted mt-0.5">{selectedRow.frequentApps.join(', ')}</dd>
            </div>
            <div className="sm:col-span-3">
              <dt className="theme-muted text-xs">Respondent Opinion on Usage</dt>
              <dd className="theme-heading mt-0.5 leading-relaxed">
                {selectedRow.excessiveUsageOpinion}
              </dd>
            </div>
          </dl>
        </section>
      )}
    </div>
  );
};
