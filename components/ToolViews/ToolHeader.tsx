import { useTheme } from '@/hooks/useThemeColor';
import { AlertTriangle, CheckCircle, CheckCircle2, Clock, Computer, MessageCircleQuestion } from 'lucide-react-native';
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Caption, H4 } from '../Typography';

interface ToolHeaderProps {
    toolName: string;
    isStreaming?: boolean;
    isSuccess?: boolean;
    icon?: React.ComponentType<any>;
}

const getToolIcon = (toolName: string) => {
    switch (toolName) {
        case 'ask':
            return MessageCircleQuestion;
        case 'complete':
            return CheckCircle2;
        default:
            return Computer;
    }
};

const getToolDisplayName = (toolName: string) => {
    switch (toolName) {
        case 'ask':
            return 'Ask User';
        case 'complete':
            return 'Task Complete';
        default:
            return toolName?.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) || 'Unknown Tool';
    }
};

export const ToolHeader: React.FC<ToolHeaderProps> = ({
    toolName,
    isStreaming = false,
    isSuccess = true,
    icon: IconComponent
}) => {
    const theme = useTheme();

    const Icon = IconComponent || getToolIcon(toolName);
    const displayName = getToolDisplayName(toolName);

    const styles = StyleSheet.create({
        header: {
            backgroundColor: theme.muted + '20',
            paddingHorizontal: 16,
            paddingVertical: 12,
            borderBottomWidth: 1,
            borderBottomColor: theme.border,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
        },
        headerLeft: {
            flexDirection: 'row',
            alignItems: 'center',
        },
        iconContainer: {
            width: 32,
            height: 32,
            borderRadius: 16,
            backgroundColor: theme.primary + '20',
            justifyContent: 'center',
            alignItems: 'center',
            marginRight: 12,
        },
        title: {
            color: theme.foreground,
        },
        statusBadge: {
            flexDirection: 'row',
            alignItems: 'center',
            paddingHorizontal: 8,
            paddingVertical: 4,
            borderRadius: 12,
        },
        statusText: {
            fontSize: 12,
            fontWeight: '600' as const,
            marginLeft: 4,
        },
    });

    const statusColor = isStreaming
        ? theme.accent
        : isSuccess
            ? theme.primary
            : theme.destructive;

    const statusText = isStreaming
        ? 'Running...'
        : isSuccess
            ? 'Success'
            : 'Failed';

    const StatusIcon = isStreaming
        ? Clock
        : isSuccess
            ? CheckCircle
            : AlertTriangle;

    return (
        <View style={styles.header}>
            <View style={styles.headerLeft}>
                <View style={styles.iconContainer}>
                    <Icon size={16} color={theme.primary} />
                </View>
                <H4 style={styles.title}>{displayName}</H4>
            </View>

            <View style={[styles.statusBadge, { backgroundColor: statusColor + '20' }]}>
                <StatusIcon size={12} color={statusColor} />
                <Caption style={[styles.statusText, { color: statusColor }]}>
                    {statusText}
                </Caption>
            </View>
        </View>
    );
};
