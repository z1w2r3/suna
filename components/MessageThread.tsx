import { Message } from '@/api/chat-api';
import { commonStyles } from '@/constants/CommonStyles';
import { fontWeights } from '@/constants/Fonts';
import { useTheme } from '@/hooks/useThemeColor';

import { parseFileAttachments } from '@/utils/file-parser';
import { Markdown } from '@/utils/markdown-renderer';
import { parseMessage } from '@/utils/message-parser';
import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FlatList, Keyboard, StyleSheet, TouchableOpacity, TouchableWithoutFeedback, View } from 'react-native';
import Animated, {
    useAnimatedStyle,
    useSharedValue,
    withRepeat,
    withSequence,
    withTiming
} from 'react-native-reanimated';
import { AttachmentGroup } from './AttachmentGroup';
import { MessageActionModal } from './MessageActionModal';
import { SkeletonChatMessages } from './Skeleton';
import { ToolCallRenderer } from './ToolCallRenderer';
import { Body } from './Typography';

interface MessageItemProps {
    message: Message;
    sandboxId?: string;
    onLongPress?: (messageText: string, layout: { x: number; y: number; width: number; height: number }, messageId: string) => void;
    onToolPress?: (toolCall: any, messageId: string) => void;
}

const MessageItem = memo<MessageItemProps>(({ message, sandboxId, onLongPress, onToolPress }) => {
    const theme = useTheme();
    const messageRef = useRef<View>(null);

    const parsedMessage = useMemo(() => parseMessage(message), [message]);

    // Apply file parsing to the content
    const { attachments, cleanContent } = useMemo(() =>
        parseFileAttachments(parsedMessage.cleanContent, message.metadata?.cached_files),
        [parsedMessage.cleanContent, message.metadata?.cached_files]
    );

    const handleLongPress = () => {
        if (messageRef.current) {
            messageRef.current.measure((x, y, width, height, pageX, pageY) => {
                onLongPress?.(cleanContent, { x: pageX, y: pageY, width, height }, message.message_id);
            });
        }
    };

    const handleFilePress = (filepath: string) => {
        console.log('File pressed:', filepath);
    };

    const isUser = message.type === 'user';

    if (isUser) {
        const bubbleColor = theme.messageBubble;

        return (
            <View style={[styles.messageContainer, { alignSelf: 'flex-end' }]}>
                <TouchableOpacity
                    ref={messageRef}
                    onLongPress={handleLongPress}
                    delayLongPress={500}
                    activeOpacity={0.8}
                >
                    <Animated.View style={[styles.messageBubble, { backgroundColor: bubbleColor }]}>
                        <Body style={[styles.messageText, { color: theme.userMessage }]}>
                            {cleanContent}
                        </Body>

                        {attachments.length > 0 && (
                            <AttachmentGroup
                                attachments={attachments}
                                onFilePress={handleFilePress}
                                layout="grid"
                                showPreviews={true}
                                maxHeight={120}
                                sandboxId={sandboxId}
                            />
                        )}
                    </Animated.View>
                </TouchableOpacity>
            </View>
        );
    } else {
        return (
            <View style={styles.aiMessageContainer}>
                {cleanContent && (
                    <Markdown style={[styles.markdownContent]}>
                        {cleanContent}
                    </Markdown>
                )}

                {attachments.length > 0 && (
                    <AttachmentGroup
                        attachments={attachments}
                        onFilePress={handleFilePress}
                        layout="grid"
                        showPreviews={true}
                        sandboxId={sandboxId}
                    />
                )}

                {parsedMessage.hasTools && (
                    <ToolCallRenderer
                        toolCalls={parsedMessage.toolCalls}
                        onToolPress={(toolCall) => {
                            onToolPress?.(toolCall, message.message_id);
                        }}
                    />
                )}
            </View>
        );
    }
});

MessageItem.displayName = 'MessageItem';

interface MessageThreadProps {
    messages: Message[];
    isGenerating?: boolean;
    isSending?: boolean;
    streamContent?: string;
    streamError?: string | null;
    isLoadingMessages?: boolean;
    onScrollPositionChange?: (isAtBottom: boolean) => void;
    keyboardHeight?: number;
    sandboxId?: string;
}

// EXACT FRONTEND PATTERN - Simple thinking animation
const ThinkingText = memo<{ children: string; color: string }>(({ children, color }) => {
    const opacity = useSharedValue(0.3);

    useEffect(() => {
        opacity.value = withRepeat(
            withSequence(
                withTiming(1, { duration: 800 }),
                withTiming(0.3, { duration: 800 })
            ),
            -1,
            false
        );
    }, [opacity]);

    const animatedStyle = useAnimatedStyle(() => ({
        opacity: opacity.value,
    }));

    return (
        <Animated.View style={animatedStyle}>
            <Body style={[styles.generatingText, { color }]}>
                {children}
            </Body>
        </Animated.View>
    );
});

ThinkingText.displayName = 'ThinkingText';

export const MessageThread: React.FC<MessageThreadProps> = ({
    messages,
    isGenerating = false,
    isSending = false,
    streamContent = '',
    streamError,
    isLoadingMessages = false,
    onScrollPositionChange,
    keyboardHeight = 0,
    sandboxId,
}) => {
    const theme = useTheme();

    // Log sandboxId for debugging
    console.log(`[MessageThread] sandboxId: ${sandboxId || 'undefined'}`);
    const flatListRef = useRef<FlatList>(null);
    const [isAtBottom, setIsAtBottom] = useState(true);

    // Modal state
    const [modalVisible, setModalVisible] = useState(false);
    const [selectedMessageText, setSelectedMessageText] = useState('');
    const [selectedMessageId, setSelectedMessageId] = useState<string | null>(null);
    const [sourceLayout, setSourceLayout] = useState<{ x: number; y: number; width: number; height: number } | undefined>();



    // EXACT FRONTEND PATTERN - Simple message display
    const displayMessages = useMemo(() => {
        // Simple reverse for inverted list - no complex logic
        return messages.slice().reverse();
    }, [messages]);

    // EXACT FRONTEND PATTERN - Show streaming content as text
    const showStreamingText = isGenerating && streamContent;

    // Simple auto-scroll on content change
    const handleContentSizeChange = useCallback(() => {
        if ((isGenerating || isSending) && flatListRef.current) {
            flatListRef.current.scrollToOffset({ offset: 0, animated: true });
        }
    }, [isGenerating, isSending]);

    // Auto-scroll when generating starts
    useEffect(() => {
        if (isGenerating || isSending) {
            Keyboard.dismiss();
            setTimeout(() => {
                if (flatListRef.current) {
                    flatListRef.current.scrollToOffset({ offset: 0, animated: true });
                }
            }, 50);
        }
    }, [isGenerating, isSending]);

    // Keyboard handling
    useEffect(() => {
        if (keyboardHeight > 0 && flatListRef.current) {
            setTimeout(() => {
                flatListRef.current?.scrollToOffset({ offset: 0, animated: true });
            }, 100);
        }
    }, [keyboardHeight]);

    const handleScroll = useCallback((event: any) => {
        const { contentOffset } = event.nativeEvent;
        const isScrolledToBottom = contentOffset.y <= 50;

        if (isScrolledToBottom !== isAtBottom) {
            setIsAtBottom(isScrolledToBottom);
            onScrollPositionChange?.(isScrolledToBottom);
        }
    }, [isAtBottom, onScrollPositionChange]);

    const handleLongPress = useCallback((messageText: string, layout: { x: number; y: number; width: number; height: number }, messageId: string) => {
        setSelectedMessageText(messageText);
        setSourceLayout(layout);
        setSelectedMessageId(messageId);
        setModalVisible(true);
    }, []);

    const handleCloseModal = useCallback(() => {
        setModalVisible(false);
        setSelectedMessageText('');
        setSourceLayout(undefined);
        setSelectedMessageId(null);
    }, []);

    const handleToolPress = useCallback((toolCall: any, messageId: string) => {
        console.log('Tool pressed:', toolCall, messageId);
    }, []);

    const renderMessage = ({ item }: { item: Message }) => {
        // Skip rendering pure tool result messages
        const parsed = parseMessage(item);
        if (parsed.isToolResultMessage && !parsed.cleanContent.trim()) {
            return null;
        }

        return (
            <MessageItem
                message={item}
                sandboxId={sandboxId}
                onLongPress={handleLongPress}
                onToolPress={handleToolPress}
            />
        );
    };

    const keyExtractor = (item: Message) => item.message_id;

    // EXACT FRONTEND PATTERN - Simple footer
    const renderFooter = () => {
        if (!isGenerating && !isSending) return null;

        if (streamError) {
            return (
                <View style={styles.errorContainer}>
                    <Body style={[styles.errorText, { color: theme.destructive }]}>
                        {streamError.includes('No response received')
                            ? 'Agent completed but no response was generated. Please try again.'
                            : `Error: ${streamError}`
                        }
                    </Body>
                </View>
            );
        }

        if (showStreamingText) {
            return (
                <View style={styles.streamingContainer}>
                    <Markdown style={[styles.markdownContent]}>
                        {streamContent}
                    </Markdown>
                    <View style={styles.streamingIndicator}>
                        <Body style={[styles.streamingIndicatorText, { color: theme.mutedForeground }]}>
                            ●
                        </Body>
                    </View>
                </View>
            );
        }

        return (
            <View style={styles.thinkingContainer}>
                <ThinkingText color={theme.placeholderText}>
                    Suna is thinking...
                </ThinkingText>
            </View>
        );
    };

    if (isLoadingMessages && messages.length === 0) {
        return (
            <View style={[styles.container, { backgroundColor: theme.background }]}>
                <SkeletonChatMessages />
            </View>
        );
    }

    if (messages.length === 0 && !isGenerating && !isSending) {
        return (
            <TouchableWithoutFeedback onPress={() => Keyboard.dismiss()}>
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
            </TouchableWithoutFeedback>
        );
    }

    return (
        <>
            <FlatList
                ref={flatListRef}
                data={displayMessages}
                renderItem={renderMessage}
                keyExtractor={keyExtractor}
                style={[styles.container, { backgroundColor: theme.background }]}
                contentContainerStyle={styles.content}
                showsVerticalScrollIndicator={false}
                removeClippedSubviews
                maxToRenderPerBatch={10}
                windowSize={10}
                inverted={true}
                ListHeaderComponent={renderFooter}
                onScroll={handleScroll}
                scrollEventThrottle={16}
                onContentSizeChange={handleContentSizeChange}
            />

            <MessageActionModal
                visible={modalVisible}
                onClose={handleCloseModal}
                messageText={selectedMessageText}
                sourceLayout={sourceLayout}
            />
        </>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        paddingBottom: 20,
    },
    content: {
        padding: 16,
        paddingBottom: 0,
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
        ...commonStyles.shadow,
    },
    messageText: {
        lineHeight: 20,
    },
    aiMessageContainer: {
        marginVertical: 4,
        width: '100%',
    },
    streamingContainer: {
        paddingVertical: 8,
        width: '100%',
    },
    streamingIndicator: {
        paddingTop: 4,
        alignItems: 'flex-start',
    },
    streamingIndicatorText: {
        fontSize: 12,
        opacity: 0.7,
    },
    generatingText: {
        fontStyle: 'italic',
        fontSize: 15,
        fontFamily: fontWeights[500],
    },
    errorContainer: {
        paddingVertical: 12,
        paddingHorizontal: 16,
        ...commonStyles.centerContainer,
    },
    errorText: {
        fontSize: 14,
        textAlign: 'center',
    },
    emptyContainer: {
        ...commonStyles.flexCenter,
        paddingHorizontal: 32,
    },
    emptyText: {
        fontSize: 16,
        textAlign: 'center',
        fontStyle: 'italic',
    },
    thinkingContainer: {
        paddingTop: 16,
        paddingBottom: 12,
        paddingHorizontal: 0,
        alignItems: 'flex-start',
    },
    markdownContent: {
        flex: 1,
    },
});