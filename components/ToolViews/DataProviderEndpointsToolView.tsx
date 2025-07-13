import { useColorScheme } from '@/hooks/useColorScheme';
import { useTheme } from '@/hooks/useThemeColor';
import {
    AlertTriangle,
    Briefcase,
    CheckCircle,
    ChevronRight,
    Database,
    Home,
    MessageCircle,
    ShoppingBag,
    TrendingUp,
    Users
} from 'lucide-react-native';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { ToolViewProps } from './ToolViewRegistry';

interface DataProviderEndpointsToolViewProps extends ToolViewProps {
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

const extractDataProviderEndpointsData = (toolCall?: any, toolContent?: string) => {
    let serviceName = '';
    let endpoints: any = {};
    let isSuccess = true;
    let errorMessage = '';

    // Extract from tool call parameters
    if (toolCall?.parameters) {
        serviceName = toolCall.parameters.service_name || toolCall.parameters.serviceName || '';
        endpoints = toolCall.parameters.endpoints || {};
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
                    endpoints = toolExecution.arguments.endpoints || endpoints;
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
                    }

                    if (result.output) {
                        if (typeof result.output === 'string') {
                            try {
                                const outputParsed = JSON.parse(result.output);
                                serviceName = outputParsed.service_name || outputParsed.serviceName || serviceName;
                                endpoints = outputParsed.endpoints || endpoints;
                            } catch {
                                // If not JSON, treat as service name
                                serviceName = result.output;
                            }
                        } else {
                            serviceName = result.output.service_name || result.output.serviceName || serviceName;
                            endpoints = result.output.endpoints || endpoints;
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
        endpoints,
        isSuccess,
        errorMessage
    };
};

export function DataProviderEndpointsToolView({
    name = 'get-data-provider-endpoints',
    toolCall,
    toolContent,
    isStreaming = false,
    isSuccess = true,
    ...props
}: DataProviderEndpointsToolViewProps) {
    const theme = useTheme();
    const colorScheme = useColorScheme();

    const extractedData = extractDataProviderEndpointsData(toolCall, toolContent);
    const { serviceName, endpoints, isSuccess: actualIsSuccess, errorMessage } = extractedData;

    const providerConfig = serviceName && PROVIDER_CONFIG[serviceName as keyof typeof PROVIDER_CONFIG]
        ? PROVIDER_CONFIG[serviceName as keyof typeof PROVIDER_CONFIG]
        : PROVIDER_CONFIG['linkedin'];

    const IconComponent = providerConfig.icon;
    const endpointCount = endpoints && typeof endpoints === 'object' ? Object.keys(endpoints).length : 0;

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
        providerDescription: {
            fontSize: 14,
            color: theme.mutedForeground,
        },
        statusBadge: {
            flexDirection: 'row',
            alignItems: 'center',
            paddingHorizontal: 8,
            paddingVertical: 4,
            borderRadius: 12,
            backgroundColor: actualIsSuccess
                ? (colorScheme === 'dark' ? '#064e3b20' : '#dcfce7')
                : (colorScheme === 'dark' ? '#7f1d1d20' : '#fecaca'),
            borderWidth: 1,
            borderColor: actualIsSuccess
                ? (colorScheme === 'dark' ? '#059669' : '#10b981')
                : (colorScheme === 'dark' ? '#dc2626' : '#ef4444'),
        },
        statusText: {
            fontSize: 12,
            fontWeight: '500',
            marginLeft: 4,
            color: actualIsSuccess
                ? (colorScheme === 'dark' ? '#6ee7b7' : '#059669')
                : (colorScheme === 'dark' ? '#fca5a5' : '#dc2626'),
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
        statusGrid: {
            gap: 12,
        },
        statusItem: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: 12,
            backgroundColor: colorScheme === 'dark' ? '#111827' : '#ffffff',
            borderRadius: 8,
            borderWidth: 1,
            borderColor: colorScheme === 'dark' ? '#374151' : '#e5e7eb',
        },
        statusLeft: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 12,
        },
        statusDot: {
            width: 8,
            height: 8,
            borderRadius: 4,
        },
        statusLabel: {
            fontSize: 14,
            fontWeight: '500',
            color: theme.foreground,
        },
        statusValue: {
            fontSize: 14,
            color: theme.mutedForeground,
            fontFamily: 'Monaco, monospace',
        },
        successContainer: {
            padding: 16,
            backgroundColor: colorScheme === 'dark' ? '#064e3b20' : '#dcfce7',
            borderRadius: 8,
            borderWidth: 1,
            borderColor: colorScheme === 'dark' ? '#059669' : '#10b981',
            marginTop: 16,
        },
        successHeader: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
            marginBottom: 8,
        },
        successTitle: {
            fontSize: 14,
            fontWeight: '500',
            color: colorScheme === 'dark' ? '#6ee7b7' : '#059669',
        },
        successDescription: {
            fontSize: 12,
            color: colorScheme === 'dark' ? '#6ee7b7' : '#059669',
            lineHeight: 16,
        },
        errorContainer: {
            backgroundColor: colorScheme === 'dark' ? '#2d1b1b' : '#f8d7da',
            borderColor: colorScheme === 'dark' ? '#5a2a2a' : '#f5c6cb',
            borderWidth: 1,
            borderRadius: 8,
            padding: 12,
            marginBottom: 16,
        },
        errorText: {
            color: colorScheme === 'dark' ? '#f87171' : '#721c24',
            fontSize: 14,
            lineHeight: 20,
        },
    });

    const renderLoadingState = () => (
        <View style={styles.loadingContainer}>
            <View style={styles.loadingIcon}>
                <ActivityIndicator size="large" color={theme.mutedForeground} />
            </View>
            <Text style={styles.loadingTitle}>Loading provider...</Text>
            <Text style={styles.loadingSubtitle}>Connecting to data source</Text>
        </View>
    );

    const renderContent = () => {
        if (!actualIsSuccess && errorMessage) {
            return (
                <View style={styles.errorContainer}>
                    <Text style={styles.errorText}>{errorMessage}</Text>
                </View>
            );
        }

        return (
            <View>
                <View style={styles.providerContainer}>
                    <View style={styles.providerIcon}>
                        <IconComponent size={24} color="#ffffff" />
                    </View>

                    <View style={styles.providerInfo}>
                        <Text style={styles.providerName}>{providerConfig.name}</Text>
                        <Text style={styles.providerDescription}>
                            {endpointCount > 0 ? `${endpointCount} endpoints loaded and ready` : 'Endpoints loaded and ready'}
                        </Text>
                    </View>

                    <View style={styles.statusBadge}>
                        {actualIsSuccess ? (
                            <CheckCircle size={12} color={styles.statusText.color} />
                        ) : (
                            <AlertTriangle size={12} color={styles.statusText.color} />
                        )}
                        <Text style={styles.statusText}>
                            {actualIsSuccess ? 'Connected' : 'Failed'}
                        </Text>
                    </View>
                </View>

                <View style={styles.sectionHeader}>
                    <Database size={16} color={theme.foreground} />
                    <Text style={styles.sectionTitle}>Provider Status</Text>
                    <ChevronRight size={12} color={theme.mutedForeground} />
                </View>

                <View style={styles.statusGrid}>
                    <View style={styles.statusItem}>
                        <View style={styles.statusLeft}>
                            <View style={[styles.statusDot, { backgroundColor: '#10b981' }]} />
                            <Text style={styles.statusLabel}>Connection Status</Text>
                        </View>
                        <View style={styles.statusBadge}>
                            {actualIsSuccess ? (
                                <CheckCircle size={12} color={styles.statusText.color} />
                            ) : (
                                <AlertTriangle size={12} color={styles.statusText.color} />
                            )}
                            <Text style={styles.statusText}>
                                {actualIsSuccess ? 'Active' : 'Inactive'}
                            </Text>
                        </View>
                    </View>

                    <View style={styles.statusItem}>
                        <View style={styles.statusLeft}>
                            <View style={[styles.statusDot, { backgroundColor: '#3b82f6' }]} />
                            <Text style={styles.statusLabel}>Endpoints Available</Text>
                        </View>
                        <Text style={styles.statusValue}>
                            {endpointCount > 0 ? `${endpointCount} endpoints` : 'Ready'}
                        </Text>
                    </View>

                    <View style={styles.statusItem}>
                        <View style={styles.statusLeft}>
                            <View style={[styles.statusDot, { backgroundColor: '#8b5cf6' }]} />
                            <Text style={styles.statusLabel}>Data Provider</Text>
                        </View>
                        <Text style={styles.statusValue}>
                            {serviceName || 'linkedin'}
                        </Text>
                    </View>
                </View>

                {actualIsSuccess && (
                    <View style={styles.successContainer}>
                        <View style={styles.successHeader}>
                            <CheckCircle size={16} color={styles.successTitle.color} />
                            <Text style={styles.successTitle}>Provider Ready</Text>
                        </View>
                        <Text style={styles.successDescription}>
                            Data provider endpoints have been loaded successfully and are ready to process requests.
                        </Text>
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