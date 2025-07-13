import { useColorScheme } from '@/hooks/useColorScheme';
import { useTheme } from '@/hooks/useThemeColor';
import { AlertTriangle, ExternalLink, Monitor } from 'lucide-react-native';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Caption } from '../Typography';
import { ToolViewProps } from './ToolViewRegistry';

interface ExposePortToolViewProps extends ToolViewProps {
    assistantContent?: string;
    toolContent?: string;
    assistantTimestamp?: string;
    toolTimestamp?: string;
    toolCall?: any;
}

const extractExposePortData = (toolCall?: any, toolContent?: string) => {
    let port: number | null = null;
    let url = '';
    let message = '';
    let isSuccess = true;
    let errorMessage = '';

    // Extract from tool call parameters
    if (toolCall?.parameters) {
        port = toolCall.parameters.port || toolCall.parameters.port_number || null;
        url = toolCall.parameters.url || '';
        message = toolCall.parameters.message || '';
    }

    // Parse tool content if available
    if (toolContent) {
        try {
            const parsed = JSON.parse(toolContent);

            if (parsed.tool_execution) {
                const toolExecution = parsed.tool_execution;

                // Extract arguments
                if (toolExecution.arguments) {
                    port = toolExecution.arguments.port || toolExecution.arguments.port_number || port;
                    url = toolExecution.arguments.url || url;
                    message = toolExecution.arguments.message || message;
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
                            // Try to parse if it's JSON
                            try {
                                const outputParsed = JSON.parse(result.output);
                                port = outputParsed.port || outputParsed.port_number || port;
                                url = outputParsed.url || url;
                                message = outputParsed.message || message;
                            } catch {
                                // If not JSON, treat as message
                                message = result.output;
                            }
                        } else {
                            port = result.output.port || result.output.port_number || port;
                            url = result.output.url || url;
                            message = result.output.message || message;
                        }
                    }
                }
            }
        } catch (error) {
            console.error('Error parsing tool content:', error);
        }
    }

    return {
        port,
        url,
        message,
        isSuccess,
        errorMessage
    };
};

export function ExposePortToolView({
    name = 'expose-port',
    toolCall,
    toolContent,
    isStreaming = false,
    isSuccess = true,
    ...props
}: ExposePortToolViewProps) {
    const theme = useTheme();
    const colorScheme = useColorScheme();

    const extractedData = extractExposePortData(toolCall, toolContent);
    const { port, url, message, isSuccess: actualIsSuccess, errorMessage } = extractedData;

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
        loadingText: {
            marginTop: 12,
            color: theme.foreground,
            fontSize: 16,
        },
        urlContainer: {
            backgroundColor: colorScheme === 'dark' ? '#1a1a1a' : '#f8f9fa',
            borderRadius: 8,
            padding: 16,
            marginBottom: 16,
            borderWidth: 1,
            borderColor: colorScheme === 'dark' ? '#333' : '#e1e5e9',
        },
        urlLabel: {
            color: theme.foreground,
            fontSize: 14,
            fontWeight: '600',
            marginBottom: 8,
        },
        urlLinkContainer: {
            flexDirection: 'row',
            alignItems: 'center',
            marginBottom: 12,
            flexWrap: 'wrap',
        },
        urlText: {
            color: '#007AFF',
            fontSize: 16,
            fontWeight: '500',
            flex: 1,
            marginRight: 8,
        },
        urlIcon: {
            marginLeft: 4,
        },
        portBadge: {
            backgroundColor: colorScheme === 'dark' ? '#2a2a2a' : '#e8e8e8',
            paddingHorizontal: 12,
            paddingVertical: 6,
            borderRadius: 16,
            alignSelf: 'flex-start',
            marginBottom: 12,
        },
        portText: {
            color: theme.foreground,
            fontSize: 12,
            fontWeight: '500',
            fontFamily: 'Monaco, monospace',
        },
        message: {
            color: theme.foreground,
            fontSize: 14,
            marginBottom: 12,
            lineHeight: 20,
        },
        warning: {
            backgroundColor: colorScheme === 'dark' ? '#332800' : '#fff3cd',
            borderColor: colorScheme === 'dark' ? '#664d00' : '#ffeaa7',
            borderWidth: 1,
            borderRadius: 8,
            padding: 12,
            flexDirection: 'row',
            alignItems: 'flex-start',
        },
        warningIcon: {
            marginRight: 8,
            marginTop: 2,
        },
        warningText: {
            color: colorScheme === 'dark' ? '#ffd93d' : '#856404',
            fontSize: 12,
            flex: 1,
            lineHeight: 16,
        },
        emptyState: {
            flex: 1,
            justifyContent: 'center',
            alignItems: 'center',
            paddingHorizontal: 40,
            paddingVertical: 60,
        },
        emptyIcon: {
            marginBottom: 16,
        },
        emptyTitle: {
            color: theme.foreground,
            fontSize: 18,
            fontWeight: '600',
            marginBottom: 8,
            textAlign: 'center',
        },
        emptyDescription: {
            color: theme.foreground,
            fontSize: 14,
            textAlign: 'center',
            opacity: 0.7,
            lineHeight: 20,
            maxWidth: 300,
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
            <ActivityIndicator size="large" color={theme.primary} />
            <Text style={styles.loadingText}>Exposing port...</Text>
            {port && (
                <Caption style={{ marginTop: 8 }}>Port: {port}</Caption>
            )}
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

        if (!port && !url) {
            return (
                <View style={styles.emptyState}>
                    <Monitor
                        size={40}
                        color={theme.foreground}
                        style={styles.emptyIcon}
                    />
                    <Text style={styles.emptyTitle}>No Port Information</Text>
                    <Text style={styles.emptyDescription}>
                        No port exposure information is available yet. Use the expose-port command to share a local port.
                    </Text>
                </View>
            );
        }

        return (
            <View>
                {url && (
                    <View style={styles.urlContainer}>
                        <Text style={styles.urlLabel}>Exposed URL</Text>
                        <TouchableOpacity
                            style={styles.urlLinkContainer}
                            onPress={() => {
                                // Handle URL opening - would need to implement based on your app's URL handling
                                console.log('Opening URL:', url);
                            }}
                        >
                            <Text style={styles.urlText}>{url}</Text>
                            <ExternalLink size={14} color="#007AFF" style={styles.urlIcon} />
                        </TouchableOpacity>

                        {port && (
                            <View style={styles.portBadge}>
                                <Text style={styles.portText}>Port: {port}</Text>
                            </View>
                        )}

                        {message && (
                            <Text style={styles.message}>{message}</Text>
                        )}

                        <View style={styles.warning}>
                            <AlertTriangle size={16} color={styles.warningText.color} style={styles.warningIcon} />
                            <Text style={styles.warningText}>
                                This URL might only be temporarily available and could expire after some time.
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