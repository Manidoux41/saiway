import http from 'node:http';
http.createServer((request, response) => {
  response.setHeader('Content-Type', 'application/json');
  response.setHeader('Access-Control-Allow-Origin', 'http://127.0.0.1:4370');
  if (request.url.startsWith('/route/v1/')) {
    const coordinates = request.url.split('/')[4].split('?')[0].split(';').map((point) => point.split(',').map(Number));
    response.end(JSON.stringify({ code: 'Ok', routes: [{ distance: 5000, duration: 600, geometry: { type: 'LineString', coordinates } }] }));
  } else {
    response.end(JSON.stringify({ features: [{ type: 'Feature', geometry: { type: 'Point', coordinates: [103.86, 13.37] }, properties: { name: 'Siem Reap hotel', city: 'Siem Reap', country: 'Cambodia', osm_id: 1 } }] }));
  }
}).listen(4369, '127.0.0.1', () => console.log('Fare provider ready'));
