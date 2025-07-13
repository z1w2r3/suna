import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Colors } from '../../constants/Colors';
import { useColorScheme } from '../../hooks/useColorScheme';
import { getToolTitle } from '../renderers/file-operation-utils';
import { H4 } from '../Typography';
import { ToolViewProps } from './ToolViewRegistry';

interface CommandToolViewProps extends ToolViewProps {
    assistantContent?: string;
    toolContent?: string;
    assistantTimestamp?: string;
    toolTimestamp?: string;
    toolCall?: any;
    messages?: any[];
}

interface CommandData {
    command: string | null;
    output: string | null;
    exitCode: number | null;
    sessionName: string | null;
    cwd: string | null;
    completed: boolean;
    actualIsSuccess: boolean;
    actualToolTimestamp: string | null;
    actualAssistantTimestamp: string | null;
}

function extractCommandData(
    toolCall?: any,
    assistantContent?: string,
    toolContent?: string,
    isSuccess?: boolean,
    toolTimestamp?: string,
    assistantTimestamp?: string,
    messages?: any[],
    isStreaming?: boolean
): CommandData {
    let command = null;
    let output = null;
    let exitCode = null;
    let sessionName = null;
    let cwd = null;
    let completed = false;

    // Extract command from toolCall parameters (primary source)
    if (toolCall?.parameters) {
        command = toolCall.parameters.command || toolCall.parameters.session_name;
        sessionName = toolCall.parameters.session_name;
        cwd = toolCall.parameters.cwd;
        output = toolCall.parameters.output;
        exitCode = toolCall.parameters.exit_code;
    }

    // Extract command from assistant content (fallback)
    if (!command && assistantContent) {
        try {
            const parsed = JSON.parse(assistantContent);
            command = parsed.command || parsed.session_name;
            sessionName = parsed.session_name;
            cwd = parsed.cwd;
        } catch {
            // Try to extract from raw text
            const commandMatch = assistantContent.match(/command['":\s]*([^"'\n]+)/i);
            if (commandMatch) {
                command = commandMatch[1].trim();
            }
        }
    }

    // Extract output from tool content (fallback)
    if (!output && toolContent) {
        try {
            const parsed = JSON.parse(toolContent);
            output = parsed.output || parsed.result;
            exitCode = parsed.exit_code !== undefined ? parsed.exit_code : null;
            completed = parsed.completed !== undefined ? parsed.completed : true;
        } catch {
            // Use raw content as output
            output = toolContent;
            completed = true;
        }
    }

    // NEW: Look for command results in messages array (mobile app pattern)
    if (!output && messages && toolCall) {
        // Debug: Log ALL messages to understand the structure
        console.log('CommandToolView: === FULL MESSAGE DUMP ===');
        console.log('CommandToolView: Looking for command:', command);
        console.log('CommandToolView: Total messages:', messages.length);

        messages.forEach((message, index) => {
            console.log(`CommandToolView: Message ${index}:`, {
                type: message.type,
                contentType: typeof message.content,
                hasMetadata: !!message.metadata,
                fullContent: message.content,
                fullMetadata: message.metadata,
                created_at: message.created_at,
                message_id: message.message_id
            });
        });

        for (const message of messages) {
            // Look for tool result messages more broadly
            if (message.type === 'tool' || message.type === 'system' || message.type === 'assistant') {
                try {
                    let messageContent = message.content;

                    // Debug: Log message structure
                    console.log('CommandToolView: Processing message:', {
                        type: message.type,
                        contentType: typeof messageContent,
                        hasMetadata: !!message.metadata,
                        fullContent: messageContent
                    });

                    // Handle string content - check if it contains command output directly
                    if (typeof messageContent === 'string') {
                        // Check if this string contains command output directly
                        if (messageContent.includes('root@') || messageContent.includes('COMMAND_DONE') ||
                            messageContent.includes('total ') || messageContent.includes('drwx')) {
                            console.log('CommandToolView: Found potential command output in string:', messageContent);
                            output = messageContent;
                            completed = true;
                            break;
                        }

                        try {
                            const parsed = JSON.parse(messageContent);
                            console.log('CommandToolView: Parsed JSON from string:', parsed);

                            if (parsed.tool_execution) {
                                const toolExecution = parsed.tool_execution;
                                console.log('CommandToolView: Found tool_execution:', toolExecution);

                                // Check if this is the result for our command (ANY command tool)
                                if (toolExecution.function_name === 'execute_command' ||
                                    toolExecution.xml_tag_name === 'execute_command' ||
                                    toolExecution.function_name === 'execute-command' ||
                                    toolExecution.xml_tag_name === 'execute-command' ||
                                    toolExecution.function_name?.includes('command') ||
                                    toolExecution.xml_tag_name?.includes('command')) {
                                    // Handle nested output structure: result.output.output
                                    const resultOutput = toolExecution.result?.output;
                                    if (resultOutput && typeof resultOutput === 'object' && resultOutput.output) {
                                        output = resultOutput.output;
                                        // Also check for exit_code in nested structure
                                        exitCode = resultOutput.exit_code || toolExecution.result?.exit_code || null;
                                    } else {
                                        output = resultOutput || null;
                                        exitCode = toolExecution.result?.exit_code || null;
                                    }
                                    completed = true;
                                    console.log('CommandToolView: Found result in string content:', { output: output?.substring(0, 200), exitCode });
                                    break;
                                }
                            }

                            // Check for raw output in parsed JSON
                            if (parsed.output) {
                                console.log('CommandToolView: Found raw output in parsed JSON:', parsed.output);
                                output = parsed.output;
                                completed = true;
                                break;
                            }
                        } catch (e) {
                            console.log('CommandToolView: Failed to parse JSON from string:', e);
                        }
                    }

                    // Handle object content
                    if (typeof messageContent === 'object' && messageContent !== null) {
                        const content = messageContent as any;
                        console.log('CommandToolView: Processing object content:', content);

                        // Check for direct output in content
                        if (content.output) {
                            console.log('CommandToolView: Found direct output in object:', content.output);
                            output = content.output;
                            completed = true;
                            break;
                        }

                        // Check nested content field
                        if (content.content && typeof content.content === 'string') {
                            console.log('CommandToolView: Found nested content string:', content.content);

                            try {
                                const nestedParsed = JSON.parse(content.content);
                                console.log('CommandToolView: Parsed nested JSON:', nestedParsed);

                                if (nestedParsed.tool_execution) {
                                    const toolExecution = nestedParsed.tool_execution;
                                    console.log('CommandToolView: Found tool_execution in nested:', toolExecution);

                                    if (toolExecution.function_name?.includes('command') ||
                                        toolExecution.xml_tag_name?.includes('command')) {
                                        // Handle nested output structure: result.output.output
                                        const resultOutput = toolExecution.result?.output;
                                        if (resultOutput && typeof resultOutput === 'object' && resultOutput.output) {
                                            output = resultOutput.output;
                                            // Also check for exit_code in nested structure
                                            exitCode = resultOutput.exit_code || toolExecution.result?.exit_code || null;
                                        } else {
                                            output = resultOutput || null;
                                            exitCode = toolExecution.result?.exit_code || null;
                                        }
                                        completed = true;
                                        console.log('CommandToolView: Found result in nested content:', { output: output?.substring(0, 200), exitCode });
                                        break;
                                    }
                                }
                            } catch (e) {
                                console.log('CommandToolView: Failed to parse nested JSON:', e);
                            }
                        }

                        if (content.tool_execution) {
                            const toolExecution = content.tool_execution;
                            console.log('CommandToolView: Found tool_execution in object:', toolExecution);

                            // Check if this is the result for our command (ANY command tool)
                            if (toolExecution.function_name === 'execute_command' ||
                                toolExecution.xml_tag_name === 'execute_command' ||
                                toolExecution.function_name === 'execute-command' ||
                                toolExecution.xml_tag_name === 'execute-command' ||
                                toolExecution.function_name?.includes('command') ||
                                toolExecution.xml_tag_name?.includes('command')) {
                                // Handle nested output structure: result.output.output
                                const resultOutput = toolExecution.result?.output;
                                if (resultOutput && typeof resultOutput === 'object' && resultOutput.output) {
                                    output = resultOutput.output;
                                    // Also check for exit_code in nested structure
                                    exitCode = resultOutput.exit_code || toolExecution.result?.exit_code || null;
                                } else {
                                    output = resultOutput || null;
                                    exitCode = toolExecution.result?.exit_code || null;
                                }
                                completed = true;
                                console.log('CommandToolView: Found result in object content:', { output: output?.substring(0, 200), exitCode });
                                break;
                            }
                        }
                    }

                    // Check metadata for tool_execution
                    if (message.metadata) {
                        console.log('CommandToolView: Checking metadata:', message.metadata);

                        if (message.metadata.tool_execution) {
                            const toolExecution = message.metadata.tool_execution;
                            console.log('CommandToolView: Found tool_execution in metadata:', toolExecution);

                            if (toolExecution.function_name?.includes('command') ||
                                toolExecution.xml_tag_name?.includes('command')) {
                                // Handle nested output structure: result.output.output
                                const resultOutput = toolExecution.result?.output;
                                if (resultOutput && typeof resultOutput === 'object' && resultOutput.output) {
                                    output = resultOutput.output;
                                    // Also check for exit_code in nested structure
                                    exitCode = resultOutput.exit_code || toolExecution.result?.exit_code || null;
                                } else {
                                    output = resultOutput || null;
                                    exitCode = toolExecution.result?.exit_code || null;
                                }
                                completed = true;
                                console.log('CommandToolView: Found result in metadata:', { output: output?.substring(0, 200), exitCode });
                                break;
                            }
                        }

                        // Check for other metadata fields that might contain output
                        if (message.metadata.output) {
                            console.log('CommandToolView: Found output in metadata:', message.metadata.output);
                            output = message.metadata.output;
                            completed = true;
                            break;
                        }
                    }
                } catch (e) {
                    // Continue searching
                }
            }
        }
    }

    // If we have a command but no output found and we're not streaming, assume completed
    // In mobile app, tool views are typically shown after execution
    if (command && !output && !isStreaming) {
        completed = true;
        console.log('CommandToolView: No output found but command exists and not streaming, assuming completed');
    }

    const actualIsSuccess = isSuccess !== undefined ? isSuccess : (exitCode === 0 || exitCode === null);

    const result = {
        command,
        output,
        exitCode,
        sessionName,
        cwd,
        completed,
        actualIsSuccess,
        actualToolTimestamp: toolTimestamp || null,
        actualAssistantTimestamp: assistantTimestamp || null
    };



    return result;
}

export function CommandToolView({
    name = 'execute-command',
    isStreaming = false,
    isSuccess = true,
    assistantContent,
    toolContent,
    assistantTimestamp,
    toolTimestamp,
    toolCall,
    messages,
    ...props
}: CommandToolViewProps) {
    const colorScheme = useColorScheme();
    const theme = Colors[colorScheme ?? 'light'];
    const [showFullOutput, setShowFullOutput] = useState(true);



    const {
        command,
        output,
        exitCode,
        sessionName,
        cwd,
        completed,
        actualIsSuccess,
        actualToolTimestamp,
        actualAssistantTimestamp
    } = extractCommandData(
        toolCall,
        assistantContent,
        toolContent,
        isSuccess,
        toolTimestamp,
        assistantTimestamp,
        messages,
        isStreaming
    );

    const displayText = name === 'check-command-output' ? sessionName : command;
    const displayLabel = name === 'check-command-output' ? 'Session' : 'Command';
    const displayPrefix = name === 'check-command-output' ? 'tmux:' : '$';
    const toolTitle = getToolTitle(name);

    const processedOutput = (() => {
        if (!output) return [];

        let processedOutput = output;

        // Try to parse JSON if it looks like JSON
        try {
            if (typeof output === 'string' && output.trim().startsWith('{')) {
                const parsed = JSON.parse(output);
                if (parsed && typeof parsed === 'object' && parsed.output) {
                    processedOutput = parsed.output;
                }
            }
        } catch (e) {
            // Use original output
        }

        processedOutput = String(processedOutput);

        // Process escape sequences
        processedOutput = processedOutput
            .replace(/\\n/g, '\n')
            .replace(/\\t/g, '\t')
            .replace(/\\"/g, '"')
            .replace(/\\'/g, "'")
            .replace(/\\\\/g, '\\');

        // Process unicode
        processedOutput = processedOutput.replace(/\\u([0-9a-fA-F]{4})/g, (match, group) => {
            return String.fromCharCode(parseInt(group, 16));
        });

        return processedOutput.split('\n');
    })();

    const hasMoreLines = processedOutput.length > 10;
    const previewLines = processedOutput.slice(0, 10);
    const linesToShow = showFullOutput ? processedOutput : previewLines;

    const styles = StyleSheet.create({
        container: {
            flex: 1,
            backgroundColor: theme.background,
        },
        content: {
            flex: 1,
        },
        loadingContainer: {
            flex: 1,
            justifyContent: 'center',
            alignItems: 'center',
            padding: 24,
        },
        loadingText: {
            marginTop: 12,
            color: theme.mutedForeground,
        },
        scrollContainer: {
            padding: 16,
        },

        outputContainer: {
            backgroundColor: theme.card,
            borderRadius: 8,
            borderWidth: 1,
            borderColor: theme.border,
            marginBottom: 16,
        },
        outputHeader: {
            backgroundColor: theme.muted,
            paddingHorizontal: 12,
            paddingVertical: 8,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
        },
        outputHeaderLeft: {
            flexDirection: 'row',
            alignItems: 'center',
        },
        outputText: {
            marginLeft: 8,
            fontWeight: '500',
            color: theme.foreground,
        },
        errorBadge: {
            backgroundColor: '#fef2f2',
            borderColor: '#fecaca',
            borderWidth: 1,
            paddingHorizontal: 6,
            paddingVertical: 2,
            borderRadius: 4,
            flexDirection: 'row',
            alignItems: 'center',
        },
        errorBadgeText: {
            color: '#dc2626',
            fontSize: 10,
            marginLeft: 4,
        },
        outputBody: {
            padding: 12,
            maxHeight: 300,
        },
        outputLine: {
            fontFamily: 'monospace',
            fontSize: 12,
            color: theme.foreground,
            paddingVertical: 1,
        },
        moreLines: {
            color: theme.mutedForeground,
            borderTopWidth: 1,
            borderTopColor: theme.border,
            paddingTop: 8,
            marginTop: 8,
        },
        emptyState: {
            flex: 1,
            justifyContent: 'center',
            alignItems: 'center',
            padding: 24,
        },
        emptyStateIcon: {
            width: 60,
            height: 60,
            borderRadius: 30,
            backgroundColor: theme.muted,
            justifyContent: 'center',
            alignItems: 'center',
            marginBottom: 16,
        },
        emptyStateText: {
            textAlign: 'center',
            color: theme.mutedForeground,
            marginTop: 8,
        },
        noOutputContainer: {
            backgroundColor: theme.card,
            borderRadius: 8,
            padding: 24,
            alignItems: 'center',
            justifyContent: 'center',
        },
        noOutputIcon: {
            marginBottom: 8,
        },
        noOutputText: {
            color: theme.mutedForeground,
            textAlign: 'center',
        },
        footer: {
            backgroundColor: theme.muted,
            borderTopWidth: 1,
            borderTopColor: theme.border,
            paddingHorizontal: 16,
            paddingVertical: 8,
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
        },
        footerLeft: {
            flexDirection: 'row',
            alignItems: 'center',
        },
        footerBadge: {
            backgroundColor: theme.card,
            borderWidth: 1,
            borderColor: theme.border,
            paddingHorizontal: 8,
            paddingVertical: 4,
            borderRadius: 4,
            flexDirection: 'row',
            alignItems: 'center',
        },
        footerBadgeText: {
            fontSize: 12,
            color: theme.foreground,
            marginLeft: 4,
        },
        footerRight: {
            flexDirection: 'row',
            alignItems: 'center',
        },
        timestampText: {
            fontSize: 12,
            color: theme.mutedForeground,
            marginLeft: 4,
        },
    });



    const renderLoadingState = () => (
        <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={theme.primary} />
            <Text style={styles.loadingText}>
                {name === 'check-command-output' ? 'Checking command output...' : 'Executing command...'}
            </Text>
        </View>
    );

    const renderContent = () => {
        if (isStreaming) {
            return renderLoadingState();
        }

        if (!displayText) {
            return (
                <View style={styles.emptyState}>
                    <View style={styles.emptyStateIcon}>
                        <Ionicons name="terminal" size={30} color={theme.mutedForeground} />
                    </View>
                    <H4 style={{ color: theme.foreground }}>
                        {name === 'check-command-output' ? 'No Session Found' : 'No Command Found'}
                    </H4>
                    <Text style={styles.emptyStateText}>
                        {name === 'check-command-output'
                            ? 'No session name was detected. Please provide a valid session name to check.'
                            : 'No command was detected. Please provide a valid command to execute.'
                        }
                    </Text>
                </View>
            );
        }

        return (
            <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
                <View style={styles.scrollContainer}>
                    {/* Terminal Output */}
                    {output ? (
                        <View style={styles.outputContainer}>
                            <View style={styles.outputHeader}>
                                <View style={styles.outputHeaderLeft}>
                                    <Ionicons name="terminal" size={16} color={theme.foreground} />
                                    <Text style={styles.outputText}>Terminal output</Text>
                                </View>
                                {exitCode !== null && exitCode !== 0 && (
                                    <View style={styles.errorBadge}>
                                        <Ionicons name="warning" size={12} color="#dc2626" />
                                        <Text style={styles.errorBadgeText}>Error</Text>
                                    </View>
                                )}
                            </View>
                            <ScrollView style={styles.outputBody} showsVerticalScrollIndicator={false}>
                                {linesToShow.map((line, index) => (
                                    <Text key={index} style={styles.outputLine}>
                                        {line || ' '}
                                    </Text>
                                ))}
                                {!showFullOutput && hasMoreLines && (
                                    <Text style={styles.moreLines}>
                                        + {processedOutput.length - 10} more lines
                                    </Text>
                                )}
                            </ScrollView>
                        </View>
                    ) : (
                        <View style={styles.noOutputContainer}>
                            <Ionicons
                                name={completed ? "alert-circle-outline" : "time-outline"}
                                size={32}
                                color={theme.mutedForeground}
                                style={styles.noOutputIcon}
                            />
                            <Text style={styles.noOutputText}>
                                {completed ? 'No output received' : 'Command is executing...'}
                            </Text>
                        </View>
                    )}
                </View>
            </ScrollView>
        );
    };


    return (
        <View style={styles.container}>
            {renderContent()}
        </View>
    );
} 