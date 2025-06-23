import Slider from '@react-native-community/slider';
import { ChevronLeft, ChevronRight, CircleDashed, Computer, X } from 'lucide-react-native';
import React, { useCallback, useEffect } from 'react';
import { Dimensions, ScrollView, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Message } from '@/api/chat-api';
import { useTheme, useThemedStyles } from '@/hooks/useThemeColor';
import {
    useCloseToolView,
    useIsGenerating,
    useJumpToLatest,
    useNavigateToSnapshot,
    useSetNavigationMode,
    useToolViewState,
    useUpdateToolSnapshots
} from '@/stores/ui-store';
import { GenericToolView } from './ToolViews/GenericToolView';
import { Body, Caption, H4 } from './Typography';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface RightPanelProps {
    isVisible: boolean;
    onClose: () => void;
    messages?: Message[];
}

export const RightPanel: React.FC<RightPanelProps> = ({ isVisible, onClose, messages = [] }) => {
    const insets = useSafeAreaInsets();
    const theme = useTheme();
    const toolViewState = useToolViewState();
    const closeToolView = useCloseToolView();
    const updateToolSnapshots = useUpdateToolSnapshots();
    const navigateToSnapshot = useNavigateToSnapshot();
    const jumpToLatest = useJumpToLatest();
    const setNavigationMode = useSetNavigationMode();
    const isGenerating = useIsGenerating();

    const {
        toolCallSnapshots,
        currentSnapshotIndex,
        navigationMode,
        selectedToolCall
    } = toolViewState;

    // Update tool snapshots when messages change
    useEffect(() => {
        if (messages.length > 0) {
            updateToolSnapshots(messages);
        }
    }, [messages, updateToolSnapshots]);

    const styles = useThemedStyles((theme) => ({
        panel: {
            backgroundColor: theme.sidebar,
            flex: 1,
            height: '100%' as const,
            paddingTop: insets.top,
            paddingBottom: insets.bottom,
        },
        header: {
            flexDirection: 'row' as const,
            justifyContent: 'space-between' as const,
            alignItems: 'center' as const,
            paddingHorizontal: 16,
            paddingVertical: 12,
            borderBottomWidth: 1,
            borderBottomColor: theme.border,
        },
        headerLeft: {
            flexDirection: 'row' as const,
            alignItems: 'center' as const,
            flex: 1,
        },
        headerActions: {
            flexDirection: 'row' as const,
            alignItems: 'center' as const,
        },
        title: {
            color: theme.foreground,
            marginLeft: 8,
        },
        closeButton: {
            width: 32,
            height: 32,
            borderRadius: 16,
            backgroundColor: theme.muted + '20',
            justifyContent: 'center' as const,
            alignItems: 'center' as const,
        },
        content: {
            flex: 1,
        },
        emptyContainer: {
            flex: 1,
            justifyContent: 'center' as const,
            alignItems: 'center' as const,
            paddingHorizontal: 32,
        },
        emptyIcon: {
            width: 64,
            height: 64,
            borderRadius: 32,
            backgroundColor: theme.muted + '20',
            justifyContent: 'center' as const,
            alignItems: 'center' as const,
            marginBottom: 16,
        },
        emptyTitle: {
            color: theme.foreground,
            textAlign: 'center' as const,
            marginBottom: 8,
        },
        emptySubtitle: {
            color: theme.mutedForeground,
            textAlign: 'center' as const,
            lineHeight: 20,
        },
        // Timeline controls at bottom
        timelineContainer: {
            borderTopWidth: 1,
            borderTopColor: theme.border,
            backgroundColor: theme.muted + '10',
            paddingHorizontal: 16,
            paddingVertical: 12,
        },
        timelineControls: {
            flexDirection: 'row' as const,
            alignItems: 'center' as const,
        },
        navButton: {
            width: 28,
            height: 28,
            borderRadius: 14,
            backgroundColor: theme.muted + '20',
            justifyContent: 'center' as const,
            alignItems: 'center' as const,
        },
        navButtonDisabled: {
            opacity: 0.5,
        },
        counter: {
            color: theme.mutedForeground,
            fontSize: 12,
            fontFamily: 'monospace',
            minWidth: 50,
            textAlign: 'center' as const,
            marginHorizontal: 8,
        },
        slider: {
            flex: 1,
            marginHorizontal: 12,
        },
        statusButton: {
            flexDirection: 'row' as const,
            alignItems: 'center' as const,
            paddingHorizontal: 8,
            paddingVertical: 4,
            borderRadius: 12,
            minWidth: 100,
        },
        statusDot: {
            width: 6,
            height: 6,
            borderRadius: 3,
            marginRight: 6,
        },
        statusText: {
            fontSize: 11,
            fontWeight: '600' as const,
        },
        runningBadge: {
            flexDirection: 'row' as const,
            alignItems: 'center' as const,
            paddingHorizontal: 8,
            paddingVertical: 4,
            borderRadius: 12,
            backgroundColor: theme.accent + '20',
            marginRight: 8,
        },
        runningText: {
            color: theme.accent,
            fontSize: 11,
            fontWeight: '600' as const,
            marginLeft: 4,
        },
    }));

    const handleClose = () => {
        closeToolView();
        onClose();
    };

    const currentSnapshot = toolCallSnapshots[currentSnapshotIndex];
    const totalSnapshots = toolCallSnapshots.length;

    const canGoPrevious = currentSnapshotIndex > 0;
    const canGoNext = currentSnapshotIndex < totalSnapshots - 1;

    const isLiveMode = navigationMode === 'live';
    const showJumpToLatest = navigationMode === 'manual' && !isGenerating;
    const showJumpToLive = navigationMode === 'manual' && isGenerating;

    const handlePrevious = useCallback(() => {
        if (canGoPrevious) {
            navigateToSnapshot(currentSnapshotIndex - 1);
        }
    }, [canGoPrevious, currentSnapshotIndex, navigateToSnapshot]);

    const handleNext = useCallback(() => {
        if (canGoNext) {
            navigateToSnapshot(currentSnapshotIndex + 1);
        }
    }, [canGoNext, currentSnapshotIndex, navigateToSnapshot]);

    const handleSliderChange = useCallback((value: number) => {
        const index = Math.round(value);
        navigateToSnapshot(index);
    }, [navigateToSnapshot]);

    const handleJumpToLatest = useCallback(() => {
        jumpToLatest();
    }, [jumpToLatest]);

    const renderStatusButton = () => {
        if (isLiveMode) {
            if (isGenerating) {
                return (
                    <View style={[styles.statusButton, { backgroundColor: theme.primary + '20' }]}>
                        <View style={[styles.statusDot, { backgroundColor: theme.primary }]} />
                        <Caption style={[styles.statusText, { color: theme.primary }]}>Live Updates</Caption>
                    </View>
                );
            } else {
                return (
                    <View style={[styles.statusButton, { backgroundColor: theme.muted + '20' }]}>
                        <View style={[styles.statusDot, { backgroundColor: theme.mutedForeground }]} />
                        <Caption style={[styles.statusText, { color: theme.mutedForeground }]}>Latest Tool</Caption>
                    </View>
                );
            }
        } else {
            if (showJumpToLive) {
                return (
                    <TouchableOpacity
                        style={[styles.statusButton, { backgroundColor: theme.primary + '20' }]}
                        onPress={handleJumpToLatest}
                    >
                        <View style={[styles.statusDot, { backgroundColor: theme.primary }]} />
                        <Caption style={[styles.statusText, { color: theme.primary }]}>Jump to Live</Caption>
                    </TouchableOpacity>
                );
            } else if (showJumpToLatest) {
                return (
                    <TouchableOpacity
                        style={[styles.statusButton, { backgroundColor: theme.accent + '20' }]}
                        onPress={handleJumpToLatest}
                    >
                        <View style={[styles.statusDot, { backgroundColor: theme.accent }]} />
                        <Caption style={[styles.statusText, { color: theme.accent }]}>Jump to Latest</Caption>
                    </TouchableOpacity>
                );
            }
        }
        return null;
    };

    if (!isVisible) return null;

    // Empty state when no tools
    if (totalSnapshots === 0) {
        return (
            <View style={styles.panel}>
                <View style={styles.header}>
                    <View style={styles.headerLeft}>
                        <Computer size={16} color={styles.title.color} />
                        <H4 style={styles.title}>Suna's Computer</H4>
                    </View>
                    <TouchableOpacity style={styles.closeButton} onPress={handleClose}>
                        <X size={16} color={styles.title.color} />
                    </TouchableOpacity>
                </View>

                <View style={styles.emptyContainer}>
                    <View style={styles.emptyIcon}>
                        <Computer size={32} color={styles.emptySubtitle.color} />
                    </View>
                    <Body style={styles.emptyTitle}>No tool activity</Body>
                    <Body style={styles.emptySubtitle}>
                        Tool calls and computer interactions will appear here when they're being executed.
                    </Body>
                </View>
            </View>
        );
    }

    return (
        <View style={styles.panel}>
            <View style={styles.header}>
                <View style={styles.headerLeft}>
                    <Computer size={16} color={styles.title.color} />
                    <H4 style={styles.title}>Suna's Computer</H4>
                </View>

                <View style={styles.headerActions}>
                    {isGenerating && (
                        <View style={styles.runningBadge}>
                            <CircleDashed size={12} color={theme.accent} />
                            <Caption style={styles.runningText}>Running</Caption>
                        </View>
                    )}
                    <TouchableOpacity style={styles.closeButton} onPress={handleClose}>
                        <X size={16} color={styles.title.color} />
                    </TouchableOpacity>
                </View>
            </View>

            <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
                <GenericToolView
                    toolCall={currentSnapshot?.toolCall}
                    isStreaming={isGenerating}
                    isSuccess={true}
                />
            </ScrollView>

            {/* Timeline controls at bottom */}
            {totalSnapshots > 1 && (
                <View style={styles.timelineContainer}>
                    <View style={styles.timelineControls}>
                        <TouchableOpacity
                            style={[styles.navButton, !canGoPrevious && styles.navButtonDisabled]}
                            onPress={handlePrevious}
                            disabled={!canGoPrevious}
                        >
                            <ChevronLeft size={16} color={styles.title.color} />
                        </TouchableOpacity>

                        <Caption style={styles.counter}>
                            {currentSnapshotIndex + 1}/{totalSnapshots}
                        </Caption>

                        <TouchableOpacity
                            style={[styles.navButton, !canGoNext && styles.navButtonDisabled]}
                            onPress={handleNext}
                            disabled={!canGoNext}
                        >
                            <ChevronRight size={16} color={styles.title.color} />
                        </TouchableOpacity>

                        <Slider
                            style={styles.slider}
                            minimumValue={0}
                            maximumValue={totalSnapshots - 1}
                            step={1}
                            value={currentSnapshotIndex}
                            onValueChange={handleSliderChange}
                            minimumTrackTintColor={theme.primary}
                            maximumTrackTintColor={theme.muted}
                            thumbTintColor={theme.primary}
                        />

                        {renderStatusButton()}
                    </View>
                </View>
            )}
        </View>
    );
}; 