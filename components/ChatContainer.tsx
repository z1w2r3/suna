import {
    useCurrentTool,
    useIsGenerating,
    useSetIsGenerating,
    useUpdateChatState,
} from '@/stores/ui-store';
import React, { useEffect, useState } from 'react';
import { Keyboard, KeyboardAvoidingView, Platform, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChatInput } from './ChatInput';
import { Message, MessageThread } from './MessageThread';

interface ChatContainerProps {
    sessionId: string;
}

// Mock data for development
const mockMessages: Message[] = [
    {
        id: '1',
        text: 'Hello! How can I help you today?',
        isUser: false,
        timestamp: new Date(Date.now() - 60000),
    },
    {
        id: '2',
        text: 'Hi there! I need help with React Native development.',
        isUser: true,
        timestamp: new Date(Date.now() - 30000),
    },
    {
        id: '3',
        text: 'I\'d be happy to help you with React Native! What specific aspect would you like to work on?',
        isUser: false,
        timestamp: new Date(),
    },
];

export const ChatContainer: React.FC<ChatContainerProps> = ({ sessionId }) => {
    // Use local state for mock data
    const [messages, setMessages] = useState<Message[]>(mockMessages);
    const [isLoading, setIsLoading] = useState(false);
    const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);
    const insets = useSafeAreaInsets();

    // Keyboard visibility detection
    useEffect(() => {
        const keyboardShow = () => setIsKeyboardVisible(true);
        const keyboardHide = () => setIsKeyboardVisible(false);

        const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
        const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

        const showSubscription = Keyboard.addListener(showEvent, keyboardShow);
        const hideSubscription = Keyboard.addListener(hideEvent, keyboardHide);

        return () => {
            showSubscription?.remove();
            hideSubscription?.remove();
        };
    }, []);

    // Zustand: Atomic selectors to prevent infinite loops
    const currentTool = useCurrentTool();
    const isGenerating = useIsGenerating();

    // Zustand: Actions (stable references)
    const setIsGenerating = useSetIsGenerating();
    const updateChatState = useUpdateChatState();

    // Handle sending messages
    const handleSendMessage = async (message: string) => {
        if (!message.trim() || isGenerating) return;

        try {
            // Update UI state immediately
            updateChatState({
                isGenerating: true,
                inputDraft: '', // Clear draft
                isTyping: false,
            });

            // Add user message immediately
            const userMessage: Message = {
                id: Date.now().toString(),
                text: message.trim(),
                isUser: true,
                timestamp: new Date(),
            };

            setMessages(prev => [...prev, userMessage]);

            // Simulate AI response after a delay
            setTimeout(() => {
                const aiMessage: Message = {
                    id: (Date.now() + 1).toString(),
                    text: `I received your message: "${message.trim()}". This is a mock response for development.`,
                    isUser: false,
                    timestamp: new Date(),
                };

                setMessages(prev => [...prev, aiMessage]);
                setIsGenerating(false);
            }, 1500);

        } catch (error) {
            console.error('Failed to send message:', error);
            // Restore draft on error
            updateChatState({
                inputDraft: message,
                isGenerating: false,
            });
        }
    };

    if (isLoading) {
        return (
            <View style={styles.container}>
                {/* Add loading component here */}
            </View>
        );
    }

    // Calculate header height: insets.top + paddingTop(12) + paddingVertical(12) + border(1)
    const headerHeight = insets.top + 12 + 24 + 1;

    return (
        <KeyboardAvoidingView
            style={styles.container}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            keyboardVerticalOffset={headerHeight}
        >
            <MessageThread
                messages={messages}
                sessionId={sessionId}
            />
            <ChatInput
                onSendMessage={handleSendMessage}
                isKeyboardVisible={isKeyboardVisible}
                placeholder={
                    isGenerating
                        ? (currentTool ? `${currentTool.name} is working...` : 'Generating...')
                        : 'Type your message...'
                }
            />
        </KeyboardAvoidingView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: 'transparent',
    },
}); 