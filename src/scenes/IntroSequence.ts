export class IntroSequence {
    private videoPath = '/assets/images/intro_video.mp4';

    constructor() {
        // No dependencies needed for video player
    }

    public async play(): Promise<void> {
        return new Promise((resolve) => {
            console.log('[Intro] Attempting to play video...');

            // Create container
            const container = document.createElement('div');
            Object.assign(container.style, {
                position: 'fixed',
                top: '0',
                left: '0',
                width: '100%',
                height: '100%',
                backgroundColor: 'black',
                zIndex: '5000',
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
            });

            // Create video element
            const video = document.createElement('video');
            video.src = this.videoPath;
            video.style.width = '100%';
            video.style.height = '100%';
            video.style.objectFit = 'cover';
            video.autoplay = true;
            video.playsInline = true; // For mobile

            // Create skip button
            const skipBtn = document.createElement('button');
            skipBtn.innerText = 'SKIP INTRO';
            Object.assign(skipBtn.style, {
                position: 'absolute',
                bottom: '30px',
                right: '30px',
                padding: '10px 20px',
                backgroundColor: 'rgba(255, 255, 255, 0.2)',
                color: 'white',
                border: '1px solid white',
                borderRadius: '5px',
                cursor: 'pointer',
                fontFamily: 'Segoe UI, sans-serif',
                fontSize: '14px',
                zIndex: '5001',
                transition: 'background 0.2s',
            });

            skipBtn.onmouseover = () => {
                skipBtn.style.backgroundColor = 'rgba(255, 255, 255, 0.4)';
            };
            skipBtn.onmouseout = () => {
                skipBtn.style.backgroundColor = 'rgba(255, 255, 255, 0.2)';
            };

            // Cleanup function
            const cleanup = () => {
                video.pause();
                container.remove();
                resolve();
            };

            // Event listeners
            video.onended = () => {
                console.log('[Intro] Video finished');
                cleanup();
            };

            video.onerror = () => {
                console.warn('[Intro] Video file not found or failed to load. Skipping intro.');
                cleanup();
            };

            skipBtn.onclick = () => {
                console.log('[Intro] Skipped by user');
                cleanup();
            };

            // Assemble
            container.appendChild(video);
            container.appendChild(skipBtn);
            document.body.appendChild(container);

            // Attempt play
            video.play().catch((e) => {
                console.warn('[Intro] Autoplay failed (likely blocked), showing play button or skipping', e);
                // If autoplay is blocked, we could show a "Click to Start" button, 
                // but for now let's just rely on the user clicking "Skip" or the fallback
                // Actually, if autoplay fails, the video won't start and 'ended' won't fire.
                // We should probably just resolve if we can't play, or show a big play button.
                // For simplicity in this context (game), we'll assume interaction has happened or we skip.
                // But to be safe:
                skipBtn.innerText = 'START GAME'; // Change text if autoplay fails
            });
        });
    }
}
