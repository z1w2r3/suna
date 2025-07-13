import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { ActivityIndicator, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { Colors } from '../../constants/Colors';
import { useColorScheme } from '../../hooks/useColorScheme';
import { CodeRenderer, CsvRenderer, HtmlRenderer, MarkdownRenderer } from '../renderers';
import { ToolViewProps } from './ToolViewRegistry';

interface FileOperationToolViewProps extends ToolViewProps {
    assistantContent?: string;
    toolContent?: string;
    assistantTimestamp?: string;
    toolTimestamp?: string;
    project?: any;
}

const getOperationConfigs = () => ({
    create: {
        icon: 'add-circle' as const,
        color: '#22c55e',
        bgColor: '#dcfce7',
        progressMessage: 'Creating file...'
    },
    edit: {
        icon: 'create' as const,
        color: '#3b82f6',
        bgColor: '#dbeafe',
        progressMessage: 'Editing file...'
    },
    delete: {
        icon: 'trash' as const,
        color: '#ef4444',
        bgColor: '#fee2e2',
        progressMessage: 'Deleting file...'
    },
    read: {
        icon: 'document-text' as const,
        color: '#8b5cf6',
        bgColor: '#f3e8ff',
        progressMessage: 'Reading file...'
    }
});

const getFileExtension = (filename: string) => {
    const lastDot = filename.lastIndexOf('.');
    return lastDot > 0 ? filename.substring(lastDot + 1).toLowerCase() : '';
};

const getLanguageFromFileName = (filename: string) => {
    const ext = getFileExtension(filename);
    const langMap: { [key: string]: string } = {
        'js': 'javascript',
        'jsx': 'javascript',
        'ts': 'typescript',
        'tsx': 'typescript',
        'py': 'python',
        'java': 'java',
        'cpp': 'cpp',
        'c': 'c',
        'cs': 'csharp',
        'php': 'php',
        'rb': 'ruby',
        'go': 'go',
        'rs': 'rust',
        'swift': 'swift',
        'kt': 'kotlin',
        'dart': 'dart',
        'html': 'html',
        'css': 'css',
        'scss': 'scss',
        'sass': 'sass',
        'less': 'less',
        'json': 'json',
        'xml': 'xml',
        'yaml': 'yaml',
        'yml': 'yaml',
        'toml': 'toml',
        'md': 'markdown',
        'sql': 'sql',
        'sh': 'bash',
        'bash': 'bash',
        'zsh': 'zsh',
        'fish': 'fish'
    };
    return langMap[ext] || 'text';
};

const isFileType = {
    markdown: (ext: string) => ['md', 'markdown'].includes(ext),
    html: (ext: string) => ['html', 'htm'].includes(ext),
    csv: (ext: string) => ['csv'].includes(ext),
    code: (ext: string) => ['js', 'jsx', 'ts', 'tsx', 'py', 'java', 'cpp', 'c', 'cs', 'php', 'rb', 'go', 'rs', 'swift', 'kt', 'dart'].includes(ext),
    data: (ext: string) => ['json', 'xml', 'yaml', 'yml', 'toml'].includes(ext)
};

const getFileIcon = (filename: string) => {
    const ext = getFileExtension(filename);

    if (isFileType.markdown(ext)) return 'reader';
    if (isFileType.html(ext)) return 'globe';
    if (isFileType.csv(ext)) return 'grid';
    if (isFileType.code(ext)) return 'code-slash';
    if (isFileType.data(ext)) return 'document-text';

    return 'document-text';
};

const extractFileOperationData = (toolCall?: any, toolContent?: string) => {
    let filePath = '';
    let fileContent = '';
    let operation = 'edit';
    let isSuccess = true;
    let errorMessage = '';

    // Extract from tool call parameters
    if (toolCall?.parameters) {
        filePath = toolCall.parameters.target_file ||
            toolCall.parameters.file_path ||
            toolCall.parameters.path ||
            toolCall.parameters.filename || '';

        fileContent = toolCall.parameters.code_edit ||
            toolCall.parameters.content ||
            toolCall.parameters.file_content ||
            toolCall.parameters.file_contents || '';

        // Determine operation from tool name
        const toolName = toolCall.name || '';
        if (toolName.includes('create') || toolName.includes('new')) {
            operation = 'create';
        } else if (toolName.includes('delete') || toolName.includes('remove')) {
            operation = 'delete';
        } else if (toolName.includes('read') || toolName.includes('view')) {
            operation = 'read';
        }
    }

    // Parse tool content if available
    if (toolContent) {
        try {
            const parsed = JSON.parse(toolContent);

            if (parsed.tool_execution) {
                const toolExecution = parsed.tool_execution;

                // Determine operation from XML tag name
                const xmlTagName = toolExecution.xml_tag_name || '';
                if (xmlTagName.includes('create')) {
                    operation = 'create';
                } else if (xmlTagName.includes('delete')) {
                    operation = 'delete';
                } else if (xmlTagName.includes('read')) {
                    operation = 'read';
                } else if (xmlTagName.includes('replace') || xmlTagName.includes('rewrite')) {
                    operation = 'edit';
                }

                // Extract arguments
                if (toolExecution.arguments) {
                    filePath = toolExecution.arguments.target_file ||
                        toolExecution.arguments.file_path ||
                        toolExecution.arguments.path ||
                        toolExecution.arguments.filename || filePath;

                    fileContent = toolExecution.arguments.code_edit ||
                        toolExecution.arguments.content ||
                        toolExecution.arguments.file_content ||
                        toolExecution.arguments.file_contents || fileContent;
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

                    // For read operations, content might be in result
                    if (operation === 'read' && result.content) {
                        fileContent = result.content;
                    }
                }
            }
        } catch (e) {
            // If parsing fails, treat as raw content
            if (operation === 'read') {
                fileContent = toolContent;
            }
        }
    }

    return {
        filePath,
        fileContent,
        operation,
        isSuccess,
        errorMessage
    };
};

export function FileOperationToolView({
    name,
    toolCall,
    toolContent,
    isStreaming = false,
    isSuccess = true,
    ...props
}: FileOperationToolViewProps) {
    const colorScheme = useColorScheme();
    const isDark = colorScheme === 'dark';
    const theme = Colors[colorScheme ?? 'light'];
    const [currentView, setCurrentView] = useState<'preview' | 'source'>('preview');

    console.log('📁 FILE OPERATION TOOL RECEIVED:', !!toolContent, toolContent?.length || 0);

    if (!toolContent && !isStreaming) {
        console.log('❌ FILE OPERATION TOOL: NO CONTENT');
        return (
            <View style={{
                flex: 1,
                justifyContent: 'center',
                alignItems: 'center',
                padding: 20,
                backgroundColor: theme.background,
            }}>
                <Text style={{
                    color: theme.foreground,
                    fontSize: 16,
                    textAlign: 'center',
                    opacity: 0.7
                }}>
                    No file operation data available
                </Text>
            </View>
        );
    }

    const {
        filePath,
        fileContent,
        operation,
        isSuccess: actualIsSuccess,
        errorMessage
    } = extractFileOperationData(toolCall, toolContent);

    const configs = getOperationConfigs();
    const config = configs[operation as keyof typeof configs] || configs.edit;
    const IconComponent = config.icon;

    const fileName = filePath.split('/').pop() || '';
    const fileExtension = getFileExtension(fileName);
    const language = getLanguageFromFileName(fileName);
    const FileIcon = getFileIcon(fileName);

    const isMarkdown = isFileType.markdown(fileExtension);
    const isHtml = isFileType.html(fileExtension);
    const isCsv = isFileType.csv(fileExtension);

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
                            {operation.charAt(0).toUpperCase() + operation.slice(1)} File
                        </Text>
                        {filePath && (
                            <Text style={{
                                fontSize: 12,
                                color: theme.foreground,
                                opacity: 0.7,
                                fontFamily: 'monospace'
                            }}>
                                {filePath}
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
                {filePath || 'Processing file...'}
            </Text>
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
                    {filePath || 'Unknown file path'}
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

        if (isMarkdown) {
            return (
                <MarkdownRenderer
                    content={fileContent}
                    style={{ flex: 1 }}
                />
            );
        }

        if (isHtml) {
            return (
                <HtmlRenderer
                    content={fileContent}
                    style={{ flex: 1 }}
                />
            );
        }

        if (isCsv) {
            return (
                <CsvRenderer
                    content={fileContent}
                    style={{ flex: 1 }}
                />
            );
        }

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
                        {fileContent}
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

        return (
            <CodeRenderer
                content={fileContent}
                language={language}
                showLineNumbers={true}
                style={{ flex: 1, margin: 16 }}
            />
        );
    };

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