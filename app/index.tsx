import { AuthOverlay } from '@/components/AuthOverlay';
import { ChatContainer } from '@/components/ChatContainer';
import { ChatHeader } from '@/components/ChatHeader';
import { PanelContainer } from '@/components/PanelContainer';
import { Skeleton } from '@/components/Skeleton';
import { useHeaderHeight } from '@/constants/SafeArea';
import { useAuth } from '@/hooks/useAuth';
import { useChatContext } from '@/hooks/useChatContext';
import { useChatSession } from '@/hooks/useChatHooks';
import { useThemedStyles } from '@/hooks/useThemeColor';
import {
    useLeftPanelVisible,
    useRightPanelVisible,
    useSetLeftPanelVisible,
    useSetRightPanelVisible
} from '@/stores/ui-store';
import React, { useState } from 'react';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function HomeScreen() {
    // Use store state instead of local state for panel visibility
    const leftPanelVisible = useLeftPanelVisible();
    const rightPanelVisible = useRightPanelVisible();
    const setLeftPanelVisible = useSetLeftPanelVisible();
    const setRightPanelVisible = useSetRightPanelVisible();

    const [authOverlayVisible, setAuthOverlayVisible] = useState(false);

    const { user, loading } = useAuth();
    const { selectedProject } = useChatContext();
    const insets = useSafeAreaInsets();
    const headerHeight = useHeaderHeight();

    // Get messages from chat session
    const { messages } = useChatSession(selectedProject?.id || '');

    const toggleLeftPanel = () => setLeftPanelVisible(!leftPanelVisible);
    const toggleRightPanel = () => setRightPanelVisible(!rightPanelVisible);

    const styles = useThemedStyles((theme) => ({
        container: {
            flex: 1,
            backgroundColor: theme.background,
        },
        header: {
            backgroundColor: theme.background,
            borderBottomWidth: 1,
            borderBottomColor: theme.border,
            justifyContent: 'center' as const,
        },
        chatContainer: {
            flex: 1,
        },
    }));

    if (loading) {
        return (
            <View style={styles.container}>
                <Skeleton />
            </View>
        );
    }

    if (!user) {
        return (
            <View style={styles.container}>
                <View style={styles.header}>
                    <ChatHeader
                        onMenuPress={toggleLeftPanel}
                        onSettingsPress={toggleRightPanel}
                        selectedProject={selectedProject}
                    />
                </View>
                <View style={styles.chatContainer}>
                    <ChatContainer />
                </View>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <PanelContainer
                leftPanelVisible={leftPanelVisible}
                rightPanelVisible={rightPanelVisible}
                onCloseLeft={() => {
                    console.log('onCloseLeft called');
                    setLeftPanelVisible(false);
                }}
                onCloseRight={() => setRightPanelVisible(false)}
                onOpenLeft={() => setLeftPanelVisible(true)}
                messages={messages}
            >
                <View style={styles.header}>
                    <ChatHeader
                        onMenuPress={toggleLeftPanel}
                        onSettingsPress={toggleRightPanel}
                        selectedProject={selectedProject}
                    />
                </View>
                <View style={styles.chatContainer}>
                    <ChatContainer />
                </View>
            </PanelContainer>

            <AuthOverlay
                visible={authOverlayVisible}
                onClose={() => setAuthOverlayVisible(false)}
            />
        </View>
    );
} 