 import { initializeApp }                       from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
    import { getAuth, signInWithEmailAndPassword,
             createUserWithEmailAndPassword,
             signInWithPopup, GoogleAuthProvider,
             onAuthStateChanged }  from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

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

    document.getElementById("login_button_desktop")?.addEventListener('click', () => {
        window.location.href = "login.html";
    });

    document.getElementById("login_button_mobile")?.addEventListener('click', () => {
        window.location.href = "login.html";
    });

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
                micBtn.innerHTML = '<i class="fa-solid fa-circle text-red-500"></i>';
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
                micBtn.innerHTML = '<i class="fa-solid fa-microphone"></i>';
                if (micStatus) micStatus.classList.add('hidden');
            };
        } else {
            micBtn.style.display = 'none';
        }
    }

    const inspectionForm = document.getElementById('inspection_form');
    const saveBtn = document.getElementById('save_photo_button');
    const shareBtn = document.getElementById('shareBtn');
    let savedRecordData = null;

    function saveInspectionReport(event) {
        if (event) event.preventDefault();

        if (inspectionForm && !inspectionForm.checkValidity()) {
            inspectionForm.reportValidity();
            return;
        }

        if (damageNotes && damageNotes.value.trim().length < 5) {
            damageNotes.setCustomValidity('Please describe the damage in at least 5 characters.');
            damageNotes.reportValidity();
            damageNotes.setCustomValidity('');
            return;
        }

            if (!navigator.geolocation) {
                alert("Geolocation is not supported by your browser.");
                return;
            }

            saveBtn.innerHTML = '<i class="fa-solid fa-location-dot"></i> Getting location &amp; saving...';

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

                    saveBtn.innerHTML = '<i class="fa-solid fa-circle-check"></i> Saved Successfully!';
                    saveBtn.classList.replace('bg-blue-600', 'bg-green-600');
                    saveBtn.classList.replace('hover:bg-blue-700', 'hover:bg-green-700');
                    saveBtn.disabled = true;

                    
                    if (!document.getElementById('view_reports_btn')) {
                        const viewBtn = document.createElement('a');
                        viewBtn.id = 'view_reports_btn';
                        viewBtn.href = 'login.html?redirect=reports.html';
                        viewBtn.className = 'block w-full mt-2 text-center text-sm text-blue-600 font-semibold underline underline-offset-2 hover:text-blue-800 transition-colors';
                        viewBtn.innerHTML = '<i class="fa-solid fa-folder-open"></i> View All My Reports';
                        saveBtn.parentNode.insertBefore(viewBtn, saveBtn.nextSibling);
                    }

                    if (shareBtn) shareBtn.classList.remove('hidden');
                },
                (error) => {
                    console.error("Location error:", error);
                    alert("Could not get GPS location. Please check browser permissions.");
                    saveBtn.innerHTML = '<i class="fa-solid fa-location-dot"></i> Save Annotated Photo + Location + Notes';
                },
                { enableHighAccuracy: true }
            );
    }

    if (inspectionForm) {
        inspectionForm.addEventListener('submit', saveInspectionReport);
    } else if (saveBtn) {
        saveBtn.addEventListener('click', saveInspectionReport);
    }

    if (shareBtn) {
        shareBtn.addEventListener('click', async () => {
            if (!savedRecordData) {
                alert("Please save the report first.");
                return;
            }

            const shareText =
                `RentGuard Inspection Report\n` +
                `Damage: ${savedRecordData.notes || 'No notes'}\n` +
                `GPS: ${savedRecordData.latitude}, ${savedRecordData.longitude}\n` +
                `Recorded: ${savedRecordData.timestamp}`;

            if (navigator.share) {
                try {
                    
                    const response = await fetch(savedRecordData.image);
                    const blob = await response.blob();
                    const file = new File([blob], `RentGuard_Report_${savedRecordData.id}.jpg`, { type: 'image/jpeg' });

                    if (navigator.canShare && navigator.canShare({ files: [file] })) {
                        await navigator.share({ title: 'RentGuard Inspection Report', text: shareText, files: [file] });
                    } else {
                        
                        await navigator.share({ title: 'RentGuard Inspection Report', text: shareText });
                    }
                    console.log('Successfully shared report');
                } catch (error) {
                    if (error.name !== 'AbortError') {
                        console.error('Error sharing report:', error);
                    }
                }
            } else {
              
                try {
                    await navigator.clipboard.writeText(shareText);
                    alert('Report details copied to clipboard. You can paste and send it.');
                } catch {
                    alert(shareText);
                }
            }
        });
    }





    const STORAGE_KEY = 'rentguard_final_photos';

    function loadReports() {
        return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
    }

    function saveReports(reports) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(reports));
    }

    function formatDate(ts) {
        if (!ts) return 'Unknown time';
        return ts;
    }

    function mapsUrl(lat, lng) {
        return `https://www.google.com/maps?q=${lat},${lng}`;
    }

    function truncate(str, n) {
        if (!str) return 'No notes added.';
        return str.length > n ? str.slice(0, n) + '…' : str;
    }

    const reportsGrid = document.getElementById('reports_grid');

    if (reportsGrid) {
    let pendingDeleteId = null;

    
    const DELAY_CLASSES = [
        '[animation-delay:0.05s]',
        '[animation-delay:0.1s]',
        '[animation-delay:0.15s]',
        '[animation-delay:0.2s]',
        '[animation-delay:0.25s]',
        '[animation-delay:0.3s]',
    ];

    function renderReports() {
        const reports = loadReports();
        const grid = document.getElementById('reports_grid');
        const emptyState = document.getElementById('empty_state');
        const countLabel = document.getElementById('report_count_label');
        const clearAllBtn = document.getElementById('clear_all_btn');

        grid.innerHTML = '';

        if (reports.length === 0) {
            emptyState.classList.remove('hidden');
            emptyState.classList.add('flex');
            grid.classList.add('hidden');
            clearAllBtn.classList.add('hidden');
            clearAllBtn.classList.remove('flex');
            countLabel.textContent = '0 reports saved on this device';
            return;
        }

        emptyState.classList.add('hidden');
        emptyState.classList.remove('flex');
        grid.classList.remove('hidden');
        clearAllBtn.classList.remove('hidden');
        clearAllBtn.classList.add('flex');
        countLabel.textContent = `${reports.length} report${reports.length !== 1 ? 's' : ''} saved on this device`;

        
        const sorted = [...reports].reverse();

        sorted.forEach((report, idx) => {
            const card = document.createElement('div');
           
            const delayStyle = `animation-delay: ${idx * 0.05}s`;
            card.className = 'animate-slide-up bg-slate-800/70 border border-slate-700/60 rounded-2xl overflow-hidden shadow-xl hover:shadow-blue-900/20 hover:border-slate-500/60 transition-all duration-300 group flex flex-col';
            card.style.animationDelay = `${idx * 0.05}s`;

            const hasNotes = report.notes && report.notes.trim() !== '';
            const hasGPS = report.latitude != null && report.longitude != null;

            card.innerHTML = `
                <!-- Photo -->
                <div class="relative overflow-hidden bg-slate-900 aspect-video cursor-zoom-in" data-photo="${report.image}" id="photo_wrap_${report.id}">
                    <img
                        src="${report.image}"
                        alt="Inspection photo"
                        class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        loading="lazy"
                    >
                    <!-- Hover overlay -->
                    <div class="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-all flex items-center justify-center">
                        <div class="opacity-0 group-hover:opacity-100 transition-opacity w-10 h-10 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center border border-white/30">
                            <i class="fa-solid fa-magnifying-glass-plus text-white"></i>
                        </div>
                    </div>
                    <!-- Timestamp badge on image -->
                    <div class="absolute bottom-2 left-2">
                        <span class="inline-flex items-center gap-[5px] text-[0.72rem] font-semibold px-[10px] py-[3px] rounded-full bg-black/60 text-gray-200 backdrop-blur-sm border border-white/10">
                            <i class="fa-solid fa-clock text-blue-400"></i>
                            ${formatDate(report.timestamp)}
                        </span>
                    </div>
                </div>

                <!-- Body -->
                <div class="flex-1 flex flex-col p-4 gap-3">

                    <!-- Notes -->
                    <div class="flex-1">
                        <div class="flex items-center gap-1.5 mb-1">
                            <i class="fa-solid fa-note-sticky text-yellow-400 text-xs"></i>
                            <span class="text-gray-400 text-xs font-semibold uppercase tracking-wide">Damage Notes</span>
                        </div>
                        <p class="text-gray-200 text-sm leading-relaxed ${hasNotes ? '' : 'italic text-gray-500'}">
                            ${hasNotes ? truncate(report.notes, 120) : 'No notes added.'}
                        </p>
                    </div>

                    <!-- GPS -->
                    ${hasGPS ? `
                    <a href="${mapsUrl(report.latitude, report.longitude)}" target="_blank" rel="noopener"
                       class="flex items-center gap-2 text-xs text-blue-400 hover:text-blue-300 transition-colors bg-blue-950/40 hover:bg-blue-950/70 border border-blue-900/50 rounded-lg px-3 py-2 group/gps">
                        <i class="fa-solid fa-location-dot text-red-400 group-hover/gps:animate-bounce"></i>
                        <span class="font-mono">${report.latitude.toFixed(5)}, ${report.longitude.toFixed(5)}</span>
                        <i class="fa-solid fa-arrow-up-right-from-square ml-auto text-gray-500"></i>
                    </a>
                    ` : `
                    <div class="flex items-center gap-2 text-xs text-gray-600 bg-slate-900/40 border border-slate-700/40 rounded-lg px-3 py-2">
                        <i class="fa-solid fa-location-dot-slash"></i>
                        <span>No GPS location recorded</span>
                    </div>
                    `}

                    <!-- Actions -->
                    <div class="flex gap-2 pt-1">
                        <button data-id="${report.id}"
                            class="download-btn flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-slate-700 hover:bg-slate-600 text-gray-200 text-xs font-semibold transition-all border border-slate-600">
                            <i class="fa-solid fa-download text-green-400"></i> Download
                        </button>
                        <button data-id="${report.id}"
                            class="share-btn flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-slate-700 hover:bg-slate-600 text-gray-200 text-xs font-semibold transition-all border border-slate-600">
                            <i class="fa-solid fa-share-nodes text-blue-400"></i> Share
                        </button>
                        <button data-id="${report.id}"
                            class="delete-btn w-9 flex items-center justify-center py-2 rounded-xl bg-slate-700 hover:bg-red-900/50 text-red-400 text-xs font-semibold transition-all border border-slate-600 hover:border-red-800">
                            <i class="fa-solid fa-trash"></i>
                        </button>
                    </div>
                </div>
            `;

            grid.appendChild(card);
        });

       
        document.querySelectorAll('[data-photo]').forEach(wrap => {
            wrap.addEventListener('click', () => {
                const src = wrap.dataset.photo;
                document.getElementById('lightbox_img').src = src;
                const lb = document.getElementById('lightbox');
                lb.classList.remove('hidden');
                lb.classList.add('flex');
                document.body.style.overflow = 'hidden';
            });
        });

       
        document.querySelectorAll('.download-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const id = btn.dataset.id;
                const report = loadReports().find(r => String(r.id) === String(id));
                if (!report) return;
                const a = document.createElement('a');
                a.href = report.image;
                a.download = `RentGuard_Report_${id}.jpg`;
                a.click();
            });
        });

        
        document.querySelectorAll('.share-btn').forEach(btn => {
            btn.addEventListener('click', async () => {
                const id = btn.dataset.id;
                const report = loadReports().find(r => String(r.id) === String(id));
                if (!report) return;

                const shareText =
                    `RentGuard Inspection Report\n` +
                    `Damage: ${report.notes || 'No notes'}\n` +
                    `GPS: ${report.latitude ?? 'N/A'}, ${report.longitude ?? 'N/A'}\n` +
                    `Recorded: ${report.timestamp}`;

                if (navigator.share) {
                    try {
                        const response = await fetch(report.image);
                        const blob = await response.blob();
                        const file = new File([blob], `RentGuard_${id}.jpg`, { type: 'image/jpeg' });

                        if (navigator.canShare && navigator.canShare({ files: [file] })) {
                            await navigator.share({ title: 'RentGuard Inspection Report', text: shareText, files: [file] });
                        } else {
                            await navigator.share({ title: 'RentGuard Inspection Report', text: shareText });
                        }
                    } catch (err) {
                        if (err.name !== 'AbortError') {
                            console.error('Share failed:', err);
                        }
                    }
                } else {
                    try {
                        await navigator.clipboard.writeText(shareText);
                        alert('Report details copied to clipboard!');
                    } catch {
                        alert(shareText);
                    }
                }
            });
        });

        document.querySelectorAll('.delete-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                pendingDeleteId = btn.dataset.id;
                document.getElementById('delete_modal').classList.remove('hidden');
            });
        });
    }

    
    document.getElementById('lightbox_close').addEventListener('click', closeLightbox);
    document.getElementById('lightbox').addEventListener('click', (e) => {
        if (e.target === document.getElementById('lightbox')) closeLightbox();
    });
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') closeLightbox();
    });
    function closeLightbox() {
        const lb = document.getElementById('lightbox');
        lb.classList.add('hidden');
        lb.classList.remove('flex');
        document.body.style.overflow = '';
        document.getElementById('lightbox_img').src = '';
    }

    
    document.getElementById('delete_cancel_btn').addEventListener('click', () => {
        pendingDeleteId = null;
        document.getElementById('delete_modal').classList.add('hidden');
    });
    document.getElementById('delete_confirm_btn').addEventListener('click', () => {
        if (pendingDeleteId != null) {
            let reports = loadReports();
            reports = reports.filter(r => String(r.id) !== String(pendingDeleteId));
            saveReports(reports);
            pendingDeleteId = null;
        }
        document.getElementById('delete_modal').classList.add('hidden');
        renderReports();
    });

    
    document.getElementById('clear_all_btn').addEventListener('click', () => {
        if (confirm('Delete ALL saved inspection reports from this device? This cannot be undone.')) {
            localStorage.removeItem(STORAGE_KEY);
            renderReports();
        }
    });

    
    renderReports();
    }

   

   
    const firebaseConfig = {
      apiKey:            "AIzaSyD8_Uo1PGq730v-tF9Q_X2ahYNYtUhD3Hc",
      authDomain:        "hidden-server-307712.firebaseapp.com",
      projectId:         "hidden-server-307712",
      storageBucket:     "hidden-server-307712.firebasestorage.app",
      messagingSenderId: "416495131326",
      appId:             "1:416495131326:web:86fe6b30b6e415f84fdcef"
    };

 
    const app  = initializeApp(firebaseConfig);
    const auth = getAuth(app);

    const googleProvider = new GoogleAuthProvider();

    const isReportsPage = window.location.pathname.endsWith("reports.html");
    if (isReportsPage) {
      onAuthStateChanged(auth, (user) => {
        if (user) {
          sessionStorage.setItem("rentguard_logged_in", "true");
          return;
        }

        if (sessionStorage.getItem("rentguard_logged_in") !== "true") {
          window.location.replace("login.html?redirect=reports.html");
        }
      });
    }


    
    function showAlert(message, type) {
      const box = document.getElementById("alert-box");
      box.textContent = message;
      box.className = [
        "mb-5 px-4 py-3 rounded-lg text-sm font-medium",
        type === "success"
          ? "bg-green-50 text-green-700 border border-green-200"
          : "bg-red-50 text-red-700 border border-red-200"
      ].join(" ");
    }

    
    function hideAlert() {
      document.getElementById("alert-box").className = "hidden";
    }

    
    function setLoading(btnId, loading) {
      const btn     = document.getElementById(btnId);
      const spinner = document.getElementById(btnId + "-spinner");

      btn.disabled = loading;
      spinner.classList.toggle("hidden", !loading);

      
      btn.classList.toggle("opacity-70", loading);
      btn.classList.toggle("cursor-not-allowed", loading);
    }

  
    function goToDashboard() {
      sessionStorage.setItem("rentguard_logged_in", "true");

      const params = new URLSearchParams(window.location.search);
      const redirect = params.get("redirect");
      window.location.href = redirect === "reports.html" ? redirect : "reports.html";
    }

    function getFirebaseErrorMessage(code) {
      const messages = {
        "auth/invalid-email":          "That doesn't look like a valid email address.",
        "auth/user-not-found":         "No account found with that email.",
        "auth/wrong-password":         "Incorrect password. Please try again.",
        "auth/invalid-credential":     "Incorrect email or password.",
        "auth/email-already-in-use":   "An account with this email already exists.",
        "auth/weak-password":          "Password must be at least 6 characters.",
        "auth/too-many-requests":      "Too many attempts. Please wait a moment and try again.",
        "auth/popup-closed-by-user":   "Google sign-in was cancelled.",
        "auth/network-request-failed": "Network error. Check your internet connection.",
      };
      return messages[code] || "Something went wrong. Please try again.";
    }


   
    window.handleLogin = async function (event) {
      event.preventDefault();   
      hideAlert();

      
      const email    = document.getElementById("login-email").value.trim();
      const password = document.getElementById("login-password").value;

     
      if (!email || !password) {
        showAlert("Please fill in both fields.", "error");
        return;
      }

      setLoading("btn-login", true); 

      try {
      
        await signInWithEmailAndPassword(auth, email, password);

       
        goToDashboard();

      } catch (error) {
       
        showAlert(getFirebaseErrorMessage(error.code), "error");
        setLoading("btn-login", false); 
      }
    };

    window.handleSignUp = async function (event) {
      event.preventDefault();
      hideAlert();

      const email    = document.getElementById("signup-email").value.trim();
      const password = document.getElementById("signup-password").value;

      if (!email || !password) {
        showAlert("Please fill in both fields.", "error");
        return;
      }

      if (password.length < 6) {
        showAlert("Password must be at least 6 characters.", "error");
        return;
      }

      setLoading("btn-signup", true);

      try {
        
        await createUserWithEmailAndPassword(auth, email, password);

      
        showAlert("Account created! You can now log in.", "success");
        setLoading("btn-signup", false);

        
        document.getElementById("signup-email").value    = "";
        document.getElementById("signup-password").value = "";

       
        setTimeout(() => {
          switchTab("login");
        }, 1500);

      } catch (error) {
        showAlert(getFirebaseErrorMessage(error.code), "error");
        setLoading("btn-signup", false);
      }
    };

    
    window.handleGoogleSignIn = async function () {
      hideAlert();

      try {
     
        await signInWithPopup(auth, googleProvider);

       
        goToDashboard();

      } catch (error) {
        showAlert(getFirebaseErrorMessage(error.code), "error");
      }
    };

  
  
   
    function switchTab(tabName) {
    
      document.querySelectorAll(".tab-content").forEach(panel => {
        panel.classList.remove("active");
      });

    
      document.querySelectorAll(".tab-btn").forEach(btn => {
        btn.classList.remove("text-brand-600", "border-brand-600");
        btn.classList.add("text-slate-400", "border-transparent");
      });

     
      document.getElementById("content-" + tabName).classList.add("active");

     
      const activeBtn = document.getElementById("tab-" + tabName);
      activeBtn.classList.add("text-brand-600", "border-brand-600");
      activeBtn.classList.remove("text-slate-400", "border-transparent");

    
      document.getElementById("alert-box").className = "hidden";
    }
});

