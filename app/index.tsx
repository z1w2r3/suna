import { ChatContainer } from '@/components/ChatContainer';
import { ChatHeader } from '@/components/ChatHeader';
import { PanelContainer } from '@/components/PanelContainer';
import { useThemedStyles } from '@/hooks/useThemeColor';
import { useLeftPanelVisible, useRightPanelVisible, useSetLeftPanelVisible, useSetRightPanelVisible, useToggleLeftPanel, useToggleRightPanel } from '@/stores/ui-store';
import React, { useState } from 'react';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function HomeScreen() {
    const [currentSessionId] = useState('default-session');
    const insets = useSafeAreaInsets();

    // Zustand panel state
    const leftPanelVisible = useLeftPanelVisible();
    const rightPanelVisible = useRightPanelVisible();
    const setLeftPanelVisible = useSetLeftPanelVisible();
    const setRightPanelVisible = useSetRightPanelVisible();
    const toggleLeftPanel = useToggleLeftPanel();
    const toggleRightPanel = useToggleRightPanel();

    const styles = useThemedStyles((theme) => ({
        container: {
            flex: 1,
            backgroundColor: theme.background,
        },
        header: {
            position: 'absolute' as const,
            top: 0,
            left: 0,
            right: 0,
            zIndex: 1000,
            backgroundColor: theme.background,
        },
        chatContainer: {
            flex: 1,
            marginTop: insets.top + 12 + 24 + 1, // insets.top + paddingTop + paddingVertical + border
        },
    }));

    return (
        <PanelContainer
            leftPanelVisible={leftPanelVisible}
            rightPanelVisible={rightPanelVisible}
            onCloseLeft={() => setLeftPanelVisible(false)}
            onCloseRight={() => setRightPanelVisible(false)}
            onOpenLeft={() => setLeftPanelVisible(true)}
        >
            <View style={styles.container}>
                <View style={styles.header}>
                    <ChatHeader
                        onMenuPress={toggleLeftPanel}
                        onSettingsPress={toggleRightPanel}
                    />
                </View>
                <View style={styles.chatContainer}>
                    <ChatContainer sessionId={currentSessionId} />
                </View>
            </View>
        </PanelContainer>
    );
} 