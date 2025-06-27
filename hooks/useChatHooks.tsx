import {
    addUserMessage,
    BillingError,
    createThreadForProject,
    getAgentRuns,
    getMessages,
    getThreadForProject,
    initiateAgent,
    Message,
    ParsedContent,
    parseStreamContent,
    startAgent,
    stopAgent,
    streamAgent,
    Thread
} from '@/api/chat-api';
import { projectKeys } from '@/api/project-api';
import { createSupabaseClient } from '@/constants/SupabaseConfig';
import { useNewChatSessionKey, useSetCurrentTool, useSetIsGenerating, useUpdateNewChatProject } from '@/stores/ui-store';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useRef, useState } from 'react';

// Query Keys
export const chatKeys = {
    all: ['chat'] as const,
    threads: () => [...chatKeys.all, 'threads'] as const,
    thread: (projectId: string) => [...chatKeys.threads(), projectId] as const,
    messages: () => [...chatKeys.all, 'messages'] as const,
    messagesForThread: (threadId: string) => [...chatKeys.messages(), threadId] as const,
    agentRuns: () => [...chatKeys.all, 'agentRuns'] as const,
    agentRunsForThread: (threadId: string) => [...chatKeys.agentRuns(), threadId] as const,
};

// Thread Hooks
export const useThreadForProject = (projectId: string) => {
    return useQuery({
        queryKey: chatKeys.thread(projectId),
        queryFn: () => getThreadForProject(projectId),
        enabled: !!projectId && projectId !== '' && projectId !== 'new-chat-temp',
        staleTime: 5 * 60 * 1000,
        retry: 1,
    });
};

export const useCreateThreadForProject = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ projectId }: { projectId: string }) => createThreadForProject(projectId),
        onSuccess: (thread) => {
            queryClient.setQueryData(chatKeys.thread(thread.project_id), thread);
            queryClient.invalidateQueries({ queryKey: chatKeys.messagesForThread(thread.thread_id) });
        },
    });
};

// Message Hooks
export const useMessages = (threadId: string) => {
    return useQuery({
        queryKey: chatKeys.messagesForThread(threadId),
        queryFn: () => getMessages(threadId),
        enabled: !!threadId && threadId !== '',
        staleTime: 30 * 1000,
        refetchInterval: !!threadId && threadId !== '' ? 5000 : false,
        retry: 1,
    });
};

export const useAddMessage = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ threadId, content }: { threadId: string; content: string }) =>
            addUserMessage(threadId, content),
        onSuccess: (data, { threadId }) => {
            queryClient.invalidateQueries({ queryKey: chatKeys.messagesForThread(threadId) });
        },
    });
};

// Agent Hooks
export const useAgentRuns = (threadId: string) => {
    return useQuery({
        queryKey: chatKeys.agentRunsForThread(threadId),
        queryFn: () => getAgentRuns(threadId),
        enabled: !!threadId,
        staleTime: 30 * 1000,
        retry: 1,
    });
};

export const useStartAgent = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({
            threadId,
            options,
        }: {
            threadId: string;
            options?: {
                model_name?: string;
                enable_thinking?: boolean;
                reasoning_effort?: string;
                stream?: boolean;
                agent_id?: string;
            };
        }) => startAgent(threadId, options),
        onSuccess: (data, { threadId }) => {
            queryClient.invalidateQueries({ queryKey: chatKeys.agentRunsForThread(threadId) });
        },
        onError: (error) => {
            if (!(error instanceof BillingError)) {
                console.error('Failed to start agent:', error);
            }
        },
    });
};

export const useStopAgent = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (agentRunId: string) => stopAgent(agentRunId),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: chatKeys.agentRuns() });
        },
    });
};

// MINIMAL STREAM HOOK
export interface UseAgentStreamResult {
    status: 'idle' | 'connecting' | 'streaming' | 'completed' | 'error' | 'stopped';
    textContent: string;
    toolCall: ParsedContent | null;
    error: string | null;
    agentRunId: string | null;
    startStreaming: (runId: string) => void;
    stopStreaming: () => void;
    isStreaming: boolean;
}

export const useAgentStream = (threadId?: string): UseAgentStreamResult => {
    const queryClient = useQueryClient();
    const setCurrentTool = useSetCurrentTool();
    const setIsGenerating = useSetIsGenerating();

    const [status, setStatus] = useState<UseAgentStreamResult['status']>('idle');
    const [textContent, setTextContent] = useState<string>('');
    const [toolCall, setToolCall] = useState<ParsedContent | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [agentRunId, setAgentRunId] = useState<string | null>(null);

    const cleanupRef = useRef<(() => void) | null>(null);
    const isMountedRef = useRef(true);

    const finalizeStream = useCallback((finalStatus: string) => {
        if (!isMountedRef.current) return;

        if (cleanupRef.current) {
            cleanupRef.current();
            cleanupRef.current = null;
        }

        setIsGenerating(false);
        setCurrentTool(null);
        setStatus(finalStatus as UseAgentStreamResult['status']);

        // Refetch API immediately and clear stream content immediately for all cases
        if (threadId && ['completed', 'stopped', 'error'].includes(finalStatus)) {
            setToolCall(null);
            setAgentRunId(null);
            setTextContent(''); // CLEAR IMMEDIATELY - no delay
            queryClient.invalidateQueries({ queryKey: chatKeys.messagesForThread(threadId) });
        }
    }, [queryClient, threadId, setIsGenerating, setCurrentTool]);

    const handleStreamMessage = useCallback((rawData: string) => {
        if (!isMountedRef.current) return;

        let processedData = rawData;
        if (processedData.startsWith('data: ')) {
            processedData = processedData.substring(6).trim();
        }
        if (!processedData) return;

        // Check for completion
        if (processedData.includes('Run data not available for streaming') ||
            processedData.includes('Stream ended with status: completed') ||
            processedData.includes('"status": "completed"')) {
            finalizeStream('completed');
            return;
        }

        try {
            const jsonData = JSON.parse(processedData);
            console.log(`[STREAM] Received message type: ${jsonData.type}, status: ${jsonData.status || 'none'}`);

            if (jsonData.status === 'error') {
                console.log(`[STREAM ERROR] Error message: ${jsonData.message}`);
                setError(jsonData.message || 'Unknown error occurred');
                return;
            }

            if (jsonData.status === 'completed') {
                // Use a ref or get current value to check if we received content
                setTextContent(currentContent => {
                    if (!currentContent || currentContent.length === 0) {
                        console.log('[STREAM ERROR] Stream completed but no content was received!');
                        setError('No response received from agent');
                        finalizeStream('error');
                    } else {
                        console.log(`[STREAM] Stream completed successfully with ${currentContent.length} characters`);
                        finalizeStream('completed');
                    }
                    return currentContent; // Don't change the content
                });
                return;
            }

            const parsedContent = JSON.parse(jsonData.content || '{}');
            const parsedMetadata = JSON.parse(jsonData.metadata || '{}');

            if (status !== 'streaming') {
                setStatus('streaming');
                setIsGenerating(true);
            }

            switch (jsonData.type) {
                case 'assistant':
                    if (parsedMetadata.stream_status === 'chunk' && parsedContent.content) {
                        console.log(`[STREAM] Adding chunk: "${parsedContent.content.substring(0, 50)}..."`);
                        setTextContent(prev => prev + parsedContent.content);
                    } else if (!parsedMetadata.stream_status && parsedContent.content) {
                        console.log(`[STREAM] Adding content: "${parsedContent.content.substring(0, 50)}..."`);
                        setTextContent(prev => prev + parsedContent.content);
                    } else {
                        console.log(`[STREAM] Assistant message with no content - metadata: ${JSON.stringify(parsedMetadata)}, content: ${JSON.stringify(parsedContent)}`);
                    }
                    break;

                case 'status':
                    switch (parsedContent.status_type) {
                        case 'tool_started':
                            const toolInfo = {
                                type: 'tool_call' as const,
                                content: `Tool: ${parsedContent.function_name || 'Unknown'}`,
                                role: 'assistant' as const,
                                status_type: 'tool_started',
                                name: parsedContent.function_name,
                                arguments: parsedContent.arguments,
                                xml_tag_name: parsedContent.xml_tag_name,
                                tool_index: parsedContent.tool_index,
                            };
                            setToolCall(toolInfo);
                            setCurrentTool({
                                id: `tool-${parsedContent.tool_index || 'unknown'}`,
                                name: parsedContent.function_name || 'Unknown Tool',
                                isActive: true,
                                data: parsedContent.arguments,
                            });
                            break;
                        case 'tool_completed':
                        case 'tool_failed':
                        case 'tool_error':
                            if (toolCall?.tool_index === parsedContent.tool_index) {
                                setToolCall(null);
                                setCurrentTool(null);
                            }
                            break;
                        case 'thread_run_end':
                            finalizeStream('completed');
                            return;
                        case 'error':
                            setError(parsedContent.message || 'Agent run failed');
                            finalizeStream('error');
                            return;
                    }
                    break;
            }
        } catch (parseError) {
            const parsed = parseStreamContent(processedData);
            if (parsed?.type === 'text') {
                setTextContent(prev => prev + parsed.content);
            }
        }
    }, [status, toolCall, finalizeStream, setIsGenerating, setCurrentTool]);

    const startStreaming = useCallback((runId: string) => {
        if (!isMountedRef.current) return;

        if (cleanupRef.current) {
            cleanupRef.current();
            cleanupRef.current = null;
        }

        setStatus('connecting');
        setTextContent('');
        setToolCall(null);
        setError(null);
        setAgentRunId(runId);
        setIsGenerating(true);

        const cleanup = streamAgent(runId, {
            onMessage: handleStreamMessage,
            onError: (err) => {
                if (!isMountedRef.current) return;
                const errorMessage = err instanceof Error ? err.message : String(err);
                setError(errorMessage);
                finalizeStream('error');
            },
            onClose: () => {
                if (!isMountedRef.current) return;
                if (status === 'streaming' || status === 'connecting') {
                    finalizeStream('completed');
                }
            },
        });

        cleanupRef.current = cleanup;
    }, [handleStreamMessage, finalizeStream, setIsGenerating, status]);

    const stopStreaming = useCallback(() => {
        if (cleanupRef.current) {
            cleanupRef.current();
            cleanupRef.current = null;
        }
        finalizeStream('stopped');
    }, [finalizeStream]);

    useEffect(() => {
        isMountedRef.current = true;
        return () => {
            isMountedRef.current = false;
            if (cleanupRef.current) {
                cleanupRef.current();
            }
            setIsGenerating(false);
            setCurrentTool(null);
        };
    }, [setIsGenerating, setCurrentTool]);

    return {
        status,
        textContent,
        toolCall,
        error,
        agentRunId,
        startStreaming,
        stopStreaming,
        isStreaming: status === 'streaming' || status === 'connecting',
    };
};

// WORKING FRONTEND PATTERNS - FROM YOUR CODE
export const useChatSession = (projectId: string) => {
    const isNewChat = projectId === 'new-chat-temp';
    const sessionKey = useNewChatSessionKey();

    // State
    const [threadId, setThreadId] = useState<string | null>(null);
    const [messages, setMessages] = useState<Message[]>([]);
    const [isInitialized, setIsInitialized] = useState(false);
    const [isSending, setIsSending] = useState(false);
    const [processedMessageIds] = useState<Set<string>>(new Set()); // BULLETPROOF DEDUPLICATION

    // Reset on session change (for new chat)
    useEffect(() => {
        if (isNewChat) {
            console.log(`[MESSAGE COUNT] Session reset - clearing all messages`);
            setThreadId(null);
            setMessages([]);
            setIsInitialized(false);
            setIsSending(false);
            processedMessageIds.clear(); // Clear processed IDs
        }
    }, [sessionKey, isNewChat, processedMessageIds]);

    // Hooks
    const queryClient = useQueryClient();
    const { data: thread, isLoading: threadLoading } = useThreadForProject(isNewChat ? '' : projectId);
    const createThread = useCreateThreadForProject();
    const { data: rawApiMessages = [], isLoading: messagesLoading } = useMessages(threadId || thread?.thread_id || '');
    const addMessage = useAddMessage();
    const startAgentMutation = useStartAgent();
    const stopAgentMutation = useStopAgent();
    const agentStream = useAgentStream(threadId || thread?.thread_id);
    const setIsGenerating = useSetIsGenerating();
    const updateNewChatProject = useUpdateNewChatProject();

    // WORKING PATTERN: Handle new messages from stream
    const handleNewMessageFromStream = useCallback((message: Message) => {
        // BULLETPROOF DEDUPLICATION - Never process same message twice
        if (processedMessageIds.has(message.message_id)) {
            console.log(`[BULLETPROOF] Skipping already processed message: ${message.message_id}`);
            return;
        }

        // Mark as processed immediately
        processedMessageIds.add(message.message_id);
        console.log(`[BULLETPROOF] Processing new message: ${message.message_id}`);

        setMessages((prev) => {
            if (!prev) prev = [];
            const prevCount = prev.length;

            // LEVEL 1: OPTIMISTIC USER MESSAGE REPLACEMENT (for temp messages only)
            if (message.type === 'user') {
                // Extract actual content value for comparison (not JSON formatting)
                const extractContentValue = (content: any) => {
                    if (typeof content === 'string') {
                        try {
                            const parsed = JSON.parse(content);
                            return parsed.content || content; // Extract inner content if it's {"role": "user", "content": "Hi"}
                        } catch {
                            return content; // If not JSON, return as-is
                        }
                    } else if (content && typeof content === 'object') {
                        return content.content || JSON.stringify(content);
                    }
                    return String(content);
                };

                const realContentValue = extractContentValue(message.content);
                console.log(`[CONTENT CHECK] Real message content length: ${realContentValue.length}, preview: "${realContentValue.substring(0, 100)}..."`);

                // Find the MOST RECENT optimistic message with matching content (not the first one!)
                let optimisticIndex = -1;
                for (let i = prev.length - 1; i >= 0; i--) {
                    const m = prev[i];
                    if (!m.message_id.startsWith('temp-user-') || m.type !== 'user') {
                        continue;
                    }

                    const optimisticContentValue = extractContentValue(m.content);
                    console.log(`[CONTENT CHECK] Checking optimistic at index ${i}, content length: ${optimisticContentValue.length}, preview: "${optimisticContentValue.substring(0, 100)}..."`);

                    const matches = optimisticContentValue === realContentValue;
                    if (matches) {
                        console.log(`[CONTENT MATCH] Found matching optimistic message at index ${i}`);
                        optimisticIndex = i;
                        break; // Found the most recent match, stop searching
                    } else {
                        console.log(`[CONTENT MISMATCH] Optimistic: "${optimisticContentValue}" vs Real: "${realContentValue}"`);
                    }
                }

                if (optimisticIndex !== -1) {
                    console.log(`[BULLETPROOF] ✅ REPLACED optimistic user message at index ${optimisticIndex}`);
                    const newMessages = [...prev];
                    newMessages[optimisticIndex] = message;      // REPLACE OPTIMISTIC
                    console.log(`[MESSAGE COUNT] Replaced optimistic: ${prevCount} → ${newMessages.length}`);

                    // Debug final order after replacement
                    const orderDebug = newMessages.map((m, i) => `${i}:${m.type}:${m.message_id.substring(0, 8)}`).join(' | ');
                    console.log(`[MESSAGE ARRAY ORDER AFTER REPLACE]: ${orderDebug}`);

                    return newMessages;
                }
            }

            // LEVEL 2: ADD NEW MESSAGE (all other cases)
            const newMessages = [...prev, message];
            console.log(`[MESSAGE COUNT] Added new message: ${prevCount} → ${newMessages.length} (${message.type}: ${message.message_id})`);

            // Debug final order
            const orderDebug = newMessages.map((m, i) => `${i}:${m.type}:${m.message_id.substring(0, 8)}`).join(' | ');
            console.log(`[MESSAGE ARRAY ORDER]: ${orderDebug}`);

            return newMessages;
        });
    }, [processedMessageIds]);

    // Sync API messages to local state - WITH DETAILED LOGGING
    useEffect(() => {
        if (rawApiMessages.length > 0) {
            console.log(`[SYNC] API returned ${rawApiMessages.length} messages, current local count: ${messages.length}`);
            const newMessages: string[] = [];
            const skippedMessages: string[] = [];

            rawApiMessages.forEach(msg => {
                if (!processedMessageIds.has(msg.message_id)) {
                    newMessages.push(msg.message_id);
                    handleNewMessageFromStream(msg);
                } else {
                    skippedMessages.push(msg.message_id);
                }
            });

            if (newMessages.length > 0) {
                console.log(`[SYNC] Processed ${newMessages.length} new messages: ${newMessages.join(', ')}`);
            }
            if (skippedMessages.length > 0) {
                console.log(`[SYNC] Skipped ${skippedMessages.length} already processed messages`);
            }
        }
    }, [rawApiMessages, handleNewMessageFromStream, messages.length, processedMessageIds]);

    // Thread info for new chat
    const { data: threadInfo } = useQuery({
        queryKey: ['thread', threadId],
        queryFn: async () => {
            if (!threadId || !isNewChat) return null;
            const supabase = createSupabaseClient();
            const { data } = await supabase
                .from('threads')
                .select(`*, projects!inner(*)`)
                .eq('thread_id', threadId)
                .single();
            return data;
        },
        enabled: !!threadId && isNewChat && isInitialized,
        staleTime: Infinity,
    });

    // Update new chat project
    useEffect(() => {
        if (threadInfo?.projects && isNewChat) {
            const projectData = threadInfo.projects;
            updateNewChatProject({
                id: projectData.project_id,
                name: projectData.name || 'Untitled Project',
                description: projectData.description || '',
                account_id: projectData.account_id,
                created_at: projectData.created_at,
                updated_at: projectData.updated_at,
                sandbox: projectData.sandbox || {},
            });
            queryClient.invalidateQueries({ queryKey: projectKeys.lists() });
        }
    }, [threadInfo, updateNewChatProject, queryClient, isNewChat]);

    // WORKING PATTERN: Send message with optimistic updates
    const sendMessage = useCallback(async (content: string, files?: any[]) => {
        if (!content.trim()) return;

        // FIX RACE CONDITION - Set isSending IMMEDIATELY
        if (isSending) {
            console.log('[SEND MESSAGE] Already sending, ignoring duplicate send');
            return;
        }
        setIsSending(true);
        setIsGenerating(true);

        // CONSTRUCT OPTIMISTIC CONTENT TO MATCH API FORMAT
        let optimisticContent = content;
        if (files && files.length > 0) {
            // Add file info to match what API returns - SINGLE newline, not double!
            const fileInfo = files.map(file => `[Uploaded File: /workspace/${file.name}]`).join('\n');
            optimisticContent = `${content}\n${fileInfo}`; // FIX: Single \n not \n\n
        }

        const optimisticUserMessage: Message = {
            message_id: `temp-user-${Date.now()}-${Math.random()}`,  // UNIQUE temp-user- PREFIX
            thread_id: threadId || 'temp',
            type: 'user',
            is_llm_message: false,
            content: { role: 'user', content: optimisticContent },  // MATCH API FORMAT WITH FILES
            metadata: files ? { cached_files: files } : {},
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
        };

        setMessages((prev) => {
            const newCount = prev.length + 1;
            console.log(`[MESSAGE COUNT] Added optimistic message: ${prev.length} → ${newCount} (${optimisticUserMessage.message_id})`);
            const newMessages = [...prev, optimisticUserMessage];

            // Debug optimistic message order
            const orderDebug = newMessages.map((m, i) => `${i}:${m.type}:${m.message_id.substring(0, 8)}`).join(' | ');
            console.log(`[OPTIMISTIC ARRAY ORDER]: ${orderDebug}`);

            return newMessages;
        });

        try {
            if (isNewChat && !threadId) {
                // New chat - initialize
                if (!isInitialized) {
                    updateNewChatProject({
                        id: 'new-chat-temp',
                        name: 'New Chat',
                        description: 'Temporary project for new chat',
                        account_id: '',
                        sandbox: {},
                    });
                    setIsInitialized(true);
                }

                const result = await initiateAgent(content.trim(), {
                    stream: true,
                    enable_context_manager: true,
                    files: files
                });

                setThreadId(result.thread_id);
                // DON'T set isSending to false here - let stream starting handle it
                agentStream.startStreaming(result.agent_run_id);
            } else {
                // Existing thread
                const currentThreadId = threadId || thread?.thread_id;
                if (!currentThreadId) {
                    // Create thread first
                    const newThread = await createThread.mutateAsync({ projectId });
                    await addMessage.mutateAsync({
                        threadId: newThread.thread_id,
                        content: content.trim(),
                    });
                    const result = await startAgentMutation.mutateAsync({
                        threadId: newThread.thread_id,
                    });
                    setIsSending(false);
                    agentStream.startStreaming(result.agent_run_id);
                } else {
                    const messagePromise = addMessage.mutateAsync({
                        threadId: currentThreadId,
                        content: content.trim(),
                    });
                    const agentPromise = startAgentMutation.mutateAsync({
                        threadId: currentThreadId,
                    });
                    const results = await Promise.allSettled([messagePromise, agentPromise]);

                    if (results[0].status === 'rejected') {
                        throw new Error(`Failed to send message: ${results[0].reason?.message || results[0].reason}`);
                    }
                    if (results[1].status === 'rejected') {
                        const error = results[1].reason;
                        if (error instanceof BillingError) {
                            // Handle billing error - REMOVE optimistic message
                            setMessages(prev => {
                                const filtered = prev.filter(m => m.message_id !== optimisticUserMessage.message_id);
                                console.log(`[MESSAGE COUNT] Removed optimistic (billing error): ${prev.length} → ${filtered.length}`);
                                return filtered;
                            });
                            setIsSending(false);
                            setIsGenerating(false);
                            return;
                        }
                        throw new Error(`Failed to start agent: ${error?.message || error}`);
                    }

                    const agentResult = results[1].value;
                    // DON'T set isSending to false here - let stream starting handle it
                    agentStream.startStreaming(agentResult.agent_run_id);
                }
            }
        } catch (error) {
            console.error('[ERROR] Failed to send message:', error);
            // ERROR FALLBACK - Transform message ID instead of removing
            setMessages((prev) => {
                const updated = prev.map((m) =>
                    m.message_id === optimisticUserMessage.message_id
                        ? { ...m, message_id: `user-error-${Date.now()}` }
                        : m
                );
                console.log(`[MESSAGE COUNT] Transformed optimistic to error: ${prev.length} → ${updated.length}`);
                return updated;
            });
            setIsSending(false);
            setIsGenerating(false);
            throw error;
        }
    }, [threadId, thread, isNewChat, isInitialized, isSending, agentStream, addMessage, startAgentMutation, createThread, projectId, setIsGenerating, updateNewChatProject]);

    // Clear isSending when stream actually starts OR after timeout
    useEffect(() => {
        if (['streaming', 'connecting'].includes(agentStream.status) && isSending) {
            console.log('[STREAM STATE] Stream started, clearing isSending');
            setIsSending(false);
        }
    }, [agentStream.status, isSending]);

    // Failsafe: Clear isSending after 5 seconds to prevent getting stuck
    useEffect(() => {
        if (isSending) {
            const timeout = setTimeout(() => {
                console.log('[FAILSAFE] Clearing isSending after 5 second timeout');
                setIsSending(false);
            }, 5000);
            return () => clearTimeout(timeout);
        }
    }, [isSending]);

    const stopAgent = useCallback(() => {
        agentStream.stopStreaming();
        setIsGenerating(false);
        setIsSending(false);
        if (agentStream.agentRunId) {
            stopAgentMutation.mutate(agentStream.agentRunId);
        }
    }, [agentStream, stopAgentMutation, setIsGenerating]);

    return {
        thread: thread || (threadId ? { thread_id: threadId } : null),
        messages,
        threadId: threadId || thread?.thread_id,
        isInitialized: isNewChat ? isInitialized : true,
        isLoading: threadLoading || messagesLoading,
        isLoadingThread: threadLoading,
        isLoadingMessages: messagesLoading,
        sendMessage,
        stopAgent,
        isGenerating: agentStream.isStreaming || isSending || ['connecting', 'streaming'].includes(agentStream.status) || (agentStream.agentRunId && !['completed', 'error', 'stopped', 'idle'].includes(agentStream.status)),
        streamStatus: agentStream.status,
        streamContent: agentStream.textContent,
        streamError: agentStream.error,
        isSending,
    };
};

// For backward compatibility
export const useNewChatSession = () => {
    return useChatSession('new-chat-temp');
};

// Utility hook to get or create thread for project
export const useEnsureThread = (projectId: string) => {
    const { data: thread, isLoading } = useThreadForProject(projectId);
    const createThread = useCreateThreadForProject();

    const ensureThread = useCallback(async (): Promise<Thread> => {
        if (thread) {
            return thread;
        }
        const newThread = await createThread.mutateAsync({ projectId });
        return newThread;
    }, [thread, createThread, projectId]);

    return {
        thread,
        isLoading: isLoading || createThread.isPending,
        ensureThread,
    };
}; 