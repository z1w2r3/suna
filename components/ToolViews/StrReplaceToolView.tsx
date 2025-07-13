import { useTheme } from '@/hooks/useThemeColor';
import { AlertTriangle, Minus, Plus } from 'lucide-react-native';
import { ActivityIndicator, ScrollView, StyleSheet, View } from 'react-native';
import { Body, Caption, H4 } from '../Typography';
import { ToolViewProps } from './ToolViewRegistry';

interface StrReplaceToolViewProps extends ToolViewProps {
    assistantContent?: string;
    toolContent?: string;
    assistantTimestamp?: string;
    toolTimestamp?: string;
    toolCall?: any;
}

interface DiffLine {
    type: 'added' | 'removed' | 'unchanged';
    content: string;
    lineNumber: number;
}

// Enhanced utility functions for extracting content from multiple sources
const extractFilePath = (content: string, toolCall?: any): string | null => {
    // First try toolCall parameters if available
    if (toolCall?.parameters) {
        const filePath = toolCall.parameters.file_path ||
            toolCall.parameters.path ||
            toolCall.parameters.target_file ||
            toolCall.parameters.filename;
        if (filePath) return filePath;
    }

    // Try rawXml if available
    if (toolCall?.rawXml) {
        const xmlPatterns = [
            /<parameter name="file_path">([^<]+)<\/parameter>/i,
            /<parameter name="path">([^<]+)<\/parameter>/i,
            /<parameter name="target_file">([^<]+)<\/parameter>/i,
        ];

        for (const pattern of xmlPatterns) {
            const match = toolCall.rawXml.match(pattern);
            if (match) return match[1].trim();
        }
    }

    // Try various regex patterns for content extraction
    const patterns = [
        /file_path[:\s]*["']([^"']+)["']/i,
        /path[:\s]*["']([^"']+)["']/i,
        /target_file[:\s]*["']([^"']+)["']/i,
        /<parameter name="file_path">([^<]+)<\/parameter>/i,
        /<parameter name="path">([^<]+)<\/parameter>/i,
        /<parameter name="target_file">([^<]+)<\/parameter>/i,
        /File:\s*([^\n]+)/i,
        /File path:\s*([^\n]+)/i,
    ];

    for (const pattern of patterns) {
        const match = content.match(pattern);
        if (match) return match[1].trim();
    }

    return null;
};

const extractStrings = (content: string, toolCall?: any): { oldStr: string | null; newStr: string | null } => {
    // First try toolCall parameters if available
    if (toolCall?.parameters) {
        const oldStr = toolCall.parameters.old_string ||
            toolCall.parameters.old_str ||  // Added this line
            toolCall.parameters.old ||
            toolCall.parameters.search ||
            toolCall.parameters.find;
        const newStr = toolCall.parameters.new_string ||
            toolCall.parameters.new_str ||  // Added this line
            toolCall.parameters.new ||
            toolCall.parameters.replace ||
            toolCall.parameters.replacement;

        if (oldStr && newStr) {
            return { oldStr, newStr };
        }
    }

    // Try rawXml if available
    if (toolCall?.rawXml) {
        const xmlOldMatch = toolCall.rawXml.match(/<parameter name="old_string">([^<]+)<\/parameter>/i) ||
            toolCall.rawXml.match(/<parameter name="old_str">([^<]+)<\/parameter>/i);
        const xmlNewMatch = toolCall.rawXml.match(/<parameter name="new_string">([^<]+)<\/parameter>/i) ||
            toolCall.rawXml.match(/<parameter name="new_str">([^<]+)<\/parameter>/i);

        if (xmlOldMatch && xmlNewMatch) {
            return {
                oldStr: xmlOldMatch[1].trim(),
                newStr: xmlNewMatch[1].trim()
            };
        }
    }

    // Try XML parameter extraction from content
    const xmlOldMatch = content.match(/<parameter name="old_string">([^<]+)<\/parameter>/i) ||
        content.match(/<parameter name="old_str">([^<]+)<\/parameter>/i);
    const xmlNewMatch = content.match(/<parameter name="new_string">([^<]+)<\/parameter>/i) ||
        content.match(/<parameter name="new_str">([^<]+)<\/parameter>/i);

    if (xmlOldMatch && xmlNewMatch) {
        return {
            oldStr: xmlOldMatch[1].trim(),
            newStr: xmlNewMatch[1].trim()
        };
    }

    // Try multiline XML parameter extraction
    const xmlOldMultiMatch = content.match(/<parameter name="old_string">\s*```([^`]+)```\s*<\/parameter>/i) ||
        content.match(/<parameter name="old_str">\s*```([^`]+)```\s*<\/parameter>/i);
    const xmlNewMultiMatch = content.match(/<parameter name="new_string">\s*```([^`]+)```\s*<\/parameter>/i) ||
        content.match(/<parameter name="new_str">\s*```([^`]+)```\s*<\/parameter>/i);

    if (xmlOldMultiMatch && xmlNewMultiMatch) {
        return {
            oldStr: xmlOldMultiMatch[1].trim(),
            newStr: xmlNewMultiMatch[1].trim()
        };
    }

    // Try simple key-value patterns (including old_str/new_str)
    const patterns = [
        { old: /old_string[:\s]*["']([^"']+)["']/i, new: /new_string[:\s]*["']([^"']+)["']/i },
        { old: /old_str[:\s]*["']([^"']+)["']/i, new: /new_str[:\s]*["']([^"']+)["']/i },
        { old: /old[:\s]*["']([^"']+)["']/i, new: /new[:\s]*["']([^"']+)["']/i },
        { old: /search[:\s]*["']([^"']+)["']/i, new: /replace[:\s]*["']([^"']+)["']/i },
        { old: /find[:\s]*["']([^"']+)["']/i, new: /replacement[:\s]*["']([^"']+)["']/i },
    ];

    for (const pattern of patterns) {
        const oldMatch = content.match(pattern.old);
        const newMatch = content.match(pattern.new);
        if (oldMatch && newMatch) {
            return {
                oldStr: oldMatch[1].trim(),
                newStr: newMatch[1].trim()
            };
        }
    }

    // Try multiline code block patterns
    const multilinePatterns = [
        { old: /old_string[:\s]*```([^`]+)```/i, new: /new_string[:\s]*```([^`]+)```/i },
        { old: /old_str[:\s]*```([^`]+)```/i, new: /new_str[:\s]*```([^`]+)```/i },
        { old: /old[:\s]*```([^`]+)```/i, new: /new[:\s]*```([^`]+)```/i },
        { old: /search[:\s]*```([^`]+)```/i, new: /replace[:\s]*```([^`]+)```/i },
    ];

    for (const pattern of multilinePatterns) {
        const oldMatch = content.match(pattern.old);
        const newMatch = content.match(pattern.new);
        if (oldMatch && newMatch) {
            return {
                oldStr: oldMatch[1].trim(),
                newStr: newMatch[1].trim()
            };
        }
    }

    // Try to extract from different sections
    const sections = content.split(/\n\s*\n/);
    let oldStr = null;
    let newStr = null;

    for (const section of sections) {
        if (section.toLowerCase().includes('old') || section.toLowerCase().includes('search') || section.toLowerCase().includes('find')) {
            const lines = section.split('\n');
            for (const line of lines) {
                if (line.trim() && !line.toLowerCase().includes('old') && !line.toLowerCase().includes('search')) {
                    oldStr = line.trim();
                    break;
                }
            }
        }
        if (section.toLowerCase().includes('new') || section.toLowerCase().includes('replace') || section.toLowerCase().includes('replacement')) {
            const lines = section.split('\n');
            for (const line of lines) {
                if (line.trim() && !line.toLowerCase().includes('new') && !line.toLowerCase().includes('replace')) {
                    newStr = line.trim();
                    break;
                }
            }
        }
    }

    return { oldStr, newStr };
};

const generateDiff = (oldStr: string, newStr: string): DiffLine[] => {
    const oldLines = oldStr.split('\n');
    const newLines = newStr.split('\n');
    const diff: DiffLine[] = [];

    let lineNumber = 1;
    const maxLines = Math.max(oldLines.length, newLines.length);

    // Enhanced diff - show context and better line-by-line comparison
    for (let i = 0; i < maxLines; i++) {
        const oldLine = i < oldLines.length ? oldLines[i] : null;
        const newLine = i < newLines.length ? newLines[i] : null;

        if (oldLine !== null && newLine !== null) {
            if (oldLine === newLine) {
                // Lines are identical - show as unchanged
                diff.push({
                    type: 'unchanged',
                    content: oldLine,
                    lineNumber: lineNumber++
                });
            } else {
                // Lines are different - show removed then added
                diff.push({
                    type: 'removed',
                    content: oldLine,
                    lineNumber: lineNumber
                });
                diff.push({
                    type: 'added',
                    content: newLine,
                    lineNumber: lineNumber++
                });
            }
        } else if (oldLine !== null) {
            // Only old line exists - show as removed
            diff.push({
                type: 'removed',
                content: oldLine,
                lineNumber: lineNumber++
            });
        } else if (newLine !== null) {
            // Only new line exists - show as added
            diff.push({
                type: 'added',
                content: newLine,
                lineNumber: lineNumber++
            });
        }
    }

    return diff;
};

export function StrReplaceToolView({
    name = 'str-replace',
    isStreaming = false,
    isSuccess = true,
    assistantContent = '',
    toolContent = '',
    toolCall,
    ...props
}: StrReplaceToolViewProps) {
    const theme = useTheme();
    // const [expanded, setExpanded] = useState(true);


    // Extract data from content using enhanced functions
    const filePath = extractFilePath(assistantContent, toolCall) ||
        extractFilePath(toolContent, toolCall);

    const assistantStrings = extractStrings(assistantContent, toolCall);
    const toolStrings = extractStrings(toolContent, toolCall);

    const oldStr = assistantStrings.oldStr || toolStrings.oldStr;
    const newStr = assistantStrings.newStr || toolStrings.newStr;


    const diff = oldStr && newStr ? generateDiff(oldStr, newStr) : [];
    const stats = {
        additions: diff.filter(d => d.type === 'added').length,
        deletions: diff.filter(d => d.type === 'removed').length
    };

    const styles = StyleSheet.create({
        container: {
            flex: 1,
            backgroundColor: theme.background,
        },
        fileHeader: {
            backgroundColor: theme.mutedWithOpacity(0.05),
            paddingHorizontal: 16,
            paddingVertical: 12,
            borderBottomWidth: 1,
            borderBottomColor: theme.border,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
        },
        filePath: {
            fontSize: 13,
            fontFamily: 'monospace',
            color: theme.foreground,
        },
        stats: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 16,
        },
        stat: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 4,
        },
        statText: {
            fontSize: 12,
            color: theme.mutedForeground,
        },
        diffContainer: {
            flex: 1,
        },
        diffLine: {
            flexDirection: 'row',
            alignItems: 'flex-start',
            paddingHorizontal: 12,
            paddingVertical: 2,
            minHeight: 24,
        },
        lineNumber: {
            width: 40,
            fontSize: 11,
            fontFamily: 'monospace',
            color: theme.mutedForeground,
            textAlign: 'right',
            marginRight: 8,
        },
        diffIcon: {
            width: 16,
            marginRight: 8,
            alignItems: 'center',
            justifyContent: 'center',
        },
        diffContent: {
            flex: 1,
            fontSize: 12,
            fontFamily: 'monospace',
            lineHeight: 16,
        },
        loadingContainer: {
            flex: 1,
            justifyContent: 'center',
            alignItems: 'center',
            gap: 16,
        },
        errorContainer: {
            flex: 1,
            justifyContent: 'center',
            alignItems: 'center',
            gap: 16,
            paddingHorizontal: 32,
        },
        errorText: {
            textAlign: 'center',
            color: theme.mutedForeground,
        },
    });

    const renderFileHeader = () => (
        <View style={styles.fileHeader}>
            <Body style={styles.filePath}>
                {filePath || 'Unknown file'}
            </Body>
            <View style={styles.stats}>
                <View style={styles.stat}>
                    <Plus size={12} color={theme.primary} />
                    <Caption style={styles.statText}>{stats.additions}</Caption>
                </View>
                <View style={styles.stat}>
                    <Minus size={12} color={theme.destructive} />
                    <Caption style={styles.statText}>{stats.deletions}</Caption>
                </View>
            </View>
        </View>
    );

    const renderDiffLine = (line: DiffLine, index: number) => {
        const lineStyle = [
            styles.diffLine,
            line.type === 'added' && { backgroundColor: theme.primaryWithOpacity(0.1) },
            line.type === 'removed' && { backgroundColor: theme.destructive + '20' },
        ];

        const contentColor = line.type === 'added'
            ? theme.primary
            : line.type === 'removed'
                ? theme.destructive
                : theme.foreground;

        return (
            <View key={index} style={lineStyle}>
                <Caption style={styles.lineNumber}>{line.lineNumber}</Caption>
                <View style={styles.diffIcon}>
                    {line.type === 'added' && <Plus size={12} color={theme.primary} />}
                    {line.type === 'removed' && <Minus size={12} color={theme.destructive} />}
                </View>
                <Body style={[styles.diffContent, { color: contentColor }]}>
                    {line.content || ' '}
                </Body>
            </View>
        );
    };

    const renderLoading = () => (
        <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={theme.primary} />
            <Body style={{ color: theme.mutedForeground }}>
                Processing string replacement...
            </Body>
        </View>
    );

    const renderError = () => (
        <View style={styles.errorContainer}>
            <AlertTriangle size={48} color={theme.destructive} />
            <H4 style={{ color: theme.destructive }}>Cannot Extract Replacement Data</H4>
            <Body style={styles.errorText}>
                Could not extract the old string and new string from the content.
            </Body>

            {/* Debug info for development */}
            {__DEV__ && (
                <View style={{ marginTop: 16, padding: 12, backgroundColor: theme.mutedWithOpacity(0.1), borderRadius: 8 }}>
                    <Caption style={{ color: theme.mutedForeground, marginBottom: 8 }}>
                        Debug Info:
                    </Caption>
                    <Caption style={{ color: theme.mutedForeground, fontFamily: 'monospace', fontSize: 10 }}>
                        ToolCall: {toolCall ? JSON.stringify(toolCall, null, 2).substring(0, 200) + '...' : 'null'}
                    </Caption>
                    <Caption style={{ color: theme.mutedForeground, fontFamily: 'monospace', fontSize: 10 }}>
                        Assistant Content: {assistantContent?.substring(0, 100) + '...' || 'null'}
                    </Caption>
                    <Caption style={{ color: theme.mutedForeground, fontFamily: 'monospace', fontSize: 10 }}>
                        Tool Content: {toolContent?.substring(0, 100) + '...' || 'null'}
                    </Caption>
                </View>
            )}
        </View>
    );

    const renderContent = () => {
        if (isStreaming) {
            return renderLoading();
        }

        if (!oldStr || !newStr) {
            return renderError();
        }

        return (
            <ScrollView style={styles.diffContainer}>
                {diff.map((line, index) => renderDiffLine(line, index))}
            </ScrollView>
        );
    };

    return (
        <View style={styles.container}>
            {(filePath || diff.length > 0) && renderFileHeader()}
            {renderContent()}
        </View>
    );
} 