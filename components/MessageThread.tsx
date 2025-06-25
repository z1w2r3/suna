import { Message } from '@/api/chat-api';
import { commonStyles } from '@/constants/CommonStyles';
import { fontWeights } from '@/constants/Fonts';
import { useTheme } from '@/hooks/useThemeColor';
import { useCurrentTool, useIsGenerating, useOpenToolView, useSelectedProject, useUpdateToolSnapshots } from '@/stores/ui-store';
import { parseFileAttachments } from '@/utils/file-parser';
import { Markdown } from '@/utils/markdown-renderer';
import { parseMessage, processStreamContent } from '@/utils/message-parser';
import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FlatList, Keyboard, StyleSheet, TouchableOpacity, View } from 'react-native';
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
    isStreaming?: boolean;
    streamContent?: string;
    isHidden?: boolean;
    onLongPress?: (messageText: string, layout: { x: number; y: number; width: number; height: number }, messageId: string) => void;
    onToolPress?: (toolCall: any, messageId: string) => void;
}

const MessageItem = memo<MessageItemProps>(({ message, sandboxId, isStreaming, streamContent, isHidden, onLongPress, onToolPress }) => {
    const theme = useTheme();
    const messageRef = useRef<View>(null);

    const parsedMessage = useMemo(() => parseMessage(message), [message]);

    const streamProcessed = useMemo(() =>
        isStreaming && streamContent ? processStreamContent(streamContent) : null,
        [isStreaming, streamContent]);

    // Apply file parsing to the already-cleaned content from parseMessage
    const { attachments, cleanContent: fileCleanContent } = useMemo(() =>
        parseFileAttachments(parsedMessage.cleanContent), [parsedMessage.cleanContent]);

    const displayContent = useMemo(() => {
        if (isStreaming && streamProcessed) {
            // For streaming, use stream content if available, otherwise use file-cleaned content
            return streamProcessed.cleanContent || fileCleanContent;
        }
        // Use the file-cleaned content (which removes file attachments from already-cleaned content)
        return fileCleanContent;
    }, [isStreaming, streamProcessed, fileCleanContent]);

    const handleLongPress = () => {
        if (messageRef.current) {
            messageRef.current.measure((x, y, width, height, pageX, pageY) => {
                onLongPress?.(displayContent, { x: pageX, y: pageY, width, height }, message.message_id);
            });
        }
    };

    const handleFilePress = (filepath: string) => {
        // Handle file press - could open file viewer or download
        console.log('File pressed:', filepath);
    };

    const isUser = message.type === 'user';

    // Debug logging for message type
    if (attachments.length > 0) {
        console.log(`[MessageThread] Message ${message.message_id}: type="${message.type}", isUser=${isUser}, attachments=${attachments.length}`);
    }

    if (isUser) {
        const bubbleColor = theme.messageBubble;

        return (
            <View style={[styles.messageContainer, { alignSelf: 'flex-end' }, isHidden && { opacity: 0 }]}>
                <TouchableOpacity
                    ref={messageRef}
                    onLongPress={handleLongPress}
                    delayLongPress={500}
                    activeOpacity={0.8}
                >
                    <Animated.View style={[styles.messageBubble, { backgroundColor: bubbleColor }]}>
                        <Body style={[styles.messageText, { color: theme.userMessage }]}>
                            {displayContent}
                        </Body>

                        {/* Render file attachments for user messages */}
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
                {displayContent && (
                    <Markdown style={[styles.markdownContent]}>
                        {displayContent}
                    </Markdown>
                )}

                {/* Render file attachments for AI messages */}
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

                {isStreaming && (
                    <View style={styles.streamingIndicator}>
                        <Body style={[styles.streamingIndicatorText, { color: theme.mutedForeground }]}>
                            ●
                        </Body>
                    </View>
                )}
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
    isLoadingMessages?: boolean;
    onScrollPositionChange?: (isAtBottom: boolean) => void;
    keyboardHeight?: number;
}

// Shimmer component for thinking animation
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
    streamContent = '',
    streamError,
    isLoadingMessages = false,
    onScrollPositionChange,
    keyboardHeight = 0,
}) => {
    const theme = useTheme();
    const selectedProject = useSelectedProject();
    const flatListRef = useRef<FlatList>(null);
    const [isAtBottom, setIsAtBottom] = useState(true);
    const currentScrollOffset = useRef(0);
    const isFirstLoad = useRef(true);

    // Get sandboxId from selected project
    const sandboxId = selectedProject?.sandbox?.id;

    // Modal state
    const [modalVisible, setModalVisible] = useState(false);
    const [selectedMessageText, setSelectedMessageText] = useState('');
    const [selectedMessageId, setSelectedMessageId] = useState<string | null>(null);
    const [sourceLayout, setSourceLayout] = useState<{ x: number; y: number; width: number; height: number } | undefined>();

    const currentTool = useCurrentTool();
    const isGeneratingFromStore = useIsGenerating();
    const openToolView = useOpenToolView();
    const updateToolSnapshots = useUpdateToolSnapshots();

    const showGenerating = isGenerating || isGeneratingFromStore;
    const prevShowGenerating = useRef(showGenerating);

    // Update tool snapshots whenever messages change
    useEffect(() => {
        if (messages.length > 0) {
            updateToolSnapshots(messages);
        }
    }, [messages, updateToolSnapshots]);

    const handleToolPress = useCallback((toolCall: any, messageId: string) => {
        // Store handles both tool selection and panel opening
        openToolView(toolCall, messageId);
    }, [openToolView]);

    const displayMessages = useMemo(() => {
        // If not generating or no stream content, just show regular messages
        if (!showGenerating || !streamContent) {
            return messages.slice().reverse(); // Reverse for inverted list
        }

        const lastMessage = messages[messages.length - 1];
        const isLastMessageFromAI = lastMessage && lastMessage.type === 'assistant';

        // Check if the last message contains similar content to the stream
        // This prevents duplicates when Supabase refetches the completed message
        if (isLastMessageFromAI && streamContent) {
            const lastMessageContent = typeof lastMessage.content === 'string'
                ? lastMessage.content
                : JSON.stringify(lastMessage.content);

            // If the last message contains most of the streamed content, don't show streaming message
            const streamWords = streamContent.trim().split(/\s+/).slice(0, 10).join(' '); // First 10 words
            if (streamWords.length > 20 && lastMessageContent.includes(streamWords)) {
                console.log('[MessageThread] Detected duplicate - using Supabase message instead of streaming');
                return messages.slice().reverse(); // Use the real message from Supabase, reversed
            }
        }

        // If there's stream content, show it as a streaming message
        const streamingMessage: Message = {
            message_id: 'streaming-temp',
            thread_id: messages[0]?.thread_id || '',
            type: 'assistant',
            is_llm_message: true,
            content: streamContent, // Use raw stream content
            metadata: {},
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
        };

        return [...messages, streamingMessage].slice().reverse(); // Reverse for inverted list
    }, [messages, streamContent, showGenerating]);

    // Simplified - no more complex scroll logic needed for initial load
    const handleContentSizeChange = useCallback(() => {
        // Only scroll during active streaming
        if (showGenerating && flatListRef.current) {
            flatListRef.current.scrollToOffset({ offset: 0, animated: true });
        }
    }, [showGenerating]);

    // Auto-scroll to bottom and dismiss keyboard when streaming starts
    useEffect(() => {
        if (showGenerating && !prevShowGenerating.current) {
            // Dismiss keyboard immediately
            Keyboard.dismiss();

            // For inverted list, scroll to offset 0 (which is the bottom)
            setTimeout(() => {
                if (flatListRef.current) {
                    flatListRef.current.scrollToOffset({ offset: 0, animated: true });
                }
            }, 50);
        }
        prevShowGenerating.current = showGenerating;
    }, [showGenerating]);

    // Enhanced auto-scroll during streaming - for inverted list
    useEffect(() => {
        if (showGenerating && streamContent && flatListRef.current) {
            // For inverted list, scroll to offset 0 to stay at bottom
            flatListRef.current.scrollToOffset({ offset: 0, animated: true });
        }
    }, [streamContent, showGenerating]);

    // Simplified keyboard handling - for inverted list
    React.useEffect(() => {
        if (keyboardHeight > 0 && flatListRef.current) {
            setTimeout(() => {
                flatListRef.current?.scrollToOffset({ offset: 0, animated: true });
            }, 100);
        }
    }, [keyboardHeight]);

    // Remove all the complex initial load logic - not needed with inverted list

    const handleScroll = useCallback((event: any) => {
        const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
        currentScrollOffset.current = contentOffset.y;

        // For inverted list, isAtBottom is when contentOffset.y is close to 0
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

    const renderMessage = ({ item, index }: { item: Message; index: number }) => {
        const isLastMessage = index === displayMessages.length - 1;
        const isStreamingMessage = item.message_id === 'streaming-temp';

        // Parse the message to check if it's a tool result
        const parsed = parseMessage(item);

        // Skip rendering pure tool result messages
        if (parsed.isToolResultMessage && !parsed.cleanContent.trim()) {
            return null;
        }

        return (
            <MessageItem
                message={item}
                sandboxId={sandboxId}
                isStreaming={isStreamingMessage && showGenerating}
                streamContent={isStreamingMessage ? streamContent : undefined}
                isHidden={item.message_id === selectedMessageId}
                onLongPress={handleLongPress}
                onToolPress={handleToolPress}
            />
        );
    };

    const keyExtractor = (item: Message) => item.message_id;

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

        if (!streamContent) {
            return (
                <View style={styles.thinkingContainer}>
                    <ThinkingText color={theme.placeholderText}>
                        {currentTool ? `${currentTool.name} is thinking...` : 'Suna is thinking...'}
                    </ThinkingText>
                </View>
            );
        }

        // Check if we have a detected tool name from stream
        const streamProcessed = processStreamContent(streamContent);
        if (streamProcessed.currentToolName && streamProcessed.isStreamingTool) {
            return (
                <View style={styles.thinkingContainer}>
                    <ThinkingText color={theme.placeholderText}>
                        {`${streamProcessed.currentToolName} is running...`}
                    </ThinkingText>
                </View>
            );
        }

    };

    if (isLoadingMessages && messages.length === 0) {
        return (
            <View style={[styles.container, { backgroundColor: theme.background }]}>
                <SkeletonChatMessages />
            </View>
        );
    }

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
    aiMessageText: {
        lineHeight: 20,
        paddingVertical: 8,
        padding: 0,
        margin: 0,
        borderWidth: 0,
        backgroundColor: 'transparent',
        fontSize: 16,
        fontFamily: 'System',
    },
    streamingIndicator: {
        fontSize: 12,
        marginLeft: 4,
        opacity: 0.7,
    },
    generatingContainer: {
        paddingVertical: 12,
        paddingHorizontal: 16,
        ...commonStyles.centerContainer,
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
        paddingTop: 0,
        paddingBottom: 24,
        paddingHorizontal: 0,
        alignItems: 'flex-start',
    },
    streamingIndicatorText: {
        fontSize: 12,
        marginLeft: 4,
        opacity: 0.7,
    },
    markdownContent: {
        flex: 1,
    },
});