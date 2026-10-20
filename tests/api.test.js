/**
 * PeopleDesk Pro — Automated Integration & Unit Test Suite
 * Uses Node.js native test runner (node:test) and assertions (node:assert)
 */

const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');

let baseUrl = process.env.TEST_BASE_URL || 'http://localhost:3000';
let testServer = null;

// Cookie jars for role-based sessions
let adminCookie = '';
let employeeCookie = '';
let createdEmployeeId = '';

class Client {
  static async request(path, options = {}, cookie = '') {
    const url = `${baseUrl}${path}`;
    const headers = {
      'Content-Type': 'application/json',
      ...(cookie ? { Cookie: cookie } : {}),
      ...(options.headers || {}),
    };

    const res = await fetch(url, {
      ...options,
      headers,
    });

    const setCookie = res.headers.get('set-cookie');
    const rawText = await res.text();
    let data;
    try {
      data = JSON.parse(rawText);
    } catch {
      data = rawText;
    }

    return {
      status: res.status,
      ok: res.ok,
      headers: res.headers,
      setCookie,
      data,
    };
  }
}

before(async () => {
  // Check if server is already running on baseUrl
  try {
    const res = await fetch(`${baseUrl}/api/health`, { signal: AbortSignal.timeout(1500) });
    if (res.ok) {
      return;
    }
  } catch {
    // Start local instance on port 3001
    process.env.NODE_ENV = 'test';
    process.env.PORT = '3001';
    baseUrl = 'http://localhost:3001';
    const { bootstrap } = require('../server');
    testServer = await bootstrap();
  }
});

after(async () => {
  if (testServer && typeof testServer.close === 'function') {
    testServer.close();
  }
});

describe('1. System Health & Infrastructure', () => {
  test('GET /api/health should return 200 with PeopleDesk Pro details', async () => {
    const res = await Client.request('/api/health');
    assert.equal(res.status, 200);
    assert.equal(res.data.status, 'ok');
    assert.equal(res.data.app, 'PeopleDesk Pro');
    assert.equal(res.data.version, '2.0.0');
  });
});

describe('2. Authentication & Session Management', () => {
  test('POST /api/auth/login with invalid credentials should return 401', async () => {
    const res = await Client.request('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: 'wrong@example.com', password: 'InvalidPassword123!' }),
    });
    assert.equal(res.status, 401);
    assert.ok(res.data.error);
  });

  test('POST /api/auth/login with valid Admin credentials should return 200 & session cookie', async () => {
    const res = await Client.request('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: 'admin@peopledesk.com', password: 'Admin@123!' }),
    });
    assert.equal(res.status, 200);
    assert.equal(res.data.user.role, 'admin');
    assert.ok(res.setCookie, 'Should receive session cookie');
    adminCookie = res.setCookie.split(';')[0];
  });

  test('GET /api/auth/me with Admin session should return authenticated user', async () => {
    const res = await Client.request('/api/auth/me', {}, adminCookie);
    assert.equal(res.status, 200);
    assert.equal(res.data.user.email, 'admin@peopledesk.com');
    assert.equal(res.data.user.role, 'admin');
  });

  test('GET /api/auth/me without session should return 401 Unauthorized', async () => {
    const res = await Client.request('/api/auth/me');
    assert.equal(res.status, 401);
  });

  test('POST /api/auth/login with Employee credentials should authenticate employee', async () => {
    const res = await Client.request('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: 'aarav.sharma@example.com', password: 'Employee@123!' }),
    });
    assert.equal(res.status, 200);
    assert.equal(res.data.user.role, 'employee');
    assert.ok(res.setCookie);
    employeeCookie = res.setCookie.split(';')[0];
  });
});

describe('3. Role-Based Access Control (RBAC) Enforcement', () => {
  test('Employee role CANNOT create new employees (403 Forbidden)', async () => {
    const res = await Client.request(
      '/api/employees',
      {
        method: 'POST',
        body: JSON.stringify({
          name: 'Hacker User',
          email: 'hacker@test.com',
          department: 'Engineering',
          role: 'Junior Engineer',
          salary: 50000,
        }),
      },
      employeeCookie
    );
    assert.equal(res.status, 403);
  });

  test('Employee role CANNOT access audit logs (403 Forbidden)', async () => {
    const res = await Client.request('/api/audit-logs', {}, employeeCookie);
    assert.equal(res.status, 403);
  });
});

describe('4. Employee CRUD & Business Logic', () => {
  test('Admin GET /api/employees should list existing employees', async () => {
    const res = await Client.request('/api/employees', {}, adminCookie);
    assert.equal(res.status, 200);
    assert.ok(Array.isArray(res.data.employees));
    assert.ok(res.data.employees.length > 0, 'Seeded employees should exist');
  });

  test('Admin POST /api/employees should create a valid employee', async () => {
    const newEmp = {
      name: 'Rohan Verma',
      email: `rohan.${Date.now()}@example.com`,
      phone: '+91 98765 43210',
      department: 'Engineering',
      designation: 'Senior DevOps Engineer',
      salary: 85000,
      joiningDate: '2024-01-15',
      performanceRating: 5,
      bloodGroup: 'O+',
      emergencyContact: '+91 91234 56789',
    };

    const res = await Client.request(
      '/api/employees',
      {
        method: 'POST',
        body: JSON.stringify(newEmp),
      },
      adminCookie
    );

    assert.equal(res.status, 201);
    assert.ok(res.data.employee._id);
    assert.equal(res.data.employee.name, 'Rohan Verma');
    assert.equal(res.data.employee.performanceRating, 5);
    assert.equal(res.data.employee.bloodGroup, 'O+');
    createdEmployeeId = res.data.employee._id;
  });

  test('Admin POST /api/employees with duplicate email should be rejected (409)', async () => {
    const duplicateEmp = {
      name: 'Duplicate Rohan',
      email: 'aarav.sharma@example.com', // Already exists in seed
      department: 'Engineering',
      designation: 'DevOps',
      salary: 70000,
      joiningDate: '2024-01-01',
    };

    const res = await Client.request(
      '/api/employees',
      {
        method: 'POST',
        body: JSON.stringify(duplicateEmp),
      },
      adminCookie
    );

    assert.equal(res.status, 409);
    assert.match(res.data.error, /already exists/i);
  });

  test('Admin GET /api/employees/:id should fetch single employee details', async () => {
    assert.ok(createdEmployeeId, 'Created employee ID must exist');
    const res = await Client.request(`/api/employees/${createdEmployeeId}`, {}, adminCookie);
    assert.equal(res.status, 200);
    assert.equal(res.data.employee._id, createdEmployeeId);
    assert.equal(res.data.employee.name, 'Rohan Verma');
  });

  test('Admin PUT /api/employees/:id should update employee fields', async () => {
    assert.ok(createdEmployeeId);
    const res = await Client.request(
      `/api/employees/${createdEmployeeId}`,
      {
        method: 'PUT',
        body: JSON.stringify({
          designation: 'Lead DevOps Architect',
          salary: 95000,
          performanceRating: 5,
        }),
      },
      adminCookie
    );

    assert.equal(res.status, 200);
    assert.equal(res.data.employee.designation, 'Lead DevOps Architect');
    assert.equal(res.data.employee.salary, 95000);
  });

  test('Admin DELETE /api/employees/:id should delete the employee', async () => {
    assert.ok(createdEmployeeId);
    const res = await Client.request(
      `/api/employees/${createdEmployeeId}`,
      {
        method: 'DELETE',
      },
      adminCookie
    );

    assert.equal(res.status, 200);

    // Verify it is gone or marked deleted
    const verifyRes = await Client.request(`/api/employees/${createdEmployeeId}`, {}, adminCookie);
    assert.equal(verifyRes.status, 404);
  });
});

describe('5. Salary Slip Generation', () => {
  test('GET /api/employees/:id/salary-slip should compute valid CTC & deduction breakdown', async () => {
    // Use first seeded employee
    const listRes = await Client.request('/api/employees', {}, adminCookie);
    const sampleEmp = listRes.data.employees[0];
    assert.ok(sampleEmp, 'Sample employee must exist');

    const res = await Client.request(`/api/employees/${sampleEmp._id}/salary-slip`, {}, adminCookie);
    assert.equal(res.status, 200);
    assert.ok(res.data.slip);
    assert.equal(res.data.slip.employee.employeeId, sampleEmp.employeeId);
    assert.ok(res.data.slip.netSalary > 0);
    assert.ok(res.data.slip.grossEarnings > 0);
    assert.ok(Array.isArray(res.data.slip.earnings));
    assert.ok(Array.isArray(res.data.slip.deductions));
  });
});

describe('6. Attendance Tracking System', () => {
  test('GET /api/attendance/today should return today attendance record', async () => {
    const res = await Client.request('/api/attendance/today', {}, adminCookie);
    assert.equal(res.status, 200);
    assert.ok(Array.isArray(res.data.records));
    assert.ok('stats' in res.data);
  });

  test('POST /api/attendance/clock-in should record clock-in time', async () => {
    const res = await Client.request('/api/attendance/clock-in', { method: 'POST' }, adminCookie);
    // Either 201 (new clock in) or 400 (already clocked in today)
    assert.ok(res.status === 201 || res.status === 400);
    assert.ok(res.data.record);
  });

  test('POST /api/attendance/clock-out should record clock-out time and work hours', async () => {
    const res = await Client.request('/api/attendance/clock-out', { method: 'POST' }, adminCookie);
    // Either 200 (clocked out) or 400 (already clocked out)
    assert.ok(res.status === 200 || res.status === 400);
    assert.ok(res.data.record);
  });

  test('GET /api/attendance/stats should return attendance statistics', async () => {
    const res = await Client.request('/api/attendance/stats', {}, adminCookie);
    assert.equal(res.status, 200);
    assert.ok('present' in res.data);
    assert.ok('totalActive' in res.data);
    assert.ok('attendanceRate' in res.data);
  });
});

describe('7. Dashboard Analytics & Aggregation', () => {
  test('GET /api/dashboard/stats should return company wide metrics', async () => {
    const res = await Client.request('/api/dashboard/stats', {}, adminCookie);
    assert.equal(res.status, 200);
    assert.ok(res.data.stats);
    assert.ok(typeof res.data.stats.total === 'number');
    assert.ok(typeof res.data.stats.active === 'number');
    assert.ok(typeof res.data.stats.monthlyPayroll === 'number');
  });

  test('GET /api/dashboard/department-distribution should return department groupings without 500 error', async () => {
    const res = await Client.request('/api/dashboard/department-distribution', {}, adminCookie);
    assert.equal(res.status, 200);
    assert.ok(Array.isArray(res.data.distribution));
    assert.ok(res.data.distribution.length > 0, 'Departments should be aggregated');
    assert.ok('_id' in res.data.distribution[0]);
    assert.ok('total' in res.data.distribution[0]);
  });
});

describe('8. Leave Management & Audit Logs', () => {
  test('GET /api/leaves should return leaves list', async () => {
    const res = await Client.request('/api/leaves', {}, adminCookie);
    assert.equal(res.status, 200);
    assert.ok(Array.isArray(res.data.leaves));
  });

  test('Admin GET /api/audit-logs should return system audit trail', async () => {
    const res = await Client.request('/api/audit-logs', {}, adminCookie);
    assert.equal(res.status, 200);
    assert.ok(Array.isArray(res.data.logs));
  });
});
