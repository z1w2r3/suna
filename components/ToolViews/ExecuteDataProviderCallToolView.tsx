import { useColorScheme } from '@/hooks/useColorScheme';
import { useTheme } from '@/hooks/useThemeColor';
import {
    AlertTriangle,
    Briefcase,
    ChevronRight,
    Code,
    Database,
    Home,
    MessageCircle,
    Settings,
    ShoppingBag,
    TrendingUp,
    Users
} from 'lucide-react-native';
import { useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { ToolViewProps } from './ToolViewRegistry';

interface ExecuteDataProviderCallToolViewProps extends ToolViewProps {
    assistantContent?: string;
    toolContent?: string;
    assistantTimestamp?: string;
    toolTimestamp?: string;
    toolCall?: any;
}

const PROVIDER_CONFIG = {
    'linkedin': {
        name: 'LinkedIn Data Provider',
        icon: Users,
        color: '#0077B5',
        bgColor: { dark: '#1e3a8a20', light: '#dbeafe' },
        textColor: { dark: '#60a5fa', light: '#1d4ed8' }
    },
    'twitter': {
        name: 'Twitter Data Provider',
        icon: MessageCircle,
        color: '#1DA1F2',
        bgColor: { dark: '#0c4a6e20', light: '#e0f2fe' },
        textColor: { dark: '#7dd3fc', light: '#0369a1' }
    },
    'zillow': {
        name: 'Zillow Data Provider',
        icon: Home,
        color: '#10B981',
        bgColor: { dark: '#064e3b20', light: '#dcfce7' },
        textColor: { dark: '#6ee7b7', light: '#059669' }
    },
    'amazon': {
        name: 'Amazon Data Provider',
        icon: ShoppingBag,
        color: '#F59E0B',
        bgColor: { dark: '#92400e20', light: '#fef3c7' },
        textColor: { dark: '#fbbf24', light: '#d97706' }
    },
    'yahoo_finance': {
        name: 'Yahoo Finance Data Provider',
        icon: TrendingUp,
        color: '#8B5CF6',
        bgColor: { dark: '#581c8720', light: '#f3e8ff' },
        textColor: { dark: '#c084fc', light: '#7c3aed' }
    },
    'active_jobs': {
        name: 'Active Jobs Data Provider',
        icon: Briefcase,
        color: '#6366F1',
        bgColor: { dark: '#3730a320', light: '#e0e7ff' },
        textColor: { dark: '#a5b4fc', light: '#4f46e5' }
    }
};

const extractDataProviderCallData = (toolCall?: any, toolContent?: string) => {
    let serviceName = '';
    let route = '';
    let payload: any = {};
    let output = '';
    let isSuccess = true;
    let errorMessage = '';

    // Extract from tool call parameters
    if (toolCall?.parameters) {
        serviceName = toolCall.parameters.service_name || toolCall.parameters.serviceName || '';
        route = toolCall.parameters.route || '';
        payload = toolCall.parameters.payload || {};
        output = toolCall.parameters.output || '';
    }

    // Parse tool content if available
    if (toolContent) {
        try {
            const parsed = JSON.parse(toolContent);

            if (parsed.tool_execution) {
                const toolExecution = parsed.tool_execution;

                // Extract arguments
                if (toolExecution.arguments) {
                    serviceName = toolExecution.arguments.service_name || toolExecution.arguments.serviceName || serviceName;
                    route = toolExecution.arguments.route || route;
                    payload = toolExecution.arguments.payload || payload;
                    output = toolExecution.arguments.output || output;
                }

                // Extract result
                if (toolExecution.result) {
                    const result = toolExecution.result;

                    if (result.success !== undefined) {
                        isSuccess = result.success;
                    }

                    if (result.error) {
                        errorMessage = result.error;
                        isSuccess = false;
                        output = result.error;
                    }

                    if (result.output) {
                        if (typeof result.output === 'string') {
                            output = result.output;
                        } else {
                            output = JSON.stringify(result.output, null, 2);
                        }
                    }
                }
            }
        } catch (error) {
            console.error('Error parsing tool content:', error);
        }
    }

    return {
        serviceName,
        route,
        payload,
        output,
        isSuccess,
        errorMessage
    };
};

export function ExecuteDataProviderCallToolView({
    name = 'execute-data-provider-call',
    toolCall,
    toolContent,
    isStreaming = false,
    isSuccess = true,
    ...props
}: ExecuteDataProviderCallToolViewProps) {
    const theme = useTheme();
    const colorScheme = useColorScheme();
    const [showRawJSON, setShowRawJSON] = useState(false);

    const extractedData = extractDataProviderCallData(toolCall, toolContent);
    const { serviceName, route, payload, output, isSuccess: actualIsSuccess, errorMessage } = extractedData;

    const providerKey = serviceName?.toLowerCase() as keyof typeof PROVIDER_CONFIG;
    const providerConfig = providerKey && PROVIDER_CONFIG[providerKey]
        ? PROVIDER_CONFIG[providerKey]
        : PROVIDER_CONFIG['linkedin'];

    const IconComponent = providerConfig.icon;
    const hasPayload = payload && Object.keys(payload).length > 0;

    const styles = StyleSheet.create({
        container: {
            flex: 1,
            backgroundColor: theme.background,
        },
        scrollView: {
            flex: 1,
        },
        content: {
            padding: 16,
        },
        loadingContainer: {
            flex: 1,
            justifyContent: 'center',
            alignItems: 'center',
            padding: 20,
        },
        loadingIcon: {
            width: 64,
            height: 64,
            borderRadius: 12,
            backgroundColor: colorScheme === 'dark' ? '#1f2937' : '#f3f4f6',
            borderWidth: 1,
            borderColor: colorScheme === 'dark' ? '#374151' : '#e5e7eb',
            justifyContent: 'center',
            alignItems: 'center',
            marginBottom: 16,
        },
        loadingTitle: {
            fontSize: 16,
            fontWeight: '500',
            color: theme.foreground,
            marginBottom: 8,
        },
        loadingSubtitle: {
            fontSize: 14,
            color: theme.mutedForeground,
        },
        providerContainer: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 16,
            padding: 16,
            backgroundColor: colorScheme === 'dark' ? '#111827' : '#f9fafb',
            borderRadius: 8,
            borderWidth: 1,
            borderColor: colorScheme === 'dark' ? '#374151' : '#e5e7eb',
            marginBottom: 24,
        },
        providerIcon: {
            width: 48,
            height: 48,
            borderRadius: 8,
            justifyContent: 'center',
            alignItems: 'center',
            backgroundColor: providerConfig.color,
        },
        providerInfo: {
            flex: 1,
        },
        providerName: {
            fontSize: 18,
            fontWeight: '600',
            color: theme.foreground,
            marginBottom: 4,
        },
        providerService: {
            fontSize: 14,
            color: theme.mutedForeground,
        },
        routeBadge: {
            paddingHorizontal: 8,
            paddingVertical: 4,
            borderRadius: 4,
            backgroundColor: colorScheme === 'dark' ? '#374151' : '#e5e7eb',
            borderWidth: 1,
            borderColor: colorScheme === 'dark' ? '#4b5563' : '#d1d5db',
        },
        routeText: {
            fontSize: 12,
            fontFamily: 'Monaco, monospace',
            color: theme.foreground,
        },
        errorContainer: {
            padding: 16,
            backgroundColor: colorScheme === 'dark' ? '#7f1d1d20' : '#fecaca',
            borderRadius: 8,
            borderWidth: 1,
            borderColor: colorScheme === 'dark' ? '#dc2626' : '#ef4444',
            marginBottom: 24,
        },
        errorHeader: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
            marginBottom: 8,
        },
        errorTitle: {
            fontSize: 14,
            fontWeight: '500',
            color: colorScheme === 'dark' ? '#fca5a5' : '#dc2626',
        },
        errorText: {
            fontSize: 12,
            color: colorScheme === 'dark' ? '#fca5a5' : '#dc2626',
            fontFamily: 'Monaco, monospace',
            lineHeight: 16,
        },
        sectionHeader: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
            marginBottom: 16,
        },
        sectionTitle: {
            fontSize: 14,
            fontWeight: '500',
            color: theme.foreground,
        },
        parameterItem: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: 12,
            backgroundColor: colorScheme === 'dark' ? '#111827' : '#ffffff',
            borderRadius: 8,
            borderWidth: 1,
            borderColor: colorScheme === 'dark' ? '#374151' : '#e5e7eb',
            marginBottom: 8,
        },
        parameterLeft: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 12,
            flex: 1,
        },
        parameterDot: {
            width: 8,
            height: 8,
            borderRadius: 4,
            backgroundColor: colorScheme === 'dark' ? '#6b7280' : '#9ca3af',
        },
        parameterKey: {
            fontSize: 14,
            fontFamily: 'Monaco, monospace',
            fontWeight: '500',
            color: theme.foreground,
        },
        parameterValue: {
            fontSize: 14,
            color: theme.mutedForeground,
            fontFamily: 'Monaco, monospace',
            maxWidth: 120,
        },
        jsonToggle: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
            padding: 12,
            backgroundColor: colorScheme === 'dark' ? '#111827' : '#f9fafb',
            borderRadius: 8,
            borderWidth: 1,
            borderColor: colorScheme === 'dark' ? '#374151' : '#e5e7eb',
            marginTop: 12,
        },
        jsonToggleText: {
            fontSize: 14,
            fontWeight: '500',
            color: theme.foreground,
        },
        jsonContainer: {
            marginTop: 12,
            padding: 16,
            backgroundColor: colorScheme === 'dark' ? '#0f172a' : '#1e293b',
            borderRadius: 8,
            borderWidth: 1,
            borderColor: colorScheme === 'dark' ? '#374151' : '#e5e7eb',
        },
        jsonText: {
            fontSize: 12,
            fontFamily: 'Monaco, monospace',
            color: '#22c55e',
            lineHeight: 16,
        },
        emptyState: {
            flex: 1,
            justifyContent: 'center',
            alignItems: 'center',
            paddingVertical: 32,
        },
        emptyIcon: {
            width: 48,
            height: 48,
            borderRadius: 8,
            backgroundColor: colorScheme === 'dark' ? '#1f2937' : '#f3f4f6',
            borderWidth: 1,
            borderColor: colorScheme === 'dark' ? '#374151' : '#e5e7eb',
            justifyContent: 'center',
            alignItems: 'center',
            marginBottom: 12,
        },
        emptyText: {
            fontSize: 14,
            color: theme.mutedForeground,
            textAlign: 'center',
            flexDirection: 'row',
            alignItems: 'center',
        },
    });

    const renderLoadingState = () => (
        <View style={styles.loadingContainer}>
            <View style={styles.loadingIcon}>
                <ActivityIndicator size="large" color={theme.mutedForeground} />
            </View>
            <Text style={styles.loadingTitle}>Executing call...</Text>
            <Text style={styles.loadingSubtitle}>
                Calling {serviceName || 'data provider'}
            </Text>
        </View>
    );

    const renderContent = () => {
        return (
            <View>
                <View style={styles.providerContainer}>
                    <View style={styles.providerIcon}>
                        <IconComponent size={24} color="#ffffff" />
                    </View>

                    <View style={styles.providerInfo}>
                        <Text style={styles.providerName}>{providerConfig.name}</Text>
                        {serviceName && (
                            <Text style={styles.providerService}>Service: {serviceName}</Text>
                        )}
                    </View>

                    {route && (
                        <View style={styles.routeBadge}>
                            <Text style={styles.routeText}>{route}</Text>
                        </View>
                    )}
                </View>

                {output && !actualIsSuccess && (
                    <View style={styles.errorContainer}>
                        <View style={styles.errorHeader}>
                            <AlertTriangle size={16} color={styles.errorTitle.color} />
                            <Text style={styles.errorTitle}>Execution Failed</Text>
                        </View>
                        <Text style={styles.errorText}>{output}</Text>
                    </View>
                )}

                {hasPayload && (
                    <View style={{ marginBottom: 24 }}>
                        <View style={styles.sectionHeader}>
                            <Settings size={16} color={theme.foreground} />
                            <Text style={styles.sectionTitle}>Call Parameters</Text>
                            <ChevronRight size={12} color={theme.mutedForeground} />
                        </View>

                        <View>
                            {Object.entries(payload).map(([key, value]) => (
                                <View key={key} style={styles.parameterItem}>
                                    <View style={styles.parameterLeft}>
                                        <View style={styles.parameterDot} />
                                        <Text style={styles.parameterKey}>{key}</Text>
                                    </View>
                                    <Text style={styles.parameterValue} numberOfLines={1}>
                                        {typeof value === 'string' ? `"${value}"` : String(value)}
                                    </Text>
                                </View>
                            ))}
                        </View>

                        <TouchableOpacity
                            style={styles.jsonToggle}
                            onPress={() => setShowRawJSON(!showRawJSON)}
                        >
                            <Code size={16} color={theme.foreground} />
                            <Text style={styles.jsonToggleText}>Raw JSON</Text>
                            <ChevronRight
                                size={12}
                                color={theme.mutedForeground}
                                style={{
                                    transform: [{ rotate: showRawJSON ? '90deg' : '0deg' }]
                                }}
                            />
                        </TouchableOpacity>

                        {showRawJSON && (
                            <View style={styles.jsonContainer}>
                                <Text style={styles.jsonText}>
                                    {JSON.stringify(payload, null, 2)}
                                </Text>
                            </View>
                        )}
                    </View>
                )}

                {!serviceName && !route && !hasPayload && (
                    <View style={styles.emptyState}>
                        <View style={styles.emptyIcon}>
                            <Database size={24} color={theme.mutedForeground} />
                        </View>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                            <ActivityIndicator size="small" color={theme.mutedForeground} />
                            <Text style={styles.emptyText}>
                                Will be populated when the call is executed...
                            </Text>
                        </View>
                    </View>
                )}
            </View>
        );
    };

    return (
        <View style={styles.container}>
            {isStreaming ? (
                renderLoadingState()
            ) : (
                <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
                    <View style={styles.content}>
                        {renderContent()}
                    </View>
                </ScrollView>
            )}
        </View>
    );
} 