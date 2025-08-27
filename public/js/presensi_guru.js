// update jam dan tanggal
function updateClock() {
    const now = new Date();
    const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };

    // atur format waktu 
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');
    const timeString = `${hours}:${minutes}:${seconds}`;

    document.getElementById('clock').textContent = timeString;
    document.getElementById('date').textContent = now.toLocaleDateString('id-ID', options);

    // update status aktif sesuai waktu sekarang
    updateActiveStatus(now);
}

function updateActiveStatus(now) {
    const hour = now.getHours();
    const day = now.getDay(); // 0 = Minggu, 1 = Senin, ..., 6 = Sabtu

    // Status aktif untuk absen datang (Senin-Jumat 06:30-10:30)
    const morningActive = day >= 1 && day <= 5 && hour >= 6 && hour < 10;

    // Status aktif untuk absen pulang
    let afternoonActive = false;
    if (day >= 1 && day <= 4) { // Senin-Kamis
        afternoonActive = hour >= 10;
    } else if (day === 5) { // Jumat
        afternoonActive = hour >= 11;
    }

    const morningIndicator = document.querySelector('#attendance-status .flex:first-child .rounded-full');
    const afternoonIndicator = document.querySelector('#attendance-status .flex:last-child .rounded-full');

    // kembalikan kelas ke awal
    morningIndicator.className = 'w-3 h-3 rounded-full mr-2';
    afternoonIndicator.className = 'w-3 h-3 rounded-full mr-2';

    // tambahkan kelas untuk indikator pagi dan sore berdasarkan status aktif
    if (morningActive) {
        morningIndicator.classList.add('bg-green-500', 'pulse-animation');
        afternoonIndicator.classList.add('bg-yellow-500');
    } else if (afternoonActive) {
        morningIndicator.classList.add('bg-green-500');
        afternoonIndicator.classList.add('bg-yellow-500', 'pulse-animation');
    } else {
        morningIndicator.classList.add('bg-green-500');
        afternoonIndicator.classList.add('bg-yellow-500');
    }
}

// jalankan jam langsung dan update tiap detik
updateClock();
setInterval(updateClock, 1000);

// fungsi kamera dan elemen terkait
const cameraElement = document.getElementById('camera');
const canvasElement = document.getElementById('canvas');
const captureBtn = document.getElementById('capture-btn');
const identityInput = document.getElementById('identity');
const passwordInput = document.getElementById('password');
const cameraPlaceholder = document.getElementById('camera-placeholder');
const statusIndicator = document.getElementById('status-indicator');
const statusText = document.getElementById('status-text');
const autocompleteDropdown = document.getElementById('autocomplete-dropdown');
let stream = null;

let teacherData = [];

// Mengambil data guru dari API untuk fitur autocomplete
fetch('../src/API//get_guru.php')
    .then(response => response.json())
    .then(data => {
        teacherData = data;
    })
    .catch(error => {
        console.error('Gagal mengambil data guru:', error);
        showModal('error', 'Gagal', 'Tidak bisa memuat data guru dari server.');
    });

// Simpan data presensi di localStorage untuk menghindari duplikasi absensi di sisi klien
function getAttendanceData() {
    const today = new Date().toLocaleDateString('id-ID');
    const data = localStorage.getItem(`attendance_${today}`);
    return data ? JSON.parse(data) : {};
}

function saveAttendanceData(data) {
    const today = new Date().toLocaleDateString('id-ID');
    localStorage.setItem(`attendance_${today}`, JSON.stringify(data));
}

// fungsi autocomplete untuk input identitas
identityInput.addEventListener('input', function () {
    const inputValue = this.value.toLowerCase();

    if (inputValue.length >= 3) { // Hanya tampilkan saran jika input minimal 3 karakter
        // Filter guru berdasarkan input ID atau nama
        const filteredTeachers = teacherData.filter(teacher =>
            teacher.id.toLowerCase().includes(inputValue) ||
            teacher.name.toLowerCase().includes(inputValue)
        );

        // Tampilkan dropdown dengan hasil
        if (filteredTeachers.length > 0) {
            autocompleteDropdown.innerHTML = '';
            filteredTeachers.forEach(teacher => {
                const item = document.createElement('div');
                item.className = 'autocomplete-item';
                item.textContent = `${teacher.id} - ${teacher.name}`;
                item.addEventListener('click', function () {
                    identityInput.value = `${teacher.id} - ${teacher.name}`;
                    autocompleteDropdown.classList.add('hidden');
                    validateForm(); // Validasi form setelah memilih dari autocomplete
                });
                autocompleteDropdown.appendChild(item);
            });
            autocompleteDropdown.classList.remove('hidden'); // Tampilkan dropdown
        } else {
            autocompleteDropdown.innerHTML = '<div class="autocomplete-placeholder">Tidak ada hasil yang cocok</div>';
            autocompleteDropdown.classList.remove('hidden'); // Tetap tampilkan placeholder jika tidak ada hasil
        }
    } else {
        autocompleteDropdown.classList.add('hidden'); // Sembunyikan jika input kurang dari 3
    }
});

// Sembunyikan dropdown saat klik di luar area input atau dropdown
document.addEventListener('click', function (e) {
    if (!identityInput.contains(e.target) && !autocompleteDropdown.contains(e.target)) {
        autocompleteDropdown.classList.add('hidden');
    }
});

// Navigasi dropdown autocomplete pakai keyboard (panah atas/bawah, Enter)
identityInput.addEventListener('keydown', function (e) {
    const items = autocompleteDropdown.querySelectorAll('.autocomplete-item');
    const selectedItem = autocompleteDropdown.querySelector('.selected');

    if (items.length > 0 && !autocompleteDropdown.classList.contains('hidden')) {
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            if (!selectedItem) {
                items[0].classList.add('selected');
            } else {
                const nextItem = selectedItem.nextElementSibling;
                if (nextItem && nextItem.classList.contains('autocomplete-item')) {
                    selectedItem.classList.remove('selected');
                    nextItem.classList.add('selected');
                }
            }
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            if (selectedItem) {
                const prevItem = selectedItem.previousElementSibling;
                if (prevItem && prevItem.classList.contains('autocomplete-item')) {
                    selectedItem.classList.remove('selected');
                    prevItem.classList.add('selected');
                }
            }
        } else if (e.key === 'Enter' && selectedItem) {
            e.preventDefault();
            identityInput.value = selectedItem.textContent;
            autocompleteDropdown.classList.add('hidden');
            validateForm();
        }
    }
});

// Aktifkan kamera segera saat halaman dimuat
function activateCamera() {
    if (!stream) { // Hanya aktifkan jika belum ada stream
        cameraPlaceholder.classList.remove('hidden');
        statusIndicator.className = 'w-3 h-3 rounded-full bg-yellow-500 mr-2 pulse-animation';
        statusText.textContent = 'Mengaktifkan kamera...';
        statusText.className = 'text-sm text-yellow-800 font-medium';

        navigator.mediaDevices.getUserMedia({
            video: {
                width: { ideal: 1280 },
                height: { ideal: 720 },
                facingMode: "user", // Menggunakan kamera depan
                frameRate: { ideal: 30 }
            }
        })
            .then(videoStream => {
                stream = videoStream;
                cameraElement.srcObject = stream;

                // Non-mirrored transform
                cameraElement.style.transform = 'scaleX(1)';
                cameraElement.style.webkitTransform = 'scaleX(1)';
                cameraElement.classList.add('non-mirrored'); // Tambahkan kelas untuk CSS tambahan

                cameraElement.setAttribute('playsinline', true); // Penting untuk iOS
                cameraElement.setAttribute('autoplay', true);

                cameraElement.onloadedmetadata = function () {
                    cameraElement.play();
                    cameraElement.style.transform = 'scaleX(1)';
                    cameraElement.style.webkitTransform = 'scaleX(1)';
                };

                cameraPlaceholder.classList.add('hidden'); // Sembunyikan placeholder
                statusIndicator.className = 'w-3 h-3 rounded-full bg-green-500 mr-2 pulse-animation';
                statusText.textContent = 'Kamera aktif dan siap digunakan';
                statusText.className = 'text-sm text-primary font-medium';
            })
            .catch(err => {
                console.error('Error accessing camera:', err);
                showModal('error', 'Error', 'Tidak dapat mengakses kamera. Pastikan Anda memberikan izin kamera.');
                cameraPlaceholder.classList.remove('hidden');
                // Tampilkan pesan error di placeholder kamera
                cameraPlaceholder.innerHTML = `
                <div class="text-center p-4">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-12 w-12 mx-auto mb-2 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <p class="text-base font-medium text-gray-600">Akses kamera ditolak</p>
                    <p class="text-sm text-gray-500 mt-2">Mohon izinkan akses kamera di pengaturan browser Anda</p>
                </div>
            `;

                statusIndicator.className = 'w-3 h-3 rounded-full bg-red-500 mr-2';
                statusText.textContent = 'Kamera tidak dapat diakses';
                statusText.className = 'text-sm text-red-800 font-medium';
            });
    }
}

// Form validasi: Aktifkan tombol capture jika input identity dan password terisi
function validateForm() {
    // Memastikan identityInput memiliki format "ID - Nama"
    const identityValue = identityInput.value;
    const isIdentityValid = identityValue.includes('-') && identityValue.split('-')[0].trim().length > 0;

    if (isIdentityValid && passwordInput.value) {
        captureBtn.disabled = false;
        captureBtn.classList.remove('opacity-50', 'cursor-not-allowed');
    } else {
        captureBtn.disabled = true;
        captureBtn.classList.add('opacity-50', 'cursor-not-allowed');
    }
}

identityInput.addEventListener('input', validateForm);
passwordInput.addEventListener('input', validateForm);

// Event listener untuk tombol ambil gambar (capture)
captureBtn.addEventListener('click', () => {
    if (!stream || captureBtn.disabled) return; // Hentikan jika kamera tidak aktif atau tombol dinonaktifkan

    // Umpan balik visual (flash effect) saat gambar diambil
    const flashEffect = document.createElement('div');
    flashEffect.className = 'absolute inset-0 bg-white z-10';
    document.querySelector('.camera-container').appendChild(flashEffect);

    setTimeout(() => {
        flashEffect.style.transition = 'opacity 0.5s ease';
        flashEffect.style.opacity = '0';
        setTimeout(() => flashEffect.remove(), 500);
    }, 50);

    // Gambar diambil dari elemen video kamera dan digambar ke canvas
    canvasElement.width = cameraElement.videoWidth;
    canvasElement.height = cameraElement.videoHeight;
    const ctx = canvasElement.getContext('2d');
    ctx.drawImage(cameraElement, 0, 0, canvasElement.width, canvasElement.height);

    // Konversi gambar di canvas ke format Base64 PNG
    const imageData = canvasElement.toDataURL("image/png");

    // Dapatkan waktu dan tanggal saat ini
    const now = new Date();
    const formattedHours = String(now.getHours()).padStart(2, '0');
    const formattedMinutes = String(now.getMinutes()).padStart(2, '0');
    const formattedSeconds = String(now.getSeconds()).padStart(2, '0');
    const timeString = `${formattedHours}:${formattedMinutes}:${formattedSeconds}`;

    const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    const dateString = now.toLocaleDateString('id-ID', options);

    // Dapatkan teacherId dan name dari input identitas (misal: "1001 - Nama Guru")
    let name = '';
    let id = '';
    if (identityInput.value.includes('-')) {
        const parts = identityInput.value.split('-');
        id = parts[0].trim(); // ID Guru
        name = parts[1].trim(); // Nama Guru
    } else {
        // Fallback jika format tidak sesuai, gunakan seluruh input sebagai ID
        id = identityInput.value.trim();
        // Anda mungkin ingin mencari nama guru di teacherData berdasarkan ID di sini
        const foundTeacher = teacherData.find(teacher => teacher.id === id);
        if (foundTeacher) {
            name = foundTeacher.name;
        } else {
            name = "Nama Tidak Dikenal";
        }
    }

    // Tentukan attendanceType dan onTime/status berdasarkan waktu saat ini
    let attendanceType = '';
    let status = '';
    let onTime = false;

    const hour = now.getHours();
    const minutes = now.getMinutes();
    const day = now.getDay(); // 0 = Minggu, 1 = Senin, ..., 6 = Sabtu

    // Logika validasi waktu presensi sebelum mengirim ke server
    if (day < 1 || day > 5) { // Hanya hari Senin-Jumat
        showModal('error', 'Absen Gagal', 'Absensi hanya dapat dilakukan pada hari kerja (Senin-Jumat).');
        return; // Hentikan proses
    }

    if (hour < 6 || (hour === 6 && minutes < 30)) {
        showModal('error', 'Absen Gagal', 'Absen hanya dapat dilakukan mulai pukul 06:30.');
        return;
    }

    // Ambil data presensi dari localStorage untuk cek duplikasi di sisi klien
    const attendanceData = getAttendanceData();
    const teacherId = id; // Gunakan ID guru yang sudah diekstrak

    // Cek duplikasi presensi (hanya untuk pencegahan di sisi klien)
    if (attendanceData[teacherId]) {
        const hasMorningAttendance = attendanceData[teacherId].morning;
        const hasAfternoonAttendance = attendanceData[teacherId].afternoon;

        if (hour < 10 || (hour === 10 && minutes <= 30)) { // Waktu absen datang
            if (hasMorningAttendance) {
                showModal('error', 'Absen Gagal', 'Anda sudah melakukan absen datang hari ini. Silakan cek riwayat presensi.');
                return;
            }
        } else { // Waktu absen pulang
            if (hasAfternoonAttendance) {
                showModal('error', 'Absen Gagal', 'Anda sudah melakukan absen pulang hari ini. Silakan cek riwayat presensi.');
                return;
            }
            // Jika belum absen datang tapi mau absen pulang (kasus absen datang terlambat)
            if (!hasMorningAttendance) {
                // Catat sebagai absen datang terlambat di localStorage (ini hanya untuk UI/UX, validasi utama di backend)
                attendanceData[teacherId] = attendanceData[teacherId] || {};
                attendanceData[teacherId].morning = {
                    time: `${String(hour).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`,
                    status: 'Terlambat (Datang)', // Status untuk datang
                    date: now.toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
                };
                saveAttendanceData(attendanceData);

                showModal('info', 'Absen Datang Terlambat', 'Anda belum melakukan absen datang hari ini. Sistem mencatat absen datang terlambat. Silakan scan ulang untuk absen pulang.');
                return; // Minta scan lagi untuk absen pulang
            }
        }
    }

    // Menentukan Tipe dan Status Absensi
    if (hour < 10 || (hour === 10 && minutes <= 30)) { // Rentang waktu untuk absen "Datang"
        attendanceType = 'Datang';
        if (hour < 7 || (hour === 7 && minutes <= 30)) { // Batas tepat waktu datang (sebelum 07:30)
            status = 'Tepat Waktu';
            onTime = true;
        } else {
            status = 'Terlambat';
            onTime = false;
        }
    } else { // Rentang waktu untuk absen "Pulang" (setelah 10:30)
        attendanceType = 'Pulang';
        if (day === 5) { // Khusus Jumat
            if (hour < 11 || (hour === 11 && minutes < 30)) {
                status = 'Pulang Awal'; // Sebelum 11:30
                onTime = false;
            } else if (hour >= 14) { // Setelah jam 14:00
                status = 'Terlambat';
                onTime = false;
            } else {
                status = 'Tepat Waktu'; // Antara 11:30 dan 14:00
                onTime = true;
            }
        } else { // Senin-Kamis
            // Untuk Senin-Kamis, dianggap tepat waktu jika sudah masuk jam pulang (setelah 10:30)
            status = 'Tepat Waktu';
            onTime = true;
        }
    }


    // Siapkan FormData untuk dikirim ke server
    const formData = new FormData();
    formData.append("identity", identityInput.value); // Kirim seluruh string "ID - Nama"
    formData.append("password", passwordInput.value);
    formData.append("image", imageData);
    formData.append("dateString", dateString);
    formData.append("timeString", timeString);
    formData.append("attendanceType", attendanceType);
    formData.append("onTime", onTime ? 'true' : 'false'); // Kirim sebagai string boolean

    // Perbarui indikator status di UI sebelum mengirim data
    statusIndicator.className = 'w-3 h-3 rounded-full bg-blue-500 mr-2 pulse-animation';
    statusText.textContent = 'Memproses data presensi...';
    statusText.className = 'text-sm text-primary font-medium';

    // Kirim data ke server PHP
    fetch("../src/API//presensi_guru.php", {
        method: "POST",
        body: formData
    })
    .then(async res => {
        const response = await res.json(); // Parse respons JSON dari server

        // Cek status respons dari server
        if (!res.ok || response.status !== "success") {
            // Jika server mengembalikan status HTTP error atau status JSON bukan "success"
            throw new Error(response.message || "Presensi gagal."); // Lemparkan error dengan pesan dari server
        }

        const { name: resName, nip: resNip } = response; // Destrukturisasi respons server

        // Simpan data presensi di localStorage setelah berhasil dari server
        attendanceData[teacherId] = attendanceData[teacherId] || {};
        if (attendanceType === 'Datang') {
            attendanceData[teacherId].morning = {
                time: timeString,
                status: status,
                date: dateString
            };
        } else if (attendanceType === 'Pulang') {
            attendanceData[teacherId].afternoon = {
                time: timeString,
                status: status,
                date: dateString
            };
        }
        saveAttendanceData(attendanceData); // Simpan perubahan ke localStorage

        // Tampilkan modal keberhasilan dengan detail presensi
        showAttendanceModal("success", response.message, {
            name: resName,
            nip: resNip,
            date: dateString,
            time: timeString,
            type: attendanceType,
            status: status
        });

        // Perbarui status indikator di UI setelah berhasil
        statusIndicator.className = 'w-3 h-3 rounded-full bg-green-500 mr-2 pulse-animation';
        statusText.textContent = 'Kamera aktif dan siap digunakan';
        statusText.className = 'text-sm text-primary font-medium';
        // Reset input password setelah berhasil
        passwordInput.value = '';
        validateForm(); // Re-validate form
    })
    .catch(err => {
        // Tangani error yang dilemparkan (baik dari server maupun network)
        console.error("Presensi gagal:", err);
        showModal("error", "Presensi Gagal", err.message);

        // Perbarui status indikator di UI setelah gagal
        statusIndicator.className = 'w-3 h-3 rounded-full bg-red-500 mr-2';
        statusText.textContent = 'Terjadi kesalahan, coba lagi.';
        statusText.className = 'text-sm text-red-800 font-medium';
    });
});

// Fungsi untuk menampilkan modal umum (error, success, info)
const modal = document.getElementById('modal');
const modalContent = document.getElementById('modal-content');
const modalTitle = document.getElementById('modal-title');
const modalMessage = document.getElementById('modal-message');
const modalDetails = document.getElementById('modal-details');
const modalHeader = document.getElementById('modal-header');
const modalIcon = document.getElementById('modal-icon');
const modalClose = document.getElementById('modal-close');

function showModal(type, title, message) {
    modalTitle.textContent = title;
    modalMessage.textContent = message;
    modalDetails.innerHTML = ''; // Pastikan detail kosong untuk modal umum

    if (type === 'error') {
        modalIcon.className = 'mx-auto flex items-center justify-center h-16 w-16 rounded-full mb-4 bg-red-100';
        modalIcon.innerHTML = `
            <svg xmlns="http://www.w3.org/2000/svg" class="h-8 w-8 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
        `;
        modalHeader.className = 'text-center mb-4 text-red-600';
    } else if (type === 'success') {
        modalIcon.className = 'mx-auto flex items-center justify-center h-16 w-16 rounded-full mb-4 bg-green-100';
        modalIcon.innerHTML = `
            <svg xmlns="http://www.w3.org/2000/svg" class="h-8 w-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
            </svg>
        `;
        modalHeader.className = 'text-center mb-4 text-green-600';
    } else if (type === 'info') {
        modalIcon.className = 'mx-auto flex items-center justify-center h-16 w-16 rounded-full mb-4 bg-blue-100';
        modalIcon.innerHTML = `
            <svg xmlns="http://www.w3.org/2000/svg" class="h-8 w-8 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
        `;
        modalHeader.className = 'text-center mb-4 text-blue-600';
    }

    modal.classList.remove('hidden');
    setTimeout(() => {
        modalContent.classList.remove('scale-95', 'opacity-0');
        modalContent.classList.add('scale-100', 'opacity-100');
    }, 10);
}

// Fungsi untuk menampilkan modal khusus presensi dengan detail
function showAttendanceModal(result, status, details = null) {
    const type = result === 'success' ? 'success' : 'error';
    const title = result === 'success' ? 'Presensi Berhasil' : 'Presensi Gagal';
    const message = result === 'success' ? `Presensi ${status}` : status;

    modalTitle.textContent = title;
    modalMessage.textContent = message;

    // Tampilkan detail hanya jika presensi berhasil
    if (details && result === 'success') {
        modalDetails.innerHTML = `
            <div class="space-y-2 text-left">
                <div class="flex justify-between">
                    <span class="font-medium text-gray-600">Nama:</span>
                    <span class="text-gray-800 font-semibold">${details.name}</span>
                </div>
                <div class="flex justify-between">
                    <span class="font-medium text-gray-600">ID:</span>
                    <span class="text-gray-800 font-semibold">${details.nip}</span>
                </div>
                <div class="flex justify-between">
                    <span class="font-medium text-gray-600">Tanggal:</span>
                    <span class="text-gray-800 font-semibold">${details.date}</span>
                </div>
                <div class="flex justify-between">
                    <span class="font-medium text-gray-600">Waktu:</span>
                    <span class="text-gray-800 font-semibold">${details.time}</span>
                </div>
                <div class="flex justify-between">
                    <span class="font-medium text-gray-600">Keterangan:</span>
                    <span class="text-gray-800 font-semibold">Absen ${details.type} (${details.status})</span>
                </div>
            </div>
        `;
    } else {
        modalDetails.innerHTML = ''; // Kosongkan detail jika bukan sukses atau tidak ada detail
    }

    // Atur ikon dan warna header modal berdasarkan hasil
    if (result === 'success') {
        modalIcon.className = 'mx-auto flex items-center justify-center h-16 w-16 rounded-full mb-4 bg-green-100';
        modalIcon.innerHTML = `
            <svg xmlns="http://www.w3.org/2000/svg" class="h-8 w-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
            </svg>
        `;
        modalHeader.className = 'text-center mb-4 text-green-600';
    } else {
        modalIcon.className = 'mx-auto flex items-center justify-center h-16 w-16 rounded-full mb-4 bg-red-100';
        modalIcon.innerHTML = `
            <svg xmlns="http://www.w3.org/2000/svg" class="h-8 w-8 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
        `;
        modalHeader.className = 'text-center mb-4 text-red-600';
    }

    modal.classList.remove('hidden');
    setTimeout(() => {
        modalContent.classList.remove('scale-95', 'opacity-0');
        modalContent.classList.add('scale-100', 'opacity-100');
    }, 10);
}

// Event listener untuk tombol tutup modal
modalClose.addEventListener('click', () => {
    modalContent.classList.remove('scale-100', 'opacity-100');
    modalContent.classList.add('scale-95', 'opacity-0');
    setTimeout(() => {
        modal.classList.add('hidden');
    }, 300); // Durasi harus sama dengan durasi transisi CSS
});

// Fungsi untuk memeriksa akses dari jaringan lokal
function checkLocalNetwork() {
    const hostname = window.location.hostname;
    // Cek jika hostname adalah localhost, IP lokal (127.0.0.1, 192.168.x.x, 10.x.x.x)
    const isLocalhost = hostname === 'localhost' || hostname === '127.0.0.1' || hostname.startsWith('192.168.') || hostname.startsWith('10.');

    if (!isLocalhost) {
        showModal('error', 'Akses Ditolak', 'Sistem presensi hanya dapat diakses melalui jaringan lokal sekolah.');
        // Mungkin juga menonaktifkan elemen form atau tombol presensi
        captureBtn.disabled = true;
        identityInput.disabled = true;
        passwordInput.disabled = true;
        if (stream) {
            stream.getTracks().forEach(track => track.stop()); // Hentikan kamera
            stream = null;
        }
        cameraPlaceholder.classList.remove('hidden');
        cameraPlaceholder.innerHTML = `
            <div class="text-center p-4">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-12 w-12 mx-auto mb-2 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p class="text-base font-medium text-gray-600">Akses jaringan tidak diizinkan</p>
                <p class="text-sm text-gray-500 mt-2">Sistem ini hanya dapat digunakan di jaringan lokal sekolah.</p>
            </div>
        `;
        statusIndicator.className = 'w-3 h-3 rounded-full bg-red-500 mr-2';
        statusText.textContent = 'Akses jaringan tidak diizinkan.';
        statusText.className = 'text-sm text-red-800 font-medium';
    }
}

// Jalankan fungsi saat halaman dimuat
window.addEventListener('load', () => {
    checkLocalNetwork(); // Periksa jaringan saat load
    validateForm(); // Validasi form awal
    activateCamera(); // Aktifkan kamera
});