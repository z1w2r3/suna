import { useTheme } from '@/hooks/useThemeColor';
import { ArrowUp, Mic, Paperclip, Square } from 'lucide-react-native';
import React, { useEffect, useState } from 'react';
import { Keyboard, KeyboardEvent, Platform, StyleSheet, TextInput, TouchableOpacity, View } from 'react-native';
import Animated, {
    Easing,
    Extrapolate,
    interpolate,
    useAnimatedStyle,
    useSharedValue,
    withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface ChatInputProps {
    onSendMessage: (message: string) => void;
    onAttachPress?: () => void;
    onMicPress?: () => void;
    onCancelStream?: () => void;
    placeholder?: string;
    isAtBottomOfChat?: boolean;
    isGenerating?: boolean;
    isSending?: boolean;
}

export const ChatInput: React.FC<ChatInputProps> = ({
    onSendMessage,
    onAttachPress,
    onMicPress,
    onCancelStream,
    placeholder = 'Ask Suna anything...',
    isAtBottomOfChat = true,
    isGenerating = false,
    isSending = false,
}) => {
    const [message, setMessage] = useState('');
    const theme = useTheme();
    const insets = useSafeAreaInsets();

    const keyboardHeight = useSharedValue(0);

    useEffect(() => {
        const handleKeyboardShow = (event: KeyboardEvent) => {
            keyboardHeight.value = withTiming(event.endCoordinates.height, {
                duration: 250,
                easing: Easing.out(Easing.quad),
            });
        };

        const handleKeyboardHide = () => {
            keyboardHeight.value = withTiming(0, {
                duration: 250,
                easing: Easing.out(Easing.quad),
            });
        };

        const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
        const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

        const showSubscription = Keyboard.addListener(showEvent, handleKeyboardShow);
        const hideSubscription = Keyboard.addListener(hideEvent, handleKeyboardHide);

        return () => {
            showSubscription.remove();
            hideSubscription.remove();
        };
    }, []);

    const handleSend = () => {
        if (message.trim()) {
            onSendMessage(message.trim());
            setMessage('');
        }
    };

    const containerStyle = useAnimatedStyle(() => {
        const paddingBottom = interpolate(
            keyboardHeight.value,
            [0, 300],
            [Math.max(insets.bottom, 20), 10],
            Extrapolate.CLAMP
        );

        return {
            paddingBottom,
        };
    });

    const fakeViewStyle = useAnimatedStyle(() => {
        return {
            height: keyboardHeight.value,
        };
    });

    const shouldShowCancel = isSending || isGenerating;

    return (
        <>
            <Animated.View style={[
                styles.container,
                {
                    backgroundColor: theme.sidebar,
                    borderTopLeftRadius: 30,
                    borderTopRightRadius: 30,
                    shadowColor: theme.border,
                    shadowOffset: { width: 0, height: -1 },
                    shadowOpacity: 1,
                    shadowRadius: 0,
                },
                containerStyle
            ]}>
                <View style={[styles.inputContainer, { backgroundColor: theme.sidebar }]}>
                    <TextInput
                        style={[styles.textInput, { color: theme.foreground }]}
                        value={message}
                        onChangeText={setMessage}
                        placeholder={placeholder}
                        placeholderTextColor={theme.placeholderText}
                        multiline
                        maxLength={2000}
                        returnKeyType="send"
                        onSubmitEditing={handleSend}
                        blurOnSubmit={false}
                    />

                    <View style={styles.buttonContainer}>
                        <TouchableOpacity style={styles.actionButton} onPress={onAttachPress}>
                            <Paperclip size={20} strokeWidth={2} color={theme.placeholderText} />
                        </TouchableOpacity>

                        <View style={styles.rightButtons}>
                            <TouchableOpacity style={styles.actionButton} onPress={onMicPress}>
                                <Mic size={20} strokeWidth={2} color={theme.placeholderText} style={{ marginRight: 10 }} />
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={[styles.sendButton, {
                                    backgroundColor: shouldShowCancel || message.trim()
                                        ? theme.activeButton
                                        : theme.inactiveButton
                                }]}
                                onPress={shouldShowCancel ? onCancelStream : handleSend}
                                disabled={!shouldShowCancel && !message.trim()}
                            >
                                {shouldShowCancel ? (
                                    <Square
                                        size={16}
                                        strokeWidth={2}
                                        color={theme.background}
                                        fill={theme.background}
                                    />
                                ) : (
                                    <ArrowUp
                                        size={19}
                                        strokeWidth={3}
                                        color={message.trim() ? theme.background : theme.disabledText}
                                    />
                                )}
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Animated.View>
            {/* Fake view that ALWAYS pushes content up */}
            <Animated.View style={fakeViewStyle} />
        </>
    );
};

const styles = StyleSheet.create({
    container: {
        paddingHorizontal: 10,
        paddingVertical: 12,
    },
    inputContainer: {
        borderRadius: 20,
        paddingHorizontal: 16,
        paddingVertical: 12,
    },
    textInput: {
        fontSize: 16,
        maxHeight: 100,
        backgroundColor: 'transparent',
        marginBottom: 8,
        ...Platform.select({
            ios: {
                paddingTop: 12,
            },
        }),
    },
    buttonContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    rightButtons: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    actionButton: {
        width: 22,
        height: 44,
        borderRadius: 22,
        justifyContent: 'center',
        alignItems: 'center',
    },
    sendButton: {
        width: 36,
        height: 36,
        borderRadius: 16,
        justifyContent: 'center',
        alignItems: 'center',
    },
    attachIcon: {
        width: 16,
        height: 16,
        borderRadius: 2,
    },
    micIcon: {
        width: 14,
        height: 14,
        borderRadius: 7,
    },
    sendIcon: {
        width: 0,
        height: 0,
        borderStyle: 'solid',
        borderLeftWidth: 14,
        borderRightWidth: 0,
        borderBottomWidth: 7,
        borderTopWidth: 7,
        borderTopColor: 'transparent',
        borderBottomColor: 'transparent',
    },
}); 