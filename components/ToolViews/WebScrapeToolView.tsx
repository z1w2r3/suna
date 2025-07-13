import { useTheme } from '@/hooks/useThemeColor';
import * as Clipboard from 'expo-clipboard';
import { Calendar, Check, Copy, ExternalLink, FileText, Globe, Zap } from 'lucide-react-native';
import React, { useEffect, useState } from 'react';
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

export interface WebScrapeToolViewProps extends ToolViewProps {
    assistantContent?: string;
    toolContent?: string;
    assistantTimestamp?: string;
    toolTimestamp?: string;
    messages?: any[];
}

const extractWebScrapeData = (toolCall?: any, toolContent?: string) => {
    let url = '';
    let files: string[] = [];
    let isSuccess = true;
    let statusMessage = '';
    let errorMessage = '';

    // Extract from tool call parameters
    if (toolCall?.parameters) {
        url = toolCall.parameters.url ||
            toolCall.parameters.urls ||
            toolCall.parameters.webpage_url || '';
    }

    // Parse tool content if available
    if (toolContent) {
        try {
            const parsed = JSON.parse(toolContent);

            if (parsed.tool_execution) {
                const toolExecution = parsed.tool_execution;

                // Extract arguments
                if (toolExecution.arguments) {
                    url = toolExecution.arguments.url ||
                        toolExecution.arguments.urls ||
                        toolExecution.arguments.webpage_url || url;
                }

                // Extract result
                if (toolExecution.result) {
                    const result = toolExecution.result;

                    if (result.success !== undefined) {
                        isSuccess = result.success;
                    }

                    if (result.error) {
                        errorMessage = result.error;
                    }

                    if (result.output) {
                        const output = result.output;

                        // Handle string output (typical format: "Results saved to:\n- /workspace/scrape/file.json")
                        if (typeof output === 'string') {
                            statusMessage = output;

                            // Extract file paths from string
                            const fileMatches = output.match(/- (\/[^\n]+)/g);
                            if (fileMatches) {
                                files = fileMatches.map(match => match.replace('- ', ''));
                            }
                        }

                        // Handle object output (fallback)
                        if (typeof output === 'object') {
                            if (output.files && Array.isArray(output.files)) {
                                files = output.files;
                            }
                            if (output.url) {
                                url = output.url;
                            }
                            if (output.message) {
                                statusMessage = output.message;
                            }
                        }
                    }
                }
            }
        } catch (e) {
            // If parsing fails, mark as error
            isSuccess = false;
            errorMessage = 'Failed to parse scrape results';
        }
    }

    return {
        url,
        files,
        isSuccess,
        statusMessage,
        errorMessage
    };
};

const formatDomain = (url: string): string => {
    try {
        const urlObj = new URL(url);
        return urlObj.hostname.replace('www.', '');
    } catch {
        return url;
    }
};

const formatFileInfo = (filePath: string) => {
    const timestampMatch = filePath.match(/(\d{8}_\d{6})/);
    const domainMatch = filePath.match(/(\w+)_com\.json$/);
    const fileName = filePath.split('/').pop() || filePath;

    return {
        timestamp: timestampMatch ? timestampMatch[1] : '',
        domain: domainMatch ? domainMatch[1] : 'unknown',
        fileName,
        fullPath: filePath
    };
};

export const WebScrapeToolView: React.FC<WebScrapeToolViewProps> = ({
    toolCall,
    toolContent,
    isStreaming = false,
    isSuccess = true,
    ...props
}) => {
    const theme = useTheme();
    const [copiedFile, setCopiedFile] = useState<string | null>(null);
    const [progress, setProgress] = useState(0);

    console.log('🔧 WEB SCRAPE TOOL RECEIVED:', !!toolContent, toolContent?.length || 0);

    if (!toolContent && !isStreaming) {
        console.log('❌ WEB SCRAPE TOOL: NO CONTENT');
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
                    No web scrape data available
                </Text>
            </View>
        );
    }

    const {
        url,
        files,
        isSuccess: actualIsSuccess,
        statusMessage,
        errorMessage
    } = extractWebScrapeData(toolCall, toolContent);

    const domain = url ? formatDomain(url) : 'Unknown';

    // Simulate progress when streaming
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

    const copyFilePath = async (filePath: string) => {
        try {
            await Clipboard.setStringAsync(filePath);
            setCopiedFile(filePath);
            setTimeout(() => setCopiedFile(null), 2000);
        } catch {
            Alert.alert('Error', 'Failed to copy file path');
        }
    };

    const handleLinkPress = (url: string) => {
        Linking.openURL(url).catch(console.error);
    };

    const styles = StyleSheet.create({
        container: {
            flex: 1,
            backgroundColor: theme.background,
        },
        content: {
            flex: 1,
            padding: 16,
        },
        loadingContainer: {
            flex: 1,
            justifyContent: 'center',
            alignItems: 'center',
            gap: 16,
        },
        loadingText: {
            fontSize: 16,
            color: theme.mutedForeground,
            textAlign: 'center',
        },
        loadingDomain: {
            fontSize: 12,
            color: theme.mutedForeground,
            fontFamily: 'monospace',
            textAlign: 'center',
            marginTop: 8,
        },
        progressContainer: {
            width: '100%',
            maxWidth: 300,
            height: 4,
            backgroundColor: theme.muted,
            borderRadius: 2,
            overflow: 'hidden',
            marginTop: 16,
        },
        progressBar: {
            height: '100%',
            backgroundColor: theme.secondary,
            borderRadius: 2,
        },
        progressText: {
            fontSize: 12,
            color: theme.mutedForeground,
            textAlign: 'center',
            marginTop: 8,
        },
        sectionTitle: {
            fontSize: 14,
            fontWeight: '600',
            color: theme.foreground,
            marginBottom: 12,
            flexDirection: 'row',
            alignItems: 'center',
        },
        urlContainer: {
            backgroundColor: theme.card,
            borderRadius: 12,
            padding: 16,
            marginBottom: 16,
            borderWidth: 1,
            borderColor: theme.border,
        },
        urlHeader: {
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 8,
        },
        urlTitle: {
            fontSize: 14,
            fontWeight: '600',
            color: theme.foreground,
        },
        urlText: {
            fontSize: 14,
            color: theme.secondary,
            fontFamily: 'monospace',
        },
        domainText: {
            fontSize: 12,
            color: theme.mutedForeground,
            marginTop: 4,
        },
        filesHeader: {
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 12,
        },
        filesTitle: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
        },
        filesBadge: {
            backgroundColor: theme.secondary,
            paddingHorizontal: 8,
            paddingVertical: 4,
            borderRadius: 6,
        },
        filesBadgeText: {
            fontSize: 12,
            color: theme.secondaryForeground,
            fontWeight: '500',
        },
        fileItem: {
            backgroundColor: theme.card,
            borderRadius: 12,
            padding: 16,
            marginBottom: 12,
            borderWidth: 1,
            borderColor: theme.border,
        },
        fileItemHeader: {
            flexDirection: 'row',
            alignItems: 'flex-start',
            gap: 12,
        },
        fileIcon: {
            width: 40,
            height: 40,
            borderRadius: 8,
            backgroundColor: theme.muted,
            justifyContent: 'center',
            alignItems: 'center',
        },
        fileDetails: {
            flex: 1,
            gap: 8,
        },
        fileBadges: {
            flexDirection: 'row',
            flexWrap: 'wrap',
            gap: 6,
        },
        fileBadge: {
            backgroundColor: theme.secondary,
            paddingHorizontal: 6,
            paddingVertical: 2,
            borderRadius: 4,
            flexDirection: 'row',
            alignItems: 'center',
        },
        fileBadgeText: {
            fontSize: 10,
            color: theme.secondaryForeground,
            fontWeight: '500',
        },
        fileName: {
            fontSize: 14,
            fontWeight: '600',
            color: theme.foreground,
            fontFamily: 'monospace',
        },
        filePath: {
            fontSize: 12,
            color: theme.mutedForeground,
            fontFamily: 'monospace',
        },
        copyButton: {
            padding: 8,
            borderRadius: 8,
            backgroundColor: theme.muted,
        },
        copiedButton: {
            backgroundColor: theme.secondary,
        },
        emptyState: {
            flex: 1,
            justifyContent: 'center',
            alignItems: 'center',
            gap: 16,
        },
        emptyText: {
            fontSize: 16,
            color: theme.mutedForeground,
            textAlign: 'center',
        },
        emptySubtext: {
            fontSize: 14,
            color: theme.mutedForeground,
            textAlign: 'center',
            marginTop: 8,
        },
        emptyFilesContainer: {
            justifyContent: 'center',
            alignItems: 'center',
            paddingVertical: 32,
        },
        emptyFilesText: {
            fontSize: 14,
            color: theme.mutedForeground,
            textAlign: 'center',
            marginTop: 8,
        },
    });

    const renderLoading = () => (
        <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={theme.secondary} />
            <Text style={styles.loadingText}>Extracting Content</Text>
            <Text style={styles.loadingDomain}>Analyzing and processing {domain}</Text>
            <View style={styles.progressContainer}>
                <View style={[styles.progressBar, { width: `${progress}%` }]} />
            </View>
            <Text style={styles.progressText}>{progress}% complete</Text>
        </View>
    );

    const renderResults = () => (
        <ScrollView style={styles.content}>
            {/* URL Section */}
            <View style={{ marginBottom: 16 }}>
                <View style={[styles.sectionTitle, { marginBottom: 8 }]}>
                    <Globe size={16} color={theme.foreground} />
                    <Text style={[styles.sectionTitle, { marginLeft: 8, marginBottom: 0 }]}>Source URL</Text>
                </View>
                <TouchableOpacity
                    style={styles.urlContainer}
                    onPress={() => handleLinkPress(url)}
                    activeOpacity={0.7}
                >
                    <View style={styles.urlHeader}>
                        <View style={{ flex: 1 }}>
                            <Text style={styles.urlText} numberOfLines={2}>{url}</Text>
                            <Text style={styles.domainText}>{domain}</Text>
                        </View>
                        <ExternalLink size={20} color={theme.mutedForeground} />
                    </View>
                </TouchableOpacity>
            </View>

            {/* Files Section */}
            <View style={{ marginBottom: 16 }}>
                <View style={styles.filesHeader}>
                    <View style={styles.filesTitle}>
                        <Zap size={16} color={theme.foreground} />
                        <Text style={[styles.sectionTitle, { marginBottom: 0 }]}>Generated Files</Text>
                    </View>
                    <View style={styles.filesBadge}>
                        <Text style={styles.filesBadgeText}>
                            {files.length} file{files.length !== 1 ? 's' : ''}
                        </Text>
                    </View>
                </View>

                {files.length > 0 ? (
                    <View>
                        {files.map((filePath, index) => {
                            const fileInfo = formatFileInfo(filePath);
                            const isCopied = copiedFile === filePath;

                            return (
                                <View key={index} style={styles.fileItem}>
                                    <View style={styles.fileItemHeader}>
                                        <View style={styles.fileIcon}>
                                            <FileText size={20} color={theme.foreground} />
                                        </View>

                                        <View style={styles.fileDetails}>
                                            <View style={styles.fileBadges}>
                                                <View style={styles.fileBadge}>
                                                    <Text style={styles.fileBadgeText}>JSON</Text>
                                                </View>
                                                {fileInfo.timestamp && (
                                                    <View style={styles.fileBadge}>
                                                        <Calendar size={10} color={theme.secondaryForeground} />
                                                        <Text style={[styles.fileBadgeText, { marginLeft: 4 }]}>
                                                            {fileInfo.timestamp.replace('_', ' ')}
                                                        </Text>
                                                    </View>
                                                )}
                                            </View>

                                            <Text style={styles.fileName}>{fileInfo.fileName}</Text>
                                            <Text style={styles.filePath} numberOfLines={1}>{fileInfo.fullPath}</Text>
                                        </View>

                                        <TouchableOpacity
                                            style={[styles.copyButton, isCopied && styles.copiedButton]}
                                            onPress={() => copyFilePath(filePath)}
                                            activeOpacity={0.7}
                                        >
                                            {isCopied ? (
                                                <Check size={16} color={theme.secondary} />
                                            ) : (
                                                <Copy size={16} color={theme.foreground} />
                                            )}
                                        </TouchableOpacity>
                                    </View>
                                </View>
                            );
                        })}
                    </View>
                ) : (
                    <View style={styles.emptyFilesContainer}>
                        <FileText size={32} color={theme.mutedForeground} />
                        <Text style={styles.emptyFilesText}>No files generated</Text>
                    </View>
                )}
            </View>
        </ScrollView>
    );

    const renderEmpty = () => (
        <View style={styles.emptyState}>
            <Globe size={48} color={theme.mutedForeground} />
            <Text style={styles.emptyText}>No URL Detected</Text>
            <Text style={styles.emptySubtext}>
                Unable to extract a valid URL from the scraping request
            </Text>
        </View>
    );

    return (
        <View style={styles.container}>
            {isStreaming ? renderLoading() :
                url ? renderResults() : renderEmpty()}
        </View>
    );
}; 