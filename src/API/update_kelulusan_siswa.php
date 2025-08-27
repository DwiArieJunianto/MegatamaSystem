<?php
header('Content-Type: application/json');
include '../config/config.php'; // Sesuaikan path jika file config.php berada di direktori yang berbeda

// Menerima data JSON dari body request
$input = json_decode(file_get_contents("php://input"), true);

if (!$input || !isset($input['nis']) || !isset($input['status'])) {
    echo json_encode(['success' => false, 'message' => 'Data tidak valid. NIS atau status tidak ditemukan.']);
    exit;
}

$nis = mysqli_real_escape_string($conn, $input['nis']);
$status = mysqli_real_escape_string($conn, $input['status']);

// Pastikan status yang diterima sesuai dengan ENUM di database jika ada
// ENUM('Aktif','Tidak Aktif','Lulus') di tabel siswa
// Namun, di script kelulusan ini kita menggunakan 'Lulus'/'Tidak Lulus'
// Kita perlu memastikan 'status' di tabel siswa bisa menampung 'Lulus'/'Tidak Lulus'
// Jika kolom 'status' di tabel 'siswa' hanya ada 'Aktif' dan 'Tidak Aktif', maka Anda perlu:
// 1. Mengubah ENUM di DB menjadi: status ENUM('Aktif','Tidak Aktif','Lulus','Tidak Lulus')
// 2. Atau membuat kolom baru di tabel siswa untuk status kelulusan (misal: status_kelulusan)

// Asumsi kolom 'status' di tabel 'siswa' sudah diperbarui untuk menampung 'Lulus' dan 'Tidak Lulus'
$query_update = "UPDATE siswa SET status = '$status' WHERE nis = '$nis'";

if (mysqli_query($conn, $query_update)) {
    echo json_encode(['success' => true, 'message' => 'Status siswa berhasil diperbarui.']);
} else {
    echo json_encode(['success' => false, 'message' => 'Gagal memperbarui status siswa: ' . mysqli_error($conn)]);
}

mysqli_close($conn);
?>