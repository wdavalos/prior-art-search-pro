const { Actor } = require('apify');

const XHR = 'https://patents.google.com/xhr/query?url=';
const SITE = 'https://patents.google.com/patent/';
const PAGE = 100;

const ENTITIES = { '&hellip;': '…', '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'", '&nbsp;': ' ', '&mdash;': '—', '&ndash;': '–' };

function clean(s) {
    if (!s) return '';
    let out = String(s);
    for (const k of Object.keys(ENTITIES)) {
        if (out.indexOf(k) !== -1) out = out.split(k).join(ENTITIES[k]);
    }
    out = out.replace(/<[^>]+>/g, '');
    out = out.replace(/\s+/g, ' ').trim();
    return out;
}

async function fetchOnce(url) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 40000);
    try {
        const resp = await fetch(url, { headers: { accept: 'application/json' }, signal: ctrl.signal });
        const code = resp.status;
        if (code === 429 || code === 502 || code === 503 || code === 504) {
            const err = new Error('Google Patents ' + code);
            err.httpCode = code;
            throw err;
        }
        if (!resp.ok) {
            const err = new Error('Google Patents ' + code);
            err.httpCode = code;
            throw err;
        }
        return await resp.json();
    } finally {
        clearTimeout(timer);
    }
}

async function fetchJson(url, opts) {
    const attempts = (opts && opts.attempts) || 4;
    let lastErr = null;
    for (let i = 0; i < attempts; i++) {
        try {
            return await fetchOnce(url);
        } catch (err) {
            lastErr = err;
            const code = (err && err.httpCode) || 0;
            if (code === 429 || code === 502 || code === 503 || code === 504 || code === 0) {
                await new Promise((r) => setTimeout(r, (i + 1) * 2000));
                continue;
            }
            throw err;
        }
    }
    throw lastErr;
}

function buildQueryParams(input, offset) {
    const parts = [];
    let q = clean(input.query) || '';
    if (input.cpc) q = (q ? '(' + q + ') ' : '') + 'cpc:' + input.cpc.trim();
    parts.push('q=' + encodeURIComponent(q || '*'));
    if (input.assignee) parts.push('assignee=' + encodeURIComponent(input.assignee.trim()));
    if (input.inventor) parts.push('inventor=' + encodeURIComponent(input.inventor.trim()));
    if (input.before) parts.push('before=' + encodeURIComponent('priority:' + input.before.trim()));
    if (input.after) parts.push('after=' + encodeURIComponent('priority:' + input.after.trim()));
    if (input.status) parts.push('status=' + input.status.trim());
    if (input.type) parts.push('type=' + input.type.trim());
    if (input.country) parts.push('country=' + input.country.trim().toUpperCase());
    if (input.language) parts.push('language=' + input.language.trim().toUpperCase());
    if (input.sortBy && input.sortBy !== 'relevance') parts.push('sortBy=' + input.sortBy.trim());
    parts.push('num=' + PAGE);
    parts.push('start=' + offset);
    return XHR + encodeURIComponent(parts.join('&'));
}

function mapRow(p) {
    const pub = (p.publication_number || '').trim();
    const fam = (p.family_metadata && p.family_metadata.aggregated && p.family_metadata.aggregated.country_status) || [];
    const legal = [];
    let active = false;
    for (const c of fam) {
        const st = (c.best_patent_stage && c.best_patent_stage.state) || '';
        if (st) {
            legal.push({ country: c.country_code || '', state: st });
            if (st === 'ACTIVE') active = true;
        }
    }
    return {
        title: clean(p.title),
        publicationNumber: pub,
        url: pub ? SITE + pub : '',
        snippet: clean(p.snippet),
        assignee: clean(p.assignee),
        inventor: clean(p.inventor),
        priorityDate: p.priority_date || '',
        filingDate: p.filing_date || '',
        grantDate: p.grant_date || '',
        publicationDate: p.publication_date || '',
        language: p.language || '',
        country: pub ? pub.slice(0, 2) : '',
        legalStatus: legal,
        familyActive: active,
    };
}

Actor.main(async () => {
    const input = (await Actor.getInput()) || {};
    const maxResults = Math.max(1, Math.min(Number(input.maxResults) || 10, 1000));
    if (!input.query && !input.assignee && !input.inventor && !input.cpc) {
        await Actor.pushData([{ status: 'ERROR', reason: 'Give a query, or at least one of assignee / inventor / cpc to search.' }]);
        return;
    }

    let pushed = 0;
    let offset = 0;
    let total = null;
    let sawError = false;

    while (pushed < maxResults && offset < 1000) {
        let data;
        try {
            data = await fetchJson(buildQueryParams(input, offset));
        } catch (err) {
            sawError = true;
            const code = err && err.httpCode ? err.httpCode : 0;
            await Actor.pushData([{
                status: 'ERROR',
                httpStatus: code,
                reason: code === 429
                    ? 'Google Patents rate limit hit. Back off and retry with a lower maxResults, or schedule smaller runs.'
                    : 'Google Patents request failed (HTTP ' + (code || 'network') + '). Retry, or narrow the query.',
            }]);
            break;
        }

        const res = (data && data.results) || {};
        if (total === null) total = res.total_num_results || 0;
        const cluster = (res.cluster && res.cluster.length ? res.cluster[0].result : []) || [];
        if (!cluster.length) break;
        for (const item of cluster) {
            if (pushed >= maxResults) break;
            await Actor.pushData([mapRow((item && item.patent) || {})]);
            pushed += 1;
        }
        if (cluster.length < PAGE) break;
        offset += PAGE;
    }

    if (pushed === 0 && !sawError) {
        await Actor.pushData([{
            status: 'ZERO_RESULTS',
            reason: 'No patents matched these filters. Loosen the query, widen the date window, or drop the assignee/inventor/CPC filter. This hint row is the only billed item.',
        }]);
    }

    await Actor.setValue('OUTPUT_INFO', { pushed, totalMatching: total, query: input.query || '' });
});
