import { useChatContext } from '@/hooks/useChatContext';
import { useChatSession } from '@/hooks/useChatHooks';
import { useThemedStyles } from '@/hooks/useThemeColor';
import React from 'react';
import { View } from 'react-native';
import { ChatInput } from './ChatInput';
import { MessageThread } from './MessageThread';
import { Body } from './Typography';

interface ChatContainerProps {
    className?: string;
}

export const ChatContainer: React.FC<ChatContainerProps> = ({ className }) => {
    const { selectedProject } = useChatContext();

    const {
        thread,
        messages,
        isLoading,
        sendMessage,
        stopAgent,
        isGenerating,
        streamContent,
        streamError,
        isSending,
    } = useChatSession(selectedProject?.id || '');

    const styles = useThemedStyles((theme) => ({
        container: {
            flex: 1,
            backgroundColor: theme.background,
        },
        loadingContainer: {
            flex: 1,
            justifyContent: 'center' as const,
            alignItems: 'center' as const,
            backgroundColor: theme.background,
        },
        loadingText: {
            color: theme.mutedForeground,
            fontSize: 16,
        },
        emptyContainer: {
            flex: 1,
            justifyContent: 'center' as const,
            alignItems: 'center' as const,
            backgroundColor: theme.background,
            paddingHorizontal: 32,
        },
        emptyText: {
            color: theme.mutedForeground,
            fontSize: 18,
            textAlign: 'center' as const,
            lineHeight: 24,
        },
        emptySubtext: {
            color: theme.mutedForeground,
            fontSize: 14,
            textAlign: 'center' as const,
            marginTop: 8,
            opacity: 0.7,
        },
        chatContent: {
            flex: 1,
            marginTop: 30,
        },
    }));

    // Show loading state while thread is being fetched (NOT created)
    if (selectedProject && isLoading) {
        return (
            <View style={styles.loadingContainer}>
                <Body style={styles.loadingText}>Loading conversation...</Body>
            </View>
        );
    }

    // Show empty state when no project is selected
    if (!selectedProject) {
        return (
            <View style={styles.emptyContainer}>
                <Body style={styles.emptyText}>
                    Select a project from the sidebar to start chatting
                </Body>
                <Body style={styles.emptySubtext}>
                    Your conversations will appear here
                </Body>
            </View>
        );
    }

    // Project is selected - show chat interface (thread will be created when user sends first message)
    return (
        <View style={styles.container}>
            <View style={styles.chatContent}>
                <MessageThread
                    messages={messages}
                    isGenerating={isGenerating}
                    streamContent={streamContent}
                    streamError={streamError}
                />
            </View>

            <ChatInput
                onSendMessage={sendMessage}
                placeholder={
                    isGenerating
                        ? "AI is responding..."
                        : isSending
                            ? "Sending..."
                            : `Chat with ${selectedProject.name}...`
                }
            />
        </View>
    );
}; 