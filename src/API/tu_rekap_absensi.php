<?php
header('Content-Type: application/json');
include '../config/config.php'; // Sesuaikan path ke file config Anda

$tipe = $_GET['tipe'] ?? 'guru';
$bulan = $_GET['bulan'] ?? '';
$kelas = $_GET['kelas'] ?? '';
$status_kehadiran = $_GET['status'] ?? '';

$bulanMap = [
    'januari' => '01', 'februari' => '02', 'maret' => '03',
    'april' => '04', 'mei' => '05', 'juni' => '06',
    'juli' => '07', 'agustus' => '08', 'september' => '09',
    'oktober' => '10', 'november' => '11', 'desember' => '12'
];

$response = [];

if ($tipe === 'guru') {
    $query = "SELECT g.nama_guru AS name, g.foto_url AS avatar, 
                     a.tanggal AS date, a.jam_datang, a.jam_pulang,
                     a.foto_datang, a.foto_pulang
              FROM absen_guru a 
              JOIN guru g ON a.id_guru = g.id_guru
              WHERE 1=1";

    if (!empty($bulan) && isset($bulanMap[$bulan])) {
        $monthNum = $bulanMap[$bulan];
        $query .= " AND MONTH(a.tanggal) = '$monthNum'";
    }

    $query .= " ORDER BY a.tanggal DESC, a.jam_datang DESC";

    $result = mysqli_query($conn, $query);
    if (!$result) {
        http_response_code(500);
        echo json_encode(["error" => "Query Gagal (Guru): " . mysqli_error($conn)]);
        exit;
    }

    while ($row = mysqli_fetch_assoc($result)) {
        $response[] = $row;
    }
} else { // tipe === 'siswa'
    $query = "SELECT s.nama_siswa AS name, s.nis, s.kelas, s.jenis_kelamin, 
                     ab.tanggal, a.status 
              FROM absen_siswa a
              JOIN siswa s ON a.nis = s.nis
              JOIN absen ab ON a.id_absen = ab.id_absen
              WHERE 1=1";

    if (!empty($kelas) && $kelas !== 'semua') {
        $query .= " AND s.kelas = '" . mysqli_real_escape_string($conn, $kelas) . "'";
    }

    if (!empty($status_kehadiran) && $status_kehadiran !== 'semua') {
        $query .= " AND a.status = '" . mysqli_real_escape_string($conn, $status_kehadiran) . "'";
    }

    if (!empty($bulan) && isset($bulanMap[$bulan])) {
        $monthNum = $bulanMap[$bulan];
        $query .= " AND MONTH(ab.tanggal) = '$monthNum'";
    }
    
    $query .= " ORDER BY ab.tanggal DESC, s.kelas ASC, s.nama_siswa ASC";


    $result = mysqli_query($conn, $query);
    if (!$result) {
        http_response_code(500);
        echo json_encode(["error" => "Query Gagal (Siswa): " . mysqli_error($conn)]);
        exit;
    }

    while ($row = mysqli_fetch_assoc($result)) {
        $response[] = $row;
    }
}

echo json_encode($response);
?>