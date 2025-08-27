<?php
header('Content-Type: application/json');
include '../config/config.php'; // Sesuaikan path ke file config Anda

// Ambil parameter kelas dari request
$kelas = $_GET['kelas'] ?? null;

$query = "SELECT nis, nama_siswa AS name, kelas AS class, jenis_kelamin AS gender, no_hp AS phone FROM siswa";
$conditions = [];

if ($kelas) {
    // Tambahkan kondisi WHERE untuk memfilter berdasarkan kelas
    // Pastikan kelas di DB adalah string
    $conditions[] = "kelas = '" . mysqli_real_escape_string($conn, $kelas) . "'";
}

if (!empty($conditions)) {
    $query .= " WHERE " . implode(" AND ", $conditions);
}

// Tambahkan pengurutan agar data konsisten
$query .= " ORDER BY kelas ASC, nama_siswa ASC";

$result = mysqli_query($conn, $query);

$siswa_data = [];
if ($result) {
    while ($row = mysqli_fetch_assoc($result)) {
        // Tambahkan status default 'pending' untuk siswa yang belum diproses di frontend
        $row['status'] = 'pending';
        // Konversi nis menjadi id untuk konsistensi dengan logika JS
        // Di DB Anda, nis adalah primary key siswa, jadi bisa dijadikan id di frontend
        $row['id'] = $row['nis'];
        $siswa_data[] = $row;
    }
    echo json_encode($siswa_data);
} else {
    http_response_code(500);
    echo json_encode(['error' => 'Query gagal: ' . mysqli_error($conn)]);
}

mysqli_close($conn);
?>