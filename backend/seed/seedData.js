require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const User = require('../models/User');
const Subject = require('../models/Subject');
const Task = require('../models/Task');
const StudySession = require('../models/StudySession');
const Attendance = require('../models/Attendance');
const Note = require('../models/Note');
const Exam = require('../models/Exam');

const DEMO_EMAIL = 'demo@student.com';
const DEMO_PASSWORD = 'Demo@1234';

function daysFromNow(n) {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d;
}

async function seed() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to MongoDB for seeding...');

  // Clean previous demo user's data
  const existing = await User.findOne({ email: DEMO_EMAIL });
  if (existing) {
    await Promise.all([
      Task.deleteMany({ userId: existing._id }),
      Subject.deleteMany({ userId: existing._id }),
      StudySession.deleteMany({ userId: existing._id }),
      Attendance.deleteMany({ userId: existing._id }),
      Note.deleteMany({ userId: existing._id }),
      Exam.deleteMany({ userId: existing._id }),
      User.deleteOne({ _id: existing._id })
    ]);
    console.log('Removed previous demo data.');
  }

  const hashedPassword = await bcrypt.hash(DEMO_PASSWORD, 10);
  const user = await User.create({ name: 'Demo Student', email: DEMO_EMAIL, password: hashedPassword });

  const subjectDefs = [
    { name: 'Database Management Systems', code: 'CSE301', color: '#6366f1' },
    { name: 'Operating Systems', code: 'CSE302', color: '#22c55e' },
    { name: 'Computer Networks', code: 'CSE303', color: '#f59e0b' },
    { name: 'Machine Learning', code: 'CSE401', color: '#ec4899' }
  ];
  const subjects = await Subject.insertMany(subjectDefs.map((s) => ({ ...s, userId: user._id })));

  const [dbms, os, cn, ml] = subjects;

  await Task.insertMany([
    {
      userId: user._id,
      subjectId: dbms._id,
      title: 'Finish ER diagram for DBMS project',
      description: 'Design the entity-relationship diagram for the productivity dashboard schema.',
      deadline: daysFromNow(2),
      priority: 'High',
      status: 'In Progress',
      subtasks: [
        { title: 'List entities', completed: true },
        { title: 'Define relationships', completed: true },
        { title: 'Draw diagram', completed: false }
      ]
    },
    {
      userId: user._id,
      subjectId: os._id,
      title: 'Read Chapter 5: Process Scheduling',
      deadline: daysFromNow(-1),
      priority: 'Medium',
      status: 'Pending',
      subtasks: [{ title: 'Summarize scheduling algorithms', completed: false }]
    },
    {
      userId: user._id,
      subjectId: cn._id,
      title: 'Submit networking lab report',
      deadline: daysFromNow(5),
      priority: 'Urgent',
      status: 'Pending',
      subtasks: []
    },
    {
      userId: user._id,
      subjectId: ml._id,
      title: 'Train baseline classification model',
      deadline: daysFromNow(-3),
      priority: 'High',
      status: 'Completed',
      completedAt: daysFromNow(-3),
      subtasks: [
        { title: 'Preprocess dataset', completed: true },
        { title: 'Train model', completed: true }
      ]
    },
    {
      userId: user._id,
      title: 'Update resume with new project',
      deadline: daysFromNow(10),
      priority: 'Low',
      status: 'Pending',
      subtasks: []
    }
  ]);

  await Attendance.insertMany([
    { userId: user._id, subjectId: dbms._id, totalClasses: 20, presentClasses: 18 },
    { userId: user._id, subjectId: os._id, totalClasses: 22, presentClasses: 14 },
    { userId: user._id, subjectId: cn._id, totalClasses: 18, presentClasses: 16 },
    { userId: user._id, subjectId: ml._id, totalClasses: 15, presentClasses: 11 }
  ]);

  const sessions = [];
  const subjectCycle = [dbms, os, cn, ml];
  for (let i = 0; i < 14; i++) {
    const subj = subjectCycle[i % subjectCycle.length];
    sessions.push({
      userId: user._id,
      subjectId: subj._id,
      mode: 'Focus',
      durationMinutes: [25, 25, 50, 25][i % 4],
      completedAt: daysFromNow(-i)
    });
  }
  await StudySession.insertMany(sessions);

  await Note.insertMany([
    {
      userId: user._id,
      subjectId: dbms._id,
      title: 'MongoDB Aggregation Pipeline Basics',
      content:
        'Aggregation pipelines process documents through stages such as $match, $group, $project, $sort, and $lookup to transform and analyze data.',
      tags: ['mongodb', 'aggregation', 'dbms']
    },
    {
      userId: user._id,
      subjectId: os._id,
      title: 'CPU Scheduling Algorithms',
      content:
        'Common scheduling algorithms include First-Come-First-Served, Shortest Job First, Round Robin, and Priority Scheduling.',
      tags: ['os', 'scheduling']
    },
    {
      userId: user._id,
      subjectId: ml._id,
      title: 'Bias-Variance Tradeoff',
      content: 'High bias leads to underfitting, high variance leads to overfitting. The goal is to find the right balance.',
      tags: ['ml', 'theory']
    }
  ]);

  await Exam.insertMany([
    { userId: user._id, subjectId: dbms._id, examName: 'DBMS Mid-Semester Exam', examDate: daysFromNow(6) },
    { userId: user._id, subjectId: os._id, examName: 'OS Quiz 2', examDate: daysFromNow(1) },
    { userId: user._id, subjectId: cn._id, examName: 'Networks Final Exam', examDate: daysFromNow(30) },
    { userId: user._id, subjectId: ml._id, examName: 'ML Project Review', examDate: daysFromNow(0) }
  ]);

  console.log('\nSeed complete!');
  console.log('----------------------------------------');
  console.log('Demo login credentials:');
  console.log(`  Email:    ${DEMO_EMAIL}`);
  console.log(`  Password: ${DEMO_PASSWORD}`);
  console.log('----------------------------------------\n');

  await mongoose.disconnect();
  process.exit(0);
}

seed().catch((err) => {
  console.error('Seeding failed:', err);
  process.exit(1);
});
