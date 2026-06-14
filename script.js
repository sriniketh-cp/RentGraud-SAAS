let currentTool = 'draw';
let currentColor = '#ef4444';
let strokeSize = 4;
let isRecording = false;
let recognition = null;
let savedRecordData = null;
let activeSwatch = null;
let drawingPhase = 'idle';
let startX = 0;
let startY = 0;
let previewBaseState = null;
let baseImage = null;
let pendingDeleteId = null;
const undoStack = [];
const MAX_UNDO = 20;
const STORAGE_KEY = 'rentguard_final_photos';

const ringClassMap = {
    '#ef4444': 'ring-red-500',
    '#facc15': 'ring-yellow-400',
    '#22c55e': 'ring-green-500',
    '#60a5fa': 'ring-blue-400',
    '#ffffff': 'ring-white'
};

function getCanvasEl() {
    return document.getElementById('annotation_canvas');
}

function getAnnotationCtx() {
    const canvas = getCanvasEl();
    return canvas ? canvas.getContext('2d') : null;
}

function updateCanvasStatus(message) {
    const element = document.getElementById('canvas_status');
    if (element) element.textContent = message;
}

function updateStrokeLabel() {
    const label = document.getElementById('stroke_size_label');
    if (label) label.textContent = String(strokeSize);
}

function toggleMobileMenu() {
    const mobileMenu = document.getElementById('mobile_menu');
    if (mobileMenu) mobileMenu.classList.toggle('hidden');
}

function closeMobileMenu() {
    const mobileMenu = document.getElementById('mobile_menu');
    if (mobileMenu) mobileMenu.classList.add('hidden');
}

function closeCamera() {
    const video = document.getElementById('video');
    if (video && video.srcObject) {
        video.srcObject.getTracks().forEach(function (track) {
            track.stop();
        });
        video.srcObject = null;
    }

    const overlay = document.getElementById('camera_overlay');
    if (overlay) overlay.style.display = 'none';
    document.body.style.overflow = '';
}

async function openCamera() {
    const overlay = document.getElementById('camera_overlay');
    const video = document.getElementById('video');
    if (!overlay || !video) return;

    try {
        const stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: 'environment' },
            audio: false
        });

        video.srcObject = stream;
        overlay.style.display = 'flex';
        document.body.style.overflow = 'hidden';
    } catch (error) {
        console.error('Camera access denied:', error);
        alert('Could not access the camera. Please allow camera permissions and try again.');
    }
}

function capturePhoto() {
    const video = document.getElementById('video');
    const canvas = document.getElementById('hidden_canvas');

    if (!video || !video.srcObject || !canvas) {
        alert('Camera is not active. Please start the inspection first.');
        return;
    }

    const ctx = canvas.getContext('2d');
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    const timestampText = new Date().toLocaleString('en-IN');
    ctx.font = 'bold 24px Arial';
    ctx.fillStyle = '#FFD700';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'bottom';
    ctx.shadowColor = 'black';
    ctx.shadowBlur = 5;
    ctx.shadowOffsetX = 2;
    ctx.shadowOffsetY = 2;
    ctx.fillText('RentGuard Verified: ' + timestampText, canvas.width - 20, canvas.height - 20);

    sessionStorage.setItem('temp_photo', canvas.toDataURL('image/jpeg', 0.8));
    closeCamera();
    window.location.href = 'camera.html';
}

function savePhoto() {
    capturePhoto();
}

async function initAnnotationCanvas() {
    const canvas = getCanvasEl();
    if (!canvas) return;

    const tempPhotoData = sessionStorage.getItem('temp_photo');
    if (!tempPhotoData) {
        alert('No photo found! Redirecting to camera.');
        window.location.href = 'index.html';
        return;
    }

    baseImage = new Image();
    baseImage.src = tempPhotoData;

    try {
        if (baseImage.decode) {
            await baseImage.decode();
        } else if (!baseImage.complete || !baseImage.naturalWidth) {
            return;
        }
    } catch (error) {
        console.error('Failed to load inspection photo:', error);
        return;
    }

    canvas.width = baseImage.naturalWidth;
    canvas.height = baseImage.naturalHeight;
    const ctx = getAnnotationCtx();
    if (ctx) ctx.drawImage(baseImage, 0, 0);
}

function saveUndo() {
    const canvas = getCanvasEl();
    const ctx = getAnnotationCtx();
    if (!canvas || !ctx) return;

    undoStack.push(ctx.getImageData(0, 0, canvas.width, canvas.height));
    if (undoStack.length > MAX_UNDO) undoStack.shift();
}

function getPos(event) {
    const canvas = getCanvasEl();
    if (!canvas) return { x: 0, y: 0 };

    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    return {
        x: (event.clientX - rect.left) * scaleX,
        y: (event.clientY - rect.top) * scaleY
    };
}

function applyStyle(ctx) {
    ctx.strokeStyle = currentColor;
    ctx.lineWidth = strokeSize;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.shadowColor = 'rgba(0,0,0,0.35)';
    ctx.shadowBlur = 3;
}

function drawEllipseShape(ctx, x1, y1, x2, y2) {
    const rx = Math.abs(x2 - x1) / 2 || 1;
    const ry = Math.abs(y2 - y1) / 2 || 1;
    ctx.beginPath();
    ctx.ellipse((x1 + x2) / 2, (y1 + y2) / 2, rx, ry, 0, 0, Math.PI * 2);
    ctx.stroke();
}

function drawArrowShape(ctx, x1, y1, x2, y2) {
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

function canvasClick(event) {
    const canvas = getCanvasEl();
    const ctx = getAnnotationCtx();
    if (!canvas || !ctx) return;

    const position = getPos(event);

    if (currentTool === 'draw') {
        saveUndo();
        applyStyle(ctx);
        ctx.beginPath();
        ctx.arc(position.x, position.y, strokeSize / 2, 0, Math.PI * 2);
        ctx.fillStyle = currentColor;
        ctx.fill();
        return;
    }

    if (drawingPhase === 'idle') {
        saveUndo();
        previewBaseState = ctx.getImageData(0, 0, canvas.width, canvas.height);
        startX = position.x;
        startY = position.y;
        drawingPhase = 'started';

        applyStyle(ctx);
        ctx.beginPath();
        ctx.arc(position.x, position.y, 5, 0, Math.PI * 2);
        ctx.fillStyle = currentColor;
        ctx.fill();

        updateCanvasStatus(currentTool === 'circle' ? 'Circle: start point set. Click again to place end point.' : 'Arrow: start point set. Click again to place end point.');
        return;
    }

    ctx.putImageData(previewBaseState, 0, 0);
    applyStyle(ctx);

    if (currentTool === 'circle') {
        drawEllipseShape(ctx, startX, startY, position.x, position.y);
    } else if (currentTool === 'arrow') {
        drawArrowShape(ctx, startX, startY, position.x, position.y);
    }

    drawingPhase = 'idle';
    updateCanvasStatus('');
}

function setTool(tool) {
    currentTool = tool;
    drawingPhase = 'idle';
    updateCanvasStatus('');

    const inactiveClasses = ['border-gray-600', 'text-gray-300'];
    const activeClasses = ['bg-blue-800', 'text-white', 'border-blue-800'];

    document.querySelectorAll('.tool-btn').forEach(function (button) {
        button.classList.remove.apply(button.classList, activeClasses);
        button.classList.add.apply(button.classList, inactiveClasses);
    });

    const activeButton = document.getElementById('tool_' + tool);
    if (activeButton) {
        activeButton.classList.remove.apply(activeButton.classList, inactiveClasses);
        activeButton.classList.add.apply(activeButton.classList, activeClasses);
    }
}

function setColor(swatchEl, color) {
    if (!swatchEl || !color) return;

    const activeClasses = ['scale-125', 'ring-2', 'ring-offset-2', 'ring-offset-slate-900'];

    if (activeSwatch) {
        activeSwatch.classList.remove.apply(activeSwatch.classList, activeClasses.concat(ringClassMap[activeSwatch.dataset.color] || 'ring-white'));
        activeSwatch.classList.add('scale-100');
    }

    currentColor = color;
    swatchEl.classList.remove('scale-100');
    swatchEl.classList.add.apply(swatchEl.classList, activeClasses.concat(ringClassMap[color] || 'ring-white'));
    activeSwatch = swatchEl;
}

function setColorByValue(color) {
    const swatch = document.querySelector('.color-swatch[data-color="' + color + '"]');
    if (swatch) setColor(swatch, color);
}

function increaseStroke() {
    strokeSize = Math.min(strokeSize + 2, 30);
    updateStrokeLabel();
}

function decreaseStroke() {
    strokeSize = Math.max(strokeSize - 2, 2);
    updateStrokeLabel();
}

function undoAnnotation() {
    const ctx = getAnnotationCtx();
    if (undoStack.length > 0 && ctx) ctx.putImageData(undoStack.pop(), 0, 0);
}

function clearAnnotations() {
    const canvas = getCanvasEl();
    const ctx = getAnnotationCtx();
    if (!baseImage || !canvas || !ctx) return;

    if (confirm('Clear all annotations and restore the original photo?')) {
        undoStack.length = 0;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(baseImage, 0, 0);
    }
}



function saveReport() {
    const saveBtn = document.getElementById('save_photo_button');
    const damageNotes = document.getElementById('damageNotes');

    if (!navigator.geolocation) {
        alert('Geolocation is not supported by your browser.');
        return;
    }

    if (saveBtn) saveBtn.innerHTML = '<i class="fa-solid fa-location-dot"></i> Getting location &amp; saving...';

    navigator.geolocation.getCurrentPosition(
        function (position) {
            const annotCanvas = getCanvasEl();
            const annotatedImage = annotCanvas ? annotCanvas.toDataURL('image/jpeg', 0.92) : sessionStorage.getItem('temp_photo');

            savedRecordData = {
                id: Date.now(),
                image: annotatedImage,
                notes: damageNotes ? damageNotes.value : '',
                latitude: position.coords.latitude,
                longitude: position.coords.longitude,
                timestamp: new Date().toLocaleString()
            };

            const savedGallery = JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
            savedGallery.push(savedRecordData);
            localStorage.setItem(STORAGE_KEY, JSON.stringify(savedGallery));
            sessionStorage.removeItem('temp_photo');

            if (saveBtn) {
                saveBtn.innerHTML = '<i class="fa-solid fa-circle-check"></i> Saved Successfully!';
                saveBtn.classList.replace('bg-blue-600', 'bg-green-600');
                saveBtn.classList.replace('hover:bg-blue-700', 'hover:bg-green-700');
                saveBtn.disabled = true;
            }

            if (!document.getElementById('view_reports_btn') && saveBtn && saveBtn.parentNode) {
                const viewBtn = document.createElement('a');
                viewBtn.id = 'view_reports_btn';
                viewBtn.href = 'reports.html';
                viewBtn.className = 'block w-full mt-2 text-center text-sm text-blue-600 font-semibold underline underline-offset-2 hover:text-blue-800 transition-colors';
                viewBtn.innerHTML = '<i class="fa-solid fa-folder-open"></i> View All My Reports';
                saveBtn.parentNode.insertBefore(viewBtn, saveBtn.nextSibling);
            }

            const shareBtn = document.getElementById('shareBtn');
            if (shareBtn) shareBtn.classList.remove('hidden');
        },
        function (error) {
            console.error('Location error:', error);
            alert('Could not get GPS location. Please check browser permissions.');
            if (saveBtn) saveBtn.innerText = 'Save Photo + Location + Notes';
        },
        { enableHighAccuracy: true }
    );
}

async function shareReport() {
    if (!savedRecordData) {
        alert('Please save the report first.');
        return;
    }

    const shareText =
        'RentGuard Inspection Report\n' +
        'Damage: ' + (savedRecordData.notes || 'No notes') + '\n' +
        'GPS: ' + savedRecordData.latitude + ', ' + savedRecordData.longitude + '\n' +
        'Recorded: ' + savedRecordData.timestamp;

    if (navigator.share) {
        try {
            const response = await fetch(savedRecordData.image);
            const blob = await response.blob();
            const file = new File([blob], 'RentGuard_Report_' + savedRecordData.id + '.jpg', { type: 'image/jpeg' });
            if (navigator.canShare && navigator.canShare({ files: [file] })) {
                await navigator.share({ title: 'RentGuard Inspection Report', text: shareText, files: [file] });
            } else {
                await navigator.share({ title: 'RentGuard Inspection Report', text: shareText });
            }
        } catch (error) {
            if (error.name !== 'AbortError') console.error('Error sharing:', error);
        }
        return;
    }

    try {
        await navigator.clipboard.writeText(shareText);
        alert('Report details copied to clipboard.');
    } catch (error) {
        alert(shareText);
    }
}

function appInit() {
    const annotationCanvas = getCanvasEl();
    if (annotationCanvas) {
        initAnnotationCanvas();
        updateStrokeLabel();
        setTool(currentTool);
        setColorByValue(currentColor);
    }

    const reportsGrid = document.getElementById('reports_grid');
    if (reportsGrid) {
        renderReports();
    }
}

function loadReports() {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
}

function saveReports(reports) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(reports));
}

function formatDate(ts) {
    return ts || 'Unknown time';
}

function mapsUrl(lat, lng) {
    return 'https://www.google.com/maps?q=' + lat + ',' + lng;
}

function truncate(str, maxLength) {
    if (!str) return 'No notes added.';
    return str.length > maxLength ? str.slice(0, maxLength) + '…' : str;
}

function escapeHtml(value) {
    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/\"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function openLightbox(src) {
    const lightboxImage = document.getElementById('lightbox_img');
    const lightbox = document.getElementById('lightbox');
    if (!lightboxImage || !lightbox) return;

    lightboxImage.src = src;
    lightbox.classList.remove('hidden');
    lightbox.classList.add('flex');
    document.body.style.overflow = 'hidden';
}

function openLightboxFromElement(element) {
    if (!element || !element.dataset.photo) return;
    openLightbox(element.dataset.photo);
}

function closeLightbox() {
    const lightbox = document.getElementById('lightbox');
    const lightboxImage = document.getElementById('lightbox_img');
    if (!lightbox || !lightboxImage) return;

    lightbox.classList.add('hidden');
    lightbox.classList.remove('flex');
    document.body.style.overflow = '';
    lightboxImage.src = '';
}

function downloadReport(id) {
    const report = loadReports().find(function (item) {
        return String(item.id) === String(id);
    });

    if (!report) return;

    const link = document.createElement('a');
    link.href = report.image;
    link.download = 'RentGuard_Report_' + id + '.jpg';
    link.click();
}

async function shareReportById(id) {
    const report = loadReports().find(function (item) {
        return String(item.id) === String(id);
    });

    if (!report) return;

    const shareText =
        'RentGuard Inspection Report\n' +
        'Damage: ' + (report.notes || 'No notes') + '\n' +
        'GPS: ' + (report.latitude ?? 'N/A') + ', ' + (report.longitude ?? 'N/A') + '\n' +
        'Recorded: ' + report.timestamp;

    if (navigator.share) {
        try {
            const response = await fetch(report.image);
            const blob = await response.blob();
            const file = new File([blob], 'RentGuard_' + id + '.jpg', { type: 'image/jpeg' });

            if (navigator.canShare && navigator.canShare({ files: [file] })) {
                await navigator.share({ title: 'RentGuard Inspection Report', text: shareText, files: [file] });
            } else {
                await navigator.share({ title: 'RentGuard Inspection Report', text: shareText });
            }
        } catch (error) {
            if (error.name !== 'AbortError') console.error('Share failed:', error);
        }
        return;
    }

    try {
        await navigator.clipboard.writeText(shareText);
        alert('Report details copied to clipboard!');
    } catch (error) {
        alert(shareText);
    }
}

function askDeleteReport(id) {
    pendingDeleteId = id;
    const deleteModal = document.getElementById('delete_modal');
    if (deleteModal) deleteModal.classList.remove('hidden');
}

function cancelDelete() {
    pendingDeleteId = null;
    const deleteModal = document.getElementById('delete_modal');
    if (deleteModal) deleteModal.classList.add('hidden');
}

function confirmDelete() {
    if (pendingDeleteId != null) {
        let reports = loadReports();
        reports = reports.filter(function (report) {
            return String(report.id) !== String(pendingDeleteId);
        });
        saveReports(reports);
        pendingDeleteId = null;
    }

    const deleteModal = document.getElementById('delete_modal');
    if (deleteModal) deleteModal.classList.add('hidden');
    renderReports();
}

function clearAllReports() {
    if (confirm('Delete ALL saved inspection reports from this device? This cannot be undone.')) {
        localStorage.removeItem(STORAGE_KEY);
        renderReports();
    }
}

function renderReports() {
    const grid = document.getElementById('reports_grid');
    const emptyState = document.getElementById('empty_state');
    const countLabel = document.getElementById('report_count_label');
    const clearAllBtn = document.getElementById('clear_all_btn');

    if (!grid || !emptyState || !countLabel || !clearAllBtn) return;

    const reports = loadReports();
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
    countLabel.textContent = reports.length + ' report' + (reports.length !== 1 ? 's' : '') + ' saved on this device';

    const sorted = reports.slice().reverse();
    const cards = sorted.map(function (report, index) {
        const hasNotes = report.notes && report.notes.trim() !== '';
        const hasGPS = report.latitude != null && report.longitude != null;
        const photo = escapeHtml(report.image);
        const notes = escapeHtml(truncate(report.notes, 120));
        const mapLink = hasGPS
            ? '<a href="' + mapsUrl(report.latitude, report.longitude) + '" target="_blank" rel="noreferrer" class="text-xs font-semibold text-sky-300 hover:text-sky-200 underline underline-offset-2">Open map</a>'
            : '<span class="text-xs text-slate-500">No GPS captured</span>';

        return [
            '<article class="animate-slide-up bg-slate-800/70 border border-slate-700/60 rounded-2xl overflow-hidden shadow-xl hover:shadow-blue-900/20 hover:border-slate-500/60 transition-all duration-300 group flex flex-col" style="animation-delay: ' + (index * 0.05) + 's">',
            '<button type="button" class="block text-left w-full" data-photo="' + photo + '" onclick="openLightboxFromElement(this)">',
            '<img src="' + photo + '" alt="Inspection photo" class="w-full h-56 object-cover group-hover:scale-[1.02] transition-transform duration-300">',
            '<div class="p-5 text-left space-y-3">',
            '<div class="flex items-start justify-between gap-3">',
            '<div>',
            '<h3 class="text-lg font-bold text-white">Report ' + escapeHtml(report.id) + '</h3>',
            '<p class="text-xs text-slate-400">' + escapeHtml(formatDate(report.timestamp)) + '</p>',
            '</div>',
            '<span class="text-[10px] font-semibold uppercase tracking-[0.2em] px-2.5 py-1 rounded-full ' + (hasNotes ? 'bg-emerald-500/15 text-emerald-300' : 'bg-slate-700 text-slate-400') + '">' + (hasNotes ? 'Notes added' : 'No notes') + '</span>',
            '</div>',
            '<p class="text-sm text-slate-300 leading-relaxed">' + notes + '</p>',
            '<div class="flex items-center justify-between gap-3">',
            mapLink,
            '</div>',
            '</div>',
            '</button>',
            '<div class="px-5 pb-5 pt-0 flex flex-wrap gap-2">',
            '<button type="button" class="px-3 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-white text-xs font-semibold transition-colors" onclick="downloadReport(\'' + report.id + '\')">Download</button>',
            '<button type="button" class="px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold transition-colors" onclick="shareReportById(\'' + report.id + '\')">Share</button>',
            '<button type="button" class="px-3 py-2 rounded-lg bg-red-600/90 hover:bg-red-500 text-white text-xs font-semibold transition-colors" onclick="askDeleteReport(\'' + report.id + '\')">Delete</button>',
            '</div>',
            '</article>'
        ].join('');
    }).join('');

    grid.innerHTML = cards;
}
