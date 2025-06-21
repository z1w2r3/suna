import { Message } from '@/api/chat-api';
import { commonStyles } from '@/constants/CommonStyles';
import { useTheme } from '@/hooks/useThemeColor';
import { useCurrentTool, useIsGenerating } from '@/stores/ui-store';
import React, { memo, useCallback, useMemo, useRef, useState } from 'react';
import { FlatList, StyleSheet, TextInput, TouchableOpacity, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { MessageActionModal } from './MessageActionModal';
import { SkeletonChatMessages } from './Skeleton';
import { Body } from './Typography';

interface MessageItemProps {
    message: Message;
    isStreaming?: boolean;
    streamContent?: string;
    isHidden?: boolean;
    onLongPress?: (messageText: string, layout: { x: number; y: number; width: number; height: number }, messageId: string) => void;
}

const MessageItem = memo<MessageItemProps>(({ message, isStreaming, streamContent, isHidden, onLongPress }) => {
    const theme = useTheme();
    const messageRef = useRef<View>(null);

    const parsedContent = useMemo(() => {
        try {
            if (typeof message.content === 'string') {
                try {
                    const parsed = JSON.parse(message.content);
                    return parsed.content || message.content;
                } catch {
                    return message.content;
                }
            } else if (typeof message.content === 'object' && message.content !== null) {
                return message.content.content || JSON.stringify(message.content);
            }
            return String(message.content);
        } catch {
            return String(message.content);
        }
    }, [message.content]);

    const handleLongPress = () => {
        if (messageRef.current) {
            messageRef.current.measure((x, y, width, height, pageX, pageY) => {
                onLongPress?.(parsedContent, { x: pageX, y: pageY, width, height }, message.message_id);
            });
        }
    };

    const isUser = message.type === 'user';

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
                            {parsedContent}
                        </Body>
                    </Animated.View>
                </TouchableOpacity>
            </View>
        );
    } else {
        // AI messages full width, no bubble - with partial text selection
        const displayContent = isStreaming ? streamContent : parsedContent;

        return (
            <View style={styles.aiMessageContainer}>
                <TextInput
                    value={displayContent}
                    style={[styles.aiMessageText, { color: theme.aiMessage }]}
                    editable={false}
                    multiline={true}
                    scrollEnabled={false}
                    selectTextOnFocus={false}
                />
                {isStreaming && (
                    <Body style={[styles.streamingIndicator, { color: theme.mutedForeground }]}>
                        ●
                    </Body>
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
    const flatListRef = useRef<FlatList>(null);
    const [isAtBottom, setIsAtBottom] = useState(true);
    const currentScrollOffset = useRef(0);
    const isFirstLoad = useRef(true);

    // Modal state
    const [modalVisible, setModalVisible] = useState(false);
    const [selectedMessageText, setSelectedMessageText] = useState('');
    const [selectedMessageId, setSelectedMessageId] = useState<string | null>(null);
    const [sourceLayout, setSourceLayout] = useState<{ x: number; y: number; width: number; height: number } | undefined>();

    const currentTool = useCurrentTool();
    const isGeneratingFromStore = useIsGenerating();

    const showGenerating = isGenerating || isGeneratingFromStore;

    const handleScroll = useCallback((event: any) => {
        const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
        currentScrollOffset.current = contentOffset.y;

        const isScrolledToBottom = contentOffset.y + layoutMeasurement.height >= contentSize.height - 50;

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

    const displayMessages = useMemo(() => {
        if (!showGenerating || !streamContent) {
            return messages;
        }

        const lastMessage = messages[messages.length - 1];
        const isLastMessageFromAI = lastMessage && lastMessage.type === 'assistant';

        if (isLastMessageFromAI && streamContent) {
            return [
                ...messages.slice(0, -1),
                {
                    ...lastMessage,
                    content: JSON.stringify({ content: streamContent }),
                }
            ];
        } else if (streamContent) {
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

    const handleContentSizeChange = useCallback(() => {
        if (isAtBottom && flatListRef.current) {
            flatListRef.current.scrollToEnd({ animated: false });
        }
        if (isFirstLoad.current && messages.length > 0 && flatListRef.current) {
            setTimeout(() => {
                flatListRef.current?.scrollToEnd({ animated: false });
                setIsAtBottom(true);
            }, 10);
        }
    }, [isAtBottom, messages.length]);

    React.useEffect(() => {
        if (isAtBottom && keyboardHeight > 0 && flatListRef.current) {
            setTimeout(() => {
                flatListRef.current?.scrollToEnd({ animated: true });
            }, 150);
        } else if (isAtBottom && keyboardHeight === 0 && flatListRef.current) {
            setTimeout(() => {
                flatListRef.current?.scrollToEnd({ animated: true });
            }, 150);
        }
    }, [keyboardHeight, isAtBottom]);

    React.useEffect(() => {
        if (messages.length > 0 && flatListRef.current) {
            const delay = isFirstLoad.current ? 200 : 50;
            setTimeout(() => {
                flatListRef.current?.scrollToEnd({ animated: false });
                setIsAtBottom(true);
                isFirstLoad.current = false;
            }, delay);
        }
    }, [messages, messages[0]?.thread_id, isLoadingMessages]);

    const renderMessage = ({ item, index }: { item: Message; index: number }) => {
        const isLastMessage = index === displayMessages.length - 1;
        const isStreamingMessage = item.message_id === 'streaming-temp';

        return (
            <MessageItem
                message={item}
                isStreaming={isStreamingMessage && showGenerating}
                streamContent={isStreamingMessage ? streamContent : undefined}
                isHidden={item.message_id === selectedMessageId}
                onLongPress={handleLongPress}
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
                <View style={styles.generatingContainer}>
                    <Body style={[styles.generatingText, { color: theme.placeholderText }]}>
                        {currentTool ? `${currentTool.name} is thinking...` : 'Generating response...'}
                    </Body>
                </View>
            );
        }

        return null;
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
                ListFooterComponent={renderFooter}
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
        fontSize: 14,
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
});