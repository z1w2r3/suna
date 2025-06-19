import {
    addUserMessage,
    BillingError,
    createThreadForProject,
    getAgentRuns,
    getMessages,
    getThreadForProject,
    Message,
    ParsedContent,
    parseStreamContent,
    startAgent,
    stopAgent,
    streamAgent,
    Thread
} from '@/api/chat-api';
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
        enabled: !!projectId && projectId !== '',
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

// Streaming Hook
export interface UseAgentStreamResult {
    status: 'idle' | 'connecting' | 'streaming' | 'completed' | 'error';
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
    const [status, setStatus] = useState<UseAgentStreamResult['status']>('idle');
    const [textContent, setTextContent] = useState('');
    const [toolCall, setToolCall] = useState<ParsedContent | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [agentRunId, setAgentRunId] = useState<string | null>(null);
    const cleanupRef = useRef<(() => void) | null>(null);

    const startStreaming = useCallback((runId: string) => {
        console.log('[HOOK] Starting stream for agent run:', runId);

        // Reset state
        setStatus('connecting');
        setTextContent('');
        setToolCall(null);
        setError(null);
        setAgentRunId(runId);

        // Stop any existing stream
        if (cleanupRef.current) {
            cleanupRef.current();
            cleanupRef.current = null;
        }

        const cleanup = streamAgent(runId, {
            onMessage: (rawData) => {
                try {
                    setStatus('streaming');

                    // Parse the content
                    const parsed = parseStreamContent(rawData);
                    if (parsed) {
                        if (parsed.type === 'text') {
                            setTextContent(prev => prev + parsed.content);
                        } else if (parsed.type === 'tool_call') {
                            setToolCall(parsed);
                        }
                    }

                    // Also try to parse as JSON for status updates
                    try {
                        const data = JSON.parse(rawData);
                        if (data.type === 'content' && data.content) {
                            setTextContent(prev => prev + data.content);
                        }
                    } catch (parseError) {
                        // Not JSON, ignore
                    }
                } catch (err) {
                    console.error('[HOOK] Error processing stream message:', err);
                }
            },
            onError: (streamError) => {
                console.error('[HOOK] Stream error:', streamError);
                setStatus('error');
                setError(streamError instanceof Error ? streamError.message : String(streamError));
            },
            onClose: () => {
                console.log('[HOOK] Stream closed');
                setStatus(prev => prev === 'error' ? 'error' : 'completed');

                // Refresh messages after stream completes
                if (threadId) {
                    queryClient.invalidateQueries({ queryKey: chatKeys.messagesForThread(threadId) });
                }

                // Clear cleanup ref
                cleanupRef.current = null;
            },
        });

        cleanupRef.current = cleanup;
    }, [queryClient, threadId]);

    const stopStreaming = useCallback(() => {
        console.log('[HOOK] Manually stopping stream');
        if (cleanupRef.current) {
            cleanupRef.current();
            cleanupRef.current = null;
        }
        setStatus('completed');
    }, []);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (cleanupRef.current) {
                cleanupRef.current();
            }
        };
    }, []);

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

    // Removed auto-thread creation - threads only created when user sends message

    const sendMessage = useCallback(async (content: string) => {
        try {
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
            throw error;
        }
    }, [ensureThread, addMessage, startAgentMutation, agentStream]);

    const stopAgent = useCallback(() => {
        if (agentStream.agentRunId) {
            stopAgentMutation.mutate(agentStream.agentRunId);
        }
        agentStream.stopStreaming();
    }, [agentStream, stopAgentMutation]);

    return {
        thread,
        messages,
        isLoading: threadLoading || messagesLoading,
        sendMessage,
        stopAgent,
        isGenerating: agentStream.isStreaming,
        streamStatus: agentStream.status,
        streamContent: agentStream.textContent,
        streamError: agentStream.error,
        isSending: addMessage.isPending || startAgentMutation.isPending,
    };
}; 