const UPSTREAM_BASE = 'https://api.danecounty.gov/api/v1/elections';

export async function GET(
    _req: Request,
    { params }: { params: Promise<{ path: string[] }> }
) {
    const { path } = await params;
    const upstreamPath = path.join('/');
    const url = `${UPSTREAM_BASE}/${upstreamPath}`;

    try {
        const upstream = await fetch(url, {
            headers: { 'Accept': 'application/json' },
            next: { revalidate: 0 },
        });

        if (!upstream.ok) {
            return new Response(
                JSON.stringify({ error: `Upstream error: ${upstream.status} ${upstream.statusText}` }),
                { status: upstream.status, headers: { 'Content-Type': 'application/json' } }
            );
        }

        const data = await upstream.json();
        return Response.json(data, {
            headers: {
                'Cache-Control': 'no-store',
            },
        });
    } catch (err) {
        console.error(`[API Proxy] Failed to fetch ${url}:`, err);
        return new Response(
            JSON.stringify({ error: 'Failed to reach Dane County API' }),
            { status: 502, headers: { 'Content-Type': 'application/json' } }
        );
    }
}
