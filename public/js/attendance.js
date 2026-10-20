/**
 * attendance.js — Quick Clock In / Clock Out, daily attendance tracking & dashboard sync
 */
const Attendance = (() => {
  let todayRecord = null;

  async function checkToday() {
    const clockBtn = document.getElementById('clockBtn');
    const clockBtnText = document.getElementById('clockBtnText');
    if (!clockBtn || !clockBtnText) return;

    try {
      const data = await API.get('/attendance/today');
      const user = Auth.getUser();

      // Find record for current user if linked to employee
      if (user?.employeeRef) {
        todayRecord = data.records.find(r => r.employee?._id === user.employeeRef || r.employee === user.employeeRef);
      } else {
        // Admin or user without employeeRef: check first record or own action
        todayRecord = data.records[0] || null;
      }

      updateButtonUI();

      // Update dashboard attendance card if present
      const statAttendanceVal = document.getElementById('statAttendanceVal');
      const statAttendanceSub = document.getElementById('statAttendanceSub');
      if (statAttendanceVal && data.stats) {
        statAttendanceVal.textContent = `${data.stats.present} / ${data.stats.totalActive}`;
        if (statAttendanceSub) {
          statAttendanceSub.textContent = `${data.stats.attendanceRate}% attendance today`;
        }
      }
    } catch (err) {
      console.warn('Attendance sync notice:', err.message);
    }
  }

  function updateButtonUI() {
    const clockBtn = document.getElementById('clockBtn');
    const clockBtnText = document.getElementById('clockBtnText');
    if (!clockBtn || !clockBtnText) return;

    if (!todayRecord) {
      clockBtnText.textContent = 'Clock In';
      clockBtn.className = 'btn btn-sm btn-ghost';
      clockBtn.style.color = 'var(--clr-primary)';
      clockBtn.title = 'Click to Clock In for today';
    } else if (!todayRecord.checkOut) {
      const timeStr = new Date(todayRecord.checkIn).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      clockBtnText.textContent = `Clock Out (${timeStr})`;
      clockBtn.className = 'btn btn-sm btn-outline';
      clockBtn.style.color = 'var(--clr-amber)';
      clockBtn.title = `Clocked in at ${timeStr}. Click to Clock Out.`;
    } else {
      clockBtnText.textContent = `Completed (${todayRecord.workHours || 8}h)`;
      clockBtn.className = 'btn btn-sm btn-ghost';
      clockBtn.style.color = 'var(--clr-text-muted)';
      clockBtn.disabled = true;
      clockBtn.title = 'Daily shift completed';
    }
    lucide.createIcons();
  }

  async function handleClockAction() {
    const clockBtn = document.getElementById('clockBtn');
    if (clockBtn) clockBtn.disabled = true;

    try {
      if (!todayRecord) {
        const res = await API.post('/attendance/clock-in', {});
        todayRecord = res.record;
        Toast.show(res.message || 'Clocked in successfully!', 'success');
      } else if (!todayRecord.checkOut) {
        const res = await API.post('/attendance/clock-out', {});
        todayRecord = res.record;
        Toast.show(res.message || 'Clocked out successfully!', 'success');
      }
      await checkToday();
      if (typeof Dashboard !== 'undefined' && Dashboard.load) {
        Dashboard.load();
      }
    } catch (err) {
      Toast.show(err.message, 'error');
    } finally {
      if (clockBtn && (!todayRecord || !todayRecord.checkOut)) {
        clockBtn.disabled = false;
      }
    }
  }

  function setupListeners() {
    const clockBtn = document.getElementById('clockBtn');
    if (clockBtn) {
      clockBtn.addEventListener('click', handleClockAction);
    }
  }

  return { checkToday, setupListeners };
})();
