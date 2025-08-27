<?php
session_start(); // Mulai sesi di awal skrip

header('Content-Type: application/json'); // Set header untuk memberitahu klien bahwa respons adalah JSON


ini_set('display_errors', 1);
ini_set('display_startup_errors', 1);
error_reporting(E_ALL);

include "../config/config.php";

if (!isset($_POST['id']) || !isset($_POST['password'])) {
    echo json_encode(['success' => false, 'message' => 'ID atau password tidak tersedia.']);
    exit; // Berhenti di sini
}

// --- Sanitasi Input ---
// Ambil dan sanitasi ID untuk mencegah XSS (Cross-Site Scripting) jika ID pernah ditampilkan.
// Kata sandi tidak perlu disanitasi dengan htmlspecialchars karena akan diverifikasi hash-nya.
$id = htmlspecialchars($_POST['id'], ENT_QUOTES, 'UTF-8');
$password_input = $_POST['password'];

// --- Query Database untuk Data Guru ---
// Siapkan prepared statement untuk mengambil data guru, termasuk hashed password dan wali_kelas.
// Menggunakan prepared statement sangat penting untuk mencegah SQL Injection.
$stmt = $conn->prepare("SELECT id_guru, ID, nama_guru, password, wali_kelas FROM guru WHERE ID = ?");

// Tangani jika persiapan statement gagal (misal, ada masalah koneksi database atau syntax query salah).
if (!$stmt) {
    error_log("Gagal menyiapkan query database: " . $conn->error); // Catat error ke log server
    echo json_encode(['success' => false, 'message' => 'Terjadi kesalahan sistem. Silakan coba lagi nanti.']);
    exit;
}

// Bind parameter 'id' ke statement. 's' menunjukkan tipe data string.
$stmt->bind_param("s", $id);
$stmt->execute(); // Jalankan query
$result = $stmt->get_result(); // Dapatkan hasilnya

// --- Proses Hasil Query ---
// Periksa apakah ada baris data guru yang ditemukan.
if ($result->num_rows > 0) {
    $guru = $result->fetch_assoc(); // Ambil data guru sebagai array asosiatif
    $hashed_password_db = $guru['password']; // Dapatkan hashed password dari database

    // Verifikasi password yang diinput oleh pengguna dengan hashed password di database.
    // password_verify() adalah cara yang aman untuk melakukan ini.
    if (password_verify($password_input, $hashed_password_db)) {
        // --- Login Berhasil ---
        // Jika password cocok, ambil langsung nilai wali_kelas dari kolom database.
        $kelasWali = $guru['wali_kelas']; // Contoh: "Wali Kelas 9" atau NULL

        // --- Simpan Data ke Sesi ---
        // Simpan informasi penting guru ke dalam variabel sesi untuk penggunaan di halaman lain.
        $_SESSION['guru_id'] = $guru['id_guru'];
        $_SESSION['nama_guru'] = $guru['nama_guru'];
        $_SESSION['ID'] = $guru['ID'];
        $_SESSION['kelas_wali'] = $kelasWali; // Informasi ini bisa digunakan untuk filter data

        // --- Kirim Respons Sukses ---
        echo json_encode([
            'success' => true,
            'name' => $guru['nama_guru'],
            'kelas_wali' => $kelasWali // Mengirimkan nilai lengkap 'Wali Kelas X' atau NULL
        ]);
    } else {
        // --- Password Tidak Cocok ---
        // Kirim respons error jika password tidak valid.
        echo json_encode(['success' => false, 'message' => 'ID/Nama atau password Pegawai tidak valid.']);
    }
} else {
    // --- ID/Nama Tidak Ditemukan ---
    // Kirim respons error jika ID yang dimasukkan tidak ada di database.
    echo json_encode(['success' => false, 'message' => 'ID/Nama tidak ditemukan.']);
}

// --- Tutup Koneksi Database ---
// Penting untuk selalu menutup koneksi setelah selesai menggunakannya.
$conn->close();
?>