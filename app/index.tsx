import { AuthOverlay } from '@/components/AuthOverlay';
import { ChatContainer } from '@/components/ChatContainer';
import { ChatHeader } from '@/components/ChatHeader';
import { PanelContainer } from '@/components/PanelContainer';
import { useHeaderHeight } from '@/constants/SafeArea';
import { useAuth } from '@/hooks/useAuth';
import { useThemedStyles } from '@/hooks/useThemeColor';
import React, { useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function HomeScreen() {
    const [currentSessionId] = useState('default-session');
    const [leftPanelVisible, setLeftPanelVisible] = useState(false);
    const [rightPanelVisible, setRightPanelVisible] = useState(false);
    const [authOverlayVisible, setAuthOverlayVisible] = useState(false);

    const { user, loading } = useAuth();
    const insets = useSafeAreaInsets();
    const headerHeight = useHeaderHeight();

    const toggleLeftPanel = () => setLeftPanelVisible(!leftPanelVisible);
    const toggleRightPanel = () => setRightPanelVisible(!rightPanelVisible);

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
            marginTop: headerHeight,
        },
        loadingContainer: {
            flex: 1,
            justifyContent: 'center' as const,
            alignItems: 'center' as const,
            backgroundColor: theme.background,
        },
    }));

    // Show loading screen while checking auth
    if (loading) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={styles.container.backgroundColor} />
            </View>
        );
    }

    // Show auth overlay if user is not authenticated
    if (!user) {
        return (
            <View style={styles.container}>
                <AuthOverlay
                    visible={true}
                    onClose={() => { }} // User can't close this overlay manually
                />
            </View>
        );
    }

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

                {/* Auth overlay for manual auth actions */}
                <AuthOverlay
                    visible={authOverlayVisible}
                    onClose={() => setAuthOverlayVisible(false)}
                />
            </View>
        </PanelContainer>
    );
} 