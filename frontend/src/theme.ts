import { Platform, type ViewStyle } from 'react-native';

export const colors = {
  primary: '#2563EB',
  primaryHover: '#1D4ED8',
  secondary: '#3B82F6',
  secondaryHover: '#1D4ED8',
  accent: '#8B5CF6',
  base: '#F3F5F9',
  surface: '#FFFFFF',
  surfaceElevated: '#F8FAFC',
  chatAi: '#F8FAFC',
  textMain: '#0F172A',
  textMuted: '#64748B',
  textInverse: '#FFFFFF',
  borderLight: '#E5E7EB',
  borderMedium: '#D1D5DB',
  success: '#10B981',
  warning: '#F59E0B',
  error: '#EF4444',
  info: '#3B82F6',
};

export const radius = { sm: 12, md: 16, lg: 24, xl: 32, pill: 9999 };
export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24, xxxl: 32 };

type NativeShadow = {
  color: string;
  offset: { width: number; height: number };
  opacity: number;
  radius: number;
  elevation: number;
};

const shadow = (webBoxShadow: string, native: NativeShadow): ViewStyle => {
  if (Platform.OS === 'web') {
    return { boxShadow: webBoxShadow } as ViewStyle;
  }

  return {
    shadowColor: native.color,
    shadowOffset: native.offset,
    shadowOpacity: native.opacity,
    shadowRadius: native.radius,
    elevation: native.elevation,
  };
};

export const shadows = {
  card: shadow('0 10px 20px rgba(160, 174, 192, 0.10)', {
    color: '#A0AEC0',
    offset: { width: 0, height: 10 },
    opacity: 0.1,
    radius: 20,
    elevation: 3,
  }),
  floating: shadow('0 12px 24px rgba(160, 174, 192, 0.15)', {
    color: '#A0AEC0',
    offset: { width: 0, height: 12 },
    opacity: 0.15,
    radius: 24,
    elevation: 6,
  }),
  tabBar: shadow('0 10px 20px rgba(160, 174, 192, 0.20)', {
    color: '#A0AEC0',
    offset: { width: 0, height: 10 },
    opacity: 0.2,
    radius: 20,
    elevation: 10,
  }),
  inputBar: shadow('0 -8px 18px rgba(37, 99, 235, 0.15)', {
    color: '#2563EB',
    offset: { width: 0, height: 8 },
    opacity: 0.15,
    radius: 18,
    elevation: 8,
  }),
};

export const fontWeights = {
  regular: '400' as const,
  medium: '500' as const,
  semibold: '600' as const,
  bold: '700' as const,
  extrabold: '800' as const,
};
