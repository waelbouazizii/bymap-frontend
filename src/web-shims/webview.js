// Web shim for react-native-webview.
// The native package renders "does not support this platform" on web.
// This shim renders a real <iframe> with full bidirectional message bridging.
import React, { useRef, useEffect, forwardRef, useImperativeHandle } from 'react';
import { View } from 'react-native';

// Injected into the iframe HTML so window.ReactNativeWebView always exists
const RNW_SHIM =
  '<script>window.ReactNativeWebView=window.ReactNativeWebView||' +
  '{postMessage:function(d){window.parent.postMessage(d,"*");}}</script>';

const WebView = forwardRef(function WebView(
  { source, onMessage, style, javaScriptEnabled, domStorageEnabled,
    originWhitelist, mixedContentMode, cacheEnabled, cacheMode,
    setSupportMultipleWindows, onTouchStart, onLoad, onError, ...rest },
  ref
) {
  const iframeRef = useRef(null);

  // Expose injectJavaScript and postMessage on the ref (called by MapScreen)
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

  // Receive messages from the iframe and forward to onMessage
  useEffect(() => {
    const handler = (e) => {
      // Only handle messages from our iframe, not from other page scripts
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

  // Build iframe content
  let srcDoc, src;
  if (source?.html) {
    // Inject bridge shim before any other scripts in <head>
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
        // allow-same-origin lets contentWindow.eval() work for injectJavaScript
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
