import React, { useState, useEffect, useRef } from 'react';
import {
  Modal,
  View,
  ScrollView,
  Pressable,
  TextInput as RNTextInput,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Keyboard,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { Text, Toast } from 'foodie-shared-rn';
import Feather from '@expo/vector-icons/Feather';

import { useAppSelector } from '../../../store/hooks';
import { selectRestaurantId } from '../../onboarding/restaurantOnboardingSlice';
import { useGetRestaurantProfileQuery } from '../../../api/endpoints/restaurantsApi';

import {
  useGetMyConversationsQuery,
  useCreateTicketMutation,
  useGetMessagesQuery,
  useSendMessageMutation,
  type SupportConversation,
  type SupportMessage,
} from '../../../api/endpoints/supportApi';

interface RestaurantSupportModalProps {
  visible: boolean;
  onClose: () => void;
  restaurantId?: string;
  restaurantName?: string;
  activeOrderId?: string;
}

const QUICK_CATEGORIES = [
  { key: 'PAYOUT', label: '💰 Settlement & Payouts', subject: 'Payout / Settlement Inquiry' },
  { key: 'ORDER', label: '📦 Order Issue', subject: 'Order / Delivery Partner Issue' },
  { key: 'MENU', label: '📋 Menu Management', subject: 'Menu Items & Pricing Update' },
  { key: 'ACCOUNT', label: '⚙️ Account & Business', subject: 'Account & Business Details' },
  { key: 'OTHER', label: '💬 Other Question', subject: 'General Support Inquiry' },
];

async function getStoredTicketIds(key: string): Promise<string[]> {
  try {
    const isSecureAvailable = await SecureStore.isAvailableAsync();
    let raw: string | null = null;
    if (isSecureAvailable) {
      raw = await SecureStore.getItemAsync(`@foodie_rest_tickets_${key}`);
    }
    if (!raw) {
      raw = await AsyncStorage.getItem(`@foodie_rest_tickets_${key}`);
    }
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {}
  return [];
}

async function setStoredTicketIds(key: string, ids: string[]): Promise<void> {
  try {
    const serialized = JSON.stringify(ids);
    const isSecureAvailable = await SecureStore.isAvailableAsync();
    if (isSecureAvailable) {
      await SecureStore.setItemAsync(`@foodie_rest_tickets_${key}`, serialized);
    }
    await AsyncStorage.setItem(`@foodie_rest_tickets_${key}`, serialized);
  } catch {}
}

export function RestaurantSupportModal({
  visible,
  onClose,
  restaurantId,
  restaurantName = 'Partner Restaurant',
  activeOrderId,
}: RestaurantSupportModalProps) {
  const reduxRestaurantId = useAppSelector(selectRestaurantId);
  const { data: profile } = useGetRestaurantProfileQuery(undefined, { skip: false });

  const currentRestaurantId = restaurantId || reduxRestaurantId || profile?.restaurantId || '';
  const currentRestaurantName = (restaurantName && restaurantName !== 'Partner Restaurant' && restaurantName !== 'Restaurant Partner'
    ? restaurantName
    : profile?.name) || 'Partner Restaurant';

  const storageKey = (currentRestaurantId || currentRestaurantName).replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();

  const [trackedTicketIds, setTrackedTicketIds] = useState<string[]>([]);
  const [activeEnquiryId, setActiveEnquiryId] = useState<string | null>(null);
  const [isCreatingNew, setIsCreatingNew] = useState(false);
  const [newCategoryKey, setNewCategoryKey] = useState('PAYOUT');
  const [newSubject, setNewSubject] = useState('Payout / Settlement Inquiry');
  const [newMessageText, setNewMessageText] = useState('');
  const [newOrderIdInput, setNewOrderIdInput] = useState(activeOrderId || '');
  const [chatInput, setChatInput] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [filterTab, setFilterTab] = useState<'OPEN' | 'RESOLVED' | 'ALL'>('OPEN');
  const [toast, setToast] = useState<{ message: string; variant: 'success' | 'error' | 'info' } | null>(null);

  const scrollViewRef = useRef<ScrollView>(null);

  useEffect(() => {
    if (visible && storageKey) {
      getStoredTicketIds(storageKey).then((saved) => {
        setTrackedTicketIds((prev) => Array.from(new Set([...prev, ...saved])));
      });
    }
  }, [visible, storageKey]);

  // Queries & Mutations
  const { data: conversations, isLoading: isLoadingConversations, refetch: refetchConversations } = useGetMyConversationsQuery(undefined, {
    skip: !visible,
    pollingInterval: visible ? 2500 : 0,
  });

  const [createTicketMutation, { isLoading: isCreatingTicket }] = useCreateTicketMutation();
  const [sendMessageMutation] = useSendMessageMutation();

  const getCleanSubject = (rawSubject?: string) => {
    if (!rawSubject) return 'Support Enquiry';
    const match = rawSubject.match(/^\[(.*?)\]\s*(.*)$/);
    return match ? match[2].trim() : rawSubject;
  };

  const isTicketForThisRestaurant = (c: SupportConversation) => {
    if (c.category && c.category !== 'RESTAURANT') return false;

    // Filter out mock dummy records
    if (
      c.id === 'ENQ-2093BD86' ||
      c.id === 'ENQ-REST-HOTELMAYURA' ||
      c.id === 'ENQ-REST-SPICE' ||
      c.id === 'ENQ-REST-PMKM' ||
      c.id === 'ENQ-903' ||
      c.customerId === 'hotelmayura@restaurant.foodie.local' ||
      c.customerId === 'pmkm@foodie.local' ||
      c.customerId === 'r0ck@foodie.local'
    ) {
      return false;
    }

    // Explicitly tracked ticket IDs for this restaurant session/account
    if (trackedTicketIds.includes(c.id)) {
      return true;
    }

    // Match exact restaurantId
    if (currentRestaurantId && c.restaurantId && String(c.restaurantId).trim() === String(currentRestaurantId).trim()) {
      return true;
    }

    const currNameNorm = currentRestaurantName.trim().toLowerCase();
    const isGenericName = !currNameNorm || currNameNorm === 'partner restaurant' || currNameNorm === 'restaurant partner';

    if (!isGenericName) {
      if (c.restaurantName && c.restaurantName.trim().toLowerCase() === currNameNorm) {
        return true;
      }

      // Check if ticket subject was tagged with [currentRestaurantName]
      const subjNorm = (c.subject || '').trim().toLowerCase();
      if (subjNorm.startsWith(`[${currNameNorm}]`)) {
        return true;
      }

      // Legacy Shivam Cafe: ENQ-869CA402 belongs ONLY to Shivam Cafe
      if (c.id === 'ENQ-869CA402' && currNameNorm.includes('shivam')) {
        return true;
      }
    }

    return false;
  };

  const thisRestaurantConversations = (conversations || []).filter(isTicketForThisRestaurant);

  const openConversations = thisRestaurantConversations.filter(
    (c) => c.status !== 'RESOLVED' && c.status !== 'CLOSED'
  );
  const resolvedConversations = thisRestaurantConversations.filter(
    (c) => c.status === 'RESOLVED' || c.status === 'CLOSED'
  );

  const filteredConversations =
    filterTab === 'OPEN'
      ? openConversations
      : filterTab === 'RESOLVED'
        ? resolvedConversations
        : thisRestaurantConversations;

  const activeEnquiry = thisRestaurantConversations.find((c) => c.id === activeEnquiryId) || null;

  const { data: messages, isLoading: isLoadingMessages } = useGetMessagesQuery(activeEnquiryId || '', {
    skip: !visible || !activeEnquiryId,
    pollingInterval: visible && Boolean(activeEnquiryId) ? 1500 : 0,
  });

  // Keep order id prefilled if provided
  useEffect(() => {
    if (activeOrderId) {
      setNewOrderIdInput(activeOrderId);
    }
  }, [activeOrderId]);

  // Scroll to bottom on messages update
  useEffect(() => {
    if (activeEnquiryId && scrollViewRef.current) {
      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
      }, 150);
    }
  }, [activeEnquiryId, messages?.length]);

  // Handle keyboard on iOS/Android
  useEffect(() => {
    if (Platform.OS !== 'web') {
      const showSub = Keyboard.addListener('keyboardDidShow', () => {
        setTimeout(() => scrollViewRef.current?.scrollToEnd({ animated: true }), 100);
      });
      return () => showSub.remove();
    }
  }, []);

  const handleSelectCategory = (cat: typeof QUICK_CATEGORIES[0]) => {
    setNewCategoryKey(cat.key);
    setNewSubject(cat.subject);
  };

  const handleStartNewEnquiry = async () => {
    if (isCreatingTicket) return;

    if (!newSubject.trim()) {
      setToast({ message: 'Please provide a subject for your enquiry', variant: 'error' });
      return;
    }
    if (!newMessageText.trim()) {
      setToast({ message: 'Please describe your query in the message box', variant: 'error' });
      return;
    }

    try {
      const res = await createTicketMutation({
        subject: newSubject.trim(),
        message: newMessageText.trim(),
        orderId: newOrderIdInput.trim() || undefined,
        restaurantName: currentRestaurantName,
        restaurantId: currentRestaurantId || undefined,
      }).unwrap();

      setToast({ message: 'Support enquiry submitted successfully', variant: 'success' });
      setIsCreatingNew(false);
      setNewMessageText('');
      if (res?.id) {
        const newId = res.id;
        setTrackedTicketIds((prev) => {
          const updated = Array.from(new Set([...prev, newId]));
          if (storageKey) {
            setStoredTicketIds(storageKey, updated);
          }
          return updated;
        });
        setActiveEnquiryId(newId);
      }
      refetchConversations();
    } catch (err: any) {
      const errMsg = err?.data?.message || err?.message || 'Failed to create enquiry. Please check your network connection.';
      setToast({ message: errMsg, variant: 'error' });
    }
  };

  const handleSendMessage = async () => {
    const textToSend = chatInput.trim();
    if (!textToSend || !activeEnquiryId || isSending) return;

    setIsSending(true);
    setChatInput('');

    try {
      await sendMessageMutation({
        conversationId: activeEnquiryId,
        message: textToSend,
        senderName: currentRestaurantName,
        senderType: 'RESTAURANT',
      }).unwrap();
    } catch {
      setToast({ message: 'Failed to deliver message', variant: 'error' });
      setChatInput(textToSend);
    } finally {
      setIsSending(false);
      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'RESOLVED':
      case 'CLOSED':
        return { bg: '#DCFCE7', text: '#15803D', dot: '#16A34A', label: 'Resolved' };
      case 'IN_PROGRESS':
      case 'AGENT_ACTIVE':
      case 'ASSIGNED':
      case 'WAITING_FOR_AGENT':
        return { bg: '#EFF6FF', text: '#1D4ED8', dot: '#3B82F6', label: 'In Progress' };
      case 'OPEN':
      default:
        return { bg: '#FEF3C7', text: '#92400E', dot: '#F59E0B', label: 'Open' };
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent={false} onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={{ flex: 1, backgroundColor: '#F8FAFC' }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* PREMIUM FOODIE GREEN HEADER */}
        <View
          style={{
            backgroundColor: '#14532D',
            paddingTop: Platform.OS === 'ios' ? 52 : 24,
            paddingBottom: 16,
            paddingHorizontal: 20,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            elevation: 4,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.15,
            shadowRadius: 5,
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
            {activeEnquiry || isCreatingNew ? (
              <Pressable
                onPress={() => {
                  if (isCreatingNew) {
                    setIsCreatingNew(false);
                  } else {
                    setActiveEnquiryId(null);
                  }
                }}
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 18,
                  backgroundColor: 'rgba(255, 255, 255, 0.15)',
                  justifyContent: 'center',
                  alignItems: 'center',
                  marginRight: 12,
                }}
              >
                <Feather name="arrow-left" size={20} color="#FFFFFF" />
              </Pressable>
            ) : null}

            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Text style={{ fontSize: 18, fontWeight: '800', color: '#FFFFFF' }} numberOfLines={1}>
                  {activeEnquiry
                    ? activeEnquiry.id
                    : isCreatingNew
                      ? 'New Support Enquiry'
                      : 'Foodie Support Desk'}
                </Text>
                {activeEnquiry && (
                  <View
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      paddingHorizontal: 8,
                      paddingVertical: 2,
                      borderRadius: 12,
                      backgroundColor: getStatusColor(activeEnquiry.status).bg,
                      gap: 4,
                    }}
                  >
                    <View
                      style={{
                        width: 6,
                        height: 6,
                        borderRadius: 3,
                        backgroundColor: getStatusColor(activeEnquiry.status).dot,
                      }}
                    />
                    <Text
                      style={{
                        fontSize: 10,
                        fontWeight: '800',
                        color: getStatusColor(activeEnquiry.status).text,
                      }}
                    >
                      {getStatusColor(activeEnquiry.status).label}
                    </Text>
                  </View>
                )}
              </View>

              <Text style={{ fontSize: 12, color: '#A7F3D0', fontWeight: '500', marginTop: 2 }} numberOfLines={1}>
                {activeEnquiry
                  ? `${currentRestaurantName} • ${getCleanSubject(activeEnquiry.subject)}`
                  : isCreatingNew
                    ? `Authenticated as ${currentRestaurantName}`
                    : `🍽️ ${currentRestaurantName} • Direct Admin Connection`}
              </Text>
            </View>
          </View>

          <Pressable
            onPress={onClose}
            style={{
              width: 34,
              height: 34,
              borderRadius: 17,
              backgroundColor: 'rgba(255, 255, 255, 0.2)',
              justifyContent: 'center',
              alignItems: 'center',
              marginLeft: 10,
            }}
          >
            <Feather name="x" size={18} color="#FFFFFF" />
          </Pressable>
        </View>

        {/* VIEW 1: ACTIVE LIVE 2-WAY CHAT */}
        {activeEnquiry ? (
          <View style={{ flex: 1, backgroundColor: '#F1F5F9' }}>
            {/* ENQUIRY CONTEXT CARD */}
            <View
              style={{
                backgroundColor: '#FFFFFF',
                paddingHorizontal: 16,
                paddingVertical: 12,
                borderBottomWidth: 1,
                borderBottomColor: '#E2E8F0',
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <View style={{ flex: 1, marginRight: 8 }}>
                  <Text style={{ fontSize: 14, fontWeight: '800', color: '#0F172A' }}>
                    {getCleanSubject(activeEnquiry.subject)}
                  </Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 4 }}>
                    <Text style={{ fontSize: 11, color: '#64748B' }}>
                      Created: {new Date(activeEnquiry.createdAt).toLocaleDateString()}
                    </Text>
                    {activeEnquiry.orderId ? (
                      <Text style={{ fontSize: 11, color: '#16A34A', fontWeight: '700' }}>
                        Order Ref: #{activeEnquiry.orderId}
                      </Text>
                    ) : null}
                  </View>
                </View>

                <View
                  style={{
                    paddingHorizontal: 10,
                    paddingVertical: 4,
                    borderRadius: 10,
                    backgroundColor: getStatusColor(activeEnquiry.status).bg,
                  }}
                >
                  <Text
                    style={{
                      fontSize: 11,
                      fontWeight: '800',
                      color: getStatusColor(activeEnquiry.status).text,
                    }}
                  >
                    {getStatusColor(activeEnquiry.status).label}
                  </Text>
                </View>
              </View>

              {/* Status Note Banner */}
              {activeEnquiry.status === 'RESOLVED' || activeEnquiry.status === 'CLOSED' ? (
                <View
                  style={{
                    backgroundColor: '#F0FDF4',
                    borderWidth: 1,
                    borderColor: '#BBF7D0',
                    borderRadius: 12,
                    paddingHorizontal: 12,
                    paddingVertical: 10,
                    marginTop: 8,
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 10,
                  }}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
                    <Feather name="check-circle" size={16} color="#16A34A" />
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 12, color: '#15803D', fontWeight: '700' }}>
                        Enquiry resolved by Admin Support
                      </Text>
                      <Text style={{ fontSize: 11, color: '#166534', marginTop: 2 }}>
                        Need further help? Start a new chat or reply to reopen.
                      </Text>
                    </View>
                  </View>
                  <Pressable
                    onPress={() => {
                      setActiveEnquiryId(null);
                      setIsCreatingNew(true);
                    }}
                    style={{
                      backgroundColor: '#15803D',
                      paddingHorizontal: 12,
                      paddingVertical: 7,
                      borderRadius: 10,
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 4,
                    }}
                  >
                    <Feather name="plus" size={14} color="#FFFFFF" />
                    <Text style={{ color: '#FFFFFF', fontSize: 12, fontWeight: '800' }}>
                      New Chat
                    </Text>
                  </Pressable>
                </View>
              ) : activeEnquiry.status === 'IN_PROGRESS' || activeEnquiry.status === 'AGENT_ACTIVE' ? (
                <View
                  style={{
                    backgroundColor: '#EFF6FF',
                    borderWidth: 1,
                    borderColor: '#BFDBFE',
                    borderRadius: 10,
                    paddingHorizontal: 12,
                    paddingVertical: 8,
                    marginTop: 8,
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 8,
                  }}
                >
                  <Feather name="shield" size={14} color="#2563EB" />
                  <Text style={{ fontSize: 11, color: '#1E40AF', fontWeight: '600', flex: 1 }}>
                    A human Admin Support Agent is actively reviewing your enquiry.
                  </Text>
                </View>
              ) : null}
            </View>

            {/* CONVERSATION MESSAGE SCROLLER */}
            <ScrollView
              ref={scrollViewRef}
              style={{ flex: 1 }}
              contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 24 }}
            >
              {isLoadingMessages && !messages ? (
                <View style={{ padding: 32, alignItems: 'center' }}>
                  <ActivityIndicator size="small" color="#16A34A" />
                  <Text style={{ fontSize: 12, color: '#64748B', marginTop: 8 }}>Loading conversation...</Text>
                </View>
              ) : null}

              {messages && messages.length === 0 ? (
                <View
                  style={{
                    backgroundColor: '#FFFFFF',
                    borderRadius: 14,
                    padding: 24,
                    alignItems: 'center',
                    borderWidth: 1,
                    borderColor: '#E2E8F0',
                  }}
                >
                  <Feather name="message-square" size={32} color="#94A3B8" />
                  <Text style={{ fontSize: 14, fontWeight: '700', color: '#334155', marginTop: 8 }}>
                    Conversation opened
                  </Text>
                  <Text style={{ fontSize: 12, color: '#64748B', textAlign: 'center', marginTop: 4 }}>
                    Type your message below. A Foodie Admin Support Agent will respond shortly.
                  </Text>
                </View>
              ) : null}

              {(messages || []).map((msg: SupportMessage) => {
                const isRestaurant = msg.senderType === 'RESTAURANT';
                const isAdmin = msg.senderType === 'AGENT' || msg.senderType === 'ADMIN';

                return (
                  <View
                    key={msg.id}
                    style={{
                      alignSelf: isRestaurant ? 'flex-end' : 'flex-start',
                      maxWidth: '84%',
                    }}
                  >
                    {/* SENDER LABEL & TIMESTAMP */}
                    <View
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        marginBottom: 4,
                        alignSelf: isRestaurant ? 'flex-end' : 'flex-start',
                        gap: 6,
                      }}
                    >
                      {isAdmin ? (
                        <View
                          style={{
                            width: 18,
                            height: 18,
                            borderRadius: 9,
                            backgroundColor: '#16A34A',
                            justifyContent: 'center',
                            alignItems: 'center',
                          }}
                        >
                          <Feather name="shield" size={10} color="#FFFFFF" />
                        </View>
                      ) : null}

                      <Text
                        style={{
                          fontSize: 11,
                          fontWeight: '700',
                          color: isRestaurant ? '#16A34A' : '#1E293B',
                        }}
                      >
                        {isRestaurant ? 'You' : (msg.senderName || 'Admin Support')}
                      </Text>

                      <Text style={{ fontSize: 10, color: '#94A3B8' }}>
                        {msg.createdAt
                          ? new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                          : 'Just now'}
                      </Text>
                    </View>

                    {/* BUBBLE */}
                    <View
                      style={{
                        backgroundColor: isRestaurant ? '#15803D' : '#FFFFFF',
                        paddingHorizontal: 16,
                        paddingVertical: 12,
                        borderRadius: 18,
                        borderBottomRightRadius: isRestaurant ? 4 : 18,
                        borderBottomLeftRadius: isRestaurant ? 18 : 4,
                        borderWidth: isRestaurant ? 0 : 1,
                        borderColor: '#E2E8F0',
                        shadowColor: '#000',
                        shadowOffset: { width: 0, height: 1 },
                        shadowOpacity: 0.05,
                        shadowRadius: 3,
                        elevation: 1,
                      }}
                    >
                      <Text
                        style={{
                          fontSize: 14,
                          lineHeight: 20,
                          color: isRestaurant ? '#FFFFFF' : '#0F172A',
                        }}
                      >
                        {msg.content}
                      </Text>
                    </View>
                  </View>
                );
              })}
            </ScrollView>

            {/* MESSAGE COMPOSER BAR */}
            <View
              style={{
                backgroundColor: '#FFFFFF',
                paddingHorizontal: 14,
                paddingVertical: 10,
                borderTopWidth: 1,
                borderTopColor: '#E2E8F0',
                flexDirection: 'row',
                alignItems: 'center',
                gap: 10,
              }}
            >
              <RNTextInput
                style={{
                  flex: 1,
                  backgroundColor: '#F8FAFC',
                  borderWidth: 1,
                  borderColor: '#CBD5E1',
                  borderRadius: 22,
                  paddingHorizontal: 16,
                  paddingVertical: Platform.OS === 'ios' ? 10 : 8,
                  fontSize: 14,
                  color: '#0F172A',
                  maxHeight: 110,
                }}
                placeholder="Type your message to support..."
                placeholderTextColor="#94A3B8"
                value={chatInput}
                onChangeText={setChatInput}
                multiline
              />

              <Pressable
                onPress={handleSendMessage}
                disabled={isSending || !chatInput.trim()}
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 22,
                  backgroundColor: chatInput.trim() ? '#15803D' : '#CBD5E1',
                  justifyContent: 'center',
                  alignItems: 'center',
                  elevation: chatInput.trim() ? 2 : 0,
                }}
              >
                {isSending ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Feather name="send" size={18} color="#FFFFFF" style={{ marginLeft: 2 }} />
                )}
              </Pressable>
            </View>
          </View>
        ) : isCreatingNew ? (
          /* VIEW 2: NEW ENQUIRY FORM */
          <ScrollView
            style={{ flex: 1, backgroundColor: '#F8FAFC' }}
            contentContainerStyle={{ padding: 20, paddingBottom: 40 }}
          >
            {/* HERO PROMPT */}
            <View
              style={{
                backgroundColor: '#FFFFFF',
                borderRadius: 20,
                padding: 20,
                borderWidth: 1,
                borderColor: '#E2E8F0',
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.05,
                shadowRadius: 6,
                elevation: 2,
                marginBottom: 20,
              }}
            >
              <Text style={{ fontSize: 18, fontWeight: '800', color: '#0F172A', marginBottom: 4 }}>
                How can Admin Support assist you? 👋
              </Text>
              <Text style={{ fontSize: 13, color: '#64748B', lineHeight: 18, marginBottom: 16 }}>
                Select a topic below and provide details. Your enquiry will be immediately routed to the Restaurant Admin Support Desk.
              </Text>

              <Text style={{ fontSize: 12, fontWeight: '800', color: '#16A34A', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10 }}>
                SELECT TOPIC
              </Text>

              <View style={{ gap: 8 }}>
                {QUICK_CATEGORIES.map((cat) => {
                  const isSelected = newCategoryKey === cat.key;
                  return (
                    <Pressable
                      key={cat.key}
                      onPress={() => handleSelectCategory(cat)}
                      style={{
                        paddingVertical: 12,
                        paddingHorizontal: 16,
                        borderRadius: 12,
                        backgroundColor: isSelected ? '#F0FDF4' : '#FFFFFF',
                        borderWidth: 1.5,
                        borderColor: isSelected ? '#16A34A' : '#E2E8F0',
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                      }}
                    >
                      <Text
                        style={{
                          fontSize: 14,
                          fontWeight: isSelected ? '800' : '600',
                          color: isSelected ? '#15803D' : '#334155',
                        }}
                      >
                        {cat.label}
                      </Text>
                      {isSelected ? <Feather name="check-circle" size={16} color="#16A34A" /> : null}
                    </Pressable>
                  );
                })}
              </View>
            </View>

            {/* SUBJECT & DETAILS */}
            <View
              style={{
                backgroundColor: '#FFFFFF',
                borderRadius: 20,
                padding: 20,
                borderWidth: 1,
                borderColor: '#E2E8F0',
                gap: 16,
              }}
            >
              <View>
                <Text style={{ fontSize: 12, fontWeight: '700', color: '#334155', marginBottom: 6 }}>
                  SUBJECT
                </Text>
                <RNTextInput
                  style={{
                    backgroundColor: '#F8FAFC',
                    borderWidth: 1,
                    borderColor: '#CBD5E1',
                    borderRadius: 12,
                    paddingHorizontal: 14,
                    paddingVertical: 10,
                    fontSize: 14,
                    color: '#0F172A',
                  }}
                  value={newSubject}
                  onChangeText={setNewSubject}
                  placeholder="Enter subject..."
                  placeholderTextColor="#94A3B8"
                />
              </View>

              <View>
                <Text style={{ fontSize: 12, fontWeight: '700', color: '#334155', marginBottom: 6 }}>
                  ORDER REF # (OPTIONAL)
                </Text>
                <RNTextInput
                  style={{
                    backgroundColor: '#F8FAFC',
                    borderWidth: 1,
                    borderColor: '#CBD5E1',
                    borderRadius: 12,
                    paddingHorizontal: 14,
                    paddingVertical: 10,
                    fontSize: 14,
                    color: '#0F172A',
                  }}
                  value={newOrderIdInput}
                  onChangeText={setNewOrderIdInput}
                  placeholder="e.g. 1042 or leave blank"
                  placeholderTextColor="#94A3B8"
                />
              </View>

              <View>
                <Text style={{ fontSize: 12, fontWeight: '700', color: '#334155', marginBottom: 6 }}>
                  MESSAGE DETAILS *
                </Text>
                <RNTextInput
                  style={{
                    backgroundColor: '#F8FAFC',
                    borderWidth: 1,
                    borderColor: '#CBD5E1',
                    borderRadius: 12,
                    paddingHorizontal: 14,
                    paddingVertical: 10,
                    fontSize: 14,
                    color: '#0F172A',
                    minHeight: 100,
                    textAlignVertical: 'top',
                  }}
                  value={newMessageText}
                  onChangeText={setNewMessageText}
                  placeholder="Describe your issue or question in detail..."
                  placeholderTextColor="#94A3B8"
                  multiline
                />
              </View>

              <Pressable
                onPress={handleStartNewEnquiry}
                disabled={isCreatingTicket || !newMessageText.trim()}
                style={{
                  backgroundColor: newMessageText.trim() ? '#15803D' : '#94A3B8',
                  borderRadius: 14,
                  paddingVertical: 14,
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexDirection: 'row',
                  gap: 8,
                  marginTop: 8,
                  shadowColor: '#15803D',
                  shadowOffset: { width: 0, height: 4 },
                  shadowOpacity: newMessageText.trim() ? 0.2 : 0,
                  shadowRadius: 6,
                  elevation: 2,
                }}
              >
                {isCreatingTicket ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <>
                    <Feather name="send" size={16} color="#FFFFFF" />
                    <Text style={{ color: '#FFFFFF', fontSize: 15, fontWeight: '800' }}>
                      Submit Support Enquiry
                    </Text>
                  </>
                )}
              </Pressable>
            </View>
          </ScrollView>
        ) : (
          /* VIEW 3: RESTAURANT SUPPORT HOME & ENQUIRIES LIST */
          <ScrollView
            style={{ flex: 1, backgroundColor: '#F8FAFC' }}
            contentContainerStyle={{ padding: 20, paddingBottom: 40 }}
          >
            {/* NEW ENQUIRY HERO LAUNCHER */}
            <Pressable
              onPress={() => setIsCreatingNew(true)}
              style={({ pressed }) => ({
                backgroundColor: '#14532D',
                borderRadius: 20,
                padding: 20,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: 20,
                shadowColor: '#14532D',
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: pressed ? 0.1 : 0.2,
                shadowRadius: 8,
                elevation: 4,
              })}
            >
              <View style={{ flex: 1, marginRight: 12 }}>
                <Text style={{ fontSize: 17, fontWeight: '800', color: '#FFFFFF' }}>
                  Have a question or issue?
                </Text>
                <Text style={{ fontSize: 13, color: '#A7F3D0', marginTop: 4, lineHeight: 18 }}>
                  Start a direct two-way chat with the Foodie Restaurant Admin team.
                </Text>
              </View>

              <View
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 22,
                  backgroundColor: '#22C55E',
                  justifyContent: 'center',
                  alignItems: 'center',
                }}
              >
                <Feather name="plus" size={24} color="#FFFFFF" />
              </View>
            </Pressable>

            {/* FILTER TABS */}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 16 }}>
              {(['OPEN', 'RESOLVED', 'ALL'] as const).map((tab) => {
                const isSelected = filterTab === tab;
                const count =
                  tab === 'OPEN'
                    ? openConversations.length
                    : tab === 'RESOLVED'
                      ? resolvedConversations.length
                      : thisRestaurantConversations.length;

                return (
                  <Pressable
                    key={tab}
                    onPress={() => setFilterTab(tab)}
                    style={{
                      paddingHorizontal: 14,
                      paddingVertical: 7,
                      borderRadius: 16,
                      backgroundColor: isSelected ? '#15803D' : '#FFFFFF',
                      borderWidth: 1,
                      borderColor: isSelected ? '#15803D' : '#E2E8F0',
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 6,
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 12,
                        fontWeight: '700',
                        color: isSelected ? '#FFFFFF' : '#475569',
                      }}
                    >
                      {tab === 'OPEN' ? 'Active Chats' : tab === 'RESOLVED' ? 'Resolved' : 'All Enquiries'}
                    </Text>
                    <View
                      style={{
                        paddingHorizontal: 6,
                        paddingVertical: 1,
                        borderRadius: 10,
                        backgroundColor: isSelected ? 'rgba(255, 255, 255, 0.25)' : '#F1F5F9',
                      }}
                    >
                      <Text
                        style={{
                          fontSize: 10,
                          fontWeight: '800',
                          color: isSelected ? '#FFFFFF' : '#475569',
                        }}
                      >
                        {count}
                      </Text>
                    </View>
                  </Pressable>
                );
              })}
            </View>

            {/* ENQUIRIES LIST */}
            {isLoadingConversations && !conversations ? (
              <View style={{ padding: 40, alignItems: 'center' }}>
                <ActivityIndicator size="small" color="#16A34A" />
                <Text style={{ fontSize: 13, color: '#64748B', marginTop: 10 }}>Loading your enquiries...</Text>
              </View>
            ) : filteredConversations.length === 0 ? (
              <View
                style={{
                  backgroundColor: '#FFFFFF',
                  borderRadius: 20,
                  padding: 36,
                  alignItems: 'center',
                  borderWidth: 1,
                  borderColor: '#E2E8F0',
                }}
              >
                <View
                  style={{
                    width: 56,
                    height: 56,
                    borderRadius: 28,
                    backgroundColor: '#F0FDF4',
                    justifyContent: 'center',
                    alignItems: 'center',
                    marginBottom: 14,
                  }}
                >
                  <Feather name="message-square" size={26} color="#16A34A" />
                </View>
                <Text style={{ fontSize: 16, fontWeight: '800', color: '#0F172A' }}>
                  {filterTab === 'OPEN'
                    ? 'No Active Chats'
                    : filterTab === 'RESOLVED'
                      ? 'No Resolved Enquiries'
                      : 'No Support Enquiries Yet'}
                </Text>
                <Text style={{ fontSize: 13, color: '#64748B', textAlign: 'center', marginTop: 6, lineHeight: 18, maxWidth: 280 }}>
                  {filterTab === 'OPEN'
                    ? 'You have no open enquiries. Need help with payouts, menu, or orders? Start a new chat with Foodie Admin.'
                    : filterTab === 'RESOLVED'
                      ? 'No resolved enquiries for this restaurant yet.'
                      : 'You have not submitted any enquiries yet. Tap the button below to start your direct conversation.'}
                </Text>

                <Pressable
                  onPress={() => setIsCreatingNew(true)}
                  style={{
                    backgroundColor: '#15803D',
                    borderRadius: 12,
                    paddingHorizontal: 20,
                    paddingVertical: 11,
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 8,
                    marginTop: 18,
                  }}
                >
                  <Feather name="plus" size={16} color="#FFFFFF" />
                  <Text style={{ color: '#FFFFFF', fontSize: 14, fontWeight: '800' }}>
                    Start New Conversation
                  </Text>
                </Pressable>
              </View>
            ) : (
              <View style={{ gap: 12 }}>
                {filteredConversations.map((item: SupportConversation) => {
                  const statusInfo = getStatusColor(item.status);
                  const lastMessageItem = item.messages && item.messages.length > 0
                    ? item.messages[item.messages.length - 1]
                    : null;
                  const lastMessageText = lastMessageItem?.content || item.subject;
                  const hasAdminReply = (item.messages || []).some(
                    (m) => m.senderType === 'AGENT' || m.senderType === 'ADMIN'
                  ) || Boolean(item.lastMessageAt);

                  return (
                    <Pressable
                      key={item.id}
                      onPress={() => setActiveEnquiryId(item.id)}
                      style={({ pressed }) => ({
                        backgroundColor: pressed ? '#F8FAFC' : '#FFFFFF',
                        borderRadius: 18,
                        padding: 16,
                        borderWidth: 1,
                        borderColor: hasAdminReply ? '#86EFAC' : '#E2E8F0',
                        shadowColor: '#000',
                        shadowOffset: { width: 0, height: 2 },
                        shadowOpacity: 0.04,
                        shadowRadius: 5,
                        elevation: 2,
                      })}
                    >
                      {/* Top Meta Row */}
                      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                          <Text style={{ fontSize: 13, fontWeight: '800', color: '#14532D' }}>
                            {item.id}
                          </Text>
                          {hasAdminReply ? (
                            <View
                              style={{
                                backgroundColor: '#DCFCE7',
                                paddingHorizontal: 8,
                                paddingVertical: 2,
                                borderRadius: 10,
                                flexDirection: 'row',
                                alignItems: 'center',
                                gap: 4,
                              }}
                            >
                              <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: '#16A34A' }} />
                              <Text style={{ fontSize: 10, fontWeight: '800', color: '#15803D' }}>
                                Admin Replied
                              </Text>
                            </View>
                          ) : null}
                        </View>

                        <Text style={{ fontSize: 11, color: '#94A3B8' }}>
                          {item.updatedAt ? new Date(item.updatedAt).toLocaleDateString() : 'Recent'}
                        </Text>
                      </View>

                      {/* Subject */}
                      <Text style={{ fontSize: 15, fontWeight: '800', color: '#0F172A', marginTop: 8 }}>
                        {getCleanSubject(item.subject)}
                      </Text>

                      {/* Message Preview */}
                      <Text
                        numberOfLines={2}
                        style={{ fontSize: 13, color: '#64748B', marginTop: 4, lineHeight: 18 }}
                      >
                        {getCleanSubject(lastMessageText)}
                      </Text>

                      {/* Bottom Footer Row */}
                      <View
                        style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          marginTop: 12,
                          paddingTop: 10,
                          borderTopWidth: 1,
                          borderTopColor: '#F1F5F9',
                        }}
                      >
                        <Text style={{ fontSize: 12, fontWeight: '700', color: '#16A34A' }}>
                          Open live chat ›
                        </Text>

                        <View
                          style={{
                            paddingHorizontal: 8,
                            paddingVertical: 2,
                            borderRadius: 8,
                            backgroundColor: statusInfo.bg,
                          }}
                        >
                          <Text style={{ fontSize: 10, fontWeight: '800', color: statusInfo.text }}>
                            {statusInfo.label}
                          </Text>
                        </View>
                      </View>
                    </Pressable>
                  );
                })}
              </View>
            )}
          </ScrollView>
        )}

        <Toast
          visible={Boolean(toast)}
          message={toast?.message ?? ''}
          variant={toast?.variant ?? 'info'}
          accessibilityLabel={toast?.message ?? 'Toast'}
          onDismiss={() => setToast(null)}
        />
      </KeyboardAvoidingView>
    </Modal>
  );
}
