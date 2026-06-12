document.addEventListener('DOMContentLoaded', () => {

    const mobileMenuBtn = document.getElementById('mobile_menu_btn');
    const mobileMenu = document.getElementById('mobile_menu');

    if (mobileMenuBtn && mobileMenu) {
        mobileMenuBtn.addEventListener('click', () => {
            mobileMenu.classList.toggle('hidden');
        });


        const mobileMenuLinks = mobileMenu.querySelectorAll('a, button');
        mobileMenuLinks.forEach(link => {
            link.addEventListener('click', () => {
                mobileMenu.classList.add('hidden');
            });
        });
    }

    const cameraOverlay = document.getElementById('camera_overlay');
    const closeCameraBtn = document.getElementById('close_camera_btn');

    function closeCamera() {
        const video = document.getElementById('video');
        if (video && video.srcObject) {
            video.srcObject.getTracks().forEach(track => track.stop());
            video.srcObject = null;
        }
        if (cameraOverlay) cameraOverlay.style.display = 'none';
        document.body.style.overflow = '';
    }


    const inspectionBtns = document.querySelectorAll('.inspection_button');
    inspectionBtns.forEach(inspectionBtn => {
        inspectionBtn.addEventListener('click', async () => {
            if (!cameraOverlay) return;
            const video = document.getElementById('video');
            try {
                const stream = await navigator.mediaDevices.getUserMedia({
                    video: { facingMode: 'environment' },
                    audio: false
                });
                video.srcObject = stream;
                cameraOverlay.style.display = 'flex';
                document.body.style.overflow = 'hidden';
            } catch (error) {
                console.error("Camera access denied:", error);
                alert("Could not access the camera. Please allow camera permissions and try again.");
            }
        });
    });


    if (closeCameraBtn) {
        closeCameraBtn.addEventListener('click', closeCamera);
    }


    const captureBtn = document.getElementById('capture_button');
    if (captureBtn) {
        captureBtn.addEventListener('click', () => {
            const video = document.getElementById('video');
            const canvas = document.getElementById('hidden_canvas');

            if (!video || !video.srcObject) {
                alert("Camera is not active. Please start the inspection first.");
                return;
            }

            const ctx = canvas.getContext('2d');
            canvas.width = video.videoWidth || 640;
            canvas.height = video.videoHeight || 480;
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

           
            const now = new Date();
            const timestampText = now.toLocaleString('en-IN'); 

           
            ctx.font = "bold 24px Arial";     
            ctx.fillStyle = "#FFD700";        
            ctx.textAlign = "right";           
            ctx.textBaseline = "bottom";       

            
            ctx.shadowColor = "black";
            ctx.shadowBlur = 5;
            ctx.shadowOffsetX = 2;
            ctx.shadowOffsetY = 2;

           
            const padding = 20;
            ctx.fillText(`RentGuard Verified: ${timestampText}`, canvas.width - padding, canvas.height - padding);

            const photoData = canvas.toDataURL('image/jpeg', 0.8);
            sessionStorage.setItem('temp_photo', photoData);


            closeCamera();
            window.location.href = 'camera.html';
        });
    }


    const annotationCanvas = document.getElementById('annotation_canvas');
    if (annotationCanvas) {
        const ctx = annotationCanvas.getContext('2d');
        let currentTool = 'draw';
        let currentColor = '#ef4444';
        let strokeSize = 4;
        let isDrawing = false;
        let startX = 0, startY = 0;
        let previewBaseState = null;
        const undoStack = [];
        const MAX_UNDO = 20;
        let baseImage = null;


        const tempPhotoData = sessionStorage.getItem('temp_photo');
        if (tempPhotoData) {
            baseImage = new Image();
            baseImage.onload = () => {
                annotationCanvas.width = baseImage.naturalWidth;
                annotationCanvas.height = baseImage.naturalHeight;
                ctx.drawImage(baseImage, 0, 0);
            };
            baseImage.src = tempPhotoData;
        } else {
            alert('No photo found! Redirecting to camera.');
            window.location.href = 'index.html';
        }


        function saveUndo(snapshot) {
            undoStack.push(snapshot || ctx.getImageData(0, 0, annotationCanvas.width, annotationCanvas.height));
            if (undoStack.length > MAX_UNDO) undoStack.shift();
        }


        function getPos(e) {
            const rect = annotationCanvas.getBoundingClientRect();
            const scaleX = annotationCanvas.width / rect.width;
            const scaleY = annotationCanvas.height / rect.height;
            const src = e.touches ? e.touches[0] : e;
            return {
                x: (src.clientX - rect.left) * scaleX,
                y: (src.clientY - rect.top) * scaleY
            };
        }

        function applyStyle() {
            ctx.strokeStyle = currentColor;
            ctx.lineWidth = strokeSize;
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
            ctx.shadowColor = 'rgba(0,0,0,0.35)';
            ctx.shadowBlur = 3;
        }

        function drawEllipse(x1, y1, x2, y2) {
            const rx = Math.abs(x2 - x1) / 2 || 1;
            const ry = Math.abs(y2 - y1) / 2 || 1;
            const cx = (x1 + x2) / 2;
            const cy = (y1 + y2) / 2;
            ctx.beginPath();
            ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
            ctx.stroke();
        }

        function drawArrow(x1, y1, x2, y2) {
            const angle = Math.atan2(y2 - y1, x2 - x1);
            const headLen = Math.max(24, strokeSize * 5);
            ctx.beginPath();
            ctx.moveTo(x1, y1);
            ctx.lineTo(x2, y2);
            ctx.lineTo(x2 - headLen * Math.cos(angle - Math.PI / 6), y2 - headLen * Math.sin(angle - Math.PI / 6));
            ctx.moveTo(x2, y2);
            ctx.lineTo(x2 - headLen * Math.cos(angle + Math.PI / 6), y2 - headLen * Math.sin(angle + Math.PI / 6));
            ctx.stroke();
        }


        const INACTIVE_BTN = ['border-gray-600', 'text-gray-300'];
        const ACTIVE_BTN = ['bg-blue-800', 'text-white', 'border-blue-800'];

        function setTool(tool) {
            currentTool = tool;
            document.querySelectorAll('.tool-btn').forEach(btn => {

                btn.classList.remove(...ACTIVE_BTN);
                btn.classList.add(...INACTIVE_BTN);
            });
            const activeBtn = document.getElementById(`tool_${tool}`);
            if (activeBtn) {
                activeBtn.classList.remove(...INACTIVE_BTN);
                activeBtn.classList.add(...ACTIVE_BTN);
            }
        }
        document.getElementById('tool_draw')?.addEventListener('click', () => setTool('draw'));
        document.getElementById('tool_circle')?.addEventListener('click', () => setTool('circle'));
        document.getElementById('tool_arrow')?.addEventListener('click', () => setTool('arrow'));


        const SWATCH_ACTIVE = ['scale-125', 'ring-2', 'ring-offset-2', 'ring-offset-slate-900'];
        const SWATCH_INACTIVE = ['scale-100'];

        const ringClassMap = {
            '#ef4444': 'ring-red-500',
            '#facc15': 'ring-yellow-400',
            '#22c55e': 'ring-green-500',
            '#60a5fa': 'ring-blue-400',
            '#ffffff': 'ring-white',
        };

        let activeSwatch = document.querySelector('.color-swatch.scale-125');
        document.querySelectorAll('.color-swatch').forEach(swatch => {
            swatch.addEventListener('click', () => {

                if (activeSwatch) {
                    const oldRing = ringClassMap[activeSwatch.dataset.color];
                    activeSwatch.classList.remove(...SWATCH_ACTIVE, oldRing);
                    activeSwatch.classList.add('scale-100');
                }

                currentColor = swatch.dataset.color;
                const newRing = ringClassMap[currentColor] || 'ring-white';
                swatch.classList.remove('scale-100');
                swatch.classList.add(...SWATCH_ACTIVE, newRing);
                activeSwatch = swatch;
            });
        });


        const strokeSlider = document.getElementById('stroke_size');
        const strokeLabel = document.getElementById('stroke_size_label');
        strokeSlider?.addEventListener('input', (e) => {
            strokeSize = parseInt(e.target.value);
            if (strokeLabel) strokeLabel.textContent = strokeSize;
        });


        document.getElementById('undo_btn')?.addEventListener('click', () => {
            if (undoStack.length > 0) {
                ctx.putImageData(undoStack.pop(), 0, 0);
            }
        });


        document.getElementById('clear_btn')?.addEventListener('click', () => {
            if (!baseImage) return;
            if (confirm('Clear all annotations and restore the original photo?')) {
                undoStack.length = 0;
                ctx.clearRect(0, 0, annotationCanvas.width, annotationCanvas.height);
                ctx.drawImage(baseImage, 0, 0);
            }
        });


        function onStart(e) {
            e.preventDefault();
            const { x, y } = getPos(e);
            startX = x;
            startY = y;
            isDrawing = true;


            const snapshot = ctx.getImageData(0, 0, annotationCanvas.width, annotationCanvas.height);
            saveUndo(snapshot);
            previewBaseState = snapshot;

            applyStyle();
            if (currentTool === 'draw') {
                ctx.beginPath();
                ctx.moveTo(x, y);
            }
        }

        function onMove(e) {
            if (!isDrawing) return;
            e.preventDefault();
            const { x, y } = getPos(e);

            if (currentTool === 'draw') {
                ctx.lineTo(x, y);
                ctx.stroke();
            } else {

                ctx.putImageData(previewBaseState, 0, 0);
                applyStyle();
                if (currentTool === 'circle') drawEllipse(startX, startY, x, y);
                else if (currentTool === 'arrow') drawArrow(startX, startY, x, y);
            }
        }

        function onEnd(e) {
            if (!isDrawing) return;
            e.preventDefault();
            isDrawing = false;
        }


        annotationCanvas.addEventListener('mousedown', onStart);
        annotationCanvas.addEventListener('mousemove', onMove);
        annotationCanvas.addEventListener('mouseup', onEnd);
        annotationCanvas.addEventListener('mouseleave', onEnd);


        annotationCanvas.addEventListener('touchstart', onStart, { passive: false });
        annotationCanvas.addEventListener('touchmove', onMove, { passive: false });
        annotationCanvas.addEventListener('touchend', onEnd, { passive: false });
    }

    const micBtn = document.getElementById('micBtn');
    const damageNotes = document.getElementById('damageNotes');
    const micStatus = document.getElementById('micStatus');
    let isRecording = false;

    if (micBtn && damageNotes) {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (SpeechRecognition) {
            const recognition = new SpeechRecognition();
            recognition.continuous = false;
            recognition.interimResults = true;
            recognition.lang = 'en-IN';

            micBtn.addEventListener('click', () => {
                if (isRecording) recognition.stop();
                else recognition.start();
            });

            recognition.onstart = () => {
                isRecording = true;
                micBtn.innerHTML = '🔴';
                if (micStatus) micStatus.classList.remove('hidden');
            };

            recognition.onresult = (event) => {
                let currentTranscript = '';
                for (let i = event.resultIndex; i < event.results.length; i++) {
                    currentTranscript += event.results[i][0].transcript;
                }

                const existingText = damageNotes.value.trim();
                if (event.results[0].isFinal && existingText !== '') {
                    damageNotes.value = existingText + ' ' + currentTranscript;
                } else {
                    damageNotes.value = currentTranscript;
                }
            };

            recognition.onend = () => {
                isRecording = false;
                micBtn.innerHTML = '🎙️';
                if (micStatus) micStatus.classList.add('hidden');
            };
        } else {
            micBtn.style.display = 'none';
        }
    }

    const saveBtn = document.getElementById('save_photo_button');
    const shareBtn = document.getElementById('shareBtn');
    let savedRecordData = null;

    if (saveBtn) {
        saveBtn.addEventListener('click', () => {
            if (!navigator.geolocation) {
                alert("Geolocation is not supported by your browser.");
                return;
            }

            saveBtn.innerText = "📍 Getting location & saving...";

            navigator.geolocation.getCurrentPosition(
                (position) => {

                    const annotCanvas = document.getElementById('annotation_canvas');
                    const annotatedImage = annotCanvas
                        ? annotCanvas.toDataURL('image/jpeg', 0.92)
                        : sessionStorage.getItem('temp_photo');

                    savedRecordData = {
                        id: Date.now(),
                        image: annotatedImage,
                        notes: damageNotes ? damageNotes.value : "",
                        latitude: position.coords.latitude,
                        longitude: position.coords.longitude,
                        timestamp: new Date().toLocaleString()
                    };

                    let savedGallery = JSON.parse(localStorage.getItem('rentguard_final_photos')) || [];
                    savedGallery.push(savedRecordData);
                    localStorage.setItem('rentguard_final_photos', JSON.stringify(savedGallery));

                    sessionStorage.removeItem('temp_photo');

                    saveBtn.innerText = "✅ Saved Successfully!";
                    saveBtn.classList.replace('bg-blue-600', 'bg-green-600');
                    saveBtn.classList.replace('hover:bg-blue-700', 'hover:bg-green-700');
                    saveBtn.disabled = true;

                    // Insert "View All Reports" link below save button
                    if (!document.getElementById('view_reports_btn')) {
                        const viewBtn = document.createElement('a');
                        viewBtn.id = 'view_reports_btn';
                        viewBtn.href = 'reports.html';
                        viewBtn.className = 'block w-full mt-2 text-center text-sm text-blue-600 font-semibold underline underline-offset-2 hover:text-blue-800 transition-colors';
                        viewBtn.textContent = '📂 View All My Reports →';
                        saveBtn.parentNode.insertBefore(viewBtn, saveBtn.nextSibling);
                    }

                    if (shareBtn) shareBtn.classList.remove('hidden');
                },
                (error) => {
                    console.error("Location error:", error);
                    alert("Could not get GPS location. Please check browser permissions.");
                    saveBtn.innerText = "Save Photo + Location + Notes";
                },
                { enableHighAccuracy: true }
            );
        });
    }

    if (shareBtn) {
        shareBtn.addEventListener('click', async () => {
            if (!savedRecordData) {
                alert("Please save the report first.");
                return;
            }

            const shareText =
                `📋 RentGuard Inspection Report\n` +
                `🗒️ Damage: ${savedRecordData.notes || 'No notes'}\n` +
                `📍 GPS: ${savedRecordData.latitude}, ${savedRecordData.longitude}\n` +
                `🕐 Recorded: ${savedRecordData.timestamp}`;

            if (navigator.share) {
                try {
                    // Attempt to share the annotated photo as an actual image file
                    const response = await fetch(savedRecordData.image);
                    const blob = await response.blob();
                    const file = new File([blob], `RentGuard_Report_${savedRecordData.id}.jpg`, { type: 'image/jpeg' });

                    if (navigator.canShare && navigator.canShare({ files: [file] })) {
                        await navigator.share({ title: 'RentGuard Inspection Report', text: shareText, files: [file] });
                    } else {
                        // Fallback: share text only (no broken URL)
                        await navigator.share({ title: 'RentGuard Inspection Report', text: shareText });
                    }
                    console.log('Successfully shared report');
                } catch (error) {
                    if (error.name !== 'AbortError') {
                        console.error('Error sharing report:', error);
                    }
                }
            } else {
                // Clipboard fallback
                try {
                    await navigator.clipboard.writeText(shareText);
                    alert('📋 Report details copied to clipboard! You can paste and send it.');
                } catch {
                    alert(shareText);
                }
            }
        });
    }
});