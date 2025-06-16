import { useTheme } from '@/hooks/useThemeColor';
import { useCurrentTool, useIsGenerating } from '@/stores/ui-store';
import React, { memo } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import { Body } from './Typography';

export interface Message {
    id: string;
    text: string;
    isUser: boolean;
    timestamp: Date;
}

interface MessageItemProps {
    message: Message;
}

const MessageItem = memo<MessageItemProps>(({ message }) => {
    const theme = useTheme();

    if (message.isUser) {
        // User messages with bubble
        const bubbleColor = theme.messageBubble; // Pre-computed 10% opacity

        return (
            <View style={[styles.messageContainer, { alignSelf: 'flex-end' }]}>
                <View style={[styles.messageBubble, { backgroundColor: bubbleColor }]}>
                    <Body style={[styles.messageText, { color: theme.userMessage }]}>
                        {message.text}
                    </Body>
                </View>
            </View>
        );
    } else {
        // AI messages full width, no bubble
        return (
            <View style={styles.aiMessageContainer}>
                <Body style={[styles.aiMessageText, { color: theme.aiMessage }]}>
                    {message.text}
                </Body>
            </View>
        );
    }
});

MessageItem.displayName = 'MessageItem';

interface MessageThreadProps {
    messages: Message[];
    sessionId?: string; // For optimized queries
}

export const MessageThread: React.FC<MessageThreadProps> = ({ messages, sessionId }) => {
    const theme = useTheme();

    // Zustand state for UI concerns
    const currentTool = useCurrentTool();
    const isGenerating = useIsGenerating();

    const renderMessage = ({ item }: { item: Message }) => (
        <MessageItem message={item} />
    );

    const keyExtractor = (item: Message) => item.id;

    // Performance: Show generating indicator
    const renderFooter = () => {
        if (!isGenerating) return null;

        return (
            <View style={styles.generatingContainer}>
                <Body style={[styles.generatingText, { color: theme.placeholderText, backgroundColor: theme.background }]}>
                    {currentTool ? `${currentTool.name} is thinking...` : 'Generating response...'}
                </Body>
            </View>
        );
    };

    return (
        <FlatList
            data={messages}
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
    generatingContainer: {
        paddingVertical: 12,
        paddingHorizontal: 16,
        alignItems: 'center',
    },
    generatingText: {
        fontStyle: 'italic',
        fontSize: 14,
    },
}); 