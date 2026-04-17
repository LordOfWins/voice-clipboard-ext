/* Voice Clipboard — 설치 시 마이크 권한 요청 페이지 자동 열기 */
chrome.runtime.onInstalled.addListener((details) => {
    if (details.reason === 'install') {
        chrome.tabs.create({
            url: chrome.runtime.getURL('permission.html')
        });
    }
});
