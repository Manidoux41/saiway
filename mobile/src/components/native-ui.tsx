import type { PropsWithChildren } from 'react';
import { ActivityIndicator, Alert, KeyboardAvoidingView, Platform, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AngkorBackground, BrandLogo } from './brand';

export const colors = {
  primary: '#032EA1', dark: '#021F73', gold: '#DFB56B', background: '#F3F6FC',
  surface: 'rgba(255,255,255,0.88)', text: '#101B3D', muted: '#52617F', border: 'rgba(3,46,161,0.14)',
  danger: '#C7463A', soft: '#E6ECFA', accent: '#E00025',
};
export const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.background },
  content: { padding: 20, gap: 18, paddingBottom: 40, width: '100%', maxWidth: 720, alignSelf: 'center' },
  card: { backgroundColor: colors.surface, borderRadius: 22, padding: 20, gap: 12, borderWidth: 1, borderColor: colors.border },
  hero: { backgroundColor: 'rgba(2,31,115,0.90)', borderColor: colors.dark, borderTopColor: colors.accent, borderTopWidth: 4 },
  title: { fontSize: 28, fontWeight: '800', color: colors.text },
  heading: { fontSize: 19, fontWeight: '700', color: colors.text },
  text: { fontSize: 16, color: colors.text, lineHeight: 24 },
  muted: { fontSize: 14, color: colors.muted, lineHeight: 21 },
  eyebrow: { fontSize: 12, fontWeight: '800', letterSpacing: 2, color: colors.primary },
  row: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 10 },
  input: { borderWidth: 1, borderColor: colors.border, borderRadius: 13, padding: 14, minHeight: 50, color: colors.text, fontSize: 16, backgroundColor: 'rgba(247,249,255,0.92)' },
  label: { fontSize: 14, fontWeight: '600', color: colors.text },
  button: { minHeight: 50, paddingHorizontal: 18, paddingVertical: 13, borderRadius: 14, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  buttonText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700', textAlign: 'center' },
  secondary: { backgroundColor: colors.soft },
  secondaryText: { color: colors.dark },
  badge: { borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6, backgroundColor: colors.soft, alignSelf: 'flex-start' },
  error: { borderRadius: 14, padding: 14, backgroundColor: '#FDEAEA', color: colors.danger, lineHeight: 22 },
  success: { borderRadius: 14, padding: 14, backgroundColor: '#E8F4EE', color: '#075E45', lineHeight: 22 },
  price: { fontSize: 30, color: colors.primary, fontWeight: '800' },
});

export function Page({ title, subtitle, children, refreshing, onRefresh }: PropsWithChildren<{
  title: string; subtitle?: string; refreshing?: boolean; onRefresh?: () => void;
}>) {
  return <View style={styles.page}><AngkorBackground /><SafeAreaView style={{ flex: 1 }} edges={['top', 'left', 'right']}>
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled"
        refreshControl={onRefresh ? <RefreshControl refreshing={Boolean(refreshing)} onRefresh={onRefresh} tintColor={colors.primary} /> : undefined}>
        <View style={{ gap: 6 }}>
          <BrandLogo />
          <Text style={styles.eyebrow}>SAIWAY / SIEM REAP</Text>
          <Text accessibilityRole="header" style={styles.title}>{title}</Text>
          {subtitle && <Text style={styles.muted}>{subtitle}</Text>}
        </View>
        {children}
      </ScrollView>
    </KeyboardAvoidingView>
  </SafeAreaView></View>;
}

export function Card({ children, hero = false }: PropsWithChildren<{ hero?: boolean }>) {
  return <View style={[styles.card, hero && styles.hero]}>{children}</View>;
}
export function Button({ title, onPress, disabled = false, secondary = false, danger = false }: {
  title: string; onPress: () => void; disabled?: boolean; secondary?: boolean; danger?: boolean;
}) {
  return <Pressable accessibilityRole="button" accessibilityState={{ disabled }} disabled={disabled} onPress={onPress}
    style={({ pressed }) => [styles.button, secondary && styles.secondary, danger && { backgroundColor: colors.danger }, { opacity: disabled ? 0.45 : pressed ? 0.75 : 1 }]}>
    <Text style={[styles.buttonText, secondary && styles.secondaryText]}>{title}</Text>
  </Pressable>;
}
export function Field({ label, ...props }: TextInputProps & { label: string }) {
  return <View style={{ gap: 7 }}><Text style={styles.label}>{label}</Text>
    <TextInput accessibilityLabel={label} placeholderTextColor={colors.muted} style={styles.input} {...props} />
  </View>;
}
export function Choices<T extends string>({ value, options, onChange, disabled }: {
  value: T; options: { value: T; label: string }[]; onChange: (value: T) => void; disabled?: boolean;
}) {
  return <View style={styles.row}>{options.map(option => <Pressable key={option.value} accessibilityRole="radio"
    accessibilityState={{ checked: value === option.value, disabled }} disabled={disabled} onPress={() => onChange(option.value)}
    style={[styles.badge, { paddingVertical: 12, backgroundColor: value === option.value ? colors.primary : colors.soft }]}>
    <Text style={{ color: value === option.value ? '#FFFFFF' : colors.dark, fontWeight: '600' }}>{option.label}</Text>
  </Pressable>)}</View>;
}
export function Notice({ error, message }: { error?: string; message?: string }) {
  return <>{error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
    {message ? <Text accessibilityLiveRegion="polite" style={styles.success}>{message}</Text> : null}</>;
}
export function Loading() { return <ActivityIndicator size="large" color={colors.primary} accessibilityLabel="Chargement" />; }
export function confirm(title: string, message: string) {
  return new Promise<boolean>(resolve => Alert.alert(title, message, [
    { text: 'Annuler', style: 'cancel', onPress: () => resolve(false) },
    { text: 'Confirmer', onPress: () => resolve(true) },
  ], { cancelable: true, onDismiss: () => resolve(false) }));
}
export function money(cents: number, currency = 'USD') {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency }).format(cents / 100);
}
export function dateTime(value: string) {
  return new Intl.DateTimeFormat('fr-FR', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Phnom_Penh' }).format(new Date(value));
}
export const statusLabels: Record<string, string> = {
  PENDING_PAYMENT: 'Demande reçue', CONFIRMED: 'Confirmée', DRIVER_ASSIGNMENT_PENDING: 'Recherche chauffeur',
  DRIVER_ASSIGNED: 'Chauffeur assigné', DRIVER_ACCEPTED: 'Acceptée', DRIVER_EN_ROUTE: 'Chauffeur en route',
  DRIVER_ARRIVED: 'Chauffeur arrivé', TRIP_STARTED: 'En cours', TRIP_COMPLETED: 'Terminée',
  CANCELLED: 'Annulée', NO_SHOW: 'Absent', REFUNDED: 'Remboursée',
};
