/**
 * Lambda@Edge Viewer Request: Edge Optimize Bot Detection
 *
 * Detects agentic bots and sets x-edgeoptimize-* headers so that
 * the origin-request Lambda can route them to Edge Optimize.
 *
 * Attach to: Viewer Request event on the DEFAULT cache behavior.
 */
const AGENTIC_BOTS = [
  'AdobeEdgeOptimize-AI',
  'ChatGPT-User',
  'GPTBot',
  'OAI-SearchBot',
  'PerplexityBot',
  'Perplexity-User'
];

export const handler = async (event) => {
  const request = event.Records[0].cf.request;
  const headers = request.headers || {};
  const TARGETED_PATHS = null;

  delete headers['x-edgeoptimize-api-key'];
  delete headers['x-edgeoptimize-url'];
  delete headers['x-edgeoptimize-config'];

  const userAgent = (headers['user-agent'] && headers['user-agent'][0] && headers['user-agent'][0].value)
    ? headers['user-agent'][0].value.toLowerCase()
    : '';

  const isEdgeOptimizeRequest = !!headers['x-edgeoptimize-request'];
  const path = request.uri || '/';
  const htmlPattern = /(?:\/[^./]+|\.html|\/)$/;
  const isHtmlPage = htmlPattern.test(path);

  const isTargetedPath = (TARGETED_PATHS === null)
    ? isHtmlPage
    : (isHtmlPage && TARGETED_PATHS.includes(path));

  const isAgenticBot = AGENTIC_BOTS.some(bot => {
    try {
      return userAgent.includes(bot.toLowerCase());
    } catch (e) {
      return false;
    }
  });

  if (!isEdgeOptimizeRequest && isAgenticBot && isTargetedPath) {
    request.headers['x-edgeoptimize-url'] = [{ key: 'x-edgeoptimize-url', value: request.uri }];
    request.headers['x-edgeoptimize-config'] = [{ key: 'x-edgeoptimize-config', value: 'LLMCLIENT=true' }];
  }

  return request;
};
