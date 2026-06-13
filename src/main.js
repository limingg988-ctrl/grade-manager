import { Chart, registerables } from 'https://cdn.jsdelivr.net/npm/chart.js@4.4.1/+esm';
Chart.register(...registerables);

// ---------- ストレージ ----------
function loadGrades() {
  try { return JSON.parse(localStorage.getItem('grades_v2') || '[]'); } catch { return []; }
}
function saveGrades(grades) {
  try { localStorage.setItem('grades_v2', JSON.stringify(grades)); } catch {}
}

let grades = loadGrades();
let subjectChart, trendChart;

// ---------- ユーティリティ ----------
const getSubjects = () => [...new Set(grades.map(g => g.subject))];
const avg = arr => arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
const getPct = g => Math.round(g.score / g.maxScore * 100);
const getBarColor = pct => pct >= 80 ? '#639922' : pct >= 60 ? '#BA7517' : '#E24B4A';

function getBadge(pct) {
  if (pct >= 80) return '<span class="badge badge-pass">良好</span>';
  if (pct >= 60) return '<span class="badge badge-warn">普通</span>';
  return '<span class="badge badge-fail">要改善</span>';
}

// ---------- タブ ----------
document.querySelectorAll('.tab').forEach(btn => {
  btn.addEventListener('click', () => showTab(btn.dataset.tab));
});

function showTab(name) {
  document.querySelectorAll('.tab').forEach(b => b.classList.toggle('active', b.dataset.tab === name));
  document.querySelectorAll('.tab-content').forEach(el => el.classList.add('hidden'));
  document.getElementById('tab-' + name).classList.remove('hidden');
  if (name === 'dashboard') renderDashboard();
  if (name === 'grades') renderGradeList();
  if (name === 'add') populateSubjectSelect();
}

// ---------- ダッシュボード ----------
function renderDashboard() {
  const total = grades.length;
  const avgPct = total ? Math.round(avg(grades.map(getPct))) : 0;
  const best = total ? Math.max(...grades.map(getPct)) : 0;
  const subjects = getSubjects().length;

  document.getElementById('metrics').innerHTML = `
    <div class="metric"><div class="metric-label">登録数</div><div class="metric-value">${total}</div></div>
    <div class="metric"><div class="metric-label">平均点率</div><div class="metric-value">${avgPct}%</div></div>
    <div class="metric"><div class="metric-label">最高得点率</div><div class="metric-value">${best}%</div></div>
    <div class="metric"><div class="metric-label">科目数</div><div class="metric-value">${subjects}</div></div>
  `;
  renderSubjectChart();
  renderTrendChart();
  renderRecent();
}

function renderSubjectChart() {
  const subjects = getSubjects();
  const data = subjects.map(s => Math.round(avg(grades.filter(g => g.subject === s).map(getPct))));
  const colors = ['#534AB7', '#3B6D11', '#BA7517', '#A32D2D', '#3266ad', '#0F6E56'];
  if (subjectChart) subjectChart.destroy();
  subjectChart = new Chart(document.getElementById('subjectChart'), {
    type: 'bar',
    data: {
      labels: subjects.length ? subjects : ['データなし'],
      datasets: [{ label: '平均点率(%)', data: subjects.length ? data : [0], backgroundColor: subjects.map((_, i) => colors[i % colors.length]), borderRadius: 4 }]
    },
    options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { min: 0, max: 100, ticks: { callback: v => v + '%' } } } }
  });
}

function renderTrendChart() {
  const sorted = [...grades].sort((a, b) => new Date(a.date) - new Date(b.date)).slice(-10);
  if (trendChart) trendChart.destroy();
  trendChart = new Chart(document.getElementById('trendChart'), {
    type: 'line',
    data: {
      labels: sorted.map(g => g.date.slice(5)),
      datasets: [{ label: '点数率(%)', data: sorted.map(getPct), borderColor: '#534AB7', backgroundColor: 'rgba(83,74,183,.1)', fill: true, tension: .3, pointRadius: 4 }]
    },
    options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { min: 0, max: 100, ticks: { callback: v => v + '%' } } } }
  });
}

function renderRecent() {
  const items = [...grades].sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 5);
  const el = document.getElementById('recent-items');
  if (!items.length) { el.innerHTML = '<div class="empty">成績がまだありません。「成績を追加」から登録してください。</div>'; return; }
  el.innerHTML = items.map(g => {
    const pct = getPct(g);
    const target = g.target ? `<span style="font-size:12px;color:var(--text-secondary)"> / 目標 ${g.target}</span>` : '';
    return `<div class="subject-item">
      <div style="min-width:90px">
        <div style="font-weight:500;font-size:14px">${g.subject}</div>
        <div style="font-size:12px;color:var(--text-secondary)">${g.date} · ${g.examType}</div>
      </div>
      <div class="progress-bar"><div class="progress-fill" style="width:${pct}%;background:${getBarColor(pct)}"></div></div>
      <div style="min-width:110px;text-align:right">${g.score}/${g.maxScore}${target} ${getBadge(pct)}</div>
    </div>`;
  }).join('');
}

// ---------- 成績一覧 ----------
document.getElementById('filter-subject').addEventListener('change', renderGradeList);
document.getElementById('filter-sort').addEventListener('change', renderGradeList);

function renderGradeList() {
  const filterSubj = document.getElementById('filter-subject').value;
  const sortVal = document.getElementById('filter-sort').value;
  let list = grades.filter(g => !filterSubj || g.subject === filterSubj);
  list.sort((a, b) => {
    if (sortVal === 'date-desc') return new Date(b.date) - new Date(a.date);
    if (sortVal === 'date-asc') return new Date(a.date) - new Date(b.date);
    if (sortVal === 'score-desc') return getPct(b) - getPct(a);
    return getPct(a) - getPct(b);
  });

  const sel = document.getElementById('filter-subject');
  const cur = sel.value;
  sel.innerHTML = '<option value="">すべての科目</option>' + getSubjects().map(s => `<option value="${s}" ${s === cur ? 'selected' : ''}>${s}</option>`).join('');

  const el = document.getElementById('grade-list');
  if (!list.length) { el.innerHTML = '<div class="empty">成績データがありません</div>'; return; }
  el.innerHTML = list.map(g => {
    const pct = getPct(g);
    const idx = grades.indexOf(g);
    const memoStr = g.memo ? `<div style="font-size:12px;color:var(--text-secondary);margin-top:2px">${g.memo}</div>` : '';
    return `<div class="subject-item">
      <div style="flex:1">
        <div style="display:flex;align-items:center;gap:8px">
          <span style="font-weight:500">${g.subject}</span>
          <span style="font-size:12px;color:var(--text-secondary)">${g.examType}</span>
          ${getBadge(pct)}
        </div>
        <div style="font-size:12px;color:var(--text-secondary);margin-top:2px">${g.date}　${g.score}/${g.maxScore}点 (${pct}%)${g.target ? '　目標: ' + g.target + '点' : ''}</div>
        ${memoStr}
      </div>
      <button class="btn btn-sm btn-danger" data-idx="${idx}" aria-label="削除"><i class="ti ti-trash"></i></button>
    </div>`;
  }).join('');

  el.querySelectorAll('[data-idx]').forEach(btn => {
    btn.addEventListener('click', () => deleteGrade(Number(btn.dataset.idx)));
  });
}

// ---------- 成績を追加 ----------
function populateSubjectSelect() {
  const sel = document.getElementById('subject-select');
  sel.innerHTML = '<option value="">-- 選択または下に新規入力 --</option>' + getSubjects().map(s => `<option value="${s}">${s}</option>`).join('');
}

document.getElementById('subject-select').addEventListener('change', () => {
  if (document.getElementById('subject-select').value) document.getElementById('subject-new').value = '';
});

document.getElementById('add-btn').addEventListener('click', () => {
  const subjectSel = document.getElementById('subject-select').value;
  const subjectNew = document.getElementById('subject-new').value.trim();
  const subject = subjectNew || subjectSel;
  const score = parseFloat(document.getElementById('score').value);
  const maxScore = parseFloat(document.getElementById('max-score').value) || 100;
  const target = parseFloat(document.getElementById('target').value) || null;
  const date = document.getElementById('date').value;
  const examType = document.getElementById('exam-type').value;
  const memo = document.getElementById('memo').value.trim();

  if (!subject) { alert('科目名を入力してください'); return; }
  if (isNaN(score)) { alert('点数を入力してください'); return; }
  if (!date) { alert('日付を入力してください'); return; }

  grades.push({ subject, score, maxScore, target, date, examType, memo });
  saveGrades(grades);

  ['score', 'target', 'memo', 'subject-new'].forEach(id => document.getElementById(id).value = '');
  document.getElementById('subject-select').value = '';
  alert('✓ 成績を追加しました');
  showTab('dashboard');
});

function deleteGrade(idx) {
  if (!confirm('この成績を削除しますか？')) return;
  grades.splice(idx, 1);
  saveGrades(grades);
  renderGradeList();
}

// ---------- 初期化 ----------
document.getElementById('date').value = new Date().toISOString().slice(0, 10);
renderDashboard();
