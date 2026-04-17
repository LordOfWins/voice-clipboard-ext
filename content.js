/* Voice Clipboard v6.7 — Final */
(function () {
    'use strict';

    const VC_VER = '6.7';

    /* ── 이전 버전 제거 ── */
    if (window.__vcStopRec) { try { window.__vcStopRec(); } catch (_) { } }
    ['vc-float', 'vc-preview', 'vc-toast', 'vc-lang-ring'].forEach(id => {
        const old = document.getElementById(id);
        if (old) old.remove();
    });
    window.__vcVer = VC_VER;

    /* ── 상수 ── */
    const SILENCE_MS = 4000;
    const HIDE_MS = 4000;
    const LANGS = [
        { code: 'ko-KR', label: 'KO', start: '🎤 녹음 시작', silence: '🔇 4초 무음 → 자동 종료', noSpeech: '🔇 음성이 감지되지 않았습니다' },
        { code: 'en-US', label: 'EN', start: '🎤 Recording started', silence: '🔇 4s silence → auto stop', noSpeech: '🔇 No speech detected' },
        { code: 'ja-JP', label: 'JA', start: '🎤 録音開始', silence: '🔇 4秒無音 → 自動終了', noSpeech: '🔇 音声が検出されませんでした' },
        { code: 'zh-CN', label: 'ZH', start: '🎤 开始录音', silence: '🔇 4秒无声 → 自动停止', noSpeech: '🔇 未检测到语音' },
        { code: 'es-ES', label: 'ES', start: '🎤 Grabación iniciada', silence: '🔇 4s silencio → parada auto', noSpeech: '🔇 No se detectó voz' },
        { code: 'fr-FR', label: 'FR', start: '🎤 Enregistrement démarré', silence: '🔇 4s silence → arrêt auto', noSpeech: '🔇 Aucune voix détectée' },
        { code: 'de-DE', label: 'DE', start: '🎤 Aufnahme gestartet', silence: '🔇 4s Stille → auto Stopp', noSpeech: '🔇 Keine Sprache erkannt' }
    ];
    const CUSTOM_DICT = {
        'chat gpt': 'ChatGPT', '챗 지피티': 'ChatGPT',
        '유튜브': 'YouTube', '자바스크립트': 'JavaScript',
        '타입스크립트': 'TypeScript'
    };

    let currentLang = LANGS[0].code;

    function getLang() {
        return LANGS.find(l => l.code === currentLang) || LANGS[0];
    }

    /* ── 유틸 ── */
    function ours(el) {
        if (!el) return false;
        const id = el.id || '';
        if (id.startsWith('vc-')) return true;
        if (el.classList && el.classList.contains('vc-lang-btn')) return true;
        return false;
    }

    function isIn(el) {
        if (!el || ours(el)) return false;
        const tag = (el.tagName || '').toUpperCase();
        if (tag === 'TEXTAREA') return true;
        if (tag === 'INPUT') {
            const t = (el.type || 'text').toLowerCase();
            return ['text', 'search', 'email', 'url', 'tel', 'number', 'password', ''].includes(t);
        }
        if (el.isContentEditable) return true;
        const role = (el.getAttribute('role') || '').toLowerCase();
        return ['textbox', 'combobox', 'searchbox'].includes(role);
    }

    function resolve(e) {
        if (!e) return null;
        if (isIn(e)) return e;
        let p = e;
        for (let i = 0; i < 8; i++) {
            p = p.parentElement;
            if (!p) break;
            if (isIn(p)) return p;
        }
        const SEL = 'input[type="text"],input[type="search"],input[type="email"],' +
            'input[type="url"],input[type="tel"],input[type="number"],' +
            'input[type="password"],input:not([type]),textarea,' +
            '[contenteditable="true"],[role="textbox"],[role="combobox"],[role="searchbox"]';
        const child = e.querySelector?.(SEL);
        if (child && isIn(child)) return child;
        if (e.parentElement) {
            const sib = e.parentElement.querySelector?.(SEL);
            if (sib && isIn(sib)) return sib;
        }
        return null;
    }

    function directFind(e) {
        if (!e) return null;
        if (isIn(e)) return e;
        const child = e.querySelector?.('input,textarea,[contenteditable="true"]');
        if (child && isIn(child)) return child;
        return null;
    }

    function dict(text) {
        let r = text;
        for (const [k, v] of Object.entries(CUSTOM_DICT)) {
            r = r.replace(new RegExp(k, 'gi'), v);
        }
        return r;
    }

    /* ── Toast ── */
    const toast = document.createElement('div');
    toast.id = 'vc-toast';
    document.documentElement.appendChild(toast);

    let toastTimer = null;
    function showToast(msg, ms = 2000) {
        toast.textContent = msg;
        toast.classList.add('vc-show');
        clearTimeout(toastTimer);
        toastTimer = setTimeout(() => toast.classList.remove('vc-show'), ms);
    }

    /* ── Floating UI ── */
    const fl = document.createElement('div');
    fl.id = 'vc-float';

    const mic = document.createElement('button');
    mic.id = 'vc-mic';
    mic.textContent = '🎤';
    mic.title = 'Voice Clipboard (Ctrl+Shift+V)\n1초 길게 누르면 언어 변경';

    fl.appendChild(mic);
    document.documentElement.appendChild(fl);

    const preview = document.createElement('div');
    preview.id = 'vc-preview';
    document.documentElement.appendChild(preview);

    /* ── 원형 언어 메뉴 ── */
    const langRing = document.createElement('div');
    langRing.id = 'vc-lang-ring';
    document.documentElement.appendChild(langRing);

    LANGS.forEach((l, i) => {
        const btn = document.createElement('button');
        btn.className = 'vc-lang-btn';
        btn.textContent = l.label;
        btn.dataset.code = l.code;
        if (i === 0) btn.classList.add('vc-lang-active');
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            e.preventDefault();
            currentLang = l.code;
            langRing.querySelectorAll('.vc-lang-btn').forEach(b => b.classList.remove('vc-lang-active'));
            btn.classList.add('vc-lang-active');
            showToast('🌐 ' + l.label + ' 선택됨');
            if (recording) {
                stopRec();
                setTimeout(startRec, 300);
            }
            closeLangRing();
        });
        langRing.appendChild(btn);
    });

    let longPressTimer = null;
    let langRingOpen = false;

    function openLangRing() {
        const micRect = mic.getBoundingClientRect();
        const cx = micRect.left + micRect.width / 2;
        const cy = micRect.top + micRect.height / 2;

        langRing.style.setProperty('left', cx + 'px', 'important');
        langRing.style.setProperty('top', cy + 'px', 'important');

        const radius = 60;
        const total = LANGS.length;
        const startAngle = -90;

        langRing.querySelectorAll('.vc-lang-btn').forEach((btn, i) => {
            const angle = startAngle + (360 / total) * i;
            const rad = angle * Math.PI / 180;
            const x = Math.cos(rad) * radius;
            const y = Math.sin(rad) * radius;
            btn.style.setProperty('transform', `translate(${x}px, ${y}px)`, 'important');
            btn.style.setProperty('opacity', '1', 'important');
        });

        langRing.classList.add('vc-show');
        langRingOpen = true;
    }

    function closeLangRing() {
        langRing.querySelectorAll('.vc-lang-btn').forEach(btn => {
            btn.style.setProperty('transform', 'translate(0, 0)', 'important');
            btn.style.setProperty('opacity', '0', 'important');
        });
        setTimeout(() => langRing.classList.remove('vc-show'), 200);
        langRingOpen = false;
    }

    mic.addEventListener('pointerdown', () => {
        longPressTimer = setTimeout(() => {
            openLangRing();
            longPressTimer = null;
        }, 1000);
    });

    mic.addEventListener('pointerup', () => {
        if (longPressTimer) { clearTimeout(longPressTimer); longPressTimer = null; }
    });

    mic.addEventListener('pointerleave', () => {
        if (longPressTimer) { clearTimeout(longPressTimer); longPressTimer = null; }
    });

    /* ── 위치 ── */
    let tgt = null;
    let hideTimer = null;
    let userClicked = false;

    function show(el) {
        if (!el) return;
        const rect = el.getBoundingClientRect();
        if (rect.width === 0 && rect.height === 0) return;

        let left = rect.left - 40;
        let top = rect.top - 40;

        if (left < 4) left = rect.left + 4;
        if (top < 4) top = rect.top + 4;

        fl.style.setProperty('left', left + 'px', 'important');
        fl.style.setProperty('top', top + 'px', 'important');
        fl.classList.add('vc-show');

        preview.style.setProperty('left', rect.left + 'px', 'important');
        preview.style.setProperty('top', (rect.bottom + 6) + 'px', 'important');

        resetHideTimer();
    }

    function hide() {
        if (rec && recording) return;
        if (langRingOpen) return;
        fl.classList.remove('vc-show');
        preview.classList.remove('vc-show');
    }

    function resetHideTimer() {
        clearTimeout(hideTimer);
        hideTimer = setTimeout(hide, HIDE_MS);
    }

    function reposition() {
        if (!tgt || !fl.classList.contains('vc-show')) return;
        show(tgt);
    }

    window.addEventListener('scroll', reposition, true);
    window.addEventListener('resize', reposition);

    /* ── 텍스트 삽입 ── */
    function insertText(el, text) {
        if (!el || !text) return;

        if (el.isContentEditable) {
            el.focus();
            const sel = window.getSelection();
            if (sel.rangeCount) {
                const range = sel.getRangeAt(0);
                range.deleteContents();
                range.insertNode(document.createTextNode(text));
                range.collapse(false);
                sel.removeAllRanges();
                sel.addRange(range);
            }
            el.dispatchEvent(new Event('input', { bubbles: true }));
            return;
        }

        el.focus();
        const ok = document.execCommand('insertText', false, text);
        if (ok) return;

        const proto = el.tagName.toUpperCase() === 'TEXTAREA'
            ? HTMLTextAreaElement.prototype
            : HTMLInputElement.prototype;
        const nativeSetter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;

        if (nativeSetter) {
            const start = el.selectionStart || 0;
            const end = el.selectionEnd || 0;
            const before = el.value.substring(0, start);
            const after = el.value.substring(end);
            nativeSetter.call(el, before + text + after);
            el.selectionStart = el.selectionEnd = start + text.length;
            el.dispatchEvent(new InputEvent('input', {
                bubbles: true, cancelable: true, inputType: 'insertText', data: text
            }));
            el.dispatchEvent(new Event('change', { bubbles: true }));
            return;
        }

        el.value += text;
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
    }

    /* ── 음성 인식 ── */
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { console.warn('[Voice Clipboard] SpeechRecognition not supported'); return; }

    let rec = null;
    let recording = false;
    let silenceTimer = null;
    let finalTranscript = '';

    function resetSilenceTimer() {
        clearTimeout(silenceTimer);
        silenceTimer = setTimeout(() => {
            if (recording) { showToast(getLang().silence); stopRec(); }
        }, SILENCE_MS);
    }

    function createRec() {
        const r = new SR();
        r.continuous = true;
        r.interimResults = true;
        r.lang = currentLang;

        r.onresult = (e) => {
            resetSilenceTimer();
            let interim = '';
            for (let i = e.resultIndex; i < e.results.length; i++) {
                const t = e.results[i][0].transcript;
                if (e.results[i].isFinal) {
                    const processed = dict(t);
                    finalTranscript += processed;
                    if (tgt) insertText(tgt, processed);
                    preview.classList.remove('vc-show');
                } else {
                    interim += t;
                }
            }
            if (interim) {
                preview.textContent = interim;
                preview.classList.add('vc-show');
            }
        };

        r.onspeechend = () => resetSilenceTimer();

        r.onerror = (e) => {
            if (e.error === 'no-speech') {
                showToast(getLang().noSpeech);
            } else if (e.error === 'not-allowed') {
                showToast('⚠️ 마이크 권한을 허용해주세요');
                stopRec();
            }
        };

        r.onend = () => {
            if (recording) { try { r.start(); } catch (_) { stopRec(); } }
        };

        return r;
    }

    function startRec() {
        if (recording) return;
        if (!tgt) { showToast('⚠️ 입력 필드를 먼저 클릭하세요'); return; }

        rec = createRec();
        recording = true;
        finalTranscript = '';
        mic.classList.add('vc-rec');
        mic.textContent = '⏹';
        showToast(getLang().start);
        resetSilenceTimer();

        if (location.hostname.includes('notion')) {
            document.querySelectorAll('[contenteditable]').forEach(el => {
                el.setAttribute('data-vc-ce', el.getAttribute('contenteditable'));
                el.setAttribute('contenteditable', 'false');
            });
        }

        try { rec.start(); } catch (e) {
            showToast('⚠️ 음성 인식 시작 실패');
            stopRec();
        }
    }

    function stopRec() {
        recording = false;
        clearTimeout(silenceTimer);
        mic.classList.remove('vc-rec');
        mic.textContent = '🎤';
        preview.classList.remove('vc-show');

        if (rec) { try { rec.stop(); } catch (_) { } rec = null; }

        if (location.hostname.includes('notion')) {
            document.querySelectorAll('[data-vc-ce]').forEach(el => {
                el.setAttribute('contenteditable', el.getAttribute('data-vc-ce'));
                el.removeAttribute('data-vc-ce');
            });
        }

        if (tgt) tgt.focus();
        resetHideTimer();
    }

    window.__vcStopRec = stopRec;

    /* ── 이벤트: 입력 필드 감지 ── */

    document.addEventListener('mousedown', (e) => {
        if (ours(e.target)) return;
        const el = directFind(e.target);
        if (el) {
            userClicked = true;
            tgt = el;
            setTimeout(() => show(el), 50);
        }
    }, true);

    document.addEventListener('click', (e) => {
        if (ours(e.target)) return;
        if (langRingOpen && !langRing.contains(e.target) && e.target !== mic) {
            closeLangRing();
        }
        const el = directFind(e.target);
        if (el) {
            userClicked = true;
            tgt = el;
            show(el);
        }
    }, true);

    document.addEventListener('focusin', (e) => {
        if (ours(e.target)) return;
        if (!userClicked) return;
        if (isIn(e.target)) { tgt = e.target; show(e.target); }
        else {
            const el = resolve(e.target);
            if (el) { tgt = el; show(el); }
        }
    }, true);

    const SITE_SELECTORS = [
        'input#query', 'input[name="query"]', 'input.search_input',
        'textarea[name="q"]', 'input[name="q"]',
        'input[title="검색"]', 'input[title="Search"]',
        'input[aria-label="검색"]', 'input[type="search"]',
        'textarea[aria-label="Search"]'
    ];

    let lastPollEl = null;
    setInterval(() => {
        if (!userClicked) return;

        let ae = document.activeElement;
        while (ae?.shadowRoot?.activeElement) ae = ae.shadowRoot.activeElement;

        if (ae && ae !== lastPollEl && ae !== document.body && ae !== document.documentElement && !ours(ae)) {
            if (isIn(ae)) {
                lastPollEl = ae; tgt = ae;
                if (!fl.classList.contains('vc-show')) show(ae);
            } else {
                const el = resolve(ae);
                if (el) { lastPollEl = el; tgt = el; if (!fl.classList.contains('vc-show')) show(el); }
            }
        }

        for (const sel of SITE_SELECTORS) {
            try {
                const el = document.querySelector(sel);
                if (el && el === document.activeElement && el !== lastPollEl) {
                    lastPollEl = el; tgt = el;
                    if (!fl.classList.contains('vc-show')) show(el);
                    break;
                }
            } catch (_) { }
        }
    }, 300);

    /* ── 버튼 클릭 ── */
    mic.addEventListener('click', (e) => {
        e.stopPropagation();
        e.preventDefault();
        if (langRingOpen) return;
        if (recording) stopRec(); else startRec();
    });

    /* ── 단축키 ── */
    document.addEventListener('keydown', (e) => {
        if (e.ctrlKey && e.shiftKey && e.code === 'KeyV') {
            e.preventDefault();
            if (recording) stopRec(); else startRec();
        }
    });

    /* ── 탭 비활성 ── */
    document.addEventListener('visibilitychange', () => {
        if (document.hidden && recording) stopRec();
    });

    /* ── 마이크 권한 iframe ── */
    (function injectMicPermission() {
        if (document.getElementById('vc-mic-iframe')) return;
        const iframe = document.createElement('iframe');
        iframe.id = 'vc-mic-iframe';
        iframe.setAttribute('hidden', 'hidden');
        iframe.setAttribute('allow', 'microphone');
        iframe.src = chrome.runtime.getURL('permission.html');
        iframe.style.cssText = 'display:none!important;width:0!important;height:0!important;border:none!important;position:fixed!important;top:-9999px!important;';
        document.body.appendChild(iframe);
    })();

    console.log(`[Voice Clipboard] v${VC_VER} loaded ✅`);
})();
