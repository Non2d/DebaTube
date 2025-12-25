
/**
 * Helper function to get duration from audio blob
 */
export const getAudioDuration = async (blob: Blob): Promise<number> => {
    return new Promise((resolve) => {
        const url = URL.createObjectURL(blob);
        const audio = new Audio();

        const handleLoadedMetadata = () => {
            const duration = audio.duration;
            URL.revokeObjectURL(url);
            audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
            audio.removeEventListener('error', handleError);
            resolve(duration || 0);
        };

        const handleError = () => {
            URL.revokeObjectURL(url);
            audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
            audio.removeEventListener('error', handleError);
            resolve(0);
        };

        audio.addEventListener('loadedmetadata', handleLoadedMetadata);
        audio.addEventListener('error', handleError);
        audio.src = url;
    });
};
