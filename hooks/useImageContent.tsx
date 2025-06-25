import { SERVER_URL } from '@/constants/Server';
import { supabase } from '@/constants/SupabaseConfig';
import { useEffect, useState } from 'react';

interface ImageContentResult {
    data: string | null;
    isLoading: boolean;
    error: Error | null;
}

// Cache for loaded image URLs
const imageCache = new Map<string, string>();

// Convert blob to base64 data URL for React Native
const blobToDataURL = (blob: Blob): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
    });
};

export function useImageContent(sandboxId?: string, filePath?: string): ImageContentResult {
    const [imageUrl, setImageUrl] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<Error | null>(null);

    useEffect(() => {
        if (!sandboxId || !filePath) {
            setImageUrl(null);
            setError(null);
            setIsLoading(false);
            return;
        }

        // Normalize path to have /workspace prefix
        let normalizedPath = filePath;
        if (!normalizedPath.startsWith('/workspace')) {
            normalizedPath = `/workspace/${normalizedPath.startsWith('/') ? normalizedPath.substring(1) : normalizedPath}`;
        }

        // Check cache first
        const cacheKey = `${sandboxId}:${normalizedPath}`;
        const cached = imageCache.get(cacheKey);
        if (cached) {
            setImageUrl(cached);
            setIsLoading(false);
            setError(null);
            return;
        }

        // Load image with authentication
        const loadImage = async () => {
            setIsLoading(true);
            setError(null);

            try {
                // Get session for auth token
                const { data: { session }, error: sessionError } = await supabase.auth.getSession();

                if (sessionError) {
                    throw new Error(`Authentication error: ${sessionError.message}`);
                }

                // Construct API URL
                const url = new URL(`${SERVER_URL}/sandboxes/${sandboxId}/files/content`);
                url.searchParams.append('path', normalizedPath);

                // Prepare headers with auth
                const headers: Record<string, string> = {};
                if (session?.access_token) {
                    headers['Authorization'] = `Bearer ${session.access_token}`;
                }

                console.log('[useImageContent] Fetching image:', url.toString());

                // Fetch the image
                const response = await fetch(url.toString(), { headers });

                if (!response.ok) {
                    throw new Error(`Failed to load image: ${response.status} ${response.statusText}`);
                }

                // Convert to blob then to base64 data URL for React Native
                const blob = await response.blob();
                const dataUrl = await blobToDataURL(blob);

                // Cache the result
                imageCache.set(cacheKey, dataUrl);

                setImageUrl(dataUrl);
                setIsLoading(false);

            } catch (err) {
                console.error('[useImageContent] Error loading image:', err);
                setError(err instanceof Error ? err : new Error('Failed to load image'));
                setIsLoading(false);
            }
        };

        loadImage();

        // Cleanup function
        return () => {
            // No cleanup needed for data URLs
        };
    }, [sandboxId, filePath]);

    return {
        data: imageUrl,
        isLoading,
        error
    };
} 