import cf from 'cloudfront';
 
/**
 * CloudFront Viewer Request Function: Edge Optimize Routing
 *
 * This function intercepts incoming viewer requests and determines
 * whether they originate from agentic bots (e.g., ChatGPT, GPTBot).
 * If so, it routes the request to the Edge Optimize origin with
 * automatic failover to the default origin.
 *
 * Non-agentic (regular user) requests pass through unchanged.
 */
function handler(event) {
    var request = event.request;
    var headers = request.headers;
 
    // ---------------------------------------------------------------
    // Security: Strip any Edge Optimize headers that may have been
    // injected by the client. These headers should only be set by
    // this function or the origin, never by the end user.
    // ---------------------------------------------------------------
    delete headers['x-edgeoptimize-api-key'];
    delete headers['x-edgeoptimize-url'];
    delete headers['x-edgeoptimize-config'];
 
    // ---------------------------------------------------------------
    // Configuration: Define which bots are considered "agentic"
    // and which paths should be routed to Edge Optimize.
    //
    // AGENTIC_BOTS: List of known AI bot user-agent strings.
    //   Add or remove entries as needed.
    //
    // TARGETED_PATHS: Controls which paths are eligible for routing.
    //   - Set to `null` to target ALL HTML pages.
    //   - Set to an array of specific paths to limit routing,
    //     e.g., ['/', '/products', '/about']
    // ---------------------------------------------------------------
    var AGENTIC_BOTS = ['AdobeEdgeOptimize-AI', 'ChatGPT-User', 'GPTBot', 'OAI-SearchBot', 'PerplexityBot', 'Perplexity-User'];
    var TARGETED_PATHS = null;

    // ---------------------------------------------------------------
    // Multi-domain (optional): when one distribution serves several
    // domains, map each onboarded host to its Edge Optimize API key.
    //   - Leave as null for a single domain (the API key is supplied as
    //     a hardcoded origin custom header on EdgeOptimize_Origin).
    //   - Otherwise: { 'www.domain-a.com': 'key-a', 'www.domain-b.com': 'key-b' }
    // ---------------------------------------------------------------
    var API_KEYS_BY_HOST = null;
 
    // ---------------------------------------------------------------
    // Extract the User-Agent header (lowercase for case-insensitive matching)
    // ---------------------------------------------------------------
    var userAgent = headers['user-agent'] ? headers['user-agent'].value.toLowerCase() : '';
 
    // Check if this request was already processed by Edge Optimize
    // (prevents re-routing on sub-requests or redirects)
    var isEdgeOptimizeRequest = headers['x-edgeoptimize-request'];
 
    // ---------------------------------------------------------------
    // Path matching: Only route requests for HTML pages.
    // This regex matches URLs ending in:
    //   - `/`           (directory index)
    //   - `.html`       (explicit HTML files)
    //   - `/some-path`  (extensionless paths, assumed to be pages)
    // It excludes static assets like .css, .js, .png, .jpg, etc.
    // ---------------------------------------------------------------
    var path = request.uri;
    var pattern = /(?:\/[^./]+|\.html|\/)$/;
    var isHtmlPage = pattern.test(path);
 
    // If TARGETED_PATHS is null, all HTML pages are targeted.
    // Otherwise, only pages whose path is in the array are targeted.
    var isTargetedPath = TARGETED_PATHS === null
        ? isHtmlPage
        : isHtmlPage && TARGETED_PATHS.includes(path);
 
    // ---------------------------------------------------------------
    // Bot detection: Check if the User-Agent matches any known
    // agentic bot (case-insensitive comparison)
    // ---------------------------------------------------------------
    var isAgenticBot = AGENTIC_BOTS.some(function(bot) {
        return userAgent.includes(bot.toLowerCase());
    });
 
    // ---------------------------------------------------------------
    // Routing decision:
    // If the request is from an agentic bot, targets an HTML page,
    // and has not already been processed by Edge Optimize, then:
    //   1. Set x-edgeoptimize-url header with the original request URI
    //   2. Set x-edgeoptimize-config header to enable LLM client mode
    //   3. Create an origin group that tries Edge Optimize first,
    //      with automatic failover to the default origin on errors
    // ---------------------------------------------------------------
    if (!isEdgeOptimizeRequest && isAgenticBot && isTargetedPath) {
        // Pass the original URI to Edge Optimize so it knows which page to optimize
        request.headers['x-edgeoptimize-url'] = { value: request.uri };
 
        // Enable LLM client optimization mode
        request.headers['x-edgeoptimize-config'] = { value: "LLMCLIENT=TRUE;" };
 
        // Multi-domain: identify the original domain from the Host header so a
        // single CloudFront distribution can serve several domains. For this to
        // take effect, remove any hardcoded x-forwarded-host origin custom header
        // on EdgeOptimize_Origin and include x-forwarded-host in the cache key.
        if (headers['host'] && headers['host'].value) {
            request.headers['x-forwarded-host'] = { value: headers['host'].value };
        }

        // Multi-domain: when API_KEYS_BY_HOST is configured, send this host's key.
        // Otherwise the API key is supplied as an origin custom header.
        if (API_KEYS_BY_HOST && headers['host'] && headers['host'].value) {
            var hostApiKey = API_KEYS_BY_HOST[headers['host'].value];
            if (hostApiKey) {
                request.headers['x-edgeoptimize-api-key'] = { value: hostApiKey };
            }
        }

        console.log("Adding origin group for userAgent: " + userAgent);
 
        // Create an origin group: try EdgeOptimize_Origin first,
        // fall back to YOUR_DEFAULT_ORIGIN if Edge Optimize returns
        // any of the listed error status codes.
        cf.createRequestOriginGroup({
            "originIds": [
                { "originId": "EdgeOptimize_Origin" },
                { "originId": "YOUR_DEFAULT_ORIGIN" }
            ],
            "failoverCriteria": {
                "statusCodes": [400, 403, 404, 416, 500, 502, 503, 504]
            }
        });
 
        console.log("Routing to Edge Optimize origin for userAgent: " + userAgent);
        return request;
    }
 
    // ---------------------------------------------------------------
    // Default: Non-agentic requests (or non-targeted paths) pass
    // through to the default origin with no modifications.
    // ---------------------------------------------------------------
    console.log("Routing to Default origin for userAgent: " + userAgent);
    return request;
}
