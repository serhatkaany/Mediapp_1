import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Switch, Alert, TextInput,
  KeyboardAvoidingView, Platform, ActivityIndicator, Image, TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import {
  User, LogOut, Globe, Lock, Bell, Trash2, ChevronRight,
  Camera, Heart, Calendar, Activity, Info
} from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import { useAuth } from '../../src/AuthContext';
import { api } from '../../src/api';
import { colors, radius, spacing, shadows } from '../../src/theme';
import { t } from '../../src/i18n';
import AnimatedPressable from '../../src/components/AnimatedPressable';
import { hapticSuccess, hapticError, hapticLight } from '../../src/haptics';
import { cancelAllMedicationReminders, setupNotifications } from '../../src/services/notifications';

export default function ProfileScreen() {
  const { user, logout, language, setLanguage, setUser } = useAuth();
  const L = t(language);
  const router = useRouter();

  // Core editing state
  const [editing, setEditing] = useState(false);
  const [pwModal, setPwModal] = useState(false);
  const [oldPw, setOldPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [busy, setBusy] = useState(false);

  // Profile fields state
  const [name, setName] = useState('');
  const [surname, setSurname] = useState('');
  const [phone, setPhone] = useState('');
  const [bio, setBio] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [gender, setGender] = useState('');
  const [bloodType, setBloodType] = useState('');
  const [height, setHeight] = useState('');
  const [weight, setWeight] = useState('');
  const [profileImage, setProfileImage] = useState('');
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);

  // Sync user details to local state
  useEffect(() => {
    if (user) {
      setName(user.name || '');
      setSurname(user.surname || '');
      setPhone(user.phone_number || '');
      setBio(user.bio || '');
      setBirthDate(user.birth_date || user.date_of_birth || '');
      setGender(user.gender || '');
      setBloodType(user.blood_type || '');
      setHeight(user.height ? String(user.height) : '');
      setWeight(user.weight ? String(user.weight) : '');
      setProfileImage(user.profile_image || '');
      setNotificationsEnabled(user.notifications_enabled ?? true);
    }
  }, [user]);

  const onLogout = () => {
    Alert.alert(L.logout, L.confirmLogout, [
      { text: L.cancel, style: 'cancel' },
      { text: L.yes, style: 'destructive', onPress: async () => { await logout(); router.replace('/(auth)/login'); } }
    ]);
  };

  const onDelete = () => {
    Alert.alert(L.deleteAccount, L.confirmDelete, [
      { text: L.cancel, style: 'cancel' },
      {
        text: L.delete, style: 'destructive', onPress: async () => {
          try {
            await api.delete('/auth/account');
            await logout();
            router.replace('/(auth)/login');
          } catch (e: any) { Alert.alert(L.error, e?.response?.data?.detail || 'Failed'); }
        }
      }
    ]);
  };

  const saveProfile = async () => {
    setBusy(true);
    try {
      const r = await api.put('/profile', {
        name,
        surname,
        phone_number: phone,
        language,
        bio,
        birth_date: birthDate,
        date_of_birth: birthDate,
        gender,
        blood_type: bloodType,
        height: height ? parseFloat(height) : null,
        weight: weight ? parseFloat(weight) : null,
        profile_image: profileImage,
      });
      setUser(r.data);
      setEditing(false);
      hapticSuccess();
      Alert.alert(L.success, '');
    } catch (e: any) {
      hapticError();
      Alert.alert(L.error, e?.response?.data?.detail || 'Failed');
    } finally { setBusy(false); }
  };

  const handlePickImage = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert(L.error, language === 'tr' ? 'Galeri izni gerekli.' : 'Gallery permission required.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.4,
      base64: true,
    });

    if (!result.canceled && result.assets[0]) {
      const base64Img = `data:image/jpeg;base64,${result.assets[0].base64}`;
      setProfileImage(base64Img);

      // If not in edit mode, upload photo immediately
      if (!editing) {
        setBusy(true);
        try {
          const r = await api.put('/profile', { profile_image: base64Img });
          setUser(r.data);
          hapticSuccess();
          Alert.alert(L.success, L.uploadSuccess);
        } catch (e: any) {
          hapticError();
          Alert.alert(L.error, e?.response?.data?.detail || 'Failed');
        } finally {
          setBusy(false);
        }
      }
    }
  };

  const changePw = async () => {
    if (!oldPw || newPw.length < 6) {
      Alert.alert(L.error, language === 'tr' ? 'Geçerli alanlar girin' : 'Enter valid fields'); return;
    }
    setBusy(true);
    try {
      await api.post('/auth/change-password', { old_password: oldPw, new_password: newPw });
      Alert.alert(L.success, '');
      setPwModal(false); setOldPw(''); setNewPw('');
    } catch (e: any) {
      Alert.alert(L.error, e?.response?.data?.detail || 'Failed');
    } finally { setBusy(false); }
  };

  const switchLang = async (l: 'tr' | 'en') => {
    setLanguage(l);
    if (user) {
      try { await api.put('/profile', { language: l }); } catch {}
    }
  };

  const toggleNotifications = async (enabled: boolean) => {
    const previous = notificationsEnabled;
    setNotificationsEnabled(enabled);
    setBusy(true);
    try {
      let nextEnabled = enabled;
      if (enabled) {
        const permission = await setupNotifications();
        nextEnabled = permission.granted;
        if (!permission.granted) {
          Alert.alert(
            L.error,
            language === 'tr'
              ? 'Bildirim izni verilmedi. Ayarlardan izin verdikten sonra tekrar deneyin.'
              : 'Notification permission was not granted. Enable it in settings and try again.'
          );
        }
      } else {
        await cancelAllMedicationReminders();
      }

      const r = await api.put('/profile', { notifications_enabled: nextEnabled });
      setUser(r.data);
      setNotificationsEnabled(r.data.notifications_enabled ?? nextEnabled);
      hapticSuccess();
    } catch (e: any) {
      setNotificationsEnabled(previous);
      hapticError();
      Alert.alert(L.error, e?.response?.data?.detail || 'Failed');
    } finally {
      setBusy(false);
    }
  };

  const formatGender = (val: string) => {
    if (!val) return '-';
    if (val === 'male') return L.genderMale;
    if (val === 'female') return L.genderFemale;
    return L.genderOther;
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          
          {/* Avatar / Header display */}
          <View style={styles.headerCard}>
            <TouchableOpacity onPress={handlePickImage} activeOpacity={0.85} style={styles.avatarWrapper}>
              {profileImage ? (
                <Image source={{ uri: profileImage }} style={styles.avatarImage} />
              ) : (
                <View style={styles.avatarFallback}>
                  <Text style={styles.avatarText}>
                    {(name || 'U')[0]}{(surname || '')[0]}
                  </Text>
                </View>
              )}
              <View style={styles.cameraOverlay}>
                <Camera size={14} color="#fff" />
              </View>
            </TouchableOpacity>
            
            <Text testID="profile-name" style={styles.profileName}>{name} {surname}</Text>
            <Text style={styles.profileEmail}>{user?.email}</Text>
            {bio ? <Text style={styles.profileBio}>"{bio}"</Text> : null}
          </View>

          {editing ? (
            // Edit Mode Form
            <View style={styles.cardContainer}>
              <Text style={styles.cardTitle}>
                <User size={18} color={colors.primary} /> {L.personalInfo}
              </Text>
              
              <Text style={styles.label}>{L.name}</Text>
              <TextInput testID="edit-name" style={styles.input} value={name} onChangeText={setName} />
              
              <Text style={styles.label}>{L.surname}</Text>
              <TextInput testID="edit-surname" style={styles.input} value={surname} onChangeText={setSurname} />
              
              <Text style={styles.label}>{L.phone}</Text>
              <TextInput testID="edit-phone" style={styles.input} value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
              
              <Text style={styles.label}>{L.birthDate} (YYYY-MM-DD)</Text>
              <TextInput testID="edit-birth-date" style={styles.input} value={birthDate} onChangeText={setBirthDate} placeholder="1990-01-01" placeholderTextColor={colors.textMuted} />
              
              <Text style={styles.label}>{L.bio}</Text>
              <TextInput 
                testID="edit-bio" 
                style={[styles.input, { minHeight: 60, textAlignVertical: 'top' }]} 
                value={bio} 
                onChangeText={setBio} 
                multiline 
                placeholder={language === 'tr' ? 'Kendinizden bahsedin...' : 'Tell us about yourself...'}
                placeholderTextColor={colors.textMuted}
              />

              <Text style={styles.label}>{L.gender}</Text>
              <View style={styles.selectorRow}>
                {['male', 'female', 'other'].map((g) => (
                  <TouchableOpacity
                    key={g}
                    testID={`gender-${g}`}
                    style={[styles.selectorButton, gender === g && styles.selectorButtonActive]}
                    onPress={() => { setGender(g); hapticLight(); }}
                  >
                    <Text style={[styles.selectorButtonText, gender === g && styles.selectorButtonTextActive]}>
                      {g === 'male' ? L.genderMale : g === 'female' ? L.genderFemale : L.genderOther}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <View style={[styles.cardDivider, { marginVertical: spacing.lg }]} />

              <Text style={styles.cardTitle}>
                <Activity size={18} color={colors.secondary} /> {L.healthInfo}
              </Text>

              <Text style={styles.label}>{L.bloodType}</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.pillsScroll}>
                {['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', '0+', '0-'].map((b) => (
                  <TouchableOpacity
                    key={b}
                    testID={`blood-${b}`}
                    style={[styles.pill, bloodType === b && styles.pillActive]}
                    onPress={() => { setBloodType(b); hapticLight(); }}
                  >
                    <Text style={[styles.pillText, bloodType === b && styles.pillTextActive]}>{b}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              <View style={styles.rowInputs}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.label}>{L.height}</Text>
                  <TextInput testID="edit-height" style={styles.input} value={height} onChangeText={setHeight} keyboardType="numeric" placeholder="175" placeholderTextColor={colors.textMuted} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.label}>{L.weight}</Text>
                  <TextInput testID="edit-weight" style={styles.input} value={weight} onChangeText={setWeight} keyboardType="numeric" placeholder="70" placeholderTextColor={colors.textMuted} />
                </View>
              </View>

              <View style={styles.actionButtons}>
                <AnimatedPressable style={styles.cancelBtn} onPress={() => setEditing(false)}>
                  <Text style={styles.cancelText}>{L.cancel}</Text>
                </AnimatedPressable>
                <AnimatedPressable testID="save-profile" style={styles.saveBtn} onPress={saveProfile} disabled={busy}>
                  {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveText}>{L.save}</Text>}
                </AnimatedPressable>
              </View>
            </View>
          ) : (
            // View Mode display (Cards)
            <View>
              {/* Personal Info Card */}
              <View style={styles.infoCard}>
                <Text style={styles.cardTitle}>
                  <User size={18} color={colors.primary} /> {L.personalInfo}
                </Text>
                
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>{L.name} {L.surname}</Text>
                  <Text style={styles.infoVal}>{name} {surname}</Text>
                </View>
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>{L.phone}</Text>
                  <Text style={styles.infoVal}>{phone || '-'}</Text>
                </View>
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>{L.birthDate}</Text>
                  <Text style={styles.infoVal}>{birthDate || '-'}</Text>
                </View>
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>{L.gender}</Text>
                  <Text style={styles.infoVal}>{formatGender(gender)}</Text>
                </View>
              </View>

              {/* Health Info Card */}
              <View style={styles.infoCard}>
                <Text style={styles.cardTitle}>
                  <Heart size={18} color={colors.secondary} /> {L.healthInfo}
                </Text>
                
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>{L.bloodType}</Text>
                  <Text style={[styles.infoVal, bloodType && styles.bloodTypeBadge]}>{bloodType || '-'}</Text>
                </View>
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>{L.height}</Text>
                  <Text style={styles.infoVal}>{height ? `${height} cm` : '-'}</Text>
                </View>
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>{L.weight}</Text>
                  <Text style={styles.infoVal}>{weight ? `${weight} kg` : '-'}</Text>
                </View>
              </View>

              {/* Edit button */}
              <AnimatedPressable testID="row-edit-profile" style={styles.editButton} onPress={() => setEditing(true)}>
                <Text style={styles.editButtonText}>{L.editProfile}</Text>
              </AnimatedPressable>
            </View>
          )}

          {/* Change Password Area */}
          {pwModal ? (
            <View style={styles.infoCard}>
              <Text style={styles.cardTitle}><Lock size={18} color={colors.warning} /> {L.changePassword}</Text>
              <Text style={styles.label}>{L.oldPassword}</Text>
              <TextInput testID="old-pw" style={styles.input} value={oldPw} onChangeText={setOldPw} secureTextEntry />
              <Text style={styles.label}>{L.newPassword}</Text>
              <TextInput testID="new-pw" style={styles.input} value={newPw} onChangeText={setNewPw} secureTextEntry />
              <View style={{ flexDirection: 'row', gap: 8, marginTop: spacing.lg }}>
                <AnimatedPressable style={styles.cancelBtn} onPress={() => { setPwModal(false); setOldPw(''); setNewPw(''); }}>
                  <Text style={styles.cancelText}>{L.cancel}</Text>
                </AnimatedPressable>
                <AnimatedPressable testID="save-pw" style={styles.saveBtn} onPress={changePw} disabled={busy}>
                  {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveText}>{L.save}</Text>}
                </AnimatedPressable>
              </View>
            </View>
          ) : (
            <AnimatedPressable testID="row-change-password" style={styles.settingRow} onPress={() => setPwModal(true)}>
              <View style={[styles.rowIcon, { backgroundColor: '#FEF6E1' }]}><Lock size={18} color={colors.warning} /></View>
              <Text style={styles.rowText}>{L.changePassword}</Text>
              <ChevronRight size={18} color={colors.textMuted} />
            </AnimatedPressable>
          )}

          {/* Language Selection */}
          <View style={styles.settingRow}>
            <View style={[styles.rowIcon, { backgroundColor: '#EDF7E8' }]}><Globe size={18} color={colors.success} /></View>
            <Text style={styles.rowText}>{L.language}</Text>
            <View style={{ flexDirection: 'row', gap: 6 }}>
              <AnimatedPressable testID="lang-tr-row" style={[styles.langPill, language === 'tr' && styles.langPillActive]} onPress={() => { switchLang('tr'); hapticLight(); }}>
                <Text style={[styles.langPillText, language === 'tr' && styles.langPillTextActive]}>TR</Text>
              </AnimatedPressable>
              <AnimatedPressable testID="lang-en-row" style={[styles.langPill, language === 'en' && styles.langPillActive]} onPress={() => { switchLang('en'); hapticLight(); }}>
                <Text style={[styles.langPillText, language === 'en' && styles.langPillTextActive]}>EN</Text>
              </AnimatedPressable>
            </View>
          </View>

          {/* Notifications Toggle */}
          <View style={styles.settingRow}>
            <View style={[styles.rowIcon, { backgroundColor: '#E8F5FA' }]}><Bell size={18} color={colors.primary} /></View>
            <Text style={styles.rowText}>{L.notifications}</Text>
            <Switch
              testID="notifications-switch"
              value={notificationsEnabled}
              onValueChange={toggleNotifications}
              disabled={busy}
              trackColor={{ false: colors.borderLight, true: colors.primary }}
              thumbColor={notificationsEnabled ? colors.surface : colors.textMuted}
            />
          </View>

          {/* Logout & Delete Actions */}
          <AnimatedPressable testID="logout-button" style={[styles.settingRow, { marginTop: spacing.lg }]} onPress={onLogout}>
            <View style={[styles.rowIcon, { backgroundColor: '#FCEAEA' }]}><LogOut size={18} color={colors.error} /></View>
            <Text style={[styles.rowText, { color: colors.error }]}>{L.logout}</Text>
            <ChevronRight size={18} color={colors.textMuted} />
          </AnimatedPressable>

          <AnimatedPressable testID="delete-account-button" style={styles.settingRow} onPress={onDelete}>
            <View style={[styles.rowIcon, { backgroundColor: '#FCEAEA' }]}><Trash2 size={18} color={colors.error} /></View>
            <Text style={[styles.rowText, { color: colors.error }]}>{L.deleteAccount}</Text>
            <ChevronRight size={18} color={colors.textMuted} />
          </AnimatedPressable>

        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.base },
  scroll: { padding: spacing.xxl, paddingBottom: 140 },
  
  // Header section
  headerCard: { alignItems: 'center', marginBottom: spacing.xl },
  avatarWrapper: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: '#E8F0FE',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.md,
    ...shadows.floating,
    position: 'relative',
  },
  avatarImage: { width: 96, height: 96, borderRadius: 48 },
  avatarFallback: { width: 96, height: 96, borderRadius: 48, backgroundColor: colors.primary, justifyContent: 'center', alignItems: 'center' },
  avatarText: { color: '#fff', fontSize: 32, fontWeight: '800' },
  cameraOverlay: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#FCFBF8',
  },
  profileName: { fontSize: 24, fontWeight: '800', color: colors.textMain },
  profileEmail: { fontSize: 13, color: colors.textMuted, marginTop: 2 },
  profileBio: { fontSize: 14, fontStyle: 'italic', color: colors.textMuted, marginTop: 8, paddingHorizontal: spacing.xl, textAlign: 'center' },

  // Cards display
  infoCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: spacing.xl,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: colors.borderLight,
    ...shadows.card,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.textMain,
    marginBottom: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.surfaceElevated,
  },
  infoLabel: { fontSize: 14, color: colors.textMuted, fontWeight: '500' },
  infoVal: { fontSize: 14, color: colors.textMain, fontWeight: '700' },
  bloodTypeBadge: {
    backgroundColor: '#FCEAEA',
    color: colors.error,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radius.sm,
    fontSize: 12,
    fontWeight: '800',
  },

  // Edit Mode Styling
  cardContainer: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: spacing.xl,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: colors.borderLight,
    ...shadows.card,
  },
  label: { fontSize: 12, color: colors.textMuted, marginTop: spacing.md, marginBottom: 4, fontWeight: '700' },
  input: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: colors.textMain,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  cardDivider: { height: 1, backgroundColor: colors.borderLight },
  rowInputs: { flexDirection: 'row', gap: 12, marginTop: spacing.md },
  
  // Selector style for gender
  selectorRow: { flexDirection: 'row', gap: 8, marginTop: 6 },
  selectorButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.borderLight,
    alignItems: 'center',
  },
  selectorButtonActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  selectorButtonText: { color: colors.textMuted, fontWeight: '600', fontSize: 13 },
  selectorButtonTextActive: { color: '#fff', fontWeight: '700' },

  // Selector style for blood type
  pillsScroll: { paddingVertical: 4, gap: 8, marginTop: 4 },
  pill: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.borderLight,
    marginRight: 6,
  },
  pillActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  pillText: { color: colors.textMuted, fontWeight: '600', fontSize: 13 },
  pillTextActive: { color: '#fff', fontWeight: '700' },

  // Buttons
  actionButtons: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.xxl },
  cancelBtn: { flex: 1, paddingVertical: 14, alignItems: 'center', borderRadius: radius.pill, backgroundColor: colors.surfaceElevated },
  cancelText: { fontWeight: '700', color: colors.textMuted },
  saveBtn: { flex: 1, paddingVertical: 14, alignItems: 'center', borderRadius: radius.pill, backgroundColor: colors.primary },
  saveText: { fontWeight: '800', color: '#fff' },

  editButton: {
    backgroundColor: colors.primary,
    borderRadius: radius.pill,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: spacing.xxl,
    ...shadows.card,
  },
  editButtonText: { color: '#fff', fontWeight: '800', fontSize: 16 },

  // Settings layout rows
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: spacing.md,
    marginBottom: 10,
    gap: spacing.md,
    borderWidth: 1,
    borderColor: colors.borderLight,
    ...shadows.card,
  },
  rowIcon: { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center' },
  rowText: { flex: 1, fontSize: 15, fontWeight: '700', color: colors.textMain },
  langPill: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: radius.pill, backgroundColor: colors.surfaceElevated },
  langPillActive: { backgroundColor: colors.primary },
  langPillText: { fontWeight: '700', color: colors.textMuted, fontSize: 12 },
  langPillTextActive: { color: '#fff' },
});
