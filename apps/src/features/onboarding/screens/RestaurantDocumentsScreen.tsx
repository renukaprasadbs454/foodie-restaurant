import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as DocumentPicker from 'expo-document-picker';
import {
  DOCUMENT_ALLOWED_MIME_TYPES,
  isDocumentWithinSizeLimit,
  Toast,
  trackAnalyticsEvent,
  useApiErrorHandler,
  useConnectivity,
  TextInput,
} from 'foodie-shared-rn';
import { useUploadRestaurantDocumentMutation, useUpdateTimingsMutation, useGetRestaurantProfileQuery } from '../../../api/endpoints/restaurantsApi';
import { toUnwrappedApiError } from '../../auth/apiError';
import { OnboardingStepper } from '../components/OnboardingStepper';
import { DOC_TYPES, type RestaurantDocType } from '../types';
import type { OnboardingStackParamList } from '../../../navigation/types';

type Props = NativeStackScreenProps<
  OnboardingStackParamList,
  'RestaurantDocuments'
>;

const BRAND_PRIMARY = '#14532D';
const BRAND_ACCENT = '#F59E0B';


function formatTo24HourTime(timeStr?: string | null): string {
  if (!timeStr || !timeStr.trim()) return '09:00:00';
  const trimmed = timeStr.trim();
  
  const match24 = trimmed.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (match24) {
    const h = match24[1].padStart(2, '0');
    const m = match24[2];
    const s = match24[3] || '00';
    return `${h}:${m}:${s}`;
  }

  const match12 = trimmed.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)$/i);
  if (match12) {
    let hours = parseInt(match12[1], 10);
    const minutes = match12[2];
    const seconds = match12[3] || '00';
    const ampm = match12[4].toUpperCase();

    if (ampm === 'PM' && hours < 12) {
      hours += 12;
    } else if (ampm === 'AM' && hours === 12) {
      hours = 0;
    }
    return `${hours.toString().padStart(2, '0')}:${minutes}:${seconds}`;
  }

  return trimmed;
}

const TIME_OPTIONS = Array.from({ length: 48 }).map((_, i) => {
  const hours24 = Math.floor(i / 2);
  const minutes = (i % 2) * 30;
  const ampm = hours24 >= 12 ? 'PM' : 'AM';
  const hours12 = hours24 % 12 || 12;
  const label = `${hours12.toString().padStart(2, '0')}:${minutes === 0 ? '00' : '30'} ${ampm}`;
  const value = `${hours24.toString().padStart(2, '0')}:${minutes === 0 ? '00' : '30'}:00`;
  return { label, value };
});

const TimeSelect = ({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) => {
  const [modalVisible, setModalVisible] = useState(false);
  const selectedOption = TIME_OPTIONS.find(o => o.value === value || o.label === value || o.value === formatTo24HourTime(value)) || TIME_OPTIONS[0];

  return (
    <View style={{ flex: 1 }}>
      <Text style={{ fontSize: 13, color: '#64748B', marginBottom: 4, fontWeight: '600' }}>{label}</Text>
      <Pressable
        style={styles.timeInputBox}
        onPress={() => setModalVisible(true)}
      >
        <Text style={{ color: BRAND_PRIMARY, fontWeight: '700' }}>{selectedOption.label}</Text>
      </Pressable>

      <Modal visible={modalVisible} transparent animationType="slide">
        <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <View style={{ backgroundColor: 'white', borderTopLeftRadius: 16, borderTopRightRadius: 16, maxHeight: '50%' }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', padding: 16, borderBottomWidth: 1, borderColor: '#E2E8F0', alignItems: 'center' }}>
              <Text style={{ fontSize: 16, fontWeight: '700' }}>Select Time</Text>
              <Pressable onPress={() => setModalVisible(false)} style={{ padding: 4 }}>
                <Text style={{ color: BRAND_PRIMARY, fontWeight: '700' }}>Done</Text>
              </Pressable>
            </View>
            <ScrollView>
              {TIME_OPTIONS.map(opt => (
                <Pressable
                  key={opt.value}
                  style={{ padding: 16, borderBottomWidth: 1, borderColor: '#F1F5F9', backgroundColor: value === opt.value ? '#F0FDF4' : 'white' }}
                  onPress={() => {
                    onChange(opt.value);
                    setModalVisible(false);
                  }}
                >
                  <Text style={{ fontSize: 16, color: value === opt.value ? BRAND_PRIMARY : '#1E293B', fontWeight: value === opt.value ? '700' : '400', textAlign: 'center' }}>
                    {opt.label}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
};

export function RestaurantDocumentsScreen({ navigation }: Props) {
  const { isConnected } = useConnectivity();
  const [upload, uploadState] = useUploadRestaurantDocumentMutation();
  const [updateTimings, { isLoading: isUpdatingTimings }] = useUpdateTimingsMutation();
  const [docType, setDocType] = useState<RestaurantDocType>('FSSAI');
  const [uploadedTypes, setUploadedTypes] = useState<Record<string, boolean>>({});
  const [toast, setToast] = useState<{
    message: string;
    variant: 'info' | 'success' | 'error' | 'warning';
  } | null>(null);

  const handleError = useApiErrorHandler({
    onToast: (error) => setToast({ message: error.message, variant: 'error' }),
    onModalBlocking: (error) =>
      setToast({ message: error.message, variant: 'error' }),
    onInlineField: (error) =>
      setToast({ message: error.message, variant: 'error' }),
    onFullScreen: (error) =>
      setToast({ message: error.message, variant: 'error' }),
    onGeneric: (error) => setToast({ message: error.message, variant: 'error' }),
  });

  const [openDays, setOpenDays] = useState<string[]>([]);
  const [openTime, setOpenTime] = useState('09:00:00');
  const [closeTime, setCloseTime] = useState('22:00:00');

  const { data: profile } = useGetRestaurantProfileQuery();

  useEffect(() => {
    if (profile) {
      if (profile.documents) {
        const uploaded: Record<string, boolean> = {};
        profile.documents.forEach((d: { docType: string }) => {
          uploaded[d.docType] = true;
        });
        setUploadedTypes(prev => ({ ...prev, ...uploaded }));
      }
      if (profile.openTime) setOpenTime(profile.openTime);
      if (profile.closeTime) setCloseTime(profile.closeTime);
      if (profile.openDays) setOpenDays(profile.openDays);
    }
  }, [profile]);

  const allUploaded = DOC_TYPES.every((type) => uploadedTypes[type]);
  const timingsFilled = openDays.length > 0 && openTime.trim().length > 0 && closeTime.trim().length > 0;
  const canProceed = allUploaded && timingsFilled;

  useEffect(() => {
    trackAnalyticsEvent('restaurant_documents_viewed');
  }, []);

  const onPickAndUpload = async (selectedDocType: RestaurantDocType) => {
    // ... [existing function logic untouched, we keep it as is, but we must provide the whole function body since we replace it]
    setDocType(selectedDocType);
    if (!isConnected) {
      setToast({
        message: 'Connect to the internet to upload documents.',
        variant: 'warning',
      });
      return;
    }
    const result = await DocumentPicker.getDocumentAsync({
      type: [...DOCUMENT_ALLOWED_MIME_TYPES],
      copyToCacheDirectory: true,
    });
    if (result.canceled || !result.assets?.[0]) return;
    const asset = result.assets[0];
    const mimeType = asset.mimeType ?? 'application/pdf';
    if (!(DOCUMENT_ALLOWED_MIME_TYPES as readonly string[]).includes(mimeType)) {
      setToast({
        message: 'Use a PDF, JPEG, or PNG document.',
        variant: 'error',
      });
      return;
    }
    if (
      typeof asset.size === 'number' &&
      !isDocumentWithinSizeLimit(asset.size)
    ) {
      setToast({
        message: 'Document must be 10 MB or smaller.',
        variant: 'error',
      });
      return;
    }
    try {
      await upload({
        docType: selectedDocType,
        uri: asset.uri,
        mimeType,
        fileName: asset.name || `${selectedDocType.toLowerCase()}.pdf`,
        fileObj: (asset as any).file,
      }).unwrap();
      trackAnalyticsEvent('document_uploaded', { docType: selectedDocType });
      trackAnalyticsEvent('restaurant_document_uploaded', { docType: selectedDocType });
      setUploadedTypes((prev) => ({ ...prev, [selectedDocType]: true }));
      setToast({ message: `${selectedDocType} uploaded successfully!`, variant: 'success' });
    } catch (error) {
      handleError(toUnwrappedApiError(error));
    }
  };

  const toggleDay = (day: string) => {
    setOpenDays(prev =>
      prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day]
    );
  };

  const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

  return (
    <View style={styles.screen}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Header Card */}
        <View style={styles.headerCard}>
          <View style={styles.headerRow}>
            <View style={{ flex: 1, gap: 4 }}>
              <Text style={styles.headerBadge}>COMPLIANCE & LEGAL</Text>
              <Text style={styles.headerTitle}>Upload KYC Documents</Text>
              <Text style={styles.headerSubtitle}>
                Provide official legal certificates for verification
              </Text>
            </View>
            <View style={styles.iconCircle}>
              <Text style={{ fontSize: 26 }}>📄</Text>
            </View>
          </View>
        </View>

        {/* Stepper */}
        <OnboardingStepper activeIndex={1} />

        {/* Upload Card */}
        <View style={styles.card}>
          <Text style={styles.sectionHeader}>📋 Document Selection</Text>

          <View style={styles.docTypeRow}>
            {DOC_TYPES.map((type) => {
              const selected = docType === type;
              const isUploaded = Boolean(uploadedTypes[type]);
              return (
                <Pressable
                  key={type}
                  onPress={() => void onPickAndUpload(type)}
                  style={[
                    styles.docTypeChip,
                    selected && styles.docTypeChipSelected,
                  ]}
                >
                  <Text
                    style={[
                      styles.docTypeChipText,
                      selected && styles.docTypeChipTextSelected,
                    ]}
                  >
                    {isUploaded ? '✓ ' : ''}{type}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {/* Guidelines Box */}
          <View style={styles.infoBox}>
            <Text style={styles.infoTitle}>📌 Requirements for documents:</Text>
            <Text style={styles.infoText}>
              • Accepted Formats: PDF, PNG, JPG (Max 10 MB).{'\n'}
              • Must show legible license number, validity, and business address.
            </Text>
          </View>
        </View>

        {/* Timing Selection Card */}
        <View style={styles.card}>
          <Text style={styles.sectionHeader}>⏰ Restaurant Delivery Timings</Text>

          <View style={{ flexDirection: 'row', gap: 12, marginTop: 8 }}>
            <TimeSelect
              label="Open time"
              value={openTime}
              onChange={setOpenTime}
            />
            <TimeSelect
              label="Close time"
              value={closeTime}
              onChange={setCloseTime}
            />
          </View>

          <View style={{ marginTop: 16 }}>
            <Text style={{ fontSize: 13, color: '#64748B', marginBottom: 4, fontWeight: '600' }}>Mark open days</Text>
            <Text style={{ fontSize: 11, color: '#94A3B8', marginBottom: 12 }}>Don't forget to uncheck your off-day</Text>

            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {DAYS.map(day => {
                const isSelected = openDays.includes(day);
                return (
                  <Pressable
                    key={day}
                    onPress={() => toggleDay(day)}
                    style={[
                      styles.dayChip,
                      isSelected && styles.dayChipSelected
                    ]}
                  >
                    <Text style={[styles.dayChipText, isSelected && styles.dayChipTextSelected]}>
                      {isSelected ? '☑' : '☐'} {day}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        </View>

        {/* Navigation Action Buttons */}
        <View style={{ gap: 12 }}>
          <Pressable
            style={({ pressed }) => [
              styles.secondaryButton,
              pressed && styles.secondaryButtonPressed,
              isUpdatingTimings && styles.buttonDisabled,
            ]}
            onPress={async () => {
              if (canProceed) {
                if (!isConnected) {
                  setToast({ message: 'Connect to the internet to save timings.', variant: 'warning' });
                  return;
                }
                const isoOpenTime = formatTo24HourTime(openTime);
      const isoCloseTime = formatTo24HourTime(closeTime);
                try {
                  await updateTimings({ openTime: isoOpenTime, closeTime: isoCloseTime, openDays }).unwrap();
                  trackAnalyticsEvent('restaurant_registration_timings_saved');
                  navigation.navigate('RestaurantImages');
                } catch (error) {
                  handleError(toUnwrappedApiError(error));
                }
              } else {
                if (!allUploaded) {
                  setToast({
                    message: 'Please upload all compliance documents before proceeding.',
                    variant: 'warning',
                  });
                } else {
                  setToast({
                    message: 'Please provide open time, close time, and select at least one open day. They are mandatory.',
                    variant: 'warning',
                  });
                }
              }
            }}
            disabled={isUpdatingTimings}
          >
            {isUpdatingTimings ? (
              <ActivityIndicator color={BRAND_PRIMARY} />
            ) : (
              <Text style={styles.secondaryButtonText}>
                Proceed to Images →
              </Text>
            )}
          </Pressable>

          <Pressable
            onPress={() => navigation.navigate('RestaurantRegistration')}
            style={{ alignItems: 'center', marginVertical: 8, paddingVertical: 8 }}
          >
            <Text style={{ color: '#64748B', fontSize: 14, fontWeight: '700' }}>← Back to Basic Info</Text>
          </Pressable>
        </View>
      </ScrollView>

      <Toast
        visible={Boolean(toast)}
        message={toast?.message ?? ''}
        variant={toast?.variant ?? 'info'}
        accessibilityLabel={toast?.message ?? 'Toast'}
        onDismiss={() => setToast(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  scrollContent: {
    padding: 16,
    gap: 16,
    paddingBottom: 48,
  },
  headerCard: {
    backgroundColor: BRAND_PRIMARY,
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.3)',
    shadowColor: '#14532D',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 4,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerBadge: {
    fontSize: 11,
    fontWeight: '800',
    color: BRAND_ACCENT,
    letterSpacing: 1,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: -0.5,
  },
  headerSubtitle: {
    fontSize: 13,
    color: '#A7F3D0',
  },
  iconCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderWidth: 1.5,
    borderColor: BRAND_ACCENT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 16,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 3,
  },
  sectionHeader: {
    fontSize: 17,
    fontWeight: '800',
    color: BRAND_PRIMARY,
  },
  docTypeRow: {
    flexDirection: 'row',
    gap: 10,
  },
  docTypeChip: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    backgroundColor: '#F8FAFC',
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
  },
  docTypeChipSelected: {
    backgroundColor: '#F0FDF4',
    borderColor: BRAND_PRIMARY,
  },
  docTypeChipText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#64748B',
  },
  docTypeChipTextSelected: {
    color: BRAND_PRIMARY,
    fontWeight: '900',
  },
  infoBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 4,
  },
  infoTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: BRAND_PRIMARY,
  },
  infoText: {
    fontSize: 12,
    color: '#64748B',
    lineHeight: 18,
  },
  primaryButton: {
    backgroundColor: BRAND_PRIMARY,
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: BRAND_PRIMARY,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  primaryButtonPressed: {
    opacity: 0.9,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
  secondaryButton: {
    backgroundColor: '#F0FDF4',
    borderRadius: 16,
    paddingVertical: 15,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: BRAND_PRIMARY,
  },
  secondaryButtonPressed: {
    opacity: 0.8,
  },
  secondaryButtonText: {
    color: BRAND_PRIMARY,
    fontSize: 15,
    fontWeight: '800',
  },
  textButton: {
    paddingVertical: 10,
    alignItems: 'center',
  },
  textButtonPressed: {
    opacity: 0.6,
  },
  textButtonText: {
    color: '#64748B',
    fontSize: 13,
    fontWeight: '600',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  timeInputBox: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  dayChip: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 10,
    minWidth: 80,
    alignItems: 'center',
  },
  dayChipSelected: {
    backgroundColor: '#F0FDF4',
    borderColor: BRAND_PRIMARY,
  },
  dayChipText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748B',
  },
  dayChipTextSelected: {
    color: BRAND_PRIMARY,
    fontWeight: '900',
  },
});
