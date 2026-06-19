import React, { createContext, useContext, useState } from 'react';
import { useColorScheme } from 'react-native';
import { COLORS } from './index';

const DEFAULT = { isDark: false, colors: COLORS.light, toggleTheme: () => {} };
const ThemeContext = createContext(DEFAULT);

export const ThemeProvider = ({ children }) => {
  const scheme = useColorScheme();
  const [override, setOverride] = useState(null); // null = follow OS
  const isDark = override !== null ? override : scheme === 'dark';
  const colors = isDark ? COLORS.dark : COLORS.light;
  const toggleTheme = () => setOverride(prev => prev !== null ? !prev : !isDark);
  return (
    <ThemeContext.Provider value={{ isDark, colors, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => useContext(ThemeContext);
