function handler(event) {
    var request = event.request;
    var response = event.response;
    var headers = response.headers;

    if (request.headers["x-edgeoptimize-config"] && !response.headers["x-edgeoptimize-request-id"]) {
        headers["x-edgeoptimize-fo"] = { value: '1' };
    }

    return response;
}