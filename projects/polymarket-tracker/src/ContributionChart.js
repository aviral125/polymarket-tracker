import React, { useMemo } from 'react';
import './ContributionChart.css';

const ContributionChart = ({ activityByDate = {}, daysToShow = 365 }) => {
  // Helper function to get local date string (YYYY-MM-DD) to match App.js
  const getLocalDateKey = (date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  // Generate days based on daysToShow, aligned to weeks starting on Sunday
  const days = useMemo(() => {
    const result = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // Find the most recent Saturday (end of the current week for the chart)
    // Actually standard GitHub chart ends on "today" or nearest "Saturday"?
    // Let's stick to the previous logic: align to weeks.
    // If we want the chart to END today, we should make sure the last column includes today.
    
    // Let's assume standard GitHub style: columns are weeks.
    // We need enough columns to cover 'daysToShow'.
    
    // Calculate start date
    const startDate = new Date(today);
    startDate.setDate(today.getDate() - daysToShow);
    
    // Adjust start date to the previous Sunday
    const startDayOfWeek = startDate.getDay(); // 0 is Sunday
    startDate.setDate(startDate.getDate() - startDayOfWeek);
    
    // Calculate end date (next Saturday from today to complete the week)
    const endDayOfWeek = today.getDay();
    const daysUntilSaturday = 6 - endDayOfWeek;
    const endDate = new Date(today);
    endDate.setDate(today.getDate() + daysUntilSaturday);
    
    // Generate all days from startDate to endDate
    const currentDate = new Date(startDate);
    while (currentDate <= endDate) {
        const dateKey = getLocalDateKey(currentDate);
        result.push({
            date: new Date(currentDate),
            dateKey,
            count: activityByDate[dateKey] || 0
        });
        currentDate.setDate(currentDate.getDate() + 1);
    }
    
    return result;
  }, [activityByDate, daysToShow]);

  // Calculate max activity for color intensity
  const maxActivity = useMemo(() => {
    const values = Object.values(activityByDate || {});
    return values.length > 0 ? Math.max(...values, 1) : 1;
  }, [activityByDate]);

  const getColorIntensity = (count) => {
    if (count === 0) return 0;
    const intensity = Math.min(count / maxActivity, 1);
    if (intensity < 0.25) return 1;
    if (intensity < 0.5) return 2;
    if (intensity < 0.75) return 3;
    return 4;
  };

  const getColorClass = (intensity) => {
    return `activity-level-${intensity}`;
  };

  // Group days by weeks (each week starts on Sunday)
  const weeks = useMemo(() => {
    const result = [];
    
    for (let i = 0; i < days.length; i += 7) {
      const week = days.slice(i, i + 7);
      // Ensure each week has exactly 7 days (pad with nulls if needed)
      while (week.length < 7) {
        week.push(null);
      }
      result.push(week);
    }
    
    return result;
  }, [days]);

  // Get month labels
  const monthLabels = useMemo(() => {
    const labels = [];
    let lastMonth = -1;
    
    weeks.forEach((week, weekIndex) => {
      // Find first non-null day in the week
      const firstDay = week.find(day => day !== null);
      if (firstDay && firstDay.date) {
        const month = firstDay.date.getMonth();
        
        if (month !== lastMonth && weekIndex % 4 === 0) {
          labels.push({
            weekIndex,
            label: firstDay.date.toLocaleDateString('en-US', { month: 'short' }),
          });
          lastMonth = month;
        }
      }
    });
    
    return labels;
  }, [weeks]);

  return (
    <div className="contribution-chart">
      <div className="chart-container">
        <div className="month-labels">
          {monthLabels.map((label, index) => (
            <div
              key={index}
              className="month-label"
              style={{ left: `${(label.weekIndex / weeks.length) * 100}%` }}
            >
              {label.label}
            </div>
          ))}
        </div>
        
        <div className="chart-grid">
          <div className="day-labels">
            <div>Sun</div>
            <div>Mon</div>
            <div>Tue</div>
            <div>Wed</div>
            <div>Thu</div>
            <div>Fri</div>
            <div>Sat</div>
          </div>
          
          <div className="weeks-container">
            {weeks.map((week, weekIndex) => (
              <div key={weekIndex} className="week">
                {week.map((day, dayIndex) => {
                  if (!day) {
                    return <div key={`empty-${dayIndex}`} className="day-cell empty" />;
                  }
                  const intensity = getColorIntensity(day.count);
                  const colorClass = getColorClass(intensity);
                  
                  return (
                    <div
                      key={day.dateKey}
                      className={`day-cell ${colorClass}`}
                      title={`${day.date.toLocaleDateString()}: ${day.count} ${day.count === 1 ? 'activity' : 'activities'}`}
                    />
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>
      
      <div className="chart-legend">
        <span className="legend-label">Less</span>
        <div className="legend-cells">
          <div className="day-cell activity-level-0" />
          <div className="day-cell activity-level-1" />
          <div className="day-cell activity-level-2" />
          <div className="day-cell activity-level-3" />
          <div className="day-cell activity-level-4" />
        </div>
        <span className="legend-label">More</span>
      </div>
    </div>
  );
};

export default ContributionChart;

