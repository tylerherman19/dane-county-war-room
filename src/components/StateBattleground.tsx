'use client';

import { ReactNode, useCallback, useEffect, useRef, useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import {
    CIVIC_POLL_MS, CIVIC_RACES, CivicGroup, CivicRace, CivicRaceConfig,
    displayName, fetchCivicRace, isStale, orderedCandidates, totalVotes,
} from '@/lib/civic-api';

// Same classic-538 accent palette as the Board tab.
const PARTY_COLOR: Record<string, string> = {
    Democratic: '#008fd5',
    Republican: '#fc4f30',
    Green: '#6d904f',
    Libertarian: '#e5ae38',
    Independent: '#8b5cf6',
};
const PARTY_ABBR: Record<string, string> = {
    Democratic: 'DEM', Republican: 'REP', Independent: 'IND', Green: 'GRN', Libertarian: 'LIB', 'American Solidarity': 'ASP',
};
const partyColor = (p: string) => PARTY_COLOR[p] ?? '#8b8b8b';
const partyAbbr = (p: string) => PARTY_ABBR[p] ?? p;

const CT: Intl.DateTimeFormatOptions = { timeZone: 'America/Chicago' };
const fmtTime = (ms: number) => new Date(ms).toLocaleTimeString('en-US', { ...CT, hour: 'numeric', minute: '2-digit', second: '2-digit', timeZoneName: 'short' });
const fmtStamp = (iso: string) => new Date(iso).toLocaleString('en-US', { ...CT, month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZoneName: 'short' });
const ctDay = (ms: number) => new Date(ms).toLocaleDateString('en-US', CT);
// Compact card stamp: time only when the update is from today (CT), otherwise date + time.
const fmtShort = (iso: string, now: number) => {
    const ms = Date.parse(iso);
    return new Date(ms).toLocaleString('en-US', { ...CT, ...(ctDay(ms) === ctDay(now) ? {} : { month: 'numeric', day: 'numeric' }), hour: 'numeric', minute: '2-digit' });
};
const fmtClose = (iso: string | null) => iso ? new Date(iso).toLocaleTimeString('en-US', { ...CT, hour: 'numeric', minute: '2-digit' }) + ' CT' : '8:00 PM CT';
const lastName = (n: string) => n.split(' / ')[0].trim().split(/\s+/).pop() ?? n;

interface RaceState { data?: CivicRace; lastSuccess?: number; error?: string; attempts: number }
type RaceMap = Record<number, RaceState>;

function useCivicRaces() {
    const [races, setRaces] = useState<RaceMap>({});
    const [lastPoll, setLastPoll] = useState<number | undefined>();
    const inFlight = useRef(false);
    const poll = useCallback(async () => {
        if (inFlight.current) return;
        inFlight.current = true;
        const results = await Promise.allSettled(CIVIC_RACES.map(r => fetchCivicRace(r.id, AbortSignal.timeout(20_000))));
        const at = Date.now();
        setRaces(prev => {
            const next: RaceMap = { ...prev };
            CIVIC_RACES.forEach((r, i) => {
                const res = results[i];
                const old = prev[r.id] ?? { attempts: 0 };
                // On failure keep the last good data; only the error/attempt count changes.
                next[r.id] = res.status === 'fulfilled'
                    ? { data: res.value, lastSuccess: at, attempts: old.attempts + 1 }
                    : { ...old, error: res.reason instanceof Error ? res.reason.message : 'Request failed', attempts: old.attempts + 1 };
            });
            return next;
        });
        setLastPoll(at);
        inFlight.current = false;
    }, []);
    useEffect(() => {
        // poll() only sets state after its fetches resolve (subscribing to an external source).
        // eslint-disable-next-line react-hooks/set-state-in-effect
        void poll();
        const t = setInterval(() => void poll(), CIVIC_POLL_MS);
        return () => clearInterval(t);
    }, [poll]);
    return { races, lastPoll, poll };
}

function useNow(ms = 15_000) {
    const [now, setNow] = useState(() => Date.now());
    useEffect(() => { const t = setInterval(() => setNow(Date.now()), ms); return () => clearInterval(t); }, [ms]);
    return now;
}

function RaceCard({ cfg, state, now }: { cfg: CivicRaceConfig; state?: RaceState; now: number }) {
    const [open, setOpen] = useState(false);
    const race = state?.data;
    const header = (sub: ReactNode) => (
        <div className="flex items-start justify-between gap-2 mb-2">
            <div className="min-w-0">
                <div className="text-[13px] font-bold text-[#222] leading-tight line-clamp-2" title={race?.electionName ?? cfg.label}>{cfg.label}</div>
                <div className="mt-0.5 text-[10px] text-[#999] num">{sub}</div>
            </div>
            {race?.testData && <span className="shrink-0 bg-[#b00020] text-white text-[10px] font-bold uppercase tracking-[0.08em] px-1.5 py-0.5 leading-none rounded-[2px]">Test data</span>}
        </div>
    );
    const shell = 'relative rounded-[3px] border bg-white p-3 border-[#e0e0e0]';

    if (!race) {
        const failed = !!state?.error;
        return (
            <div className={shell}>
                {header(failed ? 'Results unavailable' : 'Loading…')}
                <div className="h-1 rounded-full bg-[#ececec] mb-2.5" />
                <div className="text-[12px] text-[#666] py-3">
                    {failed ? <>Results unavailable — retrying every 60 sec.<span className="block text-[10px] text-[#999] mt-1">Last error: {state!.error}</span></> : 'Fetching results…'}
                </div>
                <div className="mt-2.5 flex items-center justify-between border-t border-[#e0e0e0] pt-2">
                    <span className="text-[11px] font-bold text-[#666]">No data</span>
                    <span className="text-[10px] text-[#999]">Unofficial</span>
                </div>
            </div>
        );
    }

    const total = totalVotes(race);
    const hasVotes = total > 0;
    const cands = orderedCandidates(race);
    const reporting = Math.max(0, Math.min(100, race.percentReporting));
    const done = reporting >= 100;
    const winner = race.candidates.find(c => c.winner);
    const margin = hasVotes && cands.length > 1 ? ((cands[0].votes - cands[1].votes) / total) * 100 : null;
    const stale = isStale(state?.lastSuccess, now);
    const closed = race.pollsClose ? now >= Date.parse(race.pollsClose) : false;

    return (
        <div className={shell}>
            {header(<>
                {`${reporting.toFixed(0)}% reporting`}
                {race.lastUpdated && <span title="When civicAPI last changed this race's data" className="whitespace-nowrap"> · src upd. {fmtShort(race.lastUpdated, now)}</span>}
            </>)}

            <div className="h-1 rounded-full bg-[#ececec] overflow-hidden mb-2.5">
                <div className="h-full rounded-full" style={{ width: `${reporting}%`, background: done ? '#6d904f' : '#008fd5' }} />
            </div>

            <div className="space-y-1.5">
                {cands.map((c, i) => {
                    const lead = hasVotes && i === 0;
                    const name = displayName(cfg.id, c.name);
                    return (
                        <div key={c.name} className="flex items-center gap-2">
                            <span className="w-1.5 h-6 rounded-full shrink-0" style={{ background: partyColor(c.party) }} />
                            <span className={`flex-1 min-w-0 truncate text-[13px] ${lead ? 'text-[#222] font-bold' : 'text-[#666]'}`} title={`${name} (${c.party || 'no party listed'})`}>
                                <span className="text-[11px] mr-1">{partyAbbr(c.party)}</span>{name}
                                {c.winner && <span className="ml-1 text-[#567a3a] font-bold" title="Marked as winner in the civicAPI payload (unofficial call)">✓</span>}
                            </span>
                            {hasVotes
                                ? <span className="shrink-0 text-right leading-tight">
                                    <span className={`num block text-[13px] ${lead ? 'text-[#222] font-bold' : 'text-[#999]'}`}>{((c.votes / total) * 100).toFixed(1)}%</span>
                                    <span className="num block text-[10px] text-[#999]">{c.votes.toLocaleString('en-US')}</span>
                                </span>
                                : <span className="num shrink-0 text-[13px] text-[#cccccc]" aria-label="No votes reported">—</span>}
                        </div>
                    );
                })}
            </div>

            {stale && (
                <div className="mt-2 text-[10px] font-bold text-[#785208] bg-[#fff4df] rounded-[2px] px-1.5 py-1">
                    Stale — last fetched {fmtTime(state!.lastSuccess!)}
                </div>
            )}

            <div className="mt-2.5 flex items-center justify-between gap-2 border-t border-[#e0e0e0] pt-2">
                <span className={`text-[11px] font-bold ${winner ? 'text-[#567a3a]' : 'text-[#666]'}`}>
                    {winner
                        ? `✓ ${lastName(displayName(cfg.id, winner.name))} — civicAPI unofficial call`
                        : !hasVotes
                            ? `No results yet — polls ${closed ? 'closed' : 'close'} at ${fmtClose(race.pollsClose)}`
                            : margin !== null ? `Lead +${margin.toFixed(1)}` : 'Unopposed'}
                </span>
                <span className="shrink-0 flex items-center gap-2 text-[10px] text-[#999]">
                    {hasVotes && race.regions.length > 0 && (
                        <button onClick={() => setOpen(v => !v)} aria-expanded={open} className="flex items-center gap-0.5 hover:text-[#222]">
                            Counties {open ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                        </button>
                    )}
                    Unofficial
                </span>
            </div>

            {open && hasVotes && (
                <div className="mt-2 max-h-56 overflow-y-auto border-t border-[#e0e0e0]">
                    <table className="w-full text-[11px]">
                        <thead className="sticky top-0 bg-white text-[#999]">
                            <tr>
                                <th className="text-left font-normal py-1">County{cfg.group !== 'STATEWIDE' && ' (in district)'}</th>
                                <th className="text-right font-normal py-1">In</th>
                                {cands.slice(0, 3).map(c => <th key={c.name} className="text-right font-normal py-1 pl-1 truncate max-w-[70px]">{lastName(displayName(cfg.id, c.name))}</th>)}
                            </tr>
                        </thead>
                        <tbody>
                            {race.regions.map(r => {
                                const rt = r.candidates.reduce((n, c) => n + c.votes, 0);
                                return (
                                    <tr key={r.key} className="border-t border-[#f0f0f0]">
                                        <td className="py-0.5 text-[#222]">{r.name}</td>
                                        <td className="num text-right text-[#999]">{r.percentReporting.toFixed(0)}%</td>
                                        {cands.slice(0, 3).map(c => {
                                            const v = r.candidates.find(x => x.name === c.name)?.votes;
                                            return <td key={c.name} className="num text-right pl-1 text-[#222]">{rt > 0 && v !== undefined ? `${((v / rt) * 100).toFixed(1)}%` : '—'}</td>;
                                        })}
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}

function Section({ title, note, groups, races, now }: { title: string; note?: string; groups: { group: CivicGroup; label?: string }[]; races: RaceMap; now: number }) {
    return (
        <section className="mb-6">
            <div className="flex items-baseline gap-2 mb-2">
                <h2 className="text-[11px] font-bold text-[#222] uppercase tracking-[0.08em]">{title}</h2>
                {note && <span className="text-[11px] text-[#666]">{note}</span>}
            </div>
            {groups.map(g => (
                <div key={g.group} className="mb-3">
                    {g.label && <div className="text-[10px] font-bold text-[#999] uppercase tracking-[0.08em] mb-1.5">{g.label}</div>}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 items-start">
                        {CIVIC_RACES.filter(r => r.group === g.group).map(r => <RaceCard key={r.id} cfg={r} state={races[r.id]} now={now} />)}
                    </div>
                </div>
            ))}
        </section>
    );
}

export default function StateBattleground() {
    const { races, lastPoll, poll } = useCivicRaces();
    const now = useNow();
    const states = CIVIC_RACES.map(r => races[r.id]);
    const withData = states.filter(s => s?.data);
    const fetchedTimes = states.map(s => s?.lastSuccess).filter((t): t is number => t !== undefined);
    // "Last fetched" is the oldest successful fetch among races we have data for: every shown number is at least this fresh.
    const oldestFetch = fetchedTimes.length ? Math.min(...fetchedTimes) : undefined;
    const sourceTimes = withData.map(s => s!.data!.lastUpdated).filter((t): t is string => !!t).map(t => Date.parse(t)).filter(n => !Number.isNaN(n));
    const newestSource = sourceTimes.length ? Math.max(...sourceTimes) : undefined;
    const staleCount = states.filter(s => s?.data && isStale(s.lastSuccess, now)).length;
    const unavailable = states.filter(s => s && !s.data && s.error).length;
    const failedLast = lastPoll ? states.filter(s => s?.error && (s.lastSuccess ?? 0) < lastPoll).length : 0;
    const anyTest = withData.some(s => s!.data!.testData);

    return (
        <div className="absolute inset-0 flex flex-col bg-[#f0f0f0]">
            <div className="shrink-0 border-b border-[#e0e0e0] bg-white">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 px-3 md:px-5 py-2.5">
                    <span className="bg-[#fc4f30] text-white text-[10px] font-bold uppercase tracking-[0.08em] px-1.5 py-0.5 leading-none rounded-[2px]">Unofficial results</span>
                    <span className="text-xs text-[#666]">Wisconsin · November 3, 2026</span>
                    <a href="https://civicapi.org" target="_blank" rel="noreferrer" className="sm:ml-auto text-[11px] text-[#666] hover:text-[#222] underline underline-offset-2">Data: civicAPI (civicapi.org) – unofficial</a>
                </div>
                <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-1 px-3 md:px-5 py-2 border-t border-[#e0e0e0] text-[11px] text-[#666]">
                    <span><strong className="text-[#222]">Full statewide and full-district totals</strong> — not Dane County&apos;s portion. The rest of this site is Dane County only.</span>
                    <span className="num text-[10px] md:text-right">
                        <span className="block" title="When this page last successfully pulled civicAPI (oldest across all races shown)">
                            Last fetched: {oldestFetch ? fmtTime(oldestFetch) : '—'} · every 60 sec
                        </span>
                        <span className="block" title="civicAPI's own last_updated: when the source data last changed (newest across races)">
                            Source updated: {newestSource ? fmtStamp(new Date(newestSource).toISOString()) : '—'}
                        </span>
                    </span>
                </div>
            </div>

            {anyTest && (
                <div role="alert" className="shrink-0 bg-[#b00020] text-white text-[13px] font-bold px-3 md:px-5 py-2 uppercase tracking-[0.04em]">
                    ⚠ Test data — civicAPI has flagged one or more races as test data. These are not real results.
                </div>
            )}
            {staleCount > 0 && (
                <div role="alert" className="shrink-0 data-error">
                    Stale data: {staleCount === withData.length ? 'results' : `${staleCount} race${staleCount > 1 ? 's' : ''}`} last fetched more than 5 minutes ago — our requests to civicAPI are failing (separate from when the source last updated). Showing last good data.
                    <button onClick={() => void poll()}>Retry now</button>
                </div>
            )}
            {staleCount === 0 && (failedLast > 0 || unavailable > 0) && (
                <div role="status" className="shrink-0 data-error">
                    {failedLast} of {CIVIC_RACES.length} races failed on the latest fetch{unavailable > 0 ? ` (${unavailable} with no data yet)` : ''}. Retrying every 60 sec.
                    <button onClick={() => void poll()}>Retry now</button>
                </div>
            )}

            <div className="flex-1 overflow-y-auto p-3 md:p-5">
                <Section title="Statewide" groups={[{ group: 'STATEWIDE' }]} races={races} now={now} />
                <Section title="Battleground Legislature" note="8 Assembly · 3 Senate"
                    groups={[{ group: 'ASSEMBLY', label: 'State Assembly' }, { group: 'SENATE', label: 'State Senate' }]} races={races} now={now} />
                <p className="text-[10px] text-[#999] pb-2">
                    Unofficial results via <a className="underline" href="https://civicapi.org" target="_blank" rel="noreferrer">civicAPI</a>. A leading candidate is not a winner; a ✓ appears only when civicAPI&apos;s payload marks a winner, and that call is unofficial. Official results come from the Wisconsin Elections Commission canvass.
                </p>
            </div>
        </div>
    );
}
