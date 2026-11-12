import { z } from 'zod';
import type { Point } from './contracts';

export type RouteMapProps = {
  from?: Point; to?: Point; driver?: Point; history?: Point[]; route?: [number, number][];
  hubs?: (Point & { id: string; name: string })[];
  onPick?: (point: Point) => void;
};
export type MapData = Omit<RouteMapProps, 'onPick'> & {
  picking: boolean;
  labels: { from: string; to: string; driver: string; zoomIn: string; zoomOut: string };
};

const messageSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('ready') }),
  z.object({ type: z.literal('link'), url: z.enum(['https://leafletjs.com', 'https://www.openstreetmap.org/copyright']) }),
  z.object({ type: z.literal('error'), reason: z.enum(['library', 'tiles', 'runtime']) }),
  z.object({
    type: z.literal('pick'),
    latitude: z.number().finite().min(-90).max(90),
    longitude: z.number().finite().min(-180).max(180),
  }),
]);

export function parseMapMessage(value: string) {
  let message: unknown;
  try { message = JSON.parse(value); } catch {
    throw new Error('Invalid Leaflet bridge JSON');
  }
  return messageSchema.parse(message);
}

export function mapUpdateScript(data: MapData) {
  const serialized = JSON.stringify(data).replace(/</g, '\\u003c')
    .replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');
  return `window.saiwayUpdate(${serialized});true;`;
}

export const leafletMapHtml = `<!doctype html>
<html><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline' https://unpkg.com; style-src 'unsafe-inline' https://unpkg.com; img-src data: https://tile.openstreetmap.org; connect-src 'none'; base-uri 'none'; form-action 'none'">
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"
 integrity="sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY=" crossorigin="anonymous"
 onerror="send({type:'error',reason:'library'})">
<style>html,body,#map{height:100%;margin:0;background:#F3F6FC}.leaflet-control-attribution{font-size:10px}</style>
</head><body><div id="map"></div>
<script>
function send(message){window.ReactNativeWebView.postMessage(JSON.stringify(message));}
window.onerror=function(){send({type:'error',reason:'runtime'});};
</script>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"
 integrity="sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo=" crossorigin="anonymous"
 onerror="send({type:'error',reason:'library'})"></script>
<script>
if(window.L){
  var map=L.map('map',{attributionControl:true}).setView([13.36,103.85],13);
  var layer=L.layerGroup().addTo(map);
  var picking=false,lastBounds='';
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{
    maxZoom:19,attribution:'&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>'
  }).on('tileerror',function(){send({type:'error',reason:'tiles'});}).addTo(map);
  function position(point){return [point.latitude,point.longitude];}
  function marker(point,label,color){
    if(!point)return;
    var text=document.createElement('span');text.textContent=label;
    L.circleMarker(position(point),{radius:8,color:'#fff',weight:3,fillColor:color,fillOpacity:1})
      .bindTooltip(text).addTo(layer);
  }
  window.saiwayUpdate=function(data){
    picking=data.picking;layer.clearLayers();
    [['.leaflet-control-zoom-in',data.labels.zoomIn],['.leaflet-control-zoom-out',data.labels.zoomOut]]
      .forEach(function(control){
        var button=document.querySelector(control[0]);
        button.title=control[1];button.setAttribute('aria-label',control[1]);
      });
    marker(data.from,data.labels.from,'#032EA1');
    marker(data.to,data.labels.to,'#E00025');
    marker(data.driver,data.labels.driver,'#287FC1');
    (data.hubs||[]).forEach(function(hub){marker(hub,hub.name,'#DFB56B');});
    var route=(data.route||[]).map(function(point){return [point[1],point[0]];});
    var history=(data.history||[]).map(position);
    if(route.length>1)L.polyline(route,{color:'#032EA1',weight:4}).addTo(layer);
    if(history.length>1)L.polyline(history,{color:'#287FC1',weight:3}).addTo(layer);
    var points=[data.from,data.to].filter(Boolean).map(position);
    if(!points.length&&data.driver)points.push(position(data.driver));
    if(!points.length)points=(data.hubs||[]).map(position);
    if(route.length>1)points=points.concat(route);
    var bounds=JSON.stringify(points);
    if(points.length&&bounds!==lastBounds){
      map.fitBounds(L.latLngBounds(points),{padding:[30,30],maxZoom:16,animate:false});
      lastBounds=bounds;
    }
  };
  map.on('click',function(event){
    if(picking)send({type:'pick',latitude:event.latlng.lat,longitude:event.latlng.lng});
  });
  document.addEventListener('click',function(event){
    var link=event.target.closest('a');
    if(link){
      event.preventDefault();
      if(link.href==='https://leafletjs.com/'||link.href==='https://www.openstreetmap.org/copyright')
        send({type:'link',url:link.href==='https://leafletjs.com/'?'https://leafletjs.com':link.href});
    }
  });
  window.addEventListener('resize',function(){map.invalidateSize();});
  send({type:'ready'});
}
</script></body></html>`;
