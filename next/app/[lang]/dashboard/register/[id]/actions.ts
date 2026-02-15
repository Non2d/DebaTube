'use server';

export async function testColabConnection(url: string) {
    if (!url) {
        return { success: false, message: 'URL is required' };
    }

    try {
        const testUrl = url.endsWith('/') ? `${url}health` : `${url}/health`;

        const res = await fetch(testUrl, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
            },
            next: { revalidate: 0 }
        });

        if (res.ok) {
            const data = await res.json().catch(() => ({}));
            return { success: true, message: 'Connection successful', status: res.status, data };
        } else {
            return { success: false, message: `Connection failed: ${res.status} ${res.statusText}`, status: res.status };
        }
    } catch (error: any) {
        console.error('Colab connection error:', error);
        return { success: false, message: `Network error: ${error.message}` };
    }
}
