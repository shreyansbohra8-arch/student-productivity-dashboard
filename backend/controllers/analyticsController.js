const mongoose = require('mongoose');
const Task = require('../models/Task');
const StudySession = require('../models/StudySession');
const Attendance = require('../models/Attendance');
const Exam = require('../models/Exam');

// GET /api/analytics/dashboard
// Every number here is computed via a MongoDB aggregation pipeline, not frontend counting.
async function getDashboardAnalytics(req, res, next) {
  try {
    const userId = new mongoose.Types.ObjectId(req.userId);
    const now = new Date();

    // ---- Task completion aggregation ----
    const taskAgg = await Task.aggregate([
      { $match: { userId } },
      {
        $group: {
          _id: null,
          totalTasks: { $sum: 1 },
          completedTasks: { $sum: { $cond: [{ $eq: ['$status', 'Completed'] }, 1, 0] } },
          pendingTasks: { $sum: { $cond: [{ $eq: ['$status', 'Pending'] }, 1, 0] } },
          overdueTasks: {
            $sum: {
              $cond: [
                { $and: [{ $lt: ['$deadline', now] }, { $ne: ['$status', 'Completed'] }] },
                1,
                0
              ]
            }
          }
        }
      }
    ]);

    const taskStats = taskAgg[0] || { totalTasks: 0, completedTasks: 0, pendingTasks: 0, overdueTasks: 0 };
    taskStats.completionPercentage = taskStats.totalTasks
      ? Math.round((taskStats.completedTasks / taskStats.totalTasks) * 100)
      : 0;
    delete taskStats._id;

    // ---- Study time aggregation: totals + by subject ----
    const studyBySubject = await StudySession.aggregate([
      { $match: { userId, mode: 'Focus' } },
      {
        $group: {
          _id: '$subjectId',
          totalMinutes: { $sum: '$durationMinutes' },
          sessionCount: { $sum: 1 }
        }
      },
      {
        $lookup: {
          from: 'subjects',
          localField: '_id',
          foreignField: '_id',
          as: 'subject'
        }
      },
      { $unwind: { path: '$subject', preserveNullAndEmptyArrays: true } },
      {
        $project: {
          _id: 0,
          subjectId: '$_id',
          subjectName: { $ifNull: ['$subject.name', 'Unassigned'] },
          color: '$subject.color',
          totalMinutes: 1,
          totalHours: { $round: [{ $divide: ['$totalMinutes', 60] }, 2] },
          sessionCount: 1
        }
      },
      { $sort: { totalMinutes: -1 } }
    ]);

    const studyTotals = await StudySession.aggregate([
      { $match: { userId, mode: 'Focus' } },
      { $group: { _id: null, totalMinutes: { $sum: '$durationMinutes' }, totalSessions: { $sum: 1 } } }
    ]);
    const studyStats = studyTotals[0] || { totalMinutes: 0, totalSessions: 0 };
    const totalHours = Math.round(((studyStats.totalMinutes || 0) / 60) * 100) / 100;

    const mostProductiveSubject = studyBySubject.length > 0 ? studyBySubject[0] : null;

    // ---- Most productive day of week ----
    const productiveDayAgg = await StudySession.aggregate([
      { $match: { userId, mode: 'Focus' } },
      {
        $group: {
          _id: { $dayOfWeek: '$completedAt' },
          totalMinutes: { $sum: '$durationMinutes' }
        }
      },
      { $sort: { totalMinutes: -1 } },
      { $limit: 1 }
    ]);
    const dayNames = ['', 'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const mostProductiveDay = productiveDayAgg[0] ? dayNames[productiveDayAgg[0]._id] : null;

    // ---- Study trend over time (last 14 days) ----
    const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
    const studyTrend = await StudySession.aggregate([
      { $match: { userId, mode: 'Focus', completedAt: { $gte: fourteenDaysAgo } } },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$completedAt' } },
          totalMinutes: { $sum: '$durationMinutes' }
        }
      },
      { $sort: { _id: 1 } },
      { $project: { _id: 0, date: '$_id', totalMinutes: 1 } }
    ]);

    // ---- Productivity streak ----
    // A day counts as productive when the user logged a Focus session (completedAt)
    // OR completed a task (Task.completedAt is set when a task transitions to
    // 'Completed'). The two sources are merged with $unionWith, deduplicated per
    // calendar day, then consecutive days are grouped into streaks via
    // $setWindowFields gap detection -- all computed inside MongoDB.
    const streakAgg = await StudySession.aggregate([
      { $match: { userId, mode: 'Focus' } },
      { $project: { date: { $dateToString: { format: '%Y-%m-%d', date: '$completedAt' } } } },
      {
        $unionWith: {
          coll: 'tasks',
          pipeline: [
            { $match: { userId, status: 'Completed', completedAt: { $ne: null } } },
            {
              $project: {
                date: { $dateToString: { format: '%Y-%m-%d', date: '$completedAt' } }
              }
            }
          ]
        }
      },
      { $group: { _id: '$date' } },
      { $project: { _id: 0, date: '$_id' } },
      { $sort: { date: 1 } },
      // Tag each date with the previous productive day so gaps can be detected
      {
        $setWindowFields: {
          sortBy: { date: 1 },
          output: {
            prevDate: { $shift: { output: '$date', by: -1, default: null } }
          }
        }
      },
      // Assign a streak id: increment whenever the previous day is missing
      {
        $setWindowFields: {
          sortBy: { date: 1 },
          output: {
            streakId: {
              $sum: {
                $cond: [
                  {
                    $and: [
                      { $ne: ['$prevDate', null] },
                      {
                        $eq: [
                          {
                            $subtract: [
                              { $toLong: { $toDate: '$date' } },
                              { $toLong: { $toDate: '$prevDate' } }
                            ]
                          },
                          86400000
                        ]
                      }
                    ]
                  },
                  0,
                  1
                ]
              },
              window: { documents: ['unbounded', 'current'] }
            }
          }
        }
      },
      {
        $group: {
          _id: '$streakId',
          days: { $sum: 1 },
          startDate: { $min: '$date' },
          endDate: { $max: '$date' }
        }
      },
      { $sort: { endDate: -1 } },
      {
        $group: {
          _id: null,
          longestStreak: { $max: '$days' },
          activeDays: { $sum: '$days' },
          streaks: { $push: { days: '$days', startDate: '$startDate', endDate: '$endDate' } }
        }
      },
      { $project: { _id: 0, longestStreak: 1, activeDays: 1, streaks: 1 } }
    ]);

    const streakSummary = streakAgg[0] || { longestStreak: 0, activeDays: 0, streaks: [] };
    const streaks = streakSummary.streaks || [];

    // The current streak is the most recent one: it ends today (still productive
    // today) or yesterday (streak is still alive until today runs out).
    const todayStr = now.toISOString().slice(0, 10);
    const yesterdayStr = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    let currentStreak = 0;
    let todayProductive = false;
    for (const s of streaks) {
      if (s.endDate === todayStr) {
        todayProductive = true;
        currentStreak = Math.max(currentStreak, s.days);
      } else if (s.endDate === yesterdayStr) {
        currentStreak = Math.max(currentStreak, s.days);
      }
    }

    // ---- Attendance aggregation ----
    // The per-user threshold is known before the pipeline runs, so the
    // below-threshold split is computed by MongoDB itself (via $facet)
    // rather than filtered in application code afterward.
    const threshold = req.user.attendanceThreshold || 75;

    const attendanceFacet = await Attendance.aggregate([
      { $match: { userId } },
      {
        $lookup: {
          from: 'subjects',
          localField: 'subjectId',
          foreignField: '_id',
          as: 'subject'
        }
      },
      { $unwind: { path: '$subject', preserveNullAndEmptyArrays: true } },
      {
        $project: {
          _id: 0,
          subjectId: '$subjectId',
          subjectName: '$subject.name',
          totalClasses: 1,
          presentClasses: 1,
          percentage: {
            $cond: [
              { $eq: ['$totalClasses', 0] },
              0,
              { $round: [{ $multiply: [{ $divide: ['$presentClasses', '$totalClasses'] }, 100] }, 2] }
            ]
          }
        }
      },
      { $sort: { percentage: 1 } },
      {
        $facet: {
          all: [],
          belowThreshold: [{ $match: { percentage: { $lt: threshold } } }]
        }
      }
    ]);

    const attendanceAgg = attendanceFacet[0]?.all || [];
    const belowThreshold = attendanceFacet[0]?.belowThreshold || [];

    const overallAgg = await Attendance.aggregate([
      { $match: { userId } },
      {
        $group: {
          _id: null,
          totalClasses: { $sum: '$totalClasses' },
          presentClasses: { $sum: '$presentClasses' }
        }
      }
    ]);
    const overall = overallAgg[0] || { totalClasses: 0, presentClasses: 0 };
    const overallPercentage = overall.totalClasses
      ? Math.round((overall.presentClasses / overall.totalClasses) * 10000) / 100
      : 0;

    // ---- Exam stats ----
    // upcomingExams is capped at 5 for the dashboard preview list, but
    // upcomingCount reflects the true total via a separate MongoDB count
    // rather than upcomingExams.length (which would be wrong -- and capped
    // at 5 -- once a user has more than 5 upcoming exams).
    const upcomingExamFilter = { userId, examDate: { $gte: now } };
    const [upcomingExams, upcomingCount] = await Promise.all([
      Exam.find(upcomingExamFilter).sort({ examDate: 1 }).limit(5).populate('subjectId', 'name color'),
      Exam.countDocuments(upcomingExamFilter)
    ]);

    const nearestExam = upcomingExams[0] || null;

    res.json({
      success: true,
      data: {
        tasks: taskStats,
        study: {
          totalHours,
          totalMinutes: studyStats.totalMinutes || 0,
          totalSessions: studyStats.totalSessions || 0,
          bySubject: studyBySubject,
          mostProductiveSubject,
          mostProductiveDay,
          trend: studyTrend
        },
        attendance: {
          overallPercentage,
          bySubject: attendanceAgg,
          belowThreshold,
          threshold
        },
        exams: {
          upcoming: upcomingExams,
          nearestExam,
          upcomingCount
        },
        streak: {
          current: currentStreak,
          longest: streakSummary.longestStreak || 0,
          activeDays: streakSummary.activeDays || 0,
          todayProductive
        }
      }
    });
  } catch (err) {
    next(err);
  }
}

module.exports = { getDashboardAnalytics };
