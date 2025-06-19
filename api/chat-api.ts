import { SERVER_URL } from '@/constants/Server';
import { createSupabaseClient } from '@/constants/SupabaseConfig';
import { createStreamingQuery } from '@/stores/query-client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { handleApiError } from './error-handlers';

// Message types (aligned with existing MessageThread)
export interface Message {
  message_id: string;
  thread_id: string;
  type: 'user' | 'assistant' | 'system' | 'cost' | 'summary' | 'status';
  is_llm_message: boolean;
  content: string | Record<string, any>;
  metadata: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface ChatSession {
  id: string;
  title: string;
  messages: Message[];
  createdAt: Date;
  updatedAt: Date;
}

export interface Thread {
  thread_id: string;
  project_id: string;
  account_id: string;
  is_public: boolean;
  created_at: string;
  updated_at: string;
  agent_id: string | null;
  metadata: Record<string, any>;
}

export interface AgentRun {
  id: string;
  thread_id: string;
  status: 'running' | 'completed' | 'failed' | 'cancelled';
  model_name: string;
  created_at: string;
  updated_at: string;
}

export interface ParsedContent {
  type: 'tool_call' | 'text';
  name?: string;
  content: string;
  [key: string]: any;
}

// Error classes
export class NoAccessTokenAvailableError extends Error {
  constructor() {
    super('No access token available');
    this.name = 'NoAccessTokenAvailableError';
  }
}

export class BillingError extends Error {
  public status: number;
  public detail: { message: string };

  constructor(status: number, detail: { message: string }, message?: string) {
    super(message || detail.message);
    this.name = 'BillingError';
    this.status = status;
    this.detail = detail;
  }
}

// Active streams management
const activeStreams = new Map<string, EventSource>();
const nonRunningAgentRuns = new Set<string>();

// SSE streaming helper
export const fetchSSE = async (url: string): Promise<ReadableStream<string>> => {
  const response = await fetch(url, {
    headers: {
      'Accept': 'text/event-stream',
      'Cache-Control': 'no-cache',
    },
  });

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  const stream = new ReadableStream({
    start(controller) {
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      function pump(): Promise<void> {
        return reader!.read().then(({ done, value }) => {
          if (done) {
            controller.close();
            return;
          }

          const chunk = decoder.decode(value);
          controller.enqueue(chunk);
          return pump();
        });
      }

      return pump();
    },
  });

  return stream;
};

// Streaming query helper
const streamedQuery = <T>(streamPromise: Promise<ReadableStream<string>>): Promise<T[]> => {
  return new Promise(async (resolve, reject) => {
    try {
      const stream = await streamPromise;
      const reader = stream.getReader();
      const results: T[] = [];

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        // Parse SSE data
        const lines = value.split('\n');
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              results.push(data);
            } catch (e) {
              // Skip malformed JSON
            }
          }
        }
      }

      resolve(results);
    } catch (error) {
      reject(error);
    }
  });
};

// Chat queries following your guidelines
export const useChat = (sessionId: string) => {
  return useQuery({
    ...createStreamingQuery(
      ['chat', 'messages'],
      () => streamedQuery<Message>(fetchSSE(`/api/chat/${sessionId}/stream`)),
      sessionId
    ),
    enabled: !!sessionId,
  });
};

// Regular chat session query (persisted)
export const useChatSession = (sessionId: string) => {
  return useQuery({
    queryKey: ['chat', 'session', sessionId],
    queryFn: async (): Promise<ChatSession> => {
      const response = await fetch(`/api/chat/sessions/${sessionId}`);
      if (!response.ok) {
        throw new Error('Failed to fetch chat session');
      }
      return response.json();
    },
    enabled: !!sessionId,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 30 * 60 * 1000, // 30 minutes for session data
  });
};

// Chat sessions list (persisted)
export const useChatSessions = () => {
  return useQuery({
    queryKey: ['chat', 'sessions'],
    queryFn: async (): Promise<ChatSession[]> => {
      const response = await fetch('/api/chat/sessions');
      if (!response.ok) {
        throw new Error('Failed to fetch chat sessions');
      }
      return response.json();
    },
    staleTime: 2 * 60 * 1000, // 2 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
  });
};

// Send message mutation
export const useSendMessage = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ sessionId, message }: { sessionId: string; message: string }) => {
      const response = await fetch(`/api/chat/${sessionId}/send`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ message }),
      });

      if (!response.ok) {
        throw new Error('Failed to send message');
      }

      return response.json();
    },
    onSuccess: (_, { sessionId }) => {
      // Invalidate chat queries to trigger refetch
      queryClient.invalidateQueries({ queryKey: ['chat', 'messages', sessionId] });
      queryClient.invalidateQueries({ queryKey: ['chat', 'session', sessionId] });
      queryClient.invalidateQueries({ queryKey: ['chat', 'sessions'] });
    },
  });
};

// Create new chat session
export const useCreateChatSession = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ title }: { title?: string } = {}): Promise<ChatSession> => {
      const response = await fetch('/api/chat/sessions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ title: title || 'New Chat' }),
      });

      if (!response.ok) {
        throw new Error('Failed to create chat session');
      }

      return response.json();
    },
    onSuccess: () => {
      // Invalidate sessions list
      queryClient.invalidateQueries({ queryKey: ['chat', 'sessions'] });
    },
  });
};

// Delete chat session
export const useDeleteChatSession = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (sessionId: string) => {
      const response = await fetch(`/api/chat/sessions/${sessionId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete chat session');
      }
    },
    onSuccess: (_, sessionId) => {
      // Remove from cache
      queryClient.removeQueries({ queryKey: ['chat', 'messages', sessionId] });
      queryClient.removeQueries({ queryKey: ['chat', 'session', sessionId] });
      queryClient.invalidateQueries({ queryKey: ['chat', 'sessions'] });
    },
  });
};

// API Functions
export const addUserMessage = async (
  threadId: string,
  content: string,
): Promise<void> => {
  try {
    const supabase = createSupabaseClient();

    // Check auth
    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError || !userData.user) {
      throw new Error('User not authenticated');
    }

    const message = {
      role: 'user',
      content: content,
    };

    const { error } = await supabase.from('messages').insert({
      thread_id: threadId,
      type: 'user',
      is_llm_message: true,
      content: JSON.stringify(message),
    });

    if (error) {
      console.error('Error adding user message:', error);
      handleApiError(error, { operation: 'add message', resource: 'message' });
      throw new Error(`Error adding message: ${error.message}`);
    }
  } catch (error) {
    console.error('Failed to add user message:', error);
    throw error;
  }
};

export const getMessages = async (threadId: string): Promise<Message[]> => {
  try {
    const supabase = createSupabaseClient();

    // Check auth
    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError || !userData.user) {
      console.log('[API] No user logged in for messages');
      return [];
    }

    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .eq('thread_id', threadId)
      .neq('type', 'cost')
      .neq('type', 'summary')
      .neq('type', 'status') // Filter out status messages
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Error fetching messages:', error);
      handleApiError(error, { operation: 'load messages', resource: `messages for thread ${threadId}` });
      throw new Error(`Error getting messages: ${error.message}`);
    }

    console.log('[API] Messages fetched:', data?.length || 0);
    return data || [];
  } catch (error) {
    console.error('Failed to get messages:', error);
    throw error;
  }
};

export const getThreadForProject = async (projectId: string): Promise<Thread | null> => {
  try {
    const supabase = createSupabaseClient();

    // Check auth
    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError || !userData.user) {
      console.log('[API] No user logged in for thread');
      return null;
    }

    const { data, error } = await supabase
      .from('threads')
      .select('*')
      .eq('project_id', projectId)
      .eq('account_id', userData.user.id) // Filter by user's account
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        // No thread found, this is ok
        return null;
      }
      console.error('Error fetching thread:', error);
      handleApiError(error, { operation: 'load thread', resource: `thread for project ${projectId}` });
      throw new Error(`Error getting thread: ${error.message}`);
    }

    return data;
  } catch (error) {
    console.error('Failed to get thread:', error);
    throw error;
  }
};

export const createThreadForProject = async (projectId: string): Promise<Thread> => {
  try {
    const supabase = createSupabaseClient();

    // Check auth
    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError || !userData.user) {
      throw new Error('User not authenticated');
    }

    const { data, error } = await supabase
      .from('threads')
      .insert({
        project_id: projectId,
        account_id: userData.user.id, // Set the account_id for RLS
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating thread:', error);
      handleApiError(error, { operation: 'create thread', resource: 'thread' });
      throw new Error(`Error creating thread: ${error.message}`);
    }

    return data;
  } catch (error) {
    console.error('Failed to create thread:', error);
    throw error;
  }
};

export const startAgent = async (
  threadId: string,
  options?: {
    model_name?: string;
    enable_thinking?: boolean;
    reasoning_effort?: string;
    stream?: boolean;
    agent_id?: string;
  },
): Promise<{ agent_run_id: string }> => {
  try {
    const supabase = createSupabaseClient();
    const { data: { session } } = await supabase.auth.getSession();

    if (!session?.access_token) {
      throw new NoAccessTokenAvailableError();
    }

    if (!SERVER_URL) {
      throw new Error(
        'Backend URL is not configured. Set EXPO_PUBLIC_SERVER_URL in your environment.',
      );
    }

    console.log(`[API] Starting agent for thread ${threadId}`);

    const defaultOptions = {
      model_name: 'claude-3-7-sonnet-latest',
      enable_thinking: false,
      reasoning_effort: 'low',
      stream: true,
      agent_id: undefined,
    };

    const finalOptions = { ...defaultOptions, ...options };

    const body: any = {
      model_name: finalOptions.model_name,
      enable_thinking: finalOptions.enable_thinking,
      reasoning_effort: finalOptions.reasoning_effort,
      stream: finalOptions.stream,
    };
    
    if (finalOptions.agent_id) {
      body.agent_id = finalOptions.agent_id;
    }

    const response = await fetch(`${SERVER_URL}/thread/${threadId}/agent/start`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      if (response.status === 402) {
        try {
          const errorData = await response.json();
          console.error(`[API] Billing error starting agent (402):`, errorData);
          const detail = errorData?.detail || { message: 'Payment Required' };
          if (typeof detail.message !== 'string') {
            detail.message = 'Payment Required';
          }
          throw new BillingError(response.status, detail);
        } catch (parseError) {
          console.error('[API] Could not parse 402 error response body:', parseError);
          throw new BillingError(
            response.status,
            { message: 'Payment Required' },
            `Error starting agent: ${response.statusText} (402)`,
          );
        }
      }

      const errorText = await response.text().catch(() => 'No error details available');
      console.error(`[API] Error starting agent: ${response.status} ${response.statusText}`, errorText);
      throw new Error(`Error starting agent: ${response.statusText} (${response.status})`);
    }

    const result = await response.json();
    return result;
  } catch (error) {
    if (error instanceof BillingError || error instanceof NoAccessTokenAvailableError) {
      throw error;
    }

    console.error('[API] Failed to start agent:', error);
    
    if (error instanceof TypeError && error.message.includes('Failed to fetch')) {
      const networkError = new Error(
        `Cannot connect to backend server. Please check your internet connection and make sure the backend is running.`,
      );
      handleApiError(networkError, { operation: 'start agent', resource: 'AI assistant' });
      throw networkError;
    }

    handleApiError(error, { operation: 'start agent', resource: 'AI assistant' });
    throw error;
  }
};

export const stopAgent = async (agentRunId: string): Promise<void> => {
  nonRunningAgentRuns.add(agentRunId);

  const existingStream = activeStreams.get(agentRunId);
  if (existingStream) {
    console.log(`[API] Closing existing stream for ${agentRunId}`);
    existingStream.close();
    activeStreams.delete(agentRunId);
  }

  try {
    const supabase = createSupabaseClient();
    const { data: { session } } = await supabase.auth.getSession();

    if (!session?.access_token) {
      const authError = new NoAccessTokenAvailableError();
      handleApiError(authError, { operation: 'stop agent', resource: 'AI assistant' });
      throw authError;
    }

    const response = await fetch(`${SERVER_URL}/agent-run/${agentRunId}/stop`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
      },
    });

    if (!response.ok) {
      const stopError = new Error(`Error stopping agent: ${response.statusText}`);
      handleApiError(stopError, { operation: 'stop agent', resource: 'AI assistant' });
      throw stopError;
    }
  } catch (error) {
    console.error('Failed to stop agent:', error);
    throw error;
  }
};

export const getAgentStatus = async (agentRunId: string): Promise<AgentRun> => {
  console.log(`[API] Requesting agent status for ${agentRunId}`);

  if (nonRunningAgentRuns.has(agentRunId)) {
    console.log(`[API] Agent run ${agentRunId} is known to be non-running`);
    throw new Error(`Agent run ${agentRunId} is not running`);
  }

  try {
    const supabase = createSupabaseClient();
    const { data: { session } } = await supabase.auth.getSession();

    if (!session?.access_token) {
      console.error('[API] No access token available for getAgentStatus');
      throw new NoAccessTokenAvailableError();
    }

    const response = await fetch(`${SERVER_URL}/agent-run/${agentRunId}`, {
      headers: {
        Authorization: `Bearer ${session.access_token}`,
      },
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'No error details available');
      console.error(`[API] Error getting agent status: ${response.status} ${response.statusText}`, errorText);

      if (response.status === 404) {
        nonRunningAgentRuns.add(agentRunId);
      }

      throw new Error(`Error getting agent status: ${response.statusText} (${response.status})`);
    }

    const data = await response.json();
    console.log(`[API] Successfully got agent status:`, data);

    if (data.status !== 'running') {
      nonRunningAgentRuns.add(agentRunId);
    }

    return data;
  } catch (error) {
    console.error('[API] Failed to get agent status:', error);
    handleApiError(error, { operation: 'get agent status', resource: 'AI assistant status' });
    throw error;
  }
};

export const getAgentRuns = async (threadId: string): Promise<AgentRun[]> => {
  try {
    const supabase = createSupabaseClient();
    const { data: { session } } = await supabase.auth.getSession();

    if (!session?.access_token) {
      throw new NoAccessTokenAvailableError();
    }

    const response = await fetch(`${SERVER_URL}/thread/${threadId}/agent-runs`, {
      headers: {
        Authorization: `Bearer ${session.access_token}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Error getting agent runs: ${response.statusText}`);
    }

    const data = await response.json();
    return data.agent_runs || [];
  } catch (error) {
    if (error instanceof NoAccessTokenAvailableError) {
      throw error;
    }

    console.error('Failed to get agent runs:', error);
    handleApiError(error, { operation: 'load agent runs', resource: 'conversation history' });
    throw error;
  }
};

export const streamAgent = (
  agentRunId: string,
  callbacks: {
    onMessage: (content: string) => void;
    onError: (error: Error | string) => void;
    onClose: () => void;
  },
): (() => void) => {
  console.log(`[STREAM] streamAgent called for ${agentRunId}`);

  if (nonRunningAgentRuns.has(agentRunId)) {
    console.log(`[STREAM] Agent run ${agentRunId} is known to be non-running`);
    setTimeout(() => {
      callbacks.onError(`Agent run ${agentRunId} is not running`);
      callbacks.onClose();
    }, 0);
    return () => {};
  }

  const existingStream = activeStreams.get(agentRunId);
  if (existingStream) {
    console.log(`[STREAM] Stream already exists for ${agentRunId}, closing it first`);
    existingStream.close();
    activeStreams.delete(agentRunId);
  }

  try {
    const setupStream = async () => {
      try {
        const status = await getAgentStatus(agentRunId);
        if (status.status !== 'running') {
          console.log(`[STREAM] Agent run ${agentRunId} is not running (status: ${status.status})`);
          nonRunningAgentRuns.add(agentRunId);
          callbacks.onError(`Agent run ${agentRunId} is not running (status: ${status.status})`);
          callbacks.onClose();
          return;
        }
      } catch (err) {
        console.error(`[STREAM] Error verifying agent run ${agentRunId}:`, err);
        const errorMessage = err instanceof Error ? err.message : String(err);
        const isNotFoundError = errorMessage.includes('not found') || errorMessage.includes('404');

        if (isNotFoundError) {
          console.log(`[STREAM] Agent run ${agentRunId} not found`);
          nonRunningAgentRuns.add(agentRunId);
        }

        callbacks.onError(errorMessage);
        callbacks.onClose();
        return;
      }

      const supabase = createSupabaseClient();
      const { data: { session } } = await supabase.auth.getSession();

      if (!session?.access_token) {
        const authError = new NoAccessTokenAvailableError();
        console.error('[STREAM] No auth token available');
        callbacks.onError(authError);
        callbacks.onClose();
        return;
      }

      const url = new URL(`${SERVER_URL}/agent-run/${agentRunId}/stream`);
      url.searchParams.append('token', session.access_token);

      console.log(`[STREAM] Creating EventSource for ${agentRunId}`);
      const eventSource = new EventSource(url.toString());

      activeStreams.set(agentRunId, eventSource);

      eventSource.onopen = () => {
        console.log(`[STREAM] Connection opened for ${agentRunId}`);
      };

      eventSource.onmessage = (event) => {
        try {
          const rawData = event.data;
          if (rawData.includes('"type":"ping"')) return;

          console.log(`[STREAM] Received data for ${agentRunId}: ${rawData.substring(0, 100)}${rawData.length > 100 ? '...' : ''}`);

          if (!rawData || rawData.trim() === '') {
            return;
          }

          try {
            const jsonData = JSON.parse(rawData);
            if (jsonData.status === 'error') {
              console.error(`[STREAM] Error status received for ${agentRunId}:`, jsonData);
              callbacks.onError(jsonData.message || 'Unknown error occurred');
              return;
            }
          } catch (jsonError) {
            // Not JSON, continue with normal processing
          }

          if (rawData.includes('Agent run') && rawData.includes('not found in active runs')) {
            console.log(`[STREAM] Agent run ${agentRunId} not found in active runs`);
            nonRunningAgentRuns.add(agentRunId);
            callbacks.onError('Agent run not found in active runs');
            eventSource.close();
            activeStreams.delete(agentRunId);
            callbacks.onClose();
            return;
          }

          if (rawData.includes('"type":"status"') && rawData.includes('"status":"completed"')) {
            console.log(`[STREAM] Detected completion for ${agentRunId}`);
            
            if (rawData.includes('Run data not available for streaming') || 
                rawData.includes('Stream ended with status: completed')) {
              nonRunningAgentRuns.add(agentRunId);
            }

            callbacks.onMessage(rawData);
            eventSource.close();
            activeStreams.delete(agentRunId);
            callbacks.onClose();
            return;
          }

          if (rawData.includes('"type":"status"') && rawData.includes('"status_type":"thread_run_end"')) {
            console.log(`[STREAM] Detected thread run end for ${agentRunId}`);
            nonRunningAgentRuns.add(agentRunId);
            callbacks.onMessage(rawData);
            eventSource.close();
            activeStreams.delete(agentRunId);
            callbacks.onClose();
            return;
          }

          callbacks.onMessage(rawData);
        } catch (error) {
          console.error(`[STREAM] Error handling message:`, error);
          callbacks.onError(error instanceof Error ? error : String(error));
        }
      };

      eventSource.onerror = (event) => {
        console.log(`[STREAM] EventSource error for ${agentRunId}:`, event);

        getAgentStatus(agentRunId)
          .then((status) => {
            if (status.status !== 'running') {
              console.log(`[STREAM] Agent run ${agentRunId} is not running after error`);
              nonRunningAgentRuns.add(agentRunId);
              eventSource.close();
              activeStreams.delete(agentRunId);
              callbacks.onClose();
            }
          })
          .catch((err) => {
            console.error(`[STREAM] Error checking agent status after stream error:`, err);
            const errMsg = err instanceof Error ? err.message : String(err);
            const isNotFoundErr = errMsg.includes('not found') || errMsg.includes('404');

            if (isNotFoundErr) {
              nonRunningAgentRuns.add(agentRunId);
              eventSource.close();
              activeStreams.delete(agentRunId);
              callbacks.onClose();
            }

            callbacks.onError(errMsg);
          });
      };
    };

    setupStream();

    return () => {
      console.log(`[STREAM] Cleanup called for ${agentRunId}`);
      const stream = activeStreams.get(agentRunId);
      if (stream) {
        stream.close();
        activeStreams.delete(agentRunId);
      }
    };
  } catch (error) {
    console.error(`[STREAM] Error setting up stream for ${agentRunId}:`, error);
    callbacks.onError(error instanceof Error ? error : String(error));
    callbacks.onClose();
    return () => {};
  }
};

// Utility function to parse streaming content
export const parseStreamContent = (rawData: string): ParsedContent | null => {
  try {
    const data = JSON.parse(rawData);
    
    if (data.type === 'content' && data.content) {
      return {
        type: 'text',
        content: data.content,
      };
    }
    
    if (data.type === 'tool_call') {
      return {
        type: 'tool_call',
        name: data.tool_name || data.name,
        content: data.content || JSON.stringify(data),
        ...data,
      };
    }
    
    return null;
  } catch (error) {
    return null;
  }
}; 