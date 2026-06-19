import React, { createContext, useContext } from 'react';
import { useColorScheme } from 'react-native';
import { COLORS } from './index';

const DEFAULT = { isDark: false, colors: COLORS.light };
const ThemeContext = createContext(DEFAULT);

export const ThemeProvider = ({ children }) => {
  const scheme = useColorScheme();
  const isDark = scheme === 'dark';
  const colors = isDark ? COLORS.dark : COLORS.light;
  return (
    <ThemeContext.Provider value={{ isDark, colors }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => useContext(ThemeContext);
