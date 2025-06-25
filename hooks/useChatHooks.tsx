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
import { useSetCurrentTool, useSetIsGenerating, useUpdateNewChatProject } from '@/stores/ui-store';
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
        staleTime: 5 * 60 * 1000, // 5 minutes
        retry: 1,
    });
};

export const useCreateThreadForProject = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ projectId }: { projectId: string }) =>
            createThreadForProject(projectId),
        onSuccess: (thread) => {
            // Update the thread cache
            queryClient.setQueryData(chatKeys.thread(thread.project_id), thread);
            // Invalidate messages for this thread to ensure fresh state
            queryClient.invalidateQueries({ queryKey: chatKeys.messagesForThread(thread.thread_id) });
        },
        onError: (error) => {
            console.error('Failed to create thread:', error);
        },
    });
};

// Message Hooks
export const useMessages = (threadId: string) => {
    return useQuery({
        queryKey: chatKeys.messagesForThread(threadId),
        queryFn: () => getMessages(threadId),
        enabled: !!threadId && threadId !== '',
        staleTime: 30 * 1000, // 30 seconds
        refetchInterval: !!threadId && threadId !== '' ? 5000 : false,
        retry: 1,
    });
};

export const useAddMessage = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ threadId, content }: { threadId: string; content: string }) =>
            addUserMessage(threadId, content),
        onMutate: async ({ threadId, content }) => {
            // Cancel outgoing refetches
            await queryClient.cancelQueries({ queryKey: chatKeys.messagesForThread(threadId) });

            // Snapshot previous value
            const previousMessages = queryClient.getQueryData<Message[]>(
                chatKeys.messagesForThread(threadId)
            );

            // Optimistically update
            const optimisticMessage: Message = {
                message_id: `temp-${Date.now()}`,
                thread_id: threadId,
                type: 'user',
                is_llm_message: true,
                content: JSON.stringify({ role: 'user', content }),
                metadata: {},
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
            };

            queryClient.setQueryData<Message[]>(
                chatKeys.messagesForThread(threadId),
                (old) => [...(old || []), optimisticMessage]
            );

            return { previousMessages };
        },
        onError: (err, { threadId }, context) => {
            // Rollback on error
            if (context?.previousMessages) {
                queryClient.setQueryData(chatKeys.messagesForThread(threadId), context.previousMessages);
            }
            console.error('Failed to add message:', err);
        },
        onSettled: (data, error, { threadId }) => {
            // Always refetch to get the real data
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
        staleTime: 30 * 1000, // 30 seconds
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
            // Invalidate agent runs to show the new run
            queryClient.invalidateQueries({ queryKey: chatKeys.agentRunsForThread(threadId) });
            console.log('[HOOK] Agent started successfully:', data.agent_run_id);
        },
        onError: (error) => {
            if (error instanceof BillingError) {
                console.error('[HOOK] Billing error starting agent:', error);
                // Don't throw billing errors - let the UI handle them
                return;
            }
            console.error('[HOOK] Failed to start agent:', error);
        },
    });
};

export const useStopAgent = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (agentRunId: string) => stopAgent(agentRunId),
        onSuccess: (data, agentRunId) => {
            // Invalidate all agent runs to reflect the stopped state
            queryClient.invalidateQueries({ queryKey: chatKeys.agentRuns() });
            console.log('[HOOK] Agent stopped successfully:', agentRunId);
        },
        onError: (error) => {
            console.error('[HOOK] Failed to stop agent:', error);
        },
    });
};

// Helper to safely parse JSON
const safeJsonParse = <T,>(str: string, fallback: T): T => {
    try {
        return JSON.parse(str);
    } catch {
        return fallback;
    }
};

// Streaming Hook - Based on web frontend patterns
// This hook manages real-time AI agent streaming with:
// - Server-Sent Events (SSE) via EventSource
// - Message parsing for text chunks and tool calls
// - UI state management (isGenerating, currentTool)
// - Auto-refetch of messages on completion
// - Proper cleanup and error handling
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
    const [textContent, setTextContent] = useState<{ content: string; sequence?: number }[]>([]);
    const [toolCall, setToolCall] = useState<ParsedContent | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [agentRunId, setAgentRunId] = useState<string | null>(null);
    const cleanupRef = useRef<(() => void) | null>(null);
    const isMountedRef = useRef(true);
    const currentRunIdRef = useRef<string | null>(null);
    const streamTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Convert ordered text content to string
    const orderedTextContent = textContent
        .sort((a, b) => (a.sequence || 0) - (b.sequence || 0))
        .reduce((acc, curr) => acc + curr.content, '');

    const finalizeStream = useCallback((finalStatus: string, runId?: string) => {
        if (!isMountedRef.current) return;

        console.log(`[useAgentStream] Finalizing stream with status: ${finalStatus}`);

        // Clear any pending timeout
        if (streamTimeoutRef.current) {
            clearTimeout(streamTimeoutRef.current);
            streamTimeoutRef.current = null;
        }

        if (cleanupRef.current) {
            cleanupRef.current();
            cleanupRef.current = null;
        }

        // Update UI store immediately to stop thinking indicator
        setIsGenerating(false);
        setCurrentTool(null);

        // Set status to completed immediately so isStreaming becomes false
        setStatus(finalStatus as UseAgentStreamResult['status']);

        // Reset streaming state after a short delay to show final streaming content
        setTimeout(() => {
            if (!isMountedRef.current) return;
            console.log(`[useAgentStream] Clearing streaming content`);
            setTextContent([]);
            setToolCall(null);
            setAgentRunId(null);
            currentRunIdRef.current = null;
        }, 300); // Shorter delay

        // Refetch messages after a delay so users see the streaming effect
        if (threadId && ['completed', 'stopped', 'error'].includes(finalStatus)) {
            setTimeout(() => {
                if (!isMountedRef.current) return;
                console.log(`[useAgentStream] Refetching messages for thread ${threadId}`);
                queryClient.invalidateQueries({ queryKey: chatKeys.messagesForThread(threadId) });
            }, 800); // Shorter delay
        }
    }, [queryClient, threadId, setIsGenerating, setCurrentTool]);

    // Set up stream timeout to prevent infinite loading
    const resetStreamTimeout = useCallback(() => {
        if (streamTimeoutRef.current) {
            clearTimeout(streamTimeoutRef.current);
        }

        // Set 30 second timeout for stuck streams
        streamTimeoutRef.current = setTimeout(() => {
            if (!isMountedRef.current) return;
            console.warn('[useAgentStream] Stream timeout - forcing completion');
            setError('Stream timed out');
            finalizeStream('error');
        }, 30000); // 30 seconds
    }, [finalizeStream]);

    const handleStreamMessage = useCallback((rawData: string) => {
        if (!isMountedRef.current) return;

        // Reset timeout on each message
        resetStreamTimeout();

        console.log(`[useAgentStream] Received raw data:`, rawData.substring(0, 200) + '...');

        let processedData = rawData;
        if (processedData.startsWith('data: ')) {
            processedData = processedData.substring(6).trim();
        }
        if (!processedData) return;

        // Check for completion messages
        if (processedData.includes('Run data not available for streaming') ||
            processedData.includes('Stream ended with status: completed') ||
            processedData.includes('"status": "completed"')) {
            console.log('[useAgentStream] Detected completion message');
            finalizeStream('completed');
            return;
        }

        try {
            const jsonData = JSON.parse(processedData);
            console.log(`[useAgentStream] Parsed JSON:`, {
                type: jsonData.type,
                sequence: jsonData.sequence,
                hasContent: !!jsonData.content,
                hasMetadata: !!jsonData.metadata
            });

            // Handle status messages
            if (jsonData.status === 'error') {
                console.error('[useAgentStream] Received error status:', jsonData);
                const errorMessage = jsonData.message || 'Unknown error occurred';
                setError(errorMessage);
                return;
            }

            if (jsonData.status === 'completed') {
                console.log('[useAgentStream] Received completion status');
                finalizeStream('completed');
                return;
            }

            // Parse as unified message
            const parsedContent = safeJsonParse<any>(jsonData.content || '{}', {});
            const parsedMetadata = safeJsonParse<any>(jsonData.metadata || '{}', {});

            console.log(`[useAgentStream] Parsed content:`, {
                streamStatus: parsedMetadata.stream_status,
                contentText: parsedContent.content?.substring(0, 50) + '...'
            });

            // Update status to streaming if we receive valid content
            if (status !== 'streaming') {
                console.log('[useAgentStream] Setting status to streaming');
                setStatus('streaming');
                setIsGenerating(true);
            }

            switch (jsonData.type) {
                case 'assistant':
                    if (parsedMetadata.stream_status === 'chunk' && parsedContent.content) {
                        // Real-time streaming: add each chunk immediately
                        console.log('[useAgentStream] Received text chunk:', parsedContent.content);
                        setTextContent(prev => {
                            const newContent = prev.concat({
                                sequence: jsonData.sequence || 0,
                                content: parsedContent.content,
                            });
                            const totalText = newContent.map(c => c.content).join('');
                            console.log('[useAgentStream] Total accumulated text length:', totalText.length);
                            return newContent;
                        });
                    } else if (parsedMetadata.stream_status === 'complete') {
                        // Stream completed - DON'T clear streaming text immediately
                        console.log('[useAgentStream] Assistant message complete - keeping text visible');
                        // Don't clear text here, let finalizeStream handle it with delay
                    } else if (!parsedMetadata.stream_status && parsedContent.content) {
                        // Handle non-streaming assistant messages
                        console.log('[useAgentStream] Received non-streaming assistant content:', parsedContent.content);
                        setTextContent(prev => prev.concat({
                            sequence: jsonData.sequence || 0,
                            content: parsedContent.content,
                        }));
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

                            // Update UI store with current tool
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
                            console.log('[useAgentStream] Received thread run end');
                            finalizeStream('completed');
                            return;
                        case 'error':
                            console.error('[useAgentStream] Status error:', parsedContent.message);
                            setError(parsedContent.message || 'Agent run failed');
                            finalizeStream('error');
                            return;
                    }
                    break;
            }
        } catch (parseError) {
            // Try basic content parsing for non-JSON messages
            const parsed = parseStreamContent(processedData);
            if (parsed?.type === 'text') {
                setTextContent(prev => prev.concat({ content: parsed.content, sequence: 0 }));
            }
        }
    }, [status, toolCall, finalizeStream, setIsGenerating, setCurrentTool, resetStreamTimeout]);

    const handleStreamError = useCallback((err: Error | string) => {
        if (!isMountedRef.current) return;

        const errorMessage = err instanceof Error ? err.message : String(err);
        console.error('[useAgentStream] Stream error:', errorMessage);
        setError(errorMessage);
        finalizeStream('error');
    }, [finalizeStream]);

    const handleStreamClose = useCallback(() => {
        if (!isMountedRef.current) return;
        console.log('[useAgentStream] Stream connection closed');

        // Only finalize as completed if we weren't already in an error state
        if (status === 'streaming' || status === 'connecting') {
            finalizeStream('completed');
        }
    }, [status, finalizeStream]);

    const startStreaming = useCallback((runId: string) => {
        if (!isMountedRef.current) return;

        console.log(`[useAgentStream] Starting stream for agent run: ${runId}`);

        // Clean up existing stream
        if (cleanupRef.current) {
            cleanupRef.current();
            cleanupRef.current = null;
        }

        // Reset state
        setStatus('connecting');
        setTextContent([]);
        setToolCall(null);
        setError(null);
        setAgentRunId(runId);
        currentRunIdRef.current = runId;

        // Update UI store
        setIsGenerating(true);

        const cleanup = streamAgent(runId, {
            onMessage: handleStreamMessage,
            onError: handleStreamError,
            onClose: handleStreamClose,
        });

        cleanupRef.current = cleanup;
    }, [handleStreamMessage, handleStreamError, handleStreamClose, setIsGenerating]);

    const stopStreaming = useCallback(() => {
        console.log('[useAgentStream] Manually stopping stream');
        if (cleanupRef.current) {
            cleanupRef.current();
            cleanupRef.current = null;
        }
        finalizeStream('stopped');
    }, [finalizeStream]);

    // Cleanup on unmount
    useEffect(() => {
        isMountedRef.current = true;
        return () => {
            isMountedRef.current = false;
            if (cleanupRef.current) {
                cleanupRef.current();
            }
            // Clean up UI store on unmount
            setIsGenerating(false);
            setCurrentTool(null);
        };
    }, [setIsGenerating, setCurrentTool]);

    return {
        status,
        textContent: orderedTextContent,
        toolCall,
        error,
        agentRunId,
        startStreaming,
        stopStreaming,
        isStreaming: status === 'streaming' || status === 'connecting',
    };
};

// Utility hook to get or create thread for project
export const useEnsureThread = (projectId: string) => {
    const { data: thread, isLoading } = useThreadForProject(projectId);
    const createThread = useCreateThreadForProject();

    const ensureThread = useCallback(async (): Promise<Thread> => {
        if (thread) {
            return thread;
        }

        // Create thread if it doesn't exist (no name needed)
        const newThread = await createThread.mutateAsync({
            projectId,
        });

        return newThread;
    }, [thread, createThread, projectId]);

    return {
        thread,
        isLoading: isLoading || createThread.isPending,
        ensureThread,
    };
};

// Combined hook for chat functionality
export const useChatSession = (projectId: string) => {
    const { thread, isLoading: threadLoading, ensureThread } = useEnsureThread(projectId);
    const { data: messages = [], isLoading: messagesLoading } = useMessages(thread?.thread_id || '');
    const addMessage = useAddMessage();
    const startAgentMutation = useStartAgent();
    const stopAgentMutation = useStopAgent();
    const agentStream = useAgentStream(thread?.thread_id);
    const setIsGenerating = useSetIsGenerating();

    const sendMessage = useCallback(async (content: string) => {
        try {
            // START THINKING STATE IMMEDIATELY
            console.log('[useChatSession] Starting thinking state immediately');
            setIsGenerating(true);

            // Ensure thread exists (CREATE ONLY WHEN SENDING MESSAGE)
            const currentThread = await ensureThread();

            // Add user message
            await addMessage.mutateAsync({
                threadId: currentThread.thread_id,
                content,
            });

            // Start agent
            const result = await startAgentMutation.mutateAsync({
                threadId: currentThread.thread_id,
            });

            // Start streaming
            agentStream.startStreaming(result.agent_run_id);
        } catch (error) {
            console.error('[HOOK] Failed to send message:', error);
            // Stop thinking state on error
            setIsGenerating(false);
            throw error;
        }
    }, [ensureThread, addMessage, startAgentMutation, agentStream, setIsGenerating]);

    const stopAgent = useCallback(() => {
        console.log('[useChatSession] STOP AGENT CALLED - forcing immediate stop');

        // ALWAYS stop streaming first - this is critical
        agentStream.stopStreaming();

        // ALWAYS reset generating state immediately
        setIsGenerating(false);

        // Try to stop backend agent if we have an ID
        if (agentStream.agentRunId) {
            console.log('[useChatSession] Stopping backend agent:', agentStream.agentRunId);
            stopAgentMutation.mutate(agentStream.agentRunId);
        } else {
            console.log('[useChatSession] No agentRunId - only stopped local streaming');
        }
    }, [agentStream, stopAgentMutation, setIsGenerating]);

    const result = {
        thread,
        messages,
        isLoading: threadLoading || messagesLoading,
        isLoadingThread: threadLoading,
        isLoadingMessages: messagesLoading,
        sendMessage,
        stopAgent,
        isGenerating: agentStream.isStreaming,
        streamStatus: agentStream.status,
        streamContent: agentStream.textContent,
        streamError: agentStream.error,
        isSending: addMessage.isPending || startAgentMutation.isPending,
    };

    // Debug logging for streaming state
    if (agentStream.textContent) {
        console.log('[useChatSession] Streaming content:', agentStream.textContent.slice(0, 100) + '...');
    }
    if (agentStream.isStreaming) {
        console.log('[useChatSession] Is streaming:', agentStream.isStreaming, 'Status:', agentStream.status);
    }

    return result;
};

// NEW CHAT SESSION HOOK
export const useNewChatSession = () => {
    const [threadId, setThreadId] = useState<string | null>(null);
    const [messages, setMessages] = useState<Message[]>([]);
    const [isInitialized, setIsInitialized] = useState(false);
    const [isSending, setIsSending] = useState(false);

    const queryClient = useQueryClient();
    const agentStream = useAgentStream(threadId || undefined);
    const setIsGenerating = useSetIsGenerating();
    const addMessage = useAddMessage();
    const startAgentMutation = useStartAgent();
    const updateNewChatProject = useUpdateNewChatProject();

    // Fetch thread info when we have threadId to get project info
    const { data: threadInfo } = useQuery({
        queryKey: ['thread', threadId],
        queryFn: async () => {
            if (!threadId) return null;

            // Try to get project from thread
            const supabase = createSupabaseClient();
            const { data } = await supabase
                .from('threads')
                .select(`
                    *,
                    projects!inner(*)
                `)
                .eq('thread_id', threadId)
                .single();

            return data;
        },
        enabled: !!threadId && isInitialized,
        staleTime: Infinity, // Don't refetch once we have it
    });

    // Update project info when we get thread data
    useEffect(() => {
        if (threadInfo?.projects) {
            const projectData = threadInfo.projects;
            console.log('[useNewChatSession] Updating project with real data:', projectData);

            updateNewChatProject({
                id: projectData.project_id,
                name: projectData.name || 'Untitled Project',
                description: projectData.description || '',
                account_id: projectData.account_id,
                created_at: projectData.created_at,
                updated_at: projectData.updated_at,
                sandbox: projectData.sandbox || {},
            });

            // INVALIDATE PROJECTS QUERY so new project appears in regular list
            console.log('[useNewChatSession] Invalidating projects query to refresh list');
            queryClient.invalidateQueries({ queryKey: projectKeys.lists() });
        }
    }, [threadInfo, updateNewChatProject, queryClient]);

    const sendMessage = useCallback(async (content: string, files?: any[]) => {
        try {
            if (!isInitialized) {
                // IMMEDIATELY set temp project BEFORE any async operations
                console.log('[useNewChatSession] Setting temp project IMMEDIATELY');
                updateNewChatProject({
                    id: 'new-chat-temp',
                    name: 'New Chat',
                    description: 'Temporary project for new chat',
                    account_id: '',
                    sandbox: {},
                });
                console.log('[useNewChatSession] Temp project set, marking as initialized');
                setIsInitialized(true); // Mark as initialized so left panel shows it
            }

            // ADD USER MESSAGE IMMEDIATELY (OPTIMISTIC UPDATE)
            const optimisticUserMessage: Message = {
                message_id: `user-temp-${Date.now()}`,
                thread_id: threadId || 'temp',
                type: 'user',
                is_llm_message: false,
                content: content,
                metadata: {},
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
            };

            setMessages(prev => [...prev, optimisticUserMessage]);
            setIsSending(true);
            setIsGenerating(true);

            if (!threadId) {
                // First message - initiate new chat
                console.log('[useNewChatSession] Initiating API call for new chat');

                const result = await initiateAgent(content, {
                    stream: true,
                    enable_context_manager: true,
                    files: files // Pass files to initiateAgent
                });

                setThreadId(result.thread_id);
                setIsSending(false);

                // Update the optimistic message with real thread_id
                setMessages(prev => prev.map(msg =>
                    msg.message_id === optimisticUserMessage.message_id
                        ? { ...msg, thread_id: result.thread_id, message_id: `user-${Date.now()}` }
                        : msg
                ));

                // Start streaming immediately
                agentStream.startStreaming(result.agent_run_id);
            } else {
                // Subsequent messages - use existing thread
                console.log('[useNewChatSession] Adding message to existing thread:', threadId);

                await addMessage.mutateAsync({
                    threadId,
                    content,
                });
                setIsSending(false);

                const result = await startAgentMutation.mutateAsync({
                    threadId,
                });

                agentStream.startStreaming(result.agent_run_id);
            }
        } catch (error) {
            console.error('[useNewChatSession] Failed to send message:', error);
            setIsGenerating(false);
            setIsSending(false);

            // Remove the optimistic message on error (if any)
            setMessages(prev => prev.filter(msg => msg.message_id.startsWith('user-temp-')));
            throw error;
        }
    }, [threadId, agentStream, setIsGenerating, addMessage, startAgentMutation, updateNewChatProject, isInitialized]);

    const stopAgent = useCallback(() => {
        console.log('[useNewChatSession] Stopping agent');
        agentStream.stopStreaming();
        setIsGenerating(false);
        setIsSending(false);
    }, [agentStream, setIsGenerating]);

    // Load messages from API when thread is initialized
    const { data: apiMessages } = useMessages(threadId || '');

    // Merge local and API messages, prioritizing API messages when available
    const allMessages = threadId && apiMessages && apiMessages.length > 0 ? apiMessages : messages;

    // Convert textContent array to string for compatibility with MessageThread
    const streamContentString = Array.isArray(agentStream.textContent)
        ? agentStream.textContent.map(item => item.content).join('')
        : agentStream.textContent || '';

    return {
        messages: allMessages,
        threadId,
        isInitialized,
        sendMessage,
        stopAgent,
        isGenerating: agentStream.isStreaming,
        streamContent: streamContentString,
        streamError: agentStream.error,
        streamStatus: agentStream.status,
        isLoading: false,
        isSending, // NOW WE HAVE PROPER SENDING STATE
    };
}; 