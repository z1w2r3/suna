import { Message } from '@/api/chat-api';
import { useTheme } from '@/hooks/useThemeColor';
import { useCurrentTool, useIsGenerating } from '@/stores/ui-store';
import React, { memo, useMemo } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import { Body } from './Typography';

interface MessageItemProps {
    message: Message;
    isStreaming?: boolean;
    streamContent?: string;
}

const MessageItem = memo<MessageItemProps>(({ message, isStreaming, streamContent }) => {
    const theme = useTheme();

    // Parse message content
    const parsedContent = useMemo(() => {
        try {
            // Handle both string and object content
            if (typeof message.content === 'string') {
                try {
                    const parsed = JSON.parse(message.content);
                    return parsed.content || message.content;
                } catch {
                    return message.content;
                }
            } else if (typeof message.content === 'object' && message.content !== null) {
                // If content is already an object, check for content property
                return message.content.content || JSON.stringify(message.content);
            }
            return String(message.content);
        } catch {
            return String(message.content);
        }
    }, [message.content]);

    // Determine if this is a user message
    const isUser = message.type === 'user';

    if (isUser) {
        // User messages with bubble
        const bubbleColor = theme.messageBubble;

        return (
            <View style={[styles.messageContainer, { alignSelf: 'flex-end' }]}>
                <View style={[styles.messageBubble, { backgroundColor: bubbleColor }]}>
                    <Body style={[styles.messageText, { color: theme.userMessage }]}>
                        {parsedContent}
                    </Body>
                </View>
            </View>
        );
    } else {
        // AI messages full width, no bubble
        const displayContent = isStreaming ? streamContent : parsedContent;

        return (
            <View style={styles.aiMessageContainer}>
                <Body style={[styles.aiMessageText, { color: theme.aiMessage }]}>
                    {displayContent}
                    {isStreaming && (
                        <Body style={[styles.streamingIndicator, { color: theme.mutedForeground }]}>
                            ●
                        </Body>
                    )}
                </Body>
            </View>
        );
    }
});

MessageItem.displayName = 'MessageItem';

interface MessageThreadProps {
    messages: Message[];
    isGenerating?: boolean;
    streamContent?: string;
    streamError?: string | null;
}

export const MessageThread: React.FC<MessageThreadProps> = ({
    messages,
    isGenerating = false,
    streamContent = '',
    streamError
}) => {
    const theme = useTheme();

    // Zustand state for UI concerns
    const currentTool = useCurrentTool();
    const isGeneratingFromStore = useIsGenerating();

    // Use prop or store value for generating state
    const showGenerating = isGenerating || isGeneratingFromStore;

    // Create display messages including streaming content
    const displayMessages = useMemo(() => {
        if (!showGenerating || !streamContent) {
            return messages;
        }

        // Check if we need to append streaming content to the last AI message
        // or create a new streaming message
        const lastMessage = messages[messages.length - 1];
        const isLastMessageFromAI = lastMessage && lastMessage.type === 'assistant';

        if (isLastMessageFromAI && streamContent) {
            // Update the last AI message with streaming content
            return [
                ...messages.slice(0, -1),
                {
                    ...lastMessage,
                    content: JSON.stringify({ content: streamContent }),
                }
            ];
        } else if (streamContent) {
            // Create a new streaming message
            const streamingMessage: Message = {
                message_id: 'streaming-temp',
                thread_id: messages[0]?.thread_id || '',
                type: 'assistant',
                is_llm_message: true,
                content: JSON.stringify({ content: streamContent }),
                metadata: {},
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
            };
            return [...messages, streamingMessage];
        }

        return messages;
    }, [messages, streamContent, showGenerating]);

    const renderMessage = ({ item, index }: { item: Message; index: number }) => {
        const isLastMessage = index === displayMessages.length - 1;
        const isStreamingMessage = item.message_id === 'streaming-temp';

        return (
            <MessageItem
                message={item}
                isStreaming={isStreamingMessage && showGenerating}
                streamContent={isStreamingMessage ? streamContent : undefined}
            />
        );
    };

    const keyExtractor = (item: Message) => item.message_id;

    // Performance: Show generating indicator
    const renderFooter = () => {
        if (!showGenerating) return null;

        if (streamError) {
            return (
                <View style={styles.errorContainer}>
                    <Body style={[styles.errorText, { color: theme.destructive }]}>
                        Error: {streamError}
                    </Body>
                </View>
            );
        }

        // Only show generating indicator if we don't have streaming content
        if (!streamContent) {
            return (
                <View style={styles.generatingContainer}>
                    <Body style={[styles.generatingText, { color: theme.placeholderText }]}>
                        {currentTool ? `${currentTool.name} is thinking...` : 'Generating response...'}
                    </Body>
                </View>
            );
        }

        return null;
    };

    if (messages.length === 0 && !showGenerating) {
        return (
            <View style={[styles.container, { backgroundColor: theme.background }]}>
                <View style={styles.emptyContainer}>
                    <Body style={[styles.emptyText, { color: theme.mutedForeground }]}>
                        This is the beginning of your conversation.
                    </Body>
                    <Body style={[styles.emptyText, { color: theme.mutedForeground, fontSize: 14, marginTop: 8, opacity: 0.7 }]}>
                        Send a message to get started!
                    </Body>
                </View>
            </View>
        );
    }

    return (
        <FlatList
            data={displayMessages}
            renderItem={renderMessage}
            keyExtractor={keyExtractor}
            style={[styles.container, { backgroundColor: theme.background }]}
            contentContainerStyle={styles.content}
            showsVerticalScrollIndicator={false}
            removeClippedSubviews
            maxToRenderPerBatch={10}
            windowSize={10}
            ListFooterComponent={renderFooter}
            // Auto-scroll to bottom for new messages
            maintainVisibleContentPosition={{
                minIndexForVisible: 0,
                autoscrollToTopThreshold: 100,
            }}
        />
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    content: {
        padding: 16,
        paddingBottom: 8,
        flexGrow: 1,
    },
    messageContainer: {
        marginVertical: 4,
        maxWidth: '80%',
    },
    messageBubble: {
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderRadius: 16,
        elevation: 1,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 2,
    },
    messageText: {
        lineHeight: 20,
    },
    aiMessageContainer: {
        marginVertical: 4,
        width: '100%',
    },
    aiMessageText: {
        lineHeight: 20,
        paddingVertical: 8,
    },
    streamingIndicator: {
        fontSize: 12,
        marginLeft: 4,
        opacity: 0.7,
    },
    generatingContainer: {
        paddingVertical: 12,
        paddingHorizontal: 16,
        alignItems: 'center',
    },
    generatingText: {
        fontStyle: 'italic',
        fontSize: 14,
    },
    errorContainer: {
        paddingVertical: 12,
        paddingHorizontal: 16,
        alignItems: 'center',
    },
    errorText: {
        fontSize: 14,
        textAlign: 'center',
    },
    emptyContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 32,
    },
    emptyText: {
        fontSize: 16,
        textAlign: 'center',
        fontStyle: 'italic',
    },
}); 