// ===== Voice Clipboard - Content Script =====
(function () {
    // 중복 로드 방지
    if (document.getElementById('vc-panel')) return;

    // ── HTML 생성 ──
    const panel = document.createElement('div');
    panel.id = 'vc-panel';
    panel.innerHTML = `
    <div id="vc-mini-icon">🎙️</div>
    <div id="vc-header">
      <span id="vc-header-title">🎙️ Voice Clipboard</span>
      <div id="vc-header-btns">
        <button id="vc-minimize-btn" title="최소화">─</button>
        <button id="vc-close-btn" title="닫기">✕</button>
      </div>
    </div>
    <div id="vc-body">
      <div id="vc-text-display" class="vc-placeholder">마이크 버튼을 눌러 음성 인식을 시작하세요</div>
      <div id="vc-interim"></div>
    </div>
    <div id="vc-footer">
      <button class="vc-btn" id="vc-mic-btn">🎤 시작</button>
      <button class="vc-btn" id="vc-copy-btn">📋 복사</button>
      <button class="vc-btn" id="vc-clear-btn">🗑️ 지우기</button>
      <select id="vc-lang-select">
        <option value="ko-KR" selected>한국어</option>
        <option value="en-US">English (US)</option>
        <option value="en-GB">English (UK)</option>
        <option value="ja-JP">日本語</option>
        <option value="zh-CN">中文</option>
        <option value="es-ES">Español</option>
        <option value="fr-FR">Français</option>
        <option value="de-DE">Deutsch</option>
      </select>
    </div>
  `;
    document.body.appendChild(panel);

    // 토스트
    const toast = document.createElement('div');
    toast.id = 'vc-toast';
    toast.textContent = '✅ 클립보드에 복사됨!';
    document.body.appendChild(toast);

    // ── 요소 참조 ──
    const micBtn = document.getElementById('vc-mic-btn');
    const copyBtn = document.getElementById('vc-copy-btn');
    const clearBtn = document.getElementById('vc-clear-btn');
    const textDisplay = document.getElementById('vc-text-display');
    const interimDisplay = document.getElementById('vc-interim');
    const langSelect = document.getElementById('vc-lang-select');
    const minimizeBtn = document.getElementById('vc-minimize-btn');
    const closeBtn = document.getElementById('vc-close-btn');
    const header = document.getElementById('vc-header');

    // ── 상태 ──
    let recognition = null;
    let isRecording = false;
    let finalText = '';

    // ── Web Speech API 초기화 ──
    function createRecognition() {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognition) {
            textDisplay.textContent = '❌ 이 브라우저는 음성인식을 지원하지 않습니다. Chrome을 사용하세요.';
            textDisplay.classList.remove('vc-placeholder');
            micBtn.disabled = true;
            return null;
        }

        const rec = new SpeechRecognition();
        rec.continuous = true;        // 연속 인식
        rec.interimResults = true;    // 중간 결과 표시
        rec.lang = langSelect.value;
        rec.maxAlternatives = 1;

        rec.onresult = (event) => {
            let interim = '';
            for (let i = event.resultIndex; i < event.results.length; i++) {
                const transcript = event.results[i][0].transcript;
                if (event.results[i].isFinal) {
                    finalText += transcript + ' ';
                } else {
                    interim += transcript;
                }
            }
            // 최종 텍스트 표시
            if (finalText.trim()) {
                textDisplay.textContent = finalText.trim();
                textDisplay.classList.remove('vc-placeholder');
            }
            // 중간 결과 표시
            interimDisplay.textContent = interim;
        };

        rec.onerror = (event) => {
            console.error('Voice Clipboard 에러:', event.error);
            if (event.error === 'not-allowed') {
                textDisplay.textContent = '❌ 마이크 권한이 필요합니다. 주소창 왼쪽 자물쇠 아이콘에서 마이크를 허용하세요.';
                textDisplay.classList.remove('vc-placeholder');
            }
            stopRecording();
        };

        rec.onend = () => {
            // continuous 모드에서도 가끔 자동 종료됨 → 녹음 중이면 재시작
            if (isRecording) {
                try {
                    rec.start();
                } catch (e) {
                    stopRecording();
                }
            }
        };

        return rec;
    }

    // ── 녹음 시작/중지 ──
    function startRecording() {
        recognition = createRecognition();
        if (!recognition) return;
        try {
            recognition.start();
            isRecording = true;
            micBtn.textContent = '⏹ 중지';
            micBtn.classList.add('vc-recording');
        } catch (e) {
            console.error('음성인식 시작 실패:', e);
        }
    }

    function stopRecording() {
        if (recognition) {
            isRecording = false;
            try { recognition.stop(); } catch (e) { }
            recognition = null;
        }
        micBtn.textContent = '🎤 시작';
        micBtn.classList.remove('vc-recording');
        interimDisplay.textContent = '';
    }

    // ── 이벤트 바인딩 ──
    micBtn.addEventListener('click', () => {
        if (isRecording) {
            stopRecording();
        } else {
            startRecording();
        }
    });

    copyBtn.addEventListener('click', () => {
        const text = finalText.trim();
        if (!text) return;
        navigator.clipboard.writeText(text).then(() => {
            showToast('✅ 클립보드에 복사됨!');
        }).catch(() => {
            // fallback
            const ta = document.createElement('textarea');
            ta.value = text;
            ta.style.position = 'fixed';
            ta.style.left = '-9999px';
            document.body.appendChild(ta);
            ta.select();
            document.execCommand('copy');
            document.body.removeChild(ta);
            showToast('✅ 클립보드에 복사됨!');
        });
    });

    clearBtn.addEventListener('click', () => {
        finalText = '';
        textDisplay.textContent = '마이크 버튼을 눌러 음성 인식을 시작하세요';
        textDisplay.classList.add('vc-placeholder');
        interimDisplay.textContent = '';
    });

    langSelect.addEventListener('change', () => {
        if (isRecording) {
            stopRecording();
            startRecording();
        }
    });

    // ── 최소화 / 닫기 ──
    minimizeBtn.addEventListener('click', () => {
        panel.classList.add('vc-minimized');
        if (isRecording) stopRecording();
    });

    panel.addEventListener('click', (e) => {
        if (panel.classList.contains('vc-minimized')) {
            panel.classList.remove('vc-minimized');
        }
    });

    closeBtn.addEventListener('click', () => {
        if (isRecording) stopRecording();
        panel.style.display = 'none';
    });

    // ── 드래그 이동 ──
    let isDragging = false;
    let dragOffsetX, dragOffsetY;

    header.addEventListener('mousedown', (e) => {
        if (e.target.tagName === 'BUTTON') return;
        isDragging = true;
        const rect = panel.getBoundingClientRect();
        dragOffsetX = e.clientX - rect.left;
        dragOffsetY = e.clientY - rect.top;
        e.preventDefault();
    });

    document.addEventListener('mousemove', (e) => {
        if (!isDragging) return;
        panel.style.left = (e.clientX - dragOffsetX) + 'px';
        panel.style.top = (e.clientY - dragOffsetY) + 'px';
        panel.style.right = 'auto';
        panel.style.bottom = 'auto';
    });

    document.addEventListener('mouseup', () => {
        isDragging = false;
    });

    // ── 토스트 표시 ──
    function showToast(msg) {
        toast.textContent = msg;
        toast.classList.add('vc-show');
        setTimeout(() => toast.classList.remove('vc-show'), 2000);
    }

    // ── 단축키: Ctrl+Shift+V로 토글 ──
    document.addEventListener('keydown', (e) => {
        if (e.ctrlKey && e.shiftKey && e.code === 'KeyV') {
            e.preventDefault();
            if (panel.style.display === 'none') {
                panel.style.display = 'flex';
            } else if (isRecording) {
                stopRecording();
            } else {
                startRecording();
            }
        }
    });

})();
