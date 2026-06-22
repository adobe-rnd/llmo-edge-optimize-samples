/**
 * Lambda@Edge Origin Request: Self-Origin Routing (BYOCDN)
 *
 * For agentic bot requests (detected by viewer-request Lambda), this function:
 * 1. Rewrites the URI to /adobe-edgeoptimize/<original-path>
 * 2. Points the origin back to the SAME CloudFront distribution
 *
 * This causes the request to re-enter CloudFront and match the
 * /adobe-edgeoptimize/* cache behavior, which routes to Edge Optimize.
 *
 * NOTE: This adds one extra CloudFront hop (~60-75ms latency overhead)
 * because the request goes back out to the internet.
 *
 * Attach to: Origin Request event on the DEFAULT cache behavior.
 *
 * IMPORTANT: Update YOUR_CLOUDFRONT_DOMAIN with your CloudFront distribution domain.
 */

const YOUR_CLOUDFRONT_DOMAIN = 'dxxxxxxxxxx.cloudfront.net';

function hasHeader(map, name) {
  const h = map?.[name];
  return Array.isArray(h) && h.length > 0 && (h[0].value || '').trim() !== '';
}

function setHeader(map, name, value) {
  if (map) {
    map[name.toLowerCase()] = [{ key: name, value: String(value) }];
  }
}

export const handler = async (event) => {
  const request = event?.Records?.[0]?.cf?.request;
  const eventType = event.Records[0].cf.config.eventType;
  const reqHeaders = request.headers || {};

  if (eventType === 'origin-request') {
    const isEdgeOptimizeConfig = hasHeader(reqHeaders, 'x-edgeoptimize-config');
    const isEdgeOptimizeRequest = hasHeader(reqHeaders, 'x-edgeoptimize-request');

    if (isEdgeOptimizeConfig && !isEdgeOptimizeRequest) {
      const prefix = '/adobe-edgeoptimize';
      const tempEdgeUrl = reqHeaders['x-edgeoptimize-url']?.[0]?.value;
      let newPath = '';

      if (tempEdgeUrl === '/') {
        newPath = prefix + '/';
      } else {
        newPath = prefix + (tempEdgeUrl.startsWith('/') ? tempEdgeUrl : '/' + tempEdgeUrl);
      }

      request.uri = newPath;

      request.origin = {
        custom: {
          domainName: YOUR_CLOUDFRONT_DOMAIN,
          port: 443,
          protocol: 'https',
          path: '',
          sslProtocols: ['TLSv1.2'],
          readTimeout: 30,
          keepaliveTimeout: 5,
          customHeaders: {}
        }
      };

      setHeader(request.headers, 'host', YOUR_CLOUDFRONT_DOMAIN);
    }

    return request;
  }
};
