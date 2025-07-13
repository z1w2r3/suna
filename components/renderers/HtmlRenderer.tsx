import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Dimensions, Linking, Text, TouchableOpacity, View } from 'react-native';
import { WebView } from 'react-native-webview';
import { Colors } from '../../constants/Colors';
import { useColorScheme } from '../../hooks/useColorScheme';
import { CodeRenderer } from './CodeRenderer';

interface HtmlRendererProps {
    content: string;
    previewUrl?: string;
    style?: any;
}

export function HtmlRenderer({ content, previewUrl, style }: HtmlRendererProps) {
    const colorScheme = useColorScheme();
    const isDark = colorScheme === 'dark';
    const theme = Colors[colorScheme ?? 'light'];
    const { width, height } = Dimensions.get('window');

    // Always default to 'preview' mode
    const [viewMode, setViewMode] = useState<'preview' | 'code'>('preview');

    if (!content) {
        return (
            <View style={[{
                flex: 1,
                justifyContent: 'center',
                alignItems: 'center',
                backgroundColor: theme.background,
                padding: 20
            }, style]}>
                <Text style={{
                    fontSize: 16,
                    color: theme.foreground,
                    opacity: 0.7
                }}>
                    No HTML content to display
                </Text>
            </View>
        );
    }

    // Create a complete HTML document with proper styling
    const htmlDocument = `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <style>
                body {
                    margin: 0;
                    padding: 16px;
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                    background-color: ${isDark ? '#121215' : '#f6f6f6'};
                    color: ${isDark ? '#fafafa' : '#1d1c1b'};
                    line-height: 1.6;
                }
                
                h1, h2, h3, h4, h5, h6 {
                    color: ${isDark ? '#fafafa' : '#171717'};
                    margin-top: 1.5em;
                    margin-bottom: 0.5em;
                }
                
                h1 { font-size: 2em; }
                h2 { font-size: 1.5em; }
                h3 { font-size: 1.17em; }
                h4 { font-size: 1em; }
                h5 { font-size: 0.83em; }
                h6 { font-size: 0.67em; }
                
                p {
                    margin-bottom: 1em;
                }
                
                a {
                    color: ${isDark ? '#155dfc' : '#155dfc'};
                    text-decoration: none;
                }
                
                a:hover {
                    text-decoration: underline;
                }
                
                pre {
                    background-color: ${isDark ? '#2a2a2a' : '#f8f9fa'};
                    border: 1px solid ${isDark ? '#404040' : '#e9ecef'};
                    border-radius: 4px;
                    padding: 1em;
                    overflow-x: auto;
                    font-family: 'Courier New', monospace;
                    font-size: 0.9em;
                }
                
                code {
                    background-color: ${isDark ? '#2a2a2a' : '#f8f9fa'};
                    border: 1px solid ${isDark ? '#404040' : '#e9ecef'};
                    border-radius: 2px;
                    padding: 0.2em 0.4em;
                    font-family: 'Courier New', monospace;
                    font-size: 0.9em;
                }
                
                blockquote {
                    border-left: 4px solid ${isDark ? '#555' : '#ddd'};
                    margin: 1em 0;
                    padding-left: 1em;
                    font-style: italic;
                    background-color: ${isDark ? '#2a2a2a' : '#f8f9fa'};
                    padding: 1em;
                    border-radius: 4px;
                }
                
                table {
                    border-collapse: collapse;
                    width: 100%;
                    margin: 1em 0;
                }
                
                th, td {
                    border: 1px solid ${isDark ? '#404040' : '#e9ecef'};
                    padding: 0.5em;
                    text-align: left;
                }
                
                th {
                    background-color: ${isDark ? '#333' : '#f8f9fa'};
                    font-weight: bold;
                }
                
                tr:nth-child(even) {
                    background-color: ${isDark ? '#2a2a2a' : '#f8f9fa'};
                }
                
                ul, ol {
                    margin: 1em 0;
                    padding-left: 2em;
                }
                
                li {
                    margin-bottom: 0.5em;
                }
                
                img {
                    max-width: 100%;
                    height: auto;
                    border-radius: 4px;
                }
                
                hr {
                    border: none;
                    height: 1px;
                    background-color: ${isDark ? '#404040' : '#e9ecef'};
                    margin: 2em 0;
                }
                
                .container {
                    max-width: 100%;
                    word-wrap: break-word;
                    overflow-wrap: break-word;
                }
            </style>
        </head>
        <body>
            <div class="container">
                ${content}
            </div>
        </body>
        </html>
    `;

    const renderToggleButtons = () => (
        <View style={{
            position: 'absolute',
            top: 12,
            left: 12,
            zIndex: 10,
            flexDirection: 'row',
            backgroundColor: isDark ? 'rgba(0,0,0,0.8)' : 'rgba(255,255,255,0.8)',
            borderRadius: 8,
            padding: 4,
            elevation: 3,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.25,
            shadowRadius: 3.84,
        }}>
            <TouchableOpacity
                onPress={() => setViewMode('preview')}
                style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    paddingHorizontal: 12,
                    paddingVertical: 8,
                    borderRadius: 6,
                    backgroundColor: viewMode === 'preview' ?
                        (isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.1)') :
                        'transparent',
                }}
            >
                <Ionicons
                    name="eye-outline"
                    size={16}
                    color={theme.foreground}
                    style={{ marginRight: 6 }}
                />
                <Text style={{
                    fontSize: 14,
                    color: theme.foreground,
                    fontWeight: viewMode === 'preview' ? '600' : '400'
                }}>
                    Preview
                </Text>
            </TouchableOpacity>

            <TouchableOpacity
                onPress={() => setViewMode('code')}
                style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    paddingHorizontal: 12,
                    paddingVertical: 8,
                    borderRadius: 6,
                    backgroundColor: viewMode === 'code' ?
                        (isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.1)') :
                        'transparent',
                }}
            >
                <Ionicons
                    name="code-slash-outline"
                    size={16}
                    color={theme.foreground}
                    style={{ marginRight: 6 }}
                />
                <Text style={{
                    fontSize: 14,
                    color: theme.foreground,
                    fontWeight: viewMode === 'code' ? '600' : '400'
                }}>
                    Code
                </Text>
            </TouchableOpacity>

            {previewUrl && (
                <TouchableOpacity
                    onPress={() => Linking.openURL(previewUrl)}
                    style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        paddingHorizontal: 12,
                        paddingVertical: 8,
                        borderRadius: 6,
                        marginLeft: 4,
                    }}
                >
                    <Ionicons
                        name="open-outline"
                        size={16}
                        color={theme.foreground}
                    />
                </TouchableOpacity>
            )}
        </View>
    );

    return (
        <View style={[{ flex: 1, backgroundColor: theme.background }, style]}>
            {/* Toggle buttons */}
            {renderToggleButtons()}

            {/* Content area */}
            <View style={{ flex: 1 }}>
                {viewMode === 'preview' ? (
                    <WebView
                        source={{ html: htmlDocument }}
                        style={{
                            flex: 1,
                            backgroundColor: theme.background,
                        }}
                        showsVerticalScrollIndicator={true}
                        showsHorizontalScrollIndicator={false}
                        scalesPageToFit={true}
                        originWhitelist={['*']}
                        mixedContentMode="compatibility"
                        javaScriptEnabled={true}
                        domStorageEnabled={true}
                        startInLoadingState={true}
                        renderLoading={() => (
                            <View style={{
                                flex: 1,
                                justifyContent: 'center',
                                alignItems: 'center',
                                backgroundColor: theme.background
                            }}>
                                <Text style={{
                                    fontSize: 16,
                                    color: theme.foreground,
                                    opacity: 0.7
                                }}>
                                    Loading HTML...
                                </Text>
                            </View>
                        )}
                        onError={(error) => {
                            console.error('WebView error:', error);
                        }}
                        onHttpError={(error) => {
                            console.error('WebView HTTP error:', error);
                        }}
                        onLoad={() => {
                            // Optional: Handle successful load
                        }}
                    />
                ) : (
                    <CodeRenderer
                        content={content}
                        language="html"
                        showLineNumbers={true}
                        style={{ flex: 1 }}
                    />
                )}
            </View>
        </View>
    );
} 