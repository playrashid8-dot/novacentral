"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import API, { getApiErrorMessage, normalize } from "../../lib/api";
import { logout } from "../../lib/auth";
import { fetchCurrentUser } from "../../lib/session";
import AppToast from "../../components/AppToast";
import ProtectedRoute from "../../components/ProtectedRoute";
import PageWrapper from "../../components/PageWrapper";
import LiveRefreshIndicator from "../../components/LiveRefreshIndicator";

type ReferralStatsPayload = {
    directCount?: number;
    teamCount?: number;
    referralEarnings?: number;
    referralCode?: string;
    teamVolume?: number;
};

type TeamMemberRow = {
    id?: string;
    username: string;
    level: "A" | "B" | "C";
    joinedAt: string;
    balance: number;
};

function normalizeTeamPayload(raw: unknown): { members: TeamMemberRow[]; hasMore: boolean } {
    if (Array.isArray(raw)) {
        return { members: raw as TeamMemberRow[], hasMore: false };
    }
    if (raw && typeof raw === "object" && raw !== null) {
        const o = raw as { members?: TeamMemberRow[]; hasMore?: unknown };
        const members = Array.isArray(o.members) ? o.members : [];
        const hasMore = Boolean(o.hasMore);
        return { members, hasMore };
    }
    return { members: [], hasMore: false };
}

function isAfterClaim(joinedIso: string | undefined, claimedIso: string | null | undefined): boolean {
  if (!claimedIso || !joinedIso) return false;
  const j = new Date(joinedIso).getTime();
  const c = new Date(claimedIso).getTime();
  if (Number.isNaN(j) || Number.isNaN(c)) return false;
  return j > c;
}

export default function TeamPage() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState("");
  const [stats, setStats] = useState<ReferralStatsPayload | null>(null);
  const [referralStatsReady, setReferralStatsReady] = useState(false);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<number | null>(null);
  const [members, setMembers] = useState<TeamMemberRow[]>([]);
  const [membersReady, setMembersReady] = useState(false);
  const [loadingMembers, setLoadingMembers] = useState(true);
  const [membersPage, setMembersPage] = useState(1);
  const [membersHasMore, setMembersHasMore] = useState(false);
  const [loadingMoreMembers, setLoadingMoreMembers] = useState(false);
  const [lastSalaryClaimAt, setLastSalaryClaimAt] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(""), 2500);
  };

  const load = useCallback(async (silent: boolean) => {
    try {
      if (!silent) {
        setLoading(true);
        setLoadingMembers(true);
      }
      const data = await fetchCurrentUser();
      if (!data) throw new Error("No user data");
      setUser(data);
      if (!silent) setLoading(false);

      const [res, teamRes, salRes] = await Promise.all([
        API.get("/user/referral-stats").catch(() => null),
        API.get("/user/team-members?page=1").catch(() => null),
        API.get("/user/salary-progress").catch(() => null),
      ]);
      if (res?.data) {
        const response = normalize(res.data);
        const payload =
          response.data && typeof response.data === "object" && Object.keys(response.data).length
            ? response.data
            : null;
        setStats(payload as ReferralStatsPayload);
      } else {
        setStats(null);
      }
      if (teamRes?.data && normalize(teamRes.data).success) {
        const teamEnvelope = normalize(teamRes.data);
        const normalized = normalizeTeamPayload(teamEnvelope.data);
        setMembers(normalized.members);
        setMembersPage(1);
        setMembersHasMore(normalized.hasMore);
      } else {
        setMembers([]);
        setMembersPage(1);
        setMembersHasMore(false);
      }
      if (salRes?.data && normalize(salRes.data).success) {
        const sal = normalize(salRes.data).data as { lastClaimedAt?: string | null } | undefined;
        const at = sal?.lastClaimedAt;
        setLastSalaryClaimAt(at != null && String(at).trim() ? String(at) : null);
      } else {
        setLastSalaryClaimAt(null);
      }
      setLastUpdatedAt(Date.now());
    } catch (err: any) {
      if (!silent) showToast(getApiErrorMessage(err, "Session expired 🔒"));
      logout();
    } finally {
      setReferralStatsReady(true);
      setMembersReady(true);
      setLoadingMembers(false);
      if (!silent) setLoading(false);
    }
  }, []);

  const loadMoreMembers = useCallback(async () => {
    if (!membersHasMore || loadingMoreMembers || loadingMembers) return;
    try {
      setLoadingMoreMembers(true);
      const nextPage = membersPage + 1;
      const teamRes = await API.get(`/user/team-members?page=${nextPage}`);
      if (!teamRes?.data || !normalize(teamRes.data).success) {
        throw new Error("Bad response");
      }
      const normalized = normalizeTeamPayload(normalize(teamRes.data).data);
      setMembers((prev) => [...prev, ...normalized.members]);
      setMembersPage(nextPage);
      setMembersHasMore(normalized.hasMore);
    } catch {
      showToast("Could not load more members");
    } finally {
      setLoadingMoreMembers(false);
    }
  }, [
    loadingMembers,
    loadingMoreMembers,
    membersHasMore,
    membersPage,
    showToast,
  ]);

  useEffect(() => {
    void load(false);
    const onFocus = () => {
      if (document.hidden) return;
      void load(true);
    };
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [load]);

  useEffect(() => {
    const tick = () => {
      if (document.hidden) return;
      void load(true);
    };
    const id = window.setInterval(tick, 15000);
    return () => window.clearInterval(id);
  }, [load]);

  const directCount = Number(stats?.directCount ?? 0);
  const teamCount = Number(stats?.teamCount ?? 0);
  const referralIncome = Number(stats?.referralEarnings ?? 0);

  return (
    <ProtectedRoute>
      <PageWrapper loading={loading} data={user?._id} useSkeletonLoading emptyText="No data available">
        <TeamContent
          directCount={directCount}
          teamCount={teamCount}
          referralIncome={referralIncome}
          referralStatsReady={referralStatsReady}
          members={members}
          membersReady={membersReady}
          loadingMembers={loadingMembers}
          lastUpdatedAt={lastUpdatedAt}
          lastSalaryClaimAt={lastSalaryClaimAt}
          toast={toast}
          membersHasMore={membersHasMore}
          loadingMoreMembers={loadingMoreMembers}
          onLoadMoreMembers={() => void loadMoreMembers()}
        />
      </PageWrapper>
    </ProtectedRoute>
  );
}

function TeamContent({
  directCount,
  teamCount,
  referralIncome,
  referralStatsReady,
  members,
  membersReady,
  loadingMembers,
  lastUpdatedAt,
  lastSalaryClaimAt,
  toast,
  membersHasMore,
  loadingMoreMembers,
  onLoadMoreMembers,
}: {
  directCount: number;
  teamCount: number;
  referralIncome: number;
  referralStatsReady: boolean;
  members: TeamMemberRow[];
  membersReady: boolean;
  loadingMembers: boolean;
  lastUpdatedAt: number | null;
  lastSalaryClaimAt: string | null;
  toast: string;
  membersHasMore: boolean;
  loadingMoreMembers: boolean;
  onLoadMoreMembers: () => void;
}) {
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedSearch(search.trim()), 350);
    return () => window.clearTimeout(t);
  }, [search]);

  const levelCounts = useMemo(() => {
    const counts = { A: 0, B: 0, C: 0 };
    members.forEach((m) => {
      counts[m.level]++;
    });
    return counts;
  }, [members]);

  const filteredMembers = useMemo(() => {
    const q = debouncedSearch.toLowerCase();
    if (!q) return members;
    return members.filter((u) =>
      String(u.username ?? "")
        .toLowerCase()
        .includes(q)
    );
  }, [members, debouncedSearch]);

  const totalBalance = useMemo(
    () => members.reduce((sum, u) => sum + Number(u.balance ?? 0), 0),
    [members]
  );

  return (
    <div className="relative w-full max-w-full overflow-x-hidden pb-3 text-white">
      <AppToast message={toast} />

      <motion.header
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative z-10 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
      >
        <div>
          <h1 className="text-xl font-black tracking-tight text-white sm:text-2xl">Team</h1>
          <p className="mt-1 text-[11px] text-gray-500">Referral overview</p>
        </div>
        <LiveRefreshIndicator lastUpdatedAt={lastUpdatedAt} />
      </motion.header>

      <motion.section
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
        className="mt-6"
      >
        <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-indigo-300/85">Stats</p>
        <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3 sm:gap-3">
          <StatPill label="Direct team (A)" value={referralStatsReady ? directCount : "—"} accent="text-emerald-200" />
          <StatPill label="Total team" value={referralStatsReady ? teamCount : "—"} accent="text-sky-200" />
          <StatPill
            label="Total team income"
            value={referralStatsReady ? `$${referralIncome.toFixed(2)}` : "—"}
            accent="text-violet-200"
            isCurrency
          />
        </div>
        <p className="mt-2 text-[10px] leading-relaxed text-gray-500">
          Data based on real referral stats
        </p>
      </motion.section>

      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="mt-4">
        <Link
          href="/team/salary"
          className="block w-full rounded-xl bg-purple-600 py-3 text-center text-sm font-bold text-white shadow-lg shadow-purple-900/30 transition hover:bg-purple-500"
        >
          Team Salary
        </Link>
      </motion.div>

      <motion.section
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.12 }}
        className="mt-6 rounded-2xl border border-white/[0.08] bg-white/[0.04] p-4 backdrop-blur-xl ring-1 ring-white/[0.05]"
      >
        <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-gray-400">Members</p>
          <div className="flex flex-col items-end gap-0.5 text-[10px] text-gray-500">
            <span>{referralStatsReady ? `${teamCount} in network` : "—"}</span>
            {membersReady && (
              <span className="tabular-nums text-gray-400">
                Level A: {levelCounts.A} · B: {levelCounts.B} · C: {levelCounts.C}
              </span>
            )}
          </div>
        </div>

        <MembersMessage
          teamCount={teamCount}
          referralStatsReady={referralStatsReady}
          members={members}
          membersReady={membersReady}
          loadingMembers={loadingMembers}
          filteredMembers={filteredMembers}
          totalBalance={totalBalance}
          search={search}
          setSearch={setSearch}
          lastSalaryClaimAt={lastSalaryClaimAt}
          membersHasMore={membersHasMore}
          loadingMoreMembers={loadingMoreMembers}
          onLoadMoreMembers={onLoadMoreMembers}
        />
      </motion.section>
    </div>
  );
}

function StatPill({
  label,
  value,
  accent,
  isCurrency,
}: {
  label: string;
  value: number | string;
  accent: string;
  isCurrency?: boolean;
}) {
  return (
    <div className="rounded-2xl border border-white/[0.08] bg-black/25 px-3 py-3 text-center shadow-soft backdrop-blur-md ring-1 ring-white/[0.04]">
      <p className="text-[8px] font-semibold uppercase tracking-[0.14em] text-gray-500">{label}</p>
      <p
        className={`mt-1 font-black tabular-nums sm:text-xl ${accent} ${isCurrency ? "text-base sm:text-lg" : "text-lg"}`}
      >
        {value}
      </p>
    </div>
  );
}

function MembersMessage({
  teamCount,
  referralStatsReady,
  members,
  membersReady,
  loadingMembers,
  filteredMembers,
  totalBalance,
  search,
  setSearch,
  lastSalaryClaimAt,
  membersHasMore,
  loadingMoreMembers,
  onLoadMoreMembers,
}: {
  teamCount: number;
  referralStatsReady: boolean;
  members: TeamMemberRow[];
  membersReady: boolean;
  loadingMembers: boolean;
  filteredMembers: TeamMemberRow[];
  totalBalance: number;
  search: string;
  setSearch: (v: string) => void;
  lastSalaryClaimAt: string | null;
  membersHasMore: boolean;
  loadingMoreMembers: boolean;
  onLoadMoreMembers: () => void;
}) {
  if (loadingMembers) {
    return (
      <div className="space-y-2">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-12 animate-pulse rounded-xl bg-white/5" />
        ))}
      </div>
    );
  }

  if (!referralStatsReady || !membersReady) {
    return (
      <div className="rounded-xl border border-white/[0.06] bg-black/25 px-3 py-8 text-center">
        <p className="text-sm text-gray-500">Loading team information…</p>
      </div>
    );
  }

  if (!loadingMembers && teamCount > 0 && members.length === 0) {
    return (
      <div className="text-center text-sm text-red-400">Failed to load team members</div>
    );
  }

  if (members.length > 0) {
    return (
      <div className="space-y-3">
        <div className="text-sm font-bold text-emerald-400 tabular-nums">
          Total Team Balance: ${totalBalance.toFixed(2)}
        </div>
        <input
          type="search"
          placeholder="Search username…"
          className="mb-3 w-full rounded-xl bg-white/5 p-2 text-sm text-white placeholder:text-gray-500 ring-1 ring-white/[0.08] outline-none focus:ring-white/20"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          autoComplete="off"
        />
        <div className="max-h-[min(420px,55vh)] space-y-3 overflow-y-auto pr-1">
          {filteredMembers.length === 0 ? (
            <p className="py-4 text-center text-sm text-gray-500">No usernames match your search.</p>
          ) : (
            filteredMembers.map((userRow) => (
              <div
                key={userRow.id ?? `${userRow.username}-${userRow.level}`}
                className="flex justify-between rounded-xl bg-white/5 p-3 ring-1 ring-white/[0.06]"
              >
                <div className="min-w-0 pr-2">
                  <p className="flex flex-wrap items-center gap-x-2 gap-y-1 truncate text-white">
                    <span className="truncate">{userRow.username}</span>
                    {isAfterClaim(userRow.joinedAt, lastSalaryClaimAt) ? (
                      <span className="shrink-0 text-green-400 text-xs font-semibold uppercase tracking-wide">
                        NEW
                      </span>
                    ) : null}
                  </p>
                  <p className="text-xs text-gray-400">
                    {userRow.joinedAt ? new Date(userRow.joinedAt).toLocaleDateString() : "—"}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="font-bold tabular-nums text-emerald-400">
                    ${Number(userRow.balance).toFixed(2)}
                  </p>
                  <p className="text-xs text-gray-400">Level {userRow.level}</p>
                </div>
              </div>
            ))
          )}
        </div>
        {membersHasMore && (
          <button
            type="button"
            onClick={onLoadMoreMembers}
            disabled={loadingMoreMembers || Boolean(search.trim())}
            className="mt-3 w-full rounded-xl bg-white/[0.08] py-3 text-sm font-semibold text-white ring-1 ring-white/[0.1] hover:bg-white/12 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loadingMoreMembers
              ? "Loading…"
              : search.trim()
                ? "Clear search to load more tiers"
                : "Load more"}
          </button>
        )}
      </div>
    );
  }

  if (teamCount === 0) {
    return (
      <div className="rounded-xl border border-white/[0.06] bg-black/25 px-3 py-8 text-center">
        <p className="text-sm font-medium text-gray-300">No team members yet — share your referral link</p>
        <p className="mt-2 text-[11px] text-gray-500">Use My referral link on Profile to invite partners.</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-white/[0.06] bg-black/25 px-3 py-8 text-center">
      <p className="text-sm text-gray-400">Couldn&apos;t load member list</p>
      <p className="mt-2 text-[11px] leading-relaxed text-gray-500">
        Stats above reflect your full network. This list covers levels A–C only and refreshes automatically.
      </p>
    </div>
  );
}
