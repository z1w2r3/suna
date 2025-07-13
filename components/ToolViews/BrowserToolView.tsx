import { useTheme } from '@/hooks/useThemeColor';
import { AlertTriangle, CheckCircle, Clock, Globe, Monitor } from 'lucide-react-native';
import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Caption } from '../Typography';
import { ToolViewProps } from './ToolViewRegistry';

export interface BrowserToolViewProps extends ToolViewProps {
    assistantContent?: string;
    toolContent?: string;
    assistantTimestamp?: string;
    toolTimestamp?: string;
    project?: any;
    agentStatus?: 'idle' | 'running';
    currentIndex?: number;
    totalCalls?: number;
}

// Type definitions for parsed JSON data
interface ToolResultData {
    url?: string;
    image_url?: string;
    message_id?: string;
    [key: string]: any;
}

interface ParsedContent {
    content?: string;
    tool_execution?: {
        result?: {
            output?: {
                image_url?: string;
                [key: string]: any;
            };
        };
    };
    [key: string]: any;
}

interface BrowserStateContent {
    screenshot_base64?: string;
    image_url?: string;
    [key: string]: any;
}

const safeJsonParse = <T,>(jsonString: string | undefined | null, fallback: T): T => {
    if (!jsonString) return fallback;
    try {
        const parsed = JSON.parse(jsonString);
        if (typeof parsed === 'string' && (parsed.startsWith('{') || parsed.startsWith('['))) {
            return JSON.parse(parsed) as T;
        }
        return parsed as T;
    } catch {
        return fallback;
    }
};

const extractBrowserUrl = (content: string | undefined): string | null => {
    if (!content) return null;

    const urlMatch = content.match(/(?:url|URL)["']?\s*[:=]\s*["']?([^"'\s,}]+)/);
    if (urlMatch) return urlMatch[1];

    const httpMatch = content.match(/https?:\/\/[^\s"']+/);
    if (httpMatch) return httpMatch[0];

    return null;
};

const extractBrowserOperation = (toolName: string | undefined): string => {
    if (!toolName) return 'Browser Action';

    const operations: { [key: string]: string } = {
        'browser-navigate-to': 'Navigate',
        'browser-click-element': 'Click Element',
        'browser-input-text': 'Input Text',
        'browser-scroll-down': 'Scroll Down',
        'browser-scroll-up': 'Scroll Up',
        'browser-go-back': 'Go Back',
        'browser-wait': 'Wait',
        'browser-send-keys': 'Send Keys',
        'browser-switch-tab': 'Switch Tab',
        'browser-close-tab': 'Close Tab',
        'browser-scroll-to-text': 'Scroll to Text',
        'browser-get-dropdown-options': 'Get Dropdown Options',
        'browser-select-dropdown-option': 'Select Option',
        'browser-drag-drop': 'Drag & Drop',
        'browser-click-coordinates': 'Click Coordinates',
    };

    return operations[toolName] || 'Browser Action';
};

const extractBrowserToolData = (
    toolCall?: any,
    assistantContent?: string,
    toolContent?: string,
    messages?: any[],
    assistantTimestamp?: string,
    toolTimestamp?: string
) => {
    let screenshotUrl: string | null = null;
    let screenshotBase64: string | null = null;
    let messageId: string | null = null;
    let url: string | null = null;

    // Extract URL from toolCall parameters first
    if (toolCall?.parameters) {
        url = toolCall.parameters.url || toolCall.parameters.target_url || null;
    }

    // Get the timestamp to scope the search to this tool call
    const toolCallTimestamp = assistantTimestamp || toolTimestamp;
    const toolCallTime = toolCallTimestamp ? new Date(toolCallTimestamp).getTime() : 0;

    // Tools that don't produce browser state screenshots
    const nonScreenshotTools = [
        'browser-wait',
        'browser-go-back',
        'browser-send-keys',
        'browser-switch-tab',
        'browser-close-tab'
    ];

    const toolName = toolCall?.function_name || toolCall?.functionName || name;
    const shouldSkipScreenshot = nonScreenshotTools.includes(toolName);


    // MAIN SEARCH: Look for browser_state messages with screenshot data
    if (messages && messages.length > 0 && !shouldSkipScreenshot) {
        // Sort messages by created_at chronologically
        const sortedMessages = [...messages].sort((a, b) => {
            const timeA = a.created_at ? new Date(a.created_at).getTime() : 0;
            const timeB = b.created_at ? new Date(b.created_at).getTime() : 0;
            return timeA - timeB; // Chronological order
        });

        // Find browser_state messages and log them
        const browserStates = sortedMessages.filter(m => m.type === 'browser_state');

        browserStates.forEach((msg, i) => {
            const msgTime = msg.created_at ? new Date(msg.created_at).getTime() : 0;
            const hasScreenshot = msg.content?.screenshot_base64 || msg.content?.image_url;
        });

        // Find the browser_state message that's CLOSEST to this tool call timestamp
        let closestBrowserState = null;
        let closestTimeDiff = Infinity;

        for (const message of sortedMessages) {
            if (message.type === 'browser_state' && message.content) {
                const messageTime = message.created_at ? new Date(message.created_at).getTime() : 0;
                const timeDiff = Math.abs(messageTime - toolCallTime);

                // Only consider browser_state messages that are VERY close to the tool call (within 10 seconds)
                // This ensures we only match browser_state that's actually for this tool call
                if (timeDiff < 10000 && timeDiff < closestTimeDiff) {
                    const content = message.content as any;
                    if (content.screenshot_base64 || content.image_url) {
                        closestBrowserState = message;
                        closestTimeDiff = timeDiff;
                    }
                }
            }
        }

        if (closestBrowserState) {
            const content = closestBrowserState.content as any;
            if (content.screenshot_base64) {
                screenshotBase64 = content.screenshot_base64;
                messageId = closestBrowserState.message_id || null;
                url = url || content.url || null;
            } else if (content.image_url) {
                screenshotUrl = content.image_url;
                messageId = closestBrowserState.message_id || null;
                url = url || content.url || null;
            }
        }



        // If no browser_state found, try tool_execution results
        if (!screenshotUrl && !screenshotBase64) {
            for (const message of sortedMessages) {
                if (message.type === 'tool' || message.type === 'system' || message.type === 'assistant') {
                    const messageTime = message.created_at ? new Date(message.created_at).getTime() : 0;

                    // Only consider messages created AFTER this tool call
                    if (toolCallTime > 0 && messageTime <= toolCallTime) {
                        continue;
                    }

                    try {
                        let messageContent = message.content;

                        // Handle string content
                        if (typeof messageContent === 'string') {
                            try {
                                const parsed = JSON.parse(messageContent);
                                if (parsed.tool_execution) {
                                    const toolExecution = parsed.tool_execution;

                                    // Check if this is a browser tool execution
                                    if (toolExecution.function_name?.includes('browser') ||
                                        toolExecution.xml_tag_name?.includes('browser')) {

                                        // Extract screenshot data from result
                                        const resultOutput = toolExecution.result?.output;
                                        if (resultOutput) {
                                            if (typeof resultOutput === 'object') {
                                                screenshotUrl = resultOutput.image_url || null;
                                                messageId = resultOutput.message_id || null;
                                                url = url || resultOutput.url || null;
                                            } else if (typeof resultOutput === 'string') {
                                                try {
                                                    const parsedOutput = JSON.parse(resultOutput);
                                                    screenshotUrl = parsedOutput.image_url || null;
                                                    messageId = parsedOutput.message_id || null;
                                                    url = url || parsedOutput.url || null;
                                                } catch (e) {
                                                    // Ignore parse errors
                                                }
                                            }
                                        }

                                        if (screenshotUrl || messageId) {
                                            break;
                                        }
                                    }
                                }
                            } catch (e) {
                                // Ignore parse errors
                            }
                        }

                        // Handle object content
                        if (typeof messageContent === 'object' && messageContent !== null) {
                            const content = messageContent as any;

                            // Check nested content field
                            if (content.content && typeof content.content === 'string') {
                                try {
                                    const nestedParsed = JSON.parse(content.content);
                                    if (nestedParsed.tool_execution) {
                                        const toolExecution = nestedParsed.tool_execution;

                                        if (toolExecution.function_name?.includes('browser') ||
                                            toolExecution.xml_tag_name?.includes('browser')) {

                                            const resultOutput = toolExecution.result?.output;
                                            if (resultOutput) {
                                                if (typeof resultOutput === 'object') {
                                                    screenshotUrl = resultOutput.image_url || null;
                                                    messageId = resultOutput.message_id || null;
                                                    url = url || resultOutput.url || null;
                                                } else if (typeof resultOutput === 'string') {
                                                    try {
                                                        const parsedOutput = JSON.parse(resultOutput);
                                                        screenshotUrl = parsedOutput.image_url || null;
                                                        messageId = parsedOutput.message_id || null;
                                                        url = url || parsedOutput.url || null;
                                                    } catch (e) {
                                                        // Ignore parse errors
                                                    }
                                                }
                                            }

                                            if (screenshotUrl || messageId) {
                                                break;
                                            }
                                        }
                                    }
                                } catch (e) {
                                    // Ignore parse errors
                                }
                            }

                            // Check direct tool_execution in object
                            if (content.tool_execution) {
                                const toolExecution = content.tool_execution;

                                if (toolExecution.function_name?.includes('browser') ||
                                    toolExecution.xml_tag_name?.includes('browser')) {

                                    const resultOutput = toolExecution.result?.output;
                                    if (resultOutput) {
                                        if (typeof resultOutput === 'object') {
                                            screenshotUrl = resultOutput.image_url || null;
                                            messageId = resultOutput.message_id || null;
                                            url = url || resultOutput.url || null;
                                        } else if (typeof resultOutput === 'string') {
                                            try {
                                                const parsedOutput = JSON.parse(resultOutput);
                                                screenshotUrl = parsedOutput.image_url || null;
                                                messageId = parsedOutput.message_id || null;
                                                url = url || parsedOutput.url || null;
                                            } catch (e) {
                                                // Ignore parse errors
                                            }
                                        }
                                    }

                                    if (screenshotUrl || messageId) {
                                        break;
                                    }
                                }
                            }
                        }
                    } catch (e) {
                        // Ignore errors
                    }
                }
            }
        }
    } else if (shouldSkipScreenshot) {
        console.log(`🚫 Skipping screenshot search for ${toolName} - tool doesn't produce browser state`);
    }

    // Try to find screenshot in browser state messages
    if (!screenshotUrl && !screenshotBase64 && messageId && messages && messages.length > 0) {
        const browserStateMessage = messages.find(
            (msg) => msg.type === 'browser_state' && msg.message_id === messageId
        );

        if (browserStateMessage) {
            const browserStateContent = safeJsonParse<BrowserStateContent>(browserStateMessage.content, {});
            screenshotBase64 = browserStateContent?.screenshot_base64 || null;
            screenshotUrl = browserStateContent?.image_url || null;
        }
    }

    // Fallback: try legacy extraction from content
    if (!screenshotUrl && !screenshotBase64 && !url) {
        // Extract URL from assistant content
        if (assistantContent && !url) {
            url = extractBrowserUrl(assistantContent);
        }

        // Try to extract from ToolResult in content
        const content = toolContent || assistantContent;
        if (content) {
            try {
                const toolResultMatch = content.match(/ToolResult\([^)]*output='([\s\S]*?)'(?:\s*,|\s*\))/);
                if (toolResultMatch) {
                    const outputString = toolResultMatch[1];
                    const cleanedOutput = outputString.replace(/\\n/g, '\n').replace(/\\"/g, '"');
                    const outputJson = safeJsonParse<ToolResultData>(cleanedOutput, {});

                    screenshotUrl = outputJson.image_url || null;
                    messageId = outputJson.message_id || null;
                    url = url || outputJson.url || null;
                }
            } catch (error) {
                // Ignore errors
            }
        }
    }

    const result = { screenshotUrl, screenshotBase64, messageId, url };
    return result;
};

export const BrowserToolView: React.FC<BrowserToolViewProps> = ({
    name = 'browser-operation',
    assistantContent,
    toolContent,
    assistantTimestamp,
    toolTimestamp,
    isSuccess = true,
    isStreaming = false,
    project,
    agentStatus = 'idle',
    messages = [],
    currentIndex = 0,
    totalCalls = 1,
    ...props
}) => {
    const theme = useTheme();
    const [imageLoading, setImageLoading] = useState(true);
    const [imageError, setImageError] = useState(false);

    // Extract data using MOBILE APP PATTERN
    const { screenshotUrl, screenshotBase64, messageId, url } = extractBrowserToolData(
        props.toolCall,
        assistantContent,
        toolContent,
        messages,
        assistantTimestamp,
        toolTimestamp
    );

    const operation = extractBrowserOperation(name);

    const isRunning = isStreaming || agentStatus === 'running';
    const isLastToolCall = currentIndex === totalCalls - 1;

    // VNC preview URL
    const vncPreviewUrl = useMemo(() => {
        if (!project?.sandbox?.vnc_preview) return null;
        return `${project.sandbox.vnc_preview}/vnc_lite.html?password=${project?.sandbox?.pass}&autoconnect=true&scale=local&width=1024&height=768`;
    }, [project]);

    // Reset image loading state when screenshot changes
    useEffect(() => {
        if (screenshotUrl || screenshotBase64) {
            setImageLoading(true);
            setImageError(false);
        }
    }, [screenshotUrl, screenshotBase64]);

    const handleImageLoad = () => {
        setImageLoading(false);
        setImageError(false);
    };

    const handleImageError = () => {
        setImageLoading(false);
        setImageError(true);
    };

    // Format timestamp for display
    const formatTimestamp = (timestamp: string | undefined) => {
        if (!timestamp) return '';
        try {
            const date = new Date(timestamp);
            return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        } catch {
            return '';
        }
    };

    // Get status icon
    const getStatusIcon = () => {
        if (isRunning) {
            return <Clock size={16} color={theme.mutedForeground} />;
        } else if (isSuccess) {
            return <CheckCircle size={16} color={theme.primary} />;
        } else {
            return <AlertTriangle size={16} color={theme.destructive} />;
        }
    };

    // Get status color
    const getStatusColor = () => {
        if (isRunning) {
            return theme.mutedForeground;
        } else if (isSuccess) {
            return theme.primary;
        } else {
            return theme.destructive;
        }
    };

    const renderScreenshot = () => {
        const imageSource = screenshotUrl
            ? { uri: screenshotUrl }
            : screenshotBase64
                ? { uri: `data:image/png;base64,${screenshotBase64}` }
                : null;

        if (!imageSource) return null;

        return (
            <View style={styles.screenshotContainer}>
                <View style={styles.imageContainer}>
                    {imageLoading && (
                        <View style={styles.imageLoading}>
                            <ActivityIndicator size="large" color={theme.primary} />
                        </View>
                    )}
                    {imageError ? (
                        <View style={styles.imageError}>
                            <AlertTriangle size={24} color={theme.mutedForeground} />
                            <Caption style={[styles.errorText, { color: theme.mutedForeground }]}>
                                Failed to load screenshot
                            </Caption>
                        </View>
                    ) : (
                        <Image
                            source={imageSource}
                            style={styles.screenshot}
                            onLoad={handleImageLoad}
                            onError={handleImageError}
                            resizeMode="contain"
                        />
                    )}
                </View>

                {/* URL info */}
                {url && (
                    <View style={styles.urlContainer}>
                        <Globe size={14} color={theme.mutedForeground} />
                        <Caption style={[styles.urlText, { color: theme.mutedForeground }]} numberOfLines={1}>
                            {url}
                        </Caption>
                    </View>
                )}

                {/* VNC Preview Button */}
                {vncPreviewUrl && (
                    <TouchableOpacity
                        style={[styles.vncButton, { backgroundColor: theme.secondary }]}
                        onPress={() => {
                            // Handle VNC preview navigation
                            console.log('VNC Preview:', vncPreviewUrl);
                        }}
                    >
                        <Monitor size={14} color={theme.secondaryForeground} />
                        <Caption style={[styles.vncButtonText, { color: theme.secondaryForeground }]}>
                            View Live Browser
                        </Caption>
                    </TouchableOpacity>
                )}
            </View>
        );
    };

    const renderContent = () => {
        // Loading state
        if (isRunning) {
            return (
                <View style={styles.loadingContainer}>
                    <View style={styles.loadingIconContainer}>
                        <ActivityIndicator size="large" color={theme.primary} />
                    </View>
                    <Text style={styles.loadingTitle}>
                        {operation} in progress
                    </Text>
                    <Text style={styles.loadingSubtitle}>
                        {url || 'Executing browser action...'}
                    </Text>
                </View>
            );
        }

        // Show screenshot if available
        if (screenshotUrl || screenshotBase64) {
            return renderScreenshot();
        }

        // Empty state
        return (
            <View style={styles.emptyContainer}>
                <View style={styles.emptyIconContainer}>
                    <Monitor size={32} color={theme.mutedForeground} />
                </View>
                <Text style={[styles.emptyTitle, { color: theme.mutedForeground }]}>
                    No Browser State Available
                </Text>
                <Text style={[styles.emptySubtitle, { color: theme.mutedForeground }]}>
                    Browser state image not found for this action
                </Text>
                {url && (
                    <View style={styles.urlContainer}>
                        <Globe size={14} color={theme.mutedForeground} />
                        <Caption style={[styles.urlText, { color: theme.mutedForeground }]} numberOfLines={1}>
                            {url}
                        </Caption>
                    </View>
                )}
            </View>
        );
    };

    return (
        <View style={[styles.container, { backgroundColor: theme.background }]}>
            {renderContent()}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        padding: 12,
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: 200,
    },
    loadingIconContainer: {
        marginBottom: 16,
    },
    loadingTitle: {
        fontSize: 16,
        fontWeight: '600',
        marginBottom: 8,
        textAlign: 'center',
    },
    loadingSubtitle: {
        fontSize: 14,
        textAlign: 'center',
        opacity: 0.7,
    },
    screenshotContainer: {
        flex: 1,
    },
    imageContainer: {
        flex: 1,
        backgroundColor: '#f5f5f5',
        borderRadius: 8,
        overflow: 'hidden',
        position: 'relative',
        minHeight: 200,
    },
    screenshot: {
        width: '100%',
        height: '100%',
    },
    imageLoading: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'rgba(0, 0, 0, 0.1)',
    },
    imageError: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    errorText: {
        marginTop: 8,
        textAlign: 'center',
    },
    urlContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 12,
        paddingHorizontal: 12,
        paddingVertical: 8,
        backgroundColor: 'rgba(0, 0, 0, 0.05)',
        borderRadius: 6,
    },
    urlText: {
        flex: 1,
        marginLeft: 8,
    },
    vncButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 12,
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderRadius: 6,
    },
    vncButtonText: {
        marginLeft: 8,
        fontSize: 12,
        fontWeight: '500',
    },
    emptyContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: 200,
    },
    emptyIconContainer: {
        marginBottom: 16,
    },
    emptyTitle: {
        fontSize: 16,
        fontWeight: '600',
        marginBottom: 8,
        textAlign: 'center',
    },
    emptySubtitle: {
        fontSize: 14,
        textAlign: 'center',
        opacity: 0.7,
        marginBottom: 16,
    },
}); 