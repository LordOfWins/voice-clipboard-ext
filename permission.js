/* Voice Clipboard — 마이크 권한 요청 */
(async function () {
    const statusEl = document.getElementById('status');
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        stream.getTracks().forEach(t => t.stop());
        statusEl.textContent = '✅ Microphone access granted!';
        statusEl.className = 'status granted';
        setTimeout(() => window.close(), 3000);
    } catch (err) {
        statusEl.textContent = '❌ Permission denied. Please allow microphone in site settings.';
        statusEl.className = 'status denied';
        console.error('[Voice Clipboard] mic permission denied:', err);
    }
})();
