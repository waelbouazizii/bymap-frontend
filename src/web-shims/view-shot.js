// Web shim for react-native-view-shot.
// ViewShot captures native view screenshots — not possible in a browser.
// On web: the component renders its children normally; capture functions resolve
// with an empty string so call sites that do `if (uri) ...` fail gracefully.
import React from 'react';
import { View } from 'react-native';

const ViewShot = React.forwardRef(function ViewShot({ children, style, ...rest }, _ref) {
  return <View style={style} {...rest}>{children}</View>;
});

export default ViewShot;
export const captureRef    = () => Promise.resolve('');
export const captureScreen = () => Promise.resolve('');
