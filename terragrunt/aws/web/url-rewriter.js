/*
 * Cloudfront function to rewrite URLs for SPA routing.
 */

var fileRegex = /^\/.+(\.\w+$)/; // matches paths requesting a file. e.g.: /route1/my-font.woff2

function handler(event) {
  var request = event.request;

  if (!fileRegex.test(request.uri)) {
    request.uri = '/index.html';
  }

  return request;
}
