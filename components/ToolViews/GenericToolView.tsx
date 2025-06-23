import { useTheme } from '@/hooks/useThemeColor';
import { formatToolNameForDisplay } from '@/utils/xml-parser';
import React from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Body, Caption, H4 } from '../Typography';

export interface GenericToolViewProps {
    toolCall?: any;
    isStreaming?: boolean;
    isSuccess?: boolean;
}

export const GenericToolView: React.FC<GenericToolViewProps> = ({
    toolCall,
    isStreaming = false,
    isSuccess = true
}) => {
    const theme = useTheme();

    const styles = StyleSheet.create({
        container: {
            flex: 1,
            padding: 16,
        },
        emptyState: {
            flex: 1,
            justifyContent: 'center',
            alignItems: 'center',
        },
        emptyText: {
            fontSize: 16,
        },
        header: {
            marginBottom: 16,
        },
        toolName: {
            color: theme.foreground,
            marginBottom: 8,
        },
        statusBadge: {
            paddingHorizontal: 8,
            paddingVertical: 4,
            borderRadius: 4,
            alignSelf: 'flex-start',
        },
        statusText: {
            fontSize: 12,
            fontWeight: '600' as const,
        },
        section: {
            marginBottom: 16,
        },
        sectionTitle: {
            color: theme.foreground,
            marginBottom: 8,
            fontWeight: '600' as const,
        },
        parameterContainer: {
            backgroundColor: theme.muted + '40',
            padding: 12,
            borderRadius: 6,
            marginBottom: 8,
        },
        parameterKey: {
            color: theme.mutedForeground,
            fontSize: 12,
            marginBottom: 4,
        },
        parameterValue: {
            color: theme.foreground,
            fontFamily: 'monospace',
            fontSize: 13,
        },
    });

    if (!toolCall) {
        return (
            <View style={[styles.container, { backgroundColor: theme.background }]}>
                <View style={styles.emptyState}>
                    <Body style={[styles.emptyText, { color: theme.mutedForeground }]}>
                        No tool selected
                    </Body>
                </View>
            </View>
        );
    }

    const toolName = formatToolNameForDisplay(toolCall.functionName || 'Unknown Tool');

    const statusColor = isStreaming
        ? theme.accent
        : isSuccess
            ? theme.primary
            : theme.destructive;

    const statusText = isStreaming
        ? 'Running...'
        : isSuccess
            ? 'Completed'
            : 'Failed';

    return (
        <ScrollView style={[styles.container, { backgroundColor: theme.background }]}>
            <View style={styles.header}>
                <H4 style={styles.toolName}>{toolName}</H4>
                <View style={[styles.statusBadge, { backgroundColor: statusColor + '20' }]}>
                    <Caption style={[styles.statusText, { color: statusColor }]}>
                        {statusText}
                    </Caption>
                </View>
            </View>

            {toolCall.parameters && Object.keys(toolCall.parameters).length > 0 && (
                <View style={styles.section}>
                    <Body style={styles.sectionTitle}>Parameters</Body>
                    {Object.entries(toolCall.parameters).map(([key, value]) => (
                        <View key={key} style={styles.parameterContainer}>
                            <Caption style={styles.parameterKey}>{key}</Caption>
                            <Body style={styles.parameterValue}>
                                {typeof value === 'string' ? value : JSON.stringify(value, null, 2)}
                            </Body>
                        </View>
                    ))}
                </View>
            )}
        </ScrollView>
    );
}; 