import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { ActivityIndicator, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { Colors } from '../../constants/Colors';
import { useColorScheme } from '../../hooks/useColorScheme';
import { CodeRenderer, CsvRenderer, HtmlRenderer, MarkdownRenderer } from '../renderers';
import {
    extractFileContent,
    extractFilePath,
    extractStreamingFileContent,
    extractToolData,
    formatTimestamp,
    getFileExtension,
    getFileIcon,
    getFileName,
    getLanguageFromFileName,
    getOperationConfigs,
    getOperationType,
    getToolTitle,
    hasLanguageHighlighting,
    isFileType,
    processFilePath,
    processUnicodeContent,
    splitContentIntoLines
} from '../renderers/file-operation-utils';
import { ToolViewProps } from './ToolViewRegistry';

interface FileOperationToolViewProps extends ToolViewProps {
    assistantContent?: string;
    toolContent?: string;
    assistantTimestamp?: string;
    toolTimestamp?: string;
    project?: any;
}

export function FileOperationToolView({
    name,
    toolCall,
    isStreaming = false,
    isSuccess = true,
    assistantContent,
    toolContent,
    assistantTimestamp,
    toolTimestamp,
    project,
    ...props
}: FileOperationToolViewProps) {
    const colorScheme = useColorScheme();
    const isDark = colorScheme === 'dark';
    const theme = Colors[colorScheme ?? 'light'];


    const [currentView, setCurrentView] = useState<'preview' | 'source'>('preview');

    const operation = getOperationType(name, assistantContent);
    const configs = getOperationConfigs();
    const config = configs[operation];
    const IconComponent = config.icon;

    let filePath: string | null = null;
    let fileContent: string | null = null;

    // Extract data from both assistant and tool content
    const assistantToolData = extractToolData(assistantContent || '');
    const toolToolData = extractToolData(toolContent || '');

    if (assistantToolData.toolResult) {
        filePath = assistantToolData.filePath;
        fileContent = assistantToolData.fileContent;
    } else if (toolToolData.toolResult) {
        filePath = toolToolData.filePath;
        fileContent = toolToolData.fileContent;
    }

    // Fallback: try to extract from toolCall if available
    if (!filePath && !fileContent && toolCall) {

        // Try different possible property names for file path
        filePath = toolCall.file_path ||
            toolCall.path ||
            toolCall.target_file ||
            toolCall.filename ||
            toolCall.parameters?.file_path ||
            toolCall.parameters?.path ||
            toolCall.parameters?.target_file ||
            toolCall.parameters?.filename;

        // Try different possible property names for file content
        fileContent = toolCall.content ||
            toolCall.file_content ||
            toolCall.file_contents ||
            toolCall.code_edit ||
            toolCall.parameters?.content ||
            toolCall.parameters?.file_content ||
            toolCall.parameters?.file_contents ||
            toolCall.parameters?.code_edit;
    }

    if (!filePath) {
        filePath = extractFilePath(assistantContent || '');
    }

    if (!fileContent && operation !== 'delete') {
        fileContent = isStreaming
            ? extractStreamingFileContent(
                assistantContent || '',
                operation === 'create' ? 'create-file' : 'full-file-rewrite',
            ) || ''
            : extractFileContent(
                assistantContent || '',
                operation === 'create' ? 'create-file' : 'full-file-rewrite',
            );
    }

    const toolTitle = getToolTitle(name || `file-${operation}`);
    const processedFilePath = processFilePath(filePath);
    const fileName = getFileName(processedFilePath);
    const fileExtension = getFileExtension(fileName);

    const isMarkdown = isFileType.markdown(fileExtension);
    const isHtml = isFileType.html(fileExtension);
    const isCsv = isFileType.csv(fileExtension);
    const isCode = isFileType.code(fileExtension) || isFileType.data(fileExtension);

    const language = getLanguageFromFileName(fileName);
    const hasHighlighting = hasLanguageHighlighting(language);
    const contentLines = splitContentIntoLines(fileContent);

    const FileIcon = getFileIcon(fileName);



    const renderHeader = () => (
        <View style={{
            backgroundColor: isDark ? '#2a2a2a' : '#f8f9fa',
            borderBottomWidth: 1,
            borderBottomColor: isDark ? '#404040' : '#e9ecef',
            paddingHorizontal: 16,
            paddingVertical: 12
        }}>
            <View style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between'
            }}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <View style={{
                        width: 40,
                        height: 40,
                        borderRadius: 8,
                        backgroundColor: config.bgColor,
                        alignItems: 'center',
                        justifyContent: 'center',
                        marginRight: 12
                    }}>
                        <Ionicons
                            name={IconComponent}
                            size={20}
                            color={config.color}
                        />
                    </View>
                    <View>
                        <Text style={{
                            fontSize: 16,
                            fontWeight: '600',
                            color: theme.foreground
                        }}>
                            {toolTitle}
                        </Text>
                        {processedFilePath && (
                            <Text style={{
                                fontSize: 12,
                                color: theme.foreground,
                                opacity: 0.7,
                                fontFamily: 'monospace'
                            }}>
                                {processedFilePath}
                            </Text>
                        )}
                    </View>
                </View>

                {operation !== 'delete' && fileContent && (
                    <View style={{
                        flexDirection: 'row',
                        backgroundColor: isDark ? '#404040' : '#e9ecef',
                        borderRadius: 8,
                        padding: 2
                    }}>
                        <TouchableOpacity
                            onPress={() => setCurrentView('preview')}
                            style={{
                                flexDirection: 'row',
                                alignItems: 'center',
                                paddingHorizontal: 12,
                                paddingVertical: 6,
                                borderRadius: 6,
                                backgroundColor: currentView === 'preview' ? (isDark ? '#555' : '#fff') : 'transparent'
                            }}
                        >
                            <Ionicons
                                name="eye"
                                size={16}
                                color={currentView === 'preview' ? config.color : theme.foreground}
                            />
                            <Text style={{
                                fontSize: 12,
                                color: currentView === 'preview' ? config.color : theme.foreground,
                                marginLeft: 4
                            }}>
                                Preview
                            </Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            onPress={() => setCurrentView('source')}
                            style={{
                                flexDirection: 'row',
                                alignItems: 'center',
                                paddingHorizontal: 12,
                                paddingVertical: 6,
                                borderRadius: 6,
                                backgroundColor: currentView === 'source' ? (isDark ? '#555' : '#fff') : 'transparent'
                            }}
                        >
                            <Ionicons
                                name="code"
                                size={16}
                                color={currentView === 'source' ? config.color : theme.foreground}
                            />
                            <Text style={{
                                fontSize: 12,
                                color: currentView === 'source' ? config.color : theme.foreground,
                                marginLeft: 4
                            }}>
                                Source
                            </Text>
                        </TouchableOpacity>
                    </View>
                )}
            </View>
        </View>
    );

    const renderDeleteOperation = () => (
        <View style={{
            flex: 1,
            justifyContent: 'center',
            alignItems: 'center',
            backgroundColor: theme.background,
            paddingHorizontal: 32,
            paddingVertical: 48
        }}>
            <View style={{
                width: 80,
                height: 80,
                borderRadius: 40,
                backgroundColor: config.bgColor,
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: 24
            }}>
                <Ionicons
                    name={IconComponent}
                    size={40}
                    color={config.color}
                />
            </View>
            <Text style={{
                fontSize: 20,
                fontWeight: '600',
                color: theme.foreground,
                textAlign: 'center',
                marginBottom: 16
            }}>
                File Deleted
            </Text>
            <View style={{
                backgroundColor: isDark ? '#2a2a2a' : '#f8f9fa',
                borderWidth: 1,
                borderColor: isDark ? '#404040' : '#e9ecef',
                borderRadius: 8,
                padding: 16,
                width: '100%',
                maxWidth: 300
            }}>
                <Text style={{
                    fontSize: 14,
                    color: theme.foreground,
                    fontFamily: 'monospace',
                    textAlign: 'center'
                }}>
                    {processedFilePath || 'Unknown file path'}
                </Text>
            </View>
            <Text style={{
                fontSize: 14,
                color: theme.foreground,
                opacity: 0.7,
                textAlign: 'center',
                marginTop: 16
            }}>
                This file has been permanently removed
            </Text>
        </View>
    );

    const renderLoadingState = () => (
        <View style={{
            flex: 1,
            justifyContent: 'center',
            alignItems: 'center',
            backgroundColor: theme.background,
            paddingHorizontal: 32,
            paddingVertical: 48
        }}>
            <View style={{
                width: 80,
                height: 80,
                borderRadius: 40,
                backgroundColor: config.bgColor,
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: 24
            }}>
                <ActivityIndicator
                    size="large"
                    color={config.color}
                />
            </View>
            <Text style={{
                fontSize: 18,
                fontWeight: '600',
                color: theme.foreground,
                textAlign: 'center',
                marginBottom: 8
            }}>
                {config.progressMessage}
            </Text>
            <Text style={{
                fontSize: 14,
                color: theme.foreground,
                opacity: 0.7,
                textAlign: 'center',
                fontFamily: 'monospace'
            }}>
                {processedFilePath || 'Processing file...'}
            </Text>
        </View>
    );

    const renderPreview = () => {
        if (!fileContent) {
            return (
                <View style={{
                    flex: 1,
                    justifyContent: 'center',
                    alignItems: 'center',
                    backgroundColor: theme.background,
                    padding: 32
                }}>
                    <Ionicons
                        name={FileIcon}
                        size={48}
                        color={theme.foreground}
                        style={{ marginBottom: 16, opacity: 0.5 }}
                    />
                    <Text style={{
                        fontSize: 16,
                        color: theme.foreground,
                        opacity: 0.7,
                        textAlign: 'center'
                    }}>
                        No content to preview
                    </Text>
                </View>
            );
        }

        const processedContent = processUnicodeContent(fileContent);

        if (isMarkdown) {
            return (
                <MarkdownRenderer
                    content={processedContent}
                    style={{ flex: 1 }}
                />
            );
        }

        if (isHtml) {
            return (
                <HtmlRenderer
                    content={processedContent}
                    style={{ flex: 1 }}
                />
            );
        }

        if (isCsv) {
            return (
                <CsvRenderer
                    content={processedContent}
                    style={{ flex: 1 }}
                />
            );
        }

        // Default text preview
        return (
            <ScrollView style={{ flex: 1 }}>
                <View style={{
                    backgroundColor: isDark ? '#2a2a2a' : '#f8f9fa',
                    borderWidth: 1,
                    borderColor: isDark ? '#404040' : '#e9ecef',
                    borderRadius: 8,
                    margin: 16,
                    padding: 16
                }}>
                    <Text style={{
                        fontSize: 14,
                        color: theme.foreground,
                        fontFamily: 'monospace',
                        lineHeight: 20
                    }}>
                        {processedContent}
                    </Text>
                </View>
            </ScrollView>
        );
    };

    const renderSource = () => {
        if (!fileContent) {
            return (
                <View style={{
                    flex: 1,
                    justifyContent: 'center',
                    alignItems: 'center',
                    backgroundColor: theme.background,
                    padding: 32
                }}>
                    <Ionicons
                        name={FileIcon}
                        size={48}
                        color={theme.foreground}
                        style={{ marginBottom: 16, opacity: 0.5 }}
                    />
                    <Text style={{
                        fontSize: 16,
                        color: theme.foreground,
                        opacity: 0.7,
                        textAlign: 'center'
                    }}>
                        No source code to display
                    </Text>
                </View>
            );
        }

        const processedContent = processUnicodeContent(fileContent);

        return (
            <CodeRenderer
                content={processedContent}
                language={language}
                showLineNumbers={true}
                style={{ flex: 1, margin: 16 }}
            />
        );
    };

    const renderFooter = () => {
        const timestamp = toolTimestamp || assistantTimestamp;
        if (!timestamp) return null;

        return (
            <View style={{
                backgroundColor: isDark ? '#2a2a2a' : '#f8f9fa',
                borderTopWidth: 1,
                borderTopColor: isDark ? '#404040' : '#e9ecef',
                paddingHorizontal: 16,
                paddingVertical: 8,
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'center'
            }}>
                <View style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    backgroundColor: isDark ? '#404040' : '#e9ecef',
                    paddingHorizontal: 8,
                    paddingVertical: 4,
                    borderRadius: 4
                }}>
                    <Ionicons
                        name={FileIcon}
                        size={12}
                        color={theme.foreground}
                        style={{ marginRight: 4 }}
                    />
                    <Text style={{
                        fontSize: 10,
                        color: theme.foreground,
                        textTransform: 'uppercase',
                        fontWeight: '600'
                    }}>
                        {hasHighlighting ? language : fileExtension || 'text'}
                    </Text>
                </View>
                <Text style={{
                    fontSize: 10,
                    color: theme.foreground,
                    opacity: 0.7
                }}>
                    {formatTimestamp(timestamp)}
                </Text>
            </View>
        );
    };

    // Handle cases where there's no content
    if (!isStreaming && !processedFilePath && !fileContent) {
        return (
            <View style={{
                flex: 1,
                justifyContent: 'center',
                alignItems: 'center',
                backgroundColor: theme.background,
                padding: 32
            }}>
                <Ionicons
                    name="document-text"
                    size={48}
                    color={theme.foreground}
                    style={{ marginBottom: 16, opacity: 0.5 }}
                />
                <Text style={{
                    fontSize: 16,
                    color: theme.foreground,
                    opacity: 0.7,
                    textAlign: 'center'
                }}>
                    No file operation data available
                </Text>
            </View>
        );
    }

    return (
        <View style={{
            flex: 1,
            backgroundColor: theme.background,
            borderWidth: 1,
            borderColor: isDark ? '#404040' : '#e9ecef',
            borderRadius: 8,
            overflow: 'hidden'
        }}>
            {renderHeader()}

            <View style={{ flex: 1 }}>
                {isStreaming && !fileContent ? (
                    renderLoadingState()
                ) : operation === 'delete' ? (
                    renderDeleteOperation()
                ) : currentView === 'preview' ? (
                    renderPreview()
                ) : (
                    renderSource()
                )}
            </View>

            {renderFooter()}

            {isStreaming && fileContent && (
                <View style={{
                    position: 'absolute',
                    bottom: 16,
                    right: 16,
                    backgroundColor: config.color,
                    paddingHorizontal: 12,
                    paddingVertical: 6,
                    borderRadius: 16,
                    flexDirection: 'row',
                    alignItems: 'center'
                }}>
                    <ActivityIndicator
                        size="small"
                        color="white"
                        style={{ marginRight: 6 }}
                    />
                    <Text style={{
                        fontSize: 12,
                        color: 'white',
                        fontWeight: '600'
                    }}>
                        Streaming...
                    </Text>
                </View>
            )}
        </View>
    );
} 