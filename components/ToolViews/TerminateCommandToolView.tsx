import { useColorScheme } from '@/hooks/useColorScheme';
import { useTheme } from '@/hooks/useThemeColor';
import {
    AlertTriangle,
    ArrowRight,
    CheckCircle,
    CircleDashed,
    Power,
    StopCircle,
    Terminal
} from 'lucide-react-native';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { ToolViewProps } from './ToolViewRegistry';

interface TerminateCommandToolViewProps extends ToolViewProps {
    assistantContent?: string;
    toolContent?: string;
    assistantTimestamp?: string;
    toolTimestamp?: string;
    toolCall?: any;
}

const extractCommandData = (toolCall?: any, toolContent?: string, assistantContent?: string) => {
    let sessionName = '';
    let output = '';
    let isSuccess = true;
    let errorMessage = '';

    // Extract from tool call parameters
    if (toolCall?.parameters) {
        sessionName = toolCall.parameters.session_name || toolCall.parameters.sessionName || '';
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
                    sessionName = toolExecution.arguments.session_name || toolExecution.arguments.sessionName || sessionName;
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
                        output = typeof result.output === 'string' ? result.output : JSON.stringify(result.output);
                    }
                }
            }
        } catch (error) {
            console.error('Error parsing tool content:', error);
        }
    }

    // Try to extract session name from assistant content if not found
    if (!sessionName && assistantContent) {
        try {
            const parsed = JSON.parse(assistantContent);
            if (parsed.content) {
                const sessionMatch = parsed.content.match(
                    /<terminate-command[^>]*session_name=["']([^"']+)["'][^>]*>/
                );
                if (sessionMatch) {
                    sessionName = sessionMatch[1].trim();
                }
            }
        } catch (e) {
            const sessionMatch = assistantContent.match(
                /<terminate-command[^>]*session_name=["']([^"']+)["'][^>]*>/
            );
            if (sessionMatch) {
                sessionName = sessionMatch[1].trim();
            }
        }
    }

    // Determine termination success
    const terminationSuccess = output ? (
        !output.toLowerCase().includes('does not exist') &&
        (output.toLowerCase().includes('terminated') || output.toLowerCase().includes('killed'))
    ) : isSuccess;

    return {
        sessionName,
        output,
        isSuccess: terminationSuccess,
        errorMessage
    };
};

export function TerminateCommandToolView({
    name = 'terminate-command',
    toolCall,
    toolContent,
    assistantContent,
    isStreaming = false,
    isSuccess = true,
    ...props
}: TerminateCommandToolViewProps) {
    const theme = useTheme();
    const colorScheme = useColorScheme();
    const [progress, setProgress] = useState(0);

    const extractedData = extractCommandData(toolCall, toolContent, assistantContent);
    const { sessionName, output, isSuccess: terminationSuccess, errorMessage } = extractedData;

    const formattedOutput = React.useMemo(() => {
        if (!output) return [];

        let processedOutput = output;
        try {
            if (typeof output === 'string' && output.trim().startsWith('{')) {
                const parsed = JSON.parse(output);
                if (parsed && typeof parsed === 'object' && parsed.output) {
                    processedOutput = parsed.output;
                }
            }
        } catch (e) {
            // Keep original output if parsing fails
        }

        processedOutput = String(processedOutput);
        processedOutput = processedOutput.replace(/\\\\/g, '\\');
        processedOutput = processedOutput
            .replace(/\\n/g, '\n')
            .replace(/\\t/g, '\t')
            .replace(/\\"/g, '"')
            .replace(/\\'/g, "'");

        return processedOutput.split('\n');
    }, [output]);

    useEffect(() => {
        if (isStreaming) {
            const timer = setInterval(() => {
                setProgress((prevProgress) => {
                    if (prevProgress >= 95) {
                        clearInterval(timer);
                        return prevProgress;
                    }
                    return prevProgress + 5;
                });
            }, 300);
            return () => clearInterval(timer);
        } else {
            setProgress(100);
        }
    }, [isStreaming]);

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
            borderRadius: 32,
            backgroundColor: colorScheme === 'dark' ? '#7f1d1d40' : '#fecaca',
            justifyContent: 'center',
            alignItems: 'center',
            marginBottom: 24,
        },
        loadingTitle: {
            fontSize: 18,
            fontWeight: '500',
            color: theme.foreground,
            marginBottom: 8,
        },
        loadingSubtitle: {
            fontSize: 14,
            color: theme.mutedForeground,
            marginBottom: 24,
            fontFamily: 'Monaco, monospace',
            textAlign: 'center',
        },
        progressContainer: {
            width: '100%',
            height: 4,
            backgroundColor: colorScheme === 'dark' ? '#374151' : '#e5e7eb',
            borderRadius: 2,
            marginBottom: 8,
        },
        progressBar: {
            height: 4,
            backgroundColor: colorScheme === 'dark' ? '#dc2626' : '#ef4444',
            borderRadius: 2,
        },
        progressText: {
            fontSize: 12,
            color: theme.mutedForeground,
            textAlign: 'center',
        },
        sessionContainer: {
            backgroundColor: colorScheme === 'dark' ? '#111827' : '#f3f4f6',
            borderRadius: 8,
            borderWidth: 1,
            borderColor: colorScheme === 'dark' ? '#374151' : '#e5e7eb',
            marginBottom: 16,
            overflow: 'hidden',
        },
        sessionHeader: {
            backgroundColor: colorScheme === 'dark' ? '#1f2937' : '#e5e7eb',
            padding: 8,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
        },
        sessionHeaderText: {
            fontSize: 14,
            fontWeight: '500',
            color: theme.foreground,
        },
        sessionContent: {
            padding: 16,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
        },
        sessionDot: {
            width: 8,
            height: 8,
            borderRadius: 4,
            backgroundColor: colorScheme === 'dark' ? '#dc2626' : '#ef4444',
        },
        sessionName: {
            fontSize: 14,
            fontFamily: 'Monaco, monospace',
            color: theme.foreground,
            flex: 1,
        },
        resultHeader: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 8,
        },
        resultTitle: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
        },
        resultTitleText: {
            fontSize: 14,
            fontWeight: '500',
            color: theme.foreground,
        },
        statusBadge: {
            flexDirection: 'row',
            alignItems: 'center',
            paddingHorizontal: 8,
            paddingVertical: 4,
            borderRadius: 12,
            backgroundColor: terminationSuccess
                ? (colorScheme === 'dark' ? '#064e3b30' : '#dcfce7')
                : (colorScheme === 'dark' ? '#7f1d1d30' : '#fecaca'),
        },
        statusText: {
            fontSize: 12,
            fontWeight: '500',
            marginLeft: 4,
            color: terminationSuccess
                ? (colorScheme === 'dark' ? '#34d399' : '#059669')
                : (colorScheme === 'dark' ? '#fca5a5' : '#dc2626'),
        },
        outputContainer: {
            backgroundColor: colorScheme === 'dark' ? '#111827' : '#f3f4f6',
            borderRadius: 8,
            borderWidth: 1,
            borderColor: colorScheme === 'dark' ? '#374151' : '#e5e7eb',
            overflow: 'hidden',
        },
        outputHeader: {
            backgroundColor: colorScheme === 'dark' ? '#1f2937' : '#e5e7eb',
            padding: 8,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
        },
        outputHeaderLeft: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
        },
        outputHeaderText: {
            fontSize: 14,
            fontWeight: '500',
            color: theme.foreground,
        },
        errorBadge: {
            flexDirection: 'row',
            alignItems: 'center',
            paddingHorizontal: 6,
            paddingVertical: 2,
            borderRadius: 8,
            backgroundColor: colorScheme === 'dark' ? '#7f1d1d30' : '#fecaca',
            borderWidth: 1,
            borderColor: colorScheme === 'dark' ? '#dc2626' : '#ef4444',
        },
        errorBadgeText: {
            fontSize: 10,
            color: colorScheme === 'dark' ? '#fca5a5' : '#dc2626',
            marginLeft: 2,
        },
        outputContent: {
            padding: 16,
            maxHeight: 300,
        },
        outputText: {
            fontSize: 12,
            fontFamily: 'Monaco, monospace',
            color: theme.foreground,
            lineHeight: 16,
        },
        noOutputContainer: {
            backgroundColor: colorScheme === 'dark' ? '#000000' : '#1e293b',
            borderRadius: 8,
            borderWidth: 1,
            borderColor: colorScheme === 'dark' ? '#374151' : '#475569',
            padding: 24,
            alignItems: 'center',
            justifyContent: 'center',
        },
        noOutputText: {
            fontSize: 14,
            color: colorScheme === 'dark' ? '#9ca3af' : '#94a3b8',
            marginTop: 8,
        },
        emptyState: {
            flex: 1,
            justifyContent: 'center',
            alignItems: 'center',
            paddingVertical: 48,
            paddingHorizontal: 24,
        },
        emptyIcon: {
            width: 80,
            height: 80,
            borderRadius: 40,
            backgroundColor: colorScheme === 'dark' ? '#1f2937' : '#f3f4f6',
            justifyContent: 'center',
            alignItems: 'center',
            marginBottom: 24,
        },
        emptyTitle: {
            fontSize: 20,
            fontWeight: '600',
            color: theme.foreground,
            marginBottom: 8,
        },
        emptyDescription: {
            fontSize: 14,
            color: theme.mutedForeground,
            textAlign: 'center',
            lineHeight: 20,
            maxWidth: 280,
        },
    });

    const renderLoadingState = () => (
        <View style={styles.loadingContainer}>
            <View style={styles.loadingIcon}>
                <ActivityIndicator size="large" color={colorScheme === 'dark' ? '#dc2626' : '#ef4444'} />
            </View>
            <Text style={styles.loadingTitle}>Terminating session</Text>
            <Text style={styles.loadingSubtitle}>
                {sessionName || 'Processing termination...'}
            </Text>
            <View style={styles.progressContainer}>
                <View style={[styles.progressBar, { width: `${progress}%` }]} />
            </View>
            <Text style={styles.progressText}>{progress}%</Text>
        </View>
    );

    const renderContent = () => {
        if (!sessionName) {
            return (
                <View style={styles.emptyState}>
                    <View style={styles.emptyIcon}>
                        <StopCircle size={40} color={theme.mutedForeground} />
                    </View>
                    <Text style={styles.emptyTitle}>No Session Found</Text>
                    <Text style={styles.emptyDescription}>
                        No session name was detected. Please provide a valid session to terminate.
                    </Text>
                </View>
            );
        }

        return (
            <View>
                <View style={styles.sessionContainer}>
                    <View style={styles.sessionHeader}>
                        <Power size={16} color={theme.foreground} />
                        <Text style={styles.sessionHeaderText}>Session</Text>
                    </View>
                    <View style={styles.sessionContent}>
                        <View style={styles.sessionDot} />
                        <Text style={styles.sessionName}>{sessionName}</Text>
                    </View>
                </View>

                {output ? (
                    <View style={{ marginBottom: 16 }}>
                        <View style={styles.resultHeader}>
                            <View style={styles.resultTitle}>
                                <ArrowRight size={16} color={theme.mutedForeground} />
                                <Text style={styles.resultTitleText}>Result</Text>
                            </View>
                            <View style={styles.statusBadge}>
                                {terminationSuccess ? (
                                    <CheckCircle size={12} color={styles.statusText.color} />
                                ) : (
                                    <AlertTriangle size={12} color={styles.statusText.color} />
                                )}
                                <Text style={styles.statusText}>
                                    {terminationSuccess ? 'Success' : 'Failed'}
                                </Text>
                            </View>
                        </View>

                        <View style={styles.outputContainer}>
                            <View style={styles.outputHeader}>
                                <View style={styles.outputHeaderLeft}>
                                    <Terminal size={16} color={theme.foreground} />
                                    <Text style={styles.outputHeaderText}>Termination output</Text>
                                </View>
                                {!terminationSuccess && (
                                    <View style={styles.errorBadge}>
                                        <AlertTriangle size={12} color={styles.errorBadgeText.color} />
                                        <Text style={styles.errorBadgeText}>Error</Text>
                                    </View>
                                )}
                            </View>
                            <ScrollView style={styles.outputContent} showsVerticalScrollIndicator={false}>
                                <Text style={styles.outputText}>
                                    {formattedOutput.map((line, index) => (
                                        line || ' '
                                    )).join('\n')}
                                </Text>
                            </ScrollView>
                        </View>
                    </View>
                ) : (
                    <View style={styles.noOutputContainer}>
                        <CircleDashed size={32} color={theme.mutedForeground} />
                        <Text style={styles.noOutputText}>No output received</Text>
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