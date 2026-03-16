import { StyleSheet } from 'react-native';

export const colors = {
  bg: '#F4EFE6',
  panel: '#FFF9F0',
  ink: '#1E293B',
  primary: '#0E7490',
  warn: '#C2410C',
  danger: '#B91C1C',
  ok: '#166534',
  border: '#D6C9B8',
};

export const appStyles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.bg,
    padding: 16,
  },
  card: {
    backgroundColor: colors.panel,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 12,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.ink,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.ink,
    marginBottom: 8,
  },
  body: {
    fontSize: 16,
    color: colors.ink,
    lineHeight: 22,
  },
  button: {
    borderRadius: 14,
    backgroundColor: colors.primary,
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: 'center',
    marginVertical: 6,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  disclaimer: {
    marginTop: 'auto',
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    fontSize: 13,
    color: colors.warn,
  },
});
