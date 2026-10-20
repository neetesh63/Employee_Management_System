/**
 * dashboard.js — Stats cards, Chart.js charts, recent employees
 */
const Dashboard = (() => {
  let deptChart = null;
  let hiringChart = null;

  // Emerald palette for charts (absolutely zero blue)
  const CHART_COLORS = [
    '#059669', '#34D399', '#6EE7B7', '#A7F3D0',
    '#D1FAE5', '#78716C', '#A8A29E', '#57534E',
  ];

  function isDark() {
    return document.documentElement.getAttribute('data-theme') === 'dark';
  }

  function chartDefaults() {
    const textColor = isDark() ? '#A7B5AC' : '#64748B';
    const gridColor = isDark() ? '#2A3D34' : '#E2E8F0';
    return { textColor, gridColor };
  }

  function formatINR(n) {
    if (n == null) return '₹0';
    return '₹' + Number(n).toLocaleString('en-IN');
  }

  async function load() {
    try {
      const [statsData, distData, trendData] = await Promise.all([
        API.get('/dashboard/stats'),
        API.get('/dashboard/department-distribution'),
        API.get('/dashboard/hiring-trends'),
      ]);

      renderStats(statsData.stats);
      renderRecent(statsData.recentEmployees || []);
      renderDeptChart(distData.distribution || []);
      renderHiringChart(trendData.trends || []);

      // Update leave badge
      const badge = document.getElementById('leaveBadge');
      if (badge && statsData.stats.pendingLeaves > 0) {
        badge.textContent = statsData.stats.pendingLeaves;
        badge.style.display = '';
      }

      if (typeof Attendance !== 'undefined' && Attendance.checkToday) {
        Attendance.checkToday();
      }
    } catch (err) {
      console.error('Dashboard load error:', err);
    }
  }

  function renderStats(s) {
    document.getElementById('statTotalVal').textContent    = s.total ?? '—';
    document.getElementById('statActiveVal').textContent   = s.active ?? '—';
    document.getElementById('statDeptsVal').textContent    = s.departments ?? '—';
    document.getElementById('statPayrollVal').textContent  = formatINR(s.monthlyPayroll);
    document.getElementById('statInactiveVal').textContent = s.inactive ?? '—';
    document.getElementById('statPendingLeavesVal').textContent = s.pendingLeaves ?? '—';
  }

  function renderRecent(employees) {
    const el = document.getElementById('recentEmployees');
    if (!employees.length) {
      el.innerHTML = '<div class="empty-state"><p>No recent employees.</p></div>';
      return;
    }
    el.innerHTML = employees.map(e => `
      <div class="recent-item" data-id="${e._id}" onclick="app.viewEmployee('${e._id}')">
        <div class="emp-avatar">${e.profilePhoto
          ? `<img src="${e.profilePhoto}" alt="${e.name}">`
          : Auth.initials(e.name)}</div>
        <div class="recent-info">
          <div class="recent-name">${esc(e.name)}</div>
          <div class="recent-meta">${esc(e.employeeId)} · ${esc(e.designation)}</div>
        </div>
        <span class="dept-pill recent-dept">${esc(e.department?.name || '—')}</span>
        <span class="badge badge-${e.status}">${formatStatus(e.status)}</span>
      </div>
    `).join('');
  }

  function renderDeptChart(dist) {
    const ctx = document.getElementById('deptChart');
    if (!ctx) return;
    if (deptChart) deptChart.destroy();

    const labels = dist.map(d => d._id);
    const data = dist.map(d => d.total);
    const { textColor } = chartDefaults();

    deptChart = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels,
        datasets: [{
          data,
          backgroundColor: CHART_COLORS.slice(0, labels.length),
          borderWidth: 2,
          borderColor: isDark() ? '#17211F' : '#FFFFFF',
          hoverOffset: 8,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        cutout: '55%',
        plugins: {
          legend: {
            position: 'bottom',
            labels: { color: textColor, padding: 12, font: { family: 'Inter', size: 12 }, usePointStyle: true, pointStyleWidth: 8 },
          },
          tooltip: {
            backgroundColor: isDark() ? '#17211F' : '#1F2937',
            titleFont: { family: 'Inter' }, bodyFont: { family: 'Inter' },
            padding: 10, cornerRadius: 8,
          },
        },
      },
    });
  }

  function renderHiringChart(trends) {
    const ctx = document.getElementById('hiringChart');
    if (!ctx) return;
    if (hiringChart) hiringChart.destroy();

    const monthNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    const labels = trends.map(t => `${monthNames[t._id.month - 1]} ${t._id.year}`);
    const data = trends.map(t => t.count);
    const { textColor, gridColor } = chartDefaults();

    hiringChart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels,
        datasets: [{
          label: 'New Hires',
          data,
          backgroundColor: isDark() ? '#34D399' : '#059669',
          borderRadius: 6,
          maxBarThickness: 32,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: isDark() ? '#17211F' : '#1F2937',
            titleFont: { family: 'Inter' }, bodyFont: { family: 'Inter' },
            padding: 10, cornerRadius: 8,
          },
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: { color: textColor, font: { family: 'Inter', size: 11 } },
          },
          y: {
            grid: { color: gridColor },
            ticks: { color: textColor, font: { family: 'Inter', size: 11 }, stepSize: 1 },
            beginAtZero: true,
          },
        },
      },
    });
  }

  // Called when theme changes
  function refreshCharts() {
    // Re-render by reloading
    load();
  }

  return { load, refreshCharts };
})();
