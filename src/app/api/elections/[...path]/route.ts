export async function GET(
    _req: Request,
    { params }: { params: Promise<{ path: string[] }> }
) {
    const { path } = await params;
    const upstream = `https://api.danecounty.gov/api/v1/elections/${path.join('/')}`;

    const res = await fetch(upstream, {
        headers: { 'Accept': 'application/json' },
        cache: 'no-store',
    });

    if (!res.ok) {
        return new Response(`Upstream error: ${res.status} ${res.statusText}`, {
            status: res.status,
        });
    }

    const data = await res.json();
    return Response.json(data);
}
