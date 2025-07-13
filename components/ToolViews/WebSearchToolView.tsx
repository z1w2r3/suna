import { useTheme } from '@/hooks/useThemeColor';
import { Globe, Image as ImageIcon, Search } from 'lucide-react-native';
import React from 'react';
import { ActivityIndicator, Image, Linking, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { ToolViewProps } from './ToolViewRegistry';

export interface WebSearchToolViewProps extends ToolViewProps {
    assistantContent?: string;
    toolContent?: string;
    assistantTimestamp?: string;
    toolTimestamp?: string;
    messages?: any[];
}

interface SearchResult {
    title: string;
    url: string;
    snippet?: string;
}

const extractWebSearchData = (toolCall?: any, toolContent?: string) => {
    let query = '';
    let searchResults: SearchResult[] = [];
    let images: string[] = [];
    let answer = '';
    let isSuccess = true;
    let errorMessage = '';

    // Extract from tool call parameters
    if (toolCall?.parameters) {
        query = toolCall.parameters.query ||
            toolCall.parameters.search_term || '';
    }

    // Parse tool content if available
    if (toolContent) {
        try {
            const parsed = JSON.parse(toolContent);

            if (parsed.tool_execution) {
                const toolExecution = parsed.tool_execution;

                // Extract arguments
                if (toolExecution.arguments) {
                    query = toolExecution.arguments.query ||
                        toolExecution.arguments.search_term || query;
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

                        // Query from output
                        if (output.query) {
                            query = output.query;
                        }

                        // Search results
                        if (output.results && Array.isArray(output.results)) {
                            searchResults = output.results.map((result: any) => ({
                                title: result.title || '',
                                url: result.url || result.link || '',
                                snippet: result.snippet || result.description || result.content || ''
                            }));
                        }

                        // Images
                        if (output.images && Array.isArray(output.images)) {
                            images = output.images;
                        }

                        // Answer
                        if (output.answer) {
                            answer = output.answer;
                        }
                    }
                }
            }
        } catch (e) {
            // If parsing fails, mark as error
            isSuccess = false;
            errorMessage = 'Failed to parse search results';
        }
    }

    return {
        query,
        searchResults,
        images,
        answer,
        isSuccess,
        errorMessage
    };
};

export const WebSearchToolView: React.FC<WebSearchToolViewProps> = ({
    toolCall,
    toolContent,
    isStreaming = false,
    isSuccess = true,
    ...props
}) => {
    const theme = useTheme();

    console.log('🔍 WEB SEARCH TOOL RECEIVED:', !!toolContent, toolContent?.length || 0);

    if (!toolContent && !isStreaming) {
        console.log('❌ WEB SEARCH TOOL: NO CONTENT');
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
                    No search data available
                </Text>
            </View>
        );
    }

    const {
        query,
        searchResults,
        images,
        answer,
        isSuccess: actualIsSuccess,
        errorMessage
    } = extractWebSearchData(toolCall, toolContent);

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
        resultsHeader: {
            fontSize: 14,
            fontWeight: '600',
            color: theme.foreground,
            marginBottom: 12,
        },
        resultItem: {
            backgroundColor: theme.card,
            borderRadius: 8,
            padding: 16,
            marginBottom: 12,
            borderWidth: 1,
            borderColor: theme.border,
        },
        resultTitle: {
            fontSize: 16,
            fontWeight: '600',
            color: theme.secondary,
            marginBottom: 8,
        },
        resultUrl: {
            fontSize: 12,
            color: theme.mutedForeground,
            marginBottom: 8,
        },
        resultSnippet: {
            fontSize: 14,
            color: theme.foreground,
            lineHeight: 20,
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
        imagesContainer: {
            marginBottom: 16,
        },
        imagesTitle: {
            fontSize: 14,
            fontWeight: '600',
            color: theme.foreground,
            marginBottom: 8,
        },
        imagesGrid: {
            flexDirection: 'row',
            flexWrap: 'wrap',
            gap: 8,
        },
        imageItem: {
            width: 100,
            height: 100,
            borderRadius: 8,
            overflow: 'hidden',
            borderWidth: 1,
            borderColor: theme.border,
        },
        imageStyle: {
            width: '100%',
            height: '100%',
        },
        sectionTitle: {
            fontSize: 14,
            fontWeight: '600',
            color: theme.foreground,
            marginBottom: 8,
            marginTop: 16,
        },
    });

    const handleLinkPress = (url: string) => {
        Linking.openURL(url).catch(console.error);
    };

    const renderLoading = () => (
        <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={theme.secondary} />
            <Text style={styles.loadingText}>Searching the web...</Text>
        </View>
    );

    const renderResults = () => (
        <ScrollView style={styles.content}>
            {images.length > 0 && (
                <View style={styles.imagesContainer}>
                    <Text style={styles.imagesTitle}>
                        <ImageIcon size={16} color={theme.foreground} /> Images ({images.length})
                    </Text>
                    <View style={styles.imagesGrid}>
                        {images.slice(0, 6).map((imageUrl, index) => (
                            <TouchableOpacity
                                key={index}
                                style={styles.imageItem}
                                onPress={() => handleLinkPress(imageUrl)}
                                activeOpacity={0.7}
                            >
                                <Image
                                    source={{ uri: imageUrl }}
                                    style={styles.imageStyle}
                                    resizeMode="cover"
                                />
                            </TouchableOpacity>
                        ))}
                    </View>
                </View>
            )}

            {searchResults.length > 0 && (
                <Text style={styles.sectionTitle}>
                    <Globe size={16} color={theme.foreground} /> Search Results ({searchResults.length})
                </Text>
            )}

            {searchResults.map((result, index) => (
                <TouchableOpacity
                    key={index}
                    style={styles.resultItem}
                    onPress={() => handleLinkPress(result.url)}
                    activeOpacity={0.7}
                >
                    <Text style={styles.resultTitle} numberOfLines={2}>
                        {result.title}
                    </Text>
                    <Text style={styles.resultUrl} numberOfLines={1}>
                        <Globe size={12} color={theme.mutedForeground} /> {result.url}
                    </Text>
                    {result.snippet && (
                        <Text style={styles.resultSnippet} numberOfLines={3}>
                            {result.snippet}
                        </Text>
                    )}
                </TouchableOpacity>
            ))}
        </ScrollView>
    );

    const renderEmpty = () => (
        <View style={styles.emptyState}>
            <Search size={48} color={theme.mutedForeground} />
            <Text style={styles.emptyText}>No search results found</Text>
        </View>
    );

    return (
        <View style={styles.container}>
            {isStreaming ? renderLoading() :
                searchResults.length > 0 ? renderResults() : renderEmpty()}
        </View>
    );
}; 