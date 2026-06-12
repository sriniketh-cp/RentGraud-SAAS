document.addEventListener('DOMContentLoaded', () => {
    // Mobile hamburger menu toggle
    const mobileMenuBtn = document.getElementById('mobile_menu_btn');
    const mobileMenu = document.getElementById('mobile_menu');
    
    if (mobileMenuBtn && mobileMenu) {
        mobileMenuBtn.addEventListener('click', () => {
            mobileMenu.classList.toggle('hidden');
        });
        
        // Close menu when clicking on a link
        const mobileMenuLinks = mobileMenu.querySelectorAll('a, button');
        mobileMenuLinks.forEach(link => {
            link.addEventListener('click', () => {
                mobileMenu.classList.add('hidden');
            });
        });
    }
   
    const inspectionBtns = document.querySelectorAll('.inspection_button');
    inspectionBtns.forEach(inspectionBtn => {
        inspectionBtn.addEventListener('click', async () => {
            const video = document.getElementById('video');
            try {
                const stream = await navigator.mediaDevices.getUserMedia({
                    video: { facingMode: 'environment' },
                    audio: false
                });
                video.srcObject = stream;
            } catch (error) {
                console.error("Camera access denied:", error);
                alert("Could not access the camera.");
            }
        });
    });

    const captureBtn = document.getElementById('capture_button');
    if (captureBtn) {
        captureBtn.addEventListener('click', () => {
            const video = document.getElementById('video');
            const canvas = document.getElementById('hidden_canvas');
            
            if (!video || !video.srcObject) {
                alert("Please start the inspection to turn on the camera first.");
                return;
            }

            const ctx = canvas.getContext('2d');
            canvas.width = video.videoWidth || 640;
            canvas.height = video.videoHeight || 480;
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            
            const photoData = canvas.toDataURL('image/jpeg', 0.8);
            sessionStorage.setItem('temp_photo', photoData);
            
            // Stop camera stream before navigating away
            const stream = video.srcObject;
            if (stream) {
                stream.getTracks().forEach(track => track.stop());
            }

            window.location.href = 'camera.html';
        });
    }

   
    const previewImg = document.getElementById('photo_preview');
    if (previewImg) {
        const tempPhotoData = sessionStorage.getItem('temp_photo');
        if (tempPhotoData) {
            previewImg.src = tempPhotoData;
        } else {
            alert("No photo found! Redirecting to camera.");
            window.location.href = 'index.html';
        }
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
                    savedRecordData = {
                        id: Date.now(),
                        image: sessionStorage.getItem('temp_photo'),
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
            if (navigator.share) {
                try {
                    await navigator.share({
                        title: 'RentGuard Inspection Update',
                        text: `Tenant Inspection Note:\n"${savedRecordData.notes}"\n\nRecorded at GPS: ${savedRecordData.latitude}, ${savedRecordData.longitude}\nTimestamp: ${savedRecordData.timestamp}`,
                        url: `https://rentguard.in/report/${savedRecordData.id}`
                    });
                    console.log('Successfully shared report');
                } catch (error) {
                    console.error('Error sharing report:', error);
                }
            } else {
                alert("Native sharing is not supported on this device. Copying details to clipboard instead.");
                const fallbackText = `Damage: ${savedRecordData.notes} | Location: ${savedRecordData.latitude}, ${savedRecordData.longitude}`;
                navigator.clipboard.writeText(fallbackText);
            }
        });
    }
});