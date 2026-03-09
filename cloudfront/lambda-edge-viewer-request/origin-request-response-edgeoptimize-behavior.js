/**
 * Lambda@Edge handler for Origin Request and Origin Response events.
 *
 * This single function handles two CloudFront event types on the
 * /adobe-edgeoptimize/* cache behavior:
 *
 * 1. ORIGIN REQUEST (before CloudFront contacts the origin):
 *    - Strips the /adobe-edgeoptimize prefix from the URI
 *    - If the request is going to Edge Optimize origin, sets the host header
 *    - If failover occurred, marks the request with x-edgeoptimize-request: fo
 *
 * 2. ORIGIN RESPONSE (after receiving a response from the origin):
 *    - If Edge Optimize did not process the request (failover), sets
 *      cache-control: no-store to prevent caching the failover response
 *
 * Attach to: Origin Request AND Origin Response events on the
 * /adobe-edgeoptimize/* cache behavior.
 *
 * IMPORTANT: Update EDGE_OPTIMIZE_ORIGIN with your Edge Optimize domain.
 */

const EDGE_OPTIMIZE_ORIGIN = 'live.edgeoptimize.net';

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
  const response = event?.Records?.[0]?.cf?.response;
  const eventType = event.Records[0].cf.config.eventType;
  const reqHeaders = request.headers || {};

  if (eventType === 'origin-request') {
    const originDomain = request.origin?.custom?.domainName;
    const isEdgeOptimizeConfig = hasHeader(reqHeaders, 'x-edgeoptimize-config');
    const isEdgeOptimizeRequest = hasHeader(reqHeaders, 'x-edgeoptimize-request');

    if (isEdgeOptimizeConfig && !isEdgeOptimizeRequest) {
      const prefix = '/adobe-edgeoptimize';
      let uri = request.uri || '/';

      if (uri.startsWith(prefix)) {
        uri = uri.replace(prefix, '') || '/';
        request.uri = uri;
      }

      if (originDomain === EDGE_OPTIMIZE_ORIGIN) {
        setHeader(request.headers, 'host', originDomain);
      } else {
        setHeader(request.headers, 'x-edgeoptimize-request', 'fo');
      }
    }

    return request;

  } else if (eventType === 'origin-response') {
    const resHeaders = response.headers || {};
    const isEdgeOptimizeConfig = hasHeader(reqHeaders, 'x-edgeoptimize-config');
    const isEdgeOptimizeRequestId = hasHeader(resHeaders, 'x-edgeoptimize-request-id');

    if (isEdgeOptimizeConfig && !isEdgeOptimizeRequestId) {
      setHeader(response.headers, 'x-edgeoptimize-fo', '1');
      setHeader(response.headers, 'cache-control', 'no-store');
    }

    return response;
  }
};
