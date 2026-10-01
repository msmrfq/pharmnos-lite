import { prisma } from "@/lib/db/prisma";

const noStoreHeaders = { "Cache-Control": "no-store" };

function unavailable(status: 401 | 503): Response {
    return Response.json({ database: "unavailable" }, {
        status,
        headers: noStoreHeaders,
    });
}

export async function GET(request: Request): Promise<Response> {
    const expectedToken = process.env.DB_HEALTHCHECK_TOKEN;
    const providedToken = request.headers.get("x-db-healthcheck-token");

    if (!expectedToken || providedToken !== expectedToken) {
        return unavailable(401);
    }

    try {
        await prisma.$queryRaw`SELECT 1`;
        return Response.json({ database: "ok" }, {
            status: 200,
            headers: noStoreHeaders,
        });
    } catch {
        return unavailable(503);
    }
}
