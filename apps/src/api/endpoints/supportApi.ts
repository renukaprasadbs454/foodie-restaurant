import { baseApi } from '../baseApi';

export interface SupportConversation {
    id: string;
    customerId?: string;
    restaurantId?: string;
    restaurantName?: string;
    assignedAgentId?: string;
    status: 'OPEN' | 'IN_PROGRESS' | 'WAITING_FOR_AGENT' | 'ASSIGNED' | 'AGENT_ACTIVE' | 'RESOLVED' | 'CLOSED';
    category: string;
    subject: string;
    orderId?: string;
    createdAt: string;
    updatedAt: string;
    lastMessageAt?: string;
    resolvedAt?: string;
    closedAt?: string;
    messages?: SupportMessage[];
}

export interface SupportMessage {
    id: string;
    conversationId: string;
    senderType: 'RESTAURANT' | 'AGENT' | 'ADMIN' | 'SYSTEM' | 'AI' | 'CUSTOMER';
    senderId?: string;
    senderName: string;
    messageType?: string;
    content: string;
    createdAt: string;
    readAt?: string;
    readStatus?: boolean;
}

export const supportApi = baseApi.injectEndpoints({
    endpoints: (builder) => ({
        getMyConversations: builder.query<SupportConversation[], void>({
            query: () => ({ url: '/api/v1/support/conversations' }),
            transformResponse: (response: any) => {
                const data = response?.data ?? response;
                return Array.isArray(data) ? data : [];
            },
            providesTags: ['SupportConversation'],
        }),
        createTicket: builder.mutation<SupportConversation, { subject: string; message: string; orderId?: string; restaurantName?: string; restaurantId?: string }>({
            async queryFn(arg, _api, _extraOptions, baseQuery) {
                const cleanedOrderId = arg.orderId && arg.orderId.trim() ? arg.orderId.trim() : null;
                const restName = (arg.restaurantName || 'Restaurant Partner').trim();
                const rawSubject = (arg.subject || 'Restaurant Support Enquiry').trim();
                const taggedSubject = rawSubject.startsWith(`[${restName}]`)
                    ? rawSubject
                    : `[${restName}] ${rawSubject}`;

                // 1. Create conversation on /api/v1/support/conversations
                const createRes = await baseQuery({
                    url: '/api/v1/support/conversations',
                    method: 'POST',
                    body: {
                        category: 'RESTAURANT',
                        subject: taggedSubject,
                        orderId: cleanedOrderId,
                        restaurantId: arg.restaurantId,
                        restaurantName: restName,
                    },
                });

                if (createRes.error) {
                    return { error: createRes.error as any };
                }

                const rawData = (createRes.data as any)?.data ?? createRes.data;
                const conv = rawData as SupportConversation;

                // 2. Attach initial message
                if (conv?.id && arg.message && arg.message.trim()) {
                    try {
                        await baseQuery({
                            url: `/api/v1/support/conversations/${conv.id}/messages`,
                            method: 'POST',
                            body: {
                                message: arg.message.trim(),
                                senderName: restName,
                                senderType: 'RESTAURANT',
                            },
                        });
                    } catch (e) {
                        console.warn('[SupportApi] Failed to post initial message:', e);
                    }
                }

                // 3. Escalate to live agent
                if (conv?.id) {
                    try {
                        await baseQuery({
                            url: `/api/v1/support/conversations/${conv.id}/escalate`,
                            method: 'POST',
                        });
                    } catch (e) {}
                }

                return { data: conv };
            },
            invalidatesTags: ['SupportConversation'],
        }),
        createOrGetConversation: builder.mutation<SupportConversation, { category?: string; subject?: string; orderId?: string; message?: string; restaurantName?: string; restaurantId?: string }>({
            async queryFn(arg, _api, _extraOptions, baseQuery) {
                const cleanedOrderId = arg.orderId && arg.orderId.trim() ? arg.orderId.trim() : null;
                const restName = (arg.restaurantName || 'Restaurant Partner').trim();
                const rawSubject = (arg.subject || 'Restaurant Support Enquiry').trim();
                const taggedSubject = rawSubject.startsWith(`[${restName}]`)
                    ? rawSubject
                    : `[${restName}] ${rawSubject}`;

                const createRes = await baseQuery({
                    url: '/api/v1/support/conversations',
                    method: 'POST',
                    body: {
                        category: arg.category || 'RESTAURANT',
                        subject: taggedSubject,
                        orderId: cleanedOrderId,
                        restaurantId: arg.restaurantId,
                        restaurantName: restName,
                    },
                });

                if (createRes.error) {
                    return { error: createRes.error as any };
                }

                const rawData = (createRes.data as any)?.data ?? createRes.data;
                const conv = rawData as SupportConversation;

                if (conv?.id && arg.message && arg.message.trim()) {
                    try {
                        await baseQuery({
                            url: `/api/v1/support/conversations/${conv.id}/messages`,
                            method: 'POST',
                            body: {
                                message: arg.message.trim(),
                                senderName: restName,
                                senderType: 'RESTAURANT',
                            },
                        });
                    } catch (e) {
                        console.warn('[SupportApi] Failed to post initial message:', e);
                    }
                }

                return { data: conv };
            },
            invalidatesTags: ['SupportConversation'],
        }),
        getMessages: builder.query<SupportMessage[], string>({
            query: (id) => ({ url: `/api/v1/support/conversations/${id}/messages` }),
            transformResponse: (response: any) => {
                const data = response?.data ?? response;
                return Array.isArray(data) ? data : [];
            },
            providesTags: (_result, _error, id) => [{ type: 'SupportMessage', id }],
        }),
        sendMessage: builder.mutation<SupportMessage, { conversationId: string; message: string; senderName?: string; senderType?: string }>({
            query: (arg) => ({
                url: `/api/v1/support/conversations/${arg.conversationId}/messages`,
                method: 'POST',
                body: {
                    message: arg.message.trim(),
                    senderName: arg.senderName || 'Restaurant Partner',
                    senderType: arg.senderType || 'RESTAURANT',
                },
            }),
            transformResponse: (response: any) => response?.data ?? response,
            invalidatesTags: (_result, _error, { conversationId }) => [
                { type: 'SupportMessage', id: conversationId },
                'SupportConversation',
            ],
        }),
        escalateConversation: builder.mutation<SupportConversation, string>({
            query: (id) => ({
                url: `/api/v1/support/conversations/${id}/escalate`,
                method: 'POST',
            }),
            invalidatesTags: ['SupportConversation', 'SupportMessage'],
        }),
        resolveConversation: builder.mutation<SupportConversation, string>({
            query: (id) => ({
                url: `/api/v1/support/conversations/${id}/resolve`,
                method: 'PUT',
            }),
            invalidatesTags: ['SupportConversation'],
        }),
        syncLegacyChat: builder.mutation<SupportConversation, any>({
            query: (body) => ({
                url: `/api/v1/support/conversations/sync`,
                method: 'POST',
                body,
            }),
            invalidatesTags: ['SupportConversation', 'SupportMessage'],
        }),
    }),
});

export const {
    useGetMyConversationsQuery,
    useCreateOrGetConversationMutation,
    useCreateTicketMutation,
    useEscalateConversationMutation,
    useGetMessagesQuery,
    useSendMessageMutation,
    useResolveConversationMutation,
    useSyncLegacyChatMutation,
} = supportApi;
