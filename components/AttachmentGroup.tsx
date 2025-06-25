import { UploadedFile } from '@/utils/file-upload';
import React from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { FileAttachment } from './FileAttachment';

interface AttachmentGroupProps {
    attachments: string[] | UploadedFile[];
    sandboxId?: string;
    onFilePress?: (path: string) => void;
    layout?: 'inline' | 'grid';
    showPreviews?: boolean;
    maxHeight?: number;
}

export const AttachmentGroup: React.FC<AttachmentGroupProps> = ({
    attachments,
    sandboxId,
    onFilePress,
    layout = 'grid',
    showPreviews = true,
    maxHeight = 200
}) => {
    if (!attachments || attachments.length === 0) {
        return null;
    }

    const isInline = layout === 'inline';

    if (isInline) {
        return (
            <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={[styles.inlineContainer, { maxHeight }]}
                contentContainerStyle={styles.inlineContent}
            >
                {attachments.map((attachment, index) => {
                    const isUploadedFile = typeof attachment === 'object';
                    const filepath = isUploadedFile ? attachment.path : attachment;

                    return (
                        <View key={index} style={styles.inlineItem}>
                            <FileAttachment
                                filepath={filepath}
                                sandboxId={sandboxId}
                                onPress={onFilePress}
                                layout="inline"
                                showPreview={showPreviews}
                                isUploading={isUploadedFile ? attachment.isUploading : false}
                                uploadError={isUploadedFile ? attachment.uploadError : undefined}
                            />
                        </View>
                    );
                })}
            </ScrollView>
        );
    }

    // Grid layout
    return (
        <View style={styles.gridContainer}>
            {attachments.map((attachment, index) => {
                const isUploadedFile = typeof attachment === 'object';
                const filepath = isUploadedFile ? attachment.path : attachment;

                return (
                    <View key={index} style={styles.gridItem}>
                        <FileAttachment
                            filepath={filepath}
                            sandboxId={sandboxId}
                            onPress={onFilePress}
                            layout="grid"
                            showPreview={showPreviews}
                            isUploading={isUploadedFile ? attachment.isUploading : false}
                            uploadError={isUploadedFile ? attachment.uploadError : undefined}
                        />
                    </View>
                );
            })}
        </View>
    );
};

const styles = StyleSheet.create({
    inlineContainer: {
        marginVertical: 8,
    },
    inlineContent: {
        paddingHorizontal: 4,
        gap: 8,
    },
    inlineItem: {
        marginRight: 8,
    },
    gridContainer: {
        gap: 8,
        marginTop: 8,
    },
    gridItem: {
        width: '100%',
    },
}); 