import React, { useMemo, useRef, useEffect, useState } from 'react';
import './ContributionChart.css';

const ContributionChart = ({ activityByDate = {}, daysToShow = 365, dominantColor = '#30bb31' }) => {
  const containerRef = useRef(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

  // Helper function to get local date string (YYYY-MM-DD) to match App.js
  const getLocalDateKey = (date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  // Measure container size for responsive grid
  useEffect(() => {
    if (!containerRef.current) return;
    
    const observer = new ResizeObserver((entries) => {
      for (let entry of entries) {
        setDimensions({
          width: entry.contentRect.width,
          height: entry.contentRect.height
        });
      }
    });

    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  // Generate days based on daysToShow
  const days = useMemo(() => {
    const result = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // Calculate start date
    const startDate = new Date(today);
    startDate.setDate(today.getDate() - daysToShow);
    startDate.setHours(0, 0, 0, 0);
    
    // Generate all days from startDate to today
    const currentDate = new Date(startDate);
    while (currentDate <= today) {
      const dateKey = getLocalDateKey(currentDate);
      result.push({
        id: currentDate.toISOString(),
        date: new Date(currentDate),
        dateKey,
        count: activityByDate[dateKey] || 0,
        label: new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(currentDate)
      });
      currentDate.setDate(currentDate.getDate() + 1);
    }
    
    return result;
  }, [activityByDate, daysToShow]);

  // Determine Gap and Radius based on density (Figma logic)
  const { targetGap, radius } = useMemo(() => {
    const count = days.length;
    if (count < 70) {
      // 1 Month
      return { targetGap: 4, radius: 6 }; 
    } else if (count < 200) {
      // 3 Months
      return { targetGap: 4, radius: 4 };
    } else {
      // 1 Year
      return { targetGap: 2.5, radius: 2 };
    }
  }, [days.length]);

  // Calculate Grid Layout (Figma algorithm)
  const { cols, tileSize, gap } = useMemo(() => {
    if (dimensions.width === 0 || days.length === 0) {
      return { cols: 1, tileSize: 10, gap: 2 };
    }

    const count = days.length;
    const W = dimensions.width;
    const H = dimensions.height;
    
    let bestS = 0;
    
    // Find best tile size
    for (let s = Math.floor(H); s > 2; s--) {
      const c = Math.floor(W / (s + targetGap));
      const r = Math.floor(H / (s + targetGap));
      if (c * r >= count) {
        bestS = s;
        break;
      }
    }
    
    if (bestS === 0) {
      bestS = Math.sqrt((W * H) / count) - targetGap;
    }

    const computedCols = Math.floor(W / (bestS + targetGap));
    
    return {
      cols: computedCols,
      tileSize: bestS,
      gap: targetGap
    };
  }, [dimensions, days.length, targetGap]);

  // Dynamic Theme Colors based on extracted dominant color
  const getColor = (count) => {
    if (count === 0) return 'rgba(0, 0, 0, 0.06)'; // Light gray for empty
    
    // Parse hex color to RGB
    const hex = dominantColor.replace('#', '');
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);
    
    // 4 shades based on activity count
    if (count >= 1 && count < 5) return `rgba(${r}, ${g}, ${b}, 0.4)`;
    if (count >= 5 && count < 10) return `rgba(${r}, ${g}, ${b}, 0.7)`;
    return `rgb(${r}, ${g}, ${b})`; // Full color for high activity
  };

  // Generate month labels
  const labels = useMemo(() => {
    const labelsList = [];
    let lastMonth = -1;

    days.forEach((day, index) => {
      const month = day.date.getMonth();
      if (month !== lastMonth) {
        // Only add label if it fits (heuristic based on index distance)
        if (index === 0 || index - (labelsList[labelsList.length - 1]?.index || 0) > (days.length / 4)) {
          labelsList.push({ 
            text: new Intl.DateTimeFormat('en-US', { month: 'short' }).format(day.date), 
            index 
          });
          lastMonth = month;
        }
      }
    });
    return labelsList;
  }, [days]);

  return (
    <div className="contribution-chart-wrapper">
      {/* Grid Container */}
      <div 
        ref={containerRef}
        className="contribution-grid"
        style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${cols}, ${tileSize}px)`,
          gridAutoRows: `${tileSize}px`,
          gap: `${gap}px`,
          alignContent: 'start',
          justifyContent: 'start',
        }}
      >
        {days.map((item) => (
          <div 
            key={item.id} 
            className="grid-cell"
            style={{
              backgroundColor: getColor(item.count),
              borderRadius: `${radius}px`
            }}
            title={`${item.label}: ${item.count} ${item.count === 1 ? 'activity' : 'activities'}`}
          />
        ))}
      </div>

      {/* Labels Row */}
      <div className="chart-labels">
        {labels.map((label, i) => {
          const pct = (label.index / days.length) * 100;
          return (
            <div 
              key={`${label.text}-${i}`}
              className="chart-label"
              style={{ left: `${pct}%` }}
            >
              {label.text}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default ContributionChart;
