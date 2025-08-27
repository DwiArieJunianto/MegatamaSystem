<?php
require_once __DIR__ . '/dompdf/autoload.inc.php';
require __DIR__ . '/../config/config.php';

use Dompdf\Dompdf;
use Dompdf\Options;

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

$bulanNama = $bulan ? ucfirst($bulan) : 'Semua Bulan';
$rows = [];

if ($tipe === 'guru') {
    $query = "SELECT g.nama_guru AS name, a.tanggal, a.jam_datang, a.jam_pulang
              FROM absen_guru a
              JOIN guru g ON a.id_guru = g.id_guru
              WHERE 1=1";

    if (!empty($bulan) && isset($bulanMap[$bulan])) {
        $query .= " AND MONTH(a.tanggal) = '{$bulanMap[$bulan]}'";
    }

    $result = mysqli_query($conn, $query);
    while ($row = mysqli_fetch_assoc($result)) {
        $datang = $row['jam_datang'] ? '✅' : '❌';
        $pulang = $row['jam_pulang'] ? '✅' : '❌';
        $row['keterangan'] = $datang . '|' . $pulang;
        $rows[] = $row;
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
        $query .= " AND MONTH(ab.tanggal) = '{$bulanMap[$bulan]}'";
    }

    $result = mysqli_query($conn, $query);

    while ($row = mysqli_fetch_assoc($result)) {
        $kelasKey = $row['kelas'];
        if (!isset($rows[$kelasKey])) {
            $rows[$kelasKey] = [];
        }
        $rows[$kelasKey][] = $row;
    }
}

// Style CSS
$style = "
    <style>
        body { font-family: sans-serif; font-size: 12px; }
        table { width: 100%; border-collapse: collapse; margin-top: 10px; }
        th, td { border: 1px solid #000; padding: 4px; text-align: center; }
        th { background-color: #f0f0f0; }
        h4 { margin-top: 20px; }
        .kelas-title { margin-top: 20px; font-weight: bold; font-size: 14px; }
    </style>";

// Header PDF
$html = $style;
$html .= "<h3 style='text-align:center;'>Laporan Rekap Absensi " . ucfirst($tipe) . "</h3>";
$html .= "<p style='font-size:12px; margin-top:-5px;'>Bulan: {$bulanNama}</p>";

if ($tipe === 'guru') {
    $html .= "<table>";
    $html .= "<thead><tr><th>Nama</th><th>Tanggal</th><th>Jam Datang</th><th>Jam Pulang</th><th>Keterangan</th></tr></thead><tbody>";
    foreach ($rows as $r) {
        $html .= "<tr>
            <td>{$r['name']}</td>
            <td>{$r['tanggal']}</td>
            <td>{$r['jam_datang']}</td>
            <td>{$r['jam_pulang']}</td>
            <td>{$r['keterangan']}</td>
        </tr>";
    }
    $html .= "</tbody></table>";
} else {
    if (empty($rows)) {
        $html .= "<p style='color:red;'>Tidak ada data absensi ditemukan.</p>";
    }

    foreach ($rows as $kelas => $kelasRows) {
        $html .= "<div class='kelas-title'>Kelas: {$kelas}</div>";
        $html .= "<table style='margin-bottom: 20px;'>";
        $html .= "<thead><tr><th>Nama</th><th>NIS</th><th>Jenis Kelamin</th><th>Tanggal</th><th>Status</th></tr></thead><tbody>";

        foreach ($kelasRows as $r) {
            $html .= "<tr>
                <td>{$r['name']}</td>
                <td>{$r['nis']}</td>
                <td>{$r['jenis_kelamin']}</td>
                <td>{$r['tanggal']}</td>
                <td>{$r['status']}</td>
            </tr>";
        }

        $html .= "</tbody></table>";
    }
}

// Generate PDF
$options = new Options();
$options->set('isRemoteEnabled', true);
$dompdf = new Dompdf($options);
$dompdf->loadHtml($html);
$dompdf->setPaper('A4', 'landscape');
$dompdf->render();

// Simpan PDF
$output = $dompdf->output();
$filename = "rekap-absensi-$tipe-" . date('Ymd-His') . ".pdf";
$filepath = __DIR__ . "/dompdf/" . $filename;
file_put_contents($filepath, $output);

// Kirim response JSON
echo json_encode([
    "status" => "success",
    "message" => "PDF berhasil dibuat",
    "filename" => $filename,
    "path" => realpath($filepath),
    "url" => "src/API/dompdf/" . $filename
]);
