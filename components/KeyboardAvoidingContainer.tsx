import React, { useEffect } from 'react';
import { Keyboard, KeyboardEvent, Platform } from 'react-native';
import Animated, {
    Easing,
    useAnimatedStyle,
    useSharedValue,
    withTiming,
} from 'react-native-reanimated';

interface KeyboardAvoidingContainerProps {
    children: React.ReactNode;
    style?: any;
}

export const KeyboardAvoidingContainer: React.FC<KeyboardAvoidingContainerProps> = ({
    children,
    style,
}) => {
    const translateY = useSharedValue(0);

    useEffect(() => {
        const keyboardWillShow = (event: KeyboardEvent) => {
            if (Platform.OS === 'ios') {
                translateY.value = withTiming(-event.endCoordinates.height, {
                    duration: 200,
                    easing: Easing.out(Easing.cubic),
                });
            }
        };

        const keyboardWillHide = (event: KeyboardEvent) => {
            translateY.value = withTiming(0, {
                duration: 180,
                easing: Easing.out(Easing.cubic),
            });
        };

        const keyboardDidShow = (event: KeyboardEvent) => {
            if (Platform.OS === 'android') {
                translateY.value = withTiming(-event.endCoordinates.height, {
                    duration: 160,
                    easing: Easing.out(Easing.cubic),
                });
            }
        };

        const keyboardDidHide = () => {
            if (Platform.OS === 'android') {
                translateY.value = withTiming(0, {
                    duration: 140,
                    easing: Easing.out(Easing.cubic),
                });
            }
        };

        const showListener = Platform.OS === 'ios'
            ? Keyboard.addListener('keyboardWillShow', keyboardWillShow)
            : Keyboard.addListener('keyboardDidShow', keyboardDidShow);

        const hideListener = Platform.OS === 'ios'
            ? Keyboard.addListener('keyboardWillHide', keyboardWillHide)
            : Keyboard.addListener('keyboardDidHide', keyboardDidHide);

        return () => {
            showListener.remove();
            hideListener.remove();
        };
    }, [translateY]);

    const animatedStyle = useAnimatedStyle(() => ({
        transform: [{ translateY: translateY.value }],
    }));

    return (
        <Animated.View style={[{ flex: 1 }, style, animatedStyle]}>
            {children}
        </Animated.View>
    );
}; 