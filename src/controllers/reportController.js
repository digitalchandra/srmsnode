
const Sale = require("../models/Sale");

const getSalesSummary = async (req, res) => {
  try {
    const tenantId = req.user.tenantId;

    // Use the tenant's local reporting timezone.
    // Default: Nepal time. Configure REPORT_TIMEZONE if needed.
    const timezone = process.env.REPORT_TIMEZONE || "Asia/Kathmandu";

    const now = new Date();

    // Build date boundaries using Intl so DST-aware timezones work too.
    const getDateParts = (date) => {
      const parts = new Intl.DateTimeFormat("en-CA", {
        timeZone: timezone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).formatToParts(date);

      return Object.fromEntries(
        parts.filter((part) => part.type !== "literal")
          .map((part) => [part.type, Number(part.value)])
      );
    };

    const parts = getDateParts(now);
    const { year, month, day } = parts;

    const localMidnightAsUTC = (y, m, d) => {
      // Iteratively find UTC time corresponding to midnight in timezone.
      const target = Date.UTC(y, m - 1, d);
      let guess = target;

      for (let i = 0; i < 3; i++) {
        const localParts = getDateParts(new Date(guess));
        const represented = Date.UTC(
          localParts.year,
          localParts.month - 1,
          localParts.day
        );
        guess += target - represented;
      }

      return new Date(guess);
    };

    const todayStart = localMidnightAsUTC(year, month, day);
    const tomorrowStart = localMidnightAsUTC(year, month, day + 1);
    const monthStart = localMidnightAsUTC(year, month, 1);

    // Week starts Monday.
    const weekday = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
    const daysSinceMonday = (weekday + 6) % 7;
    const weekStart = localMidnightAsUTC(
      year,
      month,
      day - daysSinceMonday
    );

    const summarizePeriod = async (start, end) => {
      const result = await Sale.aggregate([
        {
          $match: {
            tenantId: new Sale.base.Types.ObjectId(tenantId),
            status: "COMPLETED",
            saleDate: { $gte: start, $lt: end },
          },
        },
        {
          $group: {
            _id: null,
            salesCount: { $sum: 1 },
            totalSales: { $sum: "$totalAmount" },
            totalPaid: { $sum: "$paidAmount" },
            outstanding: {
              $sum: {
                $max: [
                  0,
                  { $subtract: ["$totalAmount", "$paidAmount"] },
                ],
              },
            },
          },
        },
      ]);

         if (result.length > 0) {
            const { _id, ...summary } = result[0];
            return summary;
            }

            return {
            salesCount: 0,
            totalSales: 0,
            totalPaid: 0,
            outstanding: 0,
            };
    };

    const [today, thisWeek, thisMonth, completedCount] = await Promise.all([
      summarizePeriod(todayStart, tomorrowStart),
      summarizePeriod(weekStart, tomorrowStart),
      summarizePeriod(monthStart, tomorrowStart),
      Sale.countDocuments({ tenantId, status: "COMPLETED" }),
    ]);

    return res.status(200).json({
      success: true,
      data: {
        timezone,
        today,
        thisWeek,
        thisMonth,
        completedSalesCount: completedCount,
      },
    });
  } catch (error) {
    console.error("Sales summary error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to generate sales summary",
    });
  }
};


const getDailySales = async (req, res) => {
  try {
    const tenantId = req.user.tenantId;
    const timezone = process.env.REPORT_TIMEZONE || "Asia/Kathmandu";

    const { startDate, endDate } = req.query;

    // Default: last 7 calendar days, including today.
    const datePattern = /^\d{4}-\d{2}-\d{2}$/;

    const isValidDate = (value) => {
      if (!datePattern.test(value || "")) return false;

      const date = new Date(`${value}T00:00:00.000Z`);
      return (
        !Number.isNaN(date.getTime()) &&
        date.toISOString().slice(0, 10) === value
      );
    };

    if (
      (startDate && !isValidDate(startDate)) ||
      (endDate && !isValidDate(endDate))
    ) {
      return res.status(400).json({
        success: false,
        message: "Dates must use the YYYY-MM-DD format.",
      });
    }

    const getDateParts = (date) => {
      const parts = new Intl.DateTimeFormat("en-CA", {
        timeZone: timezone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).formatToParts(date);

      return Object.fromEntries(
        parts
          .filter((part) => part.type !== "literal")
          .map((part) => [part.type, Number(part.value)])
      );
    };

    const localMidnightAsUTC = (y, m, d) => {
      const target = Date.UTC(y, m - 1, d);
      let guess = target;

      for (let i = 0; i < 3; i++) {
        const local = getDateParts(new Date(guess));
        const represented = Date.UTC(
          local.year,
          local.month - 1,
          local.day
        );
        guess += target - represented;
      }

      return new Date(guess);
    };

    const nowParts = getDateParts(new Date());

    // Default start date: six days before today.
    const start = startDate || (() => {
      const date = new Date(
        Date.UTC(nowParts.year, nowParts.month - 1, nowParts.day - 6)
      );
      return date.toISOString().slice(0, 10);
    })();

    const end = endDate || [
      nowParts.year,
      String(nowParts.month).padStart(2, "0"),
      String(nowParts.day).padStart(2, "0"),
    ].join("-");

    if (start > end) {
      return res.status(400).json({
        success: false,
        message: "startDate must be on or before endDate.",
      });
    }

    const startParts = start.split("-").map(Number);
    const endParts = end.split("-").map(Number);

    const startBoundary = localMidnightAsUTC(...startParts);
    const endBoundary = localMidnightAsUTC(
      endParts[0],
      endParts[1],
      endParts[2] + 1
    );

    const days =
      (Date.UTC(...endParts.map((value, index) =>
        index === 1 ? value - 1 : value
      )) -
        Date.UTC(...startParts.map((value, index) =>
          index === 1 ? value - 1 : value
        ))) /
      86400000 +
      1;

    if (days > 366) {
      return res.status(400).json({
        success: false,
        message: "Date range cannot exceed 366 days.",
      });
    }

    const results = await Sale.aggregate([
      {
        $match: {
          tenantId: new Sale.base.Types.ObjectId(tenantId),
          status: "COMPLETED",
          saleDate: {
            $gte: startBoundary,
            $lt: endBoundary,
          },
        },
      },
      {
        $group: {
          _id: {
            $dateToString: {
              date: "$saleDate",
              format: "%Y-%m-%d",
              timezone,
            },
          },
          salesCount: { $sum: 1 },
          totalSales: { $sum: "$totalAmount" },
          totalPaid: { $sum: "$paidAmount" },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    // Include days with no sales as zero.
    const byDate = new Map(
      results.map((item) => [item._id, item])
    );

    const dailySales = [];
    const cursor = new Date(
      Date.UTC(startParts[0], startParts[1] - 1, startParts[2])
    );
    const lastDay = new Date(
      Date.UTC(endParts[0], endParts[1] - 1, endParts[2])
    );

    while (cursor <= lastDay) {
      const dateKey = cursor.toISOString().slice(0, 10);
      const item = byDate.get(dateKey);

      dailySales.push({
        date: dateKey,
        salesCount: item?.salesCount || 0,
        totalSales: item?.totalSales || 0,
        totalPaid: item?.totalPaid || 0,
      });

      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }

    return res.status(200).json({
      success: true,
      data: {
        timezone,
        startDate: start,
        endDate: end,
        dailySales,
      },
    });
  } catch (error) {
    console.error("Daily sales report error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to generate daily sales report.",
    });
  }
};


module.exports = { 
    getSalesSummary,
    getDailySales,

 };
