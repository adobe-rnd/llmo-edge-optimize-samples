const AGENTIC_BOTS = ['AdobeEdgeOptimize-AI', 'ChatGPT-User', 'GPTBot', 'OAI-SearchBot', 'PerplexityBot', 'Perplexity-User'];

export default {
    async fetch(request, env, ctx) {
        return await handleRequest(request, env);
    },
};


async function handleRequest(request, env) {
    const url = new URL(request.url);
    const userAgent = request.headers.get("user-agent")?.toLowerCase() || "";
    const isEdgeOptimizeRequest = request.headers.get("x-edgeoptimize-request") === "1";
    const pathAndQuery = `${url.pathname}${url.search}`;

    // if request is not from edge-optimize (loop protection) and is an agentic bot, send to edge-optimize origin
    if (!isEdgeOptimizeRequest && AGENTIC_BOTS.some((ua) => userAgent.includes(ua.toLowerCase()))) {
        // Build Prerender request
        const edgeOptimizeURL = `https://live.edgeoptimize.net/${pathAndQuery}`;
        const edgeOptimizeHeaders = new Headers(request.headers);

        // x-forwarded-host should be site domains
        edgeOptimizeHeaders.set("x-forwarded-host", env.EDGE_OPTIMIZE_TARGET_HOST ?? url.host);
        // x-edgeoptimize-api-key should be the key generated for the site domain
        edgeOptimizeHeaders.set("x-edgeoptimize-api-key", env.EDGE_OPTIMIZE_API_KEY);
        // x-edgeoptimize-url should be the original request url
        edgeOptimizeHeaders.set("x-edgeoptimize-url", pathAndQuery);

        edgeOptimizeHeaders.set("x-edgeoptimize-config", "LLMCLIENT=TRUE;");

        return fetch(new Request(edgeOptimizeURL, {
            headers: edgeOptimizeHeaders,
            redirect: "manual",
        }));
    }

    return fetch(request);
}