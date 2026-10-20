const User = require('../models/User');
const Employee = require('../models/Employee');
const Department = require('../models/Department');
const LeaveRequest = require('../models/LeaveRequest');

const DEPARTMENTS = [
  { name: 'Engineering', description: 'Software development and technical infrastructure' },
  { name: 'Human Resources', description: 'People operations, recruitment and culture' },
  { name: 'Marketing', description: 'Brand, growth and customer acquisition' },
  { name: 'Finance', description: 'Accounting, budgeting and financial planning' },
  { name: 'Operations', description: 'Business operations and process management' },
  { name: 'Sales', description: 'Revenue generation and client relationships' },
];

const EMP_DATA = [
  { name: 'Aarav Sharma', email: 'aarav.sharma@example.com', phone: '9876543210', dept: 0, designation: 'Senior Frontend Developer', type: 'full_time', salary: 95000, status: 'active', skills: ['React', 'JavaScript', 'CSS'], daysAgo: 720 },
  { name: 'Meera Singh', email: 'meera.singh@example.com', phone: '9876543211', dept: 1, designation: 'HR Manager', type: 'full_time', salary: 75000, status: 'active', skills: ['Recruitment', 'HRMS'], daysAgo: 600 },
  { name: 'Rohan Patel', email: 'rohan.patel@example.com', phone: '9876543212', dept: 0, designation: 'Backend Developer', type: 'full_time', salary: 88000, status: 'active', skills: ['Node.js', 'MongoDB', 'Express'], daysAgo: 480 },
  { name: 'Priya Nair', email: 'priya.nair@example.com', phone: '9876543213', dept: 2, designation: 'Marketing Manager', type: 'full_time', salary: 72000, status: 'active', skills: ['SEO', 'Content Strategy'], daysAgo: 365 },
  { name: 'Arjun Kumar', email: 'arjun.kumar@example.com', phone: '9876543214', dept: 5, designation: 'Sales Executive', type: 'full_time', salary: 52000, status: 'active', skills: ['CRM', 'Negotiation'], daysAgo: 300 },
  { name: 'Sneha Reddy', email: 'sneha.reddy@example.com', phone: '9876543215', dept: 3, designation: 'Financial Analyst', type: 'full_time', salary: 68000, status: 'active', skills: ['Excel', 'Accounting'], daysAgo: 280 },
  { name: 'Vikram Joshi', email: 'vikram.joshi@example.com', phone: '9876543216', dept: 0, designation: 'DevOps Engineer', type: 'full_time', salary: 92000, status: 'active', skills: ['Docker', 'Kubernetes', 'CI/CD'], daysAgo: 250 },
  { name: 'Ananya Gupta', email: 'ananya.gupta@example.com', phone: '9876543217', dept: 4, designation: 'Operations Manager', type: 'full_time', salary: 74000, status: 'active', skills: ['Process Improvement'], daysAgo: 220 },
  { name: 'Raj Mehta', email: 'raj.mehta@example.com', phone: '9876543218', dept: 0, designation: 'UI/UX Designer', type: 'full_time', salary: 70000, status: 'active', skills: ['Figma', 'Design Systems'], daysAgo: 180 },
  { name: 'Kavya Iyer', email: 'kavya.iyer@example.com', phone: '9876543219', dept: 2, designation: 'Content Strategist', type: 'part_time', salary: 38000, status: 'active', skills: ['Copywriting', 'SEO'], daysAgo: 150 },
  { name: 'Dev Sharma', email: 'dev.sharma@example.com', phone: '9876543220', dept: 0, designation: 'Junior Developer', type: 'intern', salary: 22000, status: 'active', skills: ['JavaScript', 'Python'], daysAgo: 90 },
  { name: 'Riya Kapoor', email: 'riya.kapoor@example.com', phone: '9876543221', dept: 1, designation: 'HR Executive', type: 'full_time', salary: 58000, status: 'active', skills: ['Onboarding', 'HRMS'], daysAgo: 60 },
  { name: 'Sameer Verma', email: 'sameer.verma@example.com', phone: '9876543222', dept: 5, designation: 'Sales Manager', type: 'full_time', salary: 85000, status: 'inactive', skills: ['B2B Sales', 'Leadership'], daysAgo: 400 },
  { name: 'Tanvi Mishra', email: 'tanvi.mishra@example.com', phone: '9876543223', dept: 3, designation: 'Senior Accountant', type: 'full_time', salary: 78000, status: 'on_leave', skills: ['Taxation', 'Tally'], daysAgo: 500 },
];

function daysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
}

async function seedDatabase({ clean = false } = {}) {
  if (clean) {
    console.log('🗑   Wiping existing data …');
    await Promise.all([
      User.deleteMany({}),
      Employee.deleteMany({}),
      Department.deleteMany({}),
      LeaveRequest.deleteMany({}),
    ]);
    console.log('✅  Data wiped\n');
  }

  // Departments
  const deptDocs = [];
  for (const d of DEPARTMENTS) {
    let doc = await Department.findOne({ name: d.name });
    if (!doc) {
      doc = await Department.create(d);
      console.log(`   ✔ Dept: ${doc.name}`);
    }
    deptDocs.push(doc);
  }

  // Employees
  const empDocs = {};
  let counter = 1;
  const lastEmp = await Employee.findOne({}, { employeeId: 1 }).sort({ employeeId: -1 }).lean();
  if (lastEmp) counter = parseInt(lastEmp.employeeId.replace('EMP', ''), 10) + 1;

  for (const e of EMP_DATA) {
    let doc = await Employee.findOne({ email: e.email });
    if (!doc) {
      doc = await Employee.create({
        employeeId: `EMP${String(counter++).padStart(3, '0')}`,
        name: e.name,
        email: e.email,
        phone: e.phone,
        department: deptDocs[e.dept]._id,
        designation: e.designation,
        joiningDate: daysAgo(e.daysAgo),
        status: e.status,
        employmentType: e.type,
        salary: e.salary,
        skills: e.skills,
      });
      console.log(`   ✔ Emp: ${doc.name} (${doc.employeeId})`);
    }
    empDocs[e.email] = doc;
  }

  // Managers
  const setManager = async (empEmail, mgEmail) => {
    if (empDocs[empEmail] && empDocs[mgEmail]) {
      await Employee.findByIdAndUpdate(empDocs[empEmail]._id, { reportingManager: empDocs[mgEmail]._id });
    }
  };
  await setManager('dev.sharma@example.com', 'aarav.sharma@example.com');
  await setManager('raj.mehta@example.com', 'vikram.joshi@example.com');
  await setManager('riya.kapoor@example.com', 'meera.singh@example.com');
  await setManager('arjun.kumar@example.com', 'sameer.verma@example.com');

  // Users
  const USER_DATA = [
    {
      name: 'Admin User',
      email: process.env.SEED_ADMIN_EMAIL || 'admin@peopledesk.com',
      password: process.env.SEED_ADMIN_PASSWORD || 'Admin@123!',
      role: 'admin',
    },
    {
      name: 'Meera Singh',
      email: 'meera.singh@example.com',
      password: 'HRManager@123!',
      role: 'hr_manager',
      linkToEmployee: 'meera.singh@example.com',
    },
    {
      name: 'Aarav Sharma',
      email: 'aarav.sharma@example.com',
      password: 'Employee@123!',
      role: 'employee',
      linkToEmployee: 'aarav.sharma@example.com',
    },
  ];

  for (const u of USER_DATA) {
    const existing = await User.findOne({ email: u.email });
    if (!existing) {
      const userData = {
        name: u.name,
        email: u.email,
        password: u.password,
        role: u.role,
      };
      if (u.linkToEmployee && empDocs[u.linkToEmployee]) {
        userData.employeeRef = empDocs[u.linkToEmployee]._id;
      }
      await User.create(userData);
      console.log(`   ✔ User: ${u.email} (${u.role})`);
    }
  }

  // Leave Requests
  const leaveCount = await LeaveRequest.countDocuments();
  if (leaveCount === 0) {
    const aarav = empDocs['aarav.sharma@example.com'];
    const tanvi = empDocs['tanvi.mishra@example.com'];
    const rohan = empDocs['rohan.patel@example.com'];
    const meera = empDocs['meera.singh@example.com'];

    const leaveData = [
      { employee: aarav?._id, type: 'annual', startDate: daysAgo(5), endDate: daysAgo(3), days: 3, reason: 'Family vacation', status: 'approved' },
      { employee: tanvi?._id, type: 'sick', startDate: daysAgo(10), endDate: daysAgo(8), days: 3, reason: 'Medical leave', status: 'approved' },
      { employee: rohan?._id, type: 'casual', startDate: daysAgo(2), endDate: daysAgo(1), days: 2, reason: 'Personal work', status: 'pending' },
      { employee: meera?._id, type: 'annual', startDate: daysAgo(20), endDate: daysAgo(18), days: 3, reason: 'Personal holiday', status: 'rejected' },
    ].filter(l => l.employee);

    for (const l of leaveData) {
      await LeaveRequest.create(l);
    }
  }

  const [ec, dc, uc, lc] = await Promise.all([
    Employee.countDocuments(),
    Department.countDocuments(),
    User.countDocuments(),
    LeaveRequest.countDocuments(),
  ]);

  return { ec, dc, uc, lc };
}

module.exports = { seedDatabase };
