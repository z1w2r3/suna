import { createStreamingQuery } from '@/stores/query-client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

// Message types (aligned with existing MessageThread)
export interface Message {
  id: string;
  text: string;
  isUser: boolean;
  timestamp: Date;
}

export interface ChatSession {
  id: string;
  title: string;
  messages: Message[];
  createdAt: Date;
  updatedAt: Date;
}

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