import { useTheme } from '@/hooks/useThemeColor';
import * as Clipboard from 'expo-clipboard';
import { CheckCircle, ExternalLink, Globe, Rocket, Terminal, XCircle } from 'lucide-react-native';
import React, { useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Linking,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import { ToolViewProps } from './ToolViewRegistry';

export interface DeployToolViewProps extends ToolViewProps {
    assistantContent?: string;
    toolContent?: string;
    assistantTimestamp?: string;
    toolTimestamp?: string;
    messages?: any[];
}

const extractDeployData = (toolCall?: any, toolContent?: string, assistantContent?: string, messages?: any[]) => {
    let projectName = '';
    let directoryPath = '';
    let deployUrl = '';
    let isSuccess = true;
    let statusMessage = '';
    let deployOutput = '';

    // Extract project info from tool call parameters (for streaming/loading state)
    if (toolCall?.parameters) {
        projectName = toolCall.parameters.name || '';
        directoryPath = toolCall.parameters.directory_path || '';
    }

    // Parse the specific tool result content (this is the EXACT result for THIS tool execution)
    if (toolContent) {
        try {
            const parsed = JSON.parse(toolContent);

            if (parsed.tool_execution) {
                const toolExecution = parsed.tool_execution;

                // Extract arguments
                if (toolExecution.arguments) {
                    projectName = toolExecution.arguments.name || projectName;
                    directoryPath = toolExecution.arguments.directory_path || directoryPath;
                }

                // Extract result data
                if (toolExecution.result) {
                    const result = toolExecution.result;

                    // Get success status - this is the actual result
                    if (result.success !== undefined) {
                        isSuccess = result.success;
                    }

                    // Extract output data
                    if (result.output) {
                        if (result.output.message) {
                            statusMessage = result.output.message;
                        }

                        // Get the deployment log output
                        const outputStr = result.output.output || result.output;
                        if (outputStr) {
                            deployOutput = outputStr;

                            // Extract deployment URL from output
                            const urlMatch = outputStr.match(/https:\/\/[^\s]+\.pages\.dev[^\s]*/);
                            if (urlMatch) {
                                deployUrl = urlMatch[0];
                            }
                        }
                    }
                }
            }
        } catch (e) {
            // If parsing fails, treat as raw content
            deployOutput = toolContent;
            const urlMatch = toolContent.match(/https:\/\/[^\s]+\.pages\.dev[^\s]*/);
            if (urlMatch) {
                deployUrl = urlMatch[0];
            }
        }
    }

    return {
        projectName,
        directoryPath,
        deployUrl,
        isSuccess,
        statusMessage,
        deployOutput
    };
};

export const DeployToolView: React.FC<DeployToolViewProps> = ({
    toolCall,
    toolContent,
    assistantContent,
    isStreaming = false,
    messages,
    ...props
}) => {
    console.log('🚀 DEPLOY TOOL RECEIVED:', !!toolContent, toolContent?.length || 0);
    const theme = useTheme();
    const [copiedUrl, setCopiedUrl] = useState(false);

    if (!toolContent) {
        console.log('❌ DEPLOY TOOL: NO CONTENT');
        return (
            <View style={{
                flex: 1,
                justifyContent: 'center',
                alignItems: 'center',
                padding: 20,
                backgroundColor: theme.background,
            }}>
                <Text style={{
                    color: theme.mutedForeground,
                    fontSize: 16,
                    textAlign: 'center',
                }}>
                    No deployment data available
                </Text>
            </View>
        );
    }

    let resultData;
    try {
        resultData = JSON.parse(toolContent);
        console.log('✅ DEPLOY TOOL: PARSED DATA', typeof resultData, !!resultData.success);
    } catch (error) {
        console.log('❌ DEPLOY TOOL: PARSE ERROR', error);
        return (
            <View style={{
                flex: 1,
                justifyContent: 'center',
                alignItems: 'center',
                padding: 20,
                backgroundColor: theme.background,
            }}>
                <Text style={{
                    color: theme.destructive,
                    fontSize: 16,
                    textAlign: 'center',
                }}>
                    Failed to parse deployment data
                </Text>
            </View>
        );
    }

    const isSuccess = resultData.success;
    const outputText = resultData.output || '';

    console.log('📝 DEPLOY TOOL: OUTPUT TEXT', outputText.substring(0, 100) + '...');

    // Extract deployment URL from output
    const deploymentUrlMatch = outputText.match(/https:\/\/[^\s]+\.pages\.dev[^\s]*/);
    const deploymentUrl = deploymentUrlMatch ? deploymentUrlMatch[0] : null;

    console.log('🔗 DEPLOY TOOL: EXTRACTED URL', deploymentUrl);

    const {
        projectName,
        directoryPath,
        deployUrl,
        isSuccess: actualIsSuccess,
        statusMessage,
        deployOutput
    } = extractDeployData(toolCall, toolContent, assistantContent, messages);

    const copyUrl = async (url: string) => {
        try {
            await Clipboard.setStringAsync(url);
            setCopiedUrl(true);
            setTimeout(() => setCopiedUrl(false), 2000);
        } catch (error) {
            Alert.alert('Error', 'Failed to copy URL to clipboard');
        }
    };

    const handleLinkPress = (url: string) => {
        Linking.openURL(url).catch(() => {
            Alert.alert('Error', 'Failed to open URL');
        });
    };

    const styles = StyleSheet.create({
        container: {
            flex: 1,
            backgroundColor: theme.background,
        },
        loadingContainer: {
            flex: 1,
            justifyContent: 'center',
            alignItems: 'center',
            padding: 20,
        },
        loadingContent: {
            alignItems: 'center',
            backgroundColor: theme.card,
            padding: 24,
            borderRadius: 12,
            shadowColor: theme.shadowColor,
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.1,
            shadowRadius: 4,
            elevation: 3,
        },
        loadingText: {
            fontSize: 16,
            fontWeight: '600',
            color: theme.foreground,
            marginTop: 12,
        },
        loadingSubtext: {
            fontSize: 14,
            color: theme.muted,
            marginTop: 4,
        },
        scrollContainer: {
            flex: 1,
        },
        content: {
            padding: 16,
        },
        resultCard: {
            backgroundColor: theme.card,
            borderRadius: 12,
            padding: 16,
            marginBottom: 16,
            shadowColor: theme.shadowColor,
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.1,
            shadowRadius: 4,
            elevation: 3,
        },
        successCard: {
            backgroundColor: theme.secondary + '10',
            borderColor: theme.secondary + '30',
            borderWidth: 1,
        },
        errorCard: {
            backgroundColor: theme.destructive + '10',
            borderColor: theme.destructive + '30',
            borderWidth: 1,
        },
        statusRow: {
            flexDirection: 'row',
            alignItems: 'center',
            marginBottom: 12,
        },
        statusText: {
            fontSize: 16,
            fontWeight: '600',
            marginLeft: 8,
        },
        successText: {
            color: theme.secondary,
        },
        errorText: {
            color: theme.destructive,
        },
        urlContainer: {
            backgroundColor: theme.muted + '20',
            padding: 12,
            borderRadius: 8,
            marginBottom: 12,
        },
        urlText: {
            fontSize: 14,
            color: theme.foreground,
            fontFamily: 'monospace',
        },
        actionButton: {
            backgroundColor: theme.primary,
            paddingHorizontal: 16,
            paddingVertical: 10,
            borderRadius: 8,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: 8,
        },
        actionButtonText: {
            color: theme.background,
            fontSize: 14,
            fontWeight: '600',
            marginLeft: 8,
        },
        copyButton: {
            backgroundColor: theme.secondary,
            paddingHorizontal: 16,
            paddingVertical: 8,
            borderRadius: 6,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
        },
        copyButtonText: {
            color: theme.secondaryForeground,
            fontSize: 12,
            fontWeight: '500',
            marginLeft: 6,
        },
        logSection: {
            marginTop: 8,
        },
        logHeader: {
            flexDirection: 'row',
            alignItems: 'center',
            marginBottom: 8,
        },
        logTitle: {
            fontSize: 14,
            fontWeight: '600',
            color: theme.foreground,
            marginLeft: 8,
        },
        logContainer: {
            backgroundColor: theme.muted + '20',
            borderRadius: 8,
            padding: 12,
            maxHeight: 200,
        },
        logText: {
            fontSize: 12,
            color: theme.foreground,
            fontFamily: 'monospace',
            lineHeight: 16,
        },
        emptyState: {
            flex: 1,
            justifyContent: 'center',
            alignItems: 'center',
            padding: 20,
        },
        emptyText: {
            fontSize: 16,
            color: theme.muted,
            textAlign: 'center',
        },
    });

    const renderLoading = () => (
        <View style={styles.loadingContainer}>
            <View style={styles.loadingContent}>
                <Rocket size={32} color={theme.primary} />
                <ActivityIndicator size="large" color={theme.primary} style={{ marginTop: 12 }} />
                <Text style={styles.loadingText}>Deploying Website</Text>
                <Text style={styles.loadingSubtext}>
                    {projectName || 'Processing deployment...'}
                </Text>
            </View>
        </View>
    );

    const renderResults = () => (
        <ScrollView style={styles.scrollContainer}>
            <View style={styles.content}>
                {/* Success/Error Status */}
                <View style={[styles.resultCard, actualIsSuccess ? styles.successCard : styles.errorCard]}>
                    <View style={styles.statusRow}>
                        {actualIsSuccess ? (
                            <CheckCircle size={20} color={theme.secondary} />
                        ) : (
                            <XCircle size={20} color={theme.destructive} />
                        )}
                        <Text style={[styles.statusText, actualIsSuccess ? styles.successText : styles.errorText]}>
                            {statusMessage || (actualIsSuccess ? 'Deployment Successful' : 'Deployment Failed')}
                        </Text>
                    </View>

                    {/* Deploy URL */}
                    {deployUrl && (
                        <>
                            <View style={styles.urlContainer}>
                                <Text style={styles.urlText}>{deployUrl}</Text>
                            </View>

                            <TouchableOpacity
                                style={styles.actionButton}
                                onPress={() => handleLinkPress(deployUrl)}
                            >
                                <ExternalLink size={16} color={theme.background} />
                                <Text style={styles.actionButtonText}>Open Website</Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={styles.copyButton}
                                onPress={() => copyUrl(deployUrl)}
                            >
                                {copiedUrl ? (
                                    <CheckCircle size={14} color={theme.secondary} />
                                ) : (
                                    <Globe size={14} color={theme.secondaryForeground} />
                                )}
                                <Text style={styles.copyButtonText}>
                                    {copiedUrl ? 'Copied!' : 'Copy URL'}
                                </Text>
                            </TouchableOpacity>
                        </>
                    )}

                    {/* Deploy Output/Log */}
                    {deployOutput && (
                        <View style={styles.logSection}>
                            <View style={styles.logHeader}>
                                <Terminal size={16} color={theme.foreground} />
                                <Text style={styles.logTitle}>Deployment Log</Text>
                            </View>
                            <ScrollView style={styles.logContainer} nestedScrollEnabled>
                                <Text style={styles.logText}>{deployOutput}</Text>
                            </ScrollView>
                        </View>
                    )}
                </View>
            </View>
        </ScrollView>
    );

    const renderEmpty = () => (
        <View style={styles.emptyState}>
            <Text style={styles.emptyText}>No deployment results available</Text>
        </View>
    );

    return (
        <View style={styles.container}>
            {isStreaming ? renderLoading() : (deployUrl || deployOutput ? renderResults() : renderEmpty())}
        </View>
    );
}; 