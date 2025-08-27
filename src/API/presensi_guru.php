<?php
session_start();
include "../config/config.php"; // Pastikan path ini benar dan file config.php menginisialisasi $conn

header('Content-Type: application/json');

// Validasi data yang diterima dari frontend
$identity = $_POST['identity'] ?? '';
$password = $_POST['password'] ?? ''; // Password dari input user (plain text)
$imageData = $_POST['image'] ?? null;

// Cek kelengkapan data
if (!$identity || !$password || !$imageData) {
    http_response_code(400);
    echo json_encode([
        "status" => "error",
        "message" => "Data tidak lengkap. Mohon isi semua kolom."
    ]);
    exit;
}

// Ekstrak NIP dari identity (misal: "1001 - Nama Guru")
// Menggunakan explode untuk memisahkan ID dan Nama
$parts = explode(' - ', $identity);
$nip = trim($parts[0]); // Ambil bagian pertama sebagai NIP

// Cek guru di database berdasarkan NIP
$stmt = $conn->prepare("SELECT id_guru, nama_guru, ID, password FROM guru WHERE ID = ?");
if (!$stmt) {
    http_response_code(500);
    echo json_encode([
        "status" => "error",
        "message" => "Gagal menyiapkan query guru: " . $conn->error
    ]);
    exit;
}
$stmt->bind_param("s", $nip);
$stmt->execute();
$result = $stmt->get_result();

if ($result->num_rows !== 1) {
    http_response_code(404);
    echo json_encode([
        "status" => "error",
        "message" => "ID Guru tidak ditemukan atau data ganda."
    ]);
    exit;
}

$data = $result->fetch_assoc();
$stmt->close();

// Verifikasi password menggunakan password_verify()
// $password adalah plain text dari input user
// $data['password'] adalah hash dari database
if (!password_verify($password, $data['password'])) { // PERUBAHAN UTAMA DI SINI
    http_response_code(401);
    echo json_encode([
        "status" => "error",
        "message" => "Password tidak sesuai." // Pesan error tetap sama untuk konsistensi
    ]);
    exit;
}

// Proses presensi jika password cocok
$guru_id = $data['id_guru'];
$tanggal = date('Y-m-d');
$jam_sekarang = date('H:i:s');

// Simpan foto
$uploadDir = __DIR__ . "/../img/upload/";
if (!is_dir($uploadDir)) {
    mkdir($uploadDir, 0755, true);
}

$filename = "presensi__" . time() . ".png";
$base64 = explode(',', $imageData)[1];
$decoded = base64_decode($base64);
if (file_put_contents($uploadDir . $filename, $decoded) === false) {
    http_response_code(500);
    echo json_encode([
        "status" => "error",
        "message" => "Gagal menyimpan file gambar."
    ]);
    exit;
}

// Cek presensi hari ini untuk guru_id dan tanggal ini
$stmt_cek = $conn->prepare("SELECT * FROM absen_guru WHERE id_guru = ? AND tanggal = ?");
if (!$stmt_cek) {
    http_response_code(500);
    echo json_encode([
        "status" => "error",
        "message" => "Gagal menyiapkan query cek presensi: " . $conn->error
    ]);
    exit;
}
$stmt_cek->bind_param("is", $guru_id, $tanggal);
$stmt_cek->execute();
$cek_result = $stmt_cek->get_result();
$data_absen = $cek_result->fetch_assoc();
$stmt_cek->close();


if ($cek_result->num_rows > 0) {
    // Sudah absen datang → update jam pulang
    $stmt_update = $conn->prepare("UPDATE absen_guru SET jam_pulang = ?, foto_pulang = ? WHERE id_guru = ? AND tanggal = ?");
    if (!$stmt_update) {
        http_response_code(500);
        echo json_encode([
            "status" => "error",
            "message" => "Gagal menyiapkan query update presensi pulang: " . $conn->error
        ]);
        exit;
    }
    $stmt_update->bind_param("ssis", $jam_sekarang, $filename, $guru_id, $tanggal);
    if ($stmt_update->execute()) {
        $presensi = "pulang";
        $message = "Presensi pulang berhasil.";
        $judul = 'Presensi Pulang Berhasil';
        $tipe = 'pulang';
        $waktu = date('Y-m-d H:i:s');

        // Insert aktivitas
        $stmt_aktivitas = $conn->prepare("INSERT INTO aktivitas (id_guru, judul, tipe, waktu) VALUES (?, ?, ?, ?)");
        if ($stmt_aktivitas) {
            $stmt_aktivitas->bind_param("isss", $guru_id, $judul, $tipe, $waktu);
            $stmt_aktivitas->execute();
            $stmt_aktivitas->close();
        } else {
            // Log error jika insert aktivitas gagal, tapi jangan hentikan presensi utama
            error_log("Gagal menyiapkan query insert aktivitas: " . $conn->error);
        }
    } else {
        http_response_code(500);
        echo json_encode([
            "status" => "error",
            "message" => "Gagal menyimpan presensi pulang: " . $stmt_update->error
        ]);
        exit;
    }
    $stmt_update->close();
} else {
    // Absen pertama (datang)
    $stmt_insert = $conn->prepare("INSERT INTO absen_guru (id_guru, tanggal, jam_datang, foto_datang) VALUES (?, ?, ?, ?)");
    if (!$stmt_insert) {
        http_response_code(500);
        echo json_encode([
            "status" => "error",
            "message" => "Gagal menyiapkan query insert presensi datang: " . $conn->error
        ]);
        exit;
    }
    $stmt_insert->bind_param("isss", $guru_id, $tanggal, $jam_sekarang, $filename);
    if ($stmt_insert->execute()) {
        $_SESSION['nama_guru'] = $data['nama_guru'];
        $_SESSION['id_guru'] = $data['id_guru'];
        $presensi = "datang";
        $message = "Presensi datang berhasil.";

        $judul = 'Presensi Datang Berhasil';
        $tipe = 'datang';
        $waktu = date('Y-m-d H:i:s');

        // Insert aktivitas
        $stmt_aktivitas = $conn->prepare("INSERT INTO aktivitas (id_guru, judul, tipe, waktu) VALUES (?, ?, ?, ?)");
        if ($stmt_aktivitas) {
            $stmt_aktivitas->bind_param("isss", $guru_id, $judul, $tipe, $waktu);
            $stmt_aktivitas->execute();
            $stmt_aktivitas->close();
        } else {
            // Log error jika insert aktivitas gagal, tapi jangan hentikan presensi utama
            error_log("Gagal menyiapkan query insert aktivitas: " . $conn->error);
        }
    } else {
        http_response_code(500);
        echo json_encode([
            "status" => "error",
            "message" => "Gagal menyimpan presensi datang: " . $stmt_insert->error
        ]);
        exit;
    }
    $stmt_insert->close();
}

// Response akhir
echo json_encode([
    "status" => "success",
    "message" => $message,
    "presensi" => $presensi,
    "name" => $data['nama_guru'],
    "nip" => $data['ID']
]);

$conn->close();

?>