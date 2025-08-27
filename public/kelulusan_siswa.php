<?php
session_start();

include "../src/config/config.php"; // Pastikan path ini benar

// Cek apakah user sudah login sebagai guru
if (empty($_SESSION['guru_id']) || empty($_SESSION['nama_guru'])) {
    // Redirect ke halaman login jika belum login
    header("Location: login.html");
    exit();
}
$id_guru = $_SESSION['guru_id'];

// Dapatkan kolom 'wali_kelas' dan 'foto_url' dari tabel 'guru' untuk ditampilkan di header
$guru_profil_query = mysqli_query($conn, "SELECT nama_guru, foto_url, wali_kelas FROM guru WHERE id_guru = '$id_guru'");

$nama_guru_display = "Guru";
$foto_guru_display = "path/to/default/avatar.png"; // Default fallback image
$wali_kelas_string_db = null;

if ($guru_profil_query && mysqli_num_rows($guru_profil_query) > 0) {
    $profil_guru_data = mysqli_fetch_assoc($guru_profil_query);
    $nama_guru_display = htmlspecialchars($profil_guru_data['nama_guru']);
    $foto_guru_display = htmlspecialchars($profil_guru_data['foto_url']); // Path relatif dari folder src/img/guru
    $wali_kelas_string_db = $profil_guru_data['wali_kelas'];
} else {
    // Jika data guru tidak ditemukan, log out saja atau berikan pesan error
    // header("Location: login.html"); // Pilihan lain
    // exit();
}


$is_wali_kelas = false; // Flag to determine if the teacher is a homeroom teacher
$assigned_class_number = null;

// Cek apakah guru adalah wali kelas dan dapatkan nomor kelasnya
if (!empty($wali_kelas_string_db) && strpos($wali_kelas_string_db, 'Wali Kelas') !== false) {
    $is_wali_kelas = true;
    if (preg_match('/Wali Kelas (\d+)/', $wali_kelas_string_db, $matches)) {
        $assigned_class_number = (int)$matches[1];
    }
}

// Jika guru BUKAN wali kelas atau tidak memiliki kelas yang ditugaskan, arahkan
if (!$is_wali_kelas || $assigned_class_number === null) {
    header("Location: naik_kelas_tidak_diizinkan.php"); // Atau halaman lain yang sesuai
    exit();
}

// include "layout/header.php"; // Ini mungkin perlu disesuaikan jika header.php Anda sudah lengkap dengan tag <body> dan <main>

?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Kelulusan Siswa - Yayasan Megatama Jambi</title>
    <link rel="stylesheet" href="css/final.css">
    <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700&display=swap" rel="stylesheet">
    <link href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css" rel="stylesheet">
    <style>
        /* Animasi untuk toast */
        .toast-enter { transform: translateX(100%) translateY(-100%); opacity: 0; }
        .toast-show { transform: translateX(0) translateY(0); opacity: 1; }
        .toast-exit { transform: translateX(100%) translateY(-100%); opacity: 0; }
        .toast-transition { transition: all 0.3s ease-out; }
        /* Modal Overlay for Kelulusan */
        .modal-overlay-naik-kelas {
            display: none;
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.5);
            justify-content: center;
            align-items: center;
            z-index: 1000;
        }
        .modal-overlay-naik-kelas.show {
            display: flex;
        }
        .modal-container-naik-kelas {
            background: #fff;
            padding: 20px;
            border-radius: 8px;
            box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
            width: 90%;
            max-width: 400px;
            text-align: center;
        }
        .modal-header-naik-kelas {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 15px;
            border-bottom: 1px solid #eee;
            padding-bottom: 10px;
        }
        .modal-title-naik-kelas {
            font-size: 1.25rem;
            font-weight: 600;
            color: #333;
        }
        .modal-close-naik-kelas {
            background: none;
            border: none;
            font-size: 1.5rem;
            cursor: pointer;
            color: #777;
        }
        .modal-body-naik-kelas {
            margin-bottom: 20px;
        }
        .modal-footer-naik-kelas {
            display: flex;
            justify-content: flex-end;
            gap: 10px;
        }
        .btn-success {
            background-color: #28a745;
            color: white;
            padding: 8px 12px;
            border-radius: 5px;
            border: none;
            cursor: pointer;
        }
        .btn-danger {
            background-color: #dc3545;
            color: white;
            padding: 8px 12px;
            border-radius: 5px;
            border: none;
            cursor: pointer;
        }
        .btn-gradient {
            background: linear-gradient(to right, #1e40af, #3b82f6);
            color: white;
            padding: 8px 16px;
            border-radius: 6px;
            font-weight: 500;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            transition: all 0.2s ease-in-out;
            box-shadow: 0 2px 6px rgba(59, 130, 246, 0.3);
        }
        .btn-gradient:hover {
            box-shadow: 0 4px 12px rgba(59, 130, 246, 0.4);
        }
        .pagination-item.active {
            background-color: #007bff;
            color: white;
            border-radius: 4px;
        }
        .pagination-item {
            padding: 6px 12px;
            border: 1px solid #ddd;
            cursor: pointer;
            margin: 0 2px;
            border-radius: 4px;
        }
        .pagination-item:disabled {
            cursor: not-allowed;
            opacity: 0.5;
        }
        .table-row:hover {
            background-color: #f5f5f5;
        }
    </style>
</head>
<body class="font-poppins mode-2">
    <div id="overlay" class="overlay"></div>

    <div id="sidebar" class="sidebar text-white flex flex-col">
        <div class="flex items-center p-3 border-b border-blue-800">
            <div class="flex items-center">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 text-white" viewBox="0 0 20 20" fill="currentColor">
                    <path d="M10.394 2.08a1 1 0 00-.788 0l-7 3a1 1 0 000 1.84L5.25 8.051a.999.999 0 01.356-.257l4-1.714a1 1 0 11.788 1.838L7.667 9.088l1.94.831a1 1 0 00.787 0l7-3a1 1 0 000-1.838l-7-3zM3.31 9.397L5 10.12v4.102a8.969 8.969 0 00-1.05-.174 1 1 0 01-.89-.89 11.115 11.115 0 01.25-3.762zM9.3 16.573A9.026 9.026 0 007 14.935v-3.957l1.818.78a3 3 0 002.364 0l5.508-2.361a11.026 11.026 0 01.25 3.762 1 1 0 01-.89.89 8.968 8.968 0 00-5.35 2.524 1 1 0 01-1.4 0zM6 18a1 1 0 001-1v-2.065a8.935 8.935 0 00-2-.712V17a1 1 0 001 1z" />
                </svg>
                <h1 class="text-base font-bold ml-3 logo-text">Yayasan Megatama</h1>
            </div>
        </div>

        <div class="p-3">
            <p class="text-xs text-blue-300 mb-2 logo-text">Menu</p>
            <nav class="space-y-1">
                <a href="dashboard_guru.php" class="menu-item px-3 py-2 text-sm font-medium rounded-md text-blue-200">
                    <div class="menu-icon">
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-blue-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                        </svg>
                    </div>
                    <span class="menu-text">Dashboard</span>
                </a>
                <a href="riwayat_presensi_guru.php" class="menu-item px-3 py-2 text-sm font-medium rounded-md text-blue-200">
                    <div class="menu-icon">
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-blue-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                    </div>
                    <span class="menu-text">Riwayat Presensi</span>
                </a>
                <a href="presensi_siswa.php" class="menu-item px-3 py-2 text-sm font-medium rounded-md text-blue-200">
                    <div class="menu-icon">
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-blue-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                        </svg>
                    </div>
                    <span class="menu-text">Presensi Siswa</span>
                </a>

                <a href="kelulusan_siswa.php" class="menu-item active px-3 py-2 text-sm font-medium rounded-md bg-blue-800 text-white">
                    <div class="menu-icon">
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                    </div>
                    <span class="menu-text">Kelulusan Siswa</span>
                </a>
                
                <a href="settings_guru.php" class="menu-item px-3 py-2 text-sm font-medium rounded-md text-blue-200">
                    <div class="menu-icon">
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-blue-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                    </div>
                    <span class="menu-text">Settings</span>
                </a>
            </nav>
        </div>

        <div class="mt-auto p-3 border-t border-blue-800">
            <a href="../src/api/logout.php" class="menu-item px-3 py-2 text-sm font-medium text-blue-200 rounded-md">
                <div class="menu-icon">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-blue-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                    </svg>
                </div>
                <span class="menu-text">Logout</span>
            </a>
        </div>
    </div>
    <div id="main-content" class="main-content">
        <header class="bg-white shadow-sm border-b border-gray-200">
            <div class="px-5 py-2 flex items-center justify-between">
                <div class="flex items-center">
                    <button id="toggle-sidebar" class="p-2 rounded-md text-gray-500 hover:text-gray-600 hover:bg-gray-100 focus:outline-none">
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h7" />
                        </svg>
                    </button>
                    <h1 class="ml-3 text-lg font-semibold text-gray-800">Kelulusan Siswa</h1>
                </div>
                <div class="flex items-center">
                    <div class="flex items-center">
                        <div class="avatar-ring">
                            <img class="h-8 w-8 rounded-full object-cover" src="../src/img/guru/<?= $foto_guru_display ?>" alt="User avatar">
                        </div>
                        <span class="ml-2 text-sm font-medium text-gray-700"><?= $nama_guru_display ?></span>
                    </div>
                </div>
            </div>
        </header>
        <main class="p-4 bg-pattern">
            <div class="card mb-4">
                <div class="card-header flex flex-col md:flex-row md:items-center justify-between gap-3">
                    <h3 class="text-base font-medium text-gray-700">Tabel Data Kelulusan Siswa <span id="current-class-display" class="text-blue-600"></span></h3>
                    <div class="flex flex-wrap gap-2">
                        <button id="btn-set-all-lulus" class="btn-success flex items-center">
                            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            Set Semua Lulus
                        </button>
                        <button id="btn-export-pdf" class="btn-gradient flex items-center">
                            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24"
                                stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                                    d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                            Export Data
                        </button>
                    </div>
                </div>
                <div class="p-3">
                    <div class="overflow-x-auto">
                        <table class="w-full" id="kelulusan-table">
                            <thead class="table-header text-xs font-medium text-gray-500 uppercase tracking-wider">
                                <tr>
                                    <th class="px-4 py-3 text-left">No</th>
                                    <th class="px-4 py-3 text-left">Nama Lengkap</th>
                                    <th class="px-4 py-3 text-left">NIS</th>
                                    <th class="px-4 py-3 text-left">Kelas</th>
                                    <th class="px-4 py-3 text-left">Status Kelulusan</th>
                                    <th class="px-4 py-3 text-left">Aksi</th>
                                </tr>
                            </thead>
                            <tbody id="student-data" class="bg-white divide-y divide-gray-200 text-sm">
                            </tbody>
                        </table>
                    </div>

                    <div class="flex items-center justify-between mt-4">
                        <div id="pagination-info" class="text-sm text-gray-500">
                            Menampilkan 1-10 dari 30 data
                        </div>
                        <div class="flex items-center space-x-1">
                            <button id="prev-page" class="pagination-item text-gray-500" disabled>
                                <i class="fas fa-chevron-left"></i>
                            </button>
                            <div id="pagination-numbers" class="flex items-center space-x-1">
                            </div>
                            <button id="next-page" class="pagination-item text-gray-500">
                                <i class="fas fa-chevron-right"></i>
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </main>
    </div>

    <div id="confirmation-modal" class="modal-overlay-naik-kelas">
        <div class="modal-container-naik-kelas">
            <div class="modal-header-naik-kelas">
                <h3 class="modal-title-naik-kelas">Konfirmasi Kelulusan Siswa</h3>
                <button class="modal-close-naik-kelas" onclick="closeModal()">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24"
                        stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                            d="M6 18L18 6M6 6l12 12" />
                    </svg>
                </button>
            </div>
            <div class="modal-body-naik-kelas">
                <p id="modal-message-naik-kelas" class="text-gray-600 text-center mb-2"></p>
                <p id="modal-submessage-naik-kelas" class="text-sm text-gray-500 text-center"></p>
            </div>
            <div class="modal-footer-naik-kelas">
                <button onclick="closeModal()"
                    class="px-4 py-2 text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50">
                    Batal
                </button>
                <button id="confirm-action" class="btn-gradient">
                    Konfirmasi
                </button>
            </div>
        </div>
    </div>
    <div id="toast-notification" class="fixed top-4 right-4 z-50 toast-enter toast-transition">
        <div class="bg-white rounded-lg shadow-lg border-l-4 p-4 max-w-sm">
            <div class="flex items-center">
                <div id="toast-icon" class="mr-3"></div>
                <div class="flex-1">
                    <h4 id="toast-title" class="font-semibold text-gray-800"></h4>
                    <p id="toast-message" class="text-sm text-gray-600"></p>
                </div>
                <button id="toast-close" class="ml-2 text-gray-400 hover:text-gray-600">
                    <i class="fas fa-times"></i>
                </button>
            </div>
        </div>
    </div>
<script>
    // Pastikan variabel assignedClassNumber tersedia di lingkup global untuk kelulusan_siswa.js
    const assignedClassNumber = <?php echo json_encode($assigned_class_number); ?>;
</script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js"></script>
<script>
    document.addEventListener("DOMContentLoaded", function () {
        // initializeExportPDF(); // Akan dipanggil di kelulusan_siswa.js
    });
</script>

<script src="js/kelulusan_siswa.js"></script>
</body>
</html>