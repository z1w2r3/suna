import { SERVER_URL } from '@/constants/Server';
import { createSupabaseClient } from '@/constants/SupabaseConfig';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';

interface ImageContentResult {
    data: string | null;
    isLoading: boolean;
    error: Error | null;
    isProcessing: boolean; // New state for server processing
}

// Optimistic cache for uploaded files
const uploadCache = new Map<string, Blob>();

// Convert blob to base64 data URL for React Native
const blobToDataURL = (blob: Blob): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
    });
};

export function useImageContent(
    sandboxId?: string,
    filePath?: string,
    uploadedBlob?: Blob // For optimistic caching
): ImageContentResult {
    const [imageUrl, setImageUrl] = useState<string | null>(null);

    // Normalize path
    const normalizedPath = filePath && !filePath.startsWith('/workspace')
        ? `/workspace/${filePath.startsWith('/') ? filePath.substring(1) : filePath}`
        : filePath;

    const cacheKey = `${sandboxId}:${normalizedPath}`;

    // Optimistic caching for uploads
    useEffect(() => {
        if (uploadedBlob && cacheKey) {
            uploadCache.set(cacheKey, uploadedBlob);
            // Auto-expire after 30 seconds
            setTimeout(() => uploadCache.delete(cacheKey), 30000);
        }
    }, [uploadedBlob, cacheKey]);

    // Smart fetch with retry logic
    const {
        data: blobData,
        isLoading,
        error,
    } = useQuery({
        queryKey: ['image', sandboxId, normalizedPath],
        queryFn: async () => {
            // Check optimistic cache first
            const cachedBlob = uploadCache.get(cacheKey);
            if (cachedBlob) {
                console.log(`[IMAGE] Using optimistic cache for ${filePath}`);
                return cachedBlob;
            }

            // Fetch from server
            const supabase = createSupabaseClient();
            const { data: { session } } = await supabase.auth.getSession();

            if (!session?.access_token) {
                throw new Error('No auth token');
            }

            const url = new URL(`${SERVER_URL}/sandboxes/${sandboxId}/files/content`);
            url.searchParams.append('path', normalizedPath!);

            const response = await fetch(url.toString(), {
                headers: {
                    'Authorization': `Bearer ${session.access_token}`,
                },
            });

            if (!response.ok) {
                throw new Error(`Failed to load image: ${response.status}`);
            }

            return await response.blob();
        },
        enabled: Boolean(sandboxId && normalizedPath),
        staleTime: 5 * 60 * 1000, // 5 minutes
        retry: (failureCount, error: any) => {
            // Smart retry for 404s (server processing)
            if (error?.message?.includes('404')) {
                return failureCount < 3;
            }
            // Don't retry auth errors
            if (error?.message?.includes('401') || error?.message?.includes('403')) {
                return false;
            }
            return failureCount < 2;
        },
        retryDelay: (attemptIndex) => {
            // Exponential backoff: 1s, 2s, 4s
            return Math.min(1000 * (2 ** attemptIndex), 4000);
        },
    });

    // Convert blob to data URL
    useEffect(() => {
        if (blobData instanceof Blob) {
            blobToDataURL(blobData)
                .then(setImageUrl)
                .catch(console.error);
        } else {
            setImageUrl(null);
        }
    }, [blobData]);

    const isProcessing = error?.message?.includes('404') && isLoading;

    return {
        data: imageUrl,
        isLoading,
        error,
        isProcessing,
    };
}

// Utility for optimistic caching of uploaded files
export function cacheUploadedFile(sandboxId: string, filePath: string, blob: Blob) {
    const normalizedPath = !filePath.startsWith('/workspace')
        ? `/workspace/${filePath.startsWith('/') ? filePath.substring(1) : filePath}`
        : filePath;
    const cacheKey = `${sandboxId}:${normalizedPath}`;

    uploadCache.set(cacheKey, blob);
    console.log(`[IMAGE] Cached uploaded file: ${filePath}`);

    // Auto-expire after 30 seconds
    setTimeout(() => {
        uploadCache.delete(cacheKey);
        console.log(`[IMAGE] Expired cache for: ${filePath}`);
    }, 30000);
} 