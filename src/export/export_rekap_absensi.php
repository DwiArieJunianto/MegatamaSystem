<?php
require __DIR__ . '/../../vendor/autoload.php';
require __DIR__ . '/../config/config.php';

use PhpOffice\PhpSpreadsheet\Spreadsheet;
use PhpOffice\PhpSpreadsheet\Writer\Xlsx;

$tipe = $_GET['tipe'] ?? 'guru';
$bulan = $_GET['bulan'] ?? '';
$kelas = $_GET['kelas'] ?? '';
$status = $_GET['status'] ?? '';

$bulanMap = [
  'januari' => '01', 'februari' => '02', 'maret' => '03',
  'april' => '04', 'mei' => '05', 'juni' => '06',
  'juli' => '07', 'agustus' => '08', 'september' => '09',
  'oktober' => '10', 'november' => '11', 'desember' => '12'
];

$data = [];
$spreadsheet = new Spreadsheet();
$sheet = $spreadsheet->getActiveSheet();

if ($tipe === 'guru') {
    $query = "SELECT g.nama_guru AS name, a.tanggal, a.jam_datang, a.jam_pulang
              FROM absen_guru a
              JOIN guru g ON a.id_guru = g.id_guru
              WHERE 1=1";

    if (!empty($bulan) && isset($bulanMap[$bulan])) {
        $monthNum = $bulanMap[$bulan];
        $query .= " AND MONTH(a.tanggal) = '$monthNum'";
    }

    $result = mysqli_query($conn, $query);
    if (!$result) {
        die("Query gagal: " . mysqli_error($conn));
    }

    $data[] = ['Nama', 'Tanggal', 'Jam Datang', 'Jam Pulang', 'Keterangan'];

    while ($row = mysqli_fetch_assoc($result)) {
        $jamDatang = $row['jam_datang'] ?? null;
        $jamPulang = $row['jam_pulang'] ?? null;

        $datang = $jamDatang ? "✅" : "❌";
        $pulang = $jamPulang ? "✅" : "❌";
        $keterangan = "$datang|$pulang";

        $data[] = [
            $row['name'],
            $row['tanggal'],
            $jamDatang ?: '-',
            $jamPulang ?: '-',
            $keterangan
        ];
    }
} else {
    $query = "SELECT s.nama_siswa AS name, s.nis, s.kelas, s.jenis_kelamin,
                     ab.tanggal, a.status
              FROM absen_siswa a
              JOIN siswa s ON a.nis = s.nis
              JOIN absen ab ON a.id_absen = ab.id_absen
              WHERE 1=1";

    if (!empty($kelas)) {
        $query .= " AND s.kelas = '$kelas'";
    }

    if (!empty($status)) {
        $query .= " AND a.status = '$status'";
    }

    if (!empty($bulan) && isset($bulanMap[$bulan])) {
        $monthNum = $bulanMap[$bulan];
        $query .= " AND MONTH(ab.tanggal) = '$monthNum'";
    }

    $result = mysqli_query($conn, $query);
    if (!$result) {
        die("Query gagal: " . mysqli_error($conn));
    }

    $data[] = ['Nama', 'NIS', 'Kelas', 'Jenis Kelamin', 'Tanggal', 'Status'];

    while ($row = mysqli_fetch_assoc($result)) {
        $data[] = [
            $row['name'],
            $row['nis'],
            $row['kelas'],
            $row['jenis_kelamin'],
            $row['tanggal'],
            $row['status']
        ];
    }
}

// Isi spreadsheet
foreach ($data as $rowIdx => $rowData) {
    foreach ($rowData as $colIdx => $value) {
        $cell = chr(65 + $colIdx) . ($rowIdx + 1); // A1, B1, ...
        $sheet->setCellValue($cell, $value);
    }
}

// Simpan ke folder src/export
$filename = "rekap-absensi-$tipe-" . date('Ymd-His') . ".xlsx";
$savePath = __DIR__ . "/../export/$filename";

$writer = new Xlsx($spreadsheet);
$writer->save($savePath);

echo json_encode([
  "status" => "success",
  "message" => "File berhasil disimpan di folder export/",
  "filename" => $filename,
  "path" => realpath($savePath)
]);