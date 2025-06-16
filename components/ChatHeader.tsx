import { useTheme } from '@/hooks/useThemeColor';
import { PanelLeft, PanelRightOpen } from 'lucide-react-native';
import React from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { H4 } from './Typography';

interface ChatHeaderProps {
    onMenuPress?: () => void;
    onSettingsPress?: () => void;
}

export const ChatHeader: React.FC<ChatHeaderProps> = ({
    onMenuPress,
    onSettingsPress,
}) => {
    const theme = useTheme();
    const insets = useSafeAreaInsets();

    return (
        <View style={[styles.container, {
            backgroundColor: theme.background,
            borderBottomColor: theme.border,
            paddingTop: insets.top + 12,
        }]}>
            <TouchableOpacity style={styles.button} onPress={onMenuPress}>
                <PanelLeft size={20} color={theme.foreground} />
            </TouchableOpacity>

            <H4 style={{ color: theme.foreground }}>Suna</H4>

            <TouchableOpacity style={styles.button} onPress={onSettingsPress}>
                <PanelRightOpen size={20} color={theme.foreground} />
            </TouchableOpacity>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderBottomWidth: 1,
    },
    button: {
        padding: 8,
        borderRadius: 8,
    },
}); 