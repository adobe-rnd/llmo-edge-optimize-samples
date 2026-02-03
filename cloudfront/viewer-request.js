import cf from 'cloudfront';

function handler(event) {
    var request = event.request;
    var headers = request.headers;

    // // delete edge optimize headers
    delete headers['x-edgeoptimize-api-key'];
    delete headers['x-edgeoptimize-url'];
    delete headers['x-edgeoptimize-config'];

    // Define agentic bots
    var AGENTIC_BOTS = ['AdobeEdgeOptimize-AI', 'ChatGPT-User', 'GPTBot', 'OAI-SearchBot', 'PerplexityBot', 'Perplexity-User'];
    var TARGETED_PATHS = ["/", "/page.html"];

    // Extract User-Agent
    var userAgent = headers['user-agent'] ? headers['user-agent'].value.toLowerCase() : '';
    var isEdgeOptimizeRequest = headers['x-edgeoptimize-request'];

    var path = request.uri; // This gives you the path, e.g., "/page.html"
    // Define your regex pattern
    var pattern = /(?:\/[^./]+|\.html|\/)$/;
    // Test if the URI matches the pattern
    var isHtmlPage = pattern.test(path);

    var isTargetedPath = isHtmlPage && TARGETED_PATHS.includes(path);

    // Check if request is from an agentic bot and not already rerouted
    var isAgenticBot = AGENTIC_BOTS.some(function (bot) {
        return userAgent.includes(bot.toLowerCase());
    });

    //
    if (!isEdgeOptimizeRequest && isAgenticBot && isTargetedPath) {
        request.headers['x-edgeoptimize-url'] = { value: request.uri };
        request.headers['x-edgeoptimize-config'] = { value: "LLMCLIENT=true" };

        cf.createRequestOriginGroup({
            "originIds": [
                { "originId": "EdgeOptimize_Origin" },
                { "originId": "Default_Origin" }
            ],
            "failoverCriteria": {
                "statusCodes": [403, 500, 502, 503, 504]
            }
        });

        console.log("Routing to Edge Optimize origin for userAgent: " + userAgent);
        return request;
    }

    console.log("Routing to Default origin for userAgent: " + userAgent);
    return request;
}