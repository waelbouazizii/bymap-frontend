// Web shim for react-native-webview.
// Metro resolves this file instead of the native package on web builds.
// Renders a real <iframe> with full bidirectional postMessage bridging.
import React, { useRef, useEffect, forwardRef, useImperativeHandle } from 'react';
import { View } from 'react-native';

const RNW_SHIM =
  '<script>window.ReactNativeWebView=window.ReactNativeWebView||' +
  '{postMessage:function(d){window.parent.postMessage(d,"*");}}</script>';

const WebView = forwardRef(function WebView(
  { source, onMessage, style,
    javaScriptEnabled, domStorageEnabled, originWhitelist,
    mixedContentMode, cacheEnabled, cacheMode, setSupportMultipleWindows,
    onTouchStart, onLoad, onError, ...rest },
  ref
) {
  const iframeRef = useRef(null);

  useImperativeHandle(ref, () => ({
    injectJavaScript: (code) => {
      try { iframeRef.current?.contentWindow?.eval(code); } catch {}
    },
    postMessage: (data) => {
      try { iframeRef.current?.contentWindow?.postMessage(data, '*'); } catch {}
    },
    stopLoading: () => {},
    reload: () => {
      if (iframeRef.current) iframeRef.current.src = iframeRef.current.src;
    },
  }));

  useEffect(() => {
    const handler = (e) => {
      // Only handle messages from our iframe
      if (iframeRef.current && e.source !== iframeRef.current.contentWindow) return;
      if (!onMessage) return;
      onMessage({
        nativeEvent: {
          data: typeof e.data === 'string' ? e.data : JSON.stringify(e.data),
        },
      });
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, [onMessage]);

  let srcDoc, src;
  if (source?.html) {
    srcDoc = source.html.includes('<head>')
      ? source.html.replace('<head>', '<head>' + RNW_SHIM)
      : RNW_SHIM + source.html;
  } else if (source?.uri) {
    src = source.uri;
  }

  return (
    <View style={[{ flex: 1 }, style]}>
      <iframe
        ref={iframeRef}
        srcDoc={srcDoc}
        src={src}
        sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals"
        style={{ width: '100%', height: '100%', border: 'none', display: 'block' }}
        title="webview"
        onLoad={onLoad ? () => onLoad({ nativeEvent: { url: src || '' } }) : undefined}
      />
    </View>
  );
});

export { WebView };
export default WebView;
