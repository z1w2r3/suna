import { useThemedStyles } from '@/hooks/useThemeColor';
import { X } from 'lucide-react-native';
import React from 'react';
import { TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Body, H3 } from './Typography';

interface LeftPanelProps {
    isVisible: boolean;
    onClose: () => void;
}

export const LeftPanel: React.FC<LeftPanelProps> = ({ isVisible, onClose }) => {
    const insets = useSafeAreaInsets();

    const styles = useThemedStyles((theme) => ({
        panel: {
            backgroundColor: theme.sidebar,
            width: 280,
            height: '100%' as const,
            paddingTop: insets.top,
            paddingBottom: insets.bottom,
            paddingHorizontal: 20,
        },
        header: {
            flexDirection: 'row' as const,
            justifyContent: 'space-between' as const,
            alignItems: 'center' as const,
            paddingBottom: 20,
            borderBottomWidth: 1,
            borderBottomColor: theme.border,
            marginBottom: 20,
        },
        title: {
            color: theme.foreground,
        },
        closeButton: {
            width: 32,
            height: 32,
            borderRadius: 16,
            backgroundColor: theme.mutedWithOpacity(0.1),
            justifyContent: 'center' as const,
            alignItems: 'center' as const,
        },
        content: {
            flex: 1,
        },
        placeholderText: {
            color: theme.placeholderText,
        },
    }));

    if (!isVisible) return null;

    return (
        <View style={styles.panel}>
            <View style={styles.header}>
                <H3 style={styles.title}>Suna</H3>
                <TouchableOpacity style={styles.closeButton} onPress={onClose}>
                    <X size={16} color={styles.placeholderText.color} />
                </TouchableOpacity>
            </View>

            <View style={styles.content}>
                <Body style={styles.placeholderText}>
                    Panel content goes here...
                </Body>
            </View>
        </View>
    );
}; 