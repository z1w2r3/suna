import { commonStyles } from '@/constants/CommonStyles';
import { useChatContext } from '@/hooks/useChatContext';
import { useChatSession } from '@/hooks/useChatHooks';
import { useThemedStyles } from '@/hooks/useThemeColor';
import React from 'react';
import { View } from 'react-native';
import { ChatInput } from './ChatInput';
import { MessageThread } from './MessageThread';
import { SkeletonText } from './Skeleton';
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
        isLoadingThread,
        isLoadingMessages,
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
            ...commonStyles.flexCenter,
            backgroundColor: theme.background,
            paddingHorizontal: 32,
        },
        emptyContainer: {
            ...commonStyles.flexCenter,
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
    if (selectedProject && isLoadingThread) {
        return (
            <View style={styles.loadingContainer}>
                <SkeletonText lines={3} />
            </View>
        );
    }

    // Show empty state when no project is selected
    if (!selectedProject) {
        return (
            <View style={styles.emptyContainer}>
                <Body style={styles.emptyText}>Select a project to start chatting</Body>
                <Body style={styles.emptySubtext}>
                    Choose a project from the sidebar to begin your conversation.
                </Body>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <View style={styles.chatContent}>
                <MessageThread
                    messages={messages}
                    isGenerating={isGenerating}
                    streamContent={streamContent}
                    streamError={streamError}
                    isLoadingMessages={isLoadingMessages}
                />
            </View>
            <ChatInput
                onSendMessage={(content: string) => {
                    sendMessage(content);
                }}
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