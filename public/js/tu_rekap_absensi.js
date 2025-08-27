document.addEventListener('DOMContentLoaded', function() {
    // --- DOM Elements ---
    const absenTypeSelect = document.getElementById('tipe');
    const monthFilterSelect = document.getElementById('month-filter');
    const statusFilterSelect = document.getElementById('status');
    const kelasFilterSelect = document.getElementById('kelas');
    const classLabel = document.getElementById('kelasLabel'); // Pastikan ini ada di HTML Anda
    const statusLabel = document.getElementById('statusLabel'); // Pastikan ini ada di HTML Anda
    const searchNameInput = document.getElementById('search-name');
    const btnAbsenDatang = document.getElementById('btn-absen-datang');
    const btnAbsenPulang = document.getElementById('btn-absen-pulang');
    const btnExportPdf = document.getElementById('btn-export-pdf');

    const guruHeader = document.getElementById('guru-header');
    const siswaHeader = document.getElementById('siswa-header');
    const attendanceTableBody = document.getElementById('attendance-data');

    const loadingMessage = document.getElementById('loadingMessage');
    const errorMessage = document.getElementById('errorMessage');

    const imageModal = document.getElementById('imageModal');
    const modalImage = document.getElementById('modalImage');
    const closeModal = document.getElementsByClassName('close')[0];

    const currentRangeSpan = document.getElementById('currentRange');
    const totalDataSpan = document.getElementById('totalData');
    const prevPageButton = document.getElementById('prevPage');
    const nextPageButton = document.getElementById('nextPage');
    const pageNumbersContainer = document.getElementById('pageNumbers');

    // Toast Notification elements
    const toastNotification = document.getElementById("toast-notification");
    const toastIcon = document.getElementById("toast-icon");
    const toastTitle = document.getElementById("toast-title");
    const toastMessage = document.getElementById("toast-message");
    const toastCloseButton = document.getElementById("toast-close");

    // --- State Variables ---
    let currentAttendanceType = absenTypeSelect.value; // Initialize with default HTML value
    let currentDisplayMode = 'absen-datang'; // 'absen-datang' or 'absen-pulang' (only for guru)
    let allTableData = []; // Stores all fetched data for search and pagination
    let filteredData = []; // Stores data after search filter
    let currentPage = 1;
    const rowsPerPage = 9; // Number of rows per page, matching your HTML pagination info

    // --- Constants ---
    // Adjust these image paths based on your server setup
    // Based on your SQL dump, guru profile photos are in 'img/guru/'
    const GURU_PROFILE_IMAGE_BASE_URL = 'img/guru/';
    // And attendance photos like 'presensi__...' or 'foto_datang_...' seem to be directly accessible from the root or need a specific subfolder.
    // Assuming they are in a folder named 'presensi' at the root of your project
    const PRESENSI_IMAGE_BASE_URL = 'presensi/'; // ADJUST THIS! e.g., 'uploads/presensi/' or '' if at root.


    // --- Functions ---

    /**
     * Shows a toast notification.
     * @param {string} type - 'success', 'error', 'info', 'warning'
     * @param {string} title - The title of the toast.
     * @param {string} message - The message content.
     */
    const toast = {
        show: (type, title, message) => {
            let borderColorClass = '';
            let iconHtml = '';
            switch (type) {
                case "success":
                    borderColorClass = "border-l-green-500";
                    iconHtml = '<i class="fas fa-check-circle text-green-500 text-xl"></i>';
                    break;
                case "error":
                    borderColorClass = "border-l-red-500";
                    iconHtml = '<i class="fas fa-times-circle text-red-500 text-xl"></i>';
                    break;
                case "info":
                    borderColorClass = "border-l-blue-500";
                    iconHtml = '<i class="fas fa-info-circle text-blue-500 text-xl"></i>';
                    break;
                case "warning":
                    borderColorClass = "border-l-yellow-500";
                    iconHtml = '<i class="fas fa-exclamation-triangle text-yellow-500 text-xl"></i>';
                    break;
                default:
                    borderColorClass = "border-l-gray-500";
                    iconHtml = '';
            }

            toastIcon.innerHTML = iconHtml;
            toastNotification.querySelector(".bg-white").className =
                `bg-white rounded-lg shadow-lg border-l-4 p-4 max-w-sm ${borderColorClass}`;
            toastTitle.textContent = title;
            toastMessage.textContent = message;

            toastNotification.classList.remove("toast-exit", "toast-enter");
            toastNotification.classList.add("toast-show");

            clearTimeout(toastNotification.timeout);
            toastNotification.timeout = setTimeout(() => {
                toastNotification.classList.remove("toast-show");
                toastNotification.classList.add("toast-exit");
            }, 5000);
        }
    };

    // Close toast button event listener
    toastCloseButton.addEventListener('click', () => {
        toastNotification.classList.remove("toast-show");
        toastNotification.classList.add("toast-exit");
    });


    // Function to update filter visibility (kelas and status for siswa only)
    function updateFilterVisibility() {
        if (currentAttendanceType === 'guru') {
            kelasFilterSelect.style.display = 'none';
            statusFilterSelect.style.display = 'none';
            classLabel.style.display = 'none';
            statusLabel.style.display = 'none';
            
            // Show absen datang/pulang buttons for guru
            btnAbsenDatang.style.display = 'inline-flex';
            btnAbsenPulang.style.display = 'inline-flex';
            btnAbsenDatang.classList.add('active'); // Default to 'Absen Datang' active
            btnAbsenPulang.classList.remove('active');
            currentDisplayMode = 'absen-datang'; // Reset display mode for guru
            
            guruHeader.style.display = 'table-header-group';
            siswaHeader.style.display = 'none';
        } else { // currentAttendanceType === 'siswa'
            kelasFilterSelect.style.display = 'inline-block';
            statusFilterSelect.style.display = 'inline-block';
            classLabel.style.display = 'inline-block';
            statusLabel.style.display = 'inline-block';

            // Hide absen datang/pulang buttons for siswa
            btnAbsenDatang.style.display = 'none';
            btnAbsenPulang.style.display = 'none';

            guruHeader.style.display = 'none';
            siswaHeader.style.display = 'table-header-group';
        }
    }

    // Function to render table based on current data and page
    function renderTable() {
        attendanceTableBody.innerHTML = ''; // Clear current table body
        const startIndex = (currentPage - 1) * rowsPerPage;
        const endIndex = Math.min(startIndex + rowsPerPage, filteredData.length);
        const paginatedData = filteredData.slice(startIndex, endIndex);

        if (paginatedData.length === 0) {
            attendanceTableBody.innerHTML = '<tr><td colspan="6" class="px-6 py-4 text-center text-gray-500">Tidak ada data yang ditemukan.</td></tr>';
            totalDataSpan.textContent = 0;
            currentRangeSpan.textContent = '0-0';
            updatePaginationControls(0);
            return;
        }

        if (currentAttendanceType === 'guru') {
            paginatedData.forEach(record => {
                const row = attendanceTableBody.insertRow();
                row.classList.add('hover:bg-gray-50');

                // Photo (Avatar)
                const avatarCell = row.insertCell();
                if (record.avatar) {
                    const imgAvatar = document.createElement('img');
                    imgAvatar.src = GURU_PROFILE_IMAGE_BASE_URL + record.avatar;
                    imgAvatar.alt = 'Profil Guru';
                    imgAvatar.classList.add('image-thumbnail');
                    imgAvatar.onerror = () => imgAvatar.src = 'https://via.placeholder.com/50/cccccc/ffffff?text=No+Img'; // Fallback image
                    imgAvatar.onclick = () => {
                        modalImage.src = imgAvatar.src;
                        imageModal.style.display = 'block';
                    };
                    avatarCell.appendChild(imgAvatar);
                } else {
                    avatarCell.textContent = '-';
                }

                // Nama Guru
                row.insertCell().textContent = record.name;
                // Tanggal
                row.insertCell().textContent = record.date;

                // Waktu and Status/Keterangan based on display mode
                let waktuDisplay = '';
                let statusDisplay = '';
                let fotoPresensi = '';
                let fotoPresensiAlt = '';

                if (currentDisplayMode === 'absen-datang') {
                    waktuDisplay = record.jam_datang || '-';
                    statusDisplay = record.jam_datang ? (record.jam_datang > "07:15:00" ? "Terlambat" : "Hadir") : "Belum Hadir";
                    fotoPresensi = record.foto_datang;
                    fotoPresensiAlt = 'Foto Datang';
                } else { // absen-pulang
                    waktuDisplay = record.jam_pulang || '-';
                    statusDisplay = record.jam_pulang ? "Pulang" : "Belum Pulang";
                    fotoPresensi = record.foto_pulang;
                    fotoPresensiAlt = 'Foto Pulang';
                }

                row.insertCell().textContent = waktuDisplay; // Waktu
                row.insertCell().textContent = statusDisplay; // Status

                // Keterangan (Photo Datang/Pulang)
                const keteranganCell = row.insertCell();
                if (fotoPresensi) {
                    const imgPresensi = document.createElement('img');
                    imgPresensi.src = PRESENSI_IMAGE_BASE_URL + fotoPresensi;
                    imgPresensi.alt = fotoPresensiAlt;
                    imgPresensi.classList.add('image-thumbnail');
                    imgPresensi.onerror = () => imgPresensi.src = 'https://via.placeholder.com/50/cccccc/ffffff?text=No+Img'; // Fallback
                    imgPresensi.onclick = () => {
                        modalImage.src = imgPresensi.src;
                        imageModal.style.display = 'block';
                    };
                    keteranganCell.appendChild(imgPresensi);
                } else {
                    keteranganCell.textContent = '-';
                }
            });
        } else { // currentAttendanceType === 'siswa'
            paginatedData.forEach(record => {
                const row = attendanceTableBody.insertRow();
                row.classList.add('hover:bg-gray-50');
                row.insertCell().textContent = record.name;
                row.insertCell().textContent = record.jenis_kelamin;
                row.insertCell().textContent = record.nis;
                row.insertCell().textContent = record.kelas;
                row.insertCell().textContent = record.tanggal;
                // Render badge for status
                const statusCell = row.insertCell();
                statusCell.innerHTML = `<span class="px-2 py-1 text-xs font-medium bg-${getBadgeColor(record.status)}-100 text-${getBadgeColor(record.status)}-800 rounded-full">${record.status}</span>`;
            });
        }

        updatePaginationControls(filteredData.length);
    }

    function getBadgeColor(status) {
        switch (status) {
            case 'hadir': return 'green';
            case 'sakit': return 'yellow';
            case 'izin': return 'blue';
            case 'alpa': return 'red';
            default: return 'gray';
        }
    }


    // Function to apply search filter
    function applySearchFilter() {
        const searchTerm = searchNameInput.value.toLowerCase().trim();
        if (searchTerm === '') {
            filteredData = [...allTableData];
        } else {
            filteredData = allTableData.filter(record => {
                const name = record.name ? record.name.toLowerCase() : '';
                // For students, also search by NIS
                const nis = record.nis ? record.nis.toLowerCase() : ''; 
                return name.includes(searchTerm) || (currentAttendanceType === 'siswa' && nis.includes(searchTerm));
            });
        }
        currentPage = 1; // Reset to first page after search
        renderTable();
    }

    // Function to fetch data from PHP backend
    async function fetchData() {
        loadingMessage.style.display = 'block';
        errorMessage.style.display = 'none';
        allTableData = [];
        filteredData = [];
        attendanceTableBody.innerHTML = ''; // Clear table
        
        const tipe = absenTypeSelect.value;
        const bulan = monthFilterSelect.value === 'semua' ? '' : monthFilterSelect.value;
        const kelas = kelasFilterSelect.value === 'semua' ? '' : kelasFilterSelect.value;
        const status = statusFilterSelect.value === 'semua' ? '' : statusFilterSelect.value;

        let url = `src/Api/tu_rekap_absensi.php?tipe=${tipe}&bulan=${bulan}`; // Adjust this path if it's different
        if (tipe === 'siswa') {
            if (kelas) url += `&kelas=${kelas}`;
            if (status) url += `&status=${status}`;
        }
        
        // Show a loading toast
        toast.show('info', 'Memuat Data', 'Sedang mengambil data absensi...');

        try {
            const response = await fetch(url);
            if (!response.ok) {
                const errorBody = await response.json().catch(() => response.text()); // Try JSON first, then plain text
                throw new Error(`HTTP error! status: ${response.status} - ${typeof errorBody === 'object' && errorBody.error ? errorBody.error : errorBody}`);
            }
            const result = await response.json();

            loadingMessage.style.display = 'none';

            if (result.error) {
                errorMessage.style.display = 'block';
                errorMessage.textContent = 'Error: ' + result.error;
                toast.show('error', 'Gagal Memuat', result.error);
                return;
            }

            allTableData = result;
            applySearchFilter(); // Apply initial search filter (empty string if no search term)
            toast.show('success', 'Data Berhasil Dimuat', `Menampilkan ${allTableData.length} data absensi.`);

        } catch (error) {
            loadingMessage.style.display = 'none';
            errorMessage.style.display = 'block';
            errorMessage.textContent = 'Terjadi kesalahan saat mengambil data: ' + error.message;
            toast.show('error', 'Kesalahan Jaringan', 'Gagal memuat data: ' + error.message);
            console.error('Fetch error:', error);
        }
    }

    // --- Pagination Functions ---
    function updatePaginationControls(totalRecords) {
        const totalPages = Math.ceil(totalRecords / rowsPerPage);
        
        prevPageButton.disabled = currentPage === 1;
        nextPageButton.disabled = currentPage === totalPages || totalRecords === 0;

        pageNumbersContainer.innerHTML = '';
        const maxPagesToShow = 5; // e.g., 1 2 3 4 5 ... 10

        let startPage = Math.max(1, currentPage - Math.floor(maxPagesToShow / 2));
        let endPage = Math.min(totalPages, startPage + maxPagesToShow - 1);

        if (endPage - startPage + 1 < maxPagesToShow) {
            startPage = Math.max(1, endPage - maxPagesToShow + 1);
        }

        if (startPage > 1) {
            appendPageButton(1, pageNumbersContainer);
            if (startPage > 2) {
                const span = document.createElement('span');
                span.textContent = '...';
                span.classList.add('px-2', 'py-1', 'text-sm', 'text-gray-500');
                pageNumbersContainer.appendChild(span);
            }
        }

        for (let i = startPage; i <= endPage; i++) {
            appendPageButton(i, pageNumbersContainer);
        }

        if (endPage < totalPages) {
            if (endPage < totalPages - 1) {
                const span = document.createElement('span');
                span.textContent = '...';
                span.classList.add('px-2', 'py-1', 'text-sm', 'text-gray-500');
                pageNumbersContainer.appendChild(span);
            }
            appendPageButton(totalPages, pageNumbersContainer);
        }

        // Update range text
        const startIndex = (currentPage - 1) * rowsPerPage;
        const endIndex = Math.min(startIndex + rowsPerPage, totalRecords);
        if (totalRecords === 0) {
            currentRangeSpan.textContent = '0-0';
        } else {
            currentRangeSpan.textContent = `${startIndex + 1}-${endIndex}`;
        }
        totalDataSpan.textContent = totalRecords;
    }

    function appendPageButton(pageNumber, container) {
        const button = document.createElement('button');
        button.textContent = pageNumber;
        button.classList.add('px-3', 'py-1', 'text-sm', 'rounded-md');
        if (pageNumber === currentPage) {
            button.classList.add('bg-blue-600', 'text-white');
        } else {
            button.classList.add('text-gray-700', 'hover:bg-gray-200');
        }
        button.addEventListener('click', () => {
            currentPage = pageNumber;
            renderTable();
        });
        container.appendChild(button);
    }

    // --- Export to PDF (Client-side, basic) ---
    function exportTableToPdf() {
        toast.show('info', 'Mengekspor PDF', 'Sedang menyiapkan data untuk PDF...');
        
        if (typeof window.jsPDF === 'undefined' || typeof window.jspdf.plugin === 'undefined') {
            toast.show('error', 'Gagal Export', 'jsPDF library tidak ditemukan. Pastikan sudah diimpor.');
            console.error('jsPDF library not loaded.');
            return;
        }

        const doc = new window.jsPDF.jsPDF();
        
        let head = [];
        let body = [];

        // Clone the table for PDF export to avoid modifying the displayed table
        const originalTable = document.getElementById('attendanceTable');
        const tempTable = originalTable.cloneNode(true);
        tempTable.style.visibility = 'hidden'; // Hide the cloned table
        document.body.appendChild(tempTable); // Append to body for html2canvas to work

        // Adjust headers and data based on current view
        if (currentAttendanceType === 'guru') {
            head = [['Nama Guru', 'Tanggal', 'Waktu', 'Status']]; // Exclude Foto columns for simplicity in PDF
            body = filteredData.map(record => {
                let waktu = '';
                let status = '';
                if (currentDisplayMode === 'absen-datang') {
                    waktu = record.jam_datang || '-';
                    status = record.jam_datang ? (record.jam_datang > "07:15:00" ? "Terlambat" : "Hadir") : "Belum Hadir";
                } else {
                    waktu = record.jam_pulang || '-';
                    status = record.jam_pulang ? "Pulang" : "Belum Pulang";
                }
                return [record.name, record.date, waktu, status];
            });
        } else { // siswa
            head = [['Nama Siswa', 'Jenis Kelamin', 'NIS', 'Kelas', 'Tanggal', 'Status']];
            body = filteredData.map(record => [
                record.name, record.jenis_kelamin, record.nis, record.kelas, record.tanggal, record.status
            ]);
        }
        
        doc.autoTable({
            head: head,
            body: body,
            startY: 20,
            headStyles: { fillColor: [30, 64, 175] }, // Dark blue header
            styles: { fontSize: 8, cellPadding: 3 },
            margin: { top: 10 },
            didDrawPage: function(data) {
                // Header
                doc.setFontSize(16);
                doc.setTextColor(40);
                doc.text(`Rekap Absensi ${currentAttendanceType === 'guru' ? 'Guru' : 'Siswa'}`, data.settings.margin.left, 15);
            }
        });

        doc.save(`rekap_absensi_${currentAttendanceType}_${new Date().toISOString().slice(0,10)}.pdf`);
        toast.show('success', 'Export Berhasil', 'Data absensi telah berhasil diekspor sebagai PDF.');
        document.body.removeChild(tempTable); // Clean up the cloned table
    }


    // --- Event Listeners ---
    absenTypeSelect.addEventListener('change', () => {
        currentAttendanceType = absenTypeSelect.value;
        // Reset specific filters when changing type
        monthFilterSelect.value = 'semua';
        kelasFilterSelect.value = 'semua';
        statusFilterSelect.value = 'semua';
        searchNameInput.value = ''; // Clear search
        
        updateFilterVisibility();
        fetchData(); // Fetch data for the new type
    });

    monthFilterSelect.addEventListener('change', fetchData);
    statusFilterSelect.addEventListener('change', fetchData);
    kelasFilterSelect.addEventListener('change', fetchData);
    searchNameInput.addEventListener('keyup', applySearchFilter); // Live search

    btnAbsenDatang.addEventListener('click', () => {
        if (currentAttendanceType === 'guru') {
            currentDisplayMode = 'absen-datang';
            btnAbsenDatang.classList.add('active');
            btnAbsenPulang.classList.remove('active');
            renderTable();
        }
    });

    btnAbsenPulang.addEventListener('click', () => {
        if (currentAttendanceType === 'guru') {
            currentDisplayMode = 'absen-pulang';
            btnAbsenDatang.classList.remove('active');
            btnAbsenPulang.classList.add('active');
            renderTable();
        }
    });

    prevPageButton.addEventListener('click', () => {
        if (currentPage > 1) {
            currentPage--;
            renderTable();
        }
    });

    nextPageButton.addEventListener('click', () => {
        const totalPages = Math.ceil(filteredData.length / rowsPerPage);
        if (currentPage < totalPages) {
            currentPage++;
            renderTable();
        }
    });

    // Close modal functionality
    closeModal.onclick = function() {
        imageModal.style.display = "none";
    }
    window.onclick = function(event) {
        if (event.target == imageModal) {
            imageModal.style.display = "none";
        }
    }

    // Toggle sidebar
    const toggleSidebarBtn = document.getElementById('toggle-sidebar');
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('overlay');
    const mainContent = document.getElementById('main-content'); // Assuming this exists

    toggleSidebarBtn.addEventListener('click', () => {
        sidebar.classList.toggle('active');
        overlay.classList.toggle('active');
        if (mainContent) mainContent.classList.toggle('active'); // Toggle main-content if it exists
    });

    overlay.addEventListener('click', () => {
        sidebar.classList.remove('active');
        overlay.classList.remove('active');
        if (mainContent) mainContent.classList.remove('active');
    });

    // Initial setup and data load
    updateFilterVisibility(); // Set initial filter visibility (siswa by default)
    fetchData(); // Load initial data

    // --- PDF Export setup ---
    btnExportPdf.addEventListener('click', exportTableToPdf);
});