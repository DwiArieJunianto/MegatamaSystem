let studentData = []; // Deklarasikan secara global
let currentPage = 1; // Pastikan ini diinisialisasi sebelum digunakan
const itemsPerPage = 10; // Sesuaikan dengan kebutuhan pagination Anda
let currentAction = null;
let currentStudentId = null; // Akan menyimpan NIS siswa
let isBulkPromotion = false;

// Inisialisasi Toast Notification
class ToastNotification {
    constructor() {
        this.toastElement = document.getElementById('toast-notification');
        if (!this.toastElement) {
            console.error("Elemen HTML dengan ID 'toast-notification' tidak ditemukan. ToastNotification tidak dapat diinisialisasi.");
            return;
        }
        this.toastIcon = document.getElementById('toast-icon');
        this.toastTitle = document.getElementById('toast-title');
        this.toastMessage = document.getElementById('toast-message');
        this.toastClose = document.getElementById('toast-close');
        this.toastContainer = this.toastElement.querySelector('.bg-white');

        this.isVisible = false;
        this.hideTimeout = null;

        if (this.toastElement) {
            this.setupEventListeners();
        }
    }

    setupEventListeners() {
        if (this.toastClose) {
            this.toastClose.addEventListener('click', () => {
                this.hide();
            });
        }
    }

    show(type, title, message) {
        if (!this.toastElement) return;

        if (this.hideTimeout) {
            clearTimeout(this.hideTimeout);
        }

        this.setContent(type, title, message);

        this.toastElement.classList.remove('toast-exit', 'toast-enter');
        this.toastElement.classList.add('toast-show');
        this.isVisible = true;

        this.autoHide();
    }

    hide() {
        if (!this.isVisible || !this.toastElement) return;

        if (this.hideTimeout) {
            clearTimeout(this.hideTimeout);
        }

        this.toastElement.classList.remove('toast-show');
        this.toastElement.classList.add('toast-exit');
        this.isVisible = false;

        setTimeout(() => {
            this.toastElement.classList.remove('toast-exit');
            this.toastElement.classList.add('toast-enter');
        }, 300);
    }

    autoHide() {
        this.hideTimeout = setTimeout(() => {
            this.hide();
        }, 5000);
    }

    setContent(type, title, message) {
        if (!this.toastContainer || !this.toastIcon || !this.toastTitle || !this.toastMessage) return;

        this.toastContainer.className = this.toastContainer.className.replace(/border-l-(green|red|yellow|blue|gray)-500/g, '');

        switch (type) {
            case 'success':
                this.toastIcon.innerHTML = '<i class="fas fa-check-circle text-green-500 text-xl"></i>';
                this.toastContainer.classList.add('border-l-green-500');
                break;
            case 'error':
                this.toastIcon.innerHTML = '<i class="fas fa-times-circle text-red-500 text-xl"></i>';
                this.toastContainer.classList.add('border-l-red-500');
                break;
            case 'warning':
                this.toastIcon.innerHTML = '<i class="fas fa-exclamation-triangle text-yellow-500 text-xl"></i>';
                this.toastContainer.classList.add('border-l-yellow-500');
                break;
            case 'info':
                this.toastIcon.innerHTML = '<i class="fas fa-info-circle text-blue-500 text-xl"></i>';
                this.toastContainer.classList.add('border-l-blue-500');
                break;
            default:
                this.toastIcon.innerHTML = '<i class="fas fa-info-circle text-gray-500 text-xl"></i>';
                this.toastContainer.classList.add('border-l-gray-500');
        }

        this.toastTitle.textContent = title;
        this.toastMessage.textContent = message;
    }
}

const toast = new ToastNotification();

// --- FETCH DATA SISWA SESUAI KELAS WALI KELAS ---
async function fetchStudentData() {
    // assignedClassNumber berasal dari PHP yang disuntikkan ke HTML
    // Pastikan variabel ini ada dan berisi nilai yang benar
    if (typeof assignedClassNumber === 'undefined' || assignedClassNumber === null) {
        toast.show('error', 'Akses Ditolak', 'Anda tidak ditugaskan sebagai wali kelas atau kelas tidak ditemukan.');
        document.getElementById("current-class-display").textContent = "Tidak Ditemukan";
        return;
    }

    // Tampilkan kelas yang sedang aktif di judul
    document.getElementById("current-class-display").textContent = `Kelas ${assignedClassNumber}`;

    const url = `../src/API/get_siswa.php?kelas=${assignedClassNumber}`; // Mengirim kelas ke PHP API
    
    toast.show('info', 'Memuat Data', `Mengambil data siswa kelas ${assignedClassNumber}...`);

    try {
        const response = await fetch(url);
        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`HTTP error! status: ${response.status} - ${errorText}`);
        }
        const data = await response.json();

        if (data.error) { // Perubahan ini mengasumsikan get_siswa.php mengembalikan { error: "Pesan error" }
            toast.show('error', 'Gagal Memuat', data.error);
            studentData = [];
        } else {
            // Perubahan ini mengasumsikan get_siswa.php mengembalikan array siswa
            studentData = data.map(s => ({ ...s, status: s.status || 'pending' })); //
            toast.show('success', 'Data Berhasil', `Berhasil memuat ${studentData.length} siswa.`);
        }
        
        renderStudentData(); // Render data setelah berhasil diambil
    } catch (error) {
        console.error('Error fetching student data:', error);
        toast.show('error', 'Error Jaringan', 'Tidak dapat terhubung ke server atau terjadi kesalahan saat memuat data siswa.');
        studentData = []; // Kosongkan data jika ada error
        renderStudentData(); // Render ulang tabel untuk menampilkan pesan kosong
    }
}

function renderStudentData() {
    const tableBody = document.getElementById("student-data");
    const paginationInfo = document.getElementById("pagination-info");
    const prevButton = document.getElementById("prev-page");
    const nextButton = document.getElementById("next-page");

    tableBody.innerHTML = ""; // Bersihkan tabel sebelumnya

    if (studentData.length === 0) {
        const row = document.createElement("tr");
        row.innerHTML = `
            <td colspan="7" class="text-center text-gray-500 py-4">
                Tidak ada data siswa untuk kelas ini atau terjadi kesalahan.
            </td>
        `;
        tableBody.appendChild(row);
        paginationInfo.textContent = "Tidak ada data";
        prevButton.disabled = true;
        nextButton.disabled = true;
        renderPagination(); // Render pagination untuk menampilkan 0 halaman
        return;
    }

    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = Math.min(startIndex + itemsPerPage, studentData.length);
    const paginatedData = studentData.slice(startIndex, endIndex);

    // Update pagination info
    paginationInfo.textContent = `Menampilkan ${startIndex + 1}-${endIndex} dari ${studentData.length} data`;

    paginatedData.forEach((student, index) => {
        const row = document.createElement("tr");
        row.className = "table-row hover:bg-gray-50"; // Tambah kelas hover

        let statusBadgeHtml = "";
        let actionButtonsHtml = "";

        // Status untuk kenaikan kelas
        if (student.status === "promote") {
            statusBadgeHtml = `<span class="badge bg-green-200 text-green-800 px-2 py-1 rounded-full text-xs font-medium">Naik Kelas</span>`;
        } else if (student.status === "not_promote") {
            statusBadgeHtml = `<span class="badge bg-red-200 text-red-800 px-2 py-1 rounded-full text-xs font-medium">Tidak Naik Kelas</span>`;
        } else {
            // Default to 'pending' if status is not 'promote' or 'not_promote'
            actionButtonsHtml = `
                <div class="flex space-x-2">
                    <button onclick="showConfirmationModal('${student.nis}', 'promote')" class="btn-success px-3 py-1.5 text-sm rounded-md shadow-sm">
                        Naik
                    </button>
                    <button onclick="showConfirmationModal('${student.nis}', 'not_promote')" class="btn-danger px-3 py-1.5 text-sm rounded-md shadow-sm">
                        Tidak Naik
                    </button>
                </div>
            `;
        }

        row.innerHTML = `
            <td class="px-4 py-3 whitespace-nowrap text-gray-700">${startIndex + index + 1}</td>
            <td class="px-4 py-3 whitespace-nowrap text-gray-700">${student.name}</td>
            <td class="px-4 py-3 whitespace-nowrap text-gray-700">${student.gender}</td>
            <td class="px-4 py-3 whitespace-nowrap text-gray-700">${student.nis}</td>
            <td class="px-4 py-3 whitespace-nowrap text-gray-700">${student.class}</td>
            <td class="px-4 py-3 whitespace-nowrap text-gray-700">${student.phone || '-'}</td>
            <td class="px-4 py-3 whitespace-nowrap">
                ${statusBadgeHtml} ${actionButtonsHtml}
            </td>
        `;
        tableBody.appendChild(row);
    });

    renderPagination();
}

// Fungsionalitas sidebar yang dapat dialihkan (tidak berubah)
function initializeSidebar() {
    const toggleBtn = document.getElementById("toggle-sidebar");
    const sidebar = document.getElementById("sidebar");
    const mainContent = document.getElementById("main-content");
    const overlay = document.getElementById("overlay");

    if (!toggleBtn || !sidebar || !mainContent || !overlay) {
        console.error("Beberapa elemen tidak ditemukan:", {
            toggleBtn: !!toggleBtn, sidebar: !!sidebar, mainContent: !!mainContent, overlay: !!overlay,
        });
        return;
    }

    function resetSidebarStates() {
        sidebar.classList.remove("collapsed", "mobile-open");
        overlay.classList.remove("show");
        sidebar.style.transform = "";
    }

    function setupDesktopLayout() {
        resetSidebarStates();
        mainContent.classList.remove("expanded");
        sidebar.classList.remove("collapsed");
    }

    function setupMobileLayout() {
        resetSidebarStates();
        sidebar.classList.add("collapsed");
        mainContent.classList.add("expanded");
    }

    function openSidebar() {
        if (window.innerWidth <= 768) {
            sidebar.classList.remove("collapsed");
            sidebar.classList.add("mobile-open");
            overlay.classList.add("show");
        } else {
            sidebar.classList.remove("collapsed");
            mainContent.classList.remove("expanded");
        }
    }

    function closeSidebar() {
        if (window.innerWidth <= 768) {
            sidebar.classList.add("collapsed");
            sidebar.classList.remove("mobile-open");
            overlay.classList.remove("show");
        } else {
            sidebar.classList.add("collapsed");
            mainContent.classList.add("expanded");
        }
    }

    function isSidebarOpen() {
        if (window.innerWidth <= 768) {
            return sidebar.classList.contains("mobile-open");
        } else {
            return !sidebar.classList.contains("collapsed");
        }
    }

    function handleResponsiveLayout() {
        const currentWidth = window.innerWidth;
        if (currentWidth <= 768) {
            setupMobileLayout();
        } else {
            setupDesktopLayout();
        }
    }

    toggleBtn.addEventListener("click", () => {
        if (isSidebarOpen()) {
            closeSidebar();
        } else {
            openSidebar();
        }
    });

    overlay.addEventListener("click", () => {
        closeSidebar();
    });

    let resizeTimeout;
    window.addEventListener("resize", () => {
        clearTimeout(resizeTimeout);
        resizeTimeout = setTimeout(() => {
            handleResponsiveLayout();
        }, 100);
    });

    handleResponsiveLayout();
}

// LOGIKA UNTUK MODAL KONFIRMASI (tidak berubah)
function showConfirmationModal(studentNis, action) {
    const student = studentData.find((s) => String(s.nis) === String(studentNis));
    const modal = document.getElementById("confirmation-modal");
    const message = document.getElementById("modal-message-naik-kelas");
    const confirmButton = document.getElementById("confirm-action");

    if (!student) {
        console.error("Siswa tidak ditemukan untuk NIS:", studentNis);
        toast.show('error', 'Kesalahan', 'Data siswa tidak ditemukan.');
        return;
    }
    if (!modal || !message || !confirmButton) {
        console.error("Elemen modal tidak ditemukan untuk modal konfirmasi.");
        return;
    }

    currentStudentId = studentNis; // Simpan NIS
    currentAction = action;

    const actionText = action === "promote" ? "naik kelas" : "tidak naik kelas";
    message.textContent = `Apakah Anda yakin ingin menetapkan status ${actionText} untuk siswa ${student.name}?`;

    confirmButton.onclick = () => confirmAction();

    modal.classList.add("show");
}

function showBulkPromotionModal() {
    const modal = document.getElementById("confirmation-modal");
    const message = document.getElementById("modal-message-naik-kelas");
    const subMessage = document.getElementById("modal-submessage-naik-kelas");
    const confirmButton = document.getElementById("confirm-action");

    if (!modal || !message || !confirmButton) {
        console.error("Elemen modal tidak ditemukan");
        return;
    }

    const pendingStudents = studentData.filter((student) => student.status === "pending");

    if (pendingStudents.length === 0) {
        message.textContent = "Tidak ada siswa yang perlu dinaikkan kelas.";
        
        const newConfirmButton = confirmButton.cloneNode(true);
        confirmButton.parentNode.replaceChild(newConfirmButton, confirmButton);
        document.getElementById("confirm-action").textContent = "Tutup";
        document.getElementById("confirm-action").addEventListener("click", closeModal);

        modal.classList.add("show");
        return;
    }

    isBulkPromotion = true;
    currentAction = "promote";
    currentStudentId = null;

    message.textContent = `Tindakan ini akan menetapkan status "Naik Kelas" untuk ${pendingStudents.length} siswa yang belum diproses.`;

    const newConfirmButton = confirmButton.cloneNode(true);
    confirmButton.parentNode.replaceChild(newConfirmButton, confirmButton);
    document.getElementById("confirm-action").textContent = "Konfirmasi";
    document.getElementById("confirm-action").addEventListener("click", confirmBulkAction);

    modal.classList.add("show");
}

function closeModal() {
    const modal = document.getElementById("confirmation-modal");
    if (modal) {
        modal.classList.remove("show");
    }
    currentStudentId = null;
    currentAction = null;
    isBulkPromotion = false;

    const subMessage = document.getElementById("modal-submessage-naik-kelas");
    if (subMessage) {
        subMessage.textContent = "";
    }
}

// Konfirmasi tindakan (single student)
function confirmAction() {
    if (currentStudentId && currentAction) {
        const studentIndex = studentData.findIndex((s) => String(s.nis) === String(currentStudentId));
        if (studentIndex !== -1) {
            const student = studentData[studentIndex];
            studentData[studentIndex].status = currentAction;
            renderStudentData();

            // TODO: Kirim pembaruan status ke server di sini
            // Misalnya: sendStatusUpdateToServer(student.nis, currentAction);

            if (currentAction === 'promote') {
                toast.show('success', 'Berhasil!', `${student.name} berhasil dinaikkan kelas!`);
            } else if (currentAction === 'not_promote') {
                toast.show('info', 'Status Diperbarui!', `${student.name} ditetapkan tidak naik kelas.`);
            }
        }
    }
    closeModal();
}

// Konfirmasi tindakan massal
function confirmBulkAction() {
    if (isBulkPromotion && currentAction === "promote") {
        const pendingStudents = studentData.filter((student) => student.status === "pending");
        const promotedCount = pendingStudents.length;

        studentData.forEach((student) => {
            if (student.status === "pending") {
                student.status = "promote";
                // TODO: Kirim pembaruan status ke server di sini untuk setiap siswa
                // Misalnya: sendStatusUpdateToServer(student.nis, "promote");
            }
        });
        renderStudentData();

        toast.show('success', 'Berhasil!', `${promotedCount} siswa berhasil Dinaikkan!`);
    }
    closeModal();
}

// Render kontrol paginasi
function renderPagination() {
    const paginationContainer = document.getElementById("pagination-numbers");
    const totalPages = Math.ceil(studentData.length / itemsPerPage);

    paginationContainer.innerHTML = "";

    for (let i = 1; i <= totalPages; i++) {
        const pageButton = document.createElement("button");
        pageButton.className = `pagination-item px-3 py-2 rounded text-sm ${i === currentPage ? "bg-blue-600 text-white" : "text-gray-500 hover:bg-gray-100"}`;
        pageButton.textContent = i;
        pageButton.addEventListener("click", () => {
            currentPage = i;
            renderStudentData();
        });
        paginationContainer.appendChild(pageButton);
    }

    const prevButton = document.getElementById("prev-page");
    const nextButton = document.getElementById("next-page");

    // Perbarui status disabled tombol
    prevButton.disabled = currentPage === 1;
    nextButton.disabled = currentPage === totalPages || totalPages === 0;

    // Perbaiki Event Listeners pada tombol prev/next agar tidak menumpuk
    // Hapus pendengar lama, tambahkan yang baru (teknik kloning node)
    const newPrevButton = prevButton.cloneNode(true);
    prevButton.parentNode.replaceChild(newPrevButton, prevButton);
    newPrevButton.addEventListener("click", () => {
        if (currentPage > 1) {
            currentPage--;
            renderStudentData();
        }
    });

    const newNextButton = nextButton.cloneNode(true);
    nextButton.parentNode.replaceChild(newNextButton, nextButton);
    newNextButton.addEventListener("click", () => {
        if (currentPage < totalPages) {
            currentPage++;
            renderStudentData();
        }
    });
}

// Inisialisasi fungsi tombol
function initializeButtons() {
    const promoteAllButton = document.getElementById("btn-promote-all");
    if (promoteAllButton) {
        promoteAllButton.addEventListener("click", () => {
            showBulkPromotionModal();
        });
    }
}

// Mengatur tombol ekspor PDF
function initializeExportPDF() {
    const exportPdfBtn = document.getElementById("btn-export-pdf");

    if (!exportPdfBtn) {
        console.error("Tombol 'Export PDF' dengan ID 'btn-export-pdf' tidak ditemukan.");
        return;
    }

    exportPdfBtn.addEventListener("click", () => {
        const table = document.getElementById("attendance-table"); // Sesuaikan ID tabel
        const tbody = document.getElementById("student-data");
        const rows = tbody ? tbody.querySelectorAll("tr") : [];

        if (!table) {
            toast.show("error", "Gagal!", "Tabel tidak ditemukan.");
            return;
        }

        if (!tbody || rows.length === 0 || (rows.length === 1 && rows[0].textContent.includes('Tidak ada data siswa'))) {
            toast.show("warning", "Data Kosong!", "Tidak ada data yang bisa diekspor ke PDF.");
            return;
        }

        toast.show("info", "Memproses...", "Sedang menyiapkan PDF Anda.");
        exportPdfBtn.innerText = "Memproses...";
        exportPdfBtn.disabled = true;

        // Clone the table to manipulate for PDF export (e.g., remove buttons)
        const tableClone = table.cloneNode(true);
        // Remove the 'Aksi' column (last column) from the cloned table header
        const headerRow = tableClone.querySelector('thead tr');
        if (headerRow && headerRow.children.length > 0) {
            headerRow.lastElementChild.remove();
        }
        // Remove the 'Aksi' column from each row in the cloned table body
        const bodyRows = tableClone.querySelectorAll('tbody tr');
        bodyRows.forEach(row => {
            // Check if the row is the "No data" row
            const isNoDataRow = row.querySelector('td[colspan="7"]');
            if (row.children.length > 0 && !isNoDataRow) {
                row.lastElementChild.remove();
            }
        });


        const scale = 2; // Increase scale for better quality
        html2canvas(tableClone, { scale: scale }).then((canvas) => {
            const imgData = canvas.toDataURL("image/png");
            const { jsPDF } = window.jspdf;
            const pdf = new jsPDF("p", "mm", "a4");

            const pdfWidth = pdf.internal.pageSize.getWidth();
            const pdfHeight = pdf.internal.pageSize.getHeight();

            const imgWidth = pdfWidth;
            const imgHeight = (canvas.height * imgWidth) / canvas.width;

            let heightLeft = imgHeight;
            let position = 0;

            pdf.setFontSize(16);
            pdf.text(`Rekap Kenaikan Kelas - Kelas ${assignedClassNumber}`, pdfWidth / 2, 10, { align: 'center' });
            
            // Adjust startY if header is added
            const startY = 20;

            while (heightLeft >= 0) {
                pdf.addImage(imgData, "PNG", 0, position + startY, imgWidth, imgHeight); // Add startY offset
                heightLeft -= pdfHeight;
                if (heightLeft > 0) {
                    pdf.addPage();
                    position = heightLeft - imgHeight;
                }
            }

            const blob = pdf.output("blob");
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `kenaikan-kelas_kelas_${assignedClassNumber}_${new Date().toISOString().slice(0,10)}.pdf`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);

            toast.show("success", "Berhasil!", "Data berhasil diekspor ke PDF!");
        }).catch((error) => {
            console.error("Gagal membuat PDF:", error);
            toast.show("error", "Gagal!", "Terjadi kesalahan saat membuat PDF.");
        }).finally(() => {
            exportPdfBtn.innerText = "Export Data"; // Mengembalikan teks tombol
            exportPdfBtn.disabled = false;
        });
    });
}


// Jalankan saat halaman dimuat
window.addEventListener("load", () => {
    initializeSidebar();
    initializeButtons();
    fetchStudentData(); // Panggil fetchStudentData saat halaman dimuat
    initializeExportPDF(); // Inisialisasi fungsi ekspor PDF
});

// Jadikan fungsi tersedia secara global agar bisa diakses dari HTML
window.showConfirmationModal = showConfirmationModal;
window.showBulkPromotionModal = showBulkPromotionModal;
window.closeModal = closeModal;
window.confirmAction = confirmAction;
window.confirmBulkAction = confirmBulkAction;

// Export ToastNotification class (opsional, jika Anda ingin instance baru di tempat lain)
window.ToastNotification = ToastNotification;