import { useImageContent } from '@/hooks/useImageContent';
import { useTheme } from '@/hooks/useThemeColor';
import { FileType, getEstimatedFileSize, getFileType } from '@/utils/file-parser';
import { File, FileAudio, FileCode, FileImage, FileText, FileVideo } from 'lucide-react-native';
import React from 'react';
import { ActivityIndicator, Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

interface FileAttachmentProps {
    filepath: string;
    sandboxId?: string;
    onPress?: (path: string) => void;
    showPreview?: boolean;
    layout?: 'inline' | 'grid';
    isUploading?: boolean;
    uploadError?: string;
}

const getFileIcon = (type: FileType) => {
    const iconProps = { size: 20, strokeWidth: 2 };

    switch (type) {
        case 'image': return <FileImage {...iconProps} />;
        case 'video': return <FileVideo {...iconProps} />;
        case 'audio': return <FileAudio {...iconProps} />;
        case 'code': return <FileCode {...iconProps} />;
        case 'text': return <FileText {...iconProps} />;
        default: return <File {...iconProps} />;
    }
};

const getTypeLabel = (type: FileType, extension?: string): string => {
    if (type === 'code' && extension) {
        return extension.toUpperCase();
    }

    const labels: Record<FileType, string> = {
        image: 'Image',
        video: 'Video',
        audio: 'Audio',
        pdf: 'PDF',
        text: 'Text',
        code: 'Code',
        other: 'File'
    };

    return labels[type];
};

export const FileAttachment: React.FC<FileAttachmentProps> = ({
    filepath,
    sandboxId,
    onPress,
    showPreview = true,
    layout = 'inline',
    isUploading = false,
    uploadError
}) => {
    const theme = useTheme();
    const filename = filepath.split('/').pop() || 'file';
    const extension = filename.split('.').pop()?.toLowerCase() || '';
    const fileType = getFileType(filename);
    const fileSize = getEstimatedFileSize(filepath, fileType);
    const typeLabel = getTypeLabel(fileType, extension);

    const isImage = fileType === 'image';
    const isGrid = layout === 'grid';

    // Debug logging
    console.log(`[FileAttachment] ${filename} - layout: ${layout}, isGrid: ${isGrid}, isImage: ${isImage}`);

    // Use authenticated image loading for images
    const {
        data: imageUrl,
        isLoading: imageLoading,
        error: imageError
    } = useImageContent(isImage && sandboxId ? sandboxId : undefined, isImage ? filepath : undefined);

    const handlePress = () => {
        onPress?.(filepath);
    };

    const containerStyle = [
        styles.container,
        {
            backgroundColor: theme.sidebar,
            borderColor: theme.border,
        },
        isGrid ? styles.gridContainer : styles.inlineContainer
    ];

    // IMAGES ALWAYS SHOW AS PREVIEWS
    if (isImage && showPreview) {
        // Dynamic height based on layout with aspect ratio considerations
        const maxHeight = isGrid ? 200 : 54;
        const minHeight = isGrid ? 120 : 54;

        // Loading state
        if (imageLoading && sandboxId) {
            return (
                <TouchableOpacity
                    style={[
                        containerStyle,
                        {
                            height: minHeight,
                            justifyContent: 'center',
                            alignItems: 'center'
                        }
                    ]}
                    onPress={handlePress}
                    activeOpacity={0.8}
                >
                    <ActivityIndicator size="small" color={theme.mutedForeground} />
                </TouchableOpacity>
            );
        }

        // Error state
        if (imageError || !imageUrl) {
            return (
                <TouchableOpacity
                    style={[containerStyle, { height: minHeight }]}
                    onPress={handlePress}
                    activeOpacity={0.8}
                >
                    <View style={[styles.iconContainer, { backgroundColor: theme.background }]}>
                        {React.cloneElement(getFileIcon(fileType), {
                            color: theme.destructive
                        })}
                    </View>
                    <View style={styles.fileInfo}>
                        <Text style={[styles.filename, { color: theme.foreground }]} numberOfLines={1}>
                            {filename}
                        </Text>
                        <Text style={[styles.errorText, { color: theme.destructive }]}>
                            Failed to load
                        </Text>
                    </View>
                </TouchableOpacity>
            );
        }

        // Success: Show image preview with proper aspect ratio
        if (isGrid) {
            // Grid mode: Use custom container without flex row constraints
            return (
                <View
                    style={{
                        backgroundColor: theme.sidebar,
                        borderColor: theme.border,
                        borderRadius: 12,
                        borderWidth: 1,
                        overflow: 'hidden',
                        width: '100%',
                        aspectRatio: 1.5,
                        maxHeight: 250,
                        minHeight: 150,
                    }}
                >
                    <TouchableOpacity
                        style={styles.imageGridTouchable}
                        onPress={handlePress}
                        activeOpacity={0.8}
                    >
                        <Image
                            source={{ uri: imageUrl }}
                            style={styles.imageGridPreview}
                            resizeMode="cover"
                            onError={(error) => {
                                console.log('[FileAttachment] Image load error:', error.nativeEvent.error);
                                console.log('[FileAttachment] Image URL:', imageUrl);
                            }}
                        />
                    </TouchableOpacity>
                </View>
            );
        } else {
            // Inline mode: Fixed height with contain
            return (
                <TouchableOpacity
                    style={[containerStyle, styles.imageInlineContainer]}
                    onPress={handlePress}
                    activeOpacity={0.8}
                >
                    <Image
                        source={{ uri: imageUrl }}
                        style={styles.imageInlinePreview}
                        resizeMode="contain"
                        onError={(error) => {
                            console.log('[FileAttachment] Image load error:', error.nativeEvent.error);
                            console.log('[FileAttachment] Image URL:', imageUrl);
                        }}
                    />
                </TouchableOpacity>
            );
        }
    }

    // Regular file display (non-images)
    return (
        <TouchableOpacity
            style={[containerStyle, { opacity: isUploading ? 0.7 : 1 }]}
            onPress={handlePress}
            activeOpacity={0.8}
        >
            <View style={[styles.iconContainer, { backgroundColor: theme.background }]}>
                {isUploading ? (
                    <ActivityIndicator size="small" color={theme.mutedForeground} />
                ) : (
                    React.cloneElement(getFileIcon(fileType), {
                        color: uploadError ? theme.destructive : theme.mutedForeground
                    })
                )}
            </View>

            <View style={styles.fileInfo}>
                <Text
                    style={[styles.filename, { color: uploadError ? theme.destructive : theme.foreground }]}
                    numberOfLines={1}
                >
                    {filename}
                </Text>
                <View style={styles.metadata}>
                    {uploadError ? (
                        <Text style={[styles.metadataText, { color: theme.destructive }]}>
                            Upload failed
                        </Text>
                    ) : isUploading ? (
                        <Text style={[styles.metadataText, { color: theme.mutedForeground }]}>
                        </Text>
                    ) : (
                        <>
                            <Text style={[styles.metadataText, { color: theme.mutedForeground }]}>
                                {typeLabel}
                            </Text>
                            <Text style={[styles.metadataText, { color: theme.mutedForeground }]}>
                                • {fileSize}
                            </Text>
                        </>
                    )}
                </View>
            </View>
        </TouchableOpacity>
    );
};

const styles = StyleSheet.create({
    container: {
        borderRadius: 12,
        borderWidth: 1,
        overflow: 'hidden',
        flexDirection: 'row',
        alignItems: 'center',
    },
    inlineContainer: {
        height: 54,
        minWidth: 54,
        maxWidth: 54,
        paddingRight: 12,
    },
    gridContainer: {
        width: '100%',
    },
    imageInlineContainer: {
        height: 54,
        minWidth: 170,
        maxWidth: 300,
        padding: 0,
    },
    iconContainer: {
        width: 54,
        height: 54,
        justifyContent: 'center',
        alignItems: 'center',
        flexShrink: 0,
    },
    fileInfo: {
        flex: 1,
        paddingLeft: 12,
        justifyContent: 'center',
        minWidth: 0,
    },
    filename: {
        fontSize: 14,
        fontWeight: '500',
        marginBottom: 2,
    },
    metadata: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    metadataText: {
        fontSize: 12,
        marginRight: 4,
    },
    imageInlinePreview: {
        width: '100%',
        height: 54,
    },
    imageGridPreview: {
        width: '100%',
        height: '100%',
    },
    imageOverlay: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        padding: 8,
    },
    imageFilename: {
        fontSize: 12,
        fontWeight: '500',
    },
    loadingText: {
        fontSize: 12,
        marginTop: 4,
    },
    errorText: {
        fontSize: 12,
    },
    imageGridTouchable: {
        flex: 1,
        width: '100%',
        height: '100%',
        position: 'relative',
    },
}); 