/**
 * CSV Export Utility
 * Safely generates RFC-4180 compliant CSV from employee records.
 */

function escapeCSV(val) {
  if (val === null || val === undefined) return '';
  const s = String(val);
  // Wrap in quotes if value contains comma, quote, newline, or leading/trailing spaces
  if (/[,"\n\r]/.test(s) || s !== s.trim()) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function formatDate(d) {
  if (!d) return '';
  return new Date(d).toISOString().split('T')[0];
}

function formatINR(n) {
  return n != null ? String(Number(n)) : '';
}

const HEADERS = [
  'Employee ID', 'Full Name', 'Email', 'Phone',
  'Department', 'Designation', 'Employment Type',
  'Status', 'Joining Date', 'Monthly Salary (INR)',
  'Reporting Manager', 'Skills', 'Address',
  'Created At',
];

/**
 * @param {Array} employees - Populated employee documents (lean)
 * @returns {string} CSV string
 */
function generateCSV(employees) {
  const rows = employees.map((e) => [
    e.employeeId,
    e.name,
    e.email,
    e.phone || '',
    e.department?.name || '',
    e.designation,
    e.employmentType,
    e.status,
    formatDate(e.joiningDate),
    formatINR(e.salary),
    e.reportingManager?.name || '',
    (e.skills || []).join('; '),
    e.address || '',
    formatDate(e.createdAt),
  ]);

  return [
    HEADERS.map(escapeCSV).join(','),
    ...rows.map((r) => r.map(escapeCSV).join(',')),
  ].join('\n');
}

module.exports = { generateCSV };
