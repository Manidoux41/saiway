import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Linking, View } from 'react-native';
import { WebView } from 'react-native-webview';
import { useLanguage } from '@/providers/language';
import { leafletMapHtml, mapUpdateScript, parseMapMessage, type RouteMapProps } from '@/lib/leaflet-map';
import { Button, colors, Notice } from './native-ui';

export type { RouteMapProps } from '@/lib/leaflet-map';
const source = { html: leafletMapHtml, baseUrl: 'https://leafletjs.com/' };

export default function RouteMap({ onPick, ...props }: RouteMapProps) {
  const { t } = useLanguage();
  const ref = useRef<WebView<object>>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);
  const script = mapUpdateScript({
    ...props, picking: Boolean(onPick),
    labels: {
      from: t('Départ'), to: t('Destination'), driver: t('Chauffeur'),
      zoomIn: t('Agrandir la carte'), zoomOut: t('Réduire la carte'),
    },
  });
  function fail(detail: string) {
    console.error('Leaflet map:', detail);
    setError(t('Carte indisponible. Vérifiez votre connexion et réessayez.'));
  }
  useEffect(() => {
    if (ready) ref.current?.injectJavaScript(script);
  }, [ready, script]);
  useEffect(() => {
    if (ready) return;
    const timeout = setTimeout(() => {
      console.error('Leaflet map: loading timed out');
      setError(t('Carte indisponible. Vérifiez votre connexion et réessayez.'));
    }, 20000);
    return () => clearTimeout(timeout);
  }, [ready, revision, t]);
  return <View style={{ gap: 8 }}>
    <View style={{ borderRadius: 18, overflow: 'hidden', height: 280 }}>
      <WebView<object> key={revision} ref={ref} source={source} style={{ flex: 1 }}
        originWhitelist={['*']} mixedContentMode="never"
        allowFileAccess={false} sharedCookiesEnabled={false} thirdPartyCookiesEnabled={false}
        javaScriptCanOpenWindowsAutomatically={false} setSupportMultipleWindows={false}
        onShouldStartLoadWithRequest={request => request.url === 'about:blank' || request.url === source.baseUrl}
        onError={event => fail(event.nativeEvent.description)}
        onHttpError={event => fail(`HTTP ${event.nativeEvent.statusCode}`)}
        onRenderProcessGone={() => { setReady(false); fail('Android WebView process terminated'); }}
        onContentProcessDidTerminate={() => { setReady(false); fail('iOS WebView process terminated'); }}
        onMessage={event => {
          try {
            const message = parseMapMessage(event.nativeEvent.data);
            if (message.type === 'ready') { setReady(true); ref.current?.injectJavaScript(script); }
            else if (message.type === 'error') fail(message.reason);
            else if (message.type === 'link') void Linking.openURL(message.url).catch(cause => fail(String(cause)));
            else if (onPick) onPick({ latitude: message.latitude, longitude: message.longitude });
          } catch (cause) { fail(cause instanceof Error ? cause.message : String(cause)); }
        }} />
      {!ready && !error && <ActivityIndicator style={{ position: 'absolute', alignSelf: 'center', top: 125 }} color={colors.primary} />}
    </View>
    <Notice error={error ?? undefined} />
    {error && <Button secondary title={t('Réessayer')} onPress={() => {
      setError(null); setReady(false); setRevision(value => value + 1);
    }} />}
  </View>;
}
