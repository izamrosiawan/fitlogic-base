'use strict';

// simpan hasil kalkulasi terakhir
let calcResult = null;

// instance chart supaya bisa di-destroy sebelum render ulang
let chartInstances = {
  macro: null,
  calorie: null,
  bmi: null
};

// navigasi antar halaman
function showPage(pageId) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));

  const target = document.getElementById('page-' + pageId);
  if (target) target.classList.add('active');

  document.querySelectorAll('.nav-link').forEach(link => {
    link.classList.toggle('active', link.dataset.page === pageId);
  });

  window.scrollTo({ top: 0, behavior: 'smooth' });
  document.getElementById('navLinks').classList.remove('open');

  if (pageId === 'dashboard') renderDashboard();
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
  if (bmi < 18.5) return { label: 'Kurus (Underweight)', color: '#0071e3', pct: 20 };
  if (bmi < 25)   return { label: 'Normal',              color: '#34c759', pct: 45 };
  if (bmi < 30)   return { label: 'Gemuk (Overweight)',  color: '#ff9f0a', pct: 70 };
  return                  { label: 'Obesitas',           color: '#ff3b30', pct: 90 };
}

function calcTargetCalories(tdee, goal) {
  if (goal === 'cutting') return Math.round(tdee - 500);
  if (goal === 'bulking')  return Math.round(tdee + 500);
  return Math.round(tdee);
}

// hitung makronutrisi berdasarkan target kalori dan goal
// 1g protein/karbohidrat = 4 kcal, 1g lemak = 9 kcal
function calcMacros(targetCal, goal) {
  let pPct, cPct, fPct;
  if (goal === 'cutting')      { pPct = 0.40; cPct = 0.35; fPct = 0.25; }
  else if (goal === 'bulking') { pPct = 0.30; cPct = 0.50; fPct = 0.20; }
  else                         { pPct = 0.30; cPct = 0.45; fPct = 0.25; }

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
    cutting:     '🔥 Cutting – Turunkan Berat',
    maintenance: '⚖️ Maintenance – Jaga Berat',
    bulking:     '💪 Bulking – Tambah Massa'
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
  showPage('result');
});

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
  document.getElementById('dGoal').textContent   = { cutting: 'Cutting', maintenance: 'Maintenance', bulking: 'Bulking' }[r.goal];
  document.getElementById('dBMI').textContent    = r.bmi.toFixed(1) + ' – ' + r.bmiCat.label;
  document.getElementById('dKalori').textContent = r.target.toLocaleString('id-ID') + ' kcal';

  renderMacroChart(r);
  renderCalorieChart(r);
  renderBMIChart(r);
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
        backgroundColor: ['#34c759', '#ff9f0a', '#af52de'],
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
  const colors = ['#34c759', '#ff9f0a', '#af52de'];
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
          'rgba(0,113,227,0.75)',
          'rgba(52,199,89,0.75)',
          r.goal === 'cutting' ? 'rgba(255,59,48,0.75)' :
          r.goal === 'bulking' ? 'rgba(175,82,222,0.75)' :
                                 'rgba(255,159,10,0.75)'
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
          grid: { color: 'rgba(0,0,0,0.05)' },
          ticks: { callback: v => v.toLocaleString('id-ID') }
        },
        x: { grid: { display: false } }
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
  const colors   = ['#0071e3', '#34c759', '#ff9f0a', '#ff3b30'];

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

// progress bar simulasi konsumsi harian
function renderProgressBars(r) {
  const m = r.macros;

  // simulasi progress hari ini (demo, bukan data real)
  const simPct = { kal: 72, protein: 68, carbs: 80, fat: 65 };

  document.getElementById('progKalLabel').textContent     = `${Math.round(r.target * simPct.kal / 100).toLocaleString('id-ID')} / ${r.target.toLocaleString('id-ID')} kcal`;
  document.getElementById('progProteinLabel').textContent = `${Math.round(m.proteinG * simPct.protein / 100)}g / ${m.proteinG}g`;
  document.getElementById('progCarbsLabel').textContent   = `${Math.round(m.carbsG * simPct.carbs / 100)}g / ${m.carbsG}g`;
  document.getElementById('progFatLabel').textContent     = `${Math.round(m.fatG * simPct.fat / 100)}g / ${m.fatG}g`;

  setTimeout(() => {
    document.getElementById('progKal').style.width     = simPct.kal + '%';
    document.getElementById('progProtein').style.width = simPct.protein + '%';
    document.getElementById('progCarbs').style.width   = simPct.carbs + '%';
    document.getElementById('progFat').style.width     = simPct.fat + '%';
  }, 200);
}

// reset form dan hapus semua error
function resetForm() {
  document.getElementById('calcForm').reset();
  document.querySelectorAll('.form-input, .form-select').forEach(el => el.classList.remove('error'));
  document.querySelectorAll('.form-error').forEach(el => el.textContent = '');
  calcResult = null;
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

// init
showPage('home');
