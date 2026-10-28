/**
 * StudyBuddy: Voice Controller
 * Encapsulates browser Web Speech API (SpeechSynthesis & SpeechRecognition)
 * and Canvas Audio Visualizer
 */

class VoiceController {
    constructor() {
        this.synth = window.speechSynthesis;
        this.SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        this.recognition = null;
        
        this.voices = [];
        this.selectedVoice = null;
        this.rate = 1.0;
        this.pitch = 1.0;
        
        this.isSpeaking = false;
        this.isListening = false;

        // Visualizer state: 'idle', 'speaking', 'listening'
        this.visualizerMode = 'idle';
        this.canvas = null;
        this.ctx = null;
        this.animFrameId = null;

        // Callbacks
        this.onTranscriptionUpdate = null;
        this.onTranscriptionFinal = null;
        this.onStateChange = null;

        // Multi-Reader Personas registry
        this.readers = VoiceController.VOICE_READERS;
        this.currentReaderId = localStorage.getItem('sb_voice_reader') || 'prof_dexter';
        this.customRate = parseFloat(localStorage.getItem('sb_voice_rate')) || 1.0;
        this.customPitch = parseFloat(localStorage.getItem('sb_voice_pitch')) || 1.0;

        this.initSpeechRecognition();
        this.initVoices();
    }

    static get VOICE_READERS() {
        return [
            {
                id: 'prof_dexter',
                name: 'Prof. Dexter',
                title: 'Academic Professor',
                tagline: 'Deep Conceptual & Theory Review',
                avatar: '👨‍🏫',
                icon: 'fa-graduation-cap',
                color: '#6366f1',
                gender: 'male',
                rate: 0.92,
                pitch: 0.88,
                description: 'Deliberate, articulate, and steady pace. Ideal for digesting complex computing architectures, definitions, and theory.',
                sampleText: "Greetings! I am Professor Dexter. Let's methodically review your computing architecture notes today."
            },
            {
                id: 'alex_coach',
                name: 'Alex',
                title: 'Energetic Exam Coach',
                tagline: 'Rapid Flashcards & Active Drills',
                avatar: '⚡',
                icon: 'fa-bolt',
                color: '#f59e0b',
                gender: 'energetic',
                rate: 1.15,
                pitch: 1.10,
                description: 'Upbeat, brisk, and motivational. Perfect for rapid-fire question drills, timed practice quizzes, and exam prep.',
                sampleText: "Let's go! I'm Alex, your study coach. Let's crush this recall session with high energy!"
            },
            {
                id: 'maya_calm',
                name: 'Maya',
                title: 'Calm & Relaxed Partner',
                tagline: 'Stress-Free & Late Night Review',
                avatar: '🌿',
                icon: 'fa-leaf',
                color: '#10b981',
                gender: 'female',
                rate: 0.90,
                pitch: 1.05,
                description: 'Gentle, soothing, and unhurried. Designed to lower test anxiety, maintain focus, and assist late-night study sessions.',
                sampleText: "Take a deep breath. I'm Maya. Let's calmly explore each concept step by step."
            },
            {
                id: 'sam_peer',
                name: 'Sam',
                title: 'Friendly Study Peer',
                tagline: 'Conversational Pair-Studying',
                avatar: '🤝',
                icon: 'fa-user-group',
                color: '#06b6d4',
                gender: 'any',
                rate: 1.00,
                pitch: 1.00,
                description: 'Natural, balanced, and conversational. Feels like reviewing your notes side-by-side with your closest classmate.',
                sampleText: "Hey there! I'm Sam. Ready to test what we both remember from today's lecture?"
            },
            {
                id: 'maria_ph',
                name: 'Maria',
                title: 'Philippine English Academic Voice',
                tagline: 'Localized Clarity & Clear Diction',
                avatar: '🇵🇭',
                icon: 'fa-sun',
                color: '#ec4899',
                gender: 'female_ph',
                rate: 0.96,
                pitch: 1.02,
                description: 'Clear, crisp English diction attuned to Philippine university students for maximum comprehension and retention.',
                sampleText: "Mabuhay! I am Maria. Let us review your reviewer notes with clear and precise English."
            },
            {
                id: 'custom_reader',
                name: 'Custom Reader',
                title: 'Personalized Tuner',
                tagline: 'Fully Customized Pitch & Speed',
                avatar: '🎛️',
                icon: 'fa-sliders',
                color: '#8b5cf6',
                gender: 'custom',
                rate: 1.00,
                pitch: 1.00,
                description: 'Tailor your own voice: select any browser voice and fine-tune your speed (0.7x-1.4x) and pitch to match your ear.',
                sampleText: "This is your customized voice reader configuration."
            }
        ];
    }

    getReaders() {
        return this.readers;
    }

    getCurrentReader() {
        return this.readers.find(r => r.id === this.currentReaderId) || this.readers[0];
    }

    setVoiceReader(readerId, customRate = null, customPitch = null) {
        const found = this.readers.find(r => r.id === readerId);
        if (found) {
            this.currentReaderId = readerId;
            localStorage.setItem('sb_voice_reader', readerId);
            if (customRate !== null) {
                this.customRate = parseFloat(customRate);
                localStorage.setItem('sb_voice_rate', this.customRate);
            }
            if (customPitch !== null) {
                this.customPitch = parseFloat(customPitch);
                localStorage.setItem('sb_voice_pitch', this.customPitch);
            }
            console.log(`[Voice] Activated Voice Reader: ${found.name} (${found.title})`);
            return found;
        }
        return this.getCurrentReader();
    }

    resolveVoiceForReader(reader) {
        if (!this.voices || this.voices.length === 0) return this.selectedVoice;

        const englishVoices = this.voices.filter(v => v.lang.startsWith('en'));
        const pool = englishVoices.length > 0 ? englishVoices : this.voices;

        if (reader.id === 'custom_reader' && this.selectedVoice) {
            return this.selectedVoice;
        }

        if (reader.id === 'maria_ph') {
            const phVoice = this.voices.find(v => v.lang.includes('PH') || v.lang.includes('fil') || v.name.toLowerCase().includes('philippine'));
            if (phVoice) return phVoice;
            const femaleEn = pool.find(v => /female|zira|jenny|samantha|victoria|susan|karen/i.test(v.name));
            if (femaleEn) return femaleEn;
        } else if (reader.gender === 'male' || reader.gender === 'energetic') {
            const maleVoice = pool.find(v => /male|david|george|mark|guy|james|charles|daniel/i.test(v.name));
            if (maleVoice) return maleVoice;
        } else if (reader.gender === 'female') {
            const femaleVoice = pool.find(v => /female|zira|jenny|samantha|victoria|susan|karen/i.test(v.name));
            if (femaleVoice) return femaleVoice;
        }

        const naturalVoice = pool.find(v => /natural|google|online/i.test(v.name));
        return naturalVoice || pool[0] || this.voices[0];
    }

    previewReader(readerId, onEndCallback = null) {
        const reader = this.readers.find(r => r.id === readerId) || this.getCurrentReader();
        this.speak(reader.sampleText, onEndCallback, reader);
    }

    initVoices() {
        if (!this.synth) {
            console.warn("[Voice] Web SpeechSynthesis not supported in this browser.");
            return;
        }

        const loadVoices = () => {
            this.voices = this.synth.getVoices();
            if (this.voices.length > 0) {
                // Prefer English voices (US, GB, or natural)
                const englishVoices = this.voices.filter(v => v.lang.startsWith('en'));
                const naturalVoice = englishVoices.find(v => v.name.includes('Natural') || v.name.includes('Google') || v.name.includes('Online'));
                this.selectedVoice = naturalVoice || englishVoices[0] || this.voices[0];
            }
            if (typeof this.onVoicesLoaded === 'function') {
                this.onVoicesLoaded(this.voices);
            }
        };

        loadVoices();
        if (speechSynthesis.onvoiceschanged !== undefined) {
            speechSynthesis.onvoiceschanged = loadVoices;
        }
    }

    initVisualizer(canvasElement) {
        return this.attachVisualizer(canvasElement);
    }

    cleanSpeechTranscript(text) {
        if (!text) return '';
        let cleaned = text.trim();
        // Remove conversational fillers and verbal hesitations that do not connect to the reviewer
        cleaned = cleaned.replace(/^(?:uhm|uh|um|err|ah|well|okay|so|wait|hold on|let me think|i think|i believe|basically|actually|you know|what is it|what's it called)[,\s]+/i, '');
        cleaned = cleaned.replace(/[,\s]+(?:that's it|i think|or something|yeah|that is all|i guess)[.?!,\s]*$/i, '');
        return cleaned.trim();
    }

    initSpeechRecognition() {
        if (!this.SpeechRecognition) {
            console.warn("[Voice] SpeechRecognition is not supported in this browser. (Use Chrome, Edge, or Safari)");
            return;
        }

        try {
            this.recognition = new this.SpeechRecognition();
            // Continuous listening so speech doesn't cut off after pauses
            this.recognition.continuous = true;
            this.recognition.interimResults = true;
            this.recognition.lang = 'en-US';
            this.accumulatedTranscript = '';
            this.shouldBeListening = false;
            this.customTranscriptionCallback = null;

            this.recognition.onstart = () => {
                this.isListening = true;
                this.setVisualizerMode('listening');
                if (this.onStateChange) this.onStateChange('listening');
            };

            this.recognition.onresult = (event) => {
                let interimTranscript = '';
                let finalTranscript = '';

                for (let i = event.resultIndex; i < event.results.length; ++i) {
                    const text = event.results[i][0].transcript;
                    if (event.results[i].isFinal) {
                        finalTranscript += text + ' ';
                    } else {
                        interimTranscript += text;
                    }
                }

                if (finalTranscript.trim()) {
                    this.accumulatedTranscript = (this.accumulatedTranscript ? this.accumulatedTranscript + ' ' : '') + finalTranscript.trim();
                }

                const fullTranscript = (this.accumulatedTranscript ? this.accumulatedTranscript + ' ' : '') + interimTranscript;
                const cleaned = this.cleanSpeechTranscript(fullTranscript) || fullTranscript;
                const isFinal = Boolean(finalTranscript.trim());

                if (this.customTranscriptionCallback) {
                    this.customTranscriptionCallback(cleaned, isFinal);
                } else if (this.onTranscriptionUpdate) {
                    this.onTranscriptionUpdate(cleaned, isFinal);
                }

                if (isFinal && this.onTranscriptionFinal) {
                    this.onTranscriptionFinal(this.cleanSpeechTranscript(this.accumulatedTranscript) || this.accumulatedTranscript);
                }
            };

            this.recognition.onerror = (event) => {
                console.warn("[Voice] Recognition error:", event.error);
                if (event.error === 'not-allowed') {
                    this.isListening = false;
                    this.shouldBeListening = false;
                    this.setVisualizerMode('idle');
                    if (this.onStateChange) this.onStateChange('error', 'not-allowed');
                } else if (event.error === 'no-speech') {
                    // In continuous mode, no-speech is a temporary timeout while student thinks
                    if (!this.shouldBeListening) {
                        this.isListening = false;
                        this.setVisualizerMode('idle');
                        if (this.onStateChange) this.onStateChange('idle');
                    }
                } else {
                    this.isListening = false;
                    this.setVisualizerMode('idle');
                    if (this.onStateChange) this.onStateChange('error', event.error);
                }
            };

            this.recognition.onend = () => {
                // If user did not explicitly stop, and should still be listening, automatically restart
                if (this.shouldBeListening) {
                    try {
                        this.recognition.start();
                        return;
                    } catch (e) {}
                }
                this.isListening = false;
                this.setVisualizerMode('idle');
                if (this.onStateChange) this.onStateChange('idle');
            };
        } catch (e) {
            console.error("[Voice] Failed to init SpeechRecognition:", e);
        }
    }

    speak(text, onEndCallback = null, readerOverride = null) {
        if (!this.synth) {
            if (onEndCallback) onEndCallback();
            return;
        }

        // Cancel ongoing speech or listening
        this.stopSpeaking();
        this.stopListening();

        const reader = readerOverride || this.getCurrentReader();
        const resolvedVoice = this.resolveVoiceForReader(reader);
        const effectiveRate = (reader.id === 'custom_reader') ? this.customRate : reader.rate;
        const effectivePitch = (reader.id === 'custom_reader') ? this.customPitch : reader.pitch;

        const cleanText = text.replace(/[*#_`]/g, '').trim();
        const utterance = new SpeechSynthesisUtterance(cleanText);
        
        if (resolvedVoice) utterance.voice = resolvedVoice;
        utterance.rate = effectiveRate;
        utterance.pitch = effectivePitch;

        utterance.onstart = () => {
            this.isSpeaking = true;
            this.setVisualizerMode('speaking');
            if (this.onStateChange) this.onStateChange('speaking');
        };

        utterance.onend = () => {
            this.isSpeaking = false;
            this.setVisualizerMode('idle');
            if (this.onStateChange) this.onStateChange('idle');
            if (onEndCallback) onEndCallback();
        };

        utterance.onerror = (err) => {
            console.warn("[Voice] Speech synthesis error:", err);
            this.isSpeaking = false;
            this.setVisualizerMode('idle');
            if (this.onStateChange) this.onStateChange('idle');
            if (onEndCallback) onEndCallback();
        };

        this.synth.speak(utterance);
    }

    stopSpeaking() {
        if (this.synth && this.synth.speaking) {
            this.synth.cancel();
            this.isSpeaking = false;
            this.setVisualizerMode('idle');
        }
    }

    async startListening(callback = null) {
        if (!this.recognition) {
            this.initSpeechRecognition();
        }

        if (!this.recognition) {
            console.warn("[Voice] Speech Recognition is not available in your browser.");
            if (this.onStateChange) this.onStateChange('error', 'not-supported');
            return false;
        }

        this.customTranscriptionCallback = callback;
        this.stopSpeaking();
        this.shouldBeListening = true;

        // Try to initialize live audio analyser for responsive visualizer wave
        if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia && !this.micStream) {
            try {
                const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                this.micStream = stream;
                if (!this.audioCtx) {
                    const AudioContext = window.AudioContext || window.webkitAudioContext;
                    if (AudioContext) this.audioCtx = new AudioContext();
                }
                if (this.audioCtx) {
                    if (this.audioCtx.state === 'suspended') {
                        await this.audioCtx.resume();
                    }
                    this.micSource = this.audioCtx.createMediaStreamSource(stream);
                    this.analyser = this.audioCtx.createAnalyser();
                    this.analyser.fftSize = 64;
                    this.micSource.connect(this.analyser);
                    this.audioDataArray = new Uint8Array(this.analyser.frequencyBinCount);
                }
            } catch (mediaErr) {
                console.warn("[Voice] AudioAnalyser media access note:", mediaErr);
                // Non-fatal: SpeechRecognition may still work natively
            }
        }

        try {
            this.recognition.start();
            this.isListening = true;
            this.setVisualizerMode('listening');
            if (this.onStateChange) this.onStateChange('listening');
            return true;
        } catch (e) {
            // If already active, treat as listening
            if (e.name === 'InvalidStateError') {
                this.isListening = true;
                this.setVisualizerMode('listening');
                if (this.onStateChange) this.onStateChange('listening');
                return true;
            }
            console.warn("[Voice] Recognition start error:", e);
            if (this.onStateChange) this.onStateChange('error', e.message || 'start-failed');
            return false;
        }
    }

    stopListening() {
        this.shouldBeListening = false;
        if (this.recognition) {
            try {
                this.recognition.stop();
            } catch (e) {}
        }

        // Clean up live mic stream
        if (this.micStream) {
            try {
                this.micStream.getTracks().forEach(t => t.stop());
            } catch (e) {}
            this.micStream = null;
        }
        if (this.micSource) {
            try { this.micSource.disconnect(); } catch (e) {}
            this.micSource = null;
        }

        this.isListening = false;
        this.setVisualizerMode('idle');
        if (this.onStateChange) this.onStateChange('idle');
    }

    toggleListening(callback = null) {
        if (this.isListening) {
            this.stopListening();
            return false;
        } else {
            return this.startListening(callback);
        }
    }

    /* ================= VISUALIZER CANVAS ================= */
    attachVisualizer(canvasElement) {
        this.canvas = canvasElement;
        this.ctx = canvasElement.getContext('2d');
        this.startVisualizerLoop();
    }

    setVisualizerMode(mode) {
        this.visualizerMode = mode;
    }

    startVisualizerLoop() {
        if (!this.canvas || !this.ctx) return;

        let step = 0;
        const numBars = 48;

        const render = () => {
            const width = this.canvas.width;
            const height = this.canvas.height;
            const centerY = height / 2;

            this.ctx.clearRect(0, 0, width, height);
            step += 0.05;

            const barWidth = (width / numBars) - 3;

            // If live analyser is available, query frequency data
            let liveMicAvg = 0;
            if (this.analyser && this.audioDataArray && this.visualizerMode === 'listening') {
                this.analyser.getByteFrequencyData(this.audioDataArray);
                let sum = 0;
                for (let j = 0; j < this.audioDataArray.length; j++) {
                    sum += this.audioDataArray[j];
                }
                liveMicAvg = sum / this.audioDataArray.length; // 0..255
            }

            for (let i = 0; i < numBars; i++) {
                let barHeight = 4; // base idle line

                if (this.visualizerMode === 'speaking') {
                    // Cyan/indigo dynamic wave
                    const wave1 = Math.sin(step * 3 + i * 0.25);
                    const wave2 = Math.cos(step * 2 + i * 0.4);
                    barHeight = Math.abs(wave1 * wave2) * (height * 0.75) + 6;
                } else if (this.visualizerMode === 'listening') {
                    if (this.analyser && this.audioDataArray) {
                        const freqIdx = Math.floor((i / numBars) * this.audioDataArray.length);
                        const val = this.audioDataArray[freqIdx] || liveMicAvg;
                        barHeight = Math.max(6, (val / 255) * (height * 0.9));
                    } else {
                        // Pulsing crimson/rose wave fallback
                        const pulse = Math.sin(step * 4 + i * 0.35);
                        barHeight = Math.abs(pulse) * (height * 0.85) + 8;
                    }
                } else {
                    // Idle gentle subtle ripple
                    const idle = Math.sin(step + i * 0.15);
                    barHeight = Math.abs(idle) * 6 + 4;
                }

                const x = i * (barWidth + 3);
                const y = centerY - barHeight / 2;

                // Color gradient depending on mode
                let gradient;
                if (this.visualizerMode === 'speaking') {
                    gradient = this.ctx.createLinearGradient(0, y, 0, y + barHeight);
                    gradient.addColorStop(0, '#06b6d4');
                    gradient.addColorStop(1, '#6366f1');
                } else if (this.visualizerMode === 'listening') {
                    gradient = this.ctx.createLinearGradient(0, y, 0, y + barHeight);
                    gradient.addColorStop(0, '#f43f5e');
                    gradient.addColorStop(1, '#fb7185');
                } else {
                    gradient = 'rgba(255, 255, 255, 0.12)';
                }

                this.ctx.fillStyle = gradient;
                this.ctx.beginPath();
                this.ctx.roundRect(x, y, barWidth, barHeight, 3);
                this.ctx.fill();
            }

            this.animFrameId = requestAnimationFrame(render);
        };

        render();
    }
}
