'use strict';

// Konfigurasi default Chart.js agar sesuai dengan tema Strava Momentum
if (window.Chart) {
  Chart.defaults.font.family = "'Roboto', 'Helvetica', 'Arial', sans-serif";
  Chart.defaults.color = '#6B7280';
  Chart.defaults.plugins.tooltip.titleFont = { family: "'Outfit', sans-serif", weight: 'bold' };
  Chart.defaults.plugins.tooltip.bodyFont = { family: "'Roboto', sans-serif" };
}

// simpan hasil kalkulasi terakhir
let calcResult = null;

// instance chart supaya bisa di-destroy sebelum render ulang
let chartInstances = {
  macro: null,
  calorie: null,
  bmi: null,
  weight: null
};

// navigasi antar halaman
function showPage(pageId) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));

  const target = document.getElementById('page-' + pageId);
  if (target) target.classList.add('active');

  document.querySelectorAll('.nav-link').forEach(link => {
    link.classList.toggle('active', link.dataset.page === pageId);
  });

  window.scrollTo(0, 0);
  document.getElementById('navLinks').classList.remove('open');

  if (pageId === 'dashboard') {
    // Otomatis muat data terakhir dari riwayat jika calcResult kosong
    if (!calcResult) {
      const history = JSON.parse(localStorage.getItem('fitlogic_history')) || [];
      if (history.length > 0) {
        const last = history[0];
        calcResult = {
          nama: last.name,
          umur: last.age,
          gender: last.gender,
          tinggi: last.height,
          berat: last.weight,
          aktivFak: last.activity,
          goal: last.goal,
          target: last.target,
          bmi: last.bmi,
          macros: calcMacros(last.target, last.goal),
          bmiCat: getBMICategory(last.bmi)
        };
      }
    }
    renderDashboard();
    renderHistory();
  }
  if (window.lucide) lucide.createIcons();
}

// toggle menu hamburger (mobile)
document.getElementById('hamburger').addEventListener('click', () => {
  document.getElementById('navLinks').classList.toggle('open');
});

// ambil value input dan trim spasi
function getVal(id) {
  return document.getElementById(id).value.trim();
}

function showError(fieldId, errId, msg) {
  const field = document.getElementById(fieldId);
  const err = document.getElementById(errId);
  if (field) field.classList.add('error');
  if (err) err.textContent = msg;
}

function clearError(fieldId, errId) {
  const field = document.getElementById(fieldId);
  const err = document.getElementById(errId);
  if (field) field.classList.remove('error');
  if (err) err.textContent = '';
}

// validasi semua field sebelum hitung
function validateForm() {
  let valid = true;

  const nama = getVal('inputNama');
  if (!nama) {
    showError('inputNama', 'err-name', 'Nama tidak boleh kosong.');
    valid = false;
  } else {
    clearError('inputNama', 'err-name');
  }

  const umur = parseFloat(getVal('inputUmur'));
  if (!getVal('inputUmur') || isNaN(umur) || umur <= 0) {
    showError('inputUmur', 'err-age', 'Umur harus lebih dari 0.');
    valid = false;
  } else {
    clearError('inputUmur', 'err-age');
  }

  const gender = document.querySelector('input[name="gender"]:checked');
  if (!gender) {
    document.getElementById('err-gender').textContent = 'Pilih jenis kelamin.';
    valid = false;
  } else {
    document.getElementById('err-gender').textContent = '';
  }

  const tinggi = parseFloat(getVal('inputTinggi'));
  if (!getVal('inputTinggi') || isNaN(tinggi) || tinggi <= 0) {
    showError('inputTinggi', 'err-height', 'Tinggi badan harus lebih dari 0 cm.');
    valid = false;
  } else {
    clearError('inputTinggi', 'err-height');
  }

  const berat = parseFloat(getVal('inputBerat'));
  if (!getVal('inputBerat') || isNaN(berat) || berat <= 0) {
    showError('inputBerat', 'err-weight', 'Berat badan harus lebih dari 0 kg.');
    valid = false;
  } else {
    clearError('inputBerat', 'err-weight');
  }

  const aktivitas = getVal('selectAktivitas');
  if (!aktivitas) {
    showError('selectAktivitas', 'err-activity', 'Pilih tingkat aktivitas.');
    valid = false;
  } else {
    clearError('selectAktivitas', 'err-activity');
  }

  const goal = document.querySelector('input[name="goal"]:checked');
  if (!goal) {
    document.getElementById('err-goal').textContent = 'Pilih target diet.';
    valid = false;
  } else {
    document.getElementById('err-goal').textContent = '';
  }

  return valid;
}

// rumus Mifflin-St Jeor
// weight = kg, height = cm, age = tahun
function calcBMR(weight, height, age, gender) {
  const base = (10 * weight) + (6.25 * height) - (5 * age);
  return gender === 'male' ? base + 5 : base - 161;
}

function calcBMI(weight, height) {
  const heightM = height / 100;
  return weight / (heightM * heightM);
}

function getBMICategory(bmi) {
  if (bmi < 18.5) return { label: 'Kurus (Underweight)', color: '#0066cc', pct: 20 };
  if (bmi < 25)   return { label: 'Normal',              color: '#248a3d', pct: 45 };
  if (bmi < 30)   return { label: 'Gemuk (Overweight)',  color: '#FC5200', pct: 70 };
  return                  { label: 'Obesitas',           color: '#E11D48', pct: 90 };
}

function calcTargetCalories(tdee, goal) {
  if (goal === 'lose-fast') return Math.round(tdee - 500);
  if (goal === 'lose-slow') return Math.round(tdee - 250);
  if (goal === 'gain-slow') return Math.round(tdee + 250);
  if (goal === 'gain-fast') return Math.round(tdee + 500);
  return Math.round(tdee);
}

// hitung makronutrisi berdasarkan target kalori dan goal
// 1g protein/karbohidrat = 4 kcal, 1g lemak = 9 kcal
function calcMacros(targetCal, goal) {
  let pPct, cPct, fPct;
  if (goal === 'lose-fast') {
    pPct = 0.40; cPct = 0.35; fPct = 0.25;
  } else if (goal === 'lose-slow') {
    pPct = 0.35; cPct = 0.40; fPct = 0.25;
  } else if (goal === 'gain-slow') {
    pPct = 0.30; cPct = 0.50; fPct = 0.20;
  } else if (goal === 'gain-fast') {
    pPct = 0.25; cPct = 0.55; fPct = 0.20;
  } else {
    pPct = 0.30; cPct = 0.45; fPct = 0.25;
  }

  return {
    proteinKcal: Math.round(targetCal * pPct),
    carbsKcal:   Math.round(targetCal * cPct),
    fatKcal:     Math.round(targetCal * fPct),
    proteinG:    Math.round((targetCal * pPct) / 4),
    carbsG:      Math.round((targetCal * cPct) / 4),
    fatG:        Math.round((targetCal * fPct) / 9),
    pPct, cPct, fPct
  };
}

function goalLabel(goal) {
  const map = {
    'lose-fast': '🔥 Lose Weight Fast – Turun Cepat',
    'lose-slow': '📉 Lose Weight Slow – Turun Perlahan',
    'maintain':  '⚖️ Maintain – Jaga Berat',
    'gain-slow': '📈 Gain Weight Slow – Naik Perlahan',
    'gain-fast': '💪 Gain Weight Fast – Naik Cepat'
  };
  return map[goal] || goal;
}

// submit form dan jalankan kalkulasi
document.getElementById('calcForm').addEventListener('submit', function(e) {
  e.preventDefault();
  if (!validateForm()) return;

  const nama     = getVal('inputNama');
  const umur     = parseFloat(getVal('inputUmur'));
  const gender   = document.querySelector('input[name="gender"]:checked').value;
  const tinggi   = parseFloat(getVal('inputTinggi'));
  const berat    = parseFloat(getVal('inputBerat'));
  const aktivFak = parseFloat(getVal('selectAktivitas'));
  const goal     = document.querySelector('input[name="goal"]:checked').value;

  const bmi    = calcBMI(berat, tinggi);
  const bmr    = calcBMR(berat, tinggi, umur, gender);
  const tdee   = bmr * aktivFak;
  const target = calcTargetCalories(tdee, goal);
  const macros = calcMacros(target, goal);
  const bmiCat = getBMICategory(bmi);

  calcResult = { nama, umur, gender, tinggi, berat, aktivFak, goal, bmi, bmr, tdee, target, macros, bmiCat };

  populateResult(calcResult);
  seedInitialWeight(calcResult);
  showPage('result');
});

// buat teks kesimpulan otomatis yang personal dan edukatif
function generateConclusionText(r) {
  const bmiVal = r.bmi.toFixed(1);
  const bmiCatText = r.bmiCat.label;
  const formattedTarget = r.target.toLocaleString('id-ID');
  const proteinG = r.macros.proteinG;
  const carbsG = r.macros.carbsG;
  const fatG = r.macros.fatG;

  let goalDesc = '';
  let tips = '';

  if (r.goal === 'lose-fast') {
    goalDesc = 'menurunkan berat badan secara cepat dengan defisit kalori agresif (500 kkal)';
    tips = 'Kurangi camilan manis, gorengan, dan minuman berkalori tinggi. Utamakan asupan protein tinggi dan penuhi kebutuhan cairan tubuh harianmu. Lakukan olahraga kardio minimal 3-4 kali seminggu serta sertakan latihan beban ringan untuk menjaga massa otot agar tidak banyak menyusut.';
  } else if (r.goal === 'lose-slow') {
    goalDesc = 'menurunkan berat badan secara perlahan dan sehat dengan defisit kalori moderat (250 kkal)';
    tips = 'Metode penurunan berat badan perlahan ini sangat baik untuk menjaga massa otot dan metabolisme tubuh tetap aktif. Tetaplah aktif bergerak, catat progres berat badanmu secara rutin seminggu sekali di pagi hari setelah bangun tidur, dan lakukan workout minimal 3 kali seminggu.';
  } else if (r.goal === 'maintain') {
    goalDesc = 'menjaga berat badan saat ini (maintenance) dengan asupan kalori seimbang';
    tips = 'Kuncinya adalah konsistensi porsi makan dan kualitas nutrisi harian. Tetap aktif secara fisik, misalnya dengan berjalan kaki minimal 10.000 langkah sehari dan lakukan latihan kekuatan secara teratur untuk memelihara kebugaran dan metabolisme tubuh.';
  } else if (r.goal === 'gain-slow') {
    goalDesc = 'meningkatkan berat badan atau menambah massa otot secara bertahap dengan surplus kalori moderat (250 kkal)';
    tips = 'Pastikan surplus kalori bersih (clean bulking) didapatkan dari makanan padat nutrisi, bukan makanan olahan berlebih. Lakukan latihan beban terprogram 3-4 kali seminggu agar kalori tambahan diubah menjadi jaringan otot baru, bukan menumpuk sebagai lemak.';
  } else if (r.goal === 'gain-fast') {
    goalDesc = 'meningkatkan berat badan secara cepat dengan surplus kalori tinggi (500 kkal)';
    tips = 'Penuhi asupan protein harianmu agar penambahan berat badan tidak dominan berupa lemak. Lakukan latihan kekuatan intensif 4-5 kali seminggu, pastikan waktu tidur cukup (7-8 jam) untuk pemulihan optimal, dan pantau kenaikan berat badan mingguan agar tetap teratur.';
  }

  return `
    <p>Halo <strong>${r.nama}</strong>, berdasarkan analisis data fisikmu, kamu memiliki indeks massa tubuh (BMI) sebesar <strong>${bmiVal}</strong> yang tergolong dalam kategori <strong>${bmiCatText}</strong>.</p>
    <p>Target kamu saat ini adalah <strong>${goalDesc}</strong>. Rekomendasi asupan kalori harian kamu adalah <strong>${formattedTarget} kkal</strong>.</p>
    <p>Untuk pembagian gizi makronutrisi harian, disarankan mengonsumsi sekitar <strong>${proteinG}g Protein</strong> (pembangunan otot), <strong>${carbsG}g Karbohidrat</strong> (sumber energi utama), dan <strong>${fatG}g Lemak</strong> (menjaga metabolisme dan hormon).</p>
    <p><strong>Arahan Aksi:</strong> ${tips}</p>
  `;
}

// menghitung tingkat kecocokan diet (Diet Match Score) berdasarkan BMI dan target
function calcMatchScore(bmi, goal) {
  let score = 50;
  let label = 'Sedang';
  let color = '#ff9f0a';
  let reason = '';

  if (bmi < 18.5) {
    if (goal === 'gain-slow' || goal === 'gain-fast') {
      score = 95; label = 'Sangat Cocok'; color = '#34c759';
      reason = 'Prioritas utama tubuh underweight adalah meningkatkan berat badan secara terkontrol untuk mencapai berat ideal sehat.';
    } else if (goal === 'maintain') {
      score = 70; label = 'Cukup Cocok'; color = '#ff9f0a';
      reason = 'Menjaga kondisi tubuh underweight kurang optimal. Lebih baik fokus pada kenaikan secara bertahap.';
    } else {
      score = 25; label = 'Tidak Cocok'; color = '#ff3b30';
      reason = 'Menurunkan berat badan saat berat badan Anda sudah di bawah normal sangat berbahaya bagi kesehatan dan stamina.';
    }
  } else if (bmi < 25) {
    if (goal === 'maintain') {
      score = 98; label = 'Sangat Cocok'; color = '#34c759';
      reason = 'Mempertahankan berat badan normal adalah kondisi terbaik untuk stabilitas metabolisme tubuh.';
    } else if (goal === 'lose-slow' || goal === 'gain-slow') {
      score = 90; label = 'Sangat Cocok'; color = '#34c759';
      reason = 'Kenaikan atau penurunan berat badan secara perlahan sangat aman bagi metabolisme tubuh Anda.';
    } else {
      score = 75; label = 'Cocok'; color = '#0071e3';
      reason = 'Opsi yang cukup baik, namun target agresif sebaiknya ditunjang dengan latihan rutin dan pola makan teratur.';
    }
  } else if (bmi < 30) {
    if (goal === 'lose-slow') {
      score = 95; label = 'Sangat Cocok'; color = '#34c759';
      reason = 'Menurunkan berat secara perlahan adalah cara terbaik membakar lemak tanpa mengorbankan otot.';
    } else if (goal === 'lose-fast') {
      score = 85; label = 'Cocok'; color = '#0071e3';
      reason = 'Membantu defisit energi untuk memotong lemak, pastikan asupan protein Anda tercukupi.';
    } else if (goal === 'maintain') {
      score = 65; label = 'Cukup Cocok'; color = '#ff9f0a';
      reason = 'Menstabilkan berat badan overweight kurang ideal untuk jangka panjang. Defisit kalori ringan lebih disarankan.';
    } else {
      score = 30; label = 'Tidak Cocok'; color = '#ff3b30';
      reason = 'Menambah berat badan saat kondisi tubuh sudah overweight dapat meningkatkan risiko obesitas.';
    }
  } else {
    if (goal === 'lose-slow') {
      score = 98; label = 'Sangat Cocok'; color = '#34c759';
      reason = 'Diet bertahap adalah pilihan paling sehat dan berkelanjutan untuk mereduksi risiko klinis obesitas.';
    } else if (goal === 'lose-fast') {
      score = 88; label = 'Sangat Cocok'; color = '#34c759';
      reason = 'Tubuh dengan obesitas membutuhkan defisit energi, hindari metode diet ekstrem kelaparan.';
    } else if (goal === 'maintain') {
      score = 55; label = 'Cukup Cocok'; color = '#ff9f0a';
      reason = 'Mempertahankan berat badan obesitas berisiko memicu kolesterol, hipertensi, dan diabetes.';
    } else {
      score = 15; label = 'Sangat Tidak Cocok'; color = '#ff3b30';
      reason = 'Surplus kalori (penambahan berat) pada kondisi obesitas sangat membahayakan sistem kardiovaskular.';
    }
  }

  return { score, label, color, reason };
}

// memeriksa risiko kesehatan diet (health alerts)
function validateDietHealth(r) {
  const alerts = [];

  if (r.target < r.bmr) {
    alerts.push({
      type: 'warning',
      title: 'Peringatan Metabolisme: Kalori di bawah BMR',
      text: `Target kalori harianmu (<strong>${r.target.toLocaleString('id-ID')} kkal</strong>) berada di bawah nilai BMR-mu (<strong>${Math.round(r.bmr).toLocaleString('id-ID')} kkal</strong>). Makan di bawah BMR dalam jangka panjang berisiko menurunkan massa otot, merusak metabolisme (starvation mode), dan memicu kelelahan ekstrem.`
    });
  }

  if (r.bmi < 18.5 && (r.goal === 'lose-fast' || r.goal === 'lose-slow')) {
    alerts.push({
      type: 'danger',
      title: 'Risiko Medis: BMI Kurus & Defisit Kalori',
      text: 'Indeks Massa Tubuhmu tergolong Kurus, namun kamu memilih program penurunan berat badan. Ini berisiko memicu malnutrisi, kelemahan sistem imun, gangguan hormonal, dan komplikasi medis serius.'
    });
  }

  if (r.bmi >= 30 && (r.goal === 'gain-slow' || r.goal === 'gain-fast')) {
    alerts.push({
      type: 'danger',
      title: 'Risiko Medis: BMI Obesitas & Surplus Kalori',
      text: 'Indeks Massa Tubuhmu tergolong Obesitas, namun kamu memilih program kenaikan berat badan. Hal ini sangat tidak disarankan karena dapat meningkatkan penumpukan lemak organ (visceral) dan memperburuk metabolisme.'
    });
  }

  return alerts;
}

// generate porsi dan menu harian berdasarkan kalori target
function generateDailyMenu(targetCal) {
  const breakfastKcal = Math.round(targetCal * 0.25);
  const lunchKcal     = Math.round(targetCal * 0.35);
  const dinnerKcal    = Math.round(targetCal * 0.30);
  const snackKcal     = Math.round(targetCal * 0.10);
  const mult          = targetCal / 2000;

  const porsiNasiSiang = Math.round(150 * mult);
  const porsiAyamSiang = Math.round(120 * mult);
  const porsiNasiMalam = Math.round(120 * mult);
  const porsiIkanMalam = Math.round(130 * mult);

  return {
    kcal: { breakfast: breakfastKcal, lunch: lunchKcal, dinner: dinnerKcal, snack: snackKcal },
    breakfast: `Roti gandum bakar (2 lembar), 2 butir telur rebus/mata sapi (cukup minyak sedikit), dan ${Math.round(50 * mult)}g alpukat mentega segar.`,
    lunch: `Nasi merah hangat (<strong>${porsiNasiSiang}g</strong>), dada ayam panggang tanpa kulit (<strong>${porsiAyamSiang}g</strong>), tumis brokoli/buncis dengan 1 sdt minyak zaitun.`,
    dinner: `Sup bening gurame/patin (<strong>${porsiIkanMalam}g</strong>), tahu panggang/tempe bacem (2 potong sedang), nasi merah (<strong>${porsiNasiMalam}g</strong>), dan tumis kangkung.`,
    snack: `Satu buah apel merah ukuran sedang atau segelas yogurt plain rendah lemak dengan taburan ${Math.round(10 * mult)}g chia seed.`
  };
}

// isi halaman hasil dengan data kalkulasi
function populateResult(r) {
  document.getElementById('rhcName').textContent     = r.nama;
  document.getElementById('rhcGoal').textContent     = goalLabel(r.goal);
  document.getElementById('rhcCalories').textContent = r.target.toLocaleString('id-ID');

  document.getElementById('valBMI').textContent = r.bmi.toFixed(1);
  document.getElementById('catBMI').textContent = r.bmiCat.label;

  const progBMI = document.getElementById('progBMI');
  progBMI.style.width      = '0';
  progBMI.style.background = r.bmiCat.color;
  setTimeout(() => { progBMI.style.width = r.bmiCat.pct + '%'; }, 100);

  document.getElementById('valBMR').textContent    = Math.round(r.bmr).toLocaleString('id-ID');
  document.getElementById('valTDEE').textContent   = Math.round(r.tdee).toLocaleString('id-ID');
  document.getElementById('valTarget').textContent = r.target.toLocaleString('id-ID');

  const m = r.macros;
  document.getElementById('macroProtein').textContent = `${m.proteinG}g (${m.proteinKcal} kcal)`;
  document.getElementById('macroCarbs').textContent   = `${m.carbsG}g (${m.carbsKcal} kcal)`;
  document.getElementById('macroFat').textContent     = `${m.fatG}g (${m.fatKcal} kcal)`;

  setTimeout(() => {
    document.getElementById('fillProtein').style.width = (m.pPct * 100) + '%';
    document.getElementById('fillCarbs').style.width   = (m.cPct * 100) + '%';
    document.getElementById('fillFat').style.width     = (m.fPct * 100) + '%';
  }, 150);

  document.getElementById('conclusionText').innerHTML = generateConclusionText(r);

  // 1. Diet Match Score
  const match = calcMatchScore(r.bmi, r.goal);
  document.getElementById('scoreText').textContent = match.score + '%';
  document.getElementById('scoreStatus').textContent = match.label;
  document.getElementById('scoreStatus').style.color = match.color;
  document.getElementById('scoreCircle').style.borderColor = match.color;
  document.getElementById('scoreReason').textContent = match.reason;

  // 2. Health Alerts Validasi Kesehatan
  const alerts = validateDietHealth(r);
  const alertContainer = document.getElementById('healthAlert');
  if (alerts.length === 0) {
    alertContainer.style.display = 'none';
  } else {
    alertContainer.style.display = 'flex';
    alertContainer.innerHTML = alerts.map(a => `
      <div class="health-alert">
        <i data-lucide="${a.type === 'danger' ? 'alert-octagon' : 'alert-triangle'}" class="ha-icon"></i>
        <div class="health-alert-content">
          <span class="health-alert-title">${a.title}</span>
          <span class="health-alert-desc">${a.text}</span>
        </div>
      </div>
    `).join('');
  }

  // 3. Rekomendasi Menu Makanan
  const menu = generateDailyMenu(r.target);
  document.getElementById('kcalSarapan').textContent = menu.kcal.breakfast + ' kcal';
  document.getElementById('kcalSiang').textContent    = menu.kcal.lunch + ' kcal';
  document.getElementById('kcalMalam').textContent    = menu.kcal.dinner + ' kcal';
  document.getElementById('kcalCamilan').textContent  = menu.kcal.snack + ' kcal';

  document.getElementById('menuSarapan').innerHTML = menu.breakfast;
  document.getElementById('menuSiang').innerHTML    = menu.lunch;
  document.getElementById('menuMalam').innerHTML    = menu.dinner;
  document.getElementById('menuCamilan').innerHTML  = menu.snack;

  // 4. Simpan Riwayat
  saveToHistory(r);

  if (window.lucide) lucide.createIcons();
}

// Simpan riwayat kalkulasi terakhir ke localStorage
function saveToHistory(r) {
  const history = JSON.parse(localStorage.getItem('fitlogic_history')) || [];
  const entry = {
    name: r.nama,
    age: r.umur,
    gender: r.gender,
    height: r.tinggi,
    weight: r.berat,
    activity: r.aktivFak,
    goal: r.goal,
    target: r.target,
    bmi: r.bmi,
    date: new Date().toISOString()
  };
  history.unshift(entry);
  if (history.length > 10) history.pop();
  localStorage.setItem('fitlogic_history', JSON.stringify(history));
}

// render semua konten di halaman dashboard
function renderDashboard() {
  const noData     = document.getElementById('noData');
  const chartsGrid = document.querySelector('.charts-grid');
  const dashSummary = document.getElementById('dashSummary');

  if (!calcResult) {
    noData.classList.add('visible');
    chartsGrid.style.display  = 'none';
    dashSummary.style.display = 'none';
    return;
  }

  noData.classList.remove('visible');
  chartsGrid.style.display  = 'grid';
  dashSummary.style.display = 'flex';

  const r = calcResult;

  document.getElementById('dNama').textContent   = r.nama;
  const dashGoalLabels = {
    'lose-fast': 'Lose Weight Fast',
    'lose-slow': 'Lose Weight Slow',
    'maintain':  'Maintain',
    'gain-slow': 'Gain Weight Slow',
    'gain-fast': 'Gain Weight Fast'
  };
  document.getElementById('dGoal').textContent   = dashGoalLabels[r.goal] || r.goal;
  document.getElementById('dBMI').textContent    = r.bmi.toFixed(1) + ' – ' + r.bmiCat.label;
  document.getElementById('dKalori').textContent = r.target.toLocaleString('id-ID') + ' kcal';

  renderMacroChart(r);
  renderCalorieChart(r);
  renderBMIChart(r);
  renderWeightChart();
  renderProgressBars(r);
}

// donut chart makronutrisi
function renderMacroChart(r) {
  const ctx = document.getElementById('macroChart').getContext('2d');
  if (chartInstances.macro) chartInstances.macro.destroy();

  const m = r.macros;
  chartInstances.macro = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: ['Protein', 'Karbohidrat', 'Lemak'],
      datasets: [{
        data: [m.proteinKcal, m.carbsKcal, m.fatKcal],
        backgroundColor: ['#248a3d', '#FC5200', '#7c3aed'],
        borderWidth: 0,
        hoverOffset: 6
      }]
    },
    options: {
      cutout: '68%',
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: ctx => ` ${ctx.label}: ${ctx.raw} kcal (${Math.round(ctx.raw / r.target * 100)}%)`
          }
        }
      }
    }
  });

  const legend = document.getElementById('macroLegend');
  const colors = ['#248a3d', '#FC5200', '#7c3aed'];
  const labels = ['Protein', 'Karbohidrat', 'Lemak'];
  const grams  = [m.proteinG + 'g', m.carbsG + 'g', m.fatG + 'g'];

  legend.innerHTML = labels.map((l, i) =>
    `<div class="legend-item">
      <div class="legend-dot" style="background:${colors[i]}"></div>
      <span>${l} ${grams[i]}</span>
    </div>`
  ).join('');
}

// bar chart perbandingan BMR, TDEE, dan target kalori
function renderCalorieChart(r) {
  const ctx = document.getElementById('calorieChart').getContext('2d');
  if (chartInstances.calorie) chartInstances.calorie.destroy();

  chartInstances.calorie = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: ['BMR', 'TDEE', 'Target Kalori'],
      datasets: [{
        label: 'Kalori (kcal)',
        data: [Math.round(r.bmr), Math.round(r.tdee), r.target],
        backgroundColor: [
          'rgba(145, 142, 137, 0.85)',
          'rgba(55, 65, 81, 0.85)',
          'rgba(252, 82, 0, 0.95)'
        ],
        borderRadius: 10,
        borderSkipped: false
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: ctx => ` ${ctx.raw.toLocaleString('id-ID')} kcal`
          }
        }
      },
      scales: {
        y: {
          beginAtZero: false,
          grid: { color: 'rgba(18, 18, 18, 0.05)' },
          ticks: { 
            callback: v => v.toLocaleString('id-ID'),
            font: { family: "'Outfit', sans-serif" }
          }
        },
        x: { 
          grid: { display: false },
          ticks: { font: { family: "'Outfit', sans-serif", weight: 'bold' } }
        }
      }
    }
  });
}

// gauge setengah lingkaran untuk visualisasi BMI
function renderBMIChart(r) {
  const ctx = document.getElementById('bmiChart').getContext('2d');
  if (chartInstances.bmi) chartInstances.bmi.destroy();

  // 4 segmen: kurus, normal, gemuk, obesitas — range 0–40
  const segments = [18.5, 6.5, 5, 10];
  const colors   = ['#0066cc', '#248a3d', '#FC5200', '#E11D48'];

  chartInstances.bmi = new Chart(ctx, {
    type: 'doughnut',
    data: {
      datasets: [{
        data: [...segments, 40], // segment terakhir transparan, buat efek setengah lingkaran
        backgroundColor: [...colors, 'transparent'],
        borderWidth: 0,
        circumference: 180,
        rotation: 270
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '72%',
      plugins: {
        legend: { display: false },
        tooltip: {
          filter: item => item.datasetIndex === 0 && item.dataIndex < 4,
          callbacks: {
            label: ctx => {
              const lbls = ['Kurus < 18.5', 'Normal 18.5–24.9', 'Gemuk 25–29.9', 'Obesitas ≥ 30'];
              return ' ' + lbls[ctx.dataIndex];
            }
          }
        }
      }
    }
  });

  document.getElementById('bmiGaugeLabel').innerHTML =
    `BMI kamu: <strong style="color:${r.bmiCat.color}">${r.bmi.toFixed(1)}</strong> – ${r.bmiCat.label}`;
}

// Line chart untuk tren perkembangan berat badan dari riwayat log berat badan
function renderWeightChart() {
  const logs = JSON.parse(localStorage.getItem('fitlogic_weight_logs')) || [];
  const card = document.getElementById('weightTrendCard');
  
  if (logs.length < 2) {
    if (card) card.style.display = 'none';
    return;
  }
  
  if (card) card.style.display = 'block';
  
  const ctx = document.getElementById('weightChart').getContext('2d');
  if (chartInstances.weight) chartInstances.weight.destroy();

  // Urutkan data logs secara kronologis dari terlama ke terbaru untuk grafik garis
  const dataPoints = [...logs].sort((a, b) => new Date(a.date) - new Date(b.date)).slice(-7);
  const labels = dataPoints.map(l => new Date(l.date).toLocaleDateString('id-ID', { day: '2-digit', month: 'short' }));
  const weights = dataPoints.map(l => l.weight);

  chartInstances.weight = new Chart(ctx, {
    type: 'line',
    data: {
      labels: labels,
      datasets: [{
        label: 'Berat Badan (kg)',
        data: weights,
        borderColor: '#FC5200',
        backgroundColor: 'rgba(252, 82, 0, 0.08)',
        borderWidth: 3,
        tension: 0.3,
        pointBackgroundColor: '#FC5200',
        pointHoverBackgroundColor: '#121212',
        pointRadius: 4,
        fill: true
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: ctx => ` ${ctx.raw} kg`
          }
        }
      },
      scales: {
        y: {
          beginAtZero: false,
          grid: { color: 'rgba(18, 18, 18, 0.05)' },
          ticks: { font: { family: "'Outfit', sans-serif" } }
        },
        x: {
          grid: { display: false },
          ticks: { font: { family: "'Outfit', sans-serif" } }
        }
      }
    }
  });
}

// Ambil data log konsumsi harian
function getDailyLog() {
  const defaultLog = { calories: 0, protein: 0, carbs: 0, fat: 0, burned: 0, workouts: [] };
  
  // Reset otomatis jika hari berganti
  const todayStr = new Date().toDateString();
  const savedLog = JSON.parse(localStorage.getItem('fitlogic_daily_log'));
  
  if (savedLog && savedLog.date === todayStr) {
    // Migrasi data jika properti baru belum ada
    if (savedLog.burned === undefined) savedLog.burned = 0;
    if (savedLog.workouts === undefined) savedLog.workouts = [];
    return savedLog;
  } else {
    const newLog = { ...defaultLog, date: todayStr };
    saveDailyLog(newLog);
    return newLog;
  }
}

// Simpan data log konsumsi harian
function saveDailyLog(log) {
  localStorage.setItem('fitlogic_daily_log', JSON.stringify(log));
}

// Hitung target kalori olahraga harian berdasarkan tingkat aktivitas
function getActiveBurnTarget(factor) {
  if (factor <= 1.2) return 150;    // Sedentary (Tidak aktif)
  if (factor <= 1.375) return 250;  // Ringan
  if (factor <= 1.55) return 400;   // Sedang
  if (factor <= 1.725) return 600;  // Aktif
  return 800;                       // Sangat Aktif
}

// progress bar simulasi konsumsi harian
function renderProgressBars(r) {
  const m = r.macros;
  const currentLog = getDailyLog();

  // Net Kalori = Makanan - Latihan
  const netCalories = Math.max(0, currentLog.calories - currentLog.burned);
  const remaining = r.target - currentLog.calories + currentLog.burned;

  // Hitung target kalori olahraga
  const burnTarget = getActiveBurnTarget(r.aktivFak);

  const calPct = r.target > 0 ? Math.min(Math.round((netCalories / r.target) * 100), 100) : 0;
  const burnPct = burnTarget > 0 ? Math.min(Math.round((currentLog.burned / burnTarget) * 100), 100) : 0;
  const proteinPct = m.proteinG > 0 ? Math.min(Math.round((currentLog.protein / m.proteinG) * 100), 100) : 0;
  const carbsPct = m.carbsG > 0 ? Math.min(Math.round((currentLog.carbs / m.carbsG) * 100), 100) : 0;
  const fatPct = m.fatG > 0 ? Math.min(Math.round((currentLog.fat / m.fatG) * 100), 100) : 0;

  // Render Widget Persamaan Budget
  document.getElementById('budgetTarget').textContent = r.target.toLocaleString('id-ID');
  document.getElementById('budgetFood').textContent   = '+' + currentLog.calories.toLocaleString('id-ID');
  document.getElementById('budgetBurned').textContent = '-' + currentLog.burned.toLocaleString('id-ID');
  
  const remainingEl = document.getElementById('budgetRemaining');
  remainingEl.textContent = remaining.toLocaleString('id-ID');
  if (remaining < 0) {
    remainingEl.style.color = 'var(--error)';
  } else {
    remainingEl.style.color = 'var(--neutral)';
  }

  // Update Label Progres
  document.getElementById('progKalLabel').textContent     = `${netCalories.toLocaleString('id-ID')} / ${r.target.toLocaleString('id-ID')} kcal (${calPct}%)`;
  document.getElementById('progBurnedLabel').textContent  = `${currentLog.burned.toLocaleString('id-ID')} / ${burnTarget} kcal (${burnPct}%)`;
  document.getElementById('progProteinLabel').textContent = `${currentLog.protein}g / ${m.proteinG}g (${proteinPct}%)`;
  document.getElementById('progCarbsLabel').textContent   = `${currentLog.carbs}g / ${m.carbsG}g (${carbsPct}%)`;
  document.getElementById('progFatLabel').textContent     = `${currentLog.fat}g / ${m.fatG}g (${fatPct}%)`;

  setTimeout(() => {
    document.getElementById('progKal').style.width     = calPct + '%';
    document.getElementById('progBurned').style.width  = burnPct + '%';
    document.getElementById('progProtein').style.width = proteinPct + '%';
    document.getElementById('progCarbs').style.width   = carbsPct + '%';
    document.getElementById('progFat').style.width     = fatPct + '%';
  }, 200);

  // Render Daftar Latihan Hari Ini
  const workoutsContainer = document.getElementById('loggedWorkoutsContainer');
  const workoutList = document.getElementById('workoutList');
  if (workoutsContainer && workoutList) {
    if (currentLog.workouts && currentLog.workouts.length > 0) {
      workoutsContainer.style.display = 'block';
      workoutList.innerHTML = currentLog.workouts.map((w) => `
        <div class="workout-list-item" style="display: flex; justify-content: space-between; align-items: center; background: var(--surface); border: 1px solid var(--border); padding: 8px 12px; border-radius: var(--r-sm); font-size: 13px;">
          <span style="font-weight: 600; color: var(--neutral); display: flex; align-items: center; gap: 6px;">
            <i data-lucide="dumbbell" style="width: 14px; height: 14px; color: var(--primary);"></i>
            ${w.activity}
          </span>
          <span style="color: var(--primary); font-weight: 700;">-${w.calories} kcal</span>
        </div>
      `).join('');
      if (window.lucide) lucide.createIcons();
    } else {
      workoutsContainer.style.display = 'none';
      workoutList.innerHTML = '';
    }
  }
}

// membersihkan data di halaman hasil perhitungan kembali ke default
function clearResultsPage() {
  document.getElementById('rhcName').textContent     = '–';
  document.getElementById('rhcGoal').textContent     = '–';
  document.getElementById('rhcCalories').textContent = '–';

  document.getElementById('valBMI').textContent = '–';
  document.getElementById('catBMI').textContent = '–';
  document.getElementById('progBMI').style.width = '0%';

  document.getElementById('valBMR').textContent    = '–';
  document.getElementById('valTDEE').textContent   = '–';
  document.getElementById('valTarget').textContent = '–';

  document.getElementById('macroProtein').textContent = '–';
  document.getElementById('macroCarbs').textContent   = '–';
  document.getElementById('macroFat').textContent     = '–';
  
  document.getElementById('fillProtein').style.width = '0%';
  document.getElementById('fillCarbs').style.width   = '0%';
  document.getElementById('fillFat').style.width     = '0%';

  document.getElementById('conclusionText').innerHTML = '';
  document.getElementById('healthAlert').style.display = 'none';

  // Diet Match Score
  document.getElementById('scoreText').textContent = '--%';
  document.getElementById('scoreStatus').textContent = 'Mengevaluasi...';
  document.getElementById('scoreStatus').style.color = 'var(--secondary)';
  document.getElementById('scoreCircle').style.borderColor = 'var(--border)';
  document.getElementById('scoreReason').textContent = 'Mengukur tingkat kecocokan target diet dengan kondisi fisikmu.';

  // Daily Menu Recommendations
  document.getElementById('kcalSarapan').textContent = '-- kcal';
  document.getElementById('kcalSiang').textContent    = '-- kcal';
  document.getElementById('kcalMalam').textContent    = '-- kcal';
  document.getElementById('kcalCamilan').textContent  = '-- kcal';

  document.getElementById('menuSarapan').innerHTML = 'Memuat menu...';
  document.getElementById('menuSiang').innerHTML    = 'Memuat menu...';
  document.getElementById('menuMalam').innerHTML    = 'Memuat menu...';
  document.getElementById('menuCamilan').innerHTML  = 'Memuat menu...';
}

// reset form dan hapus semua error
function resetForm() {
  document.getElementById('calcForm').reset();
  document.querySelectorAll('.form-input, .form-select').forEach(el => el.classList.remove('error'));
  document.querySelectorAll('.form-error').forEach(el => el.textContent = '');
  
  // Reset pilihan radio manual untuk kompatibilitas browser
  document.querySelectorAll('input[name="goal"]').forEach(r => r.checked = false);
  document.querySelectorAll('input[name="gender"]').forEach(r => r.checked = false);

  calcResult = null;
  clearResultsPage();
}

// hapus error saat user mulai ngetik ulang
['inputNama', 'inputUmur', 'inputTinggi', 'inputBerat'].forEach(id => {
  const el = document.getElementById(id);
  if (el) el.addEventListener('input', () => el.classList.remove('error'));
});

document.getElementById('selectAktivitas').addEventListener('change', () => {
  document.getElementById('selectAktivitas').classList.remove('error');
  document.getElementById('err-activity').textContent = '';
});

// shadow navbar saat scroll
window.addEventListener('scroll', () => {
  const nav = document.getElementById('navbar');
  nav.style.boxShadow = window.scrollY > 10 ? '0 2px 16px rgba(0,0,0,0.10)' : '';
}, { passive: true });

// Inisialisasi entri berat badan pertama kali dari kalkulator jika kosong
function seedInitialWeight(r) {
  let logs = JSON.parse(localStorage.getItem('fitlogic_weight_logs')) || [];
  if (logs.length === 0) {
    const todayISO = new Date().toISOString().split('T')[0];
    const newLog = {
      date: todayISO,
      weight: r.berat,
      bmi: r.bmi,
      bmiCat: r.bmiCat.label
    };
    logs.push(newLog);
    localStorage.setItem('fitlogic_weight_logs', JSON.stringify(logs));
  }
}

// render tabel riwayat progres jurnal berat badan
function renderHistory() {
  const logs = JSON.parse(localStorage.getItem('fitlogic_weight_logs')) || [];
  const tbody = document.getElementById('historyBody');

  // Urutkan logs secara kronologis terbalik (terbaru di atas) untuk ditampilkan di tabel
  const displayLogs = [...logs].sort((a, b) => new Date(b.date) - new Date(a.date));

  if (displayLogs.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: var(--on-surface-muted); padding: 24px;">Belum ada catatan berat badan. Masukkan di atas atau isi kalkulator terlebih dahulu.</td></tr>`;
    return;
  }

  tbody.innerHTML = displayLogs.map((log) => {
    // Cari log sebelum entri ini secara kronologis untuk menghitung perubahan
    const chronologicalLogs = [...logs].sort((a, b) => new Date(a.date) - new Date(b.date));
    const currentChronologicalIdx = chronologicalLogs.findIndex(l => l.date === log.date && l.weight === log.weight);
    
    let changeText = '–';
    let changeStyle = 'color: var(--on-surface-muted);';

    if (currentChronologicalIdx > 0) {
      const prevLog = chronologicalLogs[currentChronologicalIdx - 1];
      const diff = log.weight - prevLog.weight;
      if (diff < 0) {
        changeText = `${diff.toFixed(1)} kg`;
        changeStyle = 'color: #248a3d; font-weight: 600;'; // Turun berat badan (hijau)
      } else if (diff > 0) {
        changeText = `+${diff.toFixed(1)} kg`;
        changeStyle = 'color: var(--primary); font-weight: 600;'; // Naik berat badan (orange)
      } else {
        changeText = '0.0 kg';
        changeStyle = 'color: var(--secondary);';
      }
    }

    const dateFormatted = new Date(log.date).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });

    return `
      <tr>
        <td><strong>${dateFormatted}</strong></td>
        <td><strong>${log.weight} kg</strong></td>
        <td><span style="${changeStyle}">${changeText}</span></td>
        <td class="h-bmi-val">${log.bmi.toFixed(1)}</td>
        <td><span class="bmi-chip ${log.bmi < 18.5 ? 'chip-blue' : log.bmi < 25 ? 'chip-green' : log.bmi < 30 ? 'chip-orange' : 'chip-red'}">${log.bmiCat}</span></td>
        <td>
          <button class="h-btn-delete" onclick="deleteWeightLog('${log.date}')" title="Hapus Log"><i data-lucide="trash-2" class="h-icon-sm"></i></button>
        </td>
      </tr>
    `;
  }).join('');
  
  if (window.lucide) lucide.createIcons();
}

window.deleteWeightLog = function(dateStr) {
  let logs = JSON.parse(localStorage.getItem('fitlogic_weight_logs')) || [];
  logs = logs.filter(l => l.date !== dateStr);
  localStorage.setItem('fitlogic_weight_logs', JSON.stringify(logs));
  renderHistory();
  renderWeightChart();
};

window.clearDietHistory = function() {
  if (confirm('Apakah Anda yakin ingin menghapus seluruh riwayat jurnal berat badan?')) {
    localStorage.removeItem('fitlogic_weight_logs');
    renderHistory();
    renderWeightChart();
  }
};

// filter pencarian glosarium istilah gizi
const glossarySearch = document.getElementById('glossarySearch');
if (glossarySearch) {
  glossarySearch.addEventListener('input', function(e) {
    const q = e.target.value.toLowerCase().trim();
    let visibleCount = 0;
    document.querySelectorAll('.glossary-card').forEach(card => {
      const terms = card.dataset.term.toLowerCase();
      const title = card.querySelector('h3').textContent.toLowerCase();
      if (terms.includes(q) || title.includes(q)) {
        card.style.display = 'flex';
        visibleCount++;
      } else {
        card.style.display = 'none';
      }
    });

    const emptyState = document.getElementById('glossaryEmptyState');
    if (emptyState) {
      emptyState.style.display = visibleCount === 0 ? 'block' : 'none';
    }
  });
}

// Inisialisasi event listener dan menu
document.addEventListener('DOMContentLoaded', () => {
  const btnToggleLog = document.getElementById('btnToggleLog');
  const logPanel = document.getElementById('logPanel');
  
  const tabFood = document.getElementById('tabFood');
  const tabWorkout = document.getElementById('tabWorkout');
  
  const foodLogForm = document.getElementById('foodLogForm');
  const workoutLogForm = document.getElementById('workoutLogForm');

  // Toggle Panel
  if (btnToggleLog && logPanel) {
    btnToggleLog.addEventListener('click', () => {
      const isHidden = logPanel.style.display === 'none';
      logPanel.style.display = isHidden ? 'flex' : 'none';
    });
  }

  // Toggle Tabs
  if (tabFood && tabWorkout) {
    tabFood.addEventListener('click', () => {
      tabFood.classList.add('active');
      tabFood.style.color = 'var(--primary)';
      tabFood.style.borderBottomColor = 'var(--primary)';
      
      tabWorkout.classList.remove('active');
      tabWorkout.style.color = 'var(--secondary)';
      tabWorkout.style.borderBottomColor = 'transparent';
      
      foodLogForm.style.display = 'flex';
      workoutLogForm.style.display = 'none';
    });

    tabWorkout.addEventListener('click', () => {
      tabWorkout.classList.add('active');
      tabWorkout.style.color = 'var(--primary)';
      tabWorkout.style.borderBottomColor = 'var(--primary)';
      
      tabFood.classList.remove('active');
      tabFood.style.color = 'var(--secondary)';
      tabFood.style.borderBottomColor = 'transparent';
      
      workoutLogForm.style.display = 'flex';
      foodLogForm.style.display = 'none';
    });
  }

  // Food Form submit
  if (foodLogForm) {
    foodLogForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const addKal = parseFloat(document.getElementById('logFoodKal').value) || 0;
      const addProtein = parseFloat(document.getElementById('logFoodProtein').value) || 0;
      const addCarbs = parseFloat(document.getElementById('logFoodCarbs').value) || 0;
      const addFat = parseFloat(document.getElementById('logFoodFat').value) || 0;

      const currentLog = getDailyLog();
      currentLog.calories += addKal;
      currentLog.protein += addProtein;
      currentLog.carbs += addCarbs;
      currentLog.fat += addFat;

      saveDailyLog(currentLog);
      foodLogForm.reset();
      logPanel.style.display = 'none';

      if (calcResult) {
        renderProgressBars(calcResult);
      }
    });
  }

  // Workout Form submit
  if (workoutLogForm) {
    workoutLogForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const name = document.getElementById('logExName').value.trim() || 'Latihan';
      const addKal = parseFloat(document.getElementById('logExKal').value) || 0;

      const currentLog = getDailyLog();
      currentLog.burned += addKal;
      if (!currentLog.workouts) currentLog.workouts = [];
      currentLog.workouts.push({ activity: name, calories: addKal });

      saveDailyLog(currentLog);
      workoutLogForm.reset();
      logPanel.style.display = 'none';

      if (calcResult) {
        renderProgressBars(calcResult);
      }
    });
  }

  // Reset Hari Ini handlers
  document.addEventListener('click', (e) => {
    if (e.target && e.target.classList.contains('btn-reset-daily')) {
      if (confirm('Reset semua log makanan dan latihan hari ini?')) {
        const todayStr = new Date().toDateString();
        saveDailyLog({ calories: 0, protein: 0, carbs: 0, fat: 0, burned: 0, workouts: [], date: todayStr });
        if (calcResult) {
          renderProgressBars(calcResult);
        }
      }
    }
  });
  // Weight Log Form submit (Jurnal Progres Berat Badan)
  const weightLogForm = document.getElementById('weightLogForm');
  if (weightLogForm) {
    const logWeightDate = document.getElementById('logWeightDate');
    if (logWeightDate) {
      logWeightDate.value = new Date().toISOString().split('T')[0];
    }

    weightLogForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const weight = parseFloat(document.getElementById('logWeightInput').value);
      const date = document.getElementById('logWeightDate').value;
      if (!weight || !date) return;

      // Ambil tinggi badan aktif untuk menghitung BMI
      let activeHeight = 170;
      if (calcResult && calcResult.tinggi) {
        activeHeight = calcResult.tinggi;
      }

      const bmi = weight / ((activeHeight / 100) * (activeHeight / 100));
      const bmiCat = getBMICategory(bmi).label;

      let logs = JSON.parse(localStorage.getItem('fitlogic_weight_logs')) || [];
      
      // Ganti entri lama jika tanggalnya persis sama untuk menghindari duplikat
      logs = logs.filter(l => l.date !== date);
      
      logs.push({ date, weight, bmi, bmiCat });
      localStorage.setItem('fitlogic_weight_logs', JSON.stringify(logs));
      
      weightLogForm.reset();
      if (logWeightDate) {
        logWeightDate.value = new Date().toISOString().split('T')[0];
      }

      renderHistory();
      renderWeightChart();
    });
  }
});

// init
showPage('home');
